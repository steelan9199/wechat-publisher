/**
 * utils/port.js - 端口占用查找与释放（跨平台）
 *
 * 与操作系统打交道的底层能力，不含任何业务语义。
 */

import { execSync } from "node:child_process";

/** 同步等待，避免 kill 后端口尚未释放就立刻 listen */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * 查找占用指定端口（LISTENING）的进程 PID 列表。
 * Windows 走 netstat，其余平台走 lsof。
 */
export function findPidsByPort(port) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano -p TCP", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of out.split(/\r?\n/)) {
        const p = line.trim().split(/\s+/);
        // 协议 本地地址 外部地址 状态 PID
        if (p.length >= 5 && p[3] === "LISTENING") {
          const local = p[1];
          const localPort = local.slice(local.lastIndexOf(":") + 1);
          if (localPort === String(port) && p[4] !== "0") pids.add(p[4]);
        }
      }
    } else {
      const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      out
        .split(/\s+/)
        .filter(Boolean)
        .forEach((pid) => pids.add(pid));
    }
  } catch (e) {
    // 无占用时命令返回非 0，属正常情况
  }
  return [...pids];
}

/** 强杀指定 PID */
function killPid(pid) {
  if (process.platform === "win32") {
    execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
  } else {
    execSync(`kill -9 ${pid}`, { stdio: "ignore" });
  }
}

/**
 * 释放端口：若被占用则强杀占用进程（自身进程除外）。
 *
 * 注意：调用方必须先确认"本服务没在跑"，否则会误杀正在服务手机端的实例。
 * 该前置判断由 pc-bootstrap.checkAlreadyRunning 负责。
 */
export function freePort(port) {
  const pids = findPidsByPort(port).filter((pid) => pid !== String(process.pid));
  if (pids.length === 0) {
    console.log(`[端口] ${port} 空闲，直接启动`);
    return;
  }
  console.log(`[端口] ${port} 已被占用，占用进程 PID: ${pids.join(", ")}`);
  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`[端口] 已结束进程 PID ${pid}`);
    } catch (e) {
      console.error(`[端口] 结束进程 PID ${pid} 失败: ${e.message}`);
    }
  }
  sleepSync(800); // 等待系统回收端口
  const left = findPidsByPort(port);
  if (left.length) {
    console.error(`[端口] 警告: ${port} 仍被 PID ${left.join(", ")} 占用`);
  } else {
    console.log(`[端口] ${port} 已释放`);
  }
}
