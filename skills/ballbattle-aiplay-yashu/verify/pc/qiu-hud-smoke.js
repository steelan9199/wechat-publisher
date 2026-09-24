/*
 * verify/pc/qiu-hud-smoke.js —— HUD 文本口径离线回归（2026-09-25，工程 0.6.6）
 *
 * 为什么要有：HUD 是老板唯一的**人眼判据**（"你到底有没有在跑"），而它的旧口径出过事——
 *   判死截图里 self 已连丢 13 帧，HUD 还写着 `自:0 ｜ 游戏界面 ｜ 活`（看着像一切正常，
 *   见 references/05 §4.4 观察项）。修法就是把文案抽成纯模块 `lib/hud-text.js`
 *   （零 AutoJs6 依赖）⇒ 不必真机、不必等老板死一次，PC 上就能把口径钉死。
 *
 * 覆盖：
 *   ① 口径正确性：boot/playing/dying/over 四状态 × 丢帧数 → 三段文本**逐段**断言；
 *   ② 不变式 I1：第一段是"丢N帧"时，第三段**绝不能**是"活"（本次修的根因）；
 *   ③ 不变式 I2：全文宽度 ≤ 16 全角格（悬浮条 720px / 13sp ≈ 16.7 格，超了会被裁掉＝没显示）；
 *   ④ 抗脏输入：lost 为 undefined / 0 / 负数 一律按"未丢失"处理。
 *
 * 用法：node verify/pc/qiu-hud-smoke.js
 */

var path = require("path");
var PROJ = path.resolve(__dirname, "../../scripts/autojs-project/ballbattle-aiplay");
var hud = require(PROJ + "/lib/hud-text");

var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log("  PASS  " + msg); }
  else { fail++; console.log("  FAIL  " + msg); }
}

// 显示宽度：全角/中日韩字符算 1 格，ASCII 与「·」等半角符号算 0.5 格
// （「｜」= U+FF5C 是全角 ⇒ 1 格，必须算对，否则宽度不变式形同虚设）
function cells(s) {
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    n += (s.charCodeAt(i) > 0x2000) ? 1 : 0.5;
  }
  return n;
}

function slots(text) {
  return text.split(hud.SEP);
}

console.log("SEP = \"" + hud.SEP + "\" （长度 " + hud.SEP.length + "，" +
            (hud.SEP === " ｜ " ? "全角竖线+两侧空格 ✔" : "⚠ 与 0.6.6 口径不符") + "）\n");

// ==================== ① 口径正确性 ====================
var CASES = [
  { trk: "boot",    lost: 0,  selfN: 0, want: ["自:0",  "未捕获",   "?"]        , note: "起手未见 self" },
  { trk: "boot",    lost: 5,  selfN: 0, want: ["丢5帧", "未捕获",   "?"]        , note: "起手就没找到球" },
  { trk: "playing", lost: 0,  want: ["自:3",  "游戏界面", "活"]       , note: "正常局内" },
  { trk: "playing", lost: 1,  want: ["丢1帧", "游戏界面", "活?"]      , note: "瞬时丢 1 帧" },
  { trk: "playing", lost: 13, want: ["丢13帧","游戏界面", "活?"]      , note: "★旧口径在这里说\"活\"" },
  { trk: "dying",   lost: 13, want: ["丢13帧","界面未知", "复核中"]   , note: "触发复核（可能是长遮挡）" },
  { trk: "over",    lost: 13, want: ["丢13帧","判死确认", "死·停"]    , note: "判死已确认，脚本即将停机" }
];

console.log("## ① 四状态 × 丢帧数 → 三段文本");
CASES.forEach(function (c) {
  var selfN = (c.selfN === undefined) ? 3 : c.selfN;
  var text = hud.format(selfN, c.trk, c.lost);
  var got = slots(text);
  var ok = got.length === 3 &&
           got[0] === c.want[0] && got[1] === c.want[1] && got[2] === c.want[2];
  assert(ok, "[" + c.trk + "/lost=" + c.lost + "] " + c.note +
             "  ⇒ \"" + text + "\"" + (ok ? "" : "  期望 [" + c.want.join(" | ") + "]"));
});

// self 数确实进了第一段（未丢失时）
assert(slots(hud.format(7, "playing", 0))[0] === "自:7", "未丢失时第一段 = 自:selfN（selfN=7）");

// ==================== ② 不变式 I1：丢失期绝不说"活" ====================
console.log("\n## ② 不变式 I1 —— 第一段是\"丢N帧\"时，第三段绝不能是\"活\"");
var TRKS = ["boot", "playing", "dying", "over"];
var i1 = 0, i1bad = [];
for (var li = 1; li <= 40; li++) {
  for (var ti = 0; ti < TRKS.length; ti++) {
    var t = slots(hud.format(3, TRKS[ti], li));
    i1++;
    if (t[0] === ("丢" + li + "帧") && t[2] === "活") { i1bad.push(TRKS[ti] + "/" + li); }
  }
}
assert(i1bad.length === 0, "扫描 " + i1 + " 组（4 状态 × 丢 1~40 帧）无一例说\"活\"" +
                           (i1bad.length ? "  违规：" + i1bad.join(",") : ""));

// ==================== ③ 不变式 I2：全文 ≤ 16 全角格 ====================
console.log("\n## ③ 不变式 I2 —— 全文宽度 ≤ 16 全角格（悬浮条 720px / 13sp）");
var MAX_CELLS = 16;
var widest = 0, widestText = "";
var over = [];
for (var l2 = 0; l2 <= 99; l2++) {
  for (var t2 = 0; t2 < TRKS.length; t2++) {
    var txt = hud.format(16, TRKS[t2], l2);
    var c = cells(txt);
    if (c > widest) { widest = c; widestText = txt; }
    if (c > MAX_CELLS) { over.push(txt + " (" + c + "格)"); }
  }
}
assert(over.length === 0, "扫描 400 组，无一超 " + MAX_CELLS + " 格" +
                          (over.length ? "  超宽：" + over.slice(0, 3).join(" / ") : ""));
console.log("       最宽一行 " + widest + " 格 ≈ " + Math.round(widest * (720 / 16.7)) +
            "px：「" + widestText + "」");

// ==================== ④ 抗脏输入 ====================
console.log("\n## ④ 抗脏输入：lost 缺失/0/负数 一律按\"未丢失\"");
assert(slots(hud.format(3, "playing", undefined))[0] === "自:3", "lost=undefined ⇒ 自:N");
assert(slots(hud.format(3, "playing", null))[0] === "自:3", "lost=null ⇒ 自:N");
assert(slots(hud.format(3, "playing", 0))[0] === "自:3", "lost=0 ⇒ 自:N");
assert(slots(hud.format(3, "playing", -4))[0] === "自:3", "lost=-4 ⇒ 自:N");
assert(slots(hud.format(3, "playing", "7"))[0] === "自:3", "lost=\"7\"（字符串）不误报 ⇒ 自:N");
assert(slots(hud.format(3, "未知状态", 0))[2] === "?", "未知 trk 归入未捕获分支（不抛异常）");

// ==================== ⑤ 全权驾驶段（2026-09-25，工程 0.7.0） ====================
console.log("\n## ⑤ 全权驾驶：driveLabel / format 第四参（老板要求 HUD 可视 AI 指令）");
assert(hud.driveLabel("n", 0, 0) === "北", "driveLabel(n,0,0) ⇒ 北");
assert(hud.driveLabel("ne", 1, 0) === "东北·分", "driveLabel(ne,1,0) ⇒ 东北·分");
assert(hud.driveLabel("se", 1, 1) === "东南·分吐", "driveLabel(se,1,1) ⇒ 东南·分吐");
assert(hud.driveLabel("maintain", 0, 1) === "持·吐", "driveLabel(maintain,0,1) ⇒ 持·吐");
assert(hud.driveLabel("garbage", 0, 0) === "持", "driveLabel(未知 dir) 兜底 ⇒ 持");

var d1 = slots(hud.format(3, "playing", 0, hud.driveLabel("e", 1, 1)));
assert(d1[0] === "东·分吐" && d1[1] === "游戏界面" && d1[2] === "活",
       "playing + drive 生效 ⇒ 第一段=东·分吐，其余两段不变");

var d2 = slots(hud.format(0, "playing", 2, hud.driveLabel("e", 1, 1)));
assert(d2[0] === "丢2帧", "★丢失期驾驶段让位（安全信息优先于指令展示）");

var d3 = slots(hud.format(0, "over", 9, hud.driveLabel("e", 1, 1)));
assert(d3[0] === "丢9帧" && d3[1] === "判死确认" && d3[2] === "死·停", "over 态不吃驾驶段");

// 宽度不变式扩展：drive 生效的全部组合（9 方向 × 分/吐）也必须 ≤16 格
var DIRS9 = ["n", "ne", "e", "se", "s", "sw", "w", "nw", "maintain"];
var dOver = [], dWide = 0, dWideTxt = "";
for (var di = 0; di < DIRS9.length; di++) {
  for (var st5 = 0; st5 <= 1; st5++) {
    for (var sp5 = 0; sp5 <= 1; sp5++) {
      var dtxt = hud.format(16, "playing", 0, hud.driveLabel(DIRS9[di], st5, sp5));
      var dc = cells(dtxt);
      if (dc > dWide) { dWide = dc; dWideTxt = dtxt; }
      if (dc > MAX_CELLS) { dOver.push(dtxt + " (" + dc + "格)"); }
    }
  }
}
assert(dOver.length === 0, "驾驶段 36 组合无一超 " + MAX_CELLS + " 格" +
                           (dOver.length ? "  超宽：" + dOver.slice(0, 3).join(" / ") : ""));
console.log("       驾驶段最宽 " + dWide + " 格 ≈ " + Math.round(dWide * (720 / 16.7)) +
            "px：「" + dWideTxt + "」");

console.log("\n==================== 结果 ====================");
console.log("PASS " + pass + "  /  FAIL " + fail);
process.exit(fail === 0 ? 0 : 1);
