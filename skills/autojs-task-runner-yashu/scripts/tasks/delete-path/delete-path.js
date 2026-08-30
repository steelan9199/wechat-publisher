/**
 * delete_path.js - 删除手机上指定的文件或文件夹（递归）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   path {string} 必填  要删除的文件或文件夹绝对路径
 * 输出:
 *   成功删除     { ok:1, deleted:true,  type:"file"|"dir", path, success:boolean }
 *   目标不存在   { ok:1, deleted:false, path, note:"目标不存在, 无需删除" }   （幂等）
 *   失败         { ok:0, err:"人话原因" }
 *
 * 安全护栏：传入路径先经 java.io.File.getCanonicalPath() 规范化（解析符号链接
 * 别名与 ..），再与 files.getSdcardPath() 动态根比较——只放行 sdcard 存储内路径；
 * 精确根本身不匹配 "根+/" 前缀，天然拒绝整根删除。代码不写死任何路径字符串。
 * 语法: ES5（var only）。单文件自包含。
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

// 传入路径先规范化再校验，代码里不写死任何路径字符串
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

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var path = readArgs().path;
  if (typeof path !== "string" || path.length === 0) {
    result = { ok: 0, err: "缺少参数 path（必须是字符串，要删除的文件或文件夹绝对路径）" };
  } else if (isRoot(path)) {
    result = { ok: 0, err: "拒绝删除根目录: " + path };
  } else if (!safePrefix(path)) {
    result = { ok: 0, err: "仅允许删除 sdcard 存储内路径，已拒绝: " + path };
  } else if (!files.exists(path)) {
    result = { ok: 1, deleted: false, path: path, note: "目标不存在, 无需删除" };
  } else if (files.isDir(path)) {
    var okDir = files.removeDir(path);
    result = { ok: 1, deleted: true, type: "dir", path: path, success: okDir };
  } else {
    var okFile = files.remove(path);
    result = { ok: 1, deleted: true, type: "file", path: path, success: okFile };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
