/**
 * autojs-relay-server.js - PC 端 WebSocket + HTTP 中继服务器（入口）
 *
 * 本文件只做装配与启动编排，具体实现按"交互对象"拆在 relay/ 下：
 *   relay/pc-bootstrap.js  和电脑交互：自保护探测、端口释放、终端横幅
 *   relay/ai-api.js        和 AI 交互：/health /screenshot /run
 *   relay/phone-http.js    和手机交互（短连接）：/upload /probe/*
 *   relay/phone-ws.js      和手机交互（长连接）：截图数据、脚本结果、断线处理
 *   relay/router.js        把上面两组 HTTP 路由挂到同一个 server
 *   relay/config.js        端口、目录、超时等全部配置
 *   relay/state.js         phoneWS / pendingRequest 状态单点收口
 *   relay/utils/           工具函数库：http / fsx / port
 *
 * 架构概览（面向维护者与 AI 辅助编程，修改前必读）：relay/ARCHITECTURE.md
 * 同步要求：改动本脚本或其依赖（relay/ 下任意模块）后，请同步更新上述架构文档，避免文档与实现脱节。
 *
 * 运行：node autojs-relay-server.js
 * 端口：9421（HTTP + WebSocket 共用）
 */

import { PORT, VERSION, BUILD_FINGERPRINT, UPLOAD_DIR, MAX_PC_UPLOAD_FILES, TEMP_DIR, MAX_PC_TEMP_FILES } from "./relay/config.js";
import { pruneToMax } from "./relay/utils/fsx.js";
import { createRelayServer } from "./relay/router.js";
import { attachPhoneWS } from "./relay/phone-ws.js";
import { setServer } from "./relay/state.js";
import {
  probeService,
  replaceRunningService,
  freePortForStart,
  printAlreadyRunningNotice,
  printVersionMismatchNotice,
  printStartupBanner,
} from "./relay/pc-bootstrap.js";

// ============ 启动自保护 + 版本对齐（自升级） ============
// 探测端口上是否已有"我们自己的"中继服务：
//   - 没在跑            → 下面正常启动
//   - 在跑且指纹一致    → 已经是正确的版本，直接退出（绝不误杀）
//   - 在跑但指纹不同    → 杀掉老程序、启动新程序（自升级）
const existing = await probeService(PORT);
if (existing) {
  if (existing.fingerprint === BUILD_FINGERPRINT) {
    printAlreadyRunningNotice(PORT);
    process.exit(0);
  }
  printVersionMismatchNotice(
    PORT,
    existing,
    { version: VERSION, fingerprint: BUILD_FINGERPRINT }
  );
  await replaceRunningService(PORT, existing);
  // 端口已释放，继续往下正常启动新版本
}

// ============ 装配 ============
// 先确保端口空闲（自升级已杀掉老程序后，这里清可能的残留占用），再创建并监听。
// createRelayServer() 内部已将 Hono 挂到 http.Server 上但不自动 listen，
// 监听时机交由本文件统一掌控，便于与 WebSocket（ws 库）共用同一端口。
freePortForStart(PORT);

const server = createRelayServer();
attachPhoneWS(server);
// 把 server 实例交给 state，供 /shutdown 优雅退出时调用 close()
setServer(server);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[端口] ${PORT} 仍被占用，1 秒后重试一次...`);
    freePortForStart(PORT);
    setTimeout(() => server.listen(PORT), 1000);
  } else {
    console.error("[服务器] 错误:", err.message);
  }
});

// 启动前先清理：覆盖服务停期间堆积的旧文件
//   - 手机上传目录：最多保留最新 MAX_PC_UPLOAD_FILES 个文件（不限扩展名）
//   - AI 现场脚本库 temp/：最多保留最新 MAX_PC_TEMP_FILES 个文件（不限扩展名）
pruneToMax(UPLOAD_DIR, MAX_PC_UPLOAD_FILES);
pruneToMax(TEMP_DIR, MAX_PC_TEMP_FILES);
// 对 temp/ 加周期清理兜底：AI 常驻写下的一次性脚本不走 /upload、无法在落盘时即时裁剪，
// 故每 60 秒兜底裁一次，确保即便服务长期运行也不会无限堆积。
setInterval(() => {
  try {
    pruneToMax(TEMP_DIR, MAX_PC_TEMP_FILES);
  } catch {
    /* 忽略 */
  }
}, 60 * 1000).unref?.();
server.listen(PORT, () => printStartupBanner(PORT));
