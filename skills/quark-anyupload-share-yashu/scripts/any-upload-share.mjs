#!/usr/bin/env node
/**
 * 任意上传（夸克网盘）
 * 把本地文件上传到夸克网盘「ComfyUI牙叔整合包2025/任意上传」目录，
 * 并创建「永久有效 + 无提取码」的公开分享链接。
 *
 * 用法：
 *   node scripts/any-upload-share.mjs --file "<本地文件绝对路径>" \
 *     [--file "<另一个绝对路径>"] \
 *     [--session-input "<用户原始提问>"] \
 *     [--session-id "<时间戳>-<随机>"] \
 *     [--target "ComfyUI牙叔整合包2025/任意上传"] \
 *     [--cli-dir "<quarkclouddrive skill 目录>"] \
 *     [--skip-precheck] [--out "<结果 JSON 路径>"]
 *
 * 输出：stdout 打印单行 JSON（同时写入 --out 指定的文件，默认 %TEMP%/any-upload-share-result.json）。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_TARGET = 'ComfyUI牙叔整合包2025/任意上传';
const CLI_TIMEOUT_MS = 30 * 60 * 1000;
const GIT_BASH_CANDIDATES = [
  'D:\\software\\Git\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
];

function parseArgs(argv) {
  const out = { files: [], flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '-f') out.files.push(argv[++i]);
    else if (a === '--session-input') out.sessionInput = argv[++i];
    else if (a === '--session-id') out.sessionId = argv[++i];
    else if (a === '--target') out.target = argv[++i];
    else if (a === '--cli-dir') out.cliDir = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--skip-precheck') out.flags.add('skip-precheck');
    else if (a === '--help' || a === '-h') out.flags.add('help');
  }
  return out;
}

function makeSessionId() {
  const ts = Math.floor(Date.now() / 1000);
  let rand = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 6; i++) rand += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${ts}-${rand}`;
}

function resolveCliDir(explicit) {
  const candidates = [
    explicit,
    process.env.QUARK_SKILL_DIR,
    path.join(os.homedir(), '.workbuddy', 'skills', 'quarkclouddrive'),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'scripts', 'quark-drive.cjs'))) return dir;
  }
  return null;
}

/** 顺序执行 CLI，返回解析后的 NDJSON 行 */
function runCli(ctx, args, timeout = CLI_TIMEOUT_MS) {
  const cliPath = path.join(ctx.cliDir, 'scripts', 'quark-drive.cjs');
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: ctx.cliDir,
    encoding: 'utf8',
    timeout,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = res.stdout || '';
  const lines = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || (s[0] !== '{' && s[0] !== '[')) continue;
    try {
      lines.push(JSON.parse(s));
    } catch {
      /* 跳过非 JSON 行 */
    }
  }
  return {
    lines,
    stdout,
    stderr: (res.stderr || '') + (res.error ? `\n[spawn] ${res.error.message}` : ''),
    status: res.status,
  };
}

function sessionArgs(ctx) {
  return ['--session-input', ctx.sessionInput, '--session-id', ctx.sessionId];
}

function resultOf(lines, action) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l && l.type === 'result' && (!action || l.action === action)) return l;
  }
  return null;
}

/** 读取 search / browse --all 落盘的完整结果 JSONL */
function readArtifact(lines) {
  const art = lines.find((l) => l && l.type === 'artifact' && l.data && l.data.file_path);
  if (!art) return null;
  const p = art.data.file_path;
  if (!fs.existsSync(p)) return null;
  const items = [];
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    try {
      items.push(JSON.parse(s));
    } catch {
      /* 跳过坏行 */
    }
  }
  return items;
}

function diagnose(res) {
  const msg = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (/PROGRAM BLOCKED BY SECURITY POLICY/i.test(msg)) {
    return '夸克 CLI 依赖的系统程序 reg.exe 被沙箱程序黑名单拦截。请在「安全中心 → 命令安全 → 程序黑名单」中移除 reg.exe，或在非沙箱环境重试。';
  }
  if (/未授权|认证|token/i.test(msg)) {
    return '夸克网盘未授权或授权已过期，请先执行 quarkclouddrive 的 login 完成授权。';
  }
  return null;
}

function fail(res, fallback) {
  const hint = diagnose(res);
  const r = res ? resultOf(res.lines) : null;
  if (r && r.msg) return hint ? `${r.msg}（${hint}）` : r.msg;
  return hint || fallback;
}

function isFolderItem(it) {
  return it.file_type === '0' || it.category === 0;
}

function segName(seg) {
  if (typeof seg === 'string') return seg;
  if (seg && typeof seg === 'object') {
    for (const k of ['filename', 'name', 'title', 'missing', 'text']) {
      if (typeof seg[k] === 'string') return seg[k];
    }
  }
  return '';
}

function pathSegments(it) {
  return Array.isArray(it.full_path) ? it.full_path.map(segName).filter(Boolean) : [];
}

/** 判断一次查询是否真正成功（有 artifact 或 result.code 为 0） */
function queryOk(res, action) {
  if (readArtifact(res.lines)) return true;
  const r = resultOf(res.lines, action);
  return !!r && r.code === 0;
}

/** 解析顶层目录（如 ComfyUI牙叔整合包2025）的 FID */
function resolveTopFolder(ctx, topName, log) {
  // 注意：只有「查询确实成功但没找到」时才允许新建目录，避免查询失败误建重复目录
  let sawSuccessfulQuery = false;

  const b = runCli(ctx, ['browse', '--parent-fid', '0', '--all', ...sessionArgs(ctx)]);
  const items = readArtifact(b.lines);
  if (queryOk(b, 'browse')) sawSuccessfulQuery = true;
  if (items) {
    const hit = items.filter((it) => it.filename === topName && isFolderItem(it));
    if (hit.length === 1) {
      log.push(`顶层目录「${topName}」定位方式：根目录浏览`);
      return hit[0].fid;
    }
    if (hit.length > 1) throw new Error(`根目录存在多个同名文件夹「${topName}」，请手动确认目标后再试`);
  }

  const s = runCli(ctx, [
    'search', '--keyword', topName, '--search-type', 'dir', '--stdout-only', ...sessionArgs(ctx),
  ]);
  const sitems = readArtifact(s.lines);
  if (queryOk(s, 'search')) sawSuccessfulQuery = true;
  if (sitems) {
    const hit = sitems.filter((it) => it.filename === topName && isFolderItem(it));
    if (hit.length === 1) {
      log.push(`顶层目录「${topName}」定位方式：全盘搜索`);
      return hit[0].fid;
    }
    if (hit.length > 1) {
      const strict = hit.filter((it) => pathSegments(it).join('/') === topName);
      if (strict.length === 1) {
        log.push(`顶层目录「${topName}」定位方式：搜索 + 路径消歧`);
        return strict[0].fid;
      }
      throw new Error(`搜索到 ${hit.length} 个名为「${topName}」的文件夹，无法唯一确定目标，请手动指定后重试`);
    }
  }

  if (!sawSuccessfulQuery) {
    throw new Error(
      `无法确认目录「${topName}」是否存在（目录查询未成功），已中止以免创建重复目录。` +
      `原因：${fail(s, fail(b, '目录查询失败'))}`
    );
  }

  const c = runCli(ctx, ['create-folder', '--dir-path', topName, ...sessionArgs(ctx)]);
  const r = resultOf(c.lines, 'create-folder');
  if (!r || r.code !== 0 || !r.data || !r.data.fid) {
    throw new Error(`未找到目录「${topName}」且创建失败：${fail(c, '创建目录未返回 FID')}`);
  }
  log.push(`顶层目录「${topName}」不存在，已新建`);
  return r.data.fid;
}

/** 解析（或创建）子目录 FID —— create-folder 同名幂等 */
function ensureSubFolder(ctx, parentFid, name) {
  const c = runCli(ctx, [
    'create-folder', '--dir-path', name, '--parent-fid', parentFid, ...sessionArgs(ctx),
  ]);
  const r = resultOf(c.lines, 'create-folder');
  if (!r || r.code !== 0 || !r.data || !r.data.fid) {
    throw new Error(`目录「${name}」解析失败：${fail(c, '创建目录未返回 FID')}`);
  }
  return r.data.fid;
}

function precheck(ctx, log) {
  const bash = GIT_BASH_CANDIDATES.find((p) => fs.existsSync(p));
  if (!bash) {
    log.push('未找到 Git Bash，跳过环境自检');
    return;
  }
  const r = spawnSync(bash, ['-l', 'scripts/install.sh'], {
    cwd: ctx.cliDir,
    encoding: 'utf8',
    timeout: 180 * 1000,
  });
  if (r.status === 0) {
    log.push('环境自检通过');
  } else {
    // install.sh 需要在临时目录写入并联网下载，失败不阻断：本地 CLI 已存在仍可直接使用
    log.push('环境自检未通过（不阻断），继续使用本地已有 CLI');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outFile = args.out || path.join(os.tmpdir(), 'any-upload-share-result.json');

  const emit = (obj) => {
    const text = JSON.stringify(obj, null, 2);
    try {
      fs.writeFileSync(outFile, text, 'utf8');
    } catch {
      /* 忽略写盘失败 */
    }
    process.stdout.write(text + '\n');
  };

  if (args.flags.has('help') || !args.files.length) {
    process.stderr.write(
      '用法: node scripts/any-upload-share.mjs --file "<绝对路径>" [--file ...] ' +
      '[--session-input "..."] [--session-id "..."] [--target "目录/子目录"]\n'
    );
    process.exit(args.flags.has('help') ? 0 : 2);
  }

  const log = [];
  const target = args.target || DEFAULT_TARGET;
  const parts = target.split('/').map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) throw new Error(`--target 必须是「顶层目录/子目录」两段路径，当前为：${target}`);

  const cliDir = resolveCliDir(args.cliDir);
  if (!cliDir) throw new Error('未找到 quarkclouddrive skill 目录，请用 --cli-dir 指定');

  const ctx = {
    cliDir,
    sessionId: args.sessionId || makeSessionId(),
    sessionInput: args.sessionInput || `任意上传 ${args.files.join(' ')}`,
  };

  // 1. 校验本地文件
  const files = args.files.map((f) => path.resolve(f));
  for (const f of files) {
    if (!fs.existsSync(f)) throw new Error(`本地文件不存在：${f}`);
    if (fs.statSync(f).isDirectory()) throw new Error(`本技能只处理文件，不支持目录：${f}`);
  }
  log.push(`待上传 ${files.length} 个文件`);

  // 2. 环境自检（尽力而为）
  if (!args.flags.has('skip-precheck')) precheck(ctx, log);

  // 3. 解析目标目录
  const topFid = resolveTopFolder(ctx, parts[0], log);
  const targetFid = ensureSubFolder(ctx, topFid, parts[1]);

  // 4. 上传
  const uploaded = [];
  for (const f of files) {
    const u = runCli(ctx, ['upload', f, '--parent-fid', targetFid, ...sessionArgs(ctx)]);
    const r = resultOf(u.lines, 'upload');
    if (!r || r.code !== 0) throw new Error(`上传失败（${path.basename(f)}）：${fail(u, '上传未返回结果')}`);
    const fids = (r.data && r.data.fids) || [];
    if (!fids.length) throw new Error(`上传未返回文件 FID：${path.basename(f)}`);
    uploaded.push({
      file: f,
      fileName: (r.data.fileNames && r.data.fileNames[0]) || path.basename(f),
      size: (r.data && r.data.totalSize) || fs.statSync(f).size,
      fids,
    });
  }

  // 5. 创建永久公开分享链接
  const allFids = uploaded.flatMap((u) => u.fids);
  const s = runCli(ctx, [
    'share', ...allFids, '--url-type', '1', '--expired-type', '1', ...sessionArgs(ctx),
  ]);
  const sr = resultOf(s.lines, 'share');
  if (!sr || sr.code !== 0) throw new Error(`创建分享链接失败：${fail(s, '分享未返回结果')}`);
  const shareUrl = sr.data && sr.data.share_url;
  if (!shareUrl) throw new Error('创建分享成功但未返回分享链接');
  if (!/^https:\/\/pan\.quark\.cn\//.test(shareUrl)) throw new Error(`分享链接格式异常：${shareUrl}`);
  const passcode = (sr.data && sr.data.passcode) || '';
  if (passcode) throw new Error(`分享链接带提取码（${passcode}），不符合「无提取码」要求，请重试`);

  emit({
    ok: true,
    targetFolder: target,
    files: uploaded.map((u) => ({ fileName: u.fileName, size: u.size, localPath: u.file })),
    shareUrl,
    urlType: (sr.data && sr.data.url_type) ?? 1,
    expiredType: (sr.data && sr.data.expired_type) ?? 1,
    passcode: '',
    notes: log,
  });
}

try {
  main();
} catch (err) {
  const payload = { ok: false, error: err && err.message ? err.message : String(err) };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(1);
}
