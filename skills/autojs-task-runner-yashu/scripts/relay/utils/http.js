/**
 * utils/http.js - HTTP 响应与请求体读取的通用工具
 *
 * 拆分前有十几处手写 res.writeHead(...) + res.end(JSON.stringify(...))，
 * 格式极易写歪。统一收敛到 sendJson / sendError。
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

/** 发送 JSON 响应 */
export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

/** 发送 { error: message } 形式的错误响应 */
export function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

/** 发送纯文本响应 */
export function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(text);
}

/** 发送 JavaScript 源码（供手机端拉取探针脚本） */
export function sendScript(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
  });
  res.end(data);
}

/**
 * 读取请求体，返回 Buffer。
 * 用于二进制上传场景（图片直传，不转 base64）。
 */
export function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** 读取请求体，返回字符串 */
export async function readBodyText(req) {
  const buf = await readBodyBuffer(req);
  return buf.toString("utf8");
}

/**
 * 读取并解析 JSON 请求体。
 * 解析失败返回 null（而不是抛错），调用方按"字段缺失"统一处理。
 */
export async function readBodyJson(req) {
  const text = await readBodyText(req);
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
