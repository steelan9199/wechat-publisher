/**
 * swipe.js - 滑动屏幕
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   x1 {number} 必填  起点横坐标
 *   y1 {number} 必填  起点纵坐标
 *   x2 {number} 必填  终点横坐标
 *   y2 {number} 必填  终点纵坐标
 *   duration {number} 选填  滑动时长毫秒，默认 500
 * 输出:
 *   成功 {ok:1}   失败 {ok:0, err:"原因"}
 *
 * 语法: ES5（var only）。单文件自包含。
 */

function readArgs() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  } catch (e) {
    return {};
  }
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var need = ["x1", "y1", "x2", "y2"];
  var missing = null;
  for (var i = 0; i < need.length; i++) {
    if (typeof args[need[i]] !== "number") {
      missing = need[i];
      break;
    }
  }
  if (missing) {
    result = { ok: 0, err: "缺少参数 " + missing + "（必须是数字）" };
  } else {
    var d = typeof args.duration === "number" ? args.duration : 500;
    swipe(args.x1, args.y1, args.x2, args.y2, d);
    result = { ok: 1 };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
