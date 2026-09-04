/**
 * list-running-scripts.js - 列出手机端当前所有正在运行的 AutoJS 脚本实例（原始字段版）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   limit {number}  选填  最多回传几条，默认 50（防异常时刷屏；真实总数永远由 total 如实报告）
 * 输出:
 *   成功 {ok:1, count:N, total:M, engines:[{id, source, cwd, isSelf}]}
 *        count=本次回传条数，total=engines.all() 真实总数；被 limit 截断时 count<total，一眼可见
 *   失败 {ok:0, err:"原因"}
 *
 * 只回原始字段，不做任何派生（已删除旧的 name 派生字段）：
 *   id     : eng.id        → number（与 eng.getId() 等价）。全局自增、进程内不复用；
 *                           ⚠ APP 进程重启后归零重发号，只作瞬时标识，不可跨会话持久化使用
 *   source : eng.source    → String() 后为源路径。文件脚本=绝对路径；字符串脚本=$engine/名称.js
 *   cwd    : eng.cwd()     → 工作目录。工程脚本=工程目录；客户端下发的单脚本=客户端目录
 *   isSelf : 仅按 id 单要素比对，不掺文件名。
 *
 * 为什么 isSelf 不用「id + 文件名」双要素（2026-09-04 真机实测结论）：
 *   实测抓到 id=11 与 id=12 两个引擎，source、cwd 完全相同（同一工程重复启动）。
 *   文件名在这种场景下无法区分实例，作为 AND 的第二要素只会平添漏判风险——
 *   一旦 source 读取异常，AND 逻辑会把「自己」判成非自己。同进程同一时刻 id 唯一，
 *   单要素即可。myId 取不到时全部置 isSelf:false（保守，宁可不标也不误标）。
 *
 * 取值依据：三场景（单脚本 / 工程 / 字符串脚本）共 9 个引擎样本实测，id/source/cwd 100% 可得。
 * 详见 references/引擎_self_识别与isSelf判定.md。
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

// 引擎 id：实测为 number，与 getId() 等价；只收 number / 非空 string，其余当 null
function safeId(eng) {
  try {
    var id = eng.id;
    if (typeof id === "number") return id;
    if (typeof id === "string" && id !== "") return id;
  } catch (e) {}
  return null;
}

// 引擎源路径：优先 .source 属性（实测恒可得，返回 Java 对象需 String 转换），异常回退官方 getSource()
function safeSource(eng) {
  try {
    var s = eng.source;
    if (s !== null && s !== undefined) return String(s);
  } catch (e) {}
  try {
    var s2 = eng.getSource();
    if (s2 !== null && s2 !== undefined) return String(s2);
  } catch (e2) {}
  return null;
}

// 工作目录：官方 cwd()；实测恒返回字符串（工程=工程目录，单脚本=客户端目录）
function safeCwd(eng) {
  try {
    var c = eng.cwd();
    if (c === null || c === undefined) return null;
    return String(c);
  } catch (e) {
    return null;
  }
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var limit = (typeof args.limit === "number" && args.limit > 0) ? args.limit : 50;

  var myEngine = engines.myEngine();
  // 判定"自己"只用 id 单要素。
  // 严禁用 eng === myEngine(引用相等)——中继经 execScriptFile 下发子引擎时,
  // engines.all() 与 engines.myEngine() 返回的不是同一引用实例,会导致 self 永远判 false。
  var myId = safeId(myEngine);

  var all = engines.all();
  if (!all) all = [];
  var total = all.length;

  var list = [];
  for (var i = 0; i < all.length && list.length < limit; i++) {
    var eng = all[i];
    var engId = safeId(eng);
    // myId 取不到(null)时一律 isSelf:false——同进程内 id 唯一,单要素足够,
    // 掺入文件名只会引入漏判(把自识别成非自己)风险。
    var isSelf = (myId !== null && engId !== null && engId === myId);
    list.push({
      id: engId,
      source: safeSource(eng),
      cwd: safeCwd(eng),
      isSelf: isSelf
    });
  }

  result = { ok: 1, count: list.length, total: total, engines: list };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
