#!/usr/bin/env node
// pc-to-phone.js - 把电脑上的任意文件下发到已连接的手机（PC→手机 通道一键入口）
//
// 用法:
//   node scripts/pc-to-phone.js <本地文件路径> [--target-dir <手机目录>] [--target-name <手机文件名>] [--keep]
//
// 示例:
//   node scripts/pc-to-phone.js D:/照片/风景.jpg
//   node scripts/pc-to-phone.js report.pdf --target-dir /sdcard/Documents --target-name 月报.pdf
//
// 流程:
//   1) 复制本地文件到电脑中转目录 PC_FILE_DIR（安全文件名，自动加随机后缀防重名）
//   2) 健康检查（手机须 connected）
//   3) POST /run 下发手机端模板 send_file_to_phone（带 fileName/targetDir/targetName）
//   4) 手机拉取并落盘后回执；成功则删除中转文件（--keep 可保留）
//
// 配置: 默认连 http://localhost:9421；可用环境变量覆盖：
//   RELAY_URL      下发接口（默认 http://localhost:9421/run）
//   RELAY_HEALTH_URL 健康检查接口（默认 http://localhost:9421/health）
//   RELAY_PC_FILE_DIR 中转目录（默认 os.tmpdir()/autojs_pc_to_phone）

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const DEFAULT_URL = process.env.RELAY_URL || "http://localhost:9421/run";
const HEALTH_URL = process.env.RELAY_HEALTH_URL || "http://localhost:9421/health";
const PC_FILE_DIR = process.env.RELAY_PC_FILE_DIR
  ? process.env.RELAY_PC_FILE_DIR
  : path.join(os.tmpdir(), "autojs_pc_to_phone");

const TEMPLATE_PATH = "tasks/send-file-to-phone/send-file-to-phone.js";
// 中转文件保留上限：超过 1 小时的残留自动清理（避免累积）
const TEMP_MAX_AGE_MS = 3600 * 1000;

/**
 * 归一化本地路径：兼容 Git Bash / MSYS 风格的 "/d/foo/bar" 与 "/c/Users/..."。
 * Node 在 Windows 上不认这种路径，会报"文件不存在"。
 * 策略：原路径存在就用原路径；否则若形如 /<单字母>/... 则转成 "<字母>:/..." 再试。
 */
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
  let localFile = null;
  let targetDir = null; // 缺省时经 /health 动态推导（scripts-from-computer/files/）
  let targetName = null;
  let keep = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target-dir") targetDir = argv[++i];
    else if (a === "--target-name") targetName = argv[++i];
    else if (a === "--keep") keep = true;
    else if (a === "-h" || a === "--help") {
      return { help: true };
    } else if (!localFile && !a.startsWith("--")) {
      localFile = a;
    }
  }
  return { localFile, targetDir, targetName, keep };
}

// 生成电脑中转目录里的安全文件名：原文件名清洗为字母数字 _ -，加随机后缀防重名，保留扩展名
function safePcName(localPath) {
  const base = path.basename(localPath);
  const ext = path.extname(base).toLowerCase(); // 含点，如 .jpg
  const stem = ext ? base.slice(0, -ext.length) : base;
  let cleaned = stem.replace(/[^A-Za-z0-9_\-]/g, "_");
  if (!cleaned) cleaned = "file";
  const rand = crypto.randomBytes(3).toString("hex");
  return (cleaned + "_" + rand + ext).slice(0, 120);
}

// 清理中转目录里超过 1 小时的残留文件（保留当前这一次刚写入的）
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

// Windows 版 Node 在有未关闭句柄（如 fetch 的 keep-alive 连接）时 process.exit()
// 强退会触发 libuv 断言崩溃（exit 127）。统一改为设 exitCode + 抛 Quit 哨兵，
// 由 main() 入口吞掉后自然排空事件循环退出。
function quit(code) {
  process.exitCode = code;
  throw { __quit__: code };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const parsedTargetDir = parsed.targetDir;
  const { targetName, keep, help } = parsed;
  // 兼容 Git Bash 的 /d/xxx 路径写法
  const localFile = normalizeLocalPath(parsed.localFile);

  if (help || !localFile) {
    process.stderr.write(
      "用法:\n" +
        "  node scripts/pc-to-phone.js <本地文件路径> [--target-dir <手机目录>] [--target-name <手机文件名>] [--keep]\n\n" +
        "示例:\n" +
        "  node scripts/pc-to-phone.js D:/照片/风景.jpg\n" +
        "  node scripts/pc-to-phone.js report.pdf --target-dir /sdcard/Documents --target-name 月报.pdf\n"
    );
    quit(help ? 0 : 1);
  }

  // 1) 校验本地文件
  let stat;
  try {
    stat = await fs.stat(localFile);
  } catch {
    process.stderr.write(`本地文件不存在: ${localFile}\n`);
    quit(3);
  }
  if (!stat.isFile()) {
    process.stderr.write(`不是普通文件: ${localFile}\n`);
    quit(3);
  }

  const safeName = safePcName(localFile);
  const realTargetName = targetName || path.basename(localFile);

  // 2) 复制进电脑中转目录
  await fs.mkdir(PC_FILE_DIR, { recursive: true });
  const tempPath = path.join(PC_FILE_DIR, safeName);
  await fs.copyFile(localFile, tempPath);

  const cleanupThis = async () => {
    await fs.unlink(tempPath).catch(() => {});
  };

  // 3) 健康检查 + 路径事实源：默认目标目录由手机端上报的脚本根动态推导
  const hc = await healthCheck();
  if (!hc.ok) {
    process.stderr.write(
      `手机未连接（状态: ${hc.phone}），请先在手机运行常驻客户端 autojs-task-phone-client.js。\n`
    );
    await cleanupThis();
    quit(2);
  }
  let targetDir = parsedTargetDir;
  if (!targetDir) {
    try {
      const h = await (await fetch(HEALTH_URL)).json();
      if (!h.scriptBaseDir) throw new Error("/health 无 scriptBaseDir（手机端客户端需升级）");
      targetDir =
        h.scriptBaseDir.replace(/\/+$/, "") + "/scripts-from-computer/files";
    } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
      process.stderr.write("无法推导默认目标目录（可显式传 --target-dir）: " + e.message + "\n");
      await cleanupThis();
      quit(4);
    }
  }

  // 4) 下发到手机
  const body = {
    action: "run",
    path: TEMPLATE_PATH,
    args: {
      fileName: safeName,
      targetDir: targetDir || undefined,
      targetName: realTargetName,
    },
  };

  let outer;
  try {
    const resp = await fetch(DEFAULT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    if (!resp.ok) {
      process.stderr.write(`下发失败 (HTTP ${resp.status}): ${text}\n`);
      await cleanupThis();
      quit(1);
    }
    try {
      outer = JSON.parse(text);
    } catch {
      process.stderr.write(`回执解析失败: ${text}\n`);
      await cleanupThis();
      quit(1);
    }

    // 任务单模型：/run 立即返回 taskId → 轮询任务单直到终态再取回执。
    // 大文件传输可能超过旧版 30 秒，这里默认最多等 60 秒（RELAY_PC_TO_PHONE_WAIT_SEC 可覆盖）。
    if (outer.taskId && outer.result === undefined) {
      const waitSec = Number(process.env.RELAY_PC_TO_PHONE_WAIT_SEC) || 60;
      const statusBase = DEFAULT_URL.replace(/\/run$/, "");
      const deadline = Date.now() + waitSec * 1000;
      let last = null;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const st = await fetch(
            statusBase + "/task-status/" + encodeURIComponent(outer.taskId)
          );
          const d = await st.json().catch(() => null);
          if (st.ok && d && d.task) {
            last = d.task;
            if (
              last.status === "success" ||
              last.status === "failed" ||
              last.status === "stopped"
            ) {
              break;
            }
          }
        } catch {
          /* 中继瞬时不可达，继续轮询 */
        }
      }
      outer = {
        success: Boolean(last && last.status === "success"),
        result: last ? last.result : null,
      };
    }
  } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
    process.stderr.write(`请求失败: ${e.message}\n`);
    await cleanupThis();
    quit(2);
  }

  // 5) 解析手机回执并校验
  let inner = null;
  try {
    inner =
      typeof outer.result === "string" ? JSON.parse(outer.result) : outer.result;
  } catch {
    inner = null;
  }

  if (inner && inner.ok === 1) {
    process.stdout.write(
      JSON.stringify(
        { ok: 1, phonePath: inner.path, size: inner.size, name: inner.name },
        null,
        2
      ) + "\n"
    );
    if (!keep) {
      await cleanupThis();
      // 顺手清掉历史残留中转文件
      await pruneTemp(safeName);
    }
    quit(0);
  } else {
    const errMsg =
      (inner && (inner.err || JSON.stringify(inner))) ||
      JSON.stringify(outer);
    process.stderr.write(`手机下发未成功: ${errMsg}\n`);
    process.stderr.write(
      `⚠️ 中转文件已保留在: ${tempPath}（可重试，或用 --keep 调试）\n`
    );
    quit(1);
  }
}

// 不用 process.exit()：见 quit() 注释
main().catch((e) => {
  if (!(e && e.__quit__ !== undefined)) {
    process.stderr.write(String((e && e.stack) || e) + "\n");
    if (!process.exitCode) process.exitCode = 1;
  }
});
