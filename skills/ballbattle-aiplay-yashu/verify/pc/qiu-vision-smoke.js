/* 冒烟测试：clusterRuns -> mergeFragments -> noiseFloor -> selectSelf（Node，无需 AutoJS） */
var conf = require("../../scripts/autojs-project/ballbattle-aiplay/config");
var CFG = conf.CFG;
var vision = require("../../scripts/autojs-project/ballbattle-aiplay/lib/vision");

var W = 400, H = 180;
var CX = 200, CY = 90, LIMIT = 700 / 8;   // 屏幕中心与搜索半径（降采样坐标）
var PURPLE = (255 << 24) | (170 << 16) | (41 << 8) | 236;    // H285.7 S71.8 V92.6 → self 色
var VIOLET = (255 << 24) | (120 << 16) | (40 << 8) | 220;    // H266.7 → self 色域内但色相偏离
var RED    = (255 << 24) | (220 << 16) | (40 << 8) | 40;     // H0 → 非 self 色
var BG     = (255 << 24) | (56 << 16) | (56 << 8) | 56;

function mkPx() { var px = []; for (var i = 0; i < W * H; i++) { px.push(BG); } return px; }
function fillRect(px, x1, y1, x2, y2, color) {
  for (var y = y1; y <= y2; y++) { for (var x = x1; x <= x2; x++) { px[y * W + x] = color; } }
}
// 造一个圆盘的游程（扫描行按 rowStep=3 间隔）
function discRuns(cx, cy, r) {
  var runs = [];
  for (var y = cy - r; y <= cy + r; y += 3) {
    var half = Math.floor(Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))));
    if (half <= 0) { half = 1; }
    runs.push({ y: y, x1: cx - half, x2: cx + half });
  }
  return runs;
}
var fails = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS " + msg); }
  else { fails++; console.log("FAIL " + msg); }
}

// ---- A. 单球：不合并、被识别为 self、n==1 ----
(function () {
  var runs = discRuns(200, 90, 10);
  var cl = vision.clusterRuns(runs);
  var mg = vision.mergeFragments(cl);
  var fl = vision.noiseFloor(mg.clusters);
  assert(fl.length === 1 && mg.merged === 0, "A1 单球=1簇 无合并 (clusters=" + fl.length + " merged=" + mg.merged + ")");
  var px = mkPx();
  fillRect(px, fl[0].x1, fl[0].yTop, fl[0].x2, fl[0].yBot, PURPLE);
  var g = vision.selectSelf(fl, px, W, CX, CY, LIMIT);
  assert(g !== null && g.pieces.length === 1, "A2 self 识别 n=1");
  assert(Math.abs(g.cx - 200) < 2 && Math.abs(g.cy - 90) < 2, "A3 质心≈球心 (" + g.cx.toFixed(1) + "," + g.cy.toFixed(1) + ")");
  var rEq = vision.radiusOf(g.area) * 8;   // radiusOf 已含 rowStep 面积修正
  assert(Math.abs(rEq - 80) < 8, "A4 等效半径≈80px屏幕 (r=" + rEq.toFixed(1) + ")");
})();

// ---- B. 标签横切：上下两簇 gap=7 ≤ GAP=8 且 x 重叠 → 合并回 1 簇 ----
(function () {
  var top = discRuns(200, 83, 7);      // y=76..90
  var bot = discRuns(200, 100, 7);     // y=93..107，gap=93-90=3? 算实际
  // 直接造两段保证 gap 在 (6, 8]：top 到 y=86，bottom 从 y=93 起
  var runs = discRuns(200, 81, 6);     // y=75..87
  var runs2 = discRuns(200, 100, 6);   // y=94..106, gap=94-87=7
  var all = runs.concat(runs2);
  var cl = vision.clusterRuns(all);
  var mg = vision.mergeFragments(cl);
  var fl = vision.noiseFloor(mg.clusters);
  assert(cl.length === 2, "B1 贪心聚类切成2簇 (got " + cl.length + ")");
  assert(mg.merged === 1 && fl.length === 1, "B2 碎片合并回1簇 (merged=" + mg.merged + " clusters=" + fl.length + ")");
  assert(fl.length === 1 && Math.abs(fl[0].cy - (87 + 94) / 2) < 4, "B3 合并后 cy 居中 (cy=" + (fl.length ? fl[0].cy : -1) + ")");
  // 反例：gap 过大不合并
  var runs3 = discRuns(200, 81, 6).concat(discRuns(200, 130, 6));   // gap=124-87=37
  var mg3 = vision.mergeFragments(vision.clusterRuns(runs3));
  assert(mg3.merged === 0 && mg3.clusters.length === 2, "B4 gap=37 不合并");
  // 反例：x 不重叠不合并（左右两颗并排真球）
  var runsL = discRuns(150, 90, 8), runsR = discRuns(230, 90, 8);
  var mg4 = vision.mergeFragments(vision.clusterRuns(runsL.concat(runsR)));
  assert(mg4.merged === 0 && mg4.clusters.length === 2, "B5 并排两球不合并 (clusters=" + mg4.clusters.length + ")");
})();

// ---- C. self 组识别：色相一致性剔除同色域异相敌球 ----
(function () {
  var selfRuns = discRuns(200, 90, 10);
  var violetRuns = discRuns(230, 90, 8);   // 距中心30 < LIMIT 87.5
  var redRuns = discRuns(260, 90, 8);
  var cl = vision.noiseFloor(vision.mergeFragments(
    vision.clusterRuns(selfRuns.concat(violetRuns).concat(redRuns))).clusters);
  var px = mkPx();
  for (var i = 0; i < cl.length; i++) {
    var c = cl[i];
    var color = (Math.abs(c.cx - 200) < 5) ? PURPLE : (Math.abs(c.cx - 230) < 5 ? VIOLET : RED);
    fillRect(px, c.x1, c.yTop, c.x2, c.yBot, color);
  }
  var g = vision.selectSelf(cl, px, W, CX, CY, LIMIT);
  assert(g !== null && g.pieces.length === 1, "C1 紫敌球被色相一致性剔除 n=1 (n=" + (g ? g.pieces.length : -1) + ")");
  // 只有 1 个候选时不受一致性影响
  var cl2 = vision.noiseFloor(vision.mergeFragments(vision.clusterRuns(selfRuns)).clusters);
  var px2 = mkPx();
  fillRect(px2, cl2[0].x1, cl2[0].yTop, cl2[0].x2, cl2[0].yBot, PURPLE);
  var g2 = vision.selectSelf(cl2, px2, W, CX, CY, LIMIT);
  assert(g2 !== null && g2.pieces.length === 1, "C2 单候选保留");
})();

// ---- D. 16 片上限：18 个 self 色碎片 → 只留 16 ----
(function () {
  var runs = [];
  for (var i = 0; i < 18; i++) {
    var x = 150 + (i % 9) * 12, y = 60 + Math.floor(i / 9) * 30;
    runs = runs.concat(discRuns(x, y, 5));
  }
  var cl = vision.noiseFloor(vision.mergeFragments(vision.clusterRuns(runs)).clusters);
  var px = mkPx();
  for (var j = 0; j < cl.length; j++) { fillRect(px, cl[j].x1, cl[j].yTop, cl[j].x2, cl[j].yBot, PURPLE); }
  var g = vision.selectSelf(cl, px, W, CX, CY, LIMIT);
  assert(g !== null && g.pieces.length === 16, "D1 碎片上限16 (n=" + (g ? g.pieces.length : -1) + " clusters=" + cl.length + ")");
})();

// ---- E. 亮面无彩色车道（2026-09-24 低饱和盲区修复：白色/奶油球整球体表 S≈0）----
(function () {
  var WHITE = (255 << 24) | (245 << 16) | (245 << 8) | 245;   // S0 V96 → 亮面车道
  var GRAY  = (255 << 24) | (150 << 16) | (150 << 8) | 150;   // S0 V59 → 两车道都不命中
  var DARKG = (255 << 24) | (40 << 16) | (70 << 8) | 40;      // V27 → 低于 vMin

  function discPx(px, cx, cy, r, color) {
    for (var y = cy - r; y <= cy + r; y++) {
      for (var x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) { continue; }
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) { px[y * W + x] = color; }
      }
    }
  }
  var clip = { yStart: 0, xLimit: W, boxes: [] };

  var px = mkPx();
  discPx(px, 100, 90, 20, WHITE);
  var sc = vision.classifyRuns(px, W, H, clip);
  assert(sc.runs.length > 0, "E1 白球被亮面车道捞到 (runs=" + sc.runs.length + ")");
  var x1 = 9999, x2 = -1;
  for (var i = 0; i < sc.runs.length; i++) {
    if (sc.runs[i].x1 < x1) { x1 = sc.runs[i].x1; }
    if (sc.runs[i].x2 > x2) { x2 = sc.runs[i].x2; }
  }
  assert(Math.abs((x1 + x2) / 2 - 100) <= 2, "E2 白球游程中心≈球心 (" + ((x1 + x2) / 2) + ")");

  var scBg = vision.classifyRuns(mkPx(), W, H, clip);
  assert(scBg.runs.length === 0 && scBg.hits === 0, "E3 纯背景零游程 (runs=" + scBg.runs.length + ")");

  var pxDim = mkPx();
  discPx(pxDim, 100, 90, 20, GRAY);
  assert(vision.classifyRuns(pxDim, W, H, clip).runs.length === 0,
    "E4 中灰碟(V59,S0)不可见（亮面车道下限=vBright=70）");

  var pxDark = mkPx();
  discPx(pxDark, 100, 90, 20, DARKG);
  assert(vision.classifyRuns(pxDark, W, H, clip).runs.length === 0,
    "E5 暗绿碟(V27)不可见（已知残留：暗色球盲区，见 02 §3.6）");
})();

// ---- F. UI 无彩色簇丢弃（摇杆白旋钮 = 无彩色 → 丢；压在摇杆上的彩色球 → 留）----
(function () {
  var WHITE2 = (255 << 24) | (245 << 16) | (245 << 8) | 245;
  function disc2(px, cx, cy, r, color) {
    for (var y = cy - r; y <= cy + r; y++) {
      for (var x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) { continue; }
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) { px[y * W + x] = color; }
      }
    }
  }
  var clipF = { yStart: 0, xLimit: W, boxes: [], rectZones: [] };
  var sx = Math.round(457 / 8), sy = Math.round(964 / 8);   // 摇杆底盘心（ds）
  function pipe(px) {
    var sc = vision.classifyRuns(px, W, H, clipF);
    return vision.noiseFloor(vision.mergeFragments(vision.clusterRuns(sc.runs, px, W), px, W).clusters);
  }
  var clKnob = pipe((function () { var p = mkPx(); disc2(p, sx, sy, 15, WHITE2); return p; })());
  assert(clKnob.length === 1, "F1 无彩色旋钮成簇 (clusters=" + clKnob.length + ")");
  vision.setStick(457, 964, 231);
  var r1 = vision.dropUiAchroma(clKnob, clipF);
  assert(r1.dropped === 1 && r1.clusters.length === 0, "F2 无彩色簇被丢 (dropped=" + r1.dropped + ")");

  var clBall = pipe((function () { var p = mkPx(); disc2(p, sx, sy, 15, PURPLE); return p; })());
  var r2 = vision.dropUiAchroma(clBall, clipF);
  assert(r2.dropped === 0 && r2.clusters.length === 1, "F3 彩色球压在摇杆区仍保留 (dropped=" + r2.dropped + ")");

  var clOut = pipe((function () { var p = mkPx(); disc2(p, 200, 60, 15, WHITE2); return p; })());
  var r3 = vision.dropUiAchroma(clOut, clipF);
  assert(r3.dropped === 0 && r3.clusters.length === 1, "F4 区外白球不受影响 (dropped=" + r3.dropped + ")");
  vision.setStick(0, 0, 0);

  // ---- G. 判据回归防护（2026-09-24 手机实测 8/8 图幻影球）----
  // G1: 摇杆真实构成 = 浅灰底盘（无彩色）+ 沿口一圈红描边（彩色）。旧判据"chr>0 就保留"
  //     会把它当球留下（实测 (452,964) r233 ratio0.81 幻影球）；新判据按多数票丢弃。
  var GRAYDISK = (255 << 24) | (190 << 16) | (190 << 8) | 190;   // V74.5 S0 → 亮面车道
  var clStick = pipe((function () {
    var p = mkPx();
    disc2(p, sx, sy, 15, GRAYDISK);                    // 浅灰底盘 → 大片无彩色
    // 沿口一点点红描边（彩色，少数）。x 取偶数才落在扫描列上（SCAN_COL_STEP=2）；
    // 且该列必须仍在圆盘内（|dy|≤6 时半宽 ≥13）→ 与灰盘同一条游程。
    for (var t = -6; t <= 6; t++) { p[(sy + t) * W + (sx + 13)] = RED; }
    return p;
  })());
  vision.setStick(457, 964, 231);
  var acStick = clStick.length === 1 ? (clStick[0].ach > clStick[0].chr ? 1 : 0) : -1;
  assert(acStick === 1, "G1 摇杆复合簇(灰盘多+红描边少)判为无彩色 (ach=" +
    (clStick[0] ? clStick[0].ach : "-") + " chr=" + (clStick[0] ? clStick[0].chr : "-") + ")");
  var r4 = vision.dropUiAchroma(clStick, clipF);
  assert(r4.dropped === 1, "G2 摇杆复合簇被丢（旧判据 chr>0 会漏掉）(dropped=" + r4.dropped + ")");
  vision.setStick(0, 0, 0);

  // G3/G4: 矩形 UI 区（排行榜）—— 无彩色白字丢、彩色真球留
  var clipG = { yStart: 0, xLimit: W, boxes: [], rectZones: [[2580, 195, 3200, 600]] };
  var clTxt = pipe((function () { var p = mkPx(); disc2(p, 350, 62, 10, WHITE2); return p; })());  // 屏(2800,496)
  var r5 = vision.dropUiAchroma(clTxt, clipG);
  assert(r5.dropped === 1, "G3 排行榜矩形区内的白字簇被丢 (dropped=" + r5.dropped + ")");
  var clReal = pipe((function () { var p = mkPx(); disc2(p, 350, 62, 10, PURPLE); return p; })());
  var r6 = vision.dropUiAchroma(clReal, clipG);
  assert(r6.dropped === 0 && r6.clusters.length === 1, "G4 排行榜矩形区内的彩色真球保留 (dropped=" + r6.dropped + ")");
})();

// ---- H. 贴身遮挡下界 + 「尺寸不可信」护栏（2026-09-25 重写，老板 6 张重叠图定论）----
// 场景（降采样坐标）：自己 (100,90) r=20；簇 bbox [112,132]×[102,122]——**角贴着自己圆盘**
//   ⇒ 矩形最近点 (112,102) 距 17 < 20（相交），但**四条边中点**最近 25.06 > 20（旧判据会漏判）。
(function () {
  var SX = 100, SY = 90, SR = 20;
  var c = { x1: 112, x2: 132, yTop: 102, yBot: 122, cx: 122, cy: 112, area: 50 };

  // H1 门（回归钉）：角贴圆 ⇒ 必须触发（旧版「边中点最近距」判不相交 → 整类漏判）
  var nearNew = vision.bboxNearDist(c, SX, SY);
  var midMin = Math.min(
    Math.hypot(c.x1 - SX, c.cy - SY), Math.hypot(c.x2 - SX, c.cy - SY),
    Math.hypot(c.cx - SX, c.yTop - SY), Math.hypot(c.cx - SX, c.yBot - SY));
  assert(nearNew < SR && midMin > SR,
    "H1 新判据（矩形最近点 " + nearNew.toFixed(1) + "）判相交，旧判据（边中点最近 " + midMin.toFixed(1) + "）漏判");

  // H2 不相交 ⇒ 不下界（省算力，且完整可见本就不需要）
  var far = { x1: 300, x2: 320, yTop: 100, yBot: 120, cx: 310, cy: 110, area: 50 };
  assert(vision.occlusionRadiusDsf(far, SX, SY, SR, 10) === 0, "H2 不相交的簇返回 0（不触发补偿）");

  // H3 下界 = max(半宽, (far−R)/2)：本例 (far−R)/2 胜出
  var ro = vision.occlusionRadiusDsf(c, SX, SY, SR, 8);
  var rHalf = 21 / 2, rOver = (vision.bboxFarDist(c, SX, SY) - SR) / 2;
  assert(Math.abs(ro - rOver) < 0.3 && ro > rHalf,
    "H3 下界取 max(半宽 " + rHalf.toFixed(1) + ", 越界 " + rOver.toFixed(1) + ") = " + ro.toFixed(1));
  assert(ro > 8, "H4 下界确实抬高了半径（8 → " + ro.toFixed(1) + "）");

  // H5 上限 K：rUsed×OCCL_COMP_K 封顶（防碎片拼接把 bbox 拉长时爆表）
  var roCap = vision.occlusionRadiusDsf(c, SX, SY, SR, 3);
  assert(Math.abs(roCap - 3 * CFG.OCCL_COMP_K) < 1e-6, "H5 上限生效 " + roCap.toFixed(2) + " = 3×K");

  // H6 尺寸不可信：轮廓不完整(fill<0.5) + 压在自己身上 ⇒ true（ov2 餐餐猫就是这一类）
  assert(vision.silhouetteUnreliable(c, SX, SY, SR) === true,
    "H6 稀疏轮廓+贴身 ⇒ 判尺寸不可信 (fill=" + (c.area * CFG.SCAN_ROW_STEP / (21 * 21)).toFixed(2) + ")");
  // H7 轮廓完整（fill≥0.5）⇒ 可信（正常球不该被护栏误伤）
  var solid = { x1: 112, x2: 132, yTop: 102, yBot: 122, cx: 122, cy: 112, area: 130 };
  assert(vision.silhouetteUnreliable(solid, SX, SY, SR) === false, "H7 轮廓完整(fill≥0.5) ⇒ 尺寸可信");
  // H8 不贴身 ⇒ 可信（完整可见时量得准，不需要护栏）
  assert(vision.silhouetteUnreliable(far, SX, SY, SR) === false, "H8 不贴身 ⇒ 尺寸可信（护栏不误伤远球）");
  // H9 开关关闭 ⇒ 一律可信
  CFG.OCCL_DENY_ENABLE = false;
  assert(vision.silhouetteUnreliable(c, SX, SY, SR) === false, "H9 OCCL_DENY_ENABLE=false ⇒ 护栏整体关闭");
  CFG.OCCL_DENY_ENABLE = true;
})();

console.log(fails === 0 ? "ALL PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
