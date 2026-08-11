/**
 * send_file_to_phone.js - 把电脑上的任意文件下发到手机（PC→手机）
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   fileName   {string} 必填  电脑中转目录里的安全文件名（由 PC 侧 pc_to_phone.js 写入，经 /pcfile/<fileName> 拉取）
 *   targetDir  {string} 选填  手机落盘目录，默认 /sdcard/Download
 *   targetName {string} 选填  手机落盘文件名（保留原文件名语义），默认用 fileName
 * 输出:
 *   成功 {ok:1, path:"手机绝对路径", size:N, name:"文件名"}
 *   失败 {ok:0, err:"原因"}
 *
 * 流程: 从中继 /pcfile/<fileName> 拉取原始字节 → files.writeBytes 写入手机 targetDir/targetName → 回读校验字节数。
 * 服务器地址: 从 /sdcard/脚本/relay_config.json 读取（由手机常驻客户端连上时写入）。
 * 说明: 这是"电脑 → 手机"下发通道，与 download_file 的"手机 → 电脑"反向互补；可用于把电脑上任意文件推到手机。
 *
 * 语法: ES5（var only）。单文件自包含。
 */

function readArgs() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  } catch (e) {
    return {};
  }
}

function readRelayConfig() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/relay_config.json"));
  } catch (e) {
    return null;
  }
}

// 从中继 /pcfile/<fileName> 把文件原始字节下载下来（AutoJS http.get + body.bytes()）
function downloadBytes(fileName) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    throw new Error(
      "未找到中继配置 /sdcard/脚本/relay_config.json，请先运行手机常驻客户端 autojs-task-phone-client.js"
    );
  }
  var port = cfg.serverPort || 9421;
  var url = "http://" + cfg.serverIp + ":" + port + "/pcfile/" + encodeURIComponent(fileName);
  var res = http.get(url);
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    var detail = res && res.body ? res.body.string() : "(无响应体)";
    throw new Error("下载失败 HTTP " + (res && res.statusCode) + " " + detail);
  }
  var bytes = res.body.bytes();
  if (!bytes || bytes.length === 0) {
    throw new Error("下载内容为空（文件可能已被取走或不存在）");
  }
  return bytes;
}

// 校验"手机侧落盘文件名"是否安全：不允许目录分隔符、..、Windows 非法字符、空白结尾
function safeTargetName(input) {
  if (typeof input !== "string" || !input) return null;
  if (/[<>:"/\\|?*\0]/.test(input)) return null;
  if (input.indexOf("..") >= 0) return null;
  if (input.charAt(input.length - 1) === ".") return null;
  return input;
}

// 确保目标目录存在：用 files.ensureDir 配合占位文件名创建整条目录链
function ensureDir(dir) {
  try {
    files.ensureDir(files.join(dir, ".ensure"));
  } catch (e) {
    /* 忽略：目录创建失败不应阻断写入 */
  }
}

var DEFAULT_TARGET_DIR = "/sdcard/Download";

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  if (typeof args.fileName !== "string" || !args.fileName) {
    result = {
      ok: 0,
      err: "缺少参数 fileName（电脑中转目录里的安全文件名，由 PC 侧 pc_to_phone.js 提供）",
    };
  } else {
    var targetDir =
      typeof args.targetDir === "string" && args.targetDir
        ? args.targetDir
        : DEFAULT_TARGET_DIR;
    // 优先用用户指定的 targetName；否则回退到 fileName（二者都不安全则用原始 fileName 兜底，落到手机再看实际）
    var name = safeTargetName(args.targetName) || safeTargetName(args.fileName) || args.fileName;

    ensureDir(targetDir);
    var targetPath = targetDir + "/" + name;

    var bytes = downloadBytes(args.fileName);

    // 先删已有同名，避免 writeBytes 走到异常分支（安全起见）
    try {
      if (files.exists(targetPath)) files.remove(targetPath);
    } catch (e) {
      /* 忽略 */
    }

    files.writeBytes(targetPath, bytes);

    // AutoJS 无 length() API 取文件大小，用 Java 的 java.io.File.length()（Java 更稳更可靠）
    var realSize = new java.io.File(targetPath).length();
    if (!files.exists(targetPath) || realSize === 0) {
      result = { ok: 0, err: "写入手机失败（落盘为 0 字节或文件不存在）" };
    } else if (realSize !== bytes.length) {
      result = {
        ok: 0,
        err:
          "写入校验失败：期望 " + bytes.length + " 字节，实际 " + realSize + " 字节",
      };
    } else {
      result = { ok: 1, path: targetPath, size: realSize, name: name };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
