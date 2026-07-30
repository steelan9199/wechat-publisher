/**
 * autojs-client.js - 手机端 AutoJS 脚本
 *
 * 运行环境: AutoJS (Android, 小米 11 PRO)
 * 语法: ES5
 *
 * 功能:
 *   1. 连接电脑 WebSocket 服务器
 *   2. 收到 {action:"capture"} 指令后截屏
 *   3. 将截图 PNG 文件读取为 byte[]，用 okio.ByteString 二进制发送（不转 base64）
 *   4. 断线自动重连
 *
 * 使用前: 修改下方 SERVER_IP 为你电脑的局域网 IP
 */

// ==================== 截图权限 ====================

// // 自动点击同意截图权限，如果你的手机申请截图权限的时候，弹框的同意按钮也叫“立即开始”，那么你可以取消下面三行代码的注释。
// threads.start(function () {
//   text("立即开始").clickable(true).findOne().click();
// });

//请求截图
if (!requestScreenCapture()) {
  toastLog("请求截图失败");
  exit();
}

// ==================== 配置 ====================

// ★★★ 改成你电脑的局域网 IP ★★★
// 电脑上运行 ipconfig 查看 "IPv4 地址"，形如 192.168.1.100
var SERVER_IP = "192.168.0.41";
var SERVER_PORT = 9421;
var WS_URL = "ws://" + SERVER_IP + ":" + SERVER_PORT;

// 临时截图保存路径
var TEMP_PATH = "/sdcard/autojs_temp_screenshot.png";

// 重连间隔（毫秒）
var RECONNECT_INTERVAL = 3000;

// ==================== 全局状态 ====================

var ws = null;
var isConnected = false;
var reconnectTimer = null;

// ==================== 连接服务器 ====================

function connect() {
  console.log("正在连接服务器: " + WS_URL);

  ws = new WebSocket(WS_URL);

  ws.on(WebSocket.EVENT_OPEN, function (res, ws) {
    console.log("✓ 已连接到电脑服务器");
    console.log("等待截图指令...");
    console.log("");
    isConnected = true;
  });

  ws.on(WebSocket.EVENT_TEXT, function (text, ws) {
    console.log("收到指令: " + text);

    try {
      var cmd = JSON.parse(text);
      if (cmd.action === "capture") {
        captureAndSend();
      }
    } catch (e) {
      console.error("解析指令失败: " + e);
    }
  });

  ws.on(WebSocket.EVENT_BYTES, function (bytes, ws) {
    // 服务器一般不发送二进制数据给手机，忽略
  });

  ws.on(WebSocket.EVENT_CLOSED, function (code, reason, ws) {
    console.log("✗ 连接已断开");
    console.log("  code: " + code);
    if (reason) console.log("  reason: " + reason);
    isConnected = false;
    scheduleReconnect();
  });

  ws.on(WebSocket.EVENT_FAILURE, function (err, res, ws) {
    console.error("✗ 连接失败: " + err);
    isConnected = false;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log("将在 " + RECONNECT_INTERVAL / 1000 + " 秒后重连...");
  reconnectTimer = setTimeout(function () {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL);
}

// ==================== 截图并发送 ====================

function captureAndSend() {
  try {
    console.log("正在截屏...");

    // 截屏
    var img = captureScreen();
    if (!img) {
      console.error("截屏失败: captureScreen() 返回 null");
      ws.send(JSON.stringify({ error: "截屏失败: captureScreen() 返回 null" }));
      return;
    }

    // 保存到临时文件
    images.save(img, TEMP_PATH, "png");
    img.recycle();
    console.log("截屏完成，已保存到临时文件");

    // 读取文件为 Java byte[] 数组
    var file = new java.io.File(TEMP_PATH);
    var fis = new java.io.FileInputStream(file);
    var bytes = java.lang.reflect.Array.newInstance(
      java.lang.Byte.TYPE,
      parseInt(file.length())
    );
    fis.read(bytes);
    fis.close();

    var fileSize = file.length();
    console.log("图片大小: " + fileSize + " bytes (" + (fileSize / 1024).toFixed(1) + " KB)");

    // 发送二进制数据（okio.ByteString，不转 base64）
    ws.send(new okio.ByteString(bytes));
    console.log("✓ 图片已发送");
    console.log("");

    // 清理临时文件
    file.delete();
  } catch (e) {
    console.error("截图过程出错: " + e);
    try {
      ws.send(JSON.stringify({ error: "截图出错: " + e }));
    } catch (sendErr) {
      // 发送错误消息也失败了，忽略
    }
  }
}

// ==================== 启动 ====================

console.log("服务器地址: " + WS_URL);
console.log("");

connect();

// 保持脚本运行
setInterval(function () {
  if (!isConnected && !reconnectTimer) {
    scheduleReconnect();
  }
}, 5000);
