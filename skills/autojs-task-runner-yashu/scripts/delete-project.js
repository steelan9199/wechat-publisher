#!/usr/bin/env node
// delete-project.js - 删除手机上已部署的工程（或指定 sdcard 存储内路径）
//
// 用法:
//   node scripts/delete-project.js <工程名>
//   node scripts/delete-project.js --path "/sdcard/脚本/任意目录"
//
// 仅向中继 /delete-project 发指令，触发手机端删除目录。
// 默认删除 手机脚本根目录/scripts-from-computer/project/<工程名>（手机端动态定位）；
// 用 --path 可指定任意 sdcard 存储内路径。
// 手机端带安全护栏：传入路径先规范化（解析符号链接与 ..），只放行 sdcard 存储内路径。
//
// 配置: 默认连 http://localhost:9421；可用环境变量覆盖：
//   RELAY_DELETE_PROJECT_URL（默认 http://localhost:9421/delete-project）
//   RELAY_HEALTH_URL（默认 http://localhost:9421/health）

const DELETE_PROJECT_URL =
  process.env.RELAY_DELETE_PROJECT_URL || "http://localhost:9421/delete-project";
const HEALTH_URL =
  process.env.RELAY_HEALTH_URL || "http://localhost:9421/health";

function parseArgs(argv) {
  let projectName = null;
  let path = null;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--path") path = argv[++i];
    else if (a === "-h" || a === "--help") help = true;
    else if (!projectName && !a.startsWith("--")) projectName = a;
  }
  return { projectName, path, help };
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

async function main() {
  const { projectName, path, help } = parseArgs(process.argv.slice(2));

  if (help || (!projectName && !path)) {
    process.stderr.write(
      "用法:\n" +
        "  node scripts/delete-project.js <工程名>\n" +
        "  node scripts/delete-project.js --path \"/sdcard/脚本/任意目录\"\n\n" +
        "说明:\n" +
        "  默认删除 手机脚本根目录/scripts-from-computer/project/<工程名>；\n" +
        "  --path 可指定任意 sdcard 存储内路径（手机端会先规范化再校验）。\n"
    );
    process.exitCode = help ? 0 : 1;
    return;
  }

  const hc = await healthCheck();
  if (!hc.ok) {
    process.stderr.write(
      `手机未连接（状态: ${hc.phone}），请先在手机运行常驻客户端 autojs-task-phone-client.js。\n`
    );
    process.exitCode = 2;
    return;
  }

  try {
    const resp = await fetch(DELETE_PROJECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, path }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      process.stderr.write(`删除失败 (HTTP ${resp.status}): ${text}\n`);
      process.exitCode = 1;
      return;
    }
    const outer = JSON.parse(text);
    const inner =
      typeof outer.result === "string" ? JSON.parse(outer.result) : outer.result;
    process.stdout.write(JSON.stringify({ ok: 1, result: inner }, null, 2) + "\n");
    process.exitCode = 0;
  } catch (e) {
    process.stderr.write(`删除请求失败: ${e.message}\n`);
    process.exitCode = 2;
  }
}

// 不用 process.exit()：Windows 版 Node v24 在有未关闭句柄时强退会触发
// libuv 断言崩溃（exit 127，"!(handle->flags & UV_HANDLE_CLOSING)"）。
// 改为设 exitCode 后自然排空事件循环退出。
main();
