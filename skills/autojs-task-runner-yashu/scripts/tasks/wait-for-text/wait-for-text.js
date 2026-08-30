/**
 * wait_for_text.js - 等待屏幕出现指定文字（条件等待，替代「盲等+截图确认」循环）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   text       {string} 必填  要等待出现的文字
 *   timeoutMs  {number} 选填  总超时毫秒，默认 10000
 *   intervalMs {number} 选填  轮询间隔毫秒，默认 500
 *   exact      {boolean} 选填  默认 false：包含匹配（textContains/descContains）；
 *                              true：精确匹配（text/desc）
 * 输出:
 *   出现   {ok:1, waitMs:N, bounds:"控件包围盒"}
 *   超时   {ok:0, err:"等待超时: xxx", timeout:true, waitMs:N}
 *
 * 策略: 每个轮询周期同时探测 无障碍 text 与 desc（contentDescription），
 *       图标按钮常只有 desc；在 deadline 内任一命中即返回。
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
  var t = args.text;
  if (typeof t !== "string" || !t) {
    result = { ok: 0, err: "缺少参数 text（必须是字符串）" };
  } else {
    var timeoutMs = typeof args.timeoutMs === "number" && args.timeoutMs > 0 ? args.timeoutMs : 10000;
    var intervalMs = typeof args.intervalMs === "number" && args.intervalMs > 0 ? args.intervalMs : 500;
    if (intervalMs > timeoutMs) intervalMs = timeoutMs;
    var exact = args.exact === true;

    var mainSel = exact ? text(t) : textContains(t);
    var descSel = exact ? desc(t) : descContains(t);
    var deadline = Date.now() + timeoutMs;
    var start = Date.now();
    var found = null;

    while (!found && Date.now() < deadline) {
      found = mainSel.exists() ? mainSel.findOne(0) : null;
      if (!found) found = descSel.exists() ? descSel.findOne(0) : null;
      if (!found) sleep(intervalMs);
    }

    if (found) {
      var b = "";
      try { b = String(found.bounds()); } catch (eB) { b = ""; }
      result = { ok: 1, waitMs: Date.now() - start, bounds: b };
    } else {
      result = {
        ok: 0,
        err: "等待超时(" + timeoutMs + "ms): " + t,
        timeout: true,
        waitMs: Date.now() - start,
      };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
