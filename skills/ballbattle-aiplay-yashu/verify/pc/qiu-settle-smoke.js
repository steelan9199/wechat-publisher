/*
 * verify/pc/qiu-settle-smoke.js —— lib/settle-sign.js 三签名冒烟（Node，无需 AutoJS）
 *
 * 两条腿：
 *   A 合成用例：按**实测几何**造出「复活页 / 绿色结算页 / 对局帧」三种像素，断言签名行为。
 *     这条腿不依赖任何截图文件，随时可跑。
 *   B 真机重放：把 .argb（由 verify/pc/dump-argb.py 从真机截图 dump，400x180 生产口径）
 *     喂进**手机上跑的那一份** settle-sign.js，看判据在真图上的表现。
 *
 * 用法:
 *   node verify/pc/qiu-settle-smoke.js                              # 只跑合成用例
 *   node verify/pc/qiu-settle-smoke.js D:/empty/_calib/argb/*.argb  # 叠加真机重放
 *
 * 为什么要有这个脚本：判死逻辑原来只埋在 round.js 里，改一次只能上手机跑一局才知道对不对。
 * 抽成纯模块后，改判据 = 改一次、验一次、几十毫秒。**手机上跑的就是这里验过的那份代码。**
 */

var fs = require("fs");
var ROOT = "../../scripts/autojs-project/ballbattle-aiplay";
var conf = require(ROOT + "/config");
var CFG = conf.CFG;
var settleSign = require(ROOT + "/lib/settle-sign");

var W = 400, H = 180;
var fails = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS " + msg); }
  else { fails++; console.log("FAIL " + msg); }
}

// ---------- 像素构造工具 ----------
function mkPx(bg) {
  var px = new Array(W * H);
  for (var i = 0; i < W * H; i++) { px[i] = bg; }
  return px;
}
function rgb(r, g, b) { return (255 << 24) | (r << 16) | (g << 8) | b; }
function fillRect(px, x1, y1, x2, y2, color) {
  for (var y = y1; y <= y2; y++) {
    for (var x = x1; x <= x2; x++) { px[y * W + x] = color; }
  }
}

// ---------- 实测几何（3200x1440 → 归一 → 400x180）----------
// 复活页按钮（2026-09-25 真机两张一致，见 references/05 §3.6）：
//   放弃复活 绿条 x .292~.460  y .714~.824
//   免费复活 金条 x .531~.705  y .717~.822
var GIVEUP = { x1: Math.round(0.292 * W), x2: Math.round(0.460 * W), y1: Math.round(0.714 * H), y2: Math.round(0.824 * H) };
var FREE   = { x1: Math.round(0.531 * W), x2: Math.round(0.705 * W), y1: Math.round(0.717 * H), y2: Math.round(0.822 * H) };
var C_GREEN_BTN = rgb(79, 224, 138);    // 放弃复活 亮绿（实测取样）
var C_GOLD_BTN  = rgb(255, 216, 77);    // 免费复活 金黄（实测取样）
var C_DARK_BG   = rgb(16, 16, 24);      // 复活页深底
var C_GREEN_PAGE= rgb(102, 204, 51);    // 绿色结算页绿底
var C_INGAME_BG = rgb(56, 56, 56);      // 对局背景（方案 V22/S0）

console.log("=== A 合成用例（按实测几何造像素）===");

// ---- A1 复活页：左绿右金并排 + 深底 → 期望 why=respawn_struct（C 命中）----
(function () {
  var px = mkPx(C_DARK_BG);
  fillRect(px, GIVEUP.x1, GIVEUP.y1, GIVEUP.x2, GIVEUP.y2, C_GREEN_BTN);
  fillRect(px, FREE.x1, FREE.y1, FREE.x2, FREE.y2, C_GOLD_BTN);
  var s = settleSign.judge(px, W, H, CFG);
  assert(s.why === "respawn_struct", "A1 复活页 → why=" + s.why + " (期望 respawn_struct)");
  assert(s.hit === true, "A1 复活页 → hit=" + s.hit);
  assert(s.bars && s.bars.gold && s.bars.green, "A1 两条都找到");
  console.log("     dark=" + s.dark.toFixed(3) + " green=" + s.green.toFixed(3) +
    " midY=" + s.midYellow.toFixed(3) + " 金条cx=" + (s.bars.gold ? s.bars.gold.cx.toFixed(2) : "-") +
    " 绿条cx=" + (s.bars.green ? s.bars.green.cx.toFixed(2) : "-"));
})();

// ---- A2 绿色结算页：整片亮绿 + 左下孤零金块 → 期望只有 A 命中，C 必须排除 ----
(function () {
  var px = mkPx(C_GREEN_PAGE);
  // 绿色页左下确实有个金黄块（实测中心 x=.13），但它在左侧 ⇒ C 的 cx 窗口必须把它排除
  fillRect(px, Math.round(0.05 * W), Math.round(0.55 * H), Math.round(0.14 * W), Math.round(0.67 * H), C_GOLD_BTN);
  var s = settleSign.judge(px, W, H, CFG);
  assert(s.sigA === true && s.why === "green_after", "A2 绿页 → why=" + s.why + " (期望 green_after)");
  assert(s.sigC === false, "A2 绿页 → 结构签名必须排除 (sigC=" + s.sigC + ", 原因=" + (s.bars ? s.bars.why : "-") + ")");
})();

// ---- A3 对局帧：暗底 + 零散彩球 → 期望三个签名全不命中 ----
(function () {
  var px = mkPx(C_INGAME_BG);
  // 撒一些球（含绿色球，故意制造"绿像素"，验证它不会被误当成"放弃复活"按钮）
  var seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (var k = 0; k < 26; k++) {
    var cx = Math.round(rnd() * W), cy = Math.round(rnd() * H), r = 3 + Math.round(rnd() * 9);
    var col = [rgb(200, 60, 60), rgb(60, 200, 90), rgb(80, 120, 230), rgb(230, 200, 70), rgb(180, 80, 200)][k % 5];
    for (var y = cy - r; y <= cy + r; y++) {
      if (y < 0 || y >= H) { continue; }
      var half = Math.floor(Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))));
      for (var x = cx - half; x <= cx + half; x++) {
        if (x >= 0 && x < W) { px[y * W + x] = col; }
      }
    }
  }
  var s = settleSign.judge(px, W, H, CFG);
  assert(!s.hit, "A3 对局帧 → 不应命中 (why=" + s.why + " green=" + s.green.toFixed(3) + " dark=" + s.dark.toFixed(3) + ")");
})();

// ---- A4 陷阱帧：够暗 + 中黄带有黄块（= 旧版签名B 会误报"死亡"的那种画面）----
// 这是本次回归最重要的用例：真机 15 张对局帧里 11 张 dark 就 ≥.65，只差一个黄块。
// 期望：sigB 命中但**不判死**（why="dark_only"），因为 SETTLE_DARK_SIG_COUNTS 默认 false。
(function () {
  var px = mkPx(C_DARK_BG);
  fillRect(px, Math.round(0.30 * W), Math.round(0.72 * H), Math.round(0.70 * W), Math.round(0.80 * H), C_GOLD_BTN);
  var s0 = settleSign.judge(px, W, H, CFG);
  assert(s0.sigB === true, "A4 陷阱帧 → 签名B 确实命中 (dark=" + s0.dark.toFixed(3) + " midY=" + s0.midYellow.toFixed(3) + ")");
  assert(s0.hit === false && s0.why === "dark_only",
    "A4 陷阱帧 → 新版不判死 (hit=" + s0.hit + " why=" + s0.why + ")");
  // A5：把开关打开，同一画面就该判死 —— 证明这个开关真的在起作用（不是写了没用）
  var c2 = {};
  for (var k in CFG) { if (CFG.hasOwnProperty(k)) { c2[k] = CFG[k]; } }
  c2.SETTLE_DARK_SIG_COUNTS = true;
  var s1 = settleSign.judge(px, W, H, c2);
  assert(s1.hit === true && s1.why === "respawn_dark",
    "A5 同画面 + 开 SETTLE_DARK_SIG_COUNTS → 恢复判死 (hit=" + s1.hit + " why=" + s1.why + ")");
  console.log("     (A4/A5 证明：旧版策略下这类画面会被误报成死亡，新版不会)");
})();

// ---------- B 真机重放 ----------
var files = process.argv.slice(2);
if (files.length > 0) {
  console.log("\n=== B 真机重放（.argb，400x180 生产口径）===");
  // 期望表：按文件名前缀匹配；未收录的只打印、不判定
  var EXPECT = [
    ["death-prev-r1",   "respawn",     "复活页（已人工确认真死现场）"],
    ["death-calib-0924","respawn",     "复活页（0924 标定页）"],
    ["death-r1",        "green_after", "绿色结算页（本轮第1局误判现场）"],
    ["death-r2",        "green_after", "绿色结算页（本轮第2局误判现场）"]
  ];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var buf = fs.readFileSync(f);
    var n = buf.length / 4;
    if (n !== W * H) { console.log("跳过 " + f + "（像素数 " + n + " ≠ " + (W * H) + "）"); continue; }
    var px = new Array(n);
    for (var j = 0; j < n; j++) { px[j] = buf.readUInt32LE(j * 4); }   // LE → 0xAARRGGBB
    var s = settleSign.judge(px, W, H, CFG);
    var base = f.replace(/\\/g, "/").split("/").pop().replace(/\.argb$/, "");
    var exp = null;
    for (var e = 0; e < EXPECT.length; e++) { if (base === EXPECT[e][0]) { exp = EXPECT[e]; } }
    var line = base + ": why=" + s.why + " green=" + s.green.toFixed(3) + " dark=" + s.dark.toFixed(3) +
      " midY=" + s.midYellow.toFixed(3) +
      " 金条=" + (s.bars && s.bars.gold ? ("w" + s.bars.gold.w + " cx" + s.bars.gold.cx.toFixed(2)) : "无") +
      " 绿条=" + (s.bars && s.bars.green ? ("w" + s.bars.green.w + " cx" + s.bars.green.cx.toFixed(2)) : "无");
    console.log("  " + line);
    if (exp) {
      var ok = (s.why === "respawn_struct" || s.why === "respawn_dark") ? "respawn" : s.why;
      assert(ok === exp[1], "B " + exp[2] + " → why=" + s.why);
    } else {
      console.log("    （未收录期望，仅打印）");
    }
  }
} else {
  console.log("\n（未传入 .argb，跳过真机重放。要跑：node verify/pc/qiu-settle-smoke.js <*.argb>）");
}

console.log("\n" + (fails === 0 ? "全部通过" : (fails + " 项失败")));
process.exit(fails === 0 ? 0 : 1);
