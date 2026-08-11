/**
 * key.js - 系统按键（返回 / 桌面 / 最近任务）
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   name {string} 必填  按键名: "back" | "home" | "recent"
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
