#!/usr/bin/env node
/**
 * bb-alive.js —— 「脚本现在还活着吗 / 停掉了吗」一键判读器（PC 侧，只读）
 *
 * 判读依据（权威）：中继任务单 + 手机端 10 秒一拍的心跳（task_alive）。
 *   - 手机端客户端在代打脚本运行期间，每 10 秒上报一次 task_alive ⇒ 中继刷新 lastAliveAt；
 *   - 脚本退出（判死自停 / 报错 / 被杀）时回传终态 ⇒ status 变 success/failed/stopped；
 *   - 连续 90 秒收不到任何心跳 ⇒ 中继熔断为 failed（僵尸单）。
 * 因此 **status=running 且心跳新鲜 ⟺ 脚本正在手机上跑**。
 *
 * 用法:
 *   node verify/pc/bb-alive.js                 # 查最近一局
 *   node verify/pc/bb-alive.js --list 5        # 最近 5 局
 *   node verify/pc/bb-alive.js --task t0925_013041_1356
 *   node verify/pc/bb-alive.js --watch 5       # 每 5 秒刷新，Ctrl+C 退出
 *   node verify/pc/bb-alive.js --json          # 机器可读（供自动化消费）
 *
 * 退出码: 0=活着/正常收尾  1=已停(判死自停属正常)、异常或查不到  2=中继不可达
 */

const RELAY = process.env.BB_RELAY || "http://localhost:9421";
const PROJECT_NAME = "ballbattle-aiplay";
const HEARTBEAT_MS = 10000;   // 手机端心跳节奏
const LAG_WARN_MS = 25000;    // 心跳迟滞告警线（>2 拍）
const LAG_DEAD_MS = 90000;    // 中继熔断线

// ---------- args ----------
const argv = process.argv.slice(2);
let wantList = 1, taskId = null, watchSec = 0, asJson = false, selftest = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--list") wantList = Number(argv[++i] || 1);
  else if (a === "--task") taskId = argv[++i];
  else if (a === "--watch") watchSec = Number(argv[++i] || 5);
  else if (a === "--json") asJson = true;
  else if (a === "--selftest") selftest = true;
  else if (a === "-h" || a === "--help") { console.log(require("node:fs").readFileSync(__filename, "utf-8").split("*/")[0]); process.exit(0); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, timeoutMs = 5000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    return await res.json();
  } finally { clearTimeout(t); }
}

const fmtDur = (ms) => {
  if (!(ms >= 0)) return "-";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}分${String(s % 60).padStart(2, "0")}秒` : `${s}秒`;
};

function parseResult(r) {
  if (r == null) return null;
  if (typeof r === "object") return r;
  try { return JSON.parse(r); } catch { return { _raw: String(r) }; }
}

/** 单次判读 → { verdict, alive, task, lines } */
function judge(health, tasks) {
  const list = (tasks || [])
    .filter((t) => t.kind === "project" && String(t.name || "").includes("ballbattle"))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  const picked = taskId ? list.filter((t) => t.taskId === taskId) : list.slice(0, wantList);

  if (!picked.length) {
    return { verdict: "无记录：这台 PC 的任务单里找不到 ballbattle-aiplay 的运行记录", alive: false, level: "empty", tasks: [], extra: [] };
  }
  const out = [];
  let newest = picked[0];
  let aliveOverall = false;

  for (const t of picked) {
    const now = Date.now();
    const startedAt = t.startedAt || t.submittedAt;
    const lag = t.lastAliveAt ? now - t.lastAliveAt : null;
    const dur = fmtDur(((t.finishedAt || now) - startedAt));
    const res = parseResult(t.result);
    let icon, text, hint = "";

    if (t.status === "submitted") {
      icon = "🟡"; text = `已提交但手机没接单（${fmtDur(now - t.submittedAt)}）`;
      hint = "手机可能离线 / 客户端引擎假死 → 查 health.phone，必要时手动重跑手机端客户端";
    } else if (t.status === "running") {
      if (lag == null || lag <= LAG_WARN_MS) {
        icon = "🟢"; text = `【活着】脚本正在手机上跑，已存活 ${dur}`;
        hint = `心跳 ${Math.round((lag || 0) / 1000)}s 前（正常 10s 一拍）`;
        if (t === newest) aliveOverall = true;
      } else if (lag <= LAG_DEAD_MS) {
        icon = "🟡"; text = `心跳迟滞 ${Math.round(lag / 1000)}s（已存活 ${dur}）`;
        hint = "可能在收尾/卡住 → 等 10s 再看；仍不刷新即为僵死";
      } else {
        icon = "⚪"; text = `心跳断了 ${Math.round(lag / 1000)}s（>90s）—— 应已被中继熔断`;
        hint = "确认 status 是否已变 failed";
      }
    } else if (t.status === "success") {
      const sr = res && res.stop_reason;
      if (sr && String(sr).startsWith("death")) {
        icon = "✅"; text = `【正常停·判死自停】stop_reason=${sr}，本局存活 ${dur}`;
        hint = "这是预期行为（球死了，脚本自己收尾）";
      } else if (sr === "max_episode_ms") {
        icon = "✅"; text = `【正常停·到时长上限】stop_reason=${sr}，本局存活 ${dur}`;
      } else {
        icon = "✅"; text = `【正常停】stop_reason=${sr || "?"}，本局存活 ${dur}`;
      }
    } else if (t.status === "stopped") {
      icon = "🔴"; text = `【被强杀】--stop 手动终止，已存活 ${dur}`;
      hint = (res && res.err) || "";
    } else if (t.status === "failed") {
      icon = "🔴"; text = `【异常退出】${(res && res.phase ? "phase=" + res.phase + " " : "")}${(res && res.err) || "无详情"}，已存活 ${dur}`;
      hint = res && res.phase === "relay" ? "中继侧熔断（心跳丢失），非脚本主动报错" : "看手机日志 tail 的 fatal 行";
    } else {
      icon = "❔"; text = `未知状态 ${t.status}`;
    }
    out.push(`${icon} ${t.taskId}  ${text}${hint ? "\n     ↳ " + hint : ""}`);
  }

  return {
    verdict: out.join("\n"),
    alive: aliveOverall,
    level: aliveOverall ? "running" : "not-running",
    newest,
    extra: [
      `中继 ${health && health.status === "ok" ? "ok" : "不可达"} ｜ 手机 ${health && health.phone === "connected" ? "connected" : "disconnected"}`,
    ],
    all: list,
  };
}

async function once(quiet) {
  let health, tasks;
  try {
    health = await getJson(`${RELAY}/health`);
    tasks = (await getJson(`${RELAY}/task-list`)).tasks || [];
  } catch (e) {
    if (asJson) console.log(JSON.stringify({ ok: 0, err: "中继不可达: " + e.message }));
    else console.error(`✖ 中继不可达（${RELAY}）: ${e.message}\n  → cd <autojs技能>/scripts && node autojs-relay-server.js（用后台任务方式启动）`);
    return 2;
  }
  const j = judge(health, tasks);
  if (asJson) {
    console.log(JSON.stringify({ ok: 1, alive: j.alive, level: j.level, health, verdict: j.verdict, newest: j.newest || null }, null, 2));
  } else if (!quiet || j.level === "running") {
    console.log(`— 判读 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })} —`);
    console.log(j.extra.join(" ｜ "));
    console.log(j.verdict);
  }
  return j.alive ? 0 : 1;
}

// ---------- 离线自检：把合成任务单灌进 judge，校验每个分支 ----------
function selftestRun() {
  const now = Date.now();
  const mk = (o) => Object.assign({
    taskId: "tTEST", kind: "project", name: PROJECT_NAME,
    submittedAt: now - 60000, startedAt: now - 60000,
    finishedAt: null, lastAliveAt: now - 3000, status: "running", result: null,
  }, o);
  const cases = [
    ["running 心跳新鲜 ⇒ 活着", mk({}), (r) => r.alive === true && /活着/.test(r.verdict)],
    ["running 心跳迟滞 40s ⇒ 告警不算活", mk({ lastAliveAt: now - 40000 }), (r) => r.alive === false && /迟滞/.test(r.verdict)],
    ["running 心跳断 120s ⇒ 熔断提示", mk({ lastAliveAt: now - 120000 }), (r) => /应已被中继熔断/.test(r.verdict)],
    ["submitted ⇒ 未接单", mk({ status: "submitted", startedAt: null, lastAliveAt: null }), (r) => /没接单/.test(r.verdict)],
    ["success death:* ⇒ 判死自停(算活着的正常终局)", mk({ status: "success", finishedAt: now, result: { ok: 1, stop_reason: "death:respawn_struct" } }), (r) => /判死自停/.test(r.verdict)],
    ["success max_episode_ms ⇒ 正常停", mk({ status: "success", finishedAt: now, result: { ok: 1, stop_reason: "max_episode_ms" } }), (r) => /时长上限/.test(r.verdict)],
    ["stopped ⇒ 被强杀", mk({ status: "stopped", finishedAt: now, result: { ok: 0, err: "已被手动终止" } }), (r) => /被强杀/.test(r.verdict)],
    ["failed(relay) ⇒ 中继熔断", mk({ status: "failed", finishedAt: now, result: { ok: 0, err: "心跳丢失", phase: "relay" } }), (r) => /中继侧熔断/.test(r.verdict)],
    ["无 ballbattle 记录 ⇒ 空", null, (r) => /无记录/.test(r.verdict)],
    ["更早的局不干扰最新局判定", "SPLIT", (r) => r.alive === true && r.newest && r.newest.taskId === "tNEW"],
  ];
  let pass = 0;
  const health = { status: "ok", phone: "connected" };
  for (const [name, task, check] of cases) {
    let r;
    if (task === null) r = judge(health, [{ taskId: "x", kind: "run", name: "other.js", status: "success" }]);
    else if (task === "SPLIT") r = judge(health, [
      mk({ taskId: "tOLD", submittedAt: now - 999999, startedAt: now - 999999, status: "success", finishedAt: now - 900000, result: { stop_reason: "death:respawn_struct" } }),
      mk({ taskId: "tNEW" }),
    ]);
    else r = judge(health, [task]);
    const ok = check(r);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) console.log("      verdict: " + r.verdict.replace(/\n/g, " / "));
    if (ok) pass++;
  }
  console.log(`\n${pass}/${cases.length} PASS`);
  return pass === cases.length ? 0 : 1;
}

(async () => {
  if (selftest) process.exit(selftestRun());
  if (!watchSec) process.exit(await once(false));
  for (;;) {
    await once(false);
    await sleep(watchSec * 1000);
  }
})();
