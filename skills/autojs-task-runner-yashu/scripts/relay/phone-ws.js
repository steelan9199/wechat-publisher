/**
 * phone-ws.js - 【交互对象：手机 AutoJS（WebSocket 长连接侧）】
 *
 * 手机连上来后保持长连接，本模块负责收侧：
 *   - 二进制消息 = （已废弃）旧版截图经 ws 回传图片字节；现改由手机经 http 上传到 /upload
 *   - 文本消息   = 状态 / 错误 / run 结果 / capture_done（截图已在电脑落盘的绝对路径）
 *   - 断开时     = 终止在途请求，避免 AI 那边一直挂着等超时
 *
 * 发送侧（下发 capture / run 指令）由 ai-api.js 经 state.sendToPhone 完成。
 */

import { WebSocketServer } from "ws";
import {
  setPhoneWS,
  getPhoneWS,
  resolvePending,
  rejectPending,
  hasPending,
} from "./state.js";
import { HEARTBEAT_INTERVAL } from "./config.js";

/** 处理二进制消息：手机回传的截图数据 */
function onBinary(data) {
  console.log(`[WS] 收到图片数据: ${data.length} bytes`);
  if (!resolvePending(data)) {
    console.log("[WS] 警告: 收到图片数据但没有等待中的请求，已丢弃");
  }
}

/** 处理文本消息：run 结果或错误上报 */
function onText(msg) {
  console.log("[WS] 收到文本消息:", msg);
  if (!hasPending()) return;

  let parsed;
  try {
    parsed = JSON.parse(msg);
  } catch (e) {
    return; // 非 JSON 文本，忽略
  }

  if (parsed.type === "run_result") {
    resolvePending(parsed.payload);
  } else if (parsed.type === "capture_done") {
    // 截图已改由手机经 http 上传到 /upload 落盘，ws 仅回传电脑侧绝对路径
    resolvePending(parsed);
  } else if (parsed.type === "update_client_ack") {
    // 手机端已收到 update_client 并已启动新实例接管；pending 立即 resolve，
    // 后续旧实例被 forceStop 导致的断开即变为 no-op，避免误判超时/断连。
    resolvePending({ ok: 1, updated: true, msg: parsed.msg || "客户端已更新" });
  } else if (parsed.error) {
    rejectPending(new Error(parsed.error));
  }
}

/**
 * 把 WebSocket 服务挂到已有的 HTTP server 上（共用同一个端口）。
 *
 * 心跳：周期性向手机发 ping 帧（协议层控制帧，不进业务消息通道、不占应用层额度），
 * 手机端 okhttp 自动回 pong。约定：每个心跳周期先把 isAlive 置 false、收到 pong
 * 再置 true；若连续一个周期未收到 pong，isAlive 保持 false，isPhoneOnline()
 * 据此判定为假在线（僵尸连接），使 /run 立即 503 而非干等 RUN_TIMEOUT。
 * 保守策略：超时仅标记离线，不主动 terminate 连接（避免误杀偶发慢回的手机）。
 */
export function attachPhoneWS(server) {
  const wss = new WebSocketServer({ server });

  // 协议层心跳：只标记离线、不杀连接
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        // 保守：不 terminate，留给 isPhoneOnline() 判为假在线即可
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (_) {
        /* 发送失败说明连接已坏，下一轮自然维持 isAlive=false */
      }
    });
  }, HEARTBEAT_INTERVAL);
  // 不阻止进程退出（server 关闭后随事件循环自然结束）
  heartbeat.unref();

  wss.on("connection", (ws) => {
    console.log("[WS] 手机已连接");
    ws.isAlive = true; // 连上即视为存活，首轮心跳前也按在线处理
    setPhoneWS(ws);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        onBinary(data);
      } else {
        onText(data.toString());
      }
    });

    ws.on("close", () => {
      console.log("[WS] 手机已断开");
      // 只清掉"当前这条"连接，避免旧僵尸 socket 延迟 close 误伤刚重连的新连接
      if (getPhoneWS() === ws) setPhoneWS(null);
      rejectPending(new Error("手机断开连接"));
    });

    ws.on("error", (err) => {
      console.error("[WS] 连接错误:", err.message);
    });
  });

  return wss;
}
