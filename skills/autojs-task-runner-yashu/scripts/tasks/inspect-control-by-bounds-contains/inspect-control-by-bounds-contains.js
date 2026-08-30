/**
 * 模板名：inspect_control_by_bounds_contains
 * 用途：传入矩形 (left, top, right, bottom)，用 UiSelector.boundsContains() 匹配「包围盒【完全包含】该矩形」的控件，
 *       返回最佳命中控件信息 + 可复用定位选择器。用于「给定一个区域/点，想知道是哪个大控件罩着它、拿最具体那个的稳定选择器」。
 *       是 inspect_control 家族的「按区域(包含)」版本；与 by_bounds(精确矩形) 不同，这里是区域包含语义，通常匹配多个(祖先链)。
 * 参数（args，必填带 *，选填带 ?）：
 *   left*   : number|string  矩形左边界 X（像素数字，或 "50%" 形式百分比，透传给 AutoJS）
 *   top*    : number|string  矩形上边界 Y
 *   right*  : number|string  矩形右边界 X
 *   bottom* : number|string  矩形下边界 Y
 *   returnAll? : boolean     默认 false。true 时额外回 controls 数组（区域中最对口的 ≤10 个控件，按选择器可用性排序）
 * 返回示例（极简回执）：
 *   // returnAll:false（默认）——只回最佳 1 个，count 为区域真实总数
 *   { "ok": 1, "count": 12,
 *     "control": { "className": "android.widget.FrameLayout", "id": "com.xxx:id/container",
 *       "text": null, "desc": null, "clickable": false,
 *       "bounds": [0, 192, 1080, 1728], "packageName": "com.xxx" },
 *     "selectors": { "id": "id(\"com.xxx:id/container\").visibleToUser(true)" } }
 *   // returnAll:true——额外回 controls（≤10，count 仍为区域真实总数 12）
 *   { "ok": 1, "count": 12, "control": {...}, "selectors": {...},
 *     "controls": [ { "control": {...}, "selectors": {...} }, ... ] }
 * 说明：
 *   - boundsContains() 为「区域包含」匹配：控件矩形须完全罩住给定矩形（含 left==right、top==bottom 的线/点区域），通常命中多个(祖先链)。
 *   - 排序规则（挑最对口）：选择器可用性优先 有 id > 有 text > 有 desc > clickable；同层内 可见优先 > 包围盒最小(最深层) 破平。
 *   - returnAll:false 只回最佳 1 个（省 token）；returnAll:true 回最对口的 ≤10 个（封顶 10，绝不 dump 全量）。
 *   - selectors 只给 id / text / desc 三类（带 .visibleToUser(true) 约束）；不回传 bounds 选择器，省 token。
 *   - 无命中返回 { "ok": 1, "count": 0, "control": null, "selectors": {} }。
 */

var result = { ok: 0, err: "脚本未产出结果" };

try {
  // 读取参数（唯一权威源：任务单注入的 __TASK_ARGS_PATH）
    var args = {};
    try {
      if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
        args = JSON.parse(files.read(__TASK_ARGS_PATH));
      }
    } catch (eArgs) {}
  if (args.left === undefined || args.top === undefined ||
      args.right === undefined || args.bottom === undefined) {
    result = { ok: 0, err: "缺少参数 left / top / right / bottom（必填）" };
  } else {
    var returnAll = !!args.returnAll;
    try { auto(); } catch (e) {}

    var all = boundsContains(args.left, args.top, args.right, args.bottom).find();
    var hits = [];
    for (var i = 0; i < all.size(); i++) {
      hits.push(extract(all[i]));
    }

    if (hits.length === 0) {
      result = { ok: 1, count: 0, control: null, selectors: {} };
    } else {
      hits.sort(cmp);
      var best = hits[0];
      var control = publicControl(best);
      var selectors = buildSelectors(best);
      result = { ok: 1, count: hits.length, control: control, selectors: selectors };
      if (returnAll) {
        var list = [];
        var lim = hits.length < 10 ? hits.length : 10;
        for (var k = 0; k < lim; k++) {
          var c = hits[k];
          list.push({ control: publicControl(c), selectors: buildSelectors(c) });
        }
        result.controls = list;
      }
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}

function extract(n) {
  var b = n.bounds();
  return {
    className: n.className(),
    id: n.id(),
    text: n.text(),
    desc: n.desc(),
    clickable: n.clickable(),
    bounds: [b.left, b.top, b.right, b.bottom],
    packageName: n.packageName(),
    visible: n.visibleToUser(),
    area: (b.right - b.left) * (b.bottom - b.top)
  };
}

function publicControl(c) {
  return {
    className: c.className,
    id: c.id,
    text: c.text,
    desc: c.desc,
    clickable: c.clickable,
    bounds: c.bounds,
    packageName: c.packageName
  };
}

function buildSelectors(c) {
  var vis = ".visibleToUser(true)";
  var s = {};
  if (c.id) s.id = 'id("' + c.id + '")' + vis;
  if (c.text) s.text = 'text("' + c.text + '")' + vis;
  if (c.desc) s.desc = 'desc("' + c.desc + '")' + vis;
  return s;
}

function tier(c) {
  if (c.id) return 4;
  if (c.text) return 3;
  if (c.desc) return 2;
  if (c.clickable) return 1;
  return 0;
}

function cmp(a, b) {
  var ta = tier(a), tb = tier(b);
  if (ta !== tb) return tb - ta;
  var va = a.visible ? 1 : 0, vb = b.visible ? 1 : 0;
  if (va !== vb) return vb - va;
  return a.area - b.area;
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
