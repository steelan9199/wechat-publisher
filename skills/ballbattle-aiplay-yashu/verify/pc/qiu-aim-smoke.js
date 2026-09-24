/*
 * qiu-aim-smoke.js —— 决策层冒烟测试（纯 Node，无需 AutoJS/手机）
 *
 * 为什么需要它：2026-09-25 把 main.js#computeAim 抽到 lib/aim.js 之后，决策层第一次有了
 * **可直接执行的单元测试**（感知层早有同款：qiu-vision-smoke.js）。测的是**生产真代码**，
 * 不是复刻实现。改 lib/aim.js 后必跑：
 *
 *   node verify/pc/qiu-aim-smoke.js
 *
 * 覆盖两件事：
 *   ① 数学正确：追吃打分（gap/value/MIN_GAP 夹取）、威胁 danger、边界按轴斥力、绕圈兜底、
 *      权重为 0 的短路、分解向量与原始向量自洽。
 *   ② 可观测性：**"旁边有小球也不去吃"必须在分解里看得见**——即同一帧里
 *      `eat_best`（实际追的）与 `near_edible`（最近的可吃球）可以不同名，
 *      而当最近球不可吃时，`near_any.edible=0` + ratio 必须如实记录。
 *      （这是主线排查的判据，测试守它不被改坏。）
 */
var path = require("path");
var conf = require("../../scripts/autojs-project/ballbattle-aiplay/config");
var CFG = conf.CFG;
var aim = require("../../scripts/autojs-project/ballbattle-aiplay/lib/aim");

var fails = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS " + msg); }
  else { fails++; console.log("FAIL " + msg); }
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol); }

/** 造一颗球：dx/dy 相对自己球，r 屏幕px，ratio/r 自动一致 */
function ball(dx, dy, r, selfR, extra) {
  var dist = Math.round(Math.sqrt(dx * dx + dy * dy));
  var ratio = Math.round((r / selfR) * 100) / 100;
  var o = {
    dx: Math.round(dx), dy: Math.round(dy), dist: dist, r: r,
    size_ratio: ratio, r_area: r, r_ref: 0,
    skin: 0, refined: 0,
    edible: ratio < CFG.EAT_RATIO_THRESHOLD,
    threat: ratio > CFG.THREAT_RATIO_THRESHOLD,
    vx: null, vy: null, kind: "unknown"
  };
  if (extra) { for (var k in extra) { o[k] = extra[k]; } }
  return o;
}
function st(selfR, balls, bounds, stats) {
  return {
    self: { x: 1600, y: 720, r: selfR, n: 1, pieces: [{ dx: 0, dy: 0, r: selfR }] },
    balls: balls,
    bounds: bounds || { left: 3000, right: 3000, top: 3000, bottom: 3000 },
    stats: stats || { clusters: balls.length + 1, balls_precap: balls.length, max_balls: CFG.MAX_BALLS, noise_dropped: 0, ui_dropped: 0 }
  };
}
var W = { wEat: 1.0, wAvoid: 1.4, wEdge: 0.8 };
var PREV = { x: 1, y: 0 };

// ---- A. 单个可吃球：被选中、gap/value 正确、方向指向它 ----
(function () {
  var s = st(200, [ball(500, 0, 100, 200)]);          // gap = 500-200-100 = 200, val = 100/200 = 0.5
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.eat_n === 1 && d.dbg.eat_best && d.dbg.eat_best.i === 0, "A1 唯一可吃球被选中 (eat_n=" + d.dbg.eat_n + ")");
  assert(d.dbg.eat_best.gap === 200, "A2 gap=表面间距 200 (got " + d.dbg.eat_best.gap + ")");
  assert(near(d.dbg.eat_best.val, 0.5, 0.01), "A3 value=r/gap=0.5 (got " + d.dbg.eat_best.val + ")");
  assert(d.dbg.eat_best === d.dbg.near_edible, "A4 唯一可吃球同时是 near_edible");
  assert(near(d.vx, 1, 1e-6) && near(d.vy, 0, 1e-6), "A5 原始向量指向 +x (got " + d.vx.toFixed(4) + "," + d.vy.toFixed(4) + ")");
  assert(d.dbg.patrol === 0, "A6 有目标 ⇒ 不绕圈");
})();

// ---- B. MIN_GAP 夹取：表面间距为 0（贴脸）时用 MIN_GAP ----
(function () {
  var s = st(200, [ball(300, 0, 100, 200)]);          // gap 原为 0 ⇒ 夹到 MIN_GAP=8
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.eat_best.gap === CFG.MIN_GAP, "B1 gap 夹取到 MIN_GAP=" + CFG.MIN_GAP + " (got " + d.dbg.eat_best.gap + ")");
  assert(near(d.dbg.eat_best.val, 100 / CFG.MIN_GAP, 0.01), "B2 value=r/MIN_GAP (got " + d.dbg.eat_best.val + ")");
})();

// ---- C. ⭐ 可观测性核心：追的是远大可吃球，旁边的近小球同时被记下来 ----
(function () {
  // self.r=100；近小 dist=250 r=20 ⇒ gap=130 val=0.154；远大 dist=600 r=90 ⇒ gap=410 val=0.220
  // （远大那颗 ratio=0.90 仍可吃、尚未到 1.02 威胁线 ⇒ 两颗都进候选，价值大的赢）
  var s = st(100, [ball(250, 0, 20, 100), ball(600, 0, 90, 100)]);
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.eat_n === 2, "C1 两个可吃候选都被记下 (eat_n=" + d.dbg.eat_n + ")");
  assert(d.dbg.eat_best.i === 1, "C2 追吃按 value 最大 ⇒ 选中**远大**那颗 (i=" + d.dbg.eat_best.i + ")");
  assert(d.dbg.near_edible && d.dbg.near_edible.i === 0, "C3 near_edible 记的是**旁边的小球** (i=" + (d.dbg.near_edible ? d.dbg.near_edible.i : "null") + ")");
  assert(d.dbg.eat_top.length === 2 && d.dbg.eat_top[0].i === 1 && d.dbg.eat_top[1].i === 0, "C4 eat_top 按 value 降序");
  assert(d.dbg.near_any && d.dbg.near_any.i === 0, "C5 near_any=最近球=近小那颗");
  assert(d.dbg.near_any.edible === 1, "C6 near_any 如实带 edible 标记");
})();

// ---- D. ⭐ 最近球**不可吃**（ratio≥EAT）：必须看得见它是被阈值挡的 ----
(function () {
  var s = st(200, [ball(400, 0, 200, 200)]);          // ratio=1.00 ⇒ edible=0, threat=0（死区）
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.eat_n === 0 && d.dbg.eat_best === null, "D1 无可吃候选 ⇒ eat_best=null");
  assert(d.dbg.near_any && d.dbg.near_any.i === 0 && d.dbg.near_any.edible === 0, "D2 near_any 记下「看见了但不可吃」");
  assert(near(d.dbg.near_any.ratio, 1.0, 0.005), "D3 near_any.ratio=1.00 如实记录 (got " + d.dbg.near_any.ratio + ")");
  assert(d.dbg.thr[0] === CFG.EAT_RATIO_THRESHOLD && d.dbg.thr[1] === CFG.THREAT_RATIO_THRESHOLD, "D4 日志自带当时生效的两个阈值");
  assert(d.dbg.patrol === 1, "D5 无可吃无威胁无贴边 ⇒ 绕圈");
})();

// ---- E. 威胁：danger=closing/gap，方向背离 ----
(function () {
  var t = ball(-400, 0, 300, 200, { vx: 3 });         // ratio=1.5 ⇒ threat；dist=400 gap=400-200-300=0⇒8
  var s = st(200, [t]);
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.avoid_n === 1 && d.dbg.avoid_worst && d.dbg.avoid_worst.i === 0, "E1 威胁球被选为 avoid_worst");
  assert(near(d.dbg.avoid_worst.danger, 3 / CFG.MIN_GAP, 0.01), "E2 danger=closing/gap (got " + d.dbg.avoid_worst.danger + ")");
  assert(d.vx > 0, "E3 威胁在 -x 侧 ⇒ 躲闪向量朝 +x (got " + d.vx.toFixed(3) + ")");
  assert(d.dbg.eat_best === null, "E4 威胁球不属于可吃候选");
})();

// ---- F. 边界回避：按轴斥力，越界越深推得越远（归一化后方向不变） ----
(function () {
  var s = st(200, [], { left: 50, right: 3000, top: 3000, bottom: 3000 });
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.edge_on === 1, "F1 left=50 < EDGE_MARGIN ⇒ 触发边界回避");
  assert(d.dbg.edge_push[0] === CFG.EDGE_MARGIN - 50 && d.dbg.edge_push[1] === 0, "F2 斥力=越界深度 (got " + JSON.stringify(d.dbg.edge_push) + ")");
  assert(d.vx > 0, "F3 贴左边 ⇒ 往 +x 推");
  assert(d.dbg.patrol === 0, "F4 边界分量非零 ⇒ 不绕圈");
})();

// ---- G. 权重为 0：可吃球存在但 wEat=0 ⇒ 无分量 ⇒ 绕圈 ----
(function () {
  var s = st(200, [ball(500, 0, 100, 200)]);
  var d = aim.decompose(s, { wEat: 0, wAvoid: 1.4, wEdge: 0.8 }, PREV);
  assert(d.dbg.eat_best !== null && d.dbg.eat_best.i === 0, "G1 候选照记（观测不受权重影响）");
  // 追吃分量为 0 ⇒ 合成向量是零向量 ⇒ 只会被绕圈兜底替换成单位向量。
  // 所以"等于绕圈向量"本身即证明 wEat=0 没产生任何推吃分量。
  assert(near(d.vx, Math.cos(CFG.PATROL_TURN), 1e-6) && near(d.vy, Math.sin(CFG.PATROL_TURN), 1e-6),
    "G2 wEat=0 ⇒ 无追吃分量（raw 退化为绕圈单位向量）");
  assert(d.dbg.patrol === 1, "G3 合成零向量 ⇒ 绕圈兜底");
})();

// ---- H. 绕圈方向 = 上一方向旋转 PATROL_TURN ----
(function () {
  var s = st(200, []);
  var d = aim.decompose(s, W, { x: 0, y: 0 });        // prevDir 退化 ⇒ 内部回退 (1,0)
  var ang = Math.atan2(d.vy, d.vx);
  assert(near(ang, CFG.PATROL_TURN, 1e-6), "H1 兜底方向=prevDir(1,0)+PATROL_TURN (got " + ang.toFixed(4) + ")");
})();

// ---- I. 分解自洽：raw == Σ 加权单位向量（独立复算，抓抄错权重/符号） ----
(function () {
  var e = ball(500, -100, 100, 200);                  // 可吃
  var t = ball(-300, 200, 400, 200, { vx: 2 });       // 威胁，dist≈360.6 gap=360-200-400<0⇒8
  var s = st(200, [e, t], { left: 100, right: 3000, top: 3000, bottom: 3000 });
  var d = aim.decompose(s, W, PREV);
  var ex = e.dx / e.dist, ey = e.dy / e.dist;
  var tx = t.dx / t.dist, ty = t.dy / t.dist;
  var px = CFG.EDGE_MARGIN - 100, py = 0;
  var pl = Math.sqrt(px * px + py * py);
  var wantX = W.wEat * ex - W.wAvoid * tx + W.wEdge * (px / pl);
  var wantY = W.wEat * ey - W.wAvoid * ty + W.wEdge * (py / pl);
  assert(near(d.vx, wantX, 0.005) && near(d.vy, wantY, 0.005),
    "I1 raw 向量 == wEat·ê − wAvoid·t̂ + wEdge·p̂ (got " + d.vx.toFixed(3) + "," + d.vy.toFixed(3) +
    " want " + wantX.toFixed(3) + "," + wantY.toFixed(3) + ")");
  assert(d.dbg.eat_best.i === 0 && d.dbg.avoid_worst.i === 1, "I2 同帧同时给出追吃与闪避目标");
})();

// ---- J. 纯函数：不改动传入的 state（决策层不许有副作用） ----
(function () {
  var s = st(200, [ball(500, 0, 100, 200)]);
  var before = JSON.stringify(s);
  aim.decompose(s, W, PREV);
  assert(JSON.stringify(s) === before, "J1 decompose 不修改 state（快照是拷贝）");
})();

// ---- K. 空球列表：不崩、无候选、绕圈 ----
(function () {
  var s = st(200, []);
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.eat_n === 0 && d.dbg.near_any === null && d.dbg.near_edible === null, "K1 空 balls ⇒ 各目标为 null");
  assert(isFinite(d.vx) && isFinite(d.vy), "K2 raw 向量有限");
})();

// ---- L. 感知漏斗字段透传（判"小球根本没进决策层"用） ----
(function () {
  var s = st(200, [ball(500, 0, 100, 200)], null,
    { clusters: 9, balls_precap: 15, max_balls: CFG.MAX_BALLS, noise_dropped: 4, ui_dropped: 2 });
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.per && d.dbg.per.precap === 15 && d.dbg.per.noise_dropped === 4 && d.dbg.per.ui_dropped === 2,
    "L1 感知漏斗（precap/noise_dropped/ui_dropped）透传进 dbg");
  assert(d.dbg.per.n_balls === 1 && d.dbg.per.max_balls === CFG.MAX_BALLS, "L2 n_balls/max_balls 一并记录");
})();

// ---- M. eat_top 截断到 AIM_DEBUG_TOP（防长局日志膨胀） ----
(function () {
  var bs = [];
  for (var i = 0; i < 8; i++) { bs.push(ball(400 + i * 40, 0, 30 + i, 200)); }
  var s = st(200, bs);
  var d = aim.decompose(s, W, PREV);
  assert(d.dbg.eat_n === 8, "M1 eat_n 记全量候选数 (got " + d.dbg.eat_n + ")");
  assert(d.dbg.eat_top.length === CFG.AIM_DEBUG_TOP, "M2 eat_top 截断到 AIM_DEBUG_TOP=" + CFG.AIM_DEBUG_TOP);
  assert(d.dbg.eat_top[0].val >= d.dbg.eat_top[d.dbg.eat_top.length - 1].val, "M3 eat_top 降序");
})();

// ---- N. ★尺寸不可信护栏（2026-09-25，config OCCL_DENY_*）：测不准就不吃 ----
// 依据：ov2 餐餐猫真值 ratio 1.43（威胁）被色域口径报成 0.85（可吃）＝致命反判，且任何
// 只看 bbox 的几何修正都无法同时判对它和 ov6 的 0.91 可吃鼠球 ⇒ 决策层必须拒吃这一类。
(function () {
  // 贴脸小球（ratio 0.25 可吃）但轮廓不完整 + 压在自己身上 ⇒ 必须被挡
  var bad = ball(230, 0, 50, 200, { unreliable: 1, skin: 1 });
  // 远处一颗正常可吃球，用来验证护栏不会把整帧的追吃也废掉
  var good = ball(900, 0, 120, 200);
  var d = aim.decompose(st(200, [bad, good]), W, PREV);
  assert(d.dbg.eat_n === 1, "N1 护栏球不计入可吃候选 (eat_n=" + d.dbg.eat_n + ")");
  assert(d.dbg.eat_best && d.dbg.eat_best.i === 1, "N2 追吃落到可信的那颗 (i=" + (d.dbg.eat_best ? d.dbg.eat_best.i : "null") + ")");
  assert(d.dbg.eat_denied.length === 1 && d.dbg.eat_denied[0].i === 0, "N3 被挡的球如实记进 eat_denied（可审计）");
  assert(d.dbg.eat_denied[0].unreliable === 1 && d.dbg.eat_denied[0].edible === 1,
    "N4 eat_denied 保留原始标记：看着可吃(edible=1) 但不可信(unreliable=1)");
  assert(d.dbg.near_any && d.dbg.near_any.i === 0, "N5 near_any 仍如实记最近球（观测不受护栏影响）");
})();
(function () {
  // 只有一颗护栏球 ⇒ 无追吃分量 ⇒ 绕圈兜底（绝不停住）
  var d = aim.decompose(st(200, [ball(230, 0, 50, 200, { unreliable: 1 })]), W, PREV);
  assert(d.dbg.eat_n === 0 && d.dbg.patrol === 1, "N6 唯一目标是护栏球 ⇒ 走绕圈兜底 (patrol=" + d.dbg.patrol + ")");
})();
(function () {
  // 契约：护栏的开与关只在**感知层**（OCCL_DENY_ENABLE 决定 unreliable 是否为 1），
  // 决策层只认球上的标记，不重复读开关（单一真源，避免两处开关打架）。
  var d = aim.decompose(st(200, [ball(230, 0, 50, 200, { unreliable: 0 })]), W, PREV);
  assert(d.dbg.eat_n === 1 && d.dbg.eat_denied.length === 0, "N7 标记为 0（感知层开关关掉时就是这样）⇒ 正常追吃，不重复读开关");
})();

console.log(fails === 0 ? "\n全部通过" : "\n失败 " + fails + " 项");
process.exit(fails === 0 ? 0 : 1);
