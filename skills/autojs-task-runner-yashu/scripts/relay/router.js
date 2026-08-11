/**
 * router.js - HTTP 请求分发（Hono 实现）
 *
 * 用 Hono 承载全部 HTTP 路由，WebSocket 长连接仍由 phone-ws.js 经现有 ws 库
 * 挂在同一 http.Server 上（见 autojs-relay-server.js 的装配）。
 *
 * 路由分组（按"谁在跟我说话"）：
 *   AI 侧     → registerAiRoutes (ai-api.js)：/health /screenshot /run /version /pid /templates /shutdown
 *   手机·短连接 → registerPhoneRoutes (phone-http.js)：/upload /probe/*
 *
 * 新增接口：去对应交互域模块加路由即可，不必动本文件（除引入新模块外）。
 */

import { createAdaptorServer } from "@hono/node-server";
import { Hono } from "hono";
import { PORT } from "./config.js";
import { registerAiRoutes } from "./ai-api.js";
import { registerPhoneRoutes } from "./phone-http.js";

/**
 * 创建并装配中继服务器。
 * 用 @hono/node-server 的 createAdaptorServer 把 Hono 挂到一个 http.Server 上
 * （它只创建 server、不自动 listen），WebSocket（ws 库）因此能共用同一端口，
 * 监听时机由入口统一掌控。
 * @returns {import("node:http").Server} 已挂载 Hono 的 http.Server（尚未 listen）
 */
export function createRelayServer() {
  const app = new Hono();

  // CORS：保持旧行为（全部允许），便于 AI 侧跨域调用
  app.use("*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    await next();
  });

  registerAiRoutes(app);
  registerPhoneRoutes(app);

  return createAdaptorServer({ fetch: app.fetch });
}
