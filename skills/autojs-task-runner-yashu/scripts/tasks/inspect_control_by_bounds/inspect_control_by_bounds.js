/**
 * 模板名：inspect_control_by_bounds
 * 用途：传入控件包围盒矩形 (left, top, right, bottom)，用 UiSelector.bounds() 精确匹配占据该矩形的控件，
 *       返回控件信息 + 可复用定位选择器。用于「已知某控件的精确矩形范围 → 想知道它是什么、
 *       拿稳定选择器后续操作」的多步任务。是 inspect_control 家族的「按包围盒」版本。
 * 参数（args，必填带 *）：
 *   left*   : number|string  矩形左边界 X（像素数字，或 "50%" 形式百分比，透传给 AutoJS）
 *   top*    : number|string  矩形上边界 Y
 *   right*  : number|string  矩形右边界 X
 *   bottom* : number|string  矩形下边界 Y
 * 返回示例（极简回执）：
 *   { "ok": 1, "count": 1,
 *     "control": { "className": "android.widget.TextView", "id": "com.xxx:id/title",
 *       "text": "设置", "desc": null, "clickable": true,
 *       "bounds": [100, 200, 300, 250], "packageName": "com.android.settings" },
 *     "selectors": { "id": "id(\"com.xxx:id/title\").visibleToUser(true)",
 *       "text": "text(\"设置\").visibleToUser(true)" } }
 * 说明：
 *   - bounds() 为精确矩形匹配：仅返回包围盒【完全等于】给定矩形的控件（通常 0 或 1 个）。
 *   - selectors 只给 id / text / desc 三类（带 .visibleToUser(true) 约束）；不回传 bounds 选择器，省 token。
 *   - 无命中返回 { "ok": 1, "count": 0, "control": null, "selectors": {} }。
 *   - 若想「按坐标找最深层控件」而非精确矩形，请用姐妹模板 inspect_control_by_coord。
 */

var result = { ok: 0, err: "脚本未产出结果" };

try {
  // 读取参数（统一入口，禁止写死）
  var args = JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  if (args.left === undefined || args.top === undefined ||
      args.right === undefined || args.bottom === undefined) {
    result = { ok: 0, err: "缺少参数 left / top / right / bottom（必填）" };
  } else {
    // 确保无障碍服务可用
    try { auto(); } catch (e) {}

    // 1) 用 UiSelector.bounds() 精确匹配矩形
    var all = bounds(args.left, args.top, args.right, args.bottom).find();
    var hits = [];
    for (var i = 0; i < all.size(); i++) {
      hits.push(all[i]);
    }

    if (hits.length === 0) {
      // 无命中（矩形无控件精确占据）
      result = { ok: 1, count: 0, control: null, selectors: {} };
    } else {
      // 2) 通常唯一；按 可见优先 > 包围盒最小(最深层) 挑最佳
      var best = null, bestScore = -1;
      for (var j = 0; j < hits.length; j++) {
        var n = hits[j];
        var score = 0;
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
