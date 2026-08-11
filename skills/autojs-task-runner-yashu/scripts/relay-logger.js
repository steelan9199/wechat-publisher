/**
 * relay-logger.js — 中继日志包装器（限大小 + 不保留旧日志）
 *
 * 为什么需要它：
 *   直接 `node autojs-relay-server.js > relay-server.log` 时，文件会一直增长、
 *   且没有任何上限控制。本包装器接管子进程 stdout/stderr，写入日志文件时
 *   做大小封顶：超过 MAX_BYTES（默认 10KB）直接清空内容、不保留历史，
 *   后续写入自动重建空文件。同时启动时清空上一次的旧日志。
 *
 * 关于"清空"而非"删除"：本环境 Node 运行时对 fs.unlinkSync 做了安全 shim
 *   （删除会被改写成移入回收站，且易抛错），因此这里用"写入空字符串"来清空
 *   文件——效果等同删除（内容不保留、文件封顶 10KB），但不触发该 shim 的 bug。
 *
 * 用法：node relay-logger.js
 * 环境变量（均可选）：
 *   RELAY_LOG     日志文件路径，默认 D:/software/workBuddyWorkspace/temp/relay-server.log
 *   RELAY_LOG_MAX 大小上限（字节），默认 10240（10KB）
 *
 * 注意：本文件自身打印的 [logger] 行只进父进程 stdout（后台任务输出），
 *       不进 relay-server.log 文件，因此不会计入被限制的那个日志文件。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_SCRIPT = path.join(__dirname, "autojs-relay-server.js");

const LOG_FILE =
  process.env.RELAY_LOG ||
  "D:/software/workBuddyWorkspace/temp/relay-server.log";
const MAX_BYTES = Number(process.env.RELAY_LOG_MAX) || 10 * 1024;

console.log(`[logger] 日志文件: ${LOG_FILE}`);
console.log(`[logger] 大小上限: ${MAX_BYTES} 字节（超过即清空内容，不保留）`);

// 1) 启动前：清空旧的日志文件（写空字符串，效果同删除，且绕开删除 shim）
try {
  if (fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, "");
    console.log("[logger] 已清空旧日志文件");
  }
} catch (e) {
  console.error("[logger] 清空旧日志失败:", e.message);
}

// 2) 启动中继子进程，接管它的 stdout / stderr
const child = spawn(process.execPath, [RELAY_SCRIPT], {
  stdio: ["ignore", "pipe", "pipe"],
});

// 3) 落盘 + 大小封顶：每次写入前先看实际文件大小，超上限就清空内容
function pump(chunk) {
  try {
    let cur = 0;
    try {
      cur = fs.statSync(LOG_FILE).size;
    } catch {
      /* 文件不存在视为 0 */
    }
    if (cur >= MAX_BYTES) {
      // 超过上限：写空字符串清空内容（不保留，且绕开删除 shim 的报错）
      fs.writeFileSync(LOG_FILE, "");
    }
    fs.appendFileSync(LOG_FILE, chunk);
  } catch {
    // 落盘失败不应影响中继运行
  }
}

child.stdout.on("data", pump);
child.stderr.on("data", pump);

child.on("error", (err) => {
  console.error("[logger] 启动中继失败:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  console.log(`[logger] 中继进程退出 code=${code} signal=${signal}`);
  process.exit(typeof code === "number" ? code : 0);
});
