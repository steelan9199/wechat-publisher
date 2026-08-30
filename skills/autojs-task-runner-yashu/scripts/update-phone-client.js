#!/usr/bin/env node
// update-phone-client.js - PC 一键更新并重启手机端常驻客户端（免手动）
//
// 用法:
//   node scripts/update-phone-client.js [--path <PC 端客户端文件>]
//
// 默认: 使用与本脚本同目录的 autojs-task-phone-client.js（即 skill 自带的那份）
//
// 流程:
//   1) 把新版客户端直接下发到手机 scripts-from-computer/client/（覆盖，即最终位置）
//   2) POST /update-client 触发手机端「启动新实例」；新实例顶部的 preventDuplicate
//      会自动 forceStop 旧实例，实现一键重启，无需在手机上手动点运行
//
// 配置: 可用环境变量覆盖
//   RELAY_UPDATE_URL  更新接口（默认 http://localhost:9421/update-client）
//
// 注意: 首次仍需在手机上手动运行一次 autojs-task-phone-client.js 建立 WebSocket 连接；
//       之后只要 PC 侧改了手机端代码，跑本脚本即可一键更新，不再需要手动。

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CLIENT = path.join(__dirname, "autojs-task-phone-client.js");
const PC_TO_PHONE = path.join(__dirname, "pc-to-phone.js");
const UPDATE_URL =
  process.env.RELAY_UPDATE_URL || "http://localhost:9421/update-client";
// 用同一个 node 运行子进程，避免环境差异
const RELAY_BIN = process.execPath;

const PHONE_CLIENT_NAME = "autojs-task-phone-client.js";
let PHONE_TARGET_DIR = null; // main() 里经 /health 的 scriptBaseDir 动态解析（client/ 专属目录）

function parseArgs(argv) {
  let clientPath = DEFAULT_CLIENT;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--path") clientPath = argv[++i];
    else if (a === "-h" || a === "--help") help = true;
  }
  return { clientPath, help };
}

function usage() {
  process.stdout.write(
    "用法:\n" +
      "  node scripts/update-phone-client.js               # 更新为 skill 自带的最新客户端\n" +
      "  node scripts/update-phone-client.js --path D:/xxx/autojs-task-phone-client.js\n\n" +
      "说明: 把客户端下发到手机 scripts-from-computer/client/（覆盖），并触发手机端自重启。\n"
  );
}

async function main() {
  const { clientPath, help } = parseArgs(process.argv.slice(2));
  if (help) {
    usage();
    process.exitCode = 0;
    return;
  }

  // 1) 校验本地客户端文件
  const fssync = await import("node:fs");
  try {
    const st = fssync.statSync(clientPath);
    if (!st.isFile()) throw new Error("不是普通文件");
  } catch (e) {
    process.stderr.write(`本地客户端文件不存在或不可读: ${clientPath}\n`);
    process.exitCode = 3;
    return;
  }

  // 1.5) 路径事实源：从 /health 读手机端脚本根目录；新版客户端直接下发到 client/ 专属目录（最终位置）
  // 注意：本块必须先于步骤①执行，否则 --target-dir 拿到 null（历史踩坑：解析块曾错位到下发之后）
  const healthUrlBase = UPDATE_URL.replace(/\/update-client$/, "");
  try {
    const h = await (await fetch(healthUrlBase + "/health")).json();
    if (!h.scriptBaseDir) throw new Error("/health 无 scriptBaseDir（手机端客户端需升级）");
    PHONE_TARGET_DIR = h.scriptBaseDir.replace(/\/+$/, "") + "/scripts-from-computer/client";
  } catch (e) {
    process.stderr.write("无法获取手机端脚本根目录: " + e.message + "\n");
    process.exitCode = 4;
    return;
  }

  process.stdout.write(
    `① 下发新版客户端到手机 ${PHONE_TARGET_DIR}/${PHONE_CLIENT_NAME} ...\n`
  );
  try {
    const out = execFileSync(
      RELAY_BIN,
      [
        PC_TO_PHONE,
        clientPath,
        "--target-dir",
        PHONE_TARGET_DIR,
        "--target-name",
        PHONE_CLIENT_NAME,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    process.stdout.write(out);
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || "").trim();
    process.stderr.write(`下发失败: ${detail}\n`);
    process.stderr.write(
      `（请确认手机已连接并在运行旧版客户端；若客户端假死，需先在手机上手动重跑一次）\n`
    );
    process.exitCode = 1;
    return;
  }

  // 3) 触发手机端自更新：启动新实例，旧实例由 preventDuplicate 自动停掉
  process.stdout.write("② 触发手机端自更新（启动新实例）...\n");
  try {
    const resp = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 显式指定手机上新客户端的位置，避免旧版客户端用自身默认路径找不到文件
      body: JSON.stringify({
        path: PHONE_TARGET_DIR + "/" + PHONE_CLIENT_NAME,
      }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      process.stderr.write(
        `更新指令失败 (HTTP ${resp.status}): ${text}\n`
      );
      process.exitCode = 1;
      return;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      process.stderr.write(`更新回执解析失败: ${text}\n`);
      process.exitCode = 1;
      return;
    }
    if (data && data.success) {
      process.stdout.write(
        `✓ 客户端已更新并重启: ${JSON.stringify(data.result)}\n`
      );
      process.stdout.write(
        "（旧实例已被新实例接管；稍后可用 /health 确认手机在线）\n"
      );
      process.exitCode = 0;
    } else {
      process.stderr.write(`更新未成功: ${JSON.stringify(data)}\n`);
      process.exitCode = 1;
    }
  } catch (e) {
    process.stderr.write(`更新请求失败: ${e.message}\n`);
    process.exitCode = 2;
  }
}

// 不用 process.exit()：Windows 版 Node v24 在有未关闭句柄时强退会触发
// libuv 断言崩溃（exit 127，"!(handle->flags & UV_HANDLE_CLOSING)"）。
// 改为设 exitCode 后自然排空事件循环退出。
main();
