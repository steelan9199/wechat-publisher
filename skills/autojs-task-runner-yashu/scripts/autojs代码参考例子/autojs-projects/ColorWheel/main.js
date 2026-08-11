'ui';
importClass(android.graphics.Paint);
importClass(android.graphics.Bitmap);
importClass(android.graphics.PorterDuff);
importClass(android.widget.SeekBar);

var hsl = require('./hsl.js');
var Wheel = require('./wheel.js');

// 常驻 UI 脚本必须：先注册 exit 回执，建好界面立即回执，避免中继 30s 超时
function sendResult(obj) {
  try { events.broadcast.emit('autojs_result', JSON.stringify(obj)); } catch (e) {}
}
var result = { ok: 0, err: '脚本未执行' };
events.on('exit', function () { sendResult(result); });

try {
  ui.layout(
    <vertical bg="#ffffff" w="*" h="*" padding="16" gravity="center_horizontal">
      <text text="HSL 色轮" textSize="20sp" textStyle="bold" gravity="center" marginBottom="12"/>
      <canvas id="wheelCanvas" w="260" h="260" margin="8"/>
      <horizontal w="*">
        <text text="H" w="24" gravity="center"/>
        <seekbar id="hSlider" max="360" progress="180" layout_weight="1"/>
        <text id="hVal" text="180" w="48" gravity="center"/>
      </horizontal>
      <horizontal w="*">
        <text text="S" w="24" gravity="center"/>
        <seekbar id="sSlider" max="100" progress="100" layout_weight="1"/>
        <text id="sVal" text="100" w="48" gravity="center"/>
      </horizontal>
      <horizontal w="*">
        <text text="L" w="24" gravity="center"/>
        <seekbar id="lSlider" max="100" progress="50" layout_weight="1"/>
        <text id="lVal" text="50" w="48" gravity="center"/>
      </horizontal>
      <horizontal w="*">
        <text text="转速" w="48" gravity="center"/>
        <seekbar id="speedSlider" max="100" progress="0" layout_weight="1"/>
        <text id="speedVal" text="0" w="48" gravity="center"/>
      </horizontal>
      <horizontal gravity="center_vertical" margin="10">
        <text id="rgbText" text="RGB(0, 0, 0)" textSize="16sp" w="168" gravity="center_vertical"/>
        <view id="colorBlock" w="36" h="36" marginLeft="12" bg="#000000"/>
      </horizontal>
      <text text="不旋转时，在色轮上触摸即可取色" textSize="12sp" textColor="#888888" margin="6" gravity="center"/>
      <text id="exitBtn" text="退 出" textSize="16sp" textColor="#ffffff" bg="#3f7fbf" gravity="center" h="46" w="*" margin="16"/>
    </vertical>
  );

  // 固定 RGB 文本框宽度 = 当前机型下“最宽可能字符串”的真实像素宽度，
  // 跨密度/字体/系统字号缩放都稳定，右侧色块坐标恒定不再左右晃动
  try {
    var _paint = new Paint();
    _paint.setTextSize(ui.rgbText.getTextSize()); // getTextSize 返回 px（已含 sp 缩放）
    var _maxRgb = 'RGB(255, 255, 255)';
    var _wPx = Math.ceil(_paint.measureText(_maxRgb)) + 4; // 4px 余量防裁切
    if (_wPx > 0) {
      ui.rgbText.getLayoutParams().width = _wPx;
      ui.rgbText.requestLayout();
    }
  } catch (e) {}

  var wheel = new Wheel();
  var state = {
    H: ui.hSlider.getProgress(),
    S: ui.sSlider.getProgress(),
    L: ui.lSlider.getProgress(),
    hueOffset: 0,
    speed: ui.speedSlider.getProgress()
  };

  function updateReadout() {
    var rgb = hsl.hslToRgb(state.H, state.S, state.L);
    ui.rgbText.setText(hsl.rgbString(rgb));
    ui.colorBlock.setBackgroundColor(colors.rgb(rgb.r, rgb.g, rgb.b));
    ui.hVal.setText(String(Math.round(state.H)));
    ui.sVal.setText(String(Math.round(state.S)));
    ui.lVal.setText(String(Math.round(state.L)));
    ui.speedVal.setText(String(Math.round(state.speed)));
  }

  // 滑块事件：AutoJS6 的 on('change') 对 SeekBar 不可靠，改用原生 setOnSeekBarChangeListener
  function bindSlider(id, key) {
    ui[id].setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener({
      onProgressChanged: function (seekBar, progress, fromUser) {
        state[key] = progress;
        updateReadout();
        if (state.speed === 0) ui.wheelCanvas.postInvalidate();
      },
      onStartTrackingTouch: function (seekBar) {},
      onStopTrackingTouch: function (seekBar) {}
    }));
  }
  bindSlider('hSlider', 'H');
  bindSlider('sSlider', 'S');
  bindSlider('lSlider', 'L');
  bindSlider('speedSlider', 'speed');

  ui.wheelCanvas.on('draw', function (canvas) {
    wheel.draw(canvas, state);
  });

  // 触摸取色：仅在不旋转(speed==0)时生效
  ui.wheelCanvas.setOnTouchListener(function (view, event) {
    if (state.speed > 0) return false;
    var act = event.getAction();
    if (act === event.ACTION_DOWN || act === event.ACTION_MOVE) {
      var x = event.getX();
      var y = event.getY();
      var w = view.getWidth();
      var h = view.getHeight();
      var cx = w / 2, cy = h / 2;
      var dx = x - cx, dy = y - cy;
      var R = Math.min(w, h) / 2;
      var r = Math.sqrt(dx * dx + dy * dy);
      if (r > R) return true;
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var hue = (ang - state.hueOffset + 360) % 360;
      var sat = r / R * 100;
      state.H = hue;
      state.S = sat;
      ui.run(function () {
        ui.hSlider.setProgress(Math.round(hue));
        ui.sSlider.setProgress(Math.round(sat));
        updateReadout();
        ui.wheelCanvas.postInvalidate();
      });
    }
    return true;
  });

  ui.exitBtn.click(function () { exit(); });

  // 旋转动画：speed 0-100 映射到 0 ~ 8度/帧(约1.5秒/圈)
  var FRAME_MS = 33;
  var MAX_DEG_PER_FRAME = 8;
  setInterval(function () {
    if (state.speed > 0) {
      var step = (state.speed / 100) * MAX_DEG_PER_FRAME;
      state.hueOffset = (state.hueOffset + step) % 360;
      ui.wheelCanvas.postInvalidate();
    }
  }, FRAME_MS);

  updateReadout();
  ui.wheelCanvas.postInvalidate();

  result = { ok: 1, msg: '色轮已启动' };
  sendResult(result);
} catch (e) {
  result = { ok: 0, err: e.toString() };
  sendResult(result);
}
