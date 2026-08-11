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

/** 手机端 WebSocket 连接，未连接时为 null */
let phoneWS = null;

/** 等待手机回传的在途请求 { resolve, reject }，空闲时为 null */
let pendingRequest = null;

// ============ 手机连接 ============

/** 获取当前手机连接（可能为 null） */
export function getPhoneWS() {
  return phoneWS;
}

/** 记录手机连接 */
export function setPhoneWS(ws) {
  phoneWS = ws;
}

/** 手机是否在线（readyState 1 = WebSocket.OPEN，且协议层心跳判定存活） */
export function isPhoneOnline() {
  // ws.isAlive 由 phone-ws 心跳维护：undefined（非心跳 socket）视为存活，
  // 仅显式 false（连续一个心跳周期未收到 pong）判为假在线/僵尸连接
  return Boolean(phoneWS) && phoneWS.readyState === 1 && phoneWS.isAlive !== false;
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
