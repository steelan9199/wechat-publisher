/**
 * ai-api.js - 【交互对象：AI】
 *
 * AI 聊天软件通过 HTTP 调用本模块下发指令：
 *   GET  /health      健康检查（同时被"启动自保护"用作身份识别）
 *   GET  /screenshot  触发手机截图并落盘（同步，短操作）
 *   POST /run         下发 AutoJS 脚本到手机执行（异步：立即返回 taskId，结果经任务单查询）
 *   POST /run-project  运行已部署到手机的真实工程（异步，同 /run）
 *   GET  /task-status/:taskId  查询任务单（状态/进度/心跳/结果）
 *   GET  /task-list    列出最近任务单
 *   POST /task-stop   按 taskId 强制终止手机端任务引擎
 *   POST /update-client  一键更新并重启手机端客户端（免手动，同步短操作）
 *   GET  /version     返回服务版本号
 *   GET  /pid         返回当前进程 PID（含可直接执行的结束命令）
 *   GET  /templates   纯本地扫描任务模板库，返回 {count, tasks}（不依赖手机在线）
 *   POST /shutdown    优雅退出本服务（关 server + 关手机 WS + 5s 兜底强退）
 *
 * 本模块不直接碰 WebSocket，所有对手机的动作都经 state.sendToPhone 出口。
 * 路由以 Hono 形式注册（registerAiRoutes），业务逻辑与旧版完全一致。
 */

import { sendJson, readBodyJson } from "./utils/http.js";
import { scanTasks } from "../scan-tasks.js";
import {
  APP_NAME,
  VERSION,
  BUILD_FINGERPRINT,
  PORT,
  CAPTURE_TIMEOUT,
  RUN_TIMEOUT,
} from "./config.js";
import {
  isPhoneOnline,
  sendToPhone,
  hasPending,
  setPending,
  clearPending,
  getServer,
  getScriptBaseDir,
  getPhoneWS,
  isShuttingDown,
  setShuttingDown,
} from "./state.js";
import {
  createTask,
  getTask,
  listTasks,
  finishTask,
  publicView,
} from "./task-registry.js";

/**
 * 登记一个在途请求并挂上超时。
 * @returns {Promise<*>} 手机回传的数据；超时或手机报错则 reject
 */
function waitForPhone(timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearPending();
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    setPending({
      resolve: (data) => {
        clearTimeout(timer);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

/** GET /health */
function handleHealth(c) {
  return c.json({
    status: "ok",
    app: APP_NAME,
    phone: isPhoneOnline() ? "connected" : "disconnected",
    port: PORT,
    scriptBaseDir: getScriptBaseDir(),
  });
}

/** GET /screenshot —— 触发截图；手机经 http 上传到 /upload 后，把落盘路径经 ws 回传 */
async function handleScreenshot(c) {
  if (!isPhoneOnline()) {
    return c.json({ error: "手机未连接，请在手机上运行 AutoJS 脚本" }, 503);
  }
  // 与 /run 对齐的并发保护：同一时刻只允许一个在途请求，否则会串包
  if (hasPending()) {
    return c.json({ error: "已有请求在处理中，请稍后再试" }, 429);
  }

  sendToPhone({ action: "capture" });
  console.log("[HTTP] 已发送截图指令给手机，等待回传...");

  try {
    // 手机收到 capture 后：截屏 -> http POST 到 /upload -> 把落盘路径经 ws 回传
    const payload = await waitForPhone(
      CAPTURE_TIMEOUT,
      "截图超时（15 秒内未收到图片回传）"
    );
    if (!payload || !payload.path) {
      throw new Error("手机回传数据缺少 path（上传可能失败）");
    }
    console.log(`[HTTP] 截图完成: ${payload.path} (${payload.size} bytes)`);
    return c.json({ success: true, path: payload.path, size: payload.size || null });
  } catch (err) {
    console.error("[HTTP] 截图失败:", err.message);
    return c.json({ error: err.message }, 500);
  }
}

/** POST /run —— AI 动态下发 AutoJS 脚本（异步任务单：立即返回 taskId，不挂起等结果） */
async function handleRun(c) {
  if (c.req.method !== "POST") {
    return c.json(
      {
        error:
          "请使用 POST 方法，body 传 { \"code\": '<autojs 脚本字符串>' } 或 { \"path\": '<相对路径>' }",
      },
      405
    );
  }
  if (!isPhoneOnline()) {
    return c.json(
      { error: "手机未连接，请在手机上运行 autojs-task-phone-client.js" },
      503
    );
  }

  const parsed = await c.req.json().catch(() => null);
  const code = parsed ? parsed.code : undefined;
  // 变量名不能叫 path：会遮蔽 node:path，这里显式用 scriptPath
  const scriptPath = parsed ? parsed.path : undefined;
  const args = parsed ? parsed.args : undefined;

  // 兼容旧调用：code 非空 / 新版：path 非空（手机端按名从 /probe/ 下载）
  if ((typeof code !== "string" || code.length === 0) && !scriptPath) {
    return c.json({ error: "缺少 code 或 path 字段" }, 400);
  }

  // 登记任务单并下发；短任务由调用方（run-task.js）轮询任务单等回执，
  // 长任务拿到 taskId 即可返回，期间截图/点按/传文件等操作照常并发。
  const name = scriptPath
    ? String(scriptPath).split(/[\\/]/).pop()
    : "inline_code";
  const task = createTask({ kind: "run", name, args });
  const sent = sendToPhone({
    action: "run",
    taskId: task.taskId,
    code,
    path: scriptPath,
    args,
  });
  if (!sent) {
    finishTask(task.taskId, "failed", { ok: 0, err: "手机离线，指令未送达" });
    return c.json({ error: "手机连接中断，指令未送达" }, 503);
  }
  console.log(
    `[HTTP] 已下发 run 任务 ${task.taskId}（${task.name}），结果经任务单查询`
  );
  return c.json({ success: true, taskId: task.taskId, status: "submitted" });
}

/**
 * POST /run-project —— AI 运行已部署到手机的真实工程（多文件 + 资源，非单文件模板）
 * body: { projectName, main?, args? }
 * 异步任务单：立即返回 taskId；手机端运行入口 main.js，结果经 broadcast 回传、
 * 按 taskId 归位到任务单（与 /run 同一套任务单机制）。
 */
async function handleRunProject(c) {
  if (c.req.method !== "POST") {
    return c.json({ error: "请使用 POST 方法调用 /run-project" }, 405);
  }
  if (!isPhoneOnline()) {
    return c.json(
      { error: "手机未连接，请在手机上运行 autojs-task-phone-client.js" },
      503
    );
  }

  const parsed = await c.req.json().catch(() => null);
  const projectName = parsed ? parsed.projectName : undefined;
  const main = parsed ? parsed.main : undefined;
  const args = parsed ? parsed.args : undefined;

  if (typeof projectName !== "string" || !projectName) {
    return c.json({ error: "缺少 projectName 字段" }, 400);
  }

  const task = createTask({ kind: "project", name: projectName, args });
  const sent = sendToPhone({
    action: "run_project",
    taskId: task.taskId,
    projectName,
    main,
    args,
  });
  if (!sent) {
    finishTask(task.taskId, "failed", { ok: 0, err: "手机离线，指令未送达" });
    return c.json({ error: "手机连接中断，指令未送达" }, 503);
  }
  console.log(`[HTTP] 已下发 run_project 任务 ${task.taskId}（${projectName}）`);
  return c.json({ success: true, taskId: task.taskId, status: "submitted" });
}

/** GET /task-status/:taskId —— 查询任务单（状态/进度/心跳/结果） */
function handleTaskStatus(c) {
  const rec = getTask(c.req.param("taskId"));
  if (!rec) {
    return c.json({ error: "任务单不存在（可能已被清理或单号有误）" }, 404);
  }
  return c.json({ success: true, task: publicView(rec) });
}

/** GET /task-list —— 列出最近任务单（?limit=N，默认 20，按提交时间倒序） */
function handleTaskList(c) {
  const limit = Number(c.req.query("limit")) || 20;
  return c.json({ success: true, tasks: listTasks(limit).map(publicView) });
}

/**
 * POST /task-stop —— 按 taskId 强制终止手机端任务引擎
 * body: { taskId }
 * 已终态的任务单直接返回 alreadyFinished；手机端找到引擎则 forceStop 并回报
 * task_stopped，状态机由此落终态。
 */
async function handleTaskStop(c) {
  if (c.req.method !== "POST") {
    return c.json({ error: "请使用 POST 方法调用 /task-stop" }, 405);
  }
  const parsed = await c.req.json().catch(() => null);
  const taskId = parsed ? parsed.taskId : undefined;
  if (typeof taskId !== "string" || !taskId) {
    return c.json({ error: "缺少 taskId 字段" }, 400);
  }
  const rec = getTask(taskId);
  if (!rec) {
    return c.json({ error: "任务单不存在（可能已被清理或单号有误）" }, 404);
  }
  if (rec.status === "success" || rec.status === "failed" || rec.status === "stopped") {
    return c.json({ success: true, alreadyFinished: true, task: publicView(rec) });
  }
  const sent = sendToPhone({ action: "stop_task", taskId });
  if (!sent) {
    return c.json({ error: "手机未连接，无法下发终止指令" }, 503);
  }
  console.log(`[HTTP] 已下发 stop_task 指令: ${taskId}`);
  return c.json({ success: true, taskId, msg: "终止指令已下发，状态以手机回报为准" });
}

/**
 * POST /update-client —— AI 触发手机端「自更新」：先把新版 autojs-task-phone-client.js
 * 下发到手机 /sdcard/脚本/（覆盖），再发本指令让手机端启动新实例；新实例顶部的
 * preventDuplicate 会 forceStop 旧实例，实现一键重启，无需手动。
 * body: { path? } 可选，指定手机上客户端路径，默认 /sdcard/脚本/autojs-task-phone-client.js
 */
async function handleUpdateClient(c) {
  if (c.req.method !== "POST") {
    return c.json({ error: "请使用 POST 方法调用 /update-client" }, 405);
  }
  if (!isPhoneOnline()) {
    return c.json(
      { error: "手机未连接，请在手机上运行 autojs-task-phone-client.js" },
      503
    );
  }
  if (hasPending()) {
    return c.json({ error: "已有请求在处理中，请稍后再试" }, 429);
  }
  const parsed = await c.req.json().catch(() => null);
  const clientPath = parsed ? parsed.path : undefined;
  sendToPhone({ action: "update_client", path: clientPath });
  console.log("[HTTP] 已发送 update_client 指令给手机，等待结果...");
  try {
    const result = await waitForPhone(
      RUN_TIMEOUT,
      "更新客户端超时（30 秒内未收到结果）"
    );
    return c.json({ success: true, result });
  } catch (err) {
    const isTimeout = err.message.includes("超时");
    return c.json({ error: err.message }, isTimeout ? 504 : 500);
  }
}

/**
 * POST /delete-project —— AI 删除手机上已部署的工程（或指定 /sdcard/ 下路径）
 * body: { projectName? , path? } 二选一：projectName 删 /sdcard/脚本/<name>；path 删该显式路径
 * 手机端收到 {action:"delete_project", ...} 后删除目录并回传结果（与本模块 /run 共用同一在途请求机制）。
 */
async function handleDeleteProject(c) {
  if (c.req.method !== "POST") {
    return c.json({ error: "请使用 POST 方法调用 /delete-project" }, 405);
  }
  if (!isPhoneOnline()) {
    return c.json(
      { error: "手机未连接，请在手机上运行 autojs-task-phone-client.js" },
      503
    );
  }
  if (hasPending()) {
    return c.json({ error: "已有请求在处理中，请稍后再试" }, 429);
  }
  const parsed = await c.req.json().catch(() => null);
  const projectName = parsed ? parsed.projectName : undefined;
  const path = parsed ? parsed.path : undefined;
  if (
    (typeof projectName !== "string" || !projectName) &&
    (typeof path !== "string" || !path)
  ) {
    return c.json({ error: "缺少 projectName 或 path 字段" }, 400);
  }
  sendToPhone({ action: "delete_project", projectName, path });
  console.log("[HTTP] 已发送 delete_project 指令给手机，等待结果...");
  try {
    const result = await waitForPhone(
      RUN_TIMEOUT,
      "删除工程超时（30 秒内未收到结果）"
    );
    return c.json({ success: true, result });
  } catch (err) {
    const isTimeout = err.message.includes("超时");
    return c.json({ error: err.message }, isTimeout ? 504 : 500);
  }
}

/** GET /version —— 返回服务版本号 */
function handleVersion(c) {
  return c.json({
    app: APP_NAME,
    version: VERSION,
    fingerprint: BUILD_FINGERPRINT,
    port: PORT,
  });
}

/** GET /pid —— 返回当前进程 PID（含可直接执行的结束命令） */
function handlePid(c) {
  const pid = process.pid;
  const killCommand =
    process.platform === "win32"
      ? `taskkill /PID ${pid} /F`
      : `kill -9 ${pid}`;
  return c.json({
    app: APP_NAME,
    pid,
    ppid: process.ppid,
    port: PORT,
    killCommand,
  });
}

/** GET /templates —— 返回全部手机任务模板的 name+description */
function handleTemplates(c) {
  try {
    const tasks = scanTasks();
    return c.json({ count: tasks.length, tasks });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
}

/** POST /shutdown —— 优雅退出本服务 */
async function handleShutdown(c) {
  if (c.req.method !== "POST") {
    return c.json({ error: "请使用 POST 方法调用 /shutdown" }, 405);
  }

  setShuttingDown(true);

  // 先关手机 WebSocket，避免残留长连接阻止 server.close 回调
  const ws = getPhoneWS();
  if (ws && typeof ws.close === "function") {
    try {
      ws.close();
    } catch (_) {
      /* 忽略关闭异常 */
    }
  }
  const server = getServer();
  if (server && typeof server.close === "function") {
    server.close(() => {
      console.log("[lifecycle] 所有连接已关闭，进程退出。");
      process.exit(0);
    });
  }
  // 兜底：5 秒内仍有连接未释放则强制退出
  setTimeout(() => {
    console.log("[lifecycle] 超时强制退出。");
    process.exit(0);
  }, 5000).unref();

  return c.json({
    success: true,
    message: "relay server is shutting down",
    pid: process.pid,
  });
}

/**
 * 把 AI 侧路由注册到 Hono app。
 * @param {import("hono").Hono} app
 */
export function registerAiRoutes(app) {
  // 关闭过程中：拒绝除 /shutdown 之外的新请求
  app.use("*", async (c, next) => {
    if (isShuttingDown() && c.req.path !== "/shutdown") {
      return c.json({ error: "服务正在关闭中" }, 503);
    }
    await next();
  });

  app.get("/health", handleHealth);
  app.get("/screenshot", handleScreenshot);
  // 用 all 而非 post：让 handleRun 内部的 method !== POST 校验能真实命中，
  // 还原旧版"错误方法返回 405"的契约。
  app.all("/run", handleRun);
  app.all("/run-project", handleRunProject);
  app.get("/task-status/:taskId", handleTaskStatus);
  app.get("/task-list", handleTaskList);
  app.all("/task-stop", handleTaskStop);
  app.all("/update-client", handleUpdateClient);
  app.all("/delete-project", handleDeleteProject);
  app.get("/version", handleVersion);
  app.get("/pid", handlePid);
  app.get("/templates", handleTemplates);
  app.all("/shutdown", handleShutdown);
}
