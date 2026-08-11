/*
 * 模板名：delete_folder
 * 用途：删除手机上指定的文件夹（递归删除其内部所有内容）。
 * 参数：
 *   path (string, 必填)  要删除的文件夹绝对路径，必须位于 /sdcard 下
 *                         （兼容 files.getSdcardPath() 返回的真实路径，如 /storage/emulated/0/...）。
 * 返回：
 *   成功删除   { ok:1, deleted:true,  path, success:boolean }
 *   目标不存在 { ok:1, deleted:false, path, note:"目标不存在, 无需删除" }   （幂等）
 *   失败       { ok:0, err:"人话原因" }
 * 安全：仅允许 /sdcard 下路径，禁止删除系统目录与 sdcard 根；不可逆操作。
 * 注意：严格 ES5（var only），运行于手机 AutoJs6(Rhino) 引擎。
 */
function readArgs() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  } catch (e) {
    return {};
  }
}

var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };

// 安全护栏：只允许 /sdcard 下（及其真实路径）的路径
function safePrefix(path) {
  var sd = files.getSdcardPath();
  var prefixes = ["/sdcard/", sd + "/"];
  for (var i = 0; i < prefixes.length; i++) {
    if (path.indexOf(prefixes[i]) === 0) {
      return true;
    }
  }
  return false;
}

function isRoot(path) {
  var sd = files.getSdcardPath();
  return path === "/sdcard" || path === sd || path === "/";
}

try {
  var path = args.path;
  if (typeof path !== "string" || path.length === 0) {
    result = { ok: 0, err: "缺少参数 path（必须是字符串，要删除的文件夹绝对路径）" };
  } else if (isRoot(path)) {
    result = { ok: 0, err: "拒绝删除根目录: " + path };
  } else if (!safePrefix(path)) {
    result = { ok: 0, err: "仅允许删除 /sdcard 下路径，已拒绝: " + path };
  } else if (!files.exists(path)) {
    result = { ok: 1, deleted: false, path: path, note: "目标不存在, 无需删除" };
  } else if (!files.isDir(path)) {
    result = { ok: 0, err: "指定路径不是文件夹（是文件）: " + path + "；本模板只删文件夹" };
  } else {
    // files.removeDir(path)：递归删除文件夹及其全部内容，返回是否全部删除成功
    var okDel = files.removeDir(path);
    result = { ok: 1, deleted: true, path: path, success: okDel };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
