/**
 * wait.js - 等待（用于等界面加载 / 动画结束后再走下一步）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   ms {number} 必填  等待毫秒数
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
  if (typeof args.ms !== "number" || args.ms < 0) {
    result = { ok: 0, err: "缺少参数 ms（必须是非负数字）" };
  } else {
    sleep(args.ms);
    result = { ok: 1 };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
