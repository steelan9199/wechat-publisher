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
  setScriptBaseDir,
  resolvePending,
  rejectPending,
  hasPending,
  noteAppPing,
  resetAppPing,
  isAppPingFresh,
} from "./state.js";
import {
  markRunning,
  markProgress,
  touchAlive,
  finishTask,
  listTasks,
  getTask,
} from "./task-registry.js";
import { HEARTBEAT_INTERVAL } from "./config.js";

/** 处理二进制消息：手机回传的截图数据 */
function onBinary(data) {
  console.log(`[WS] 收到图片数据: ${data.length} bytes`);
  if (!resolvePending(data)) {
    console.log("[WS] 警告: 收到图片数据但没有等待中的请求，已丢弃");
  }
}

/**
 * 无主旧格式回执的兜底归因：旧版手机客户端（或未注入 taskId 的流程）回传
 * run_result 时没有 taskId。若此刻没有在途请求可接，就归因给最近一条
 * 提交 60 秒内、尚未终态的任务单——中继重启/客户端热更新交替窗口期的结果不丢。
 */
function attributeOrphanResult(payload) {
  const now = Date.now();
  const candidates = listTasks(50)
    .filter(
      (t) =>
        !t.finished &&
        t.status !== "stopped" &&
        now - t.submittedAt < 60 * 1000
    )
    .sort((a, b) => b.submittedAt - a.submittedAt);
  if (candidates.length === 0) return false;
  const rec = getTask(candidates[0].taskId);
  finishTask(rec.taskId, "success", payload);
  console.log(`[WS] 无主回执已归因给最近任务单 ${rec.taskId}`);
  return true;
}

/** 处理文本消息：任务单消息 / run 结果或错误上报 */
function onText(msg) {
  // 应用层心跳：手机端每 10s 发 {type:"ping"}，立即回 pong（不刷日志、不占在途槽位）。
  // 同时刷新应用层心跳时间戳——这是"脚本引擎存活"的事实源（协议层 pong 由 okhttp
  // 自动回，引擎死后仍在，探测不到引擎假死）
  if (msg === '{"type":"ping"}') {
    noteAppPing();
    const w = getPhoneWS();
    if (w && w.readyState === 1) {
      try {
        w.send(JSON.stringify({ type: "pong" }));
      } catch (_) {
        /* 连接已坏则由 close/error 事件清理 */
      }
    }
    return;
  }

  console.log("[WS] 收到文本消息:", msg);

  let parsed;
  try {
    parsed = JSON.parse(msg);
  } catch (e) {
    return; // 非 JSON 文本，忽略
  }

  // ---- 连接注册：手机端上报脚本根目录（getSdcardPath 动态拼接结果，路径事实源）----
  if (parsed.type === "phone_info") {
    if (parsed.scriptBaseDir) {
      setScriptBaseDir(parsed.scriptBaseDir);
      console.log("[WS] 已记录手机端脚本根目录: " + parsed.scriptBaseDir);
    }
    return;
  }

  // ---- 任务单消息：不占用在途请求槽位，按 taskId 归位到任务登记表 ----
  if (parsed.type === "task_started") {
    if (parsed.taskId) markRunning(parsed.taskId);
    return;
  }
  if (parsed.type === "task_progress") {
    if (parsed.taskId) markProgress(parsed.taskId, parsed.progress);
    return;
  }
  if (parsed.type === "task_alive") {
    if (parsed.taskId) touchAlive(parsed.taskId);
    return;
  }
  if (parsed.type === "task_stopped") {
    if (parsed.taskId) {
      finishTask(parsed.taskId, "stopped", {
        ok: 0,
        err: parsed.found === false ? "任务不存在（可能已结束）" : "已被手动终止",
      });
    }
    return;
  }
  if (parsed.type === "task_result") {
    if (parsed.taskId) {
      const ok = parsed.payload && parsed.payload.ok === 0 ? "failed" : "success";
      finishTask(parsed.taskId, ok, parsed.payload);
    }
    return;
  }

  if (!hasPending()) {
    // 旧格式回执且无在途请求：尝试归因给最近任务单，避免结果丢失
    if (parsed.type === "run_result") {
      attributeOrphanResult(parsed.payload);
    }
    return;
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
 * 再置 true；下一周期开始时若 isAlive 仍为 false（上一周期的 pong 未回），说明
 * 连接已半开/僵尸，直接 terminate 强断。强断必须做：若只标记离线而不断开，
 * 手机端永远不知道连接已被判死，其 3 秒自动重连不会触发，系统会卡死在
 * "PC 判离线、手机仍在线"的死局（历史上踩过，见 ARCHITECTURE.md 第 6 节）。
 */
export function attachPhoneWS(server) {
  const wss = new WebSocketServer({ server });

  // 协议层心跳：一个周期未回 pong 即 terminate 强断（手机端感知后 3 秒自动重连，自愈）
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        // 上一周期的 ping 没等到 pong：半开/僵尸连接，强制断开让手机端重连
        console.log("[WS] 心跳超时，强制断开无响应连接（手机端将自动重连）");
        try {
          ws.terminate();
        } catch (_) {
          /* 连接已坏则由 close/error 事件清理 */
        }
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (_) {
        /* 发送失败说明连接已坏，下一轮按未回 pong 处理 */
      }
    });

    // 应用层心跳判死：协议层 pong 正常（okhttp 活着）但应用层 ping 停发
    // （脚本引擎已死/客户端假死）——terminate 让状态归位，health 翻转 disconnected。
    // 没有这一判，手动停掉客户端引擎后会出现"health 恒报 connected、
    // 任务单永久悬挂 submitted"的死局（验收用例 6.3 实测踩过）。
    const cur = getPhoneWS();
    if (cur && cur.readyState === 1 && !isAppPingFresh()) {
      console.log(
        "[WS] 应用层心跳超时（脚本引擎无响应但协议层 pong 正常），强制断开疑似假死连接"
      );
      try {
        cur.terminate();
      } catch (_) {
        /* 连接已坏则由 close/error 事件清理 */
      }
    }
  }, HEARTBEAT_INTERVAL);
  // 不阻止进程退出（server 关闭后随事件循环自然结束）
  heartbeat.unref();

  wss.on("connection", (ws) => {
    console.log("[WS] 手机已连接");
    ws.isAlive = true; // 连上即视为存活，首轮心跳前也按在线处理
    resetAppPing(); // 新连接未armed：首次应用层 ping 到达后才启用引擎假死判死
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
      // 只处理"当前这条"连接的断开：旧僵尸 socket 延迟 close 不能清掉
      // 刚重连的新连接，更不能误杀新连接上的在途请求
      if (getPhoneWS() !== ws) {
        console.log("[WS] 旧连接已清理（非当前连接，状态不变）");
        return;
      }
      console.log("[WS] 手机已断开");
      setPhoneWS(null);
      rejectPending(new Error("手机断开连接"));
    });

    ws.on("error", (err) => {
      console.error("[WS] 连接错误:", err.message);
    });
  });

  return wss;
}
