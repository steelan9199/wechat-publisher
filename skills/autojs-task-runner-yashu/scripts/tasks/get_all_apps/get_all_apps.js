/**
 * get_all_apps.js - 获取手机上安装的所有 App，并分类统计系统预制 App 与用户安装 App
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   无必填参数。
 * 输出:
 *   - 成功（已把用户 App 名单落地到电脑，且回执内联完整名单）
 *     {ok:1, systemCount:N, userCount:M, userAppNames:["微信","抖音",...全量], file:"<电脑绝对路径>", nameCount:M, preview:"前20个名字…"}
 *   - 成功（未连接电脑中继 / 上传失败，回退为内联数组）
 *     {ok:1, systemCount:N, userCount:M, userAppNames:["微信","抖音",...全量], note:"..."}
 *   - 失败
 *     {ok:0, err:"原因"}
 *   说明：userAppNames 始终为「全部用户安装 App 的名字」（未截断）；系统预制 App 名字不收集、不返回。
 *
 * 流程:
 *   1) context.getPackageManager().getInstalledApplications(0) 取全部已安装应用；
 *   2) 按 ApplicationInfo.flags 判定系统预制：FLAG_SYSTEM(1) 或 FLAG_UPDATED_SYSTEM_APP(128)
 *      任一置位即视为「系统预制」；
 *   3) 统计 systemCount / userCount，收集用户安装 App 的显示名（loadLabel）；
 *   4) 把用户安装 App 名字逐行写入手机临时文件 → 经 /upload 上传电脑 → 回传绝对路径
 *      （便于 AI 用 present_files 完整展示，且不把长名单塞进聊天，省 token）；
 *   5) 上传不可用时（如中继配置缺失或上传失败）回退为内联 userAppNames 数组，保证信息不丢。
 *
 * 说明:
 *   - 用户安装 App = 非系统预制（FLAG_SYSTEM 与 FLAG_UPDATED_SYSTEM_APP 均未置位）。
 *   - 按需求只展示系统预制 App 的「数量」，不收集其名字；仅收集用户安装 App 的名字。
 *
 * 语法: ES5（var only）。单文件自包含。
 */

var FLAG_SYSTEM = 1; // ApplicationInfo.FLAG_SYSTEM
var FLAG_UPDATED_SYSTEM_APP = 128; // ApplicationInfo.FLAG_UPDATED_SYSTEM_APP

var TEMP_DIR = "/sdcard/autojs_temp/apps";
var APP_LIST_CAP = 30; // 手机临时名单目录最多保留 30 个文件
var PREVIEW_LIMIT = 20; // 回执预览最多前 20 个名字

// 读取手机常驻客户端连上时写入的中继配置（serverIp / serverPort）
function readRelayConfig() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/relay_config.json"));
  } catch (e) {
    return null;
  }
}

// 把手机本地文件经 /upload 通道上传到电脑，返回解析后的 JSON（含 path/size/name）
function uploadToPc(filePath, name) {
  var cfg = readRelayConfig();
  if (!cfg || !cfg.serverIp) {
    throw new Error(
      "未找到中继配置 /sdcard/脚本/relay_config.json，请先运行手机常驻客户端 autojs-task-phone-client.js"
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

// 把用户 App 名字数组合并为每行一个的纯文本
function buildListText(names) {
  var s = "";
  for (var i = 0; i < names.length; i++) {
    s += names[i] + "\n";
  }
  return s;
}

// 预览：取前 N 个名字，逗号分隔
function buildPreview(names, limit) {
  var n = Math.min(names.length, limit);
  var arr = [];
  for (var i = 0; i < n; i++) {
    arr.push(names[i]);
  }
  var tail = names.length > limit ? " 等共 " + names.length + " 个" : "";
  return arr.join("、") + tail;
}

// 把 TEMP_DIR 内文件数限制在 APP_LIST_CAP 以内：按修改时间只保留最新 N 个，避免堆积
function enforceAppListCap() {
  try {
    if (!files.isDir(TEMP_DIR)) return;
    var names = files.listDir(TEMP_DIR, function (n) {
      return /\.txt$/i.test(n) && files.isFile(files.join(TEMP_DIR, n));
    });
    var arr = [];
    for (var i = 0; i < names.length; i++) {
      var p = files.join(TEMP_DIR, names[i]);
      arr.push({ name: names[i], mtime: new java.io.File(p).lastModified() });
    }
    arr.sort(function (a, b) { return a.mtime - b.mtime; }); // 旧 → 新
    var excess = arr.length - APP_LIST_CAP;
    for (var j = 0; j < excess; j++) {
      try { files.remove(files.join(TEMP_DIR, arr[j].name)); } catch (e2) { /* 忽略 */ }
    }
  } catch (e) { /* 忽略 */ }
}

var result = { ok: 0, err: "脚本未产出结果" };
var uploaded = false;
var tmpFile = null;
try {
  var pm = context.getPackageManager();
  var appList = pm.getInstalledApplications(0);
  var systemCount = 0;
  var userCount = 0;
  var userAppNames = [];
  for (var i = 0; i < appList.size(); i++) {
    var app = appList.get(i);
    var isSystem =
      (app.flags & FLAG_SYSTEM) !== 0 ||
      (app.flags & FLAG_UPDATED_SYSTEM_APP) !== 0;
    if (isSystem) {
      systemCount++;
    } else {
      userCount++;
      var label = app.loadLabel(pm);
      var name = label ? label.toString() : "" + app.packageName;
      userAppNames.push(name);
    }
  }

  // 尝试把用户 App 名单落地到电脑（便于 AI 用 present_files 完整展示，省 token）
  try {
    files.ensureDir(files.join(TEMP_DIR, ".ensure"));
    var ts = new Date().getTime();
    tmpFile = TEMP_DIR + "/user_apps_" + ts + ".txt";
    files.write(tmpFile, buildListText(userAppNames)); // 默认 UTF-8，中文安全
    enforceAppListCap();
    var name2 = "user_apps_" + ts + ".txt";
    var resp = uploadToPc(tmpFile, name2);
    if (resp && resp.path) {
      uploaded = true;
      result = {
        ok: 1,
        systemCount: systemCount,
        userCount: userCount,
        // 完整名单（所有用户 App 名字，未截断）始终返回，保证全部展示；
        // file 仅供下载/存档，preview 仅聊天摘要。
        userAppNames: userAppNames,
        file: resp.path,
        nameCount: userAppNames.length,
        preview: buildPreview(userAppNames, PREVIEW_LIMIT),
      };
    } else {
      // 上传发出但服务器回包异常：回退内联数组，信息不丢
      result = {
        ok: 1,
        systemCount: systemCount,
        userCount: userCount,
        userAppNames: userAppNames,
        note: "名单已生成但服务器回包异常: " + JSON.stringify(resp),
      };
    }
  } catch (upErr) {
    // 上传不可用：回退内联数组，保证用户 App 名字不丢
    result = {
      ok: 1,
      systemCount: systemCount,
      userCount: userCount,
      userAppNames: userAppNames,
      note: "名单落地电脑失败：" + upErr.toString() + "（已回退为内联数组）",
    };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
} finally {
  // 上传成功后删除手机临时文件，避免堆积
  if (uploaded && tmpFile && files.exists(tmpFile)) {
    try { files.remove(tmpFile); } catch (e2) { /* 忽略 */ }
  }
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
