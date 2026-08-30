/**
 * task-registry.js - 任务登记表（任务单模型的核心，长短任务混合架构的地基）
 *
 * 职责：为每一次 /run、/run-project 生成全局唯一 taskId，登记其完整生命周期，
 * 并把每条记录落盘 JSONL——中继重启后重载，保证「会话挂了也能事后取回结果」。
 *
 * 任务单状态机：
 *   submitted（已提交手机） → running（客户端已接单执行）
 *     → success / failed（收到回执，payload.ok===0 视为 failed）
 *     → stopped（AI 经 /task-stop 强杀）
 *   unknown（回执无 taskId 且无法归因时的兜底，见 phone-ws.js）
 *
 * 记录字段：
 *   taskId / kind("run"|"project") / name(模板名或工程名) / argsSummary(截断的参数 JSON)
 *   status / submittedAt / startedAt / finishedAt / lastAliveAt / progress / result
 *
 * 持久化：scripts/task_records.jsonl，每条状态变更 append 一行（同一 taskId 以最后
 * 一行为准）；启动时重放最近 MAX_RECORDS 条。Node 单线程，append 原子性足够。
 */

import fs from "node:fs";
import path from "node:path";
import { SCRIPTS_DIR, SUBMIT_TIMEOUT_MS, SUBMIT_SWEEP_INTERVAL_MS } from "./config.js";

const TASKS_LOG_PATH = path.join(SCRIPTS_DIR, "task_records.jsonl");
const MAX_RECORDS = 30; // 只保留最近 30 条：内存与磁盘同上限，启动时压缩回写

const TEMPLATES_DIR = path.join(SCRIPTS_DIR, "tasks");
const MAX_DURATION_RECORDS = 10; // 每模板耗时历史滚动上限

/**
 * 成功任务落模板耗时历史：tasks/<模板名>/duration_history.json，滚动保留最新 10 条。
 * 仅 kind=run 且存在同名模板文件夹的任务记录（内联代码、工程任务不记）；
 * 耗时口径 = 客户端接单(startedAt) → 回执(finishedAt)，即手机端真实执行时长。
 */
function recordTemplateDuration(rec) {
  try {
    if (rec.kind !== "run" || typeof rec.name !== "string") return;
    if (!rec.name.endsWith(".js")) return; // inline_code 等非模板任务无历史
    const templateName = rec.name.slice(0, -3);
    const dir = path.join(TEMPLATES_DIR, templateName);
    if (!fs.existsSync(dir)) return;
    const startedAt = rec.startedAt || rec.submittedAt;
    const ms = rec.finishedAt - startedAt;
    if (!(ms > 0) || ms > 24 * 3600 * 1000) return; // 异常值不记
    const file = path.join(dir, "duration_history.json");
    let records = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (Array.isArray(parsed)) records = parsed;
    } catch {
      /* 首次写入或文件损坏则重开 */
    }
    records.push({ ms, finishedAt: rec.finishedAt });
    records = records.slice(-MAX_DURATION_RECORDS);
    fs.writeFileSync(file, JSON.stringify(records, null, 2));
  } catch (err) {
    console.error("[task-registry] 记录模板耗时失败:", err.message);
  }
}

/** taskId -> record，Map 保持插入序（即提交序） */
const records = new Map();

/** 生成 taskId：t<月日_时分秒>_<4位十六进制随机>，如 t0829_131500_a3f2 */
function genTaskId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `t${stamp}_${rand}`;
}

/** 启动时重放 JSONL：同一 taskId 最后一行为准，最多保留最近 MAX_RECORDS 条 */
function loadFromDisk() {
  try {
    if (!fs.existsSync(TASKS_LOG_PATH)) return;
    const lines = fs.readFileSync(TASKS_LOG_PATH, "utf-8").split("\n");
    const seen = new Map();
    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      try {
        const rec = JSON.parse(s);
        if (rec && rec.taskId) seen.set(rec.taskId, rec);
      } catch {
        /* 跳过损坏行 */
      }
    }
    const list = [...seen.values()].sort((a, b) => a.submittedAt - b.submittedAt);
    for (const rec of list.slice(-MAX_RECORDS)) records.set(rec.taskId, rec);
  } catch (err) {
    console.error("[task-registry] 重载任务记录失败:", err.message);
  }
}

/** 追加一条记录快照到 JSONL */
function appendToDisk(rec) {
  try {
    fs.appendFileSync(TASKS_LOG_PATH, JSON.stringify(rec) + "\n");
  } catch (err) {
    console.error("[task-registry] 落盘失败:", err.message);
  }
}

/** 把记录收进内存 Map 并落盘；超出上限时只裁内存（磁盘靠重放时裁剪） */
function put(rec) {
  records.set(rec.taskId, rec);
  if (records.size > MAX_RECORDS) {
    const oldest = records.keys().next().value;
    records.delete(oldest);
  }
  appendToDisk(rec);
}

/**
 * 创建任务单（status=submitted）。
 * @param {{kind: "run"|"project", name: string, args?: *}} param
 */
export function createTask({ kind, name, args }) {
  let argsSummary = "";
  try {
    argsSummary = JSON.stringify(args ?? null) ?? "";
  } catch {
    argsSummary = "(不可序列化参数)";
  }
  if (argsSummary.length > 120) argsSummary = argsSummary.slice(0, 117) + "...";
  const rec = {
    taskId: genTaskId(),
    kind,
    name: String(name || "unknown"),
    argsSummary,
    status: "submitted",
    submittedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    lastAliveAt: null,
    progress: null,
    result: null,
  };
  put(rec);
  return rec;
}

/** 取任务单（可能为 undefined） */
export function getTask(taskId) {
  return records.get(taskId);
}

/** 最近任务单，按提交时间倒序 */
export function listTasks(limit = 20) {
  return [...records.values()]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, Math.max(1, Math.min(limit, MAX_RECORDS)));
}

/**
 * 收尾一个任务单（success/failed/stopped/unknown 通用）。
 * 单号不存在时（如中继重启丢了记录）自动补录一条终态记录，结果不丢。
 */
export function finishTask(taskId, status, result) {
  const rec = records.get(taskId) || {
    taskId,
    kind: "run",
    name: "(补录)",
    argsSummary: "",
    submittedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    lastAliveAt: null,
    progress: null,
    result: null,
  };
  if (isTerminal(rec)) return rec; // 幂等：终态不覆盖（重复回执无害）
  rec.status = status;
  rec.finishedAt = Date.now();
  rec.result = result ?? null;
  put(rec);
  if (status === "success") recordTemplateDuration(rec);
  return rec;
}

/** 是否终态（终态记录不可再变更） */
export function isTerminal(rec) {
  return ["success", "failed", "stopped", "unknown"].includes(rec.status);
}

/** 手机端已接单开始执行 */
export function markRunning(taskId) {
  const rec = records.get(taskId);
  if (!rec || isTerminal(rec)) return;
  rec.status = "running";
  rec.startedAt = Date.now();
  rec.lastAliveAt = rec.startedAt;
  put(rec);
}

/** 更新进度消息（同时视作一次存活信号） */
export function markProgress(taskId, progress) {
  const rec = records.get(taskId);
  if (!rec || isTerminal(rec)) return;
  rec.progress = String(progress ?? "").slice(0, 200);
  rec.lastAliveAt = Date.now();
  put(rec);
}

/** 存活心跳 */
export function touchAlive(taskId) {
  const rec = records.get(taskId);
  if (!rec || isTerminal(rec)) return;
  rec.lastAliveAt = Date.now();
  put(rec);
}

/** 供状态查询的公开视图（附加计算字段） */
export function publicView(rec) {
  const now = Date.now();
  return {
    ...rec,
    elapsedMs: (rec.finishedAt ?? now) - rec.submittedAt,
    aliveLagMs: rec.lastAliveAt ? now - rec.lastAliveAt : null,
    finished: isTerminal(rec),
  };
}

// 模块加载即重放磁盘记录
loadFromDisk();

// 启动压缩：JSONL 按追加写会随使用无限膨胀，启动时只把内存里保留的
// 最新 MAX_RECORDS 条回写文件——磁盘与内存同上限，永不积攒
(function compactOnDisk() {
  try {
    const list = [...records.values()].sort((a, b) => a.submittedAt - b.submittedAt);
    const body = list.map((r) => JSON.stringify(r)).join("\n");
    fs.writeFileSync(TASKS_LOG_PATH, body ? body + "\n" : "");
  } catch (err) {
    console.error("[task-registry] 启动压缩任务记录失败:", err.message);
  }
})();

// 提交超时熔断：/run 提交后 status 长期停在 submitted（手机一直没接单，
// 场景：提交瞬间手机断线、客户端引擎假死不执行指令、中继重启后重载的历史悬挂单）
// → 熔断为 failed（phase:"relay"），任务单不永久悬挂，AI 侧 --status 能拿到确定终态。
const submitSweeper = setInterval(() => {
  const now = Date.now();
  for (const rec of records.values()) {
    if (rec.status === "submitted" && now - rec.submittedAt > SUBMIT_TIMEOUT_MS) {
      finishTask(rec.taskId, "failed", {
        ok: 0,
        err: `提交后 ${Math.round(SUBMIT_TIMEOUT_MS / 1000)} 秒未被手机领取（手机可能离线或客户端无响应），已熔断`,
        phase: "relay",
      });
      console.log("[task-registry] 提交超时熔断:", rec.taskId);
    }
  }
}, SUBMIT_SWEEP_INTERVAL_MS);
submitSweeper.unref();
