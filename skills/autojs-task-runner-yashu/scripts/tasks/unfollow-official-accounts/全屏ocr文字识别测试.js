// 自动点击截图权限弹窗授权按钮（文案因 ROM 而异，正则多候选）
threads.start(function () {
  textMatch(/立即开始|开始截图|开始使用|立即启用|START NOW/)
  .clickable(true)
  .findOne(3000)
  ?.click();
});

// 请求截图
if (!requestScreenCapture()) {
  toastLog("请求截图失败");
  exit();
}

var img = captureScreen(); // 纯文字
var det = ocr.detect(img); // 带坐标
// var det = ocr(img);
log(det);
