#!/usr/bin/env node
// delete_project.js - 删除手机上已部署的工程（或指定 /sdcard/ 下路径）
//
// 用法:
//   node scripts/delete_project.js <工程名>
//   node scripts/delete_project.js --path /sdcard/autojs/projects/demo
//
// 仅向中继 /delete-project 发指令，触发手机端删除目录。
// 默认删除 /sdcard/脚本/<工程名>；用 --path 可指定任意 /sdcard/ 下路径
// （清理旧路径部署，如早期版本落在 /sdcard/autojs/projects/<name> 的那份）。
// 手机端带安全护栏：只接受 /sdcard/ 下的路径。
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
        "  node scripts/delete_project.js <工程名>\n" +
        "  node scripts/delete_project.js --path /sdcard/autojs/projects/demo\n\n" +
        "说明:\n" +
        "  默认删除 /sdcard/脚本/<工程名>；--path 可指定任意 /sdcard/ 下路径（清理旧部署）。\n"
    );
    process.exit(help ? 0 : 1);
  }

  const hc = await healthCheck();
  if (!hc.ok) {
    process.stderr.write(
      `手机未连接（状态: ${hc.phone}），请先在手机运行常驻客户端 autojs-task-phone-client.js。\n`
    );
    process.exit(2);
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
      process.exit(1);
    }
    const outer = JSON.parse(text);
    const inner =
      typeof outer.result === "string" ? JSON.parse(outer.result) : outer.result;
    process.stdout.write(JSON.stringify({ ok: 1, result: inner }, null, 2) + "\n");
    process.exit(0);
  } catch (e) {
    process.stderr.write(`删除请求失败: ${e.message}\n`);
    process.exit(2);
  }
}

main();
