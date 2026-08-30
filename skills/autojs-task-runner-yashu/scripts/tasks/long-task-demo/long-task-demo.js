/**
 * long_task_demo.js - 长任务示范模板（同时也是长任务模板的骨架范例）
 *
 * 严格 ES5。三件套：
 *   1. 参数：优先读按单参数文件 __TASK_ARGS_PATH（客户端注入的全局变量），
 *      （唯一权威源，无兜底副本）；
 *   2. 进度：每步调 __reportProgress("i/N ...")（客户端注入的全局函数），
 *      AI 侧 run_task.js --status 即见实时进度；
 *   3. 回执：exit 时按标准约定广播 {ok:1}/{ok:0,err}，客户端自动补写 taskId。
 *
 * 参数: { steps: 步数(默认4, 1~20), stepSec: 每步秒数(默认8, 1~60) }
 * 行为: 分 steps 步、每步 sleep stepSec 秒并上报进度，走完回 ok:1。
 */

// 参数：唯一权威源为任务单注入的 __TASK_ARGS_PATH（data/task-args/<taskId>.json）
var args = {};
try {
  if (typeof __TASK_ARGS_PATH === "string" && __TASK_ARGS_PATH) {
    args = JSON.parse(files.read(__TASK_ARGS_PATH));
  }
} catch (e) {
  args = {};
}

function clampInt(v, min, max, fallback) {
  var n = parseInt(v, 10);
  if (isNaN(n)) n = fallback;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

var steps = clampInt(args.steps, 1, 20, 4);
var stepSec = clampInt(args.stepSec, 1, 60, 8);

var startedAt = new Date().getTime();
var result = { ok: 0, err: "脚本未产出结果" };

try {
  for (var i = 1; i <= steps; i++) {
    if (typeof __reportProgress === "function") {
      __reportProgress(i + "/" + steps + " 步（每步 " + stepSec + " 秒）");
    }
    sleep(stepSec * 1000);
  }
  result = {
    ok: 1,
    steps: steps,
    stepSec: stepSec,
    elapsedSec: Math.round((new Date().getTime() - startedAt) / 1000),
    taskId: typeof __TASK_ID === "string" ? __TASK_ID : null,
  };
} catch (e) {
  result = { ok: 0, err: String(e) };
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
