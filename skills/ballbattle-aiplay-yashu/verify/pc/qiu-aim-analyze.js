/*
 * qiu-aim-analyze.js —— 决策层日志分析器（离线，纯 Node）
 *
 * 输入：手机跑一局后拉回来的日志 JSONL（含 ev:"aim" 行，由 main.js + lib/aim.js 产出）。
 * 目的：把「旁边有小球也不去吃」拆成三种**互斥**的可能，用数据回答是哪种：
 *
 *   A. 近球**没被判可吃**（感知/阈值问题）—— near_any.edible=0
 *      A1 ratio ≥ EAT 阈值：再看 r_area vs r ⇒ 若 r_area 本在阈值内而 r 不在，
 *         说明是 **Hough 精化把半径抬出可吃区**（可修）；否则是阈值本身要重估（TBD-11）。
 *      A2 ratio ∈ [EAT, THREAT] **死区**：既不当可吃也不当威胁 —— 死亡①的元凶类型，最危险。
 *      A3 是威胁（ratio > THREAT）：正常，不算问题。
 *   B. 近球**被判可吃但没被选中**（打分规则问题）—— eat_best ≠ near_edible
 *      并给出两者的 value 差（差很小 ⇒ 评价值近乎平局，选择对噪声极敏感）。
 *   C. 小球**根本没进决策层**（感知漏斗问题）—— per.noise_dropped>0 / 被 MAX_BALLS 截断。
 *
 * 用法：
 *   node verify/pc/qiu-aim-analyze.js <日志.jsonl> [--near-factor 1.5] [--sample 6]
 *   --near-factor：判定「旁边」的阈值，球心距 ≤ factor × self_r（默认 1.5）。
 */
var fs = require("fs");
var path = require("path");

var args = process.argv.slice(2);
var file = args[0];
if (!file) {
  console.error("用法: node qiu-aim-analyze.js <日志.jsonl> [--near-factor 1.5] [--sample 6]");
  process.exit(1);
}
function optNum(name, def) {
  var i = args.indexOf(name);
  if (i < 0) { return def; }
  var v = Number(args[i + 1]);
  return isFinite(v) ? v : def;
}
var NEAR = optNum("--near-factor", 1.5);
var SAMPLE = optNum("--sample", 6);

var text = fs.readFileSync(file, "utf8");
var lines = text.split("\n");
var aims = [], frameRows = 0, evs = {};
var tMin = null, tMax = null;
for (var i = 0; i < lines.length; i++) {
  var ln = lines[i].trim();
  if (!ln) { continue; }
  var o;
  try { o = JSON.parse(ln); } catch (e) { continue; }
  if (!evs[o.ev || ("f:" + o.f)]) { evs[o.ev || ("f:" + o.f)] = 0; }
  evs[o.ev || ("f:" + o.f)]++;
  if (o.ev === "aim") {
    aims.push(o);
  } else if (o.f !== undefined && o.self_r !== undefined) {
    frameRows++;
  }
  if (o.t) { if (tMin === null || o.t < tMin) { tMin = o.t; } if (tMax === null || o.t > tMax) { tMax = o.t; } }
}

function deg(x, y) { return Math.atan2(y, x) * 180 / Math.PI; }
function angDiff(a, b) {
  var d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
function fmt(o, selfR) {
  if (!o) { return "null"; }
  var s = "d" + o.dist + " r" + o.r + " ratio" + o.ratio + " gap" + o.gap;
  if (selfR) { s += " (" + (o.dist / selfR).toFixed(2) + "R)"; }
  if (o.skin) { s += " skin"; }
  if (o.r_ref) { s += " r_ref" + o.r_ref; }
  return s;
}
function section(t) { console.log("\n=== " + t + " ==="); }

console.log("文件: " + path.basename(file) + "  (" + Math.round(fs.statSync(file).size / 1024) + " KB)");
var durS = (tMin && tMax) ? Math.round((tMax - tMin) / 1000) : 0;
console.log("时长: " + durS + "s   帧行(观测帧): " + frameRows + "   aim 行: " + aims.length +
  "   (aim 采样 1/" + (frameRows > 0 ? Math.round(frameRows / Math.max(1, aims.length)) : "?") + ")");
console.log("事件计数: " + JSON.stringify(evs));

if (aims.length === 0) {
  console.log("\n没有 ev:\"aim\" 行 —— 确认 CFG.AIM_DEBUG=true 且日志是本次跑局拉回的。");
  process.exit(2);
}

// ---------------- 分类 ----------------
var A = { nearNotEdible: [], a1_ratio: [], a2_deadzone: [], a3_threat: [] };
var B = { notSelected: [], tieNarrow: [] };
var C = { noise: 0, truncated: 0, frames: 0 };
var D = { sent0: 0, total: 0 };
var eatHist = {}, patrolN = 0, avoidN = 0, edgeN = 0;

for (i = 0; i < aims.length; i++) {
  var a = aims[i];
  var selfR = a.self_r || 0;
  var near = a.near_any, ne = a.near_edible;
  var thrEat = a.thr ? a.thr[0] : null, thrThr = a.thr ? a.thr[1] : null;

  if (a.per) {
    C.frames++;
    if (a.per.noise_dropped > 0) { C.noise++; }
    if (a.per.precap !== undefined && a.per.n_balls !== undefined && a.per.precap > a.per.n_balls) { C.truncated++; }
  }
  D.total++;
  if (a.sent === 0) { D.sent0++; }
  if (a.patrol) { patrolN++; }
  if (a.avoid_n > 0) { avoidN++; }
  if (a.edge_on) { edgeN++; }
  var k = String(a.eat_n);
  eatHist[k] = (eatHist[k] || 0) + 1;

  // A. 近球不可吃
  if (near && selfR > 0 && near.dist <= NEAR * selfR && near.edible === 0) {
    var rec = {
      f: a.f, self_r: selfR, ratio: near.ratio, dist: near.dist, r: near.r,
      r_area: near.r_area, r_ref: near.r_ref, skin: near.skin, threat: near.threat,
      thrEat: thrEat, thrThr: thrThr, near: near, f_aim: a.aim
    };
    A.nearNotEdible.push(rec);
    if (near.threat === 1) { A.a3_threat.push(rec); }
    else if (thrEat !== null && near.ratio >= thrEat) {
      A.a1_ratio.push(rec);
      // Hough 抬升嫌疑：面积法半径本在可吃区内，精化后越界
      if (near.r_area && selfR > 0 && thrEat !== null) {
        var ratioArea = near.r_area / selfR;
        if (ratioArea < thrEat && near.ratio >= thrEat) { rec.houghOut = true; }
      }
    } else { A.a2_deadzone.push(rec); }
  }

  // B. 旁边有可吃球但选中了别的
  if (ne && selfR > 0 && ne.dist <= NEAR * selfR && a.eat_best && ne.i !== a.eat_best.i) {
    var av = deg(a.aim[0], a.aim[1]);
    var angToNear = deg(ne.dx, ne.dy);
    var rec2 = {
      f: a.f, self_r: selfR, near: ne, best: a.eat_best,
      valRatio: ne.val > 0 ? Math.round((a.eat_best.val / ne.val) * 100) / 100 : null,
      angDiff: Math.round(angDiff(av, angToNear)),
      aim: a.aim
    };
    B.notSelected.push(rec2);
    if (rec2.valRatio !== null && rec2.valRatio <= 1.1) { B.tieNarrow.push(rec2); }
  }
}

function pct(n, d) { return d > 0 ? Math.round(n * 1000 / d) / 10 + "%" : "n/a"; }

section("概览");
console.log("巡逻(patrol=1) 帧: " + patrolN + " (" + pct(patrolN, aims.length) + ")");
console.log("有威胁帧: " + avoidN + " (" + pct(avoidN, aims.length) + ")   贴边帧: " + edgeN + " (" + pct(edgeN, aims.length) + ")");
console.log("可吃球数分布 (eat_n:帧数): " + JSON.stringify(eatHist));
console.log("本帧未下发摇杆 (sent=0，档位未变): " + D.sent0 + " (" + pct(D.sent0, D.total) + ")");

section("A. 近球("+NEAR+"R 内)**没被判可吃** —— 共 " + A.nearNotEdible.length + " 帧 (" + pct(A.nearNotEdible.length, aims.length) + ")");
console.log("  A1 被 EAT 阈值挡住: " + A.a1_ratio.length + "   (其中 Hough 精化把半径抬出可吃区: " +
  A.a1_ratio.filter(function (r) { return r.houghOut; }).length + ")");
console.log("  A2 **死区**(EAT≤ratio≤THREAT，既不吃也不躲): " + A.a2_deadzone.length);
console.log("  A3 是威胁: " + A.a3_threat.length);
function dump(list, tag) {
  for (var j = 0; j < Math.min(SAMPLE, list.length); j++) {
    var r = list[j];
    console.log("    [" + tag + "] f" + r.f + " " + fmt(r.near, r.self_r) +
      " r_area" + r.r_area + " r_ref" + r.r_ref + (r.houghOut ? "  ⚠Hough抬出可吃区" : "") +
      "  thr=" + r.thrEat + "/" + r.thrThr + "  aim=(" + r.f_aim + ")");
  }
}
dump(A.a2_deadzone, "死区");
dump(A.a1_ratio, "阈值");

section("B. 旁边有可吃球、但**选了别的球** —— 共 " + B.notSelected.length + " 帧 (" + pct(B.notSelected.length, aims.length) + ")");
console.log("  其中 value 几乎平局(best/near ≤1.1): " + B.tieNarrow.length + "   " +
  "⇒ 平局占比 " + pct(B.tieNarrow.length, B.notSelected.length) + "（平局多 = 打分对噪声敏感，不是「看不见」）");
for (i = 0; i < Math.min(SAMPLE, B.notSelected.length); i++) {
  var b = B.notSelected[i];
  console.log("    f" + b.f + " near_edible " + fmt(b.near, b.self_r) + " val" + b.near.val +
    "  ← 选中 →  " + fmt(b.best, b.self_r) + " val" + b.best.val +
    "  val比" + b.valRatio + "  与近球方向差" + b.angDiff + "°");
}

section("C. 小球**没进决策层**（感知漏斗）");
console.log("  有噪声地板丢弃的帧: " + C.noise + " (" + pct(C.noise, C.frames) + ")");
console.log("  被 MAX_BALLS 截断的帧: " + C.truncated + " (" + pct(C.truncated, C.frames) + ")");
console.log("  ⚠ 若这两项都接近 0，则「旁边的小球看不见」不成立，问题在 A/B。");

section("判读指引");
console.log("  A 类高 ⇒ 感知/阈值：A1 看 Hough 抬升(可修)、A2 死区最危险(死亡①同类)");
console.log("  B 类高且平局占比高 ⇒ 选择规则：value=r/gap 在小球上区分度太低");
console.log("  C 类高 ⇒ 先修感知漏斗（噪声地板/截断），别调权重");
