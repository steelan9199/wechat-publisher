/**
 * input_text.js - 向输入框输入文字
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   text {string} 必填  要输入的文字内容
 * 输出:
 *   成功 {ok:1}   失败 {ok:0, err:"原因"}
 *
 * 输入策略: 优先找已聚焦的 EditText 直接 setText；
 * 没有聚焦框则找屏幕上第一个可见 EditText 并 setText；
 * 实在找不到输入框才退化为 input() 模拟逐字键入（依赖当前焦点）。
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
  var t = args.text;
  if (typeof t !== "string" || !t) {
    result = { ok: 0, err: "缺少参数 text（必须是非空字符串）" };
  } else {
    var et = className("android.widget.EditText").focused(true).findOne(500);
    if (!et) et = className("android.widget.EditText").findOne(1500);
    if (et) {
      et.setText(t);
      result = { ok: 1 };
    } else {
      input(t);
      result = { ok: 1 };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
