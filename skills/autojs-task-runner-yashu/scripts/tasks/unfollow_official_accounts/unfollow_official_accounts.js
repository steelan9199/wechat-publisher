/* ============================================================================
 * 取消关注公众号（通讯录 → 公众号 列表页 · 长按直接取关）
 * ----------------------------------------------------------------------------
 * 起点：手机已停在「通讯录 → 公众号」列表页（顶部有「公众号」标题）。
 *
 * 关键事实（来自实测）：
 *   - 该列表页【禁止 AutoJS 无障碍分析】→ 列表相关操作全部用 OCR + 坐标。
 *   - 长按列表项后弹出的「不再关注」小弹框【是唯一能用无障碍分析到的】，
 *     它是一个 textView，可用 textContains("不再关注") 找到并点击。
 *   - 点完小弹框后的「确认框」（含「仍然关注」「不再关注」）【无障碍分析不到】
 *     → 用 OCR 找「不再关注」文字坐标再点击。
 *
 * 单轮取关流程：
 *   1) 列表页截图 OCR → 找「公众号」标题 → 其下方第一个公众号 → 取坐标
 *   2) 长按该坐标 1 秒（press 按住 1000ms）→ 弹出「不再关注」小弹框（无障碍可分析）
 *   3) 无障碍点「不再关注」→ 弹出确认框（含「仍然关注」「不再关注」，OCR 分析）
 *   4) OCR 找「不再关注」坐标 → 点击 → 等待 3 秒 → 回到列表页
 *
 * 每轮只点「第一个」公众号：本列表取消关注后下方项不重排，第一个恒为已关注号。
 * 因此每轮重新截图挑选最靠上的第一个公众号即可，无需关心项是否上移。
 * ========================================================================== */

/* === 依赖全局（手机端 AutoJS 运行时提供）===
 * captureScreen / ocr.detect / click / sleep / gestures / longClick
 * textContains / events / media / threads / files / requestScreenCapture
 */

/* ==================================================================
 * 参数与结果
 * ================================================================== */
function readArgs() {
  try {
    return JSON.parse(files.read("/sdcard/脚本/task_args.json"));
  } catch (e) {
    return {};
  }
}
// 基准设为“成功”：只有命中异常分支才改成 ok:0，便于 onExit 判断是否响铃
var result = { ok: 1, msg: "取关完成", unfollowed: 0 };
var MAX_LOOP = 2000;

/* ==================================================================
 * 零、异常声音提醒（与旧脚本一致）
 * 异常/未正常完成停止时，重复 10 次 beep、每次间隔 2 秒，约 23 秒提醒。
 * 注意：/sdcard/Download/beep.wav 需事先存在，否则 media 抛错（已被 try 吞掉）。
 * ================================================================== */
function playBeep() {
  media.playMusic("/sdcard/Download/beep.wav");
  var duration = media.getMusicDuration();
  sleep(duration);
}
function alertErrorSound() {
  var i;
  for (i = 0; i < 10; i = i + 1) {
    playBeep();
    if (i < 9) { sleep(2000); }   // 前 9 次播完后停顿 2 秒，第 10 次不再等待
  }
}
// 统一退出处理：仅“非正常完成”才响；正常取关完成（ok:1）不响
function onExit() {
  if (!result || result.ok !== 1) {
    try { alertErrorSound(); } catch (e2) { /* 声音失败不影响结果回传 */ }
  }
  events.broadcast.emit("autojs_result", JSON.stringify(result));
}
events.on("exit", onExit);   // 注册一次，覆盖所有 exit() 路径

/* ==================================================================
 * 一、日志工具（三要素：① 当前页面/准备做什么 ② 操作完处于哪页 ③ 是否通过审核）
 * ================================================================== */
function pageName(p) {
  if (p === "LIST") { return "公众号列表页(通讯录)"; }
  if (p === "POPUP") { return "长按菜单弹框(不再关注)"; }
  if (p === "CONFIRM") { return "确认取消关注弹框"; }
  return "未知页面";
}
function logStep(from, op) {
  console.log("[当前页面] " + pageName(from) + "　[准备操作] " + op);
}
function logResult(p) {
  console.log("[操作完成] 当前处于：" + pageName(p));
}
function logCheck(actual, expect) {
  if (actual === expect) {
    console.log("[页面审核] 通过✅ 期望=" + pageName(expect) + "，实际=" + pageName(actual));
  } else {
    console.log("[页面审核] 未通过❌ 期望=" + pageName(expect) + "，实际=" + pageName(actual));
  }
}

/* ==================================================================
 * 二、OCR 辅助（列表页/确认框都用 OCR，因这俩无障碍分析不到）
 * ================================================================== */
// 杂字过滤（来自实测页面规则）：
//   通知栏下方只有「公众号」标题；标题之下、且非单个 A–Z/# 字母的项，必定是公众号。
//   因此只排除「标题本身」与「右侧 A–Z/# 索引字母」，其余一律视为可点击取关的公众号——
//   绝不用子串过滤（否则「按键精灵公众号」这类名字会被误杀而永远留着）。
function isChrome(t) {
  if (!t) { return true; }
  if (t === "公众号" || t === "订阅号" || t === "订阅号消息") { return true; } // 标题本身
  if (/^[A-Za-z#]{1,3}$/.test(t)) { return true; }   // 右侧 A-Z / # 索引字母（含 OCR 粘连成 2~3 字母的情况，如 EF/ABC）
  return false;
}
// 屏幕顶部 1/3 是否含「公众号」标题 → 判定在列表页
function topHasOfficial(det, img) {
  var i;
  for (i = 0; i < det.length; i = i + 1) {
    if (det[i].text && det[i].text.indexOf("公众号") >= 0) {
      if (det[i].bounds.top < img.height / 3) { return true; }
    }
  }
  return false;
}
function isOnListPage() {
  var img = captureScreen();
  if (!img) { return false; }
  var det = ocr.detect(img);
  return topHasOfficial(det, img);
}
// 取「公众号」标题的下边缘（取最靠上的那个标题的 bottom）
function titleBottom(det, img) {
  var i, topMost = -1, b = 0;
  for (i = 0; i < det.length; i = i + 1) {
    if (det[i].text && det[i].text.indexOf("公众号") >= 0) {
      if (det[i].bounds.top < img.height / 3 && (topMost < 0 || det[i].bounds.top < topMost)) {
        topMost = det[i].bounds.top;
      }
    }
  }
  if (topMost < 0) { return 0; }
  for (i = 0; i < det.length; i = i + 1) {
    if (det[i].text && det[i].text.indexOf("公众号") >= 0 && det[i].bounds.top === topMost) {
      return det[i].bounds.bottom;
    }
  }
  return b;
}
// 从「公众号」标题下方挑第一个公众号（最靠上、非杂字、2~20 字）
function pickFirstAccount(det, img) {
  var i, o, t, tb, best;
  tb = titleBottom(det, img);
  best = null;
  for (i = 0; i < det.length; i = i + 1) {
    o = det[i];
    t = o.text;
    if (!t) { continue; }
    if (isChrome(t)) { continue; }
    if (t.length < 2 || t.length > 40) { continue; }  // 过滤索引字母/超长预览（上限放宽到 40，避免长名公众号如「Cherry Studio 全能AI工作站」被误杀）
    if (o.bounds.top <= tb) { continue; }             // 必须在「公众号」标题下方
    if (o.bounds.right > img.width * 0.88) { continue; } // 排除最右侧字母索引条区域（几何拦截，不依赖 OCR 文字内容）
    if (best == null || o.bounds.top < best.bounds.top) { best = o; }
  }
  return best;
}
// OCR 找含 sub 的项（子串，偏宽松容错 OCR 噪声），返回第一项
function findText(det, sub) {
  var i;
  for (i = 0; i < det.length; i = i + 1) {
    if (det[i].text && det[i].text.indexOf(sub) >= 0) { return det[i]; }
  }
  return null;
}
function hasText(det, sub) {
  return findText(det, sub) != null;
}
// 在确认框中定位「不再关注」按钮（右下角按钮，与「仍然关注」同水平线）。
// 关键陷阱：确认框标题也含「不再关注」（如"将不再关注该公众号？"），
//   且标题在屏幕顶部 → findText 会误返回标题而非按钮。
// 定位策略（两步都基于 OCR 坐标 bounds）：
//   1) 锚点法：用「仍然关注」（左侧按钮）包围盒做锚，找【在其右侧、且中心 Y 同排】的
//      「不再关注」→ 直接绕开顶部标题，最稳。
//   2) 兜底法：取下半屏（排除顶部标题区）中【最靠右】的「不再关注」→ 即右侧按钮。
function findUnfollowButton(det, img) {
  if (!det || !img) { return null; }
  var i, o, ry, rx;
  // 收集所有含「不再关注」的 OCR 项（标题、按钮都会命中）
  var all = [];
  for (i = 0; i < det.length; i = i + 1) {
    o = det[i];
    if (o.text && o.text.indexOf("不再关注") >= 0) { all.push(o); }
  }
  if (all.length === 0) { return null; }

  // —— 策略1：锚定左侧「仍然关注」按钮，找同排右侧的「不再关注」 ——
  var left = findText(det, "仍然关注");
  if (left != null) {
    var lx = (left.bounds.left + left.bounds.right) / 2;
    var ly = (left.bounds.top + left.bounds.bottom) / 2;
    var rowH = (left.bounds.bottom - left.bounds.top);
    var best = null, bestDy = 1e9;
    for (i = 0; i < all.length; i = i + 1) {
      o = all[i];
      rx = (o.bounds.left + o.bounds.right) / 2;
      ry = (o.bounds.top + o.bounds.bottom) / 2;
      if (rx > lx && Math.abs(ry - ly) <= rowH) {   // 必须在右、且与左按钮同水平行
        if (Math.abs(ry - ly) < bestDy) { bestDy = Math.abs(ry - ly); best = o; }
      }
    }
    if (best != null) { return best; }
  }

  // —— 策略2（兜底）：下半屏中最靠右的「不再关注」 ——
  var h = img.height;
  var cand = null, candX = -1;
  for (i = 0; i < all.length; i = i + 1) {
    o = all[i];
    ry = (o.bounds.top + o.bounds.bottom) / 2;
    if (ry > h * 0.5) {                              // 下半屏 = 按钮，排除顶部标题
      rx = (o.bounds.left + o.bounds.right) / 2;
      if (rx > candX) { candX = rx; cand = o; }      // 取最靠右的一个
    }
  }
  return cand;
}
// 点某个 OCR 项包围盒中心（与 ocr.detect 同坐标系，无需换算）
function clickCenter(o) {
  if (!o || !o.bounds) {
    throw new Error("clickCenter 收到空的点击目标（OCR 未定位），已停止");
  }
  var cx = (o.bounds.left + o.bounds.right) / 2;
  var cy = (o.bounds.top + o.bounds.bottom) / 2;
  click(cx, cy);
}

/* ==================================================================
 * 三、无障碍辅助（仅长按后的「不再关注」小弹框可用）
 * ================================================================== */
// 弹框是否出现：textView 含「不再关注」
function popupExists() {
  return textContains("不再关注").exists();
}
// 找到并点击小弹框的「不再关注」（textView，无障碍可分析）
function clickPopupNoMoreFollow(timeout) {
  var u = textContains("不再关注").findOne(timeout);
  if (u == null) { return false; }
  u.click();
  return true;
}

/* ==================================================================
 * 四、主流程
 * ================================================================== */
try {
  var args = readArgs();
  if (typeof args.maxLoop === "number" && args.maxLoop > 0) {
    MAX_LOOP = args.maxLoop;
  }

  // 截图权限前置：后台线程自动点「立即开始」，否则 captureScreen 会卡死/返回空
  threads.start(function () {
    text("立即开始").clickable(true).findOne(3000).click();
  });
  if (!requestScreenCapture()) {
    result = { ok: 0, err: "请求截图权限失败", unfollowed: 0 };
    exit();
  }
  sleep(800);

  var loopCount = 0;
  var done = 0;            // 已成功取关数
  var img, det, best, cx, cy, u, p, k, page, targetName;

  // ===== 初始：确认手机一开始就停在「公众号列表页」 =====
  logStep("初始", "确认手机处于公众号列表页(通讯录)");
  if (!isOnListPage()) {
    result = {
      ok: 0,
      err: "脚本开始时不在公众号列表页（顶部找不到'公众号'）。请先手动进入「通讯录→公众号」列表页，再运行脚本。",
      unfollowed: 0
    };
    console.log("[初始审核] 未通过❌ " + result.err);
    exit();
  }
  logResult("LIST");
  logCheck("LIST", "LIST");

  while (loopCount < MAX_LOOP) {
    loopCount = loopCount + 1;

    /* ---- 阶段一：列表页 → 选第一个公众号，长按 1 秒 -------------
     * 当前页面：LIST
     * 本步操作：截图 OCR 选最靠上的第一个公众号，长按其坐标 1 秒
     * 等待：长按 1 秒 + 400ms
     * 期望页面：POPUP（长按菜单弹框，含「不再关注」，无障碍可分析）
     * ---------------------------------------------------------- */
    logStep("LIST", "长按第一个公众号（准备弹出菜单）");
    sleep(300);                       // 等列表稳定
    img = captureScreen();
    det = ocr.detect(img);
    best = pickFirstAccount(det, img);
    if (best == null) {
      // 列表已空 → 取关完成
      result = { ok: 1, msg: "列表已空，取关完成", unfollowed: done };
      console.log("[名单校验] 通过✅ 公众号列表已空，取关完成，共 " + done + " 个");
      break;
    }
    targetName = best.text;
    cx = (best.bounds.left + best.bounds.right) / 2;
    cy = (best.bounds.top + best.bounds.bottom) / 2;
    console.log("[选中] 第一个公众号：" + targetName + " 坐标=(" + Math.round(cx) + "," + Math.round(cy) + ")");

    // 长按 1 秒（press 按住坐标 1000ms，触发长按菜单）
    press(cx, cy, 1000);
    sleep(400);

    // 审核：小弹框（不再关注）是否出现（无障碍）
    u = textContains("不再关注").findOne(3000);
    page = (u != null) ? "POPUP" : "UNKNOWN";
    logResult(page);
    logCheck(page, "POPUP");
    if (page !== "POPUP") {
      result = {
        ok: 0,
        err: "长按后未弹出「不再关注」菜单（无障碍未分析到），当前应处于长按菜单弹框，但实际不在。",
        unfollowed: done
      };
      break;
    }

    /* ---- 阶段二：点弹框的「不再关注」→ 期望确认框(OCR) ----------
     * 当前页面：POPUP（无障碍可分析）
     * 本步操作：无障碍点击小弹框的「不再关注」
     * 等待：700ms（确认框出现需要一点时间）
     * 期望页面：CONFIRM（含「仍然关注」或「不再关注」，OCR 分析）
     * ---------------------------------------------------------- */
    logStep("POPUP", "点击菜单中的「不再关注」");
    u.click();
    sleep(700);

    // 审核：确认框出现（OCR，含「仍然关注」或「不再关注」），多次重查防 OCR 漏识
    page = "UNKNOWN";
    for (k = 0; k < 4; k = k + 1) {
      img = captureScreen();
      det = ocr.detect(img);
      if (hasText(det, "仍然关注") || hasText(det, "不再关注")) { page = "CONFIRM"; break; }
      sleep(400);
    }
    logResult(page);
    logCheck(page, "CONFIRM");
    if (page !== "CONFIRM") {
      result = {
        ok: 0,
        err: "点击菜单「不再关注」后未出现确认弹框（找不到'仍然关注'/'不再关注'），当前应处于确认取消关注弹框，但实际不在。",
        unfollowed: done
      };
      break;
    }

    /* ---- 阶段三：OCR 点确认框的「不再关注」→ 等3秒 → 回列表 ----
     * 当前页面：CONFIRM（OCR 分析，无障碍分析不到）
     * 本步操作：OCR 找「不再关注」坐标并点击
     * 等待：3 秒（确认框消失、列表刷新）
     * 期望页面：LIST（顶部含「公众号」）
     * ---------------------------------------------------------- */
    logStep("CONFIRM", "点击确认弹框的「不再关注」完成取关，等待 3 秒");
    p = findUnfollowButton(det, img);       // 用坐标定位右下角的「不再关注」按钮（排除顶部标题）
    if (p == null) {                        // 保险：再截一次
      img = captureScreen();
      det = ocr.detect(img);
      p = findUnfollowButton(det, img);
    }
    if (p == null) {
      result = {
        ok: 0,
        err: "确认弹框已出现，但定位不到'不再关注'按钮坐标（可能 OCR 漏识），已停止。",
        unfollowed: done
      };
      break;
    }
    console.log("[确认框] 命中右下角「不再关注」按钮，坐标=("
      + Math.round((p.bounds.left + p.bounds.right) / 2) + ","
      + Math.round((p.bounds.top + p.bounds.bottom) / 2) + ")");
    clickCenter(p);
    sleep(3000);

    // 审核：回到列表页（顶部含「公众号」）且确认框已关闭（"仍然关注/不再关注"均消失）。
    // 二者同时满足才能判定成功——避免"点到标题→框没关→背后列表仍可见→误判回列表"的死循环。
    page = "UNKNOWN";
    for (k = 0; k < 4; k = k + 1) {
      var d = captureScreen();
      var dd = ocr.detect(d);
      if (topHasOfficial(dd, d) && !hasText(dd, "仍然关注") && !hasText(dd, "不再关注")) {
        page = "LIST"; break;
      }
      sleep(400);
    }
    logResult(page);
    logCheck(page, "LIST");
    if (page !== "LIST") {
      result = {
        ok: 0,
        err: "确认取关后未回到公众号列表页（或确认框未关闭，可能点到了标题而非按钮），当前应处于公众号列表页，但实际不在。",
        unfollowed: done
      };
      break;
    }

    // 一轮完成
    done = done + 1;
    console.log("[取关成功] 已取消关注【" + targetName + "】，累计 " + done + " 个");
  }

  // 跑满上限仍未清空 → 视为异常
  if (loopCount >= MAX_LOOP && result.ok == 1) {
    result = { ok: 0, err: "已达循环上限 " + MAX_LOOP + " 次，列表仍未清空，疑似异常，已停止", unfollowed: done };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
