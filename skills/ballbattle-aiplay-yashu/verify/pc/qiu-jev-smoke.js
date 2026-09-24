/*
 * qiu-jev-smoke.js —— JEV 客户端纯逻辑冒烟（纯 Node，无需 AutoJS/手机/网络）
 *
 * 测的是**生产真代码**（lib/jev.js + config.js），不测网络——连通性由真机 jev-conn-test 覆盖
 * （2026-09-25 t0925_043436_fbff：200 / 1477ms / jev-1.13.0）。改 lib/jev.js 或 config.js 的
 * JEV 段后必跑：
 *
 *   node verify/pc/qiu-jev-smoke.js
 *
 * 覆盖（typesafe-jev-decision §3.8：≥5 用例，含边界与对抗）：
 *   ① translate：posture.choice 直接成为策略（choice 选最优不设阈值）
 *   ② 覆盖优先级：is_pursued / is_cornered 命中阈值 → 覆盖为 retreat（保守优先）
 *   ③ 边界：noul 恰等于阈值即覆盖；低 0.01 不覆盖
 *   ④ 对抗：answers 空对象 / null / 200 缺 answers → 不崩、回 patrol 或降级
 *   ⑤ trimState：字段白名单 + JEV_MAX_BALLS 截断 + prev 透传（几何白名单/空 prev 不透传）
 *   ⑥ config 模式不变式：ENABLE_JEV=true + JEV_MODE="drive" + THRESHOLDS.PLACEHOLDER=true + 分身上限 16
 *   ⑦ 模式断言守卫：full 未标定必须拒绝；record/drive 不受限；非法 JEV_MODE 拒绝
 *   ⑧ translateDrive：steer 罗盘→向量、maintain 语义、分身/吐孢位、缺答案兜底
 */
var conf = require("../../scripts/autojs-project/ballbattle-aiplay/config");
var jev = require("../../scripts/autojs-project/ballbattle-aiplay/lib/jev");

var CFG = conf.CFG;
var TH = conf.THRESHOLDS;
var pass = 0, fail = 0;

function t(name, cond) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

// ---- ① posture：choice 直接成为策略（不设阈值，模型已 argmax） ----
var r1 = jev.translate({ posture: { choice: "chase" } }, TH);
t("① posture.choice 成为策略且带 at/raw",
  r1.policy === "chase" && typeof r1.at === "number" && r1.raw.posture.choice === "chase");

// ---- ② 覆盖优先级：被追 / 被困 → retreat（保守优先，代价不对称） ----
var r2 = jev.translate({ posture: { choice: "chase" }, is_pursued: { noul: 0.9 } }, TH);
var r2b = jev.translate({ posture: { choice: "chase" }, is_cornered: { noul: 0.9 } }, TH);
var r2c = jev.translate({ posture: { choice: "chase" }, is_pursued: { noul: 0.9 }, is_cornered: { noul: 0.9 } }, TH);
t("②a is_pursued 命中覆盖为 retreat", r2.policy === "retreat");
t("②b is_cornered 命中覆盖为 retreat", r2b.policy === "retreat");
t("②c 双命中仍 retreat", r2c.policy === "retreat");

// ---- ③ 边界：恰等阈值覆盖（>= 语义）；低 0.01 不覆盖 ----
var r3 = jev.translate({ posture: { choice: "patrol" }, is_pursued: { noul: TH.is_pursued } }, TH);
var r3b = jev.translate({ posture: { choice: "chase" }, is_pursued: { noul: TH.is_pursued - 0.01 } }, TH);
t("③a noul=阈值即覆盖（含等号）", r3.policy === "retreat");
t("③b noul 低于阈值不覆盖", r3b.policy === "chase");

// ---- ④ 对抗：answers 异形 → 不崩、回 patrol ----
var r4a = jev.translate({}, TH);
var r4b = jev.translate(null, TH);
var r4c = jev.translate({ posture: { choice: "" }, is_pursued: "garbage" }, TH);
t("④ 空对象/null/乱类型 answers 都安全回 patrol",
  r4a.policy === "patrol" && r4b.policy === "patrol" && r4c.policy === "patrol");

// ---- ⑤ trimState：白名单 + 截断 + prev ----
var st = {
  self: { r: 60, x: 100, y: 200, n: 3, pieces: [1] },
  balls: [], bounds: { left: 10, right: 20, top: 30, bottom: 40 },
  recent: { action: "none", since_ms: 0, ate_delta: 0 },
  stats: { frame_ms: 5 }, ts: 1, frame: 2, dup: false
};
for (var i = 0; i < 12; i++) {
  st.balls.push({ dx: i, dy: i, dist: 100 + i, r: i, size_ratio: 0.5, edible: true, threat: false,
                  skin: 1, unreliable: 0, r_area: 9, r_ref: 0, r_occl: 0, refined: 0, vx: null, vy: null, kind: "x" });
}
var ts1 = jev.trimState(st);
t("⑤a balls 截断到 JEV_MAX_BALLS", ts1.balls.length === CFG.JEV_MAX_BALLS);
t("⑤b 每球只留白名单字段",
  !("skin" in ts1.balls[0]) && !("vx" in ts1.balls[0]) && !("r_occl" in ts1.balls[0]) &&
  "size_ratio" in ts1.balls[0] && "threat" in ts1.balls[0]);
t("⑤c self 只留 r/n；stats/ts 整体不透传",
  ts1.self.r === 60 && ts1.self.n === 3 && !("x" in ts1.self) && !("stats" in ts1) && !("ts" in ts1));
t("⑤d 无 prev 不产生 prev 键", !("prev" in ts1));

st.prev = { age_ms: 1500, balls: [{ dx: 1, dy: 2, dist: 30, r: 90, size_ratio: 1.5, skin: 1, edible: false }] };
var ts2 = jev.trimState(st);
t("⑤e prev 透传且只留几何字段 + age_ms",
  ts2.prev && ts2.prev.age_ms === 1500 && ts2.prev.balls.length === 1 &&
  ts2.prev.balls[0].dist === 30 && !("skin" in ts2.prev.balls[0]) && !("edible" in ts2.prev.balls[0]));
st.prev = { age_ms: 1500, balls: [] };
t("⑤f 空 prev 不透传", !("prev" in jev.trimState(st)));

// ---- ⑥ config 模式不变式（当前部署口径：drive 全权驾驶） ----
t("⑥a ENABLE_JEV=true（要调 JEV）", CFG.ENABLE_JEV === true);
t("⑥b JEV_MODE=drive（全权驾驶直接生效）", CFG.JEV_MODE === "drive");
t("⑥c THRESHOLDS.PLACEHOLDER=true（阈值类判断仍未标定，drive 不受影响）", TH.PLACEHOLDER === true);
t("⑥d 驾驶常量就位（TTL/分身上限/贴脸系数/速度档）",
  CFG.JEV_PREV_MAX_AGE_MS === 5000 && CFG.JEV_SPLIT_MAX_PIECES === 16 &&
  CFG.JEV_DRIVE_TTL_MS === 6000 && CFG.JEV_STEER_SPEED === 1.0);
t("⑥e steer 罗盘 8 向向量齐备且归一", (function () {
  var D = conf.STEER_DIRS, k = ["n","ne","e","se","s","sw","w","nw"], i, dx, dy, len;
  for (i = 0; i < k.length; i++) {
    if (!D[k[i]]) { return false; }
    dx = D[k[i]][0]; dy = D[k[i]][1];
    len = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(len - 1) > 1e-3) { return false; }
  }
  return !D.maintain;   // maintain 必须不在表里（翻译层单独处理）
})());

// ---- ⑦ 模式断言守卫 ----
// stick 坐标在 config 里故意为 0（生产由手机端 hydrateButtons() 在 assertCalibrated 前注入，
// 纯 Node 没有 hydrate 步骤）⇒ 手工补齐标定值（01 实测 457/964/231）再验证 JEV 守卫本身。
CFG.STICK_CENTER_X = 457; CFG.STICK_CENTER_Y = 964; CFG.STICK_MAX_RADIUS = 231;
var savedE = CFG.ENABLE_JEV, savedM = CFG.JEV_MODE;
var threwFull = false, threwBad = false, threwRec = false, threwDrv = false;

CFG.ENABLE_JEV = true; CFG.JEV_MODE = "full";
try { conf.assertCalibrated(); } catch (e) { threwFull = true; }
t("⑦a full + placeholder → 拒绝启动（不许拿假阈值进行为）", threwFull);

CFG.JEV_MODE = "record";
try { conf.assertCalibrated(); } catch (e) { threwRec = true; }
t("⑦b record + placeholder → 通过（纯观察）", !threwRec);

CFG.JEV_MODE = "drive";
try { conf.assertCalibrated(); } catch (e) { threwDrv = true; }
t("⑦c drive + placeholder → 通过（choice 判断不依赖阈值）", !threwDrv);

CFG.JEV_MODE = "turbo";
try { conf.assertCalibrated(); } catch (e) { threwBad = true; }
t("⑦d 非法 JEV_MODE → 拒绝启动", threwBad);

CFG.ENABLE_JEV = savedE; CFG.JEV_MODE = savedM;
CFG.STICK_CENTER_X = 0; CFG.STICK_CENTER_Y = 0; CFG.STICK_MAX_RADIUS = 0;

// ---- ⑧ translateDrive（全权驾驶翻译） ----
var d1 = jev.translateDrive({ steer: { choice: "n" } });
t("⑧a steer n → (0,-1)", d1.steer.dir === "n" && d1.steer.vx === 0 && d1.steer.vy === -1);
var d2 = jev.translateDrive({ steer: { choice: "ne" } });
t("⑧b steer ne → 对角向量", d2.steer.vx > 0.70 && d2.steer.vx < 0.71 && d2.steer.vy < -0.70 && d2.steer.vy > -0.71);
var d3 = jev.translateDrive({ steer: { choice: "maintain" } });
t("⑧c maintain → 零向量（push 语义=沿用当前方向）", d3.steer.dir === "maintain" && d3.steer.vx === 0 && d3.steer.vy === 0);
var d4 = jev.translateDrive({ steer: { choice: "turbo" }, use_split: { choice: "split" }, use_spit: { choice: "spit" } });
t("⑧d 未知 steer 兜底 maintain；分身/吐孢位正确", d4.steer.dir === "maintain" && d4.split === 1 && d4.spit === 1);
var d5 = jev.translateDrive(null);
t("⑧e answers=null 安全 → maintain/0/0", d5.steer.dir === "maintain" && d5.split === 0 && d5.spit === 0);
var d6 = jev.translateDrive({});
t("⑧f 空对象 → 不按任何键", d6.split === 0 && d6.spit === 0);

console.log("");
console.log("qiu-jev-smoke: " + pass + " 通过, " + fail + " 失败");
process.exit(fail > 0 ? 1 : 0);
