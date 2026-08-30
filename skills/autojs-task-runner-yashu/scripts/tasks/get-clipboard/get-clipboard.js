/**
 * get_clipboard.js - 获取手机剪贴板文本内容并回传电脑
 *
 * 输入: 无必填参数。
 * 输出:
 *   - 短文本(≤100字)   {ok:1, content:"...", length:N, empty:bool}
 *   - 长文本(>100字)    {ok:1, length:N, empty:false, file:"电脑绝对路径", preview:"前80字…"}
 *   - 剪贴板为空        {ok:1, content:null, length:0, empty:true}
 *   - 失败              {ok:0, err:"原因"}
 *
 * 流程:
 *   1) getClip() 读取剪贴板文本；
 *   2) ≤100 字：直接回传文本（聊天里直接看）；
 *   3) >100 字：内容过长，写入手机临时文件 → 经 /upload 通道上传到电脑
 *      scripts/uploads/ 目录（命名 clipboard_<时间戳>.txt）→ 只回传电脑绝对路径
 *      + 前 80 字预览，不直接把整段长文塞回聊天（省 token、不刷屏）。
 *      临时文件上传成功后会立即删除；上传失败时保留在手机 /sdcard/autojs_temp/clipboard/，
 *      由 enforceClipboardCap() 把该目录限制为最多 30 个文件（不限扩展名、按修改时间保留最新），
 *      避免失败残留无限堆积。
 *
 * 注意（Android 10+ 限制）:
 *   - 系统对"后台应用读取剪贴板"有限制，AutoJS6 若未在合适权限/前台状态下，
 *     getClip() 可能返回空。此时 empty:true 属系统行为，不一定是脚本错误。
 *   - 剪贴板可能含密码/验证码/Token 等敏感信息，仅本地展示，切勿外发第三方。
 *
 * 语法: ES5（var only）。单文件自包含。
 */

var LONG_THRESHOLD = 100; // 超过此字数的剪贴板内容改为"落地成文件 + 回路径"

function readClipboard() {
  try {
    var clip = getClip(); // AutoJS 全局函数：读取剪贴板文本
    if (clip == null) return null;
    // 确保是 JS 字符串（getClip 底层可能返回 java.lang.String）
    return "" + clip;
  } catch (e) {
    throw new Error("getClip() 调用失败：" + e.toString());
  }
}

// 读取手机常驻客户端连上时写入的中继配置（serverIp / serverPort）
function readRelayConfig() {
  try {
    return JSON.parse(
      files.read(
        files.join(
          files.getSdcardPath(),
          "脚本",
          "scripts-from-computer",
          "data",
          "relay-config.json"
        )
      )
    );
  } catch (e) {
    return null;
  }
}

// 把手机本地文件经 /upload 通道上传到电脑，返回 {path,size,name}
function uploadToPc(filePath, name) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    throw new Error(
      "未找到中继配置 scripts-from-computer/data/relay-config.json，请先运行手机常驻客户端 autojs-task-phone-client.js"
    );
  }
  var port = cfg.serverPort || 9421;
  var url = "http://" + cfg.serverIp + ":" + port + "/upload?name=" + name;
  // postMultipart 的 file 字段接受 open() 返回的文件对象（AutoJS 上传文件唯一方式）
  var res = http.postMultipart(url, { file: open(filePath) });
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    var detail = res && res.body ? res.body.string() : "(无响应体)";
    throw new Error("上传失败 HTTP " + (res && res.statusCode) + " " + detail);
  }
  return JSON.parse(res.body.string());
}

var TEMP_DIR = files.join(files.getSdcardPath(), "autojs_temp", "clipboard");
// 手机剪贴板临时目录保留上限：按修改时间只保留最新的 N 个文件（不限扩展名），
// 上传失败时没人删的残留 .txt 也一并计入，避免无限堆积。
var CLIPBOARD_CAP = 30;

// 把 TEMP_DIR 内的文件数限制在 CLIPBOARD_CAP 个以内：按真实修改时间升序，
// 删除最旧的超出部分。AutoJS 无 lastModified() API，故用 Java 的 java.io.File.lastModified()。
function enforceClipboardCap() {
  try {
    if (!files.isDir(TEMP_DIR)) return;
    var names = files.listDir(TEMP_DIR, function (n) {
      return files.isFile(files.join(TEMP_DIR, n));
    });
    var arr = [];
    for (var i = 0; i < names.length; i++) {
      var p = files.join(TEMP_DIR, names[i]);
      arr.push({ name: names[i], mtime: new java.io.File(p).lastModified() });
    }
    arr.sort(function (a, b) { return a.mtime - b.mtime; }); // 旧 → 新
    var excess = arr.length - CLIPBOARD_CAP;
    for (var j = 0; j < excess; j++) {
      try { files.remove(files.join(TEMP_DIR, arr[j].name)); } catch (e) {}
    }
  } catch (e) {
    /* 忽略 */
  }
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var text = readClipboard();
  if (text == null || text.length === 0) {
    // 剪贴板为空
    result = { ok: 1, content: null, length: 0, empty: true };
  } else if (text.length <= LONG_THRESHOLD) {
    // 短文本：直接回传，聊天里即可查看
    result = { ok: 1, content: text, length: text.length, empty: false };
  } else {
    // 长文本：落地成文件 + 只回路径，避免把整段长文塞回聊天
    var uploaded = false;
    try {
      var ts = new Date().getTime();
      files.ensureDir(files.join(TEMP_DIR, ".ensure"));
      var tmpFile = TEMP_DIR + "/clipboard_" + ts + ".txt";
      files.write(tmpFile, text); // 默认 UTF-8，中文安全
      // 写入后即时裁剪：即便本次上传失败、finally 不删该临时文件，
      // 该目录也会被限制为最多 30 个文件（不限扩展名），不会无限堆积。
      enforceClipboardCap();
      var name = "clipboard_" + ts + ".txt";
      var resp = uploadToPc(tmpFile, name);
      if (resp && resp.path) {
        result = {
          ok: 1,
          length: text.length,
          empty: false,
          file: resp.path,
          preview: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
        };
      } else {
        // 上传发出但服务器回包异常：兜底附前 200 字预览，内容不丢
        result = {
          ok: 1,
          length: text.length,
          empty: false,
          preview: text.slice(0, 200),
          note: "长文本已上传但服务器回包异常: " + JSON.stringify(resp),
        };
      }
      uploaded = true;
    } catch (upErr) {
      // 上传失败：兜底附前 200 字预览 + 错误提示，内容不丢
      result = {
        ok: 1,
        length: text.length,
        empty: false,
        preview: text.slice(0, 200),
        note: "长文本落地电脑失败：" + upErr.toString() + "（已附前 200 字预览）",
      };
    } finally {
      // 上传成功/失败都清掉手机临时文件，避免堆积
      if (uploaded) {
        try { files.remove(tmpFile); } catch (e2) { /* 忽略 */ }
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
