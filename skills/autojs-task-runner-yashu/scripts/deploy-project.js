#!/usr/bin/env node
// deploy-project.js - 把电脑上的 AutoJS 多文件工程（含代码与图片/音频等资源）部署到手机并运行
//
// 用法:
//   node scripts/deploy-project.js <工程目录> [--name <工程名>] [--main <入口.js>]
//                                    [--run] [--no-run] [--args '<json>'] [--keep] [--dry-run]
//
// 设计要点（与"单文件模板"通道并存，互不影响）:
//   - PC 开发态统一为多文件工程（main.js + modules/ + assets/...），AI 在电脑上组织好；
//   - 下发态 = 部署真实工程：逐个文件经 PC→手机 通道（复用 /pcfile + send_file_to_phone 模板）
//     落盘到手机 scripts-from-computer/project/<name>/ 下（PC 下发产物隔离区，与用户手写脚本隔离），严格保持 PC 上的相对目录结构；
//   - 图片/音频等二进制资源作为普通文件原样下发（二进制安全、按字节数校验），手机按相对路径
//     直接读取，无需 base64 内联——这是选"部署真实工程"而非"打包单文件"的关键原因；
//   - 部署完成后（默认）触发 /run-project 运行工程入口 main.js（原生 require + 资源读取直接可用）。
//
// 配置: 默认连 http://localhost:9421；可用环境变量覆盖（同 pc-to-phone.js）：
//   RELAY_URL / RELAY_HEALTH_URL / RELAY_PC_FILE_DIR，以及 RELAY_RUN_PROJECT_URL。

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import os from "node:os";
import { zipStored } from "./zip-lib.js";

const DEFAULT_URL = process.env.RELAY_URL || "http://localhost:9421/run";
const HEALTH_URL = process.env.RELAY_HEALTH_URL || "http://localhost:9421/health";
const RUN_PROJECT_URL =
  process.env.RELAY_RUN_PROJECT_URL || "http://localhost:9421/run-project";
const PC_FILE_DIR = process.env.RELAY_PC_FILE_DIR
  ? process.env.RELAY_PC_FILE_DIR
  : path.join(os.tmpdir(), "autojs_pc_to_phone");

const TEMPLATE_PATH = "tasks/send-file-to-phone/send-file-to-phone.js";
const TEMPLATE_UNZIP = "tasks/unzip-project/unzip-project.js";
// 手机端工程部署根：/sdcard 为安卓通用别名（符号链接到 getSdcardPath()）。
// 注意必须带「脚本/」前缀——scripts-from-computer 约定在 AutoJS 脚本根目录【里面】，
// 与手机端 runProject/deleteProject 的 getSdcardPath()/脚本/scripts-from-computer/project 同指一处。
let PROJECTS_ROOT = null; // main() 启动时经 /health 的 scriptBaseDir 动态解析（路径事实源在手机端）
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
    if (e && e.__quit__ !== undefined) throw e;
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

// 从中继 /health 读取手机端上报的脚本根目录（getSdcardPath()+"/脚本"），拼出工程部署根。
async function resolveProjectsRoot() {
  const base = DEFAULT_URL.replace(/\/run$/, "");
  const r = await fetch(base + "/health");
  const h = await r.json();
  if (!h.scriptBaseDir) {
    process.stderr.write(
      "无法获取手机端脚本根目录（/health 无 scriptBaseDir）。请先把手机端客户端热更新到支持路径上报的新版。\n"
    );
    quit(4);
  }
  return h.scriptBaseDir.replace(/\/+$/, "") + "/scripts-from-computer/project";
}

// 任务单模型：POST /run 拿 taskId → 轮询 /task-status 直到终态 → 返回回执内层 JSON。
// 新版中继 /run 立即返回 {"taskId","status":"submitted"}，最终回执必须按单查询；
// 兼容旧同步中继（响应即最终结果时直接透传）。
async function postRunAndWait(body, timeoutMs) {
  const resp = await fetch(DEFAULT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error("HTTP " + resp.status + " " + text);
  const ack = JSON.parse(text);
  if (!ack.taskId) {
    const legacy =
      typeof ack.result === "string" ? JSON.parse(ack.result) : ack.result;
    if (!legacy || legacy.ok !== 1) throw new Error(JSON.stringify(legacy || ack));
    return legacy;
  }
  const base = DEFAULT_URL.replace(/\/run$/, "");
  const deadline = Date.now() + (timeoutMs || 30000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const r2 = await fetch(
        base + "/task-status/" + encodeURIComponent(ack.taskId)
      );
      if (!r2.ok) continue;
      const st = JSON.parse(await r2.text());
      const task = st.task || st;
      if (
        task.status === "success" ||
        task.status === "failed" ||
        task.status === "stopped"
      ) {
        const inner =
          typeof task.result === "string"
            ? JSON.parse(task.result)
            : task.result;
        if (task.status !== "success" || !inner || inner.ok !== 1) {
          throw new Error(
            "任务 " +
              ack.taskId +
              " " +
              task.status +
              ": " +
              JSON.stringify(inner || task.result)
          );
        }
        return inner;
      }
    } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
      if (/任务 \S+ (failed|stopped)/.test(e.message)) throw e; // 终态失败直接上抛
      // 轮询本身的网络抖动：继续等
    }
  }
  throw new Error(
    "任务 " + ack.taskId + " 等待回执超时(" + (timeoutMs || 30000) + "ms)"
  );
}

// 下发单个文件到手机的指定相对位置（复用 /pcfile + send-file-to-phone）
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
    // 关键：必须等手机端任务真正终态（回执 ok）后才能删暂存文件，
    // 否则手机来 /pcfile 取文件时会 404（旧版同步中继假设的坑，实测踩过）
    const inner = await postRunAndWait(body, 30000);
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
  return await postRunAndWait(
    { action: "run", path: templatePath, args },
    60000
  );
}

// ============ 主流程 ============

// Windows 版 Node 在有未关闭句柄（如 fetch 的 keep-alive 连接）时 process.exit()
// 强退会触发 libuv 断言崩溃（exit 127）。统一改为设 exitCode + 抛 Quit 哨兵，
// 由 main() 入口吞掉后自然排空事件循环退出。
function quit(code) {
  process.exitCode = code;
  throw { __quit__: code };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { name, main, run, argsRaw, keep, dryRun, help, zip, keepZip } = parsed;
  const projectDir = normalizeLocalPath(parsed.projectDir);

  if (help || !projectDir) {
    process.stderr.write(
      "用法:\n" +
        "  node scripts/deploy-project.js <工程目录> [--name <工程名>] [--main <入口.js>]\n" +
        "                                    [--run] [--no-run] [--args '<json>'] [--keep]\n" +
        "                                    [--zip] [--keep-zip] [--dry-run]\n\n" +
        "示例:\n" +
        "  node scripts/deploy-project.js ./my-project\n" +
        "  node scripts/deploy-project.js ./my-project --name demo --args '{\"count\":3}'\n" +
        "  node scripts/deploy-project.js ./my-project --zip        # 打包成单个 zip 再传（多文件工程更快）\n" +
        "  node scripts/deploy-project.js ./my-project --zip --keep-zip  # 解压后保留手机上的 zip\n"
    );
    quit(help ? 0 : 1);
  }

  let stat;
  try {
    stat = await fs.stat(projectDir);
  } catch {
    process.stderr.write(`工程目录不存在: ${projectDir}\n`);
    quit(3);
  }
  if (!stat.isDirectory()) {
    process.stderr.write(`不是目录: ${projectDir}\n`);
    quit(3);
  }

  // 路径事实源：从 /health 读手机端上报的脚本根目录，动态拼工程部署根（拿不到即报错，不回退硬编码）
  PROJECTS_ROOT = await resolveProjectsRoot();

  const meta = await readProjectMeta(projectDir);
  const projectName = name || meta.name || path.basename(projectDir);
  const mainEntry = main || meta.main || "main.js";
  const isIgnored = buildIgnoreMatcher(meta.ignore);

  const files = await collectFiles(projectDir, isIgnored);
  if (files.length === 0) {
    process.stderr.write("工程目录里没有任何可部署的文件（全被 ignore 了？）\n");
    quit(3);
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
    quit(0);
  }

  const hc = await healthCheck();
  if (!hc.ok) {
    process.stderr.write(
      `手机未连接（状态: ${hc.phone}），请先在手机运行常驻客户端 autojs-task-phone-client.js。\n`
    );
    quit(2);
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
    if (e && e.__quit__ !== undefined) throw e;
      process.stderr.write(`  ✗ zip 下发失败: ${e.message}\n`);
      await fs.unlink(zipPath).catch(() => {});
      quit(1);
    }

    // 手机端解压到 scripts-from-computer/project/<name>/
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
    if (e && e.__quit__ !== undefined) throw e;
      process.stderr.write(`  ✗ 解压失败: ${e.message}\n`);
      if (!keep) await fs.unlink(zipPath).catch(() => {});
      quit(1);
    }

    await pruneTemp(null);
    if (!keep) await fs.unlink(zipPath).catch(() => {});
    process.stdout.write(
      `部署完成：工程已解压到手机 ${PROJECTS_ROOT}/${projectName}。\n`
    );
    okCount = files.length;
  } else {
    // 成功行只展示前 3 个（fail-fast 语义下成功即全部成功，逐行清单纯确认信息）；
    // 省略行放循环结束后，避免后续文件失败时「已成功」表述失真。全清单用
    // get-file-tree 查手机端工程目录即可。
    let shown = 0;
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
        if (shown < 3) {
          process.stdout.write(`  ✓ ${rel} -> ${phonePath}\n`);
          shown++;
        }
      } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
        process.stderr.write(`  ✗ ${rel} 下发失败: ${e.message}\n`);
        quit(1);
      }
    }
    if (okCount > 3) {
      process.stdout.write(`  …（其余 ${okCount - 3} 个文件已成功落盘，略）\n`);
    }

    await pruneTemp(null);
    process.stdout.write(`部署完成：${okCount}/${files.length} 个文件已落盘到手机。\n`);
  }

  // 部署后默认触发运行
  if (!run) {
    process.stdout.write(
      `（--no-run 已指定，跳过运行。需要运行时执行: node scripts/run-project.js ${projectName} [--args '...']）\n`
    );
    quit(0);
  }

  let runArgs = undefined;
  if (argsRaw) {
    try {
      runArgs = JSON.parse(argsRaw);
    } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
      process.stderr.write(`--args 不是合法 JSON: ${e.message}\n`);
      quit(1);
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
      quit(1);
    }
    const ack = JSON.parse(text);
    if (!ack.taskId) {
      // 旧同步中继：响应即最终结果
      const inner =
        typeof ack.result === "string" ? JSON.parse(ack.result) : ack.result;
      process.stdout.write(JSON.stringify({ ok: 1, result: inner }, null, 2) + "\n");
      quit(0);
    }
    // 任务单模型：轮询终态；工程可能长跑，超时不算失败（给出 taskId 可续查）
    const base = RUN_PROJECT_URL.replace(/\/run-project$/, "");
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      const r2 = await fetch(
        base + "/task-status/" + encodeURIComponent(ack.taskId)
      );
      if (!r2.ok) continue;
      const st = JSON.parse(await r2.text());
      const task = st.task || st;
      if (
        task.status === "success" ||
        task.status === "failed" ||
        task.status === "stopped"
      ) {
        const inner =
          typeof task.result === "string" ? JSON.parse(task.result) : task.result;
        process.stdout.write(
          JSON.stringify(
            {
              ok: task.status === "success" ? 1 : 0,
              status: task.status,
              taskId: ack.taskId,
              result: inner,
            },
            null,
            2,
          ) + "\n",
        );
        quit(task.status === "success" ? 0 : 1);
      }
    }
    process.stdout.write(
      JSON.stringify(
        {
          ok: 1,
          status: "running",
          taskId: ack.taskId,
          msg:
            "工程仍在运行（长任务属正常），可用 node scripts/run-task.js --status " +
            ack.taskId +
            " 续查",
        },
        null,
        2,
      ) + "\n",
    );
    quit(0);
  } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
    process.stderr.write(`运行请求失败: ${e.message}\n`);
    quit(2);
  }
}

// 不用 process.exit()：见 quit() 注释
main().catch((e) => {
  if (!(e && e.__quit__ !== undefined)) {
    process.stderr.write(String((e && e.stack) || e) + "\n");
    if (!process.exitCode) process.exitCode = 1;
  }
});
