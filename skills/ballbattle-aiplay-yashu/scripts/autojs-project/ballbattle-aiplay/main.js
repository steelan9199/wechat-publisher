/*
 * main.js —— 球球大作战 AI 代打 · 主入口（快循环 + 慢循环）
 *
 * 前提：老板手动进入「无尽模式」后再启动本工程。不负责开局导航，不负责结算页重开。
 * 目标（老板 2026-09-25 二次改口径）：**主动吃球长大是本局的意义，不被吃掉是前提**——
 *       光活着不吃球没有意义；保命仍优先于贪婪（有威胁先脱离）。
 * 退出：两种——
 *   ① ★**签名确认判死 ⇒ 自己停**（老板 2026-09-25 改判）：判死后脚本收尾退出，
 *      老板再手动重开一局、重新启动脚本。**脚本不做续局动作**（不点「免费复活」/「继续」/不重开）。
 *      ⛔ 禁止用「self 连续丢 N 帧」这类不可靠判据停机（`selfLostFrames` 只落日志）——见 05 §3.5。
 *   ② 20 分钟防呆上限（正常走不到：判死会先停）。
 *
 * 线程模型（references/03 §一）：
 *   主线程   = 快循环，每 TICK_MS 一轮：截图 -> 感知 -> 算方向 -> 推摇杆
 *   子线程   = 慢循环，每 SLOW_TICK_MS 一轮：调 JEV -> 翻译成策略 -> 写 latestPolicy
 *              ⚠️ 0.8.0 起慢循环不再启动（JEV 下线，老板 2026-09-25：效果不好不要了）；
 *              决策 = aim.js 本地基线 + escapeReflex 逃命反射（硬护栏⑥），全部本地零网络。
 *   两者只通过"整体替换"的共享变量通信，不做原地修改。
 *
 * 注意：AutoJs6 工程模式下基于 Rhino，保持 ES5 语法。
 */

var conf = require("./config");
var CFG = conf.CFG;
var logger = require("./lib/logger");
var vision = require("./lib/vision");
// OpenCV Hough 找圆精化（AutoJs6 内置 OpenCV）：修皮肤球面积半径低估。
// 注入失败不致命——vision 无 refiner 自动回退面积/bbox 兜底（PC 冒烟即此路径）。
try {
  var circleRefiner = require("./lib/circle-refiner");
  vision.setCircleRefiner(circleRefiner.makeRefiner(CFG));
} catch (eRefiner) {
  logger.warn && logger.warn("circle-refiner 注入失败，感知回退面积法: " + eRefiner);
}
var control = require("./lib/control");
var aim = require("./lib/aim");       // 决策层本地几何（纯模块；2026-09-25 从本文件抽出的 computeAim）
var jev = require("./lib/jev");
var round = require("./lib/round");   // 局边界裁决器（签名确认判死 → 置终局位 → 主循环停机；2026-09-25 老板改判）
var hudText = require("./lib/hud-text");   // HUD 文本口径（纯模块；丢帧期外显"丢N帧"、绝不说"活"）

var result = { ok: 0, msg: "工程未执行" };
var running = true;
var latestState = null;
var latestPolicy = null;
var latestDrive = null;      // 全权驾驶指令（JEV_MODE=drive/full）：{ steer:{dir,vx,vy}, split, spit, at, ms }
var lastDriveCmdAt = -1;     // 已执行过按键的最后一条驾驶指令时间戳（边触发：一条指令只按一次）
var lastReflexSplitAt = -1e9; // 硬护栏④：上次逃命反射分身时刻（冷却防连碎）
var bornAt = Date.now();
var selfLostFrames = 0;   // 仅计数落日志；**不直接触发停机**（丢帧数不是可靠判据，见下）
var lastLoggedSpit = 0, lastLoggedSplit = 0;   // 按键统计只在有变化时落一次日志（防刷屏）
var roundOverConfirmed = false;   // 判死已确认（签名命中）→ 主循环随即停机
var stopReason = null;            // 停机原因，落进 end 日志与终局回执

// ★红线（2026-09-25 老板改判）：**球死 → 脚本自己停**。老板每次手动把游戏切到无尽模式后启动脚本；
//    球死后脚本自停，他再手动重开一局、重新启动脚本（**脚本不做续局、不点复活、不重开**）。
//    ⚠️ 停机依据**只能是"签名确认的判死"**（round.js 的终局位；日志里看 `sg` 字段：
//       C=复活页结构 / B=复活页底色 / A=绿色结算页，三者任一命中才停）。
//    历史教训（05 §3.5）：2026-09-24 曾用「self 连续丢 30 帧」触发停机，结果在重生/长遮挡间隙
//    误杀（v0.6.0 首跑 alive 仅 136s）——**那种不可靠判据禁止复活**；`selfLostFrames` 只落日志。
//    另一自动退出 = 20 分钟防呆上限（正常走不到，判死会先停）。
var MAX_EPISODE_MS = 20 * 60 * 1000;   // 硬上限，防呆死循环

// ==================== 快循环：本地几何 ====================

/** 依据当前策略取权重；策略过期或不可用则回退到 config 的默认权重 */
function pickWeights() {
  var now = Date.now();
  if (latestPolicy && (now - latestPolicy.at) <= CFG.POLICY_TTL_MS) {
    var w = conf.POLICY_WEIGHTS[latestPolicy.policy];
    if (w) { return w; }
  }
  return { wEat: CFG.W_EAT, wAvoid: CFG.W_AVOID, wEdge: CFG.W_EDGE };
}

/**
 * 全权驾驶方向解析（2026-09-25 老板拍板"全权级"）：
 * JEV 的 steer 指令直接决定摇杆方向；本地几何不再合成方向，只保留蓝图确认的**硬护栏**：
 *   ① 贴脸死球最小偏转：威胁球 dist < self.r×JEV_IMMINENT_DIST_FACTOR 且 JEV 方向指向它
 *      ⇒ 叠加远离分量（不夺取方向盘，只防"把摇杆怼进球嘴"）；
 *   ② 贴死边界掐分量：方向指向 bounds≤EDGE_MARGIN 的边界 ⇒ 掐掉该轴向分量；
 *   ③ 方向被掐光 ⇒ 回退本地基线向量（computeAim 结果）。
 *   ④ 逃命分身反射（escapeReflex，独立函数，优先级最高；2026-09-25 老板拍板）。
 * maintain = 沿用当前生效方向（control.lastDir）。
 * @return {x,y} 未归一化方向向量（control.push 内部会归一）
 */
function driveVector(state, steer, aimRes) {
  var vx = steer.vx, vy = steer.vy;
  if (steer.dir === "maintain") {
    var ld = control.getLastDir();
    vx = ld.x; vy = ld.y;
  }
  var imminent = CFG.JEV_IMMINENT_DIST_FACTOR * Math.max(state.self.r, 1);
  var i, b;
  for (i = 0; i < state.balls.length; i++) {
    b = state.balls[i];
    if (!b.threat || b.dist >= imminent || b.dist <= 0) { continue; }
    if (vx * b.dx + vy * b.dy > 0) {   // JEV 方向指向贴脸威胁 ⇒ 最小偏转
      vx -= b.dx / b.dist;
      vy -= b.dy / b.dist;
    }
  }
  var m = CFG.EDGE_MARGIN;
  if (vx > 0 && state.bounds.right <= m) { vx = 0; }
  if (vx < 0 && state.bounds.left <= m) { vx = 0; }
  if (vy > 0 && state.bounds.bottom <= m) { vy = 0; }
  if (vy < 0 && state.bounds.top <= m) { vy = 0; }
  if (vx * vx + vy * vy < 1e-6) { return { x: aimRes.x, y: aimRes.y }; }
  return { x: vx, y: vy };
}

/**
 * 硬护栏④ 逃命分身反射（2026-09-25 老板拍板：本地逃命 + JEV 管突进）。
 * 机制依据（00 契约）：场上除我方外全是机器人，且机器人追不上分身弹射后的球
 *   ⇒ 被吞前弹射 = 几乎必成的逃命。这是半秒级的决定，1.5s 一拍的慢循环天然太慢 ⇒ 本地反射。
 * 触发：最贴的威胁球表面间距 gap = dist-(self.r+b.r) < self.r×GAP_FACTOR（还差半个身位就贴上）。
 * 方向：返回背离威胁的逃离向量，**临时压过 JEV/基线**（逃命瞬间方向盘归本地，解除即归还）。
 * 分身+吐孢（2026-09-25 老板拍板两键齐发）：当前朝向已明显背离威胁（dot < -MIN_DOT）才按——
 *   朝向不对先掰方向，下一拍再按；冷却 COOLDOWN_MS 防瞬间连碎成一堆小块；n≥16 游戏封顶按了无效。
 * @return {flee:{x,y}|null, split:0|1, spit:0|1, gap:number}
 */
function escapeReflex(state) {
  var out = { flee: null, split: 0, spit: 0, gap: -1 };
  if (!CFG.SPLIT_REFLEX) { return out; }
  var now = Date.now();
  if (now - lastReflexSplitAt < CFG.SPLIT_REFLEX_COOLDOWN_MS) { return out; }
  var worst = null, worstGap = 0, i, b;
  for (i = 0; i < state.balls.length; i++) {
    b = state.balls[i];
    if (!b.threat || b.dist <= 0) { continue; }
    var gap = b.dist - (state.self.r + b.r);
    if (worst === null || gap < worstGap) { worst = b; worstGap = gap; }
  }
  if (!worst || worstGap >= CFG.SPLIT_REFLEX_GAP_FACTOR * Math.max(state.self.r, 1)) { return out; }
  out.gap = worstGap;
  out.flee = { x: -worst.dx, y: -worst.dy };   // 逃离方向 = 两心连线的反向
  var ld = control.getLastDir();
  if (ld.x * worst.dx + ld.y * worst.dy < -CFG.SPLIT_REFLEX_MIN_DOT &&
      state.self.n < CFG.JEV_SPLIT_MAX_PIECES) {
    out.split = 1;
    out.spit = 1;   // 2026-09-25 老板拍板：两键齐发，提速手段一次用尽（代价 ≈3% 质量/次）
    lastReflexSplitAt = now;
  }
  return out;
}

/**
 * 本地几何（references/03 §三）：
 *   追吃 = 价值最高的可吃球  value = r / gap
 *   闪避 = 危险度最高的威胁球  danger = 1 / ttc
 *   贴边 = 距边过近时加一个指向场地中心的向量
 *   兜底 = 无目标时缓慢绕圈，绝不停住
 *
 * 2026-09-25：合成逻辑已抽到 `lib/aim.js#decompose`（纯模块、零 AutoJs6 依赖 ⇒ 可离线冒烟）。
 * 本函数只剩"取原始向量 → 归一化 → 平滑"三步；**normalize/smooth 的唯一实现仍在 control.js**，
 * 不复制到 aim.js，避免双写副本。
 * ⚠️ prevDir 必须从 control 取后**传参**进 decompose：不跨模块取状态（require 实例分裂，05 §3.4）。
 */
function computeAim(state, weights) {
  var prevDir = control.getLastDir();
  var dec = aim.decompose(state, weights, prevDir);
  var dirRaw = control.normalize(dec.vx, dec.vy);
  var dir = control.smooth(dirRaw, prevDir, CFG.SMOOTH_ALPHA);
  return { x: dir.x, y: dir.y, raw: dirRaw, dbg: dec.dbg };
}

// ==================== 慢循环：JEV ====================

function startSlowLoop() {
  threads.start(function () {
    var fails = 0;
    var disabled = false;
    var prevSnap = null;   // 上一慢拍的球位置快照（is_pursued 的运动信息来源，04 §二；感知层 vx/vy 是死字段）

    // 压缩局面摘要：随 ev=jev 落日志，供离线标定与误差分析（不落全量 state，控日志体积）
    function snapDigest(s) {
      var nt = 0, ne = 0, dminThr = -1, i, b;
      for (i = 0; i < s.balls.length; i++) {
        b = s.balls[i];
        if (b.threat) { nt++; if (dminThr < 0 || b.dist < dminThr) { dminThr = b.dist; } }
        if (b.edible) { ne++; }
      }
      return { r: s.self.r, nb: s.balls.length, nt: nt, ne: ne,
               dmin_thr: dminThr, b: [s.bounds.left, s.bounds.right, s.bounds.top, s.bounds.bottom] };
    }
    // prev 快照：只留几何字段（球的对应关系交给模型判，不写易错的跨帧匹配代码）
    function takePrev(ts) {
      var arr = [], n = Math.min(latestState.balls.length, CFG.JEV_MAX_BALLS), i, b;
      for (i = 0; i < n; i++) {
        b = latestState.balls[i];
        arr.push({ dx: b.dx, dy: b.dy, dist: b.dist, r: b.r, size_ratio: b.size_ratio });
      }
      return { ts: ts, balls: arr };
    }

    while (running) {
      try {
        if (CFG.ENABLE_JEV && !disabled && latestState) {
          var t0 = Date.now();
          // 附上 prev（龄期超限不发，问题措辞里已写明退化口径）
          var stateForJev = latestState;
          if (prevSnap && (t0 - prevSnap.ts) <= CFG.JEV_PREV_MAX_AGE_MS) {
            stateForJev = {};
            for (var pk in latestState) { stateForJev[pk] = latestState[pk]; }
            stateForJev.prev = { age_ms: t0 - prevSnap.ts, balls: prevSnap.balls };
          }
          var r = jev.call(stateForJev);
          var ms = Date.now() - t0;

          if (r) {
            fails = 0;
            if (CFG.JEV_MODE === "record") {
              // ★记录模式：只落日志，不写任何策略——快循环行为与纯基线完全一致（采数期）。
              logger.write({
                ev: "jev", ok: 1, ms: ms, usage: r.usage, record: 1,
                snap: snapDigest(latestState), raw: r.answers
              });
            } else {
              // ★全权驾驶（2026-09-25 老板拍板）：steer/split/spit 直接生效；full 再加 posture 权重。
              var drive = jev.translateDrive(r.answers);
              drive.at = Date.now();
              drive.ms = ms;
              latestDrive = drive;
              if (CFG.JEV_MODE === "full") {
                latestPolicy = jev.translate(r.answers, conf.THRESHOLDS);
                latestPolicy.ms = ms;
              }
              logger.write({
                ev: "jev", ok: 1, ms: ms, usage: r.usage, mode: CFG.JEV_MODE,
                steer: drive.steer.dir, split: drive.split, spit: drive.spit,
                snap: snapDigest(latestState), raw: r.answers
              });
            }
          } else {
            fails++;
            logger.write({ ev: "jev", ok: 0, ms: ms, fails: fails });
            if (fails >= CFG.JEV_FAIL_LIMIT) {
              disabled = true;
              logger.write({ ev: "jev_off", reason: "连续失败达上限，切纯基线模式" });
            }
          }
          // 本拍状态成为下一拍的 prev（成功失败都刷新；age_ms 在下一拍发前现算）
          prevSnap = takePrev(Date.now());
        }
      } catch (e) {
        // 401 / 422 属于配置或代码问题，不重试
        logger.write({ ev: "jev_fatal", err: String(e) });
        disabled = true;
      }
      sleep(CFG.SLOW_TICK_MS);
    }
  });
}

/**
 * 开局倒计时悬浮窗（2026-09-24 加，用户硬要求）：
 * 「你执行脚本之后我根本不知道你有没有开始，不知道该什么时候观察」⇒ 开跑前先给提示。
 *
 * 做法：屏幕上方挂**小块**窗口（避开左下摇杆区与右侧按键区），依次显示
 *   「AI 接管：3 秒后开始」→ 3 → 2 → 1 → 「开始！」，然后关窗开跑。
 *
 * ⚠️ 全程 try-catch：悬浮窗只是提示，**任何一步失败都必须照常开跑**，绝不能挡住主流程。
 * ⚠️ 窗口做成小块且不吃触摸（实测：带此窗下发摇杆手势，圆盘仍落在摇杆原位）。
 */
function startCountdown() {
  if (!CFG.SHOW_START_COUNTDOWN) { return; }
  var win = null;
  try {
    win = floaty.rawWindow(
      <frame id="root" w="*" h="*" bg="#DD000000">
        <text id="tv" text="准备" textSize="46sp" textColor="#FFFFFF" gravity="center" w="*" h="*" />
      </frame>
    );
    win.setSize(1500, 280);
    win.setPosition(Math.round(CFG.SCREEN_W / 2) - 750, 20);
  } catch (eWin) {
    return;   // 建窗失败就直接开跑，不拖累主流程
  }

  function say(t) {
    try {
      ui.run(function () { try { win.findView("tv").setText(t); } catch (e1) {} });
    } catch (e2) {
      try { win.findView("tv").setText(t); } catch (e3) {}
    }
  }

  try {
    say("AI 接管：3 秒后开始");
    sleep(1200);
    for (var ci = 3; ci >= 1; ci--) {
      say(String(ci));
      sleep(CFG.START_COUNTDOWN_MS);
    }
    say("开始！");
    sleep(600);
  } catch (e4) {}

  try { win.close(); } catch (e5) {}
  try { floaty.closeAll(); } catch (e6) {}
}

// ==================== 状态悬浮条（2026-09-24 加，用户要求）====================
/*
 * 屏幕顶部常驻小块，实时显示三项（用户原话）：
 *   ① 识别到几个球是自己的（self_n）——**self 丢失期改显"丢N帧"**（0.6.6）
 *   ② 当前是游戏界面还是非游戏界面（被吃后的画面都算非游戏界面）
 *   ③ 球是活着还是死了
 * 数据源：self_n / 丢帧数 ← vision 与主循环；界面/生死 ← roundTracker 状态机（boot/playing/dying/over）。
 *
 * ⚠️ 0.6.6 修（老板 2026-09-25 02:00 反馈，见 05 §4.4 观察项）：旧口径下 self 已连丢 13 帧仍显示
 *    `自:0 ｜ 游戏界面 ｜ 活`（看着像一切正常）。现口径 = **丢帧数 > 0 就显"丢N帧"，且生死段
 *    绝不说"活"**。文本规则抽到纯模块 `lib/hud-text.js`，由 `verify/pc/qiu-hud-smoke.js` 离线守
 *    两条不变式（丢失期不说"活" / 全文 ≤ 16 全角格）。
 * ⚠️ 与倒计时窗同款约束：小块、不吃触摸、全程 try-catch，失败绝不挡主流程。
 * ⚠️ 文本有变化才 setText（self_n 与状态都低频变化，避免每帧刷 UI）。
 */
var statusWin = null;
var lastHudText = "";

function startStatusHud() {
  if (statusWin) { return; }
  try {
    statusWin = floaty.rawWindow(
      <frame id="root" w="auto" h="auto" bg="#CC000000">
        <text id="tv" text="HUD 启动中" textSize="13sp" textColor="#FFFFFF"
              paddingLeft="12" paddingRight="12" paddingTop="5" paddingBottom="5" />
      </frame>
    );
    // ⚠️ 与倒计时窗同款：显式像素尺寸（-2/WRAP_CONTENT 有落成 0 尺寸不可见的风险，实测倒计时 px 方案可见）
    statusWin.setSize(720, 84);
    statusWin.setPosition(Math.round(CFG.SCREEN_W / 2) - 360, 8);
    updateHud("HUD 就绪");
    logger.write({ ev: "hud", ok: 1, w: 720, h: 84 });
  } catch (e) {
    statusWin = null;
    try { logger.write({ ev: "hud", ok: 0, err: String(e) }); } catch (e2) {}
  }
}

// HUD 文本口径的唯一实现 = lib/hud-text.js（纯模块，离线回归 qiu-hud-smoke.js 守着）。
// 这里不再自带一份文案，避免"文档写了、代码是另一套"的双写分裂（05 §3.4 的教训同源）。

function updateHud(text) {
  if (!statusWin || text === lastHudText) { return; }
  lastHudText = text;
  try {
    ui.run(function () { try { statusWin.findView("tv").setText(text); } catch (e1) {} });
  } catch (e2) {}
}

function stopStatusHud() {
  try { if (statusWin) { statusWin.close(); } } catch (e) {}
  statusWin = null;
}

// ==================== 生命周期 ====================

function isEpisodeOver() {
  if (!running) { return true; }
  // ★判死即停（2026-09-25 老板指令）：签名确认死亡 → 立即停机，不再盲等重生。
  if (roundOverConfirmed) { if (!stopReason) { stopReason = "death_confirmed"; } return true; }
  // 防呆上限（正常走不到：判死会先停）
  if (Date.now() - bornAt > MAX_EPISODE_MS) { stopReason = "max_episode_ms"; return true; }
  return false;
}

/**
 * 截图权限：顺序按 autojs 技能 references/截图权限与弹框处理.md —— **必须先起子线程点弹窗、再申请**。
 * ⚠️ 2026-09-23 修：原实现直接在子线程里调 requestScreenCapture()，没点系统授权弹窗，
 *    真机首次运行会卡在「立即开始」对话框上。现按已验证过的 temp/qiu-spit-capture.js 写法对齐。
 */
function requestCapture() {
  // 2026-09-23 加日志：本函数里的 b.click() 是**全工程唯一一处"非摇杆"触摸**。
  // 若它匹配到的节点 bounds 退化（如 [0,0,0,0]），点击有可能落到 (0,0)=屏幕左上角；
  // 而摇杆是跟手的 ⇒ 左上角会当场出现摇杆。故把节点文本/bounds/点击结果全部落盘备查。
  var dlg = { found: 0, text: null, bounds: null, clicked: null, err: null };
  threads.start(function () {
    try {
      var b = textMatch(/立即开始|开始截图|开始使用|立即启用|START NOW/).clickable(true).findOne(3000);
      if (b) {
        dlg.found = 1;
        try { dlg.text = b.text(); } catch (e0) {}
        try {
          var bb = b.bounds();
          dlg.bounds = [bb.left, bb.top, bb.right, bb.bottom];
        } catch (e1) {}
        try { dlg.clicked = b.click() ? 1 : 0; } catch (e2) { dlg.clicked = -1; }
      }
    } catch (e) { dlg.err = String(e); }
    try { logger.write({ ev: "capture_dialog", dlg: dlg }); } catch (e3) {}
  });
  sleep(400);
  var ok = false;
  try { ok = requestScreenCapture(); } catch (e) { ok = false; }
  sleep(1200);
  return ok;
}

// ==================== 主循环 ====================

function runLoop() {
  var frame = 0;
  // 局边界裁决器 + 死因回放缓冲（death_tail 用，只观察不干预）
  var roundTracker = round.createRoundTracker({ log: logger, images: images, cfg: CFG });
  var recentFrames = [];
  startStatusHud();

  while (true) {
    var t0 = Date.now();

    try {
      var shot = captureScreen();
      var state = vision.perceive(shot, frame);

      if (state) {
        selfLostFrames = 0;
        latestState = state;

        var weights = pickWeights();
        var aimRes = computeAim(state, weights);   // ⚠️ 不要命名 aim —— 会遮蔽模块 aim（drive 模式下作护栏兜底）
        var driveFresh = latestDrive && (Date.now() - latestDrive.at) <= CFG.JEV_DRIVE_TTL_MS;
        var reflex = escapeReflex(state);          // 硬护栏④：逃命分身反射，优先级最高（drive 与基线之上）
        var sent;
        if (reflex.flee) {
          // ★逃命反射接管：方向背离最贴的威胁；朝向已背对才按键（分身+吐孢两键齐发，冷却内只掰方向不按键）
          sent = control.push(reflex.flee.x, reflex.flee.y, CFG.JEV_STEER_SPEED);
          if (reflex.split) { control.split(1); }
          if (reflex.spit) { control.spit(1); }
        } else if (CFG.JEV_MODE !== "record" && driveFresh) {
          // ★全权驾驶：方向听 JEV 的（本地只留硬护栏）；按键边触发——一条指令只按一次
          var dv = driveVector(state, latestDrive.steer, aimRes);
          sent = control.push(dv.x, dv.y, CFG.JEV_STEER_SPEED);
          if (latestDrive.at !== lastDriveCmdAt) {
            lastDriveCmdAt = latestDrive.at;
            if (latestDrive.split && state.self.n < CFG.JEV_SPLIT_MAX_PIECES) { control.split(1); }
            if (latestDrive.spit) { control.spit(1); }
          }
        } else {
          sent = control.push(aimRes.x, aimRes.y);   // record 模式 / 指令过期 / JEV 失效 ⇒ 本地基线
        }

        // 决策层向量分解日志（主线第一步：定位"旁边有小球也不去吃"）
        // 只读观测，关掉行为完全一致（唯一动作是写一行日志）。
        if (CFG.AIM_DEBUG && (frame % CFG.AIM_DEBUG_EVERY === 0)) {
          var stk = control.getStickState();
          var d = aimRes.dbg;
          d.ev = "aim";
          d.f = frame;
          // 自带 self 尺寸/碎片数："旁边"要按自己的体量度量（dist/self_r），否则离线分析还得回查帧行
          d.self_r = state.self.r;
          d.self_n = state.self.n;
          d.aim = [Math.round(aimRes.x * 100) / 100, Math.round(aimRes.y * 100) / 100];
          // sent=0 表示档位未变、**本帧没有下发**（方向仍锁存在游戏侧），不是失败
          d.sent = sent ? 1 : 0;
          d.key = stk.key;
          d.key_ago_ms = stk.agoMs;
          logger.write(d);
        }

        var nEdible = 0, nThreat = 0;
        for (var i = 0; i < state.balls.length; i++) {
          if (state.balls[i].edible) { nEdible++; }
          if (state.balls[i].threat) { nThreat++; }
        }

        // 按键下发审计：只有"发出过新请求"时才落一行（含实测间距与速率，供核查防外挂红线）
        var clk = control.getClickStats();
        if (clk.spitSent !== lastLoggedSpit || clk.splitSent !== lastLoggedSplit) {
          lastLoggedSpit = clk.spitSent;
          lastLoggedSplit = clk.splitSent;
          logger.write({
            ev: "clicks",
            spit: [clk.spitSent, clk.spitOk, clk.spitFail],
            split: [clk.splitSent, clk.splitOk, clk.splitFail],
            dropped: clk.dropped,
            lastGapMs: clk.lastGapMs,
            rate: clk.ratePerSec,
            err: clk.lastErr
          });
        }

        logger.write({
          f: frame,
          self_r: state.self.r,
          self_n: state.self.n,
          n_balls: state.balls.length,
          n_edible: nEdible,
          n_threat: nThreat,
          aim: [Math.round(aimRes.x * 100) / 100, Math.round(aimRes.y * 100) / 100],
          policy: latestPolicy ? latestPolicy.policy : "baseline",
          policy_age_ms: latestPolicy ? (Date.now() - latestPolicy.at) : -1,
          drive: (CFG.JEV_MODE !== "record" && driveFresh) ? latestDrive.steer.dir : null,
          drive_age_ms: latestDrive ? (Date.now() - latestDrive.at) : -1,
          reflex: reflex.split ? 2 : (reflex.flee ? 1 : 0),
          reflex_gap: Math.round(reflex.gap),
          frame_ms: state.stats.frame_ms,
          ms_resize: state.stats.resize_ms,
          ms_getpx: state.stats.getpx_ms,
          ms_scan: state.stats.scan_ms,
          runs: state.stats.runs,
          hits: state.stats.hits,
          dup: state.dup ? 1 : 0,
          bounds: [state.bounds.left, state.bounds.right, state.bounds.top, state.bounds.bottom],
          err: null,
          // 摇杆越界守卫：null = 全程所有手势坐标都在摇杆圆盘内（即"摇杆跑到别处"不是本脚本干的）
          guard: control.getGuard()
        });

        // 局边界观察：self 可见 → 记/翻状态；同时维护死因回放缓冲
        roundTracker.onSelfFound(frame);
        recentFrames.push({
          f: frame, self_r: state.self.r, self_n: state.self.n,
          n_threat: nThreat, n_edible: nEdible, t: Date.now()
        });
        if (recentFrames.length > 8) { recentFrames.shift(); }
        var driveHud = (CFG.JEV_MODE !== "record" && driveFresh)
          ? hudText.driveLabel(latestDrive.steer.dir, latestDrive.split, latestDrive.spit)
          : null;
        updateHud(hudText.format(state.self.n, roundTracker.getState(), 0, driveHud));
      } else {
        selfLostFrames++;
        logger.write({ f: frame, err: "self_not_found", lost: selfLostFrames });
        // 局边界观察：self 丢失 → 可能进 DYING / 确认死亡（裁决只落日志+存图，不改控制流）
        var roundEv = roundTracker.onSelfLost(frame, shot);
        if (roundEv && roundEv.type === "round_end") {
          // ★判死即停：置顶层标志 ⇒ 本帧末尾 isEpisodeOver() 返回 true ⇒ break ⇒ 走正常收尾退出
          roundOverConfirmed = roundTracker.isRoundOver();
          stopReason = "death:" + (roundEv.why || "?");
          logger.write({ ev: "death_tail", frames: recentFrames.slice(-5) });
        }
        // 0.6.6：HUD 立刻反映当前丢帧数 / 状态（round_end 那一帧会显"判死确认 ｜ 死·停"）
        var lostHud = hudText.format(0, roundTracker.getState(), selfLostFrames);
        updateHud(lostHud);
        // 判死帧把最终 HUD 文案落进日志：日后不必靠截图就能核对"HUD 当时到底显示什么"
        if (roundOverConfirmed) {
          logger.write({ ev: "hud_final", text: lostHud, lost: selfLostFrames, hold_ms: CFG.HUD_DEATH_HOLD_MS });
        }
      }
    } catch (e) {
      logger.write({ f: frame, err: "frame_exception: " + String(e) });
    }

    if (isEpisodeOver()) { break; }

    frame++;
    var wait = CFG.TICK_MS - (Date.now() - t0);
    if (wait > 0) { sleep(wait); }
  }
}

// ==================== 启动 ====================

try {
  // 圆形按键坐标不落代码：先从手机端 storages "qiu-btn" 读回（取法见 references/01 §三）
  var btnRes = conf.hydrateButtons();
  if (!btnRes.ok) {
    throw new Error("圆形按键几何未就绪：" + btnRes.err);
  }
  conf.assertCalibrated();
  aim.init(CFG);      // 依赖注入：lib/aim.js 的 ../config 也是另一实例（同下 control 的坑）
  control.init(CFG);   // ⚠️ 依赖注入：lib 各模块 require("../config") 与这里的 ./config 不是同一实例
                       //    （2026-09-24 真机实测 sameRef:false，见 references/05 §3.4）——不注入，
                       //    control 拿到的按键几何全是 0，首跑"圆盘锚死左上角"就是这个原因。
  // 同一根因的另一处：感知层的 UI 几何。不注入 = 亮面车道会把摇杆白旋钮（r≈130px，
  // 甩杆时可跑到离底盘心 275px）、吐孢子白箭头、分身白条当成球（2026-09-24 §3.6 实测）。
  // 语义：只丢「质心落区内 **且整簇无彩色**」的簇 ⇒ 彩色球压在按键底下照样看得见。
  vision.setStick(CFG.STICK_CENTER_X, CFG.STICK_CENTER_Y, CFG.STICK_MAX_RADIUS);
  vision.setUiButtons([
    [CFG.BTN_SPIT_CX, CFG.BTN_SPIT_CY, CFG.BTN_SPIT_R],
    [CFG.BTN_SPLIT_CX, CFG.BTN_SPLIT_CY, CFG.BTN_SPLIT_R]
  ]);
  logger.init();

  if (!requestCapture()) {
    throw new Error("截图权限申请失败（请确认已授权，且屏幕处于点亮状态）");
  }

  // 预热：授权后最初一两帧常是黑屏/空帧（实测首帧 self_r=8 的假值就是这么来的，
  // 会把周围所有球误判成威胁）。丢弃 2 帧再进主循环。
  // ⚠️ 不要对 captureScreen() 的返回值调 recycle()：AutoJs6 文档明确该对象由**截图模块
  //    托管**（缓存并更新），手动回收可能破坏它的内部缓存。丢引用即可。
  for (var wi = 0; wi < 2; wi++) {
    try { captureScreen(); } catch (we) { /* 忽略 */ }
    sleep(120);
  }

  logger.write({ ev: "start", version: "0.8.0", enable_jev: CFG.ENABLE_JEV, jev_mode: CFG.JEV_MODE, aim_debug: CFG.AIM_DEBUG ? CFG.AIM_DEBUG_EVERY : 0, btns: {
    stick: [CFG.STICK_CENTER_X, CFG.STICK_CENTER_Y, CFG.STICK_MAX_RADIUS],
    spit: [CFG.BTN_SPIT_CX, CFG.BTN_SPIT_CY, CFG.BTN_SPIT_R],
    split: [CFG.BTN_SPLIT_CX, CFG.BTN_SPLIT_CY, CFG.BTN_SPLIT_R],
    rot: CFG.BTN_ROT
  }, downscale: CFG.DOWNSCALE, tick_ms: CFG.TICK_MS, click_press_ms: CFG.CLICK_PRESS_MS,
     click_max_per_sec: CFG.CLICK_MAX_PER_SEC });
  control.setLastDir(1, 0);
  control.resetFinger();
  control.startClicker();   // 按键（吐孢/分身）走独立 press 线程，见 lib/control.js
  if (CFG.ENABLE_JEV) { startSlowLoop(); }   // 0.8.0：JEV 下线（老板 2026-09-25）⇒ 慢循环线程都不起

  startCountdown();   // 开局倒计时（悬浮窗提示，用户 2026-09-24 硬要求）；失败也不影响开跑
  runLoop();

  running = false;
  control.stopClicker();
  control.release();
  // ★判死后 HUD 停留（0.6.6）：签名确认判死与截图同帧，HUD 更新后毫秒级就要关窗 ⇒ 老板根本来不及
  //   看清最终态（上一局留下的还是「自:0 ｜ 游戏界面 ｜ 活」，见 05 §4.4）。这里把窗口多留一会儿。
  //   纯显示：**期间零输入**（不碰游戏菜单），也不改变停机判据与停机时刻的决定，只延后关窗与退出。
  if (roundOverConfirmed && CFG.HUD_DEATH_HOLD_MS > 0) {
    try { sleep(CFG.HUD_DEATH_HOLD_MS); } catch (eHold) { /* 忽略：停留失败不影响收尾 */ }
  }
  stopStatusHud();
  var clkEnd = control.getClickStats();
  logger.write({
    ev: "end",
    stop_reason: stopReason,
    alive_ms: Date.now() - bornAt,
    pushes: control.getPushCount(),
    clicks: {
      spit: [clkEnd.spitSent, clkEnd.spitOk, clkEnd.spitFail],
      split: [clkEnd.splitSent, clkEnd.splitOk, clkEnd.splitFail],
      dropped: clkEnd.dropped,
      minGapMs: clkEnd.minGapMs, maxGapMs: clkEnd.maxGapMs, rate: clkEnd.ratePerSec
    }
  });
  logger.flush();

  result = {
    ok: 1,
    msg: "本局结束（判死自停）",
    stop_reason: stopReason,
    alive_ms: Date.now() - bornAt,
    log: logger.filePath()
  };
} catch (e) {
  running = false;
  console.error("[main] 执行出错: " + e);
  try { control.stopClicker(); } catch (e4) { /* 忽略 */ }
  try { control.release(); } catch (e2) { /* 忽略 */ }
  try { stopStatusHud(); } catch (e5) { /* 忽略 */ }
  try { logger.write({ ev: "fatal", err: String(e) }); logger.flush(); } catch (e3) { /* 忽略 */ }
  result = { ok: 0, err: String(e), log: logger.filePath() };
}

// 退出时回传结果（与任务模板同一机制）
events.on("exit", function () {
  try {
    events.broadcast.emit("autojs_result", JSON.stringify(result));
  } catch (e) {
    console.error("[main] 回执广播失败: " + e);
  }
});
