#!/usr/bin/env node
// run-project.js - 运行已部署到手机的工程（不重新下发文件）
//
// 用法:
//   node scripts/run-project.js <工程名> [--main <入口.js>] [--args '<json>'] [--wait 秒]
//
// 仅向中继 /run-project 发指令，触发手机端已存在的工程入口 main.js。
// 任务单模型：/run-project 立即返回 taskId；本工具默认轮询任务单最多 30 秒等回执
// （短工程体验与旧版一致，输出 {"ok":1,"result":{...}} 兼容旧形状）；长工程用
// --wait 0 立即返回 taskId，之后用 `run-task.js --status <taskId>` 查询/`--stop` 终止。
// 中继落盘了任务记录，跨会话也能按单号取回结果。
//
// 配置: 默认连 http://localhost:9421；可用环境变量覆盖：
//   RELAY_RUN_PROJECT_URL（默认 http://localhost:9421/run-project）
//   RELAY_HEALTH_URL（默认 http://localhost:9421/health）

const RUN_PROJECT_URL =
  process.env.RELAY_RUN_PROJECT_URL || "http://localhost:9421/run-project";
const HEALTH_URL =
  process.env.RELAY_HEALTH_URL || "http://localhost:9421/health";
const TASK_BASE = "http://localhost:9421";
const DEFAULT_WAIT_SEC = 30;
const POLL_INTERVAL_MS = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  let projectName = null;
  let main = null;
  let argsRaw = null;
  let help = false;
  let waitSec = DEFAULT_WAIT_SEC;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--main") main = argv[++i];
    else if (a === "--args") argsRaw = argv[++i];
    else if (a === "--wait") waitSec = Number(argv[++i]);
    else if (a === "-h" || a === "--help") help = true;
    else if (!projectName && !a.startsWith("--")) projectName = a;
  }
  return { projectName, main, argsRaw, help, waitSec };
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
  const { projectName, main, argsRaw, help, waitSec: waitSecArg } = parseArgs(process.argv.slice(2));

  if (help || !projectName) {
    process.stderr.write(
      "用法:\n" +
        "  node scripts/run-project.js <工程名> [--main <入口.js>] [--args '<json>']\n\n" +
        "示例:\n" +
        "  node scripts/run-project.js demo\n" +
        "  node scripts/run-project.js demo --args '{\"count\":3}'\n"
    );
    quit(help ? 0 : 1);
  }

  const hc = await healthCheck();
  if (!hc.ok) {
    process.stderr.write(
      `手机未连接（状态: ${hc.phone}），请先在手机运行常驻客户端 autojs-task-phone-client.js。\n`
    );
    quit(2);
  }

  let args = undefined;
  if (argsRaw) {
    try {
      args = JSON.parse(argsRaw);
    } catch (e) {
    if (e && e.__quit__ !== undefined) throw e;
      process.stderr.write(`--args 不是合法 JSON: ${e.message}\n`);
      quit(1);
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
      quit(1);
    }
    const outer = JSON.parse(text);
    const taskId = outer.taskId;

    // 旧版中继（无任务单）：响应里直接带 result，原样兼容输出
    if (!taskId) {
      const inner =
        typeof outer.result === "string"
          ? JSON.parse(outer.result)
          : outer.result;
      process.stdout.write(JSON.stringify({ ok: 1, result: inner }, null, 2) + "\n");
      quit(0);
    }

    // --wait 0：立即返回任务单（长工程）
    const waitSec = Number.isFinite(waitSecArg) && waitSecArg >= 0 ? waitSecArg : DEFAULT_WAIT_SEC;
    if (waitSec === 0) {
      process.stdout.write(JSON.stringify(outer, null, 2) + "\n");
      quit(0);
    }

    // 轮询任务单直到终态或超时（超时非失败：工程仍在手机上运行）
    const deadline = Date.now() + waitSec * 1000;
    let last = { status: "submitted" };
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const r = await fetch(TASK_BASE + "/task-status/" + encodeURIComponent(taskId));
        const d = await r.json().catch(() => null);
        if (r.ok && d && d.task) {
          last = d.task;
          if (["success", "failed", "stopped"].includes(last.status)) break;
        }
      } catch {
        /* 中继瞬时不可达，继续轮询 */
      }
    }

    if (["success", "failed"].includes(last.status)) {
      const inner =
        typeof last.result === "string" ? JSON.parse(last.result) : last.result;
      process.stdout.write(JSON.stringify({ ok: 1, taskId, result: inner }, null, 2) + "\n");
      quit(0);
    }
    if (last.status === "stopped") {
      process.stdout.write(JSON.stringify({ ok: 0, taskId, stopped: true }, null, 2) + "\n");
      quit(0);
    }
    process.stdout.write(
      JSON.stringify(
        {
          ok: 0,
          timeout: true,
          taskId,
          status: last.status,
          progress: last.progress || null,
          msg:
            waitSec + " 秒内未完成，工程仍在手机上运行。用 run-task.js --status " + taskId + " 继续查询。",
        },
        null,
        2
      ) + "\n"
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
