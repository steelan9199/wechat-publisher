/**
 * stop_script_by_name.js - 按脚本文件名停止手机端正在运行的 AutoJS 实例
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   name       {string}  必填  要停止的脚本文件名（建议带扩展名，如 "autojs-task-phone-client.js"）。
 *                             匹配规则：默认大小写不敏感；引擎源 basename 等于 name（忽略大小写），
 *                             或源路径中包含 name（忽略大小写）即视为命中。可选 caseSensitive:true 恢复大小写敏感。
 *   waitMs     {number}  选填  停止全部命中实例后、回执前等待的毫秒数，默认 800。
 *                             给旧实例释放截图权限 / WebSocket 等资源留一点时间。
 *   includeSelf {boolean}选填  是否允许连「当前正在执行的这一份引擎」也一起停，默认 false（永远保护自身）。
 *
 * 输出:
 *   成功 {ok:1, found:N, stopped:M}   N=匹配到的实例数，M=实际成功 forceStop 的数量
 *   失败 {ok:0, err:"原因"}
 *
 * 实现要点（参考 AutoJs6 引擎文档）:
 *   engines.myEngine() 取当前引擎；engines.all() 取全部运行引擎；
 *   eng.getSource() 取源路径；eng.forceStop() 强停。
 *   默认跳过"自己"(双要素:id 相等 且 文件名一致)——即便 name 等于本模板名，也不会把正在跑任务的自己杀掉。判定 self 用 id+文件名，绝不用 eng === myEngine(引用相等在中继下发场景会失效)。
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

  if (typeof args.name !== "string" || !args.name) {
    result = { ok: 0, err: "缺少参数 name（必须是字符串，如 \"autojs-task-phone-client.js\"）" };
  } else {
    var target = args.name;
    var waitMs = (typeof args.waitMs === "number" && args.waitMs >= 0) ? args.waitMs : 800;
    var includeSelf = args.includeSelf === true; // 默认 false：保护自身
    var caseSensitive = args.caseSensitive === true; // 默认 false:大小写不敏感

    var myEngine = engines.myEngine();
    // 判定"自己"的双要素:引擎 id + 下发时实际执行文件的基名(如 脚本根目录(动态拼接)/tap_point.js -> tap_point.js)。
    // 严禁用 eng === myEngine(引用相等)——中继 execScriptFile 下发子引擎时,
    // engines.all() 与 engines.myEngine() 返回的不是同一引用实例,会导致 self 永远判不到。
    var myId = (typeof myEngine.id === "number" || typeof myEngine.id === "string") ? myEngine.id : null;
    var myName = "";
    try {
      var _ms = myEngine.getSource();
      if (_ms) myName = files.getName(_ms);
    } catch (e) {
      try { var _ms2 = myEngine.source; if (_ms2) myName = files.getName(_ms2); } catch (e2) {}
    }
    var all = engines.all();
    if (!all || all.length === 0) {
      result = { ok: 1, found: 0, stopped: 0 };
    } else {
      var found = 0;
      var stopped = 0;
      var stopErrors = [];

      for (var i = 0; i < all.length; i++) {
        var eng = all[i];

        // 取本引擎的 id 与文件名(基名),供"自保护"与"命中"判定复用
        var engId = null;
        try { if (typeof eng.id === "number" || typeof eng.id === "string") engId = eng.id; } catch (e) {}
        var engName = "";
        var engSrc = "";
        try {
          var _s = eng.getSource();
          if (_s) { engSrc = String(_s); engName = files.getName(_s); }
        } catch (e) {
          try { var _s2 = eng.source; if (_s2) { engSrc = String(_s2); engName = files.getName(_s2); } } catch (e2) {}
        }

        // 自我保护：默认不停止当前正在执行的引擎(双要素:id 相等 且 文件名一致)
        // 若任一侧文件名取不到,则以 id 为准(更保守,宁可错保也不误杀自己)
        if (!includeSelf) {
          var selfById = (myId !== null && engId !== null && engId === myId);
          var selfByName = (myName !== "" && engName !== "" && engName === myName);
          if (selfById && (selfByName || myName === "" || engName === "")) {
            continue; // 认作自己,跳过
          }
        }

        // 命中判定:默认大小写不敏感;caseSensitive:true 时恢复大小写敏感
        var hit = false;
        if (caseSensitive) {
          if (engName === target) {
            hit = true;
          } else if (engSrc && engSrc.indexOf(target) !== -1) {
            hit = true; // 兜底:源路径包含目标名
          }
        } else {
          var _targetLower = target.toLowerCase();
          var _engNameLower = engName ? engName.toLowerCase() : "";
          var _engSrcLower = engSrc ? engSrc.toLowerCase() : "";
          if (_engNameLower === _targetLower) {
            hit = true;
          } else if (_engSrcLower && _engSrcLower.indexOf(_targetLower) !== -1) {
            hit = true; // 兜底:源路径包含目标名(忽略大小写)
          }
        }

        if (hit) {
          found++;
          try {
            eng.forceStop();
            stopped++;
          } catch (e) {
            stopErrors.push(e.toString());
          }
        }
      }

      if (found > 0 && stopped < found) {
        result = { ok: 1, found: found, stopped: stopped, warn: "部分实例停止失败", detail: stopErrors.join("; ") };
      } else {
        result = { ok: 1, found: found, stopped: stopped };
      }

      // 等旧实例释放资源（截图权限 / 网络等）再回执
      if (stopped > 0 && waitMs > 0) {
        sleep(waitMs);
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
