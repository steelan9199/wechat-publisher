/* 模板名：anti_burn_in
 * 参数：无（本模板不需要参数）
 * 返回：{ ok:1 } 或 { ok:0, err:"..." }
 *
 * 功能：在手机屏幕上显示全屏悬浮遮罩，防止 OLED 烧屏。
 *   分三阶段循环显示（黑 → 蓝 → 随机渐变），每段约 1 秒，共约 9 秒后自动关闭悬浮窗。
 *   遮罩可穿透点击（setTouchable(false)），不阻挡下层操作；并覆盖状态栏（全屏 + 延伸到状态栏后）。
 */

// 统一从任务单注入的 __TASK_ARGS_PATH 读参（本模板无参数，仍保留标准入口以符合模板规范）
function readArgs() {
  // 参数唯一权威源：任务单注入的 __TASK_ARGS_PATH（scripts-from-computer/data/task-args/<taskId>.json）
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}
var args = readArgs();

function showOledBurnInProtection() {
  importClass(android.view.WindowManager);

  // ──────────────────────────────────────────
  // 悬浮窗测试脚本 — 全屏遮罩防止OLED烧屏
  // ──────────────────────────────────────────

  // ═══════════════════════════════════════════
  // 【在这里修改透明度】
  // 范围 0~255：0=全透明（看不见遮罩），255=完全不透明
  // ═══════════════════════════════════════════
  // 彩色遮罩的透明度（蓝色、渐变色用这个）
  // 默认 77 ≈ 30% 不透明度，可隐约看见游戏界面
  var COLOR_ALPHA = 77;

  // 黑色遮罩的透明度（黑色单独设置）
  // 默认 255 = 完全不透明，OLED 黑色像素直接不发光，保护效果最好
  var BLACK_ALPHA = 1;

  // 创建全屏悬浮窗
  var w = floaty.rawWindow(<frame id="bg" gravity="center" bg="#44ffcc00" />);
  log(w);

  // ── 让悬浮窗覆盖状态栏（通过反射拿到 RawWindow，设置窗口标志位）──
  var mWindowField = w.getClass().getDeclaredField("mWindow");
  mWindowField.setAccessible(true);
  var rawWindow = mWindowField.get(w);
  var layoutParams = rawWindow.getWindowLayoutParams();
  layoutParams.flags |=
    WindowManager.LayoutParams.FLAG_FULLSCREEN | // 全屏
    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | // 布局延伸到状态栏后面
    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS; // 允许超出屏幕限制
  rawWindow.setWindowLayoutParams(layoutParams);

  // ── 设置为可穿透点击（不阻挡游戏操作）──
  w.setTouchable(false);
  // w.setPosition(0, 0);
  // ── 铺满整个屏幕 ──
  w.setSize(device.width, device.height);
  // w.setSize(-1, -1);

  /**
   * 设置纯色背景（带透明度）
   * @param {number} r - 红色 0~255
   * @param {number} g - 绿色 0~255
   * @param {number} b - 蓝色 0~255
   */
  function setSolidColor(r, g, b, alpha) {
    if (alpha === undefined) alpha = COLOR_ALPHA;
    var color = android.graphics.Color.argb(alpha, r, g, b);
    var drawable = new android.graphics.drawable.ColorDrawable(color);
    w.bg.setBackgroundDrawable(drawable);
  }

  /**
   * 设置随机渐变色背景（带透明度）
   * 颜色组合随机 + 渐变方向随机
   */
  function setRandomGradient() {
    // 随机起止颜色
    var r1 = Math.floor(Math.random() * 256);
    var g1 = Math.floor(Math.random() * 256);
    var b1 = Math.floor(Math.random() * 256);
    var r2 = Math.floor(Math.random() * 256);
    var g2 = Math.floor(Math.random() * 256);
    var b2 = Math.floor(Math.random() * 256);

    var startColor = android.graphics.Color.argb(COLOR_ALPHA, r1, g1, b1);
    var endColor = android.graphics.Color.argb(COLOR_ALPHA, r2, g2, b2);
    var colors = [startColor, endColor];

    // 随机渐变方向（左→右 / 上→下 / 左下→右上 / 右下→左上）
    var orientations = [
      android.graphics.drawable.GradientDrawable.Orientation.LEFT_RIGHT,
      android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
      android.graphics.drawable.GradientDrawable.Orientation.BL_TR,
      android.graphics.drawable.GradientDrawable.Orientation.BR_TL,
    ];
    var orientation =
      orientations[Math.floor(Math.random() * orientations.length)];

    var gradient = new android.graphics.drawable.GradientDrawable(
      orientation,
      colors,
    );
    w.bg.setBackgroundDrawable(gradient);
    console.log(
      "渐变: RGB(" +
        r1 +
        "," +
        g1 +
        "," +
        b1 +
        ") → RGB(" +
        r2 +
        "," +
        g2 +
        "," +
        b2 +
        ")",
    );
  }

  // ═══════════════════════════════════════════
  // 三阶段显示（每阶段 1 秒，共 3 秒）
  // ═══════════════════════════════════════════

  // 阶段 1（0~1秒）：纯黑色（完全不透明，OLED 像素直接不发光）
  // setSolidColor(0, 255, 0);
  setSolidColor(0, 0, 0, BLACK_ALPHA);
  console.log("[1/3] 纯黑色遮罩");
  sleep(1000);

  // 阶段 2（1~2秒）：纯蓝色
  setSolidColor(0, 0, 255);
  console.log("[2/3] 纯蓝色遮罩");
  sleep(1000);

  // 阶段 3（2~3秒）：随机渐变色
  setRandomGradient();
  console.log("[3/3] 随机渐变色遮罩");
  sleep(1000);

  // 关闭悬浮窗
  w.close();
}

// 标准回执（技能规范要求）：脚本结束经广播回传结果给中继，PC 端据此判定任务完成。
var result = { ok: 0, err: "脚本未产出结果" };
try {
  showOledBurnInProtection();
  showOledBurnInProtection();
  showOledBurnInProtection();
  result = { ok: 1 };
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
