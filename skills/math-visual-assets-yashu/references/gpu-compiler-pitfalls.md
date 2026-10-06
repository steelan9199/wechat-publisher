# numba-cuda-mlir 编译器的真实坑（14 条 · 2026-10-05 实测）

> **本文件是完整独立副本**，不引用任何外部技能，环境损坏时也能照此重建。
> 全部在 RTX 4060 Ti / numba-cuda-mlir 0.5.4 / Python 3.12.13 上实测得出。
> **这些坑文档里查不到，只有真跑才暴露。**

---

## 一、能用 / 不能用对照表

先看这张表，能省掉一半的试错。

| 写法 | 结果 |
|---|---|
| `math.sin/cos/tan/sqrt/exp/log/atan2/floor/ceil/fabs/copysign/pow/acos/asin/atan/tanh` | ✅ 17 个全可用，**优先级高于 libdevice** |
| `math.isnan` / `math.isinf` | ✅ 可用 |
| `cuda.libdevice.isnan/isinf/sign/abs2` | ❌ **不存在**，属性访问直接 AttributeError |
| `libdevice` 其余（`sin/cos/fmax/fmin/max/min/...`） | ✅ 存在（共 324 个） |
| `np.clip(v,a,b)` / `np.sin` / `np.sqrt` / `np.minimum` | ❌ TypingError |
| `float(bool)` | ❌ 报 `float() only support for numbers` |
| `int(bool)` | ✅ **可以** |
| `min(max(v,a),b)` | ✅ 替代 `np.clip` |
| 嵌套 if/else | ✅ 正常 |
| bool 局部变量 | ✅ 正常 |
| `for` + `break` | ✅ 正常 |
| `while` | ✅ 正常 |
| tuple 返回 | ✅ 正常 |
| 模块级 numpy 常量被 device fn 引用 | ✅ 正常 |
| 动态循环边界 `for _ in range(n)`，n 为 kernel 参数 | ✅ 正常 |
| 23 个参数的 kernel | ✅ 正常 |

**关键决策记录**：场函数怎么上 GPU → 写成 **device function + 整型 id 分派**。
因为 `AnalyticField(fn, ...)` 的 Python 闭包**无法跨进 kernel**。
一个 kernel 服务全场景，编译器生成分支而非函数指针。

---

## 二、五条最致命的坑

### 坑 1：3D 数组**不能传进 device function**

作为 **kernel 参数**可以，作为 **device function 的参数**会报
`input and output rank must be > 0`。

**解法**：网格传**扁平 1D float32** + 手工算 stride。
```python
b = (i0 * ny + j0) * nz + k0# 而不是 g[i0, j0, k0]
```

### 坑 2：设备数组统一用扁平 1D

`(n, 3)` 二维数组当 flat buffer 索引（`out[i*3]`）会在类型推断期报
`Cannot unify float64 and array(float64, 1d, C)`。

**解法**：所有 device buffer 用 `np.zeros(n*3)` + 手动 `*3` 索引，不要用二维。

### 坑 3：`import math` 必须放文件顶部

放末尾时，`@cuda.jit(device=True)` 装饰器已在 import 阶段执行，
device function 里引用 `math` 会失败。

### 坑 4：`hasattr` / `try-except` 不能出现在 device function 里

- `hasattr` 报 `Untyped global name 'hasattr': Cannot determine Numba type`
- `try` 报 `mark_try_block`

**写 device function 时不要用任何运行时反射 / 异常处理。**

### 坑 5：`x != x` 检测 NaN 会被编译器优化掉

实测对 `nan` 返回 `False`（恒等于「不是 nan」）。**必须用 `math.isnan(x)`**。

---

## 三、其余坑

### 坑 6：kernel 数组参数个数不是问题

23 个参数的 kernel 实测正常。**推荐做法**：把所有标量参数打包成一个
float32 device 数组传，kernel 签名只留 4 个。

### 坑 7：`carray` 的签名反直觉

`carray(arr, shape)` 缺 shape 报错；传 numpy 数组报 `expected a ctypes pointer`。
**直接用 `cuda.to_device(arr)`，别用 carray。**

### 坑 8：`MAX_THREADS_PER_BLOCK = 1024`，block 大小差异在噪声内

64 / 128 / 256 / 512 实测差异在噪声内。

小网格（<16 block）会触发
`NumbaPerformanceWarning: Grid size N will likely result in GPU under-utilization`。
**这是警告不是错误，忽略即可。**

### 坑 9：真实性能参考（RTX 4060 Ti）

| 操作 | 耗时 |
|---|---|
| 1720×1720 光线步进 300 步 | **0.022 s** |
| 296 MB（420³ f32）host→device | **0.053 s** |
| 860×860 ss=2 全流程（kernel+bloom+tonemap） | **0.096 s** |
| **kernel 首次编译**（含 mlir 编译，冷启动） | **24 s** |
| **缓存命中**（第二次起，`@cuda.jit(cache=True)`） | **0.9 s** |
| **EDT ×2（340³，scipy 单线程）** | **9.6 s** |
| 同上，改用 `edt` 包（多线程） | **0.30 s**（32x） |

kernel 首次编译比官方文档说的 1~2 秒**慢一个量级**（2026-10-06 复测为 **24 s**，
早前记的 12~13 s 偏低）。**已开启落盘缓存**：`@cuda.jit(cache=True)` 把 cubin 写入
`NUMBA_CACHE_DIR`（未设时 = `<scripts>/__pycache__/`），第二次起约 **0.9 s** 读完。
批量渲染时单进程只编译一次，缓存让**跨进程**也不再重编。

单线程 scipy 的 EDT 曾是同等量级的大头（340³ ×2 遍 = **9.6 s**）。改用
`edt`（seung-lab，OpenMP）后降到 **0.30 s（32x）**，与 scipy 一致到 1e-6。
两者相加，**单张端到端 35.8 s → 2.6 s**。

### 坑 10：scipy `gaussian_filter` 标量 sigma 会连颜色轴一起模糊

`gaussian_filter(img, 3.0)` 作用在 `(H,W,3)` 上，**三个轴全被平滑**。
复现到 GPU 必须补3×3 颜色混合矩阵（按 sigma 生成，独立一趟 kernel），
否则 **max diff 差 0.30**。

### 坑 11：scipy 边界模式 = numpy `symmetric`

索引映射 `-1→0, -2→1, n→n-1`，用 while 循环折叠。

### 坑 12：`gaussian_filter1d` 权重公式（可吻合到 5e-8）

```python
r = int(4.0 * sigma + 0.5)        # truncate=4.0
x = np.arange(-r, r + 1)
w = np.exp(-0.5 * (x / sigma) ** 2); w /= w.sum()
```

### 坑 13：GPU 后处理累加器不能和输入共用 buffer

`acc += f(blur)` 若 `acc is blur`，累加器初值变成 blur 本身，且多档 sigma 互相覆盖。
**必须三个独立 buffer：`base` / `blur` / `acc`。**

### 坑 14：CPU 参考代码里的「意外行为」必须复现

`render3d.bloom()` 用标量 sigma 导致颜色轴被模糊 ——这看着像 bug，
但它是**既有交付效果的一部分**，GPU 版必须一致复现，否则图会变。

---

## 四、隐蔽 bug：`background()` 的 `ay` 与相机光线的 `ay` 方向不同

```python
# render3d.background()：ay = (arange(H)+0.5)/H*2   → 值域 0~2，辉光中心在图像顶部
# render3d.cam_rays():ay = 1 - (arange(H)+0.5)/H*2 → 值域 -1~1，+1 在顶部
```

混用会导致背景整体偏移，**silhouette IoU 从 1.0 掉到 0.539**。
GPU 版已用独立变量 `bgay` 区分并加注释。

> 这是 4 次重大 bug 里最隐蔽的一个 —— 代码看起来完全合理，只有靠数值对比才能发现。

---

## 五、性能优化决策记录

| 决策 | 结论 | 理由 |
|---|---|---|
| 光线组织 | **每线程一像素，从像素编号现算方向** | CPU 版每步做 `rd[alive]` 花式索引重排是纯浪费，GPU 不需要 |
| 后处理放哪 | **bloom / tonemap 也搬上 GPU** | scipy 高斯滤波 sigma=26 在 CPU 上要 0.6 s，比 kernel 本身（0.07~0.15 s）**慢 8 倍**。搬上去后单张 0.66 s → **0.096 s** |
| 缓冲区形状 | **一律扁平 1D float32** | 见坑 2 |
| kernel 参数组织 | **标量打包成 1 个 float32 device 数组** | 规避参数个数限制，签名只留 4 个 |
| bloom 累加器 | **base / blur / acc 三个独立 buffer** | 见坑 13 |

---

## 六、验证边界约定的方法论（最大的弯路）

**坑**：验证边界约定**不能用线性数据**。

线性ramp 下所有反射约定（reflect / symmetric / wrap / nearest）
的结果**完全相同** → 会得出「我的实现是对的」这个**错误结论**。

本项目因此浪费两轮：
1. 先用 9×11 小图测（r=5 时每个像素都在反射区，**无解**）
2. 后用线性 ramp 测 1D 映射（**假通过**）

**正确做法：delta 图 + 非对称随机数据 + 大图内区对比，三者结合。**

配套的权重公式见坑 12，可吻合到 5e-8。

---

## 七、副作用：可复现证据

上述结论的可复现脚本在 `scripts/probes/`。

| 探针 | 验证什么 |
|---|---|
| `_probe_gpu.py` ~ `_probe_gpu4.py` | 场函数、kernel 分派、边界约定 |
| `_blur_probe.py` / `_blur3_probe.py` | 高斯权重 + 边界模式（坑 11、12） |
| `_bg_probe.py` | `background()` 的 `ay` 方向（坑 14） |
| `_post_probe.py` / `_stage_probe.py` | 后处理逐级对比（坑 10、13） |
| `_perf_gpu.py` | 性能真值（坑 9） |
