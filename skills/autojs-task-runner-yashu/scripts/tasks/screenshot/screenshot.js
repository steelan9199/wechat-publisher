/**
 * screenshot.js - 整屏截图并上传到电脑
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   name   {string} 选填  上传到电脑的文件名（仅允许字母数字 _ - .，须 .png 结尾），默认 screenshot_<时间戳>.png
 * 输出:
 *   成功 {ok:1, path:"电脑绝对路径", size:N, name:"xxx.png"}
 *   失败 {ok:0, err:"原因"}
 *
 * 流程: captureScreen() → images.save 存临时 PNG → http.postMultipart 上传到电脑 /upload
 *
 * 上传方式: 用 AutoJS 的 http.postMultipart(url, {file: open(路径)}) 上传（AutoJS 上传文件唯一允许的方式，不转 base64）。
 * 服务器地址: 从 /sdcard/脚本/relay_config.json 读取（由手机常驻客户端连上时写入）。
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

// 用 AutoJS 的 http.postMultipart 把本地文件上传到电脑中继的 /upload?name=
// （AutoJS 上传文件/图片统一用 postMultipart，http.post 不能传文件）
function uploadBytes(filePath, name) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    throw new Error(
      "未找到中继配置 /sdcard/脚本/relay_config.json，请先运行手机常驻客户端 autojs-task-phone-client.js",
    );
  }
  var port = cfg.serverPort || 9421;
  var url = "http://" + cfg.serverIp + ":" + port + "/upload?name=" + name;
  // postMultipart 的 file 字段接受 open() 返回的文件对象，底层走 multipart/form-data
  var res = http.postMultipart(url, {
    file: open(filePath),
  });
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    var detail = res && res.body ? res.body.string() : "(无响应体)";
    throw new Error("上传失败 HTTP " + (res && res.statusCode) + " " + detail);
  }
  // 响应体为 JSON：{success, path, size, name}
  return res.body.string();
}

// 生成默认文件名（时间戳，避开 Windows 非法字符）
function genName() {
  var ts = new Date().getTime();
  return "screenshot_" + ts + ".png";
}

// 过滤成服务器允许的安全文件名：仅字母数字 _ - .，并保证 .png 结尾
function safeName(input) {
  if (typeof input !== "string" || !input) return null;
  if (!/^[A-Za-z0-9_\-\.]+$/.test(input)) return null;
  if (!/\.png$/i.test(input)) return input + ".png";
  return input;
}

var TEMP_IMAGE_DIR = "/sdcard/autojs_temp/images";
var MAX_TEMP_IMAGES = 10;

// 清理旧版本遗留：旧代码会把截图直接写在 /sdcard/autojs_temp/ 下（含固定名 autojs_temp_screenshot.png），
// 新版统一放到 images 子目录。这里删掉父目录里散落的 .png，避免旧大文件继续占手机空间。
function cleanupLegacyTempImages() {
  try {
    var legacyDir = "/sdcard/autojs_temp";
    if (!files.isDir(legacyDir)) return;
    var names = files.listDir(legacyDir, function (n) {
      return /\.png$/i.test(n) && files.isFile(files.join(legacyDir, n));
    });
    for (var i = 0; i < names.length; i++) {
      try { files.remove(files.join(legacyDir, names[i])); } catch (e) { /* 忽略 */ }
    }
  } catch (e) { /* 忽略 */ }
}

// 确保统一图片目录存在：用文档里的 files.ensureDir，给它一个占位文件名，
// 它会创建整条目录链；目录已存在则无副作用、不报错（不会因文件夹缺失而抛错）。
function ensureImageDir() {
  try {
    files.ensureDir(files.join(TEMP_IMAGE_DIR, ".ensure"));
  } catch (e) { /* 忽略：目录创建失败不应阻断截图 */ }
  cleanupLegacyTempImages();
}

// 把临时图片目录里的 .png 数量限制在 MAX_TEMP_IMAGES 张以内：
// 按文件真实修改时间升序排列，删除最旧的，超出部分删掉，避免图片无限累积占用手机空间。
// 说明：目录列举/过滤/删除用 AutoJS 原生 files.*；AutoJS 无 lastModified() API，
// 故按真实修改时间排序用 Java 的 java.io.File.lastModified()（Java 更稳更可靠）。
function enforceImageCap() {
  try {
    if (!files.isDir(TEMP_IMAGE_DIR)) return;
    var names = files.listDir(TEMP_IMAGE_DIR, function (n) {
      return /\.png$/i.test(n) && files.isFile(files.join(TEMP_IMAGE_DIR, n));
    });
    var pngs = [];
    for (var i = 0; i < names.length; i++) {
      var p = files.join(TEMP_IMAGE_DIR, names[i]);
      pngs.push({ name: names[i], mtime: new java.io.File(p).lastModified() });
    }
    pngs.sort(function (a, b) { return a.mtime - b.mtime; });
    var excess = pngs.length - MAX_TEMP_IMAGES;
    for (var j = 0; j < excess; j++) {
      try { files.remove(files.join(TEMP_IMAGE_DIR, pngs[j].name)); } catch (e) { /* 忽略 */ }
    }
  } catch (e) { /* 忽略 */ }
}

var result = { ok: 0, err: "脚本未产出结果" };
var uploaded = false;
try {
  var args = readArgs();
  // 申请截图权限 + 后台线程自动点「立即开始」（详见 references/截图权限与弹框处理.md）
  threads.start(function () {
    text("立即开始").clickable(true).findOne(3000).click();
  });
  var img = null;
  if (!requestScreenCapture()) {
    toastLog("请求截图失败");
    result = { ok: 0, err: "请求截图权限失败" };
  } else {
    sleep(500);
    img = captureScreen();
    if (!img) {
      result = { ok: 0, err: "captureScreen 返回空（截图权限可能未授予）" };
    }
  }
  if (img) {
    // 整屏截图直接存盘，无需裁剪
    var ts = new Date().getTime();
    ensureImageDir();
    var tmpPath = TEMP_IMAGE_DIR + "/screenshot_" + ts + ".png";
    images.save(img, tmpPath, "png");
    // captureScreen() 返回的图片由系统管理，无需手动 recycle（AutoJS 会自动回收）
    // AutoJS 无 length() API 取文件大小，用 Java 的 java.io.File.length()（Java 更稳更可靠）
    var sizeOnPhone = new java.io.File(tmpPath).length();
    if (!files.exists(tmpPath) || sizeOnPhone === 0) {
      result = { ok: 0, err: "images.save 保存截图失败（可能为 0 字节）" };
    } else {
      var name = safeName(args.name) || genName();
      var respText = uploadBytes(tmpPath, name);
      uploaded = true;
      var resp = null;
      try {
        resp = JSON.parse(respText);
      } catch (e) {
        resp = null;
      }
      if (resp && resp.path) {
        result = {
          ok: 1,
          path: resp.path,
          size: resp.size != null ? resp.size : sizeOnPhone,
          name: resp.name || name,
        };
      } else {
        // 上传成功但服务器回包异常：至少把本地已知信息带回去
        result = {
          ok: 1,
          path: null,
          size: sizeOnPhone,
          name: name,
          note: "上传已发出但服务器回包异常: " + respText,
        };
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
} finally {
  // 成功后图片已上传到电脑，不再需要，立即删除以释放手机空间；
  // 失败则保留（便于排查），统一由 enforceImageCap 把整个临时图片目录限制在最多 10 张，
  // 超过则按修改时间删除最旧的，避免图片无限累积占用手机空间。
  if (uploaded) {
    try { files.remove(tmpPath); } catch (e2) { /* 忽略 */ }
  }
  enforceImageCap();
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
