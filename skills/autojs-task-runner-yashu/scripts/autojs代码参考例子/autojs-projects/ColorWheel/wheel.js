// wheel.js —— 标准安卓色轮：SweepGradient(色相) × RadialGradient(饱和) 经 ComposeShader 单次 GPU 合成。
// 无逐像素循环：每次重绘只是 O(1) 地建两个着色器 + 一次 drawCircle，拖 H/S/L 都丝滑跟手。
// 这是 Android 颜色选择器（Material / QuadFlask 等）的惯用写法，直接按原生安卓翻译。
//
// 注：Shader.TileMode.CLAMP 与 PorterDuff.Mode.MULTIPLY 是安卓原生写法。若你的 AutoJS6
// 对嵌套枚举的字段访问取值异常（拿到错误对象），用 valueOf 取真实枚举即可，例如：
//   var CLAMP = android.graphics.Shader.TileMode.valueOf("CLAMP");
//   var MULTIPLY = android.graphics.PorterDuff.Mode.valueOf("MULTIPLY");
// 渲染逻辑本身无需改动。
importClass(android.graphics.Paint);
importClass(android.graphics.PorterDuff);
importClass(android.graphics.SweepGradient);
importClass(android.graphics.RadialGradient);
importClass(android.graphics.ComposeShader);
importClass(android.graphics.Shader);

var hsl = require("./hsl.js");

// 色相环采样点（固定 L=50 的纯色），首尾都是红以闭合 360°
var SWEEP_HUES = [0, 60, 120, 180, 240, 300, 360];

function Wheel() {
  this.sweep = null; // 预生成的色相渐变 shader（只建一次）
}

Wheel.prototype.ensureSweep = function () {
  if (this.sweep) return;
  var n = SWEEP_HUES.length;
  var cols = util.java.array("int", n);
  for (var i = 0; i < n; i++) {
    var c = hsl.hslToRgb(SWEEP_HUES[i], 100, 50);
    cols[i] = colors.argb(255, c.r, c.g, c.b);
  }
  var pos = util.java.array("float", n);
  for (var j = 0; j < n; j++) pos[j] = j / (n - 1);
  this.sweep = new SweepGradient(0, 0, cols, pos);
};

Wheel.prototype.draw = function (canvas, st) {
  var w = canvas.getWidth();
  var h = canvas.getHeight();
  if (w <= 0 || h <= 0) return;
  var size = Math.min(w, h);
  var cx = w / 2,
    cy = h / 2;
  var R = size / 2;

  // 清屏（透明）
  canvas.drawColor(colors.argb(0, 0, 0, 0), PorterDuff.Mode.CLEAR);
  this.ensureSweep();

  // 去饱和层：圆心为当前 L 的灰(S=0)，边缘为白(S=100 保留纯色)
  var g = Math.round((st.L / 100) * 255);
  var centerCol = colors.argb(255, g, g, g);
  var edgeCol = colors.argb(255, 255, 255, 255);
  // commonUtils.printJavaObject(RadialGradient);

  // --- 构造函数 (Constructors) ---
  // 15:30:30.926/D:   [public] RadialGradient(float, float, float, float, float, float, [J, [F, android.graphics.Shader$TileMode)
  // 15:30:30.926/D:   [public] RadialGradient(float, float, float, int, int, android.graphics.Shader$TileMode)
  // 15:30:30.927/D:   [public] RadialGradient(float, float, float, long, long, android.graphics.Shader$TileMode)
  // 15:30:30.927/D:   [public] RadialGradient(float, float, float, [I, [F, android.graphics.Shader$TileMode)
  // 15:30:30.927/D:   [public] RadialGradient(float, float, float, [J, [F, android.graphics.Shader$TileMode)

  // 嵌套枚举在 AutoJS6(Rhino) 里直接访问或 .valueOf 都会拿到错误对象，
  // 这里用 Class.forName + java.lang.Enum.valueOf 取回真实枚举实例。
  var TileModeClass = java.lang.Class.forName(
    "android.graphics.Shader$TileMode",
  );
  var CLAMP = java.lang.Enum.valueOf(TileModeClass, "CLAMP");
  var ModeClass = java.lang.Class.forName("android.graphics.PorterDuff$Mode");
  var MULTIPLY = java.lang.Enum.valueOf(ModeClass, "MULTIPLY");

  // 关键：colors.argb 返回的 ARGB int 高位为 1（是负数），Rhino 会把它匹配到 long 颜色构造，
  // 符号扩展后高位被当成 ColorSpace ID，触发 "Invalid ID, range [0..16)"。
  // 改用 int[] 多色构造（走 int 颜色路径、不做 ColorSpace 校验），并 & 0xffffffff 保证干净的 32 位 ARGB。
  var cols = util.java.array("int", 2);
  cols[0] = centerCol & 0xffffffff; // 圆心：当前 L 的灰(S=0)
  cols[1] = edgeCol & 0xffffffff; // 边缘：白(S=100)
  var stops = util.java.array("float", 2);
  stops[0] = 0.0;
  stops[1] = 1.0;
  var radial = new RadialGradient(0, 0, R, cols, stops, CLAMP);

  // 安卓标准合成：色相环 × 饱和层，MULTIPLY 一次出图（单次 GPU 合成，极快）
  var compose = new ComposeShader(this.sweep, radial, MULTIPLY);

  var paint = new Paint();
  paint.setAntiAlias(true);
  paint.setShader(compose);

  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate(st.hueOffset);
  canvas.drawCircle(0, 0, R, paint);
  canvas.restore();

  // 选中标记点（空心白环 + 当前色填充），角度叠加 hueOffset 跟踪所选颜色
  var markerAngle = ((st.H + st.hueOffset) * Math.PI) / 180;
  var mr = (st.S / 100) * R;
  var mx = cx + mr * Math.cos(markerAngle);
  var my = cy + mr * Math.sin(markerAngle);

  var ring = new Paint();
  ring.setAntiAlias(true);
  ring.setStyle(Paint.Style.STROKE);
  ring.setStrokeWidth(4);
  ring.setColor(colors.WHITE);
  canvas.drawCircle(mx, my, 11, ring);

  var inner = new Paint();
  inner.setAntiAlias(true);
  inner.setStyle(Paint.Style.FILL);
  var sel = hsl.hslToRgb(st.H, st.S, st.L);
  inner.setColor(colors.rgb(sel.r, sel.g, sel.b));
  canvas.drawCircle(mx, my, 8, inner);
};

module.exports = Wheel;
