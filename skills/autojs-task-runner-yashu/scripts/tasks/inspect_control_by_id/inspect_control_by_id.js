/**
 * 模板名：inspect_control_by_id
 * 用途：传入控件 id（resource-id，如 "com.xxx:id/title"），在整棵 UI 树里按 id 查找控件，
 *       返回命中控件信息 + 可复用定位选择器。用于「知道某控件 id → 想确认它是什么、
 *       拿稳定选择器后续操作」的多步任务。是 inspect_control_by_coord / by_text 的「按 id」版本。
 * 参数（args，必填带 *）：
 *   id*       : string   要匹配的控件 id（resource-id）
 *   exact     : boolean  可选，默认 false。true=精确相等；false=包含(模糊)匹配，对英文字母大小写不敏感
 * 返回示例（极简回执）：
 *   { "ok": 1, "count": 1,
 *     "control": { "className": "android.widget.TextView", "id": "com.xxx:id/title",
 *       "text": "设置", "desc": null, "clickable": true,
 *       "bounds": [100, 200, 300, 250], "packageName": "com.xxx" },
 *     "selectors": { "id": "id(\"com.xxx:id/title\").visibleToUser(true)",
 *       "text": "text(\"设置\").visibleToUser(true)" } }
 * 说明：
 *   - 命中多个时，按「精确优先 > 可见优先 > 包围盒最小(最深层)」挑一个作为 control 返回，并附 count 提示歧义。
 *   - selectors 只给 id / text / desc 三类（带 .visibleToUser(true) 约束）；不回传 bounds 选择器，省 token。
 *   - 无任何命中返回 { "ok": 1, "count": 0, "control": null, "selectors": {} }。
 *   - 拉取整棵 UI 树在复杂界面可能稍慢，属正常现象。
 */

var result = { ok: 0, err: "脚本未产出结果" };

try {
  // 读取参数（统一入口，禁止写死）
  var args = JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  if (typeof args.id !== "string" || args.id.length === 0) {
    result = { ok: 0, err: "缺少参数 id（必须为非空字符串）" };
  } else {
    // 确保无障碍服务可用
    try { auto(); } catch (e) {}

    var term = args.id;
    var exact = args.exact === true;
    var termLower = term.toLowerCase();

    // 1) 拉取整棵 UI 树，按 id 匹配
    var all = classNameMatches(/.*/).find();
    var hits = [];
    for (var i = 0; i < all.size(); i++) {
      var node = all[i];
      // 限制：仅考虑对用户可见的控件，排除离屏/翻转包围盒（如多桌面页相邻页）的实例
      if (!node.visibleToUser()) continue;
      var idv = node.id();
      var idMatch = false;
      if (exact) {
        if (idv === term) idMatch = true;
      } else {
        if (idv != null && idv.toLowerCase().indexOf(termLower) >= 0) idMatch = true;
      }
      if (idMatch) {
        // 记录是否为精确命中，供挑选最佳时使用
        hits.push({ node: node, exactHit: (idMatch && exact) });
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
