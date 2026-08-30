/**
 * list_running_scripts.js - 列出手机端当前所有正在运行的 AutoJS 脚本实例
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   （无必填参数）
 *   limit {number}      选填  最多回传几条，默认 50（防异常时刷屏，非截断隐藏）
 * 输出:
 *   成功 {ok:1, count:N, engines:[{name, source, cwd, id, isSelf}]}
 *   失败 {ok:0, err:"原因"}
 *
 * 逻辑：engines.all() 遍历全部引擎 → getSource() 取源路径 → files.getName() 取基名；
 *       以「引擎 id + 临时文件名」双要素比对 myEngine，标出正在执行本任务的引擎(isSelf)。
 *       注意:判定 self 用 id+文件名,绝不用 eng === myEngine(引用相等在中继下发场景会失效)。
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

function safeCwd(eng) {
  try {
    var c = eng.cwd();
    return c == null ? "" : String(c);
  } catch (e) {
    return "";
  }
}

function safeId(eng) {
  try {
    // id 非官方稳定字段，尽力读取；非数字则忽略
    var id = eng.id;
    if (typeof id === "number") return id;
    if (typeof id === "string" && id !== "") return id;
  } catch (e) {}
  return null;
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var limit = (typeof args.limit === "number" && args.limit > 0) ? args.limit : 50;

  var myEngine = engines.myEngine();
  // 判定"自己"的双要素:引擎 id + 下发时实际执行文件的基名(如 脚本根目录(动态拼接)/tap_point.js -> tap_point.js)。
  // 严禁用 eng === myEngine(引用相等)——中继经 execScriptFile 下发子引擎时,
  // engines.all() 与 engines.myEngine() 返回的不是同一引用实例,会导致 self 永远判 false。
  var myId = (typeof myEngine.id === "number" || typeof myEngine.id === "string") ? myEngine.id : null;
  var myName = "";
  try {
    var _ms = myEngine.getSource();
    if (_ms) myName = files.getName(_ms);
  } catch (e) {
    try { var _ms2 = myEngine.source; if (_ms2) myName = files.getName(_ms2); } catch (e2) {}
  }
  var all = engines.all();
  if (!all) all = [];

  var list = [];
  for (var i = 0; i < all.length && list.length < limit; i++) {
    var eng = all[i];
    var name = "(未知)";
    var source = "";
    try {
      var src = eng.getSource();          // 如 "$remote/autojs-task-phone-client.js"
      source = src == null ? "" : String(src);
      name = files.getName(source);       // 取基名，如 "autojs-task-phone-client.js"
    } catch (e) {
      // 读源失败则该条 name 保留“(未知)”，source 置空，不中断整体
    }
    var engId = safeId(eng);
    // 双要素齐全才算"自己":id 相等 且 文件名(基名)相等。
    var isSelf = (myId !== null && engId !== null && engId === myId)
              && (myName !== "" && name !== "" && name === myName);
    var item = { name: name, source: source, cwd: safeCwd(eng), isSelf: isSelf };
    if (engId !== null) item.id = engId;
    list.push(item);
  }

  result = { ok: 1, count: list.length, engines: list };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
