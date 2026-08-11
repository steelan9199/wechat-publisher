#!/usr/bin/env node
// run_project.js - 运行已部署到手机的工程（不重新下发文件）
//
// 用法:
//   node scripts/run_project.js <工程名> [--main <入口.js>] [--args '<json>']
//
// 仅向中继 /run-project 发指令，触发手机端已存在的工程入口 main.js。
// 适用于：工程已用 deploy_project.js 部署过，之后只想反复运行（或换参数运行）。
//
// 配置: 默认连 http://localhost:9421；可用环境变量覆盖：
//   RELAY_RUN_PROJECT_URL（默认 http://localhost:9421/run-project）
//   RELAY_HEALTH_URL（默认 http://localhost:9421/health）

const RUN_PROJECT_URL =
  process.env.RELAY_RUN_PROJECT_URL || "http://localhost:9421/run-project";
const HEALTH_URL =
  process.env.RELAY_HEALTH_URL || "http://localhost:9421/health";

function parseArgs(argv) {
  let projectName = null;
  let main = null;
  let argsRaw = null;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--main") main = argv[++i];
    else if (a === "--args") argsRaw = argv[++i];
    else if (a === "-h" || a === "--help") help = true;
    else if (!projectName && !a.startsWith("--")) projectName = a;
  }
  return { projectName, main, argsRaw, help };
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
  const { projectName, main, argsRaw, help } = parseArgs(process.argv.slice(2));

  if (help || !projectName) {
    process.stderr.write(
      "用法:\n" +
        "  node scripts/run_project.js <工程名> [--main <入口.js>] [--args '<json>']\n\n" +
        "示例:\n" +
        "  node scripts/run_project.js demo\n" +
        "  node scripts/run_project.js demo --args '{\"count\":3}'\n"
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

  let args = undefined;
  if (argsRaw) {
    try {
      args = JSON.parse(argsRaw);
    } catch (e) {
      process.stderr.write(`--args 不是合法 JSON: ${e.message}\n`);
      process.exit(1);
    }
  }

  try {
    const resp = await fetch(RUN_PROJECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, main, args }),
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
