/**
 * open_app.js - 按应用名打开 App
 *
 * 输入（/sdcard/脚本/task_args.json）:
 *   name {string} 必填  应用名称（如 "设置"、"浏览器"）
 * 输出:
 *   成功 {ok:1, pkg:"包名"}   失败 {ok:0, err:"原因"}
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
  if (typeof name !== "string" || !name) {
    result = { ok: 0, err: "缺少参数 name（必须是非空字符串）" };
  } else {
    var pkg = app.getPackageName(name);
    if (!pkg) {
      result = { ok: 0, err: "未找到应用: " + name };
    } else {
      app.launchPackage(pkg);
      sleep(1500);
      result = { ok: 1, pkg: pkg };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
