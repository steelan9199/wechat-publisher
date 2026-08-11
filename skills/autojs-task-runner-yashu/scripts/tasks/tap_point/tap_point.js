/**
 * tap_point.js - 点按屏幕坐标
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   x {number} 必填  横坐标
 *   y {number} 必填  纵坐标
 * 输出:
 *   成功 {ok:1}   失败 {ok:0, err:"原因"}
 *
 * 语法: ES5（var only）。单文件自包含，工具函数直接内联。
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
  if (typeof args.x !== "number" || typeof args.y !== "number") {
    result = { ok: 0, err: "缺少参数 x 或 y（必须是数字）" };
  } else {
    click(args.x, args.y);
    result = { ok: 1 };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
