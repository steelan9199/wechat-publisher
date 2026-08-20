// 自动点击截图权限弹窗的"立即开始"（小米/多数国产 ROM 适用）
threads.start(function () {
  text("立即开始").clickable(true).findOne(3000).click();
});

// 请求截图
if (!requestScreenCapture()) {
  toastLog("请求截图失败");
  exit();
}

var img =  captureScreen();// 纯文字
// var det = ocr.detect(img); // 带坐标
var det = ocr(img);
log(det);

