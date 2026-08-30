/**
 * set_clipboard.js - 向手机剪贴板写入文本
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   text {string} 必填  要写入剪贴板的文本
 * 输出:
 *   成功 {ok:1, length:N}   失败 {ok:0, err:"原因"}
 *
 * 与 get-clipboard（读）互补；配合 input-text 长按粘贴，或直接验证剪贴板链路。
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
  var text = readArgs().text;
  if (typeof text !== "string") {
    result = { ok: 0, err: "缺少参数 text（必须是字符串）" };
  } else {
    setClip(text);
    // 回读校验：写入后立即 getClip 比对，确认系统剪贴板真的吃进去了
    var back = String(getClip() != null ? getClip() : "");
    if (back === text) {
      result = { ok: 1, length: text.length };
    } else {
      result = { ok: 0, err: "写入后回读不一致（可能是系统限制），回读: " + back.slice(0, 50) };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
