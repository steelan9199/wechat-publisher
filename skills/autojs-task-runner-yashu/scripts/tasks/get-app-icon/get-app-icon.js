/**
 * get_app_icon.js - 获取指定 App 的应用图标并回传到电脑
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   name    {string} 必填  应用名称（如 "抖音"、"设置"）或包名（如 "com.ss.android.ugc.aweme"）
 *   format  {string} 选填  输出格式，"png"(默认) 或 "jpg"
 *   outName {string} 选填  上传到电脑的文件名（仅允许字母数字 _ - .，须以 .png/.jpg 结尾），默认 appicon_<时间戳>
 * 输出:
 *   成功 {ok:1, path:"电脑绝对路径(若上传成功)", phonePath:"手机sdcard路径", size:N, name:"xxx.png", app:"抖音", pkg:"com.ss.android.ugc.aweme"}
 *   失败 {ok:0, err:"原因"}
 *
 * 流程: 解析应用名/包名 → PackageManager 取 ApplicationInfo → loadIcon 取图标 Drawable
 *       → Drawable 转 Bitmap → 存 sdcard 临时图 → 经 /upload 上传电脑（AutoJS 上传文件统一用 postMultipart）
 *
 * 说明: 图标 Drawable（含 AdaptiveIconDrawable）先 setBounds 再 draw 到 ARGB_8888 画布；
 *       个别 drawable 拿不到 intrinsic 尺寸时按屏幕密度给 48dp 兜底。
 * 服务器地址: 从 scripts-from-computer/data/relay-config.json 读取（由手机常驻客户端连上时写入）。
 * 未连中继时仅把图标存到手机 sdcard，并在回执带 phonePath + note，不报错中断。
 *
 * 语法: ES5（var only）。单文件自包含。
 */

importClass(java.io.File);
importClass(java.io.FileOutputStream);
importClass(android.graphics.Canvas);
importClass(android.graphics.Bitmap);

function readArgs() {
  // 参数唯一权威源：任务单注入的 __TASK_ARGS_PATH（scripts-from-computer/data/task-args/<taskId>.json）
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}

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

// 把本地图标文件上传到电脑中继的 /upload?name=（AutoJS 上传文件统一用 postMultipart）
function uploadBytes(filePath, name) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    return null; // 未连中继：返回 null，由上层仅存手机
  }
  var port = cfg.serverPort || 9421;
  var url = "http://" + cfg.serverIp + ":" + port + "/upload?name=" + name;
  var res = http.postMultipart(url, { file: open(filePath) });
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    var detail = res && res.body ? res.body.string() : "(无响应体)";
    throw new Error("上传失败 HTTP " + (res && res.statusCode) + " " + detail);
  }
  return res.body.string();
}

function genName(ext) {
  var ts = new Date().getTime();
  return "appicon_" + ts + "." + ext;
}

// 过滤成服务器允许的安全文件名：仅字母数字 _ - .，并保证以 ext 结尾
function safeName(input, ext) {
  if (typeof input !== "string" || !input) return null;
  if (!/^[A-Za-z0-9_\-\.]+$/.test(input)) return null;
  var re = new RegExp("\\." + ext + "$", "i");
  if (!re.test(input)) return input + "." + ext;
  return input;
}

// Drawable（含 AdaptiveIconDrawable）→ Bitmap：先设 bounds 再 draw 到 ARGB_8888 画布
function drawableToBitmap(icon) {
  var w = icon.getIntrinsicWidth();
  var h = icon.getIntrinsicHeight();
  if (w <= 0 || h <= 0) {
    var density = context.getResources().getDisplayMetrics().density;
    w = h = Math.floor(48 * density) || 192;
  }
  var bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
  var canvas = new Canvas(bmp);
  icon.setBounds(0, 0, w, h);
  icon.draw(canvas);
  return bmp;
}

var TEMP_DIR = files.join(files.getSdcardPath(), "autojs_temp", "icons");
var MAX_TEMP_ICONS = 10;

// 把临时图标目录限制在 MAX_TEMP_ICONS 个以内：按真实修改时间升序删最旧的，避免无限累积
function enforceIconCap() {
  try {
    if (!files.isDir(TEMP_DIR)) return;
    var names = files.listDir(TEMP_DIR, function (n) {
      return /\.(png|jpg|jpeg)$/i.test(n) && files.isFile(files.join(TEMP_DIR, n));
    });
    var arr = [];
    for (var i = 0; i < names.length; i++) {
      var p = files.join(TEMP_DIR, names[i]);
      arr.push({ name: names[i], mtime: new java.io.File(p).lastModified() });
    }
    arr.sort(function (a, b) { return a.mtime - b.mtime; });
    var excess = arr.length - MAX_TEMP_ICONS;
    for (var j = 0; j < excess; j++) {
      try { files.remove(files.join(TEMP_DIR, arr[j].name)); } catch (e2) { /* 忽略 */ }
    }
  } catch (e) { /* 忽略 */ }
}

var result = { ok: 0, err: "脚本未产出结果" };
var uploaded = false;
var phonePath = null;
try {
  var args = readArgs();
  var appName = args.name;
  if (typeof appName !== "string" || !appName) {
    result = { ok: 0, err: "缺少参数 name（必须是非空字符串，应用名或包名）" };
  } else {
    var pm = context.getPackageManager();
    // 先当应用名解析，失败/为空则直接当包名用
    var packageName = appName;
    try {
      var byLabel = app.getPackageName(appName);
      if (byLabel) packageName = byLabel;
    } catch (e) { /* 忽略，继续用原值 */ }
    var appInfo = null;
    try {
      appInfo = pm.getApplicationInfo(packageName, 0);
    } catch (e) {
      appInfo = null;
    }
    if (!appInfo) {
      result = { ok: 0, err: "未找到应用: " + appName };
    } else {
      var icon = appInfo.loadIcon(pm);
      if (!icon) {
        result = { ok: 0, err: "该应用无可用图标" };
      } else {
        var ext = args.format === "jpg" ? "jpg" : "png";
        var bmp = drawableToBitmap(icon);
        // 确保目录存在
        try { files.ensureDir(files.join(TEMP_DIR, ".ensure")); } catch (e) { /* 忽略 */ }
        var ts = new Date().getTime();
        phonePath = TEMP_DIR + "/appicon_" + ts + "." + ext;
        var f = new java.io.File(phonePath);
        var fOut = new java.io.FileOutputStream(f);
        var fmt = ext === "jpg" ? Bitmap.CompressFormat.JPEG : Bitmap.CompressFormat.PNG;
        bmp.compress(fmt, 100, fOut);
        fOut.flush();
        fOut.close();
        bmp.recycle();
        if (!files.exists(phonePath) || new java.io.File(phonePath).length() === 0) {
          result = { ok: 0, err: "图标保存失败（0 字节）" };
        } else {
          var size = new java.io.File(phonePath).length();
          var outName = safeName(args.outName, ext) || genName(ext);
          var respText = uploadBytes(phonePath, outName);
          var resp = null;
          if (respText) {
            try { resp = JSON.parse(respText); } catch (e) { resp = null; }
          }
          if (resp && resp.path) {
            uploaded = true;
            result = {
              ok: 1,
              path: resp.path,
              phonePath: phonePath,
              size: resp.size != null ? resp.size : size,
              name: resp.name || outName,
              app: appName,
              pkg: packageName,
            };
          } else {
            result = {
              ok: 1,
              path: null,
              phonePath: phonePath,
              size: size,
              name: outName,
              app: appName,
              pkg: packageName,
              note: respText
                ? "已存到手机，上传电脑失败: " + respText
                : "已存到手机sdcard，但未连接电脑中继，未上传",
            };
          }
        }
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
} finally {
  // 上传成功后删除手机临时图释放空间；失败保留供排查
  if (uploaded && phonePath && files.exists(phonePath)) {
    try { files.remove(phonePath); } catch (e2) { /* 忽略 */ }
  }
  enforceIconCap();
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
