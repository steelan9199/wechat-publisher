/*
 * 模板名：delete_folder
 * 用途：删除手机上指定的文件夹（递归删除其内部所有内容）。
 * 参数：
 *   path (string, 必填)  要删除的文件夹绝对路径，必须位于 sdcard 存储内
 *                         （传入路径会先规范化：解析符号链接与 .. 后再校验；
 *                          校验基准取 files.getSdcardPath() 动态返回的真实根）。
 * 返回：
 *   成功删除   { ok:1, deleted:true,  path, success:boolean }
 *   目标不存在 { ok:1, deleted:false, path, note:"目标不存在, 无需删除" }   （幂等）
 *   失败       { ok:0, err:"人话原因" }
 * 安全：仅允许 sdcard 存储内路径，禁止删除系统目录与 sdcard 根；不可逆操作。
 * 注意：严格 ES5（var only），运行于手机 AutoJs6(Rhino) 引擎。
 */
function readArgs() {
  // 参数唯一权威源：任务单注入的 __TASK_ARGS_PATH（scripts-from-computer/data/task-args/<taskId>.json）
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}

var args = readArgs();
var result = { ok: 0, err: "脚本未产出结果" };

// 安全护栏：传入路径先规范化（java.io.File.getCanonicalPath 会解析 /sdcard 等符号
// 链接与 .. 归一到真实物理路径），再与 getSdcardPath() 动态根比较——代码里不写死任何路径字符串
function canonicalPath(p) {
  try {
    return String(new java.io.File(p).getCanonicalPath());
  } catch (e) {
    return String(p);
  }
}

function safePrefix(path) {
  var sd = files.getSdcardPath();
  return canonicalPath(path).indexOf(sd + "/") === 0;
}

function isRoot(path) {
  var sd = files.getSdcardPath();
  var n = canonicalPath(path);
  return n === sd || n === "/";
}

try {
  var path = args.path;
  if (typeof path !== "string" || path.length === 0) {
    result = { ok: 0, err: "缺少参数 path（必须是字符串，要删除的文件夹绝对路径）" };
  } else if (isRoot(path)) {
    result = { ok: 0, err: "拒绝删除根目录: " + path };
  } else if (!safePrefix(path)) {
    result = { ok: 0, err: "仅允许删除 sdcard 存储内路径，已拒绝: " + path };
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
