/**
 * trigger.js - AI 触发脚本
 *
 * AI 聊天软件说"手机截图"时执行此脚本。
 * 流程：健康检查 → 请求截图 → 输出图片绝对路径（供 AI 读取）
 *
 * 运行：node trigger.js
 * 输出：图片绝对路径（成功）或错误信息（失败，退出码 1）
 */

import http from "node:http";

const PORT = 9421;
const HOST = "127.0.0.1";

/**
 * 发送 HTTP GET 请求
 * @param {string} url
 * @returns {Promise<{status: number, body: object|string}>}
 */
function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("请求超时"));
    });
  });
}

async function main() {
  // ---- 1. 健康检查 ----
  let health;
  try {
    health = await getJSON(`http://${HOST}:${PORT}/health`);
  } catch (e) {
    console.error("错误: 服务器未启动");
    console.error("请先运行: node server.js");
    process.exit(1);
  }

  if (health.body.phone !== "connected") {
    console.error("错误: 手机未连接");
    console.error("请在手机上运行 AutoJS 脚本 (autojs-client.js)");
    process.exit(1);
  }

  // ---- 2. 请求截图 ----
  let result;
  try {
    result = await getJSON(`http://${HOST}:${PORT}/screenshot`);
  } catch (e) {
    console.error("错误: 截图请求失败 -", e.message);
    process.exit(1);
  }

  // ---- 3. 输出结果 ----
  if (result.status === 200 && result.body.success) {
    // 只输出路径，方便 AI 读取
    console.log(result.body.path);
  } else {
    console.error("错误:", result.body.error || "未知错误");
    process.exit(1);
  }
}

main();
