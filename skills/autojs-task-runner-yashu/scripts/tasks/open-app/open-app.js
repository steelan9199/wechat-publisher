/**
 * open_app.js - 打开 App（支持应用名或包名）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   name {string} 选填  应用名称（如 "设置"）——经 getPackageName 解析，受系统语言/别名影响
 *   pkg  {string} 选填  应用包名（如 "com.android.settings"）——直接 launch，最稳
 *   （name / pkg 二选一；都传时 pkg 优先）
 * 输出:
 *   成功 {ok:1, pkg:"包名", via:"pkg"|"name"}   失败 {ok:0, err:"原因"}
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
  var name = typeof args.name === "string" ? args.name : "";
  var pkg = typeof args.pkg === "string" ? args.pkg : "";

  if (!name && !pkg) {
    result = { ok: 0, err: "缺少参数 name 或 pkg（二选一，非空字符串）" };
  } else if (pkg) {
    // 包名直启：不经名称解析，不受 MIUI 别名/系统语言影响
    if (!app.launch(pkg)) {
      result = { ok: 0, err: "包名未安装或启动失败: " + pkg };
    } else {
      sleep(1500);
      result = { ok: 1, pkg: pkg, via: "pkg" };
    }
  } else {
    var resolved = app.getPackageName(name);
    if (!resolved) {
      result = { ok: 0, err: "未找到应用: " + name + "（可改传 pkg 包名直启）" };
    } else {
      app.launchPackage(resolved);
      sleep(1500);
      result = { ok: 1, pkg: resolved, via: "name" };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
