#!/usr/bin/env node
// deploy_project.js - 把电脑上的 AutoJS 多文件工程（含代码与图片/音频等资源）部署到手机并运行
//
// 用法:
//   node scripts/deploy_project.js <工程目录> [--name <工程名>] [--main <入口.js>]
//                                    [--run] [--no-run] [--args '<json>'] [--keep] [--dry-run]
//
// 设计要点（与"单文件模板"通道并存，互不影响）:
//   - PC 开发态统一为多文件工程（main.js + modules/ + assets/...），AI 在电脑上组织好；
//   - 下发态 = 部署真实工程：逐个文件经 PC→手机 通道（复用 /pcfile + send_file_to_phone 模板）
//     落盘到手机 /sdcard/脚本/<name>/ 下（AutoJS6 默认工作目录，与单文件脚本并列），严格保持 PC 上的相对目录结构；
//   - 图片/音频等二进制资源作为普通文件原样下发（二进制安全、按字节数校验），手机按相对路径
//     直接读取，无需 base64 内联——这是选"部署真实工程"而非"打包单文件"的关键原因；
//   - 部署完成后（默认）触发 /run-project 运行工程入口 main.js（原生 require + 资源读取直接可用）。
//
// 配置: 默认连 http://localhost:9421；可用环境变量覆盖（同 pc_to_phone.js）：
//   RELAY_URL / RELAY_HEALTH_URL / RELAY_PC_FILE_DIR，以及 RELAY_RUN_PROJECT_URL。

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import os from "node:os";
import { zipStored } from "./zip_lib.js";

const DEFAULT_URL = process.env.RELAY_URL || "http://localhost:9421/run";
const HEALTH_URL = process.env.RELAY_HEALTH_URL || "http://localhost:9421/health";
const RUN_PROJECT_URL =
  process.env.RELAY_RUN_PROJECT_URL || "http://localhost:9421/run-project";
const PC_FILE_DIR = process.env.RELAY_PC_FILE_DIR
  ? process.env.RELAY_PC_FILE_DIR
  : path.join(os.tmpdir(), "autojs_pc_to_phone");

const TEMPLATE_PATH = "tasks/send_file_to_phone/send_file_to_phone.js";
const TEMPLATE_UNZIP = "tasks/unzip_project/unzip_project.js";
const PROJECTS_ROOT = "/sdcard/脚本";
const TEMP_MAX_AGE_MS = 3600 * 1000;
// project.json 缺省忽略项（与最小工程模板 project.json 的 ignore 对齐）
const DEFAULT_IGNORE = [
  "node_modules",
  "build",
  "out",
  ".internal",
  "declarations",
  "autojs6-dts",
];

// ============ 工具函数 ============

// 归一化本地路径：兼容 Git Bash / MSYS 风格的 "/d/foo/bar" 与 "/c/Users/..."
function normalizeLocalPath(p) {
  if (!p) return p;
  if (fssync.existsSync(p)) return p;
  const m = /^\/([A-Za-z])\/(.*)$/.exec(p);
  if (m) {
    const win = m[1].toUpperCase() + ":/" + m[2];
    if (fssync.existsSync(win)) return win;
  }
  return p;
}

function parseArgs(argv) {
  let projectDir = null;
  let name = null;
  let main = null;
  let run = true;
  let argsRaw = null;
  let keep = false;
  let dryRun = false;
  let help = false;
  let zip = false;
  let keepZip = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") name = argv[++i];
    else if (a === "--main") main = argv[++i];
    else if (a === "--no-run") run = false;
    else if (a === "--run") run = true;
    else if (a === "--args") argsRaw = argv[++i];
    else if (a === "--keep") keep = true;
    else if (a === "--zip") zip = true;
    else if (a === "--no-zip") zip = false;
    else if (a === "--keep-zip") keepZip = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "-h" || a === "--help") help = true;
    else if (!projectDir && !a.startsWith("--")) projectDir = a;
  }
  return { projectDir, name, main, run, argsRaw, keep, dryRun, help, zip, keepZip };
}

// 生成电脑中转目录里的安全文件名：原文件名清洗为字母数字 _ -，加随机后缀防重名，保留扩展名
function safePcName(localPath) {
  const base = path.basename(localPath);
  const ext = path.extname(base).toLowerCase();
  const stem = ext ? base.slice(0, -ext.length) : base;
  let cleaned = stem.replace(/[^A-Za-z0-9_\-]/g, "_");
  if (!cleaned) cleaned = "file";
  const rand = Math.random().toString(36).slice(2, 8);
  return (cleaned + "_" + rand + ext).slice(0, 120);
}

// 清理中转目录里超过 1 小时的残留文件
async function pruneTemp(exceptName) {
  let entries = [];
  try {
    entries = await fs.readdir(PC_FILE_DIR, { withFileTypes: true });
  } catch {
    return;
  }
  const now = Date.now();
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (exceptName && e.name === exceptName) continue;
    try {
      const p = path.join(PC_FILE_DIR, e.name);
      const st = await fs.stat(p);
      if (now - st.mtimeMs > TEMP_MAX_AGE_MS) {
        await fs.unlink(p).catch(() => {});
      }
    } catch {
      /* 忽略单个清理失败 */
    }
  }
}

async function healthCheck() {
  try {
    const r = await fetch(HEALTH_URL);
    if (!r.ok) return { ok: false, phone: "http_" + r.status };
    const d = await r.json().catch(() => ({}));
    return { ok: d.phone === "connected", phone: d.phone || "unknown" };
  } catch (e) {
    return { ok: false, phone: "unreachable:" + e.message };
  }
}

// 读 project.json 取 name/main/ignore
async function readProjectMeta(projectDir) {
  try {
    const raw = await fs.readFile(path.join(projectDir, "project.json"), "utf8");
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

// 构建忽略判定：兼容 project.json 里 "/node_modules/" 这种写法（去首尾斜杠后按路径段匹配），
// 并跳过以 "." 开头的隐藏文件/目录（.git/.DS_Store 等）
function buildIgnoreMatcher(ignoreList) {
  const names = (Array.isArray(ignoreList) ? ignoreList : DEFAULT_IGNORE)
    .map((s) => String(s).replace(/^\/+/, "").replace(/\/+$/, "").replace(/\\/g, "/"))
    .filter(Boolean);
  return function isIgnored(relPosix) {
    const segs = relPosix.split("/");
    for (const n of names) {
      if (segs.includes(n)) return true;
    }
    for (const s of segs) {
      if (s.startsWith(".") && s !== "." && s !== "..") return true;
    }
    return false;
  };
}

// 计算某相对文件在手机工程目录下的落盘目录（根文件的 dir 为 "." 时退化为工程根，避免多出 "/."）
function phoneTargetDir(projectName, relPosix) {
  const relDir = path.posix.dirname(relPosix);
  const part = relDir && relDir !== "." ? "/" + relDir : "";
  return PROJECTS_ROOT + "/" + projectName + part;
}

// 递归收集文件，返回相对 PC 工程根的正斜杠路径数组
async function collectFiles(projectDir, isIgnored) {
  const out = [];
  async function walk(absDir, relPrefix) {
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const e of entries) {
      const rel = relPrefix ? relPrefix + "/" + e.name : e.name;
      if (isIgnored(rel)) continue;
      const abs = path.join(absDir, e.name);
      if (e.isDirectory()) {
        await walk(abs, rel);
      } else if (e.isFile()) {
        out.push(rel);
      }
    }
  }
  await walk(projectDir, "");
  return out;
}

// 下发单个文件到手机的指定相对位置（复用 /pcfile + send_file_to_phone）
async function deployOneFile(localFile, targetDir, targetName, keep) {
  const safeName = safePcName(localFile);
  await fs.mkdir(PC_FILE_DIR, { recursive: true });
  const tempPath = path.join(PC_FILE_DIR, safeName);
  await fs.copyFile(localFile, tempPath);

  const body = {
    action: "run",
    path: TEMPLATE_PATH,
    args: { fileName: safeName, targetDir, targetName },
  };

  try {
    const resp = await fetch(DEFAULT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error("HTTP " + resp.status + " " + text);
    }
    const outer = JSON.parse(text);
    const inner =
      typeof outer.result === "string" ? JSON.parse(outer.result) : outer.result;
    if (!inner || inner.ok !== 1) {
      throw new Error(JSON.stringify(inner || outer));
    }
    return inner.path;
  } finally {
    if (!keep) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}

// 经 /run 下发一个手机端模板并等待结果（用于 zip 解压等辅助步骤）。
// 与 deployOneFile 共用同一把 429 单在途锁，天然串行、不会串包。
async function runTemplate(templatePath, args) {
  const body = { action: "run", path: templatePath, args };
  const resp = await fetch(DEFAULT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error("HTTP " + resp.status + " " + text);
  }
  const outer = JSON.parse(text);
  const inner =
    typeof outer.result === "string" ? JSON.parse(outer.result) : outer.result;
  if (!inner || inner.ok !== 1) {
    throw new Error(JSON.stringify(inner || outer));
  }
  return inner;
}

// ============ 主流程 ============

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { name, main, run, argsRaw, keep, dryRun, help, zip, keepZip } = parsed;
  const projectDir = normalizeLocalPath(parsed.projectDir);

  if (help || !projectDir) {
    process.stderr.write(
      "用法:\n" +
        "  node scripts/deploy_project.js <工程目录> [--name <工程名>] [--main <入口.js>]\n" +
        "                                    [--run] [--no-run] [--args '<json>'] [--keep]\n" +
        "                                    [--zip] [--keep-zip] [--dry-run]\n\n" +
        "示例:\n" +
        "  node scripts/deploy_project.js ./my-project\n" +
        "  node scripts/deploy_project.js ./my-project --name demo --args '{\"count\":3}'\n" +
        "  node scripts/deploy_project.js ./my-project --zip        # 打包成单个 zip 再传（多文件工程更快）\n" +
        "  node scripts/deploy_project.js ./my-project --zip --keep-zip  # 解压后保留手机上的 zip\n"
    );
    process.exit(help ? 0 : 1);
  }

  let stat;
  try {
    stat = await fs.stat(projectDir);
  } catch {
    process.stderr.write(`工程目录不存在: ${projectDir}\n`);
    process.exit(3);
  }
  if (!stat.isDirectory()) {
    process.stderr.write(`不是目录: ${projectDir}\n`);
    process.exit(3);
  }

  const meta = await readProjectMeta(projectDir);
  const projectName = name || meta.name || path.basename(projectDir);
  const mainEntry = main || meta.main || "main.js";
  const isIgnored = buildIgnoreMatcher(meta.ignore);

  const files = await collectFiles(projectDir, isIgnored);
  if (files.length === 0) {
    process.stderr.write("工程目录里没有任何可部署的文件（全被 ignore 了？）\n");
    process.exit(3);
  }

  // --dry-run：只打印部署计划，不连手机、不上传（便于预览 / 验证相对结构）
  if (dryRun) {
    process.stdout.write(
      `部署计划（工程 "${projectName}"，入口 ${mainEntry}，${files.length} 个文件` +
        (zip ? "，--zip 模式将打包为 1 个 zip 传输" : "") +
        `）:\n`
    );
    for (const rel of files) {
      const relPosix = rel.split(path.sep).join("/");
      const targetDir = phoneTargetDir(projectName, relPosix);
      const targetName = path.posix.basename(relPosix);
      process.stdout.write(`  ${rel}  ->  ${targetDir}/${targetName}\n`);
    }
    process.exit(0);
  }

  const hc = await healthCheck();
  if (!hc.ok) {
    process.stderr.write(
      `手机未连接（状态: ${hc.phone}），请先在手机运行常驻客户端 autojs-task-phone-client.js。\n`
    );
    process.exit(2);
  }

  process.stdout.write(
    zip
      ? `打包并部署工程 "${projectName}"（${files.length} 个文件 -> 1 个 zip，入口 ${mainEntry}）...\n`
      : `部署工程 "${projectName}"（${files.length} 个文件，入口 ${mainEntry}）...\n`
  );

  let okCount = 0;

  if (zip) {
    // zip 模式：整个工程打成一个 zip，只走「一次 PC→手机 传输」，手机端再解压。
    // 把 N 次逐文件往返合并为 1 次，多文件 / 小文件工程提速最明显。
    const zipSafe = safePcName(projectDir) + ".zip";
    const zipPath = path.join(PC_FILE_DIR, zipSafe);
    await fs.mkdir(PC_FILE_DIR, { recursive: true });

    const entries = files.map((rel) => ({
      relPath: rel.split(path.sep).join("/"),
      absPath: path.join(projectDir, rel),
    }));
    await zipStored(entries, zipPath);

    const zipPhoneName = projectName + ".zip";
    let zipPhonePath;
    try {
      zipPhonePath = await deployOneFile(zipPath, PROJECTS_ROOT, zipPhoneName, keep);
      process.stdout.write(`  ✓ 打包为 zip -> ${zipPhonePath}\n`);
    } catch (e) {
      process.stderr.write(`  ✗ zip 下发失败: ${e.message}\n`);
      await fs.unlink(zipPath).catch(() => {});
      process.exit(1);
    }

    // 手机端解压到 /sdcard/脚本/<name>/
    const unzipArgs = {
      zipPath: zipPhonePath,
      targetDir: PROJECTS_ROOT + "/" + projectName,
      keepZip: !!keepZip,
    };
    try {
      const r = await runTemplate(TEMPLATE_UNZIP, unzipArgs);
      process.stdout.write(
        `  ✓ 已解压到 ${unzipArgs.targetDir}` +
          (r && r.extracted != null ? `（${r.extracted} 个文件）` : "") +
          (keepZip ? "（保留 zip）" : "") +
          `\n`
      );
    } catch (e) {
      process.stderr.write(`  ✗ 解压失败: ${e.message}\n`);
      if (!keep) await fs.unlink(zipPath).catch(() => {});
      process.exit(1);
    }

    await pruneTemp(null);
    if (!keep) await fs.unlink(zipPath).catch(() => {});
    process.stdout.write(
      `部署完成：工程已解压到手机 ${PROJECTS_ROOT}/${projectName}。\n`
    );
    okCount = files.length;
  } else {
    for (const rel of files) {
      const relPosix = rel.split(path.sep).join("/");
      const targetDir = phoneTargetDir(projectName, relPosix);
      const targetName = path.posix.basename(relPosix);
      try {
        const phonePath = await deployOneFile(
          path.join(projectDir, rel),
          targetDir,
          targetName,
          keep
        );
        okCount++;
        process.stdout.write(`  ✓ ${rel} -> ${phonePath}\n`);
      } catch (e) {
        process.stderr.write(`  ✗ ${rel} 下发失败: ${e.message}\n`);
        process.exit(1);
      }
    }

    await pruneTemp(null);
    process.stdout.write(`部署完成：${okCount}/${files.length} 个文件已落盘到手机。\n`);
  }

  // 部署后默认触发运行
  if (!run) {
    process.stdout.write(
      `（--no-run 已指定，跳过运行。需要运行时执行: node scripts/run_project.js ${projectName} [--args '...']）\n`
    );
    process.exit(0);
  }

  let runArgs = undefined;
  if (argsRaw) {
    try {
      runArgs = JSON.parse(argsRaw);
    } catch (e) {
      process.stderr.write(`--args 不是合法 JSON: ${e.message}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`运行工程入口 ${mainEntry}...\n`);
  try {
    const resp = await fetch(RUN_PROJECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, main: mainEntry, args: runArgs }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      process.stderr.write(`运行失败 (HTTP ${resp.status}): ${text}\n`);
      process.exit(1);
    }
    const outer = JSON.parse(text);
    const inner =
      typeof outer.result === "string" ? JSON.parse(outer.result) : outer.result;
    process.stdout.write(JSON.stringify({ ok: 1, result: inner }, null, 2) + "\n");
    process.exit(0);
  } catch (e) {
    process.stderr.write(`运行请求失败: ${e.message}\n`);
    process.exit(2);
  }
}

main();
