/**
 * 模板名：inspect_control_by_text
 * 用途：传入要匹配的文字 term，在整棵 UI 树里按【text 或 desc(contentDescription)】查找控件，
 *       返回命中控件信息 + 可复用定位选择器。用于「知道某控件上写的字 → 想知道它是什么、
 *       拿稳定选择器后续操作」的多步任务。是 inspect_control_by_coord 的「按文字」版本。
 * 参数（args，必填带 *）：
 *   text*     : string   要匹配的文字（同时匹配控件的 text 与 desc）
 *   exact     : boolean  可选，默认 false。true=精确相等；false=包含(模糊)匹配，对英文字母大小写不敏感
 * 返回示例（极简回执）：
 *   { "ok": 1, "count": 1,
 *     "control": { "className": "android.widget.Button", "id": "com.xxx:id/ok_btn",
 *       "text": "确定", "desc": null, "clickable": true,
 *       "bounds": [100, 200, 300, 250], "packageName": "com.xxx" },
 *     "selectors": { "id": "id(\"com.xxx:id/ok_btn\").visibleToUser(true)",
 *       "text": "text(\"确定\").visibleToUser(true)" } }
 * 说明：
 *   - 命中多个时，按「精确优先 > 可见优先 > 包围盒最小(最深层)」挑一个作为 control 返回，并附 count 提示歧义。
 *   - selectors 只给 id / text / desc 三类（带 .visibleToUser(true) 约束）；不回传 bounds 选择器，省 token。
 *   - 无任何命中返回 { "ok": 1, "count": 0, "control": null, "selectors": {} }。
 *   - 拉取整棵 UI 树在复杂界面可能稍慢，属正常现象。
 */

var result = { ok: 0, err: "脚本未产出结果" };

try {
  // 读取参数（统一入口，禁止写死）
  // 读取参数（唯一权威源：任务单注入的 __TASK_ARGS_PATH）
    var args = {};
    try {
      if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
        args = JSON.parse(files.read(__TASK_ARGS_PATH));
      }
    } catch (eArgs) {}
  if (typeof args.text !== "string" || args.text.length === 0) {
    result = { ok: 0, err: "缺少参数 text（必须为非空字符串）" };
  } else {
    // 确保无障碍服务可用
    try { auto(); } catch (e) {}

    var term = args.text;
    var exact = args.exact === true;
    var termLower = term.toLowerCase();

    // 1) 拉取整棵 UI 树，按 text / desc 匹配
    var all = classNameMatches(/.*/).find();
    var hits = [];
    for (var i = 0; i < all.size(); i++) {
      var node = all[i];
      var t = node.text();
      var d = node.desc();
      var tMatch = false, dMatch = false;
      if (exact) {
        if (t === term) tMatch = true;
        if (d === term) dMatch = true;
      } else {
        if (t != null && t.toLowerCase().indexOf(termLower) >= 0) tMatch = true;
        if (d != null && d.toLowerCase().indexOf(termLower) >= 0) dMatch = true;
      }
      if (tMatch || dMatch) {
        // 记录是否为精确命中，供挑选最佳时使用
        hits.push({ node: node, exactHit: (tMatch && exact) || (dMatch && exact) });
      }
    }

    if (hits.length === 0) {
      // 无命中
      result = { ok: 1, count: 0, control: null, selectors: {} };
    } else {
      // 2) 挑最佳：精确命中优先 > 可见优先 > 包围盒最小(最深层)
      var best = null, bestScore = -1;
      for (var j = 0; j < hits.length; j++) {
        var h = hits[j];
        var n = h.node;
        var score = 0;
        if (h.exactHit) score += 100;
        if (n.visibleToUser()) score += 10;
        var b = n.bounds();
        var area = (b.right - b.left) * (b.bottom - b.top);
        // 包围盒越小分数越高（最深层优先），作为 0~10 区间的微调
        score += (1000000 - area) / 100000;
        if (score > bestScore) { bestScore = score; best = n; }
      }

      // 3) 抽取关键特征
      var bb = best.bounds();
      var control = {
        className: best.className(),
        id: best.id(),
        text: best.text(),
        desc: best.desc(),
        clickable: best.clickable(),
        bounds: [bb.left, bb.top, bb.right, bb.bottom],
        packageName: best.packageName()
      };

      // 4) 生成可复用定位选择器（id > text > desc 优先级；均带可见性约束）
      var vis = ".visibleToUser(true)";
      var selectors = {};
      if (control.id) {
        selectors.id = 'id("' + control.id + '")' + vis;
      }
      if (control.text) {
        selectors.text = 'text("' + control.text + '")' + vis;
      }
      if (control.desc) {
        selectors.desc = 'desc("' + control.desc + '")' + vis;
      }

      result = { ok: 1, count: hits.length, control: control, selectors: selectors };
    }
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}

events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
