/**
 * stop-script-by-id.js - 按引擎 id 精确停止手机端正在运行的 AutoJS 实例
 * （由 stop-script-by-name 重命名而来：名字不是唯一标识，无法区分重名实例，故改为按 id 精确操作）
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   ids         {array|number} 必填 要停止的引擎 id。传数组 [11,12] 或单个数字 11 均可。
 *                              id 从 list-running-scripts 回执的 id 字段取得。
 *   includeSelf {boolean}      选填 是否允许连「当前正在执行的这一份引擎」也一起停，默认 false（永远保护自身）。
 *   waitMs      {number}       选填 停止后、回执前等待的毫秒数，默认 800。
 *                              给旧实例释放截图权限 / WebSocket 等资源留一点时间。
 * 输出:
 *   成功 {ok:1, found:N, stopped:M, missedIds:[...], detail:{stopped:[{id,source}], skipped:[{id,source,reason}]}}
 *        found=匹配到的实例数，stopped=实际成功 forceStop 的数量
 *        missedIds=传入但未匹配上任何运行中引擎的 id
 *   失败 {ok:0, err:"原因"}
 *
 * 为什么按 id 而不是按名字（2026-09-04 真机实测结论）:
 *   实测抓到 id=11 与 id=12 两个引擎，source、cwd 完全相同（同一工程被重复启动）。
 *   按名字匹配时，这两个只能「一起停」或「一起留」，没有中间选项。
 *   id 是引擎唯一编号，是区分重复实例、实现精确点杀的唯一依据。
 *
 * 安全护栏:
 *   1. 自保护优先：默认跳过自身引擎（id 单要素比对）。
 *   2. myEngine 的 id 取不到时，自保护将失效（无法判断哪个是自己）→ 此时**整体放弃停止**并报错，
 *      绝不冒险遍历强停（宁可不停，绝不自杀）。
 *   3. 一个 id 都没匹配上 → 回 {ok:0, err}，明确告知失败，避免调用方误以为已停止。
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

// 引擎源路径：优先 .source 属性（返回 Java 对象需 String 转换），异常回退官方 getSource()
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

// 归一化 id 为字符串：JSON 传参可能是 number 也可能是 "11"，统一成 "11" 再比较，
// 避免 11 与 "11" 判不相等（id 恒为整数，不存在补零歧义）
function normId(v) {
  try {
    return String(v);
  } catch (e) {
    return null;
  }
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();

  // ---- 参数校验：ids 必填 ----
  var rawIds = args.ids;
  var idList = null;
  if (typeof rawIds === "number") {
    idList = [rawIds]; // 宽容：单个数字自动包成数组
  } else if (rawIds && typeof rawIds === "object" && typeof rawIds.length === "number") {
    idList = rawIds;
  }

  if (!idList || idList.length === 0) {
    result = { ok: 0, err: "缺少参数 ids（引擎 id，数组如 [11] 或单个数字如 11）。id 从 list-running-scripts 回执的 id 字段取得" };
  } else {
    // 目标 id 集合（归一化成字符串）
    var targets = [];
    for (var k = 0; k < idList.length; k++) {
      var nid = normId(idList[k]);
      if (nid !== null && nid !== "" && targets.indexOf(nid) === -1) targets.push(nid);
    }
    if (targets.length === 0) {
      result = { ok: 0, err: "参数 ids 中没有有效 id（收到: " + JSON.stringify(idList) + "）" };
    } else {
      var waitMs = (typeof args.waitMs === "number" && args.waitMs >= 0) ? args.waitMs : 800;
      var includeSelf = args.includeSelf === true; // 默认 false：保护自身

      var myEngine = engines.myEngine();
      var myId = safeId(myEngine);

      // 安全护栏 2：认不出自己就绝不动手。
      // 严禁用 eng === myEngine(引用相等)——中继经 execScriptFile 下发子引擎时,
      // engines.all() 与 engines.myEngine() 返回的不是同一引用实例,会导致 self 永远判不到。
      if (!includeSelf && myId === null) {
        result = {
          ok: 0,
          err: "无法识别自身引擎 id（engines.myEngine().id 取不到），自保护失效风险，已放弃停止。如确需继续请显式传 includeSelf:true"
        };
      } else {
        var all = engines.all();
        if (!all || all.length === 0) {
          // 一个引擎都没有 → 必然匹配不到 → 按未命中处理
          result = {
            ok: 0,
            err: "当前没有任何运行中的引擎，未匹配到 id=" + JSON.stringify(idList)
          };
        } else {
          var found = 0;        // 匹配到的实例数（含被自保护跳过的）
          var stopped = 0;      // 实际强停成功的数量
          var stopErrors = [];
          var detailStopped = [];
          var detailSkipped = [];

          for (var i = 0; i < all.length; i++) {
            var eng = all[i];
            var engId = safeId(eng);
            if (engId === null) continue; // 认不出 id 的引擎无法安全判定，一律跳过

            if (targets.indexOf(normId(engId)) === -1) continue; // 不在目标 id 列表里

            found++;

            // 安全护栏 1：自保护（id 单要素，实测同进程内 id 唯一）
            if (!includeSelf && normId(engId) === normId(myId)) {
              detailSkipped.push({ id: engId, source: safeSource(eng), reason: "self" });
              continue;
            }

            try {
              eng.forceStop();
              stopped++;
              detailStopped.push({ id: engId, source: safeSource(eng) });
            } catch (e) {
              stopErrors.push("id=" + engId + " 停止失败: " + e.toString());
              detailSkipped.push({ id: engId, source: safeSource(eng), reason: "forceStop_error" });
            }
          }

          // 计算哪些传入 id 完全没匹配上
          var missedIds = [];
          for (var t = 0; t < targets.length; t++) {
            var hit = false;
            for (var d = 0; d < detailStopped.length; d++) {
              if (normId(detailStopped[d].id) === targets[t]) { hit = true; break; }
            }
            if (!hit) {
              for (var s = 0; s < detailSkipped.length; s++) {
                if (normId(detailSkipped[s].id) === targets[t]) { hit = true; break; }
              }
            }
            if (!hit) missedIds.push(idList[t]);
          }

          // 安全护栏 3：一个都没匹配上 → 明确失败
          if (found === 0) {
            result = {
              ok: 0,
              err: "未匹配到任何运行中的引擎 id=" + JSON.stringify(idList) + "（可能已自行退出，或 id 在 APP 重启后已失效）"
            };
          } else {
            result = {
              ok: 1,
              found: found,
              stopped: stopped,
              detail: { stopped: detailStopped, skipped: detailSkipped }
            };
            if (missedIds.length > 0) result.missedIds = missedIds;
            if (stopped < found) {
              result.warn = "有实例未能停止（含被自保护跳过或 forceStop 报错），详见 detail";
              if (stopErrors.length > 0) result.detailErrors = stopErrors.join("; ");
            }
          }

          // 等旧实例释放资源（截图权限 / 网络等）再回执
          if (stopped > 0 && waitMs > 0) {
            sleep(waitMs);
          }
        }
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
