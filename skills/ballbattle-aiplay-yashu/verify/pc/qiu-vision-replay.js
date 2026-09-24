/*
 * qiu-vision-replay.js —— 用**生产真代码**在 PC 离线重放感知流水线（离线回归的核心工具）
 *
 * 为什么需要它：Python 复刻版只能验"算法思路"，验不了"生产实现"（抽样步长、贪心聚类顺序、
 * mergeFragments 的成对判据、噪声地板、selectSelf 采样）。这里直接 require lib/vision.js，
 * 喂同一份降采样像素（由 verify/pc/dump-argb.py 从真机截图导出），走完全相同的函数链。
 *
 * 用法：
 *   node verify/pc/qiu-vision-replay.js <file.argb> [--btns "457,964,231;2817,541,160;2494,1203,155"]
 *                                          [--aim] [--verbose]
 * 说明：
 *   - 像素文件 = 400×180 ARGB int32 小端（dump-argb.py 产出），与 images.resize(400x180,"AREA")
 *     + getBitmap().getPixels() 的口径一致（已与设备端逐位对账过，见 02 §7.1）。
 *   - 走与 perceive() 相同的函数链；**不含** OpenCV Hough 精化（PC 无 OpenCV）⇒ 半径偏小是预期，
 *     本工具用来判"簇结构/self 组成/球数"，不判最终半径。
 *   - --btns 传入手机标定的按键几何（与 main.js 注入的完全一致），否则跳过按键遮罩。
 *   - --aim 追加决策层向量分解（lib/aim.js 纯函数）⇒ 离线预演"旁边的小球是否被看见/判可吃"。
 */
var fs = require("fs");
var path = require("path");

var args = process.argv.slice(2);
var file = args[0];
var verbose = args.indexOf("--verbose") >= 0;
var btnArg = null;
var bi = args.indexOf("--btns");
if (bi >= 0) { btnArg = args[bi + 1]; }
// --project <dir>：指定另一份工程副本（A/B 对照用，例如 git 里的旧版本）
var ROOT = path.join(__dirname, "..", "..", "scripts", "autojs-project", "ballbattle-aiplay");
var pi = args.indexOf("--project");
if (pi >= 0) { ROOT = args[pi + 1]; }
var conf = require(path.join(ROOT, "config"));
var vision = require(path.join(ROOT, "lib", "vision"));
var CFG = conf.CFG;

if (!file) {
  console.error("用法: node qiu-vision-replay.js <file.argb> [--btns \"cx,cy,r;...\"] [--project <dir>] [--aim] [--verbose] [--no-occl]");
  process.exit(1);
}

if (btnArg) {
  var btns = [];
  var parts = btnArg.split(";");
  for (var i = 0; i < parts.length; i++) {
    var nums = parts[i].split(",");
    btns.push([Number(nums[0]), Number(nums[1]), Number(nums[2])]);
  }
  // 约定：第 1 项 = 摇杆（底盘），其余 = 吐孢子/分身
  if (vision.setStick) {
    if (btns[0]) { vision.setStick(btns[0][0], btns[0][1], btns[0][2]); }
    if (vision.setUiButtons) { vision.setUiButtons(btns.slice(1)); }
  } else {
    // 旧版兼容（A/B 对照用）：那时没有注入口，直接改 CFG 的按键几何（且只有硬遮罩）
    if (btns[1]) { CFG.BTN_SPIT_CX = btns[1][0]; CFG.BTN_SPIT_CY = btns[1][1]; CFG.BTN_SPIT_R = btns[1][2]; }
    if (btns[2]) { CFG.BTN_SPLIT_CX = btns[2][0]; CFG.BTN_SPLIT_CY = btns[2][1]; CFG.BTN_SPLIT_R = btns[2][2]; }
  }
}

var W = 400, H = 180;
var buf = fs.readFileSync(file);
if (buf.length !== W * H * 4) {
  console.error("像素文件大小不符: " + buf.length + " != " + (W * H * 4));
  process.exit(3);
}
var px = [];
for (var k = 0; k < W * H; k++) { px.push(buf.readInt32LE(k * 4)); }

// --masks "x,y,w,h;..."：临时覆盖 UI_MASK_RECTS（遮罩标定实验用，不改工程常量）
var mi = args.indexOf("--masks");
if (mi >= 0) {
  var ms = [];
  var mp = args[mi + 1].split(";");
  for (var mj = 0; mj < mp.length; mj++) {
    var mv = mp[mj].split(",");
    ms.push([Number(mv[0]), Number(mv[1]), Number(mv[2]), Number(mv[3])]);
  }
  CFG.UI_MASK_RECTS = ms;
}

// --vbr N：临时覆盖亮面车道阈值（HSV_BALL.vBright），标定实验用，不改工程常量
var vbi = args.indexOf("--vbr");
if (vbi >= 0) { CFG.HSV_BALL.vBright = Number(args[vbi + 1]); }

var clip = vision.uiClip ? vision.uiClip() : { yStart: 0, xLimit: W, boxes: [] };
var sc = vision.classifyRuns(px, W, H, clip);
var raw = vision.clusterRuns(sc.runs, px, W);
var mg = vision.mergeFragments(raw, px, W);
var clusters = vision.noiseFloor(mg.clusters);
var uiDropped = 0;
if (vision.dropUiAchroma) {           // 新版才有（UI 无彩色簇丢弃）
  var uiRes = vision.dropUiAchroma(clusters, clip);
  clusters = uiRes.clusters;
  uiDropped = uiRes.dropped;
}

var centerX = CFG.SELF_SCREEN_X / CFG.DOWNSCALE;   // 200
var centerY = CFG.SELF_SCREEN_Y / CFG.DOWNSCALE;   // 90
var limit = CFG.SELF_SEARCH_RADIUS / CFG.DOWNSCALE;
var selfGrp = vision.selectSelf(clusters, px, W, centerX, centerY, limit);

var DS = CFG.DOWNSCALE;
function rOf(a) { return Math.round(vision.radiusOf(a) * DS); }

var out = {
  file: path.basename(file),
  runs: sc.runs.length,
  hits: sc.hits,
  clusters_raw: raw.length,
  frag_merged: mg.merged,
  clusters: clusters.length,
  ui_dropped: uiDropped,
  self: null,
  balls: []
};
if (selfGrp) {
  var bb = { x1: 1e9, y1: 1e9, x2: -1, y2: -1 };
  for (i = 0; i < selfGrp.pieces.length; i++) {
    var p = selfGrp.pieces[i].c;
    if (p.x1 < bb.x1) { bb.x1 = p.x1; }
    if (p.x2 > bb.x2) { bb.x2 = p.x2; }
    if (p.yTop < bb.y1) { bb.y1 = p.yTop; }
    if (p.yBot > bb.y2) { bb.y2 = p.yBot; }
  }
  out.self = {
    n: selfGrp.pieces.length,
    x: Math.round(selfGrp.cx * DS), y: Math.round(selfGrp.cy * DS),
    r: rOf(selfGrp.area),
    bbox: [bb.x1 * DS, bb.y1 * DS, bb.x2 * DS, bb.y2 * DS],
    pieces: selfGrp.pieces.map(function (pc) {
      return { x: Math.round(pc.c.cx * DS), y: Math.round(pc.c.cy * DS), r: rOf(pc.c.area) };
    })
  };
}
// 贴身遮挡补偿（2026-09-25）：与 perceive 走**同一个** occlusionRadiusDsf，
// 避免"PC 能测到、手机行为不同"的双写风险。--no-occl 关闭以做 A/B 对照。
var selfRds = selfGrp ? vision.radiusOf(selfGrp.area) : 0;
var occlEnabled = args.indexOf("--no-occl") < 0;
var occlBoost = 0;
for (var i = 0; i < clusters.length; i++) {
  var c = clusters[i];
  if (c.isSelf) { continue; }
  var rBase = (vision.ballRadiusOf || vision.radiusOf)(c);     // 与 perceive 的 r_area 同口径
  var rOccl = 0;
  if (occlEnabled && selfGrp && vision.occlusionRadiusDsf) {
    rOccl = vision.occlusionRadiusDsf(c, selfGrp.cx, selfGrp.cy, selfRds, rBase);
  }
  var rUse = rOccl > rBase ? rOccl : rBase;
  if (rUse > rBase) { occlBoost++; }
  out.balls.push({
    x: Math.round(c.cx * DS), y: Math.round(c.cy * DS), r: Math.round(rUse * DS),
    ratio: out.self ? Math.round((rUse * DS / out.self.r) * 100) / 100 : null,
    r_base: Math.round(rBase * DS),
    r_occl: rOccl > 0 ? Math.round(rOccl * DS) : 0,
    area_ds: c.area,                 // 簇采样点数（1 点 = COL_STEP×ROW_STEP 像素）
    fill: c.x2 > c.x1 ? Math.round((c.area * CFG.SCAN_ROW_STEP) / ((c.x2 - c.x1 + 1) * (c.yBot - c.yTop + 1)) * 1000) / 1000 : 0,
    skin: vision.isSkinBall(c) ? 1 : 0,
    // 尺寸不可信（轮廓不完整 + 压在自己身上）⇒ 与 perceive 同一函数，不做双写
    unreliable: (vision.silhouetteUnreliable && selfGrp) ? (vision.silhouetteUnreliable(c, selfGrp.cx, selfGrp.cy, selfRds) ? 1 : 0) : 0,
    ac: c.ach > c.chr ? 1 : 0,
    bbox: [c.x1 * DS, c.yTop * DS, c.x2 * DS, c.yBot * DS]
  });
}
out.occl_boost = occlBoost;
out.balls.sort(function (a, b) { return b.r - a.r; });

// bounds（与 perceive 同口径：球边缘到该方向"彩色内容最远延伸"的距离）
if (selfGrp && vision.edgeDist) {
  var selfR = vision.radiusOf(selfGrp.area);
  out.bounds = {
    left: Math.round(vision.edgeDist(sc.colCnt, W, selfGrp.cx, selfR, -1) * DS),
    right: Math.round(vision.edgeDist(sc.colCnt, W, selfGrp.cx, selfR, 1) * DS),
    top: Math.round(vision.edgeDist(sc.rowCnt, H, selfGrp.cy, selfR, -1) * DS),
    bottom: Math.round(vision.edgeDist(sc.rowCnt, H, selfGrp.cy, selfR, 1) * DS)
  };
}

// --aim：离线预演**决策层向量分解**（lib/aim.js 的纯函数，与手机端同一份代码）
// 目的：在真机跑局之前，先在 8 张真机图上回答"旁边的小球有没有被看见/被判可吃"。
// ⚠️ PC 无 OpenCV ⇒ 半径是面积法（r_ref=0），绝对值与手机端 Hough 精化后不同；
//    这里只看**结构性事实**（谁离得最近、是否被判可吃、选择的追吃目标是不是旁边的球）。
if (args.indexOf("--aim") >= 0 && selfGrp) {
  var aimMod = require(path.join(ROOT, "lib", "aim"));
  var stLike = {
    self: { x: out.self.x, y: out.self.y, r: out.self.r, n: out.self.n, pieces: out.self.pieces },
    balls: out.balls.map(function (b) {
      return {
        dx: b.x - out.self.x, dy: b.y - out.self.y,
        dist: Math.round(Math.sqrt(Math.pow(b.x - out.self.x, 2) + Math.pow(b.y - out.self.y, 2))),
        r: b.r, size_ratio: b.ratio, r_area: b.r, r_ref: 0,
        skin: b.skin, refined: 0,
        edible: b.ratio < CFG.EAT_RATIO_THRESHOLD,
        threat: b.ratio > CFG.THREAT_RATIO_THRESHOLD,
        vx: null, vy: null, kind: "unknown"
      };
    }),
    bounds: out.bounds,
    stats: { clusters: out.clusters, balls_precap: out.balls.length, max_balls: CFG.MAX_BALLS, noise_dropped: 0, ui_dropped: out.ui_dropped }
  };
  var dec = aimMod.decompose(stLike, { wEat: CFG.W_EAT, wAvoid: CFG.W_AVOID, wEdge: CFG.W_EDGE }, { x: 1, y: 0 });
  out.aim = dec.dbg;
}

if (verbose) {
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log(JSON.stringify({
    file: out.file, runs: out.runs, frag_merged: out.frag_merged,
    clusters: out.clusters, self: out.self, bounds: out.bounds,
    balls: out.balls.slice(0, 10), n_balls: out.balls.length
  }));
}
