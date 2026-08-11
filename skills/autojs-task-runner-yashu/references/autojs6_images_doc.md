# 图像 (Images)

`images` 模块提供了一些手机设备中常见的图片处理函数，包括截图、读写图片、图片剪裁、旋转、二值化、找色找图等。

该模块分为两个部分：**找图找色部分**和**图片处理部分**。

> **注意**：Image 对象创建后尽量在不使用时进行回收，同时避免循环创建大量图片。因为图片是一种占用内存比较大的资源，尽管 Auto.js 通过各种方式（比如图片缓存机制、垃圾回收时回收图片、脚本结束时回收所有图片）尽量降低图片资源的泄漏和内存占用，但是糟糕的代码仍然可以占用大量内存。
>
> Image 对象通过调用 `recycle()` 函数来回收。例如：
>
> ```javascript
> // 读取图片
> var img = images.read("./1.png");
> // 对图片进行操作
> ...
> // 回收图片
> img.recycle();
> ```
>
> 例外的是，`captureScreen()` 返回的图片不需要回收。

---

## 图片处理

### images.read(path)

- **参数**：
  - `path` {string} 图片路径
- **返回值**：{Image | null}
- **说明**：读取在路径 path 的图片文件并返回一个 Image 对象。如果文件不存在或者文件无法解码则返回 `null`。

### images.load(url)

- **参数**：
  - `url` {string} 图片 URL 地址
- **返回值**：{Image | null}
- **说明**：加载在地址 URL 的网络图片并返回一个 Image 对象。如果地址不存在或者图片无法解码则返回 `null`。

### images.copy(img)

- **参数**：
  - `img` {Image} 图片
- **返回值**：{Image}
- **说明**：复制一张图片并返回新的副本。该函数会完全复制 img 对象的数据。

### images.save(image, path[, format = "png", quality = 100])

- **参数**：
  - `image` {Image} 图片
  - `path` {string} 路径
  - `format` {string} 图片格式，可选的值为：
    - `png`
    - `jpeg` / `jpg`
    - `webp`
  - `quality` {number} 图片质量，为 0~100 的整数值
- **说明**：把图片 image 以指定格式保存到 path 中。如果文件不存在会被创建；文件存在会被覆盖。

```javascript
// 把图片压缩为原来的一半质量并保存
var img = images.read("/sdcard/1.png");
images.save(img, "/sdcard/1.jpg", "jpg", 50);
app.viewFile("/sdcard/1.jpg");
```

### images.fromBase64(base64)

- **参数**：
  - `base64` {string} 图片的 Base64 数据
- **返回值**：{Image | null}
- **说明**：解码 Base64 数据并返回解码后的图片 Image 对象。如果 base64 无法解码则返回 `null`。

### images.toBase64(img[, format = "png", quality = 100])

- **参数**：
  - `image` {image} 图片
  - `format` {string} 图片格式，可选的值为：`png`、`jpeg/jpg`、`webp`
  - `quality` {number} 图片质量，为 0~100 的整数值
- **返回值**：{string}
- **说明**：把图片编码为 base64 数据并返回。

### images.fromBytes(bytes)

- **参数**：
  - `bytes` {byte[]} 字节数组
- **返回值**：{Image | null}
- **说明**：解码字节数组 bytes 并返回解码后的图片 Image 对象。如果 bytes 无法解码则返回 `null`。

### images.toBytes(img[, format = "png", quality = 100])

- **参数**：
  - `image` {image} 图片
  - `format` {string} 图片格式，可选的值为：`png`、`jpeg/jpg`、`webp`
  - `quality` {number} 图片质量，为 0~100 的整数值
- **返回值**：{byte[]}
- **说明**：把图片编码为字节数组并返回。

### images.clip(img, x, y, w, h)

- **参数**：
  - `img` {Image} 图片
  - `x` {number} 剪切区域的左上角横坐标
  - `y` {number} 剪切区域的左上角纵坐标
  - `w` {number} 剪切区域的宽度
  - `h` {number} 剪切区域的高度
- **返回值**：{Image}
- **说明**：从图片 img 的位置 (x, y) 处剪切大小为 w * h 的区域，并返回该剪切区域的新图片。

```javascript
var src = images.read("/sdcard/1.png");
var clip = images.clip(src, 100, 100, 400, 400);
images.save(clip, "/sdcard/clip.png");
```

### images.resize(img, size[, interpolation]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `size` {Array} 两个元素的数组 `[w, h]`，分别表示宽度和高度；如果只有一个元素，则宽度和高度相等
  - `interpolation` {string} 插值方法，可选，默认为 `"LINEAR"`（线性插值），可选的值有：
    - `NEAREST` 最近邻插值
    - `LINEAR` 线性插值（默认）
    - `AREA` 区域插值
    - `CUBIC` 三次样条插值
    - `LANCZOS4` Lanczos 插值
- **返回值**：{Image}
- **说明**：调整图片大小，并返回调整后的图片。例如把图片放缩为 200*300：`images.resize(img, [200, 300])`。

参见 [Imgproc.resize](https://docs.opencv.org/3.4.4/da/d54/group__imgproc__transform.html#ga47a974309e9102f5f08231edc7e7529d/)。

### images.scale(img, fx, fy[, interpolation]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `fx` {number} 宽度放缩倍数
  - `fy` {number} 高度放缩倍数
  - `interpolation` {string} 插值方法（同 `images.resize`）
- **返回值**：{Image}
- **说明**：放缩图片，并返回放缩后的图片。例如把图片变成原来的一半：`images.scale(img, 0.5, 0.5)`。

### images.rotate(img, degree[, x, y]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `degree` {number} 旋转角度
  - `x` {number} 旋转中心 x 坐标，默认为图片中点
  - `y` {number} 旋转中心 y 坐标，默认为图片中点
- **返回值**：{Image}
- **说明**：将图片逆时针旋转 degree 度，返回旋转后的图片对象。例如逆时针旋转 90 度为 `images.rotate(img, 90)`。

### images.concat(img1, img2[, direction]) *[v4.1.0新增]*

- **参数**：
  - `img1` {Image} 图片1
  - `img2` {Image} 图片2
  - `direction` {string} 连接方向，默认为 `"RIGHT"`，可选的值有：
    - `LEFT` 将图片2接到图片1左边
    - `RIGHT` 将图片2接到图片1右边
    - `TOP` 将图片2接到图片1上边
    - `BOTTOM` 将图片2接到图片1下边
- **返回值**：{Image}
- **说明**：连接两张图片，并返回连接后的图像。如果两张图片大小不一致，小的那张将适当居中。

### images.grayscale(img) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
- **返回值**：{Image}
- **说明**：灰度化图片，并返回灰度化后的图片。

### images.threshold(img, threshold, maxVal[, type]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `threshold` {number} 阈值
  - `maxVal` {number} 最大值
  - `type` {string} 阈值化类型，默认为 `"BINARY"`，可选的值有：
    - `BINARY`
    - `BINARY_INV`
    - `TRUNC`
    - `TOZERO`
    - `TOZERO_INV`
    - `OTSU`
    - `TRIANGLE`
- **返回值**：{Image}
- **说明**：将图片阈值化，并返回处理后的图像。可以用这个函数进行图片二值化。例如：`images.threshold(img, 100, 255, "BINARY")`，这个代码将图片中大于 100 的值全部变成 255，其余变成 0，从而达到二值化的效果。如果 img 是一张灰度化图片，这个代码将会得到一张黑白图片。

参见 [threshold 函数的使用](https://blog.csdn.net/u012566751/article/details/77046445/) 或 OpenCV 文档 [threshold](https://docs.opencv.org/3.4.4/d7/d1b/group__imgproc__misc.html#gae8a4a146d1ca78c626a53577199e9c57/)。

### images.adaptiveThreshold(img, maxValue, adaptiveMethod, thresholdType, blockSize, C) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `maxValue` {number} 最大值
  - `adaptiveMethod` {string} 在一个邻域内计算阈值所采用的算法，可选的值有：
    - `MEAN_C` 计算出领域的平均值再减去参数 C 的值
    - `GAUSSIAN_C` 计算出领域的高斯均值再减去参数 C 的值
  - `thresholdType` {string} 阈值化类型，可选的值有：`BINARY`、`BINARY_INV`
  - `blockSize` {number} 邻域块大小
  - `C` {number} 偏移值调整量
- **返回值**：{Image}
- **说明**：对图片进行自适应阈值化处理，并返回处理后的图像。

参见 [threshold 与 adaptiveThreshold](https://blog.csdn.net/guduruyu/article/details/68059450/) 或 OpenCV 文档 [adaptiveThreshold](https://docs.opencv.org/3.4.4/d7/d1b/group__imgproc__misc.html#ga72b913f352e4a1b1b397736707afcde3/)。

### images.cvtColor(img, code[, dstCn]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `code` {string} 颜色空间转换的类型，可选的值一共有 205 个（参见 [ColorConversionCodes](https://docs.opencv.org/3.4.4/d8/d01/group__imgproc__color__conversions.html#ga4e0972be5de079fed4e3a10e24ef5ef0/)），常用的有：
    - `BGR2GRAY` BGR 转换为灰度
    - `BGR2HSV` BGR 转换为 HSV
  - `dstCn` {number} 目标图像的颜色通道数量，如果不填写则根据其他参数自动决定
- **返回值**：{Image}
- **说明**：对图像进行颜色空间转换，并返回转换后的图像。

参见 [颜色空间转换](https://blog.csdn.net/u011574296/article/details/70896811?locationNum=14&fps=1) 或 OpenCV 文档 [cvtColor](https://docs.opencv.org/3.4.4/d8/d01/group__imgproc__color__conversions.html#ga397ae87e1288a81d2363b61574eb8cab/)。

### images.inRange(img, lowerBound, upperBound) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `lowerBound` {string | number} 颜色下界
  - `upperBound` {string | number} 颜色上界
- **返回值**：{Image}
- **说明**：将图片二值化，在 lowerBound~upperBound 范围以外的颜色都变成 0，在范围以内的颜色都变成 255。例如 `images.inRange(img, "#000000", "#222222")`。

### images.interval(img, color, interval) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `color` {string | number} 颜色值
  - `interval` {number} 每个通道的范围间隔
- **返回值**：{Image}
- **说明**：将图片二值化，在 color-interval ~ color+interval 范围以外的颜色都变成 0，在范围以内的颜色都变成 255。这里对 color 的加减是对每个通道而言的。

例如 `images.interval(img, "#888888", 16)`，每个通道的颜色值均为 0x88，加减 16 后的范围是 `[0x78, 0x98]`，因此这个代码将把 #787878~#989898 的颜色变成 #FFFFFF，而把这个范围以外的变成 #000000。

### images.blur(img, size[, anchor, type]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `size` {Array} 定义滤波器的大小，如 `[3, 3]`
  - `anchor` {Array} 指定锚点位置（被平滑点），默认为图像中心
  - `type` {string} 推断边缘像素类型，默认为 `"DEFAULT"`，可选的值有：
    - `CONSTANT`、`REPLICATE`、`REFLECT`、`WRAP`、`REFLECT_101`、`TRANSPARENT`、`REFLECT101`、`DEFAULT`、`ISOLATED`
- **返回值**：{Image}
- **说明**：对图像进行模糊（平滑处理），返回处理后的图像。

参见 [实现图像平滑处理](https://www.cnblogs.com/denny402/p/3848316.html) 或 OpenCV 文档 [blur](https://docs.opencv.org/3.4.4/d4/d86/group__imgproc__filter.html#ga8c45db9afe636703801b0b2e440fce37/)。

### images.medianBlur(img, size) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `size` {number} 定义滤波器的大小，正奇数，如 3
- **返回值**：{Image}
- **说明**：对图像进行中值滤波，返回处理后的图像。

### images.gaussianBlur(img, size[, sigmaX, sigmaY, type]) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 图片
  - `size` {Array} 定义滤波器的大小，如 `[3, 3]`
  - `sigmaX` {number} x 方向的标准方差，不填写则自动计算
  - `sigmaY` {number} y 方向的标准方差，不填写则自动计算
  - `type` {string} 推断边缘像素类型，默认为 `"DEFAULT"`，参见 `images.blur`
- **返回值**：{Image}
- **说明**：对图像进行高斯模糊，返回处理后的图像。

参见 [实现图像平滑处理](https://www.cnblogs.com/denny402/p/3848316.html) 或 OpenCV 文档 [GaussianBlur](https://docs.opencv.org/3.4.4/d4/d86/group__imgproc__filter.html#gaabe8c836e97159a9193fb0b11ac52cf1/)。

### images.matToImage(mat) *[v4.1.0新增]*

- **参数**：
  - `mat` {Mat} OpenCV 的 Mat 对象
- **返回值**：{Image}
- **说明**：把 Mat 对象转换为 Image 对象。

---

## 找图找色

### images.requestScreenCapture([landscape])

- **参数**：
  - `landscape` {boolean} 布尔值，表示将要执行的截屏是否为横屏。如果 landscape 为 false，则表示竖屏截图；true 为横屏截图。
- **返回值**：{boolean}
- **说明**：向系统申请屏幕截图权限，返回是否请求成功。

第一次使用该函数会弹出截图权限请求，建议选择"总是允许"。

这个函数只是申请截图权限，并不会真正执行截图，真正的截图函数是 `captureScreen()`。

该函数在截图脚本中只需执行一次，而无需每次调用 `captureScreen()` 都调用一次。

如果不指定 landscape 值，则截图方向由当前设备屏幕方向决定，因此务必注意执行该函数时的屏幕方向。

建议在本软件界面运行该函数，在其他软件界面运行时容易出现一闪而过的黑屏现象。

```javascript
// 请求截图
if (!requestScreenCapture()) {
    toast("请求截图失败");
    exit();
}
// 连续截图10张图片(间隔1秒)并保存到存储卡目录
for (var i = 0; i < 10; i++) {
    captureScreen("/sdcard/screencapture" + i + ".png");
    sleep(1000);
}
```

> 该函数也可以作为全局函数使用。

### images.captureScreen()

- **返回值**：{Image}
- **说明**：截取当前屏幕并返回一个 Image 对象。

没有截图权限时执行该函数会抛出 SecurityException。

该函数不会返回 null，两次调用可能返回相同的 Image 对象。这是因为设备截图的更新需要一定的时间，短时间内（一般来说是 16ms）连续调用则会返回同一张截图。

截图需要转换为 Bitmap 格式，从而该函数执行需要一定的时间（0~20ms）。

另外在 `requestScreenCapture()` 执行成功后需要一定时间后才有截图可用，因此如果立即调用 `captureScreen()`，会等待一定时间后（一般为几百 ms）才返回截图。

```javascript
// 请求横屏截图
requestScreenCapture(true);
// 截图
var img = captureScreen();
// 获取在点(100, 100)的颜色值
var color = images.pixel(img, 100, 100);
// 显示该颜色值
toast(colors.toString(color));
```

> 该函数也可以作为全局函数使用。

### images.captureScreen(path)

- **参数**：
  - `path` {string} 截图保存路径
- **说明**：截取当前屏幕并以 PNG 格式保存到 path 中。如果文件不存在会被创建；文件存在会被覆盖。该函数不会返回任何值。

> 该函数也可以作为全局函数使用。

### images.pixel(image, x, y)

- **参数**：
  - `image` {Image} 图片
  - `x` {number} 要获取的像素的横坐标
  - `y` {number} 要获取的像素的纵坐标
- **返回值**：{number}
- **说明**：返回图片 image 在点 (x, y) 处的像素的 ARGB 值。

该值的格式为 `0xAARRGGBB`，是一个 "32 位整数"。坐标系以图片左上角为原点，以图片左侧边为 y 轴，上侧边为 x 轴。

### images.findColor(image, color, options)

- **参数**：
  - `image` {Image} 图片
  - `color` {number | string} 要寻找的颜色。如果是整数，则以 `0xRRGGBB` 的形式代表 RGB 值（A 通道会被忽略）；如果是字符串，则以 `"#RRGGBB"` 代表其 RGB 值。
  - `options` {Object} 选项：
    - `region` {Array} 找色区域。是一个两个或四个元素的数组。(region[0], region[1]) 表示找色区域的左上角；region[2] * region[3] 表示找色区域的宽高。如果只有 region 只有两个元素，则找色区域为 (region[0], region[1]) 到屏幕右下角。如果不指定 region 选项，则找色区域为整张图片。
    - `threshold` {number} 找色时颜色相似度的临界值，范围为 0~255（越小越相似，0 为颜色相等，255 为任何颜色都能匹配）。默认为 4。threshold 和浮点数相似度（0.0~1.0）的换算为 `similarity = (255 - threshold) / 255`。
- **返回值**：{Point | null}
- **说明**：在图片中寻找颜色 color。找到时返回找到的点 Point，找不到时返回 null。

> 该函数也可以作为全局函数使用。

**循环找色示例：**

```javascript
requestScreenCapture();

// 循环找色, 找到红色(#ff0000)时停止并报告坐标
while (true) {
    var img = captureScreen();
    var point = findColor(img, "#ff0000");
    if (point) {
        toast("找到红色, 坐标为(" + point.x + ", " + point.y + ")");
    }
}
```

**区域找色示例：**

```javascript
// 读取本地图片/sdcard/1.png
var img = images.read("/sdcard/1.png");
// 判断图片是否加载成功
if (!img) {
    toast("没有该图片");
    exit();
}
// 在该图片中找色, 指定找色区域为在位置(400, 500)的宽为300长为200的区域, 指定找色临界值为4
var point = findColor(img, "#00ff00", {
    region: [400, 500, 300, 200],
    threshold: 4
});
if (point) {
    toast("找到啦:" + point);
} else {
    toast("没找到");
}
```

### images.findColorInRegion(img, color, x, y[, width, height, threshold])

- **说明**：区域找色的简便方法。相当于：

```javascript
images.findColor(img, color, {
    region: [x, y, width, height],
    threshold: threshold
});
```

> 该函数也可以作为全局函数使用。

### images.findColorEquals(img, color[, x, y, width, height])

- **参数**：
  - `img` {Image} 图片
  - `color` {number | string} 要寻找的颜色
  - `x` {number} 找色区域的左上角横坐标
  - `y` {number} 找色区域的左上角纵坐标
  - `width` {number} 找色区域的宽度
  - `height` {number} 找色区域的高度
- **返回值**：{Point | null}
- **说明**：在图片 img 指定区域中找到颜色和 color 完全相等的某个点，并返回该点的坐标；如果没有找到，则返回 null。找色区域通过 x, y, width, height 指定，如果不指定找色区域，则在整张图片中寻找。

> 该函数也可以作为全局函数使用。

**示例（通过找 QQ 红点的颜色来判断是否有未读消息）：**

```javascript
requestScreenCapture();
launchApp("QQ");
sleep(1200);
var p = findColorEquals(captureScreen(), "#f64d30");
if (p) {
    toast("有未读消息");
} else {
    toast("没有未读消息");
}
```

### images.findMultiColors(img, firstColor, colors[, options])

- **参数**：
  - `img` {Image} 要找色的图片
  - `firstColor` {number | string} 第一个点的颜色
  - `colors` {Array} 表示剩下的点相对于第一个点的位置和颜色的数组，数组的每个元素为 `[x, y, color]`
  - `options` {Object} 选项，包括：
    - `region` {Array} 找色区域（同 findColor）
    - `threshold` {number} 找色时颜色相似度的临界值（同 findColor）
- **返回值**：{Point | null}
- **说明**：多点找色，类似于按键精灵的多点找色，其过程如下：

1. 在图片 img 中找到颜色 firstColor 的位置 (x0, y0)
2. 对于数组 colors 的每个元素 `[x, y, color]`，检查图片 img 在位置 (x + x0, y + y0) 上的像素是否是颜色 color，是的话返回 (x0, y0)，否则继续寻找 firstColor 的位置，重新执行第 1 步
3. 整张图片都找不到时返回 null

例如，对于代码 `images.findMultiColors(img, "#123456", [[10, 20, "#ffffff"], [30, 40, "#000000"]])`，假设图片在 (100, 200) 的位置的颜色为 #123456，这时如果 (110, 220) 的位置的颜色为 #ffffff 且 (130, 240) 的位置的颜色为 #000000，则函数返回点 (100, 200)。

如果要指定找色区域，则在 options 中指定：

```javascript
var p = images.findMultiColors(img, "#123456", [[10, 20, "#ffffff"], [30, 40, "#000000"]], {
    region: [0, 960, 1080, 960]
});
```

### images.detectsColor(image, color, x, y[, threshold = 16, algorithm = "diff"])

- **参数**：
  - `image` {Image} 图片
  - `color` {number | string} 要检测的颜色
  - `x` {number} 要检测的位置横坐标
  - `y` {number} 要检测的位置纵坐标
  - `threshold` {number} 颜色相似度临界值，默认为 16。取值范围为 0~255。
  - `algorithm` {string} 颜色匹配算法，包括：
    - `"equal"`: 相等匹配，只有与给定颜色 color 完全相等时才匹配
    - `"diff"`: 差值匹配，与给定颜色的 R、G、B 差的绝对值之和小于 threshold 时匹配
    - `"rgb"`: rgb 欧拉距离相似度，与给定颜色 color 的 rgb 欧拉距离小于等于 threshold 时匹配
    - `"rgb+"`: 加权 rgb 欧拉距离匹配 ([LAB Delta E](https://en.wikipedia.org/wiki/Color_difference/))
    - `"hs"`: hs 欧拉距离匹配，hs 为 HSV 空间的色调值
- **返回值**：{boolean}
- **说明**：返回图片 image 在位置 (x, y) 处是否匹配到颜色 color。用于检测图片中某个位置是否是特定颜色。

**判断微博客户端的某个微博是否被点赞过的例子：**

```javascript
requestScreenCapture();
// 找到点赞控件
var like = id("ly_feed_like_icon").findOne();
// 获取该控件中点坐标
var x = like.bounds().centerX();
var y = like.bounds().centerY();
// 截图
var img = captureScreen();
// 判断在该坐标的颜色是否为橙红色
if (images.detectsColor(img, "#fed9a8", x, y)) {
    // 是的话则已经是点赞过的了, 不做任何动作
} else {
    // 否则点击点赞按钮
    like.click();
}
```

### images.findImage(img, template[, options])

- **参数**：
  - `img` {Image} 大图片
  - `template` {Image} 小图片（模板）
  - `options` {Object} 找图选项：
    - `threshold` {number} 图片相似度。取值范围为 0~1 的浮点数。默认值为 0.9。
    - `region` {Array} 找图区域。参见 findColor 函数关于 region 的说明。
    - `level` {number} 一般而言不必修改此参数。不加此参数时该参数会根据图片大小自动调整。找图算法是采用图像金字塔进行的，level 参数表示金字塔的层次，level 越大可能带来越高的找图效率，但也可能造成找图失败（图片因过度缩小而无法分辨）或返回错误位置。
- **返回值**：{Point | null}
- **说明**：找图。在大图片 img 中查找小图片 template 的位置（模块匹配），找到时返回位置坐标 (Point)，找不到时返回 null。

> 该函数也可以作为全局函数使用。

**最简单的找图例子：**

```javascript
var img = images.read("/sdcard/大图.png");
var templ = images.read("/sdcard/小图.png");
var p = findImage(img, templ);
if (p) {
    toast("找到啦:" + p);
} else {
    toast("没找到");
}
```

**区域找图例子：**

```javascript
auto();
requestScreenCapture();
var wx = images.read("/sdcard/微信图标.png");
// 返回桌面
home();
// 截图并找图
var p = findImage(captureScreen(), wx, {
    region: [0, 50],
    threshold: 0.8
});
if (p) {
    toast("在桌面找到了微信图标啦: " + p);
} else {
    toast("在桌面没有找到微信图标");
}
```

### images.findImageInRegion(img, template, x, y[, width, height, threshold])

- **说明**：区域找图的简便方法。相当于：

```javascript
images.findImage(img, template, {
    region: [x, y, width, height],
    threshold: threshold
})
```

> 该函数也可以作为全局函数使用。

### images.matchTemplate(img, template, options) *[v4.1.0新增]*

- **参数**：
  - `img` {Image} 大图片
  - `template` {Image} 小图片（模板）
  - `options` {Object} 找图选项：
    - `threshold` {number} 图片相似度。取值范围为 0~1 的浮点数。默认值为 0.9。
    - `region` {Array} 找图区域。参见 findColor 函数关于 region 的说明。
    - `max` {number} 找图结果最大数量，默认为 5
    - `level` {number} 同 findImage
- **返回值**：{MatchingResult}
- **说明**：在大图片中搜索小图片，并返回搜索结果 MatchingResult。该函数可以用于找图时找出多个位置，可以通过 max 参数控制最大的结果数量。也可以对匹配结果进行排序、求最值等操作。

---

## MatchingResult *[v4.1.0新增]*

`matchTemplate` 函数返回的结果对象。

### matches

- **类型**：{Array}
- **说明**：匹配结果的数组。数组的元素是一个 Match 对象：
  - `point` {Point} 匹配位置
  - `similarity` {number} 相似度

```javascript
var result = images.matchTemplate(img, template, {
    max: 100
});
result.matches.forEach(match => {
    log("point = " + match.point + ", similarity = " + match.similarity);
});
```

### points

- **类型**：{Array}
- **说明**：匹配位置的数组。

### first()

- **返回值**：{Match | null}
- **说明**：第一个匹配结果。如果没有任何匹配，则返回 null。

### last()

- **返回值**：{Match | null}
- **说明**：最后一个匹配结果。如果没有任何匹配，则返回 null。

### leftmost()

- **返回值**：{Match | null}
- **说明**：位于大图片最左边的匹配结果。如果没有任何匹配，则返回 null。

### topmost()

- **返回值**：{Match | null}
- **说明**：位于大图片最上边的匹配结果。如果没有任何匹配，则返回 null。

### rightmost()

- **返回值**：{Match | null}
- **说明**：位于大图片最右边的匹配结果。如果没有任何匹配，则返回 null。

### bottommost()

- **返回值**：{Match | null}
- **说明**：位于大图片最下边的匹配结果。如果没有任何匹配，则返回 null。

### best()

- **返回值**：{Match | null}
- **说明**：相似度最高的匹配结果。如果没有任何匹配，则返回 null。

### worst()

- **返回值**：{Match | null}
- **说明**：相似度最低的匹配结果。如果没有任何匹配，则返回 null。

### sortBy(cmp)

- **参数**：
  - `cmp` {Function | string} 比较函数，或者是一个字符串表示排序方向。例如 `"left"` 表示将匹配结果按匹配位置从左往右排序、`"top"` 表示将匹配结果按匹配位置从上往下排序，`"left-top"` 表示将匹配结果按匹配位置从左往右、从上往下排序。方向包括 left（左）、top（上）、right（右）、bottom（下）。
- **返回值**：{MatchingResult}
- **说明**：对匹配结果进行排序，并返回排序后的结果。

```javascript
log(result.sortBy("top-right"));
```

---

## Image

表示一张图片，可以是截图的图片，或者本地读取的图片，或者从网络获取的图片。

### Image.getWidth()

- **返回值**：{number}
- **说明**：返回以像素为单位图片宽度。

### Image.getHeight()

- **返回值**：{number}
- **说明**：返回以像素为单位的图片高度。

### Image.saveTo(path)

- **参数**：
  - `path` {string} 路径
- **说明**：把图片保存到路径 path。（如果文件存在则覆盖）

### Image.pixel(x, y)

- **参数**：
  - `x` {number} 横坐标
  - `y` {number} 纵坐标
- **返回值**：{number}
- **说明**：返回图片 image 在点 (x, y) 处的像素的 ARGB 值。坐标系以图片左上角为原点，以图片左侧边为 y 轴，上侧边为 x 轴。

---

## Point

`findColor`、`findImage` 返回的对象。表示一个点（坐标）。

### Point.x

- **类型**：{number}
- **说明**：横坐标。

### Point.y

- **类型**：{number}
- **说明**：纵坐标。
