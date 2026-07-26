/**
 * server.js - PC 端 WebSocket + HTTP 中继服务器
 *
 * 职责：
 *   1. WebSocket 服务端：手机 AutoJS 连接此端口，保持长连接
 *   2. HTTP 服务端：AI 聊天软件调用 /screenshot 触发截图
 *   3. 收到手机回传的二进制图片数据后，直接写入 PNG 文件（不转 base64）
 *
 * 运行：node server.js
 * 端口：9421（HTTP + WebSocket 共用）
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============ 配置 ============
const PORT = 9421;
const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const CAPTURE_TIMEOUT = 15000; // 截图超时 15 秒

// ============ 状态 ============
let phoneWS = null; // 手机 WebSocket 连接
let pendingRequest = null; // 等待截图的 Promise { resolve, reject }

// ============ HTTP 服务 ============
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ---- 健康检查 ----
  if (urlObj.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        phone: phoneWS ? "connected" : "disconnected",
        port: PORT,
      })
    );
    return;
  }

  // ---- 触发截图 ----
  if (urlObj.pathname === "/screenshot") {
    // 检查手机是否在线
    if (!phoneWS || phoneWS.readyState !== 1) {
      // 1 = WebSocket.OPEN
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "手机未连接，请在手机上运行 AutoJS 脚本",
        })
      );
      return;
    }

    // 发送截图指令给手机
    phoneWS.send(JSON.stringify({ action: "capture" }));
    console.log("[HTTP] 已发送截图指令给手机，等待回传...");

    // 等待手机回传二进制图片数据
    try {
      const imageBuffer = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRequest = null;
          reject(new Error("截图超时（15 秒内未收到图片）"));
        }, CAPTURE_TIMEOUT);

        pendingRequest = {
          resolve: (data) => {
            clearTimeout(timer);
            resolve(data);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        };
      });

      // 直接写入文件（二进制直传，不转 base64）
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const filename = `screenshot_${ts}.png`;
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const filepath = path.join(SCREENSHOT_DIR, filename);
      fs.writeFileSync(filepath, imageBuffer);

      console.log(
        `[HTTP] 截图完成: ${filepath} (${imageBuffer.length} bytes)`
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          path: filepath,
          size: imageBuffer.length,
        })
      );
    } catch (err) {
      console.error("[HTTP] 截图失败:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ---- 404 ----
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// ============ WebSocket 服务（与 HTTP 共用端口） ============
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[WS] 手机已连接");
  phoneWS = ws;

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      // ---- 二进制消息 = 截图图片数据 ----
      console.log(`[WS] 收到图片数据: ${data.length} bytes`);
      if (pendingRequest) {
        pendingRequest.resolve(data);
        pendingRequest = null;
      } else {
        console.log("[WS] 警告: 收到图片数据但没有等待中的请求，已丢弃");
      }
    } else {
      // ---- 文本消息 = 状态或错误信息 ----
      const msg = data.toString();
      console.log("[WS] 收到文本消息:", msg);

      // 尝试解析 JSON 错误消息
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error && pendingRequest) {
          pendingRequest.reject(new Error(parsed.error));
          pendingRequest = null;
        }
      } catch (e) {
        // 非 JSON 文本，忽略
      }
    }
  });

  ws.on("close", () => {
    console.log("[WS] 手机已断开");
    phoneWS = null;
    if (pendingRequest) {
      pendingRequest.reject(new Error("手机断开连接"));
      pendingRequest = null;
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] 连接错误:", err.message);
  });
});

// ============ 启动 ============
server.listen(PORT, () => {
  console.log("========================================");
  console.log("  手机截图中继服务器已启动");
  console.log("========================================");
  console.log(`  HTTP 触发:  http://localhost:${PORT}/screenshot`);
  console.log(`  健康检查:  http://localhost:${PORT}/health`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  截图目录:  ${SCREENSHOT_DIR}`);
  console.log("========================================");
  console.log("");
  console.log("等待手机连接...");
});
