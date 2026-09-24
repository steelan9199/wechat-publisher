/*
 * verify/pc/qiu-round-smoke.js —— lib/round.js 状态机离线冒烟（2026-09-25 新增）
 *
 * 为什么要有：2026-09-25 老板改判「球死 → 脚本自己停」，这条行为的落点是
 *   `round.js` 的终局位（`isRoundOver()`）→ `main.js isEpisodeOver()` → 主循环 break。
 *   若只靠真机验证，改一次就要老板手动死一次；所以把状态机在 Node 里跑通，
 *   用**真机像素**（`.argb`，400x180 降采样，与手机同一口径）当输入做回归。
 *
 * mock 掉 AutoJs6 专有依赖（`java.lang.reflect.Array` / `images.resize`），其余全用生产代码。
 *
 * 用法：node verify/pc/qiu-round-smoke.js <复活页.argb> <对局帧.argb>
 *   例：node verify/pc/qiu-round-smoke.js D:/empty/_calib/argb/death-prev-r1.argb D:/empty/_calib/argb/ov1.argb
 */

var fs = require("fs");
var path = require("path");

var PROJ = process.argv[2] ? path.resolve(__dirname, "../../scripts/autojs-project/ballbattle-aiplay")
                           : path.resolve(__dirname, "../../scripts/autojs-project/ballbattle-aiplay");

// ---- AutoJs6 运行时 mock ----
global.java = {
  lang: {
    Integer: { TYPE: 0 },
    reflect: { Array: { newInstance: function (t, n) { return new Array(n); } } }
  }
};

var SW = 400, SH = 180;

function loadArgb(p) {
  var buf = fs.readFileSync(p);
  var n = buf.length / 4;
  var px = new Array(n);
  for (var i = 0; i < n; i++) { px[i] = buf.readUInt32LE(i * 4); }
  return px;
}

// 用给定像素喂给 round.js 的 judgeSettle（它只调 images.resize + getBitmap().getPixels）
function mkImages(px) {
  return {
    resize: function () {
      return {
        getBitmap: function () {
          return {
            getPixels: function (dst, off, stride, x, y, w, h) {
              for (var i = 0; i < w * h; i++) { dst[i] = px[i]; }
            }
          };
        },
        recycle: function () { }
      };
    },
    save: function () { return "/mock/shot.jpg"; }
  };
}

var CFG = require(PROJ + "/config").CFG;
var round = require(PROJ + "/lib/round");

var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log("  PASS  " + msg); }
  else { fail++; console.log("  FAIL  " + msg); }
}

function mkTracker(px) {
  var logs = [];
  var trk = round.createRoundTracker({
    log: { write: function (o) { logs.push(o); } },
    images: mkImages(px),
    cfg: CFG
  });
  return { trk: trk, logs: logs };
}

console.log("CFG: ROUND_T_DEATH_FRAMES=" + CFG.ROUND_T_DEATH_FRAMES +
            " ROUND_RECHECK_EVERY=" + CFG.ROUND_RECHECK_EVERY +
            " RESPAWN_SIG_ENABLE=" + CFG.RESPAWN_SIG_ENABLE);

var nTrigger = CFG.ROUND_T_DEATH_FRAMES + 1;   // 触发复核所需的连续丢帧数（真机实测 13）
console.log("触发复核所需连续丢帧 = " + nTrigger + "\n");

// ==================== A. 复活页帧：判死 ⇒ 终局位置起（这条就是"球死自停"的开关） ====================
(function () {
  var argb = process.argv[2];
  if (!argb || !fs.existsSync(argb)) { console.log("跳过 A（未提供复活页 .argb）"); return; }
  console.log("## A. 复活页帧 → 期望判死并置终局位    [" + path.basename(argb) + "]");
  var t = mkTracker(loadArgb(argb));
  var f = 0;
  assert(t.trk.onSelfFound(f) !== null, "首帧 self 出现 → round_start（BOOT→PLAYING）");
  assert(!t.trk.isRoundOver(), "开局时终局位 = false");

  var ev = null;
  for (var i = 1; i <= nTrigger; i++) { f = i; ev = t.trk.onSelfLost(f, {}); }
  var sc = t.logs.filter(function (o) { return o.ev === "settle_check"; });
  var re = t.logs.filter(function (o) { return o.ev === "round_end"; });

  assert(sc.length >= 1, "出现 settle_check（复核确实执行了）");
  assert(sc.length && sc[0].sg === "C", "复核命中签名 C（复活页结构），sg=" + (sc.length ? sc[0].sg : "-"));
  assert(ev !== null && ev.type === "round_end", "onSelfLost 返回 round_end 事件");
  assert(t.trk.isRoundOver() === true, "★终局位 = true ⇒ main.js isEpisodeOver() 会停机");
  assert(t.trk.getState() === "over", "状态机进入 over（终局），不是旧版 dead（等重生）");
  assert(re.length === 1, "只记了一条 round_end");
  assert(typeof re[0].survival_ms === "number", "round_end 带 survival_ms（主指标：存活时长）");

  // 终局后：self 就算再出现也不得"续局"
  var after = t.trk.onSelfFound(f + 1);
  assert(after === null, "★终局后 self 再现 → 不再产生 round_start（不会自动续局）");
  assert(t.trk.onSelfFound(f + 2) === null, "终局状态保持（不会被打回 PLAYING）");
})();

// ==================== B. 对局帧：长遮挡 ⇒ 不得判死（防止误停） ====================
(function () {
  var argb = process.argv[3];
  if (!argb || !fs.existsSync(argb)) { console.log("\n跳过 B（未提供对局帧 .argb）"); return; }
  console.log("\n## B. 对局帧（长遮挡）→ 期望**不**判死、不停机    [" + path.basename(argb) + "]");
  var t = mkTracker(loadArgb(argb));
  t.trk.onSelfFound(0);
  var f = 0, ev = null;
  for (var i = 1; i <= nTrigger; i++) { f = i; ev = t.trk.onSelfLost(f, {}); }
  assert(ev === null, "复核未命中 ⇒ 不产生 round_end");
  assert(t.trk.isRoundOver() === false, "★终局位 = false ⇒ 不会误停");
  assert(t.trk.getState() === "dying", "仍在 DYING（怀疑态）");

  // self 重现 → lost_recovered，本局继续
  var back = t.trk.onSelfFound(f + 1);
  assert(back && back.type === "lost_recovered", "self 重现 → lost_recovered，本局继续");
  assert(t.trk.isRoundOver() === false, "恢复后终局位仍为 false");
  assert(t.trk.getState() === "playing", "状态回到 playing");
})();

console.log("\n==================== 结果 ====================");
console.log("PASS " + pass + "  /  FAIL " + fail);
process.exit(fail === 0 ? 0 : 1);
