/**
 * key.js - 系统按键（返回 / 桌面 / 最近任务）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   name {string} 必填  按键名: "back" | "home" | "recent"
 * 输出:
 *   成功 {ok:1}   失败 {ok:0, err:"原因"}
 *
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

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var name = args.name;
  if (name === "back") {
    back();
    result = { ok: 1 };
  } else if (name === "home") {
    home();
    result = { ok: 1 };
  } else if (name === "recent") {
    recents();
    result = { ok: 1 };
  } else {
    result = { ok: 0, err: '缺少参数 name 或取值非法（只支持 "back"/"home"/"recent"）' };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
