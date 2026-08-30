/**
 * state.js - 跨模块共享的运行时状态（单点收口）
 *
 * 拆分前 phoneWS / pendingRequest 是两个裸的模块级变量，
 * HTTP 侧和 WS 侧都直接读写，很容易出现"一边置空、另一边还在用"。
 * 这里把它们收成函数接口，所有状态变更只有一条路径。
 *
 * 语义约定：
 *   - 同一时刻只允许一个在途请求（pendingRequest）
 *   - settle（resolve/reject）时先摘除引用再回调，避免回调里再次触发时读到脏值
 */

import { APP_PING_STALE_MS } from "./config.js";

/** 手机端 WebSocket 连接，未连接时为 null */
let phoneWS = null;

/** 等待手机回传的在途请求 { resolve, reject }，空闲时为 null */
let pendingRequest = null;

/** 手机端上报的 AutoJS 脚本根目录（getSdcardPath()+"/脚本" 动态拼接结果），路径事实源 */
let scriptBaseDir = null;

// ============ 手机连接 ============

/** 获取当前手机连接（可能为 null） */
export function getPhoneWS() {
  return phoneWS;
}

/** 记录手机连接 */
export function setPhoneWS(ws) {
  phoneWS = ws;
}

/** 获取手机端脚本根目录（未上报时为 null） */
export function getScriptBaseDir() {
  return scriptBaseDir;
}

/** 记录手机端脚本根目录（连接注册时上报，路径变了自动刷新） */
export function setScriptBaseDir(dir) {
  if (typeof dir === "string" && dir) scriptBaseDir = dir;
}

// ============ 应用层心跳（引擎存活事实源） ============
// 手机端脚本引擎每 10s 发一次 {"type":"ping"}（phone-ws.js 收到时调 noteAppPing()）。
// 协议层 pong 由 okhttp 自动回复——引擎死后 pong 仍在，探测不到引擎死亡；
// 应用层 ping 停发才是引擎假死的可靠信号（实测：手动停掉客户端引擎后，
// health 恒报 connected、任务单永久悬挂，即本机制缺失所致）。

/** 最近一次应用层 ping 到达时间；null = 未armed（本连接还没收到过 ping） */
let lastAppPingAt = null;

/** 手机端应用层 ping 到达时调用（刷新时间戳） */
export function noteAppPing() {
  lastAppPingAt = Date.now();
}

/** 连接重建时清零：新连接视为未armed，首次应用层 ping 到达后才启用判死，
 *  避免误杀不发应用层 ping 的旧版客户端 */
export function resetAppPing() {
  lastAppPingAt = null;
}

/** 应用层心跳是否新鲜（未armed 视为新鲜；超过 APP_PING_STALE_MS 视为引擎假死） */
export function isAppPingFresh() {
  return lastAppPingAt === null || Date.now() - lastAppPingAt < APP_PING_STALE_MS;
}

/** 手机是否在线：WS 处于 OPEN 且应用层心跳新鲜。
 *  注意：不再把协议层 isAlive===false 当离线——那只是"已发 ping 等 pong"的窗口
 *  （15s 一拍、持续几毫秒），按离线处理会把正常下发秒级误拒（实测踩过：
 *  并发回归中一次下发恰撞窗口被拒，health 却恒为 connected）。真正僵死的
 *  连接由 phone-ws 心跳在下一周期 terminate 强断，断开后本函数自然返回 false。 */
export function isPhoneOnline() {
  return Boolean(phoneWS) && phoneWS.readyState === 1 && isAppPingFresh();
}

/**
 * 向手机下发一条 JSON 指令。
 * @returns {boolean} 手机不在线时返回 false，调用方自行决定如何回应
 */
export function sendToPhone(payload) {
  if (!isPhoneOnline()) return false;
  phoneWS.send(JSON.stringify(payload));
  return true;
}

// ============ 在途请求 ============

/** 是否已有请求在处理中 */
export function hasPending() {
  return pendingRequest !== null;
}

/** 登记一个在途请求 */
export function setPending(handlers) {
  pendingRequest = handlers;
}

/** 直接丢弃在途请求（不回调），用于超时后自行接管响应的场景 */
export function clearPending() {
  pendingRequest = null;
}

/**
 * 完成在途请求。
 * @returns {boolean} 当前没有在途请求时返回 false（调用方可据此打印"数据被丢弃"告警）
 */
export function resolvePending(data) {
  if (!pendingRequest) return false;
  const handlers = pendingRequest;
  pendingRequest = null;
  handlers.resolve(data);
  return true;
}

/**
 * 以错误终止在途请求。
 * @returns {boolean} 当前没有在途请求时返回 false
 */
export function rejectPending(err) {
  if (!pendingRequest) return false;
  const handlers = pendingRequest;
  pendingRequest = null;
  handlers.reject(err);
  return true;
}

// ============ 服务实例 / 关闭状态 ============
// 供 /shutdown 优雅退出时拿到 server 实例调用 close()，
// 以及供路由层在关闭过程中拒绝新请求。

/** 当前 http.Server 实例，启动时由入口文件注入 */
let serverRef = null;

/** 记录 server 实例（入口文件 createRelayServer 后调用） */
export function setServer(s) {
  serverRef = s;
}

/** 取回 server 实例（无则为 null） */
export function getServer() {
  return serverRef;
}

/** 是否正在关闭中（/shutdown 触发后置 true） */
let shuttingDown = false;

export function isShuttingDown() {
  return shuttingDown;
}

export function setShuttingDown(v) {
  shuttingDown = v;
}
