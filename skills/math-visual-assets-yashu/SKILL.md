---
name: math-visual-assets-yashu
description: 三维数学图形的渲染资产库。用 GPU 光线步进渲染 22 个经典数学实体（克莱因瓶的两种造型、莫比乌斯带、Gyroid、曼德球、洛伦兹吸引子、原子轨道等），并可按同一套方法继续扩充。包含：每个图形的公式与参数、GPU 引擎源码、numba-cuda-mlir 编译器的 14 条实测坑、环境前置条件、以及「症状→病因」排障速查。触发词：数学图形、数学图形渲染、画克莱因瓶、画莫比乌斯带、画曼德球、数学玫瑰、画吸引子、画原子轨道、极小曲面、分形渲染、math3d、render3d_gpu、gallery_gpu、numba-cuda-mlir 坑、GPU 光线步进、数学图形画廊、扩充数学图形。
---

# 三维数学图形渲染资产库

22 个经典数学实体，用 GPU 光线步进（ray marching）实时渲染。
**本技能自包含**：代码、图片、文档齐全，不依赖任何外部工程目录。

---

## 一、快速开始

```powershell
$py = "D:\software\uv\envs\py312-gpu\Scripts\python.exe"   # 必须用这个解释器
$SK = "C:\Users\Administrator\.workbuddy\skills\math-visual-assets-yashu"

# 全量渲 22 张，写入技能自带 assets\figs\
& $py "$SK\scripts\gallery_gpu.py" *> "$env:TEMP\m3d.txt"

# 只渲指定图形
& $py "$SK\scripts\gallery_gpu.py" klein_bottle mandelbulb *> "$env:TEMP\m3d.txt"

# 输出到别处（不覆盖技能自带图）
$env:MATH3D_OUT = "D:\somewhere\else"
& $py "$SK\scripts\gallery_gpu.py" *> "$env:TEMP\m3d.txt"
Remove-Item Env:\MATH3D_OUT

# 校验画廊页与图片一一对应
& $py "$SK\scripts\check_refs.py"
```

> ⚠️ **本机 stdout 常不回传**（命令 exit 0 但零输出）。**一律重定向到文件再读**。
> ⚠️ **必须用 py312-gpu 解释器**，numba-cuda-mlir 只装在那里。

---

## 二、环境前置条件

| 项 | 值 |
|---|---|
| 解释器 | `D:\software\uv\envs\py312-gpu\Scripts\python.exe`（**Python 3.12.13**） |
| GPU 库 | `numba-cuda-mlir` **0.5.4**（+ `cuda-toolkit` 12.9.2.0） |
| 硬件 | NVIDIA GeForce RTX 4060 Ti（8188 MiB，compute capability 8.9） |
| 驱动 / CC | 591.86 / CUDA 12.6 |
| 必需包 | `numpy` 2.5.3、`scipy` 1.18.1、`pillow` 12.3.0 |

重建环境的命令（环境万一损坏）：

```powershell
uv venv --python 3.12 "D:\software\uv\envs\py312-gpu"
uv pip install --python "D:\software\uv\envs\py312-gpu\Scripts\python.exe" `
    "numba-cuda-mlir[cu12]" numpy scipy pillow edt
```

**已实测的致命约束**：
- `numba-cuda-mlir` + Python **3.12** ✅ ｜ + Python **3.14** ❌ 编译 kernel 触发 compiler bug
- `numba-cuda` 已被官方标记维护模式 —— **直接用 mlir，不要碰 numba-cuda**
- **`edt`（seung-lab）是可选但强烈推荐的依赖**：把建场里的 EDT 从 scipy 单线程的
  **9.6 s** 降到 **0.30 s（32x）**，结果与 scipy 一致到 1e-6（渲染图 IoU 1.0）。
  没装也能跑 —— 两个引擎都会自动回退到 scipy，只是慢。装法：
  `uv pip install --python <env>\Scripts\python.exe edt`

---

## 三、支持的 22 个数学图形

四类实现方式决定了速度和调试难度。**A=解析场**（kernel 内直接求值，最快）、
**B=参数曲面→SDF**、**C=点云/占据→SDF**、**D=体积发光积分**（吸引子专用）。

> 🔵 **克莱因瓶有两种造型，选错会「不像克莱因瓶」。**
> `#1` 是**8 字形浸入**（figure-8）：一根扭转的环管，**没有把手**，常被误认成莫比乌斯环；
> `#22` 是**瓶形浸入**（bottle form）：才是大众印象里那个**带把手的瓶子**。
> 两者拓扑相同、外形完全不同 —— 公式与取舍见 `references/klein-bottle-two-immersions.md`。

| # | 图形 | 类别 | 公式 | 耗时 |
|---|---|---|---|---|
| 1 | **克莱因瓶** Klein Bottle | B | 单面自交拓扑，`Rr = a + cos(u/2)sin v − sin(u/2)sin 2v` | 23.2s |
| 2 | **莫比乌斯带** Möbius | B | 单边，`(R + v·cos(u/2))·cos u` | 6.6s |
| 3 | **Gyroid**（Schwarz P） | A | `cos x cos y + cos y cos z + cos z cos x = 0` | **0.09s** |
| 4 | **Schwarz D** | A | `2cos x cos y cos z − cos²x − cos²y − cos²z + 1 = 0` | **0.11s** |
| 5 | **Enneper 曲面** | B | `x = u − u³/3 + uv²`，含不可消去奇点 | 6.8s |
| 6 | **超公式** Gielis | A | `r(φ) = (｜cos(mφ/4)/a｜^n₂ + ｜sin(mφ/4)/b｜^n₃)^(−1/n₁)` | **0.28s** |
| 7 | **数学玫瑰** Rose bloom | B | 56 片凹瓣按黄金角螺旋错位叠放 ⚠2026-10-06 重写 | 2.7s |
| 8 | **三叶结** Trefoil | B | (p,q)=(2,3) 环面结 | 6.9s |
| 9 | **罗马曲面** Roman/Steiner | B | `sin t cos²u`，**t 必须跨 0..2π** | 20.7s |
| 10 | **Boy 曲面** | B | 射影平面的三维浸没 | 11.1s |
| 11 | **螺旋面** Helicoid | B | `r = aθ` 绕 z 轴 | 23.8s |
| 12 | **加百列号角** Gabriel's Horn | B | `y = 1/x` 绕 x 轴，有限体积无限长 | 7.4s |
| 13 | **心形隐式曲面** | A | `(x²+y²+z²−1)³ = x²y²z²` | **0.07s** ← 最快 |
| 14 | **阿波罗尼斯球夹** | C | 4 球反演，球数指数增长 | 61.0s ⚠已重写 |
| 15 | **曼德球** Mandelbulb | A | `r=｜z｜, θ=acos(z_z/r), z ← r⁸(sin8θcos8φ, sin8θsin8φ, cos8θ) + c`，16 次迭代 | **2.2s** |
| 16 | **门格海绵** Menger | C | 27 分挖中心+6 面，迭代 3 次 ⚠2026-10-06 修复 | 3.0s |
| 17 | **洛伦兹吸引子** | D | σ=10, ρ=28, β=8/3，蝴蝶效应源头 | 15.7s |
| 18 | **de Jong 吸引子** | D | `x' = sin(a y) − cos(b x)` | 16.1s ⚠已重写 |
| 19 | **克利福德吸引子** | D | 三维 sin/cos 映射 | 20.4s |
| 20 | **d 原子轨道** | C | `｜Y₂₀｜ = c`，4 瓣 | 26.1s |
| 21 | **f 原子轨道** | C | `｜Y₃₀｜ = c`，5 瓣 | 26.2s |
| 22 | **瓶形克莱因瓶** Klein bottle (bottle form) | B | 瓶形浸入，`x = −(2/15)cos u(3cos v − 30sin u + …)`；**带把手的瓶子**造型 | 35.8s |

**按主题**：极小曲面 2 · 拓扑怪胎 6 · 分形 3 · 吸引子 3 · 参数曲线 4 · 原子轨道 2 · 线环 2

**规律**：解析场（A）0.07~2.2s（曼德球要跑 16 次迭代，是唯一上到秒级的解析场）；网格/点云类（B/C）2.7~61s，大头在 **CPU 上的 scipy EDT 建网格**，不是渲染本身；吸引子（D）15~20s。

> 🔴 **"用了 GPU 为什么还会超过 20 秒"** —— 逐图耗时、超过 20 秒的 6 个图形逐个归因、
> 以及可优化方向，见 **`references/timings-22.md`**。
> 一句话：**GPU 只花不到 0.1 秒，剩下的 99% 是 CPU 在跑 `scipy` 的 O(N³) 距离变换。换显卡无效。**
> 例外只有曼德球（解析 DE 场，2.2s 全在 GPU）。

每个图形的**详细配方**（参数、相机角度、已知坑）见 `references/recipes-22.md`。
逐图**耗时**见 `references/timings-22.md`。
**曼德球**要重渲或改参数前，先读 `references/mandelbulb-postmortem.md`（正确实现 + 8 个坑 + 出问题时的定位流程）。

---

## 四、四类场的建法（新增图形用这套路）

要加第 22 个图形时，先选对场类型 —— 这决定了性能和调试难度。

### A. 解析隐式场（最快，优先选）

场是闭式表达式，直接在 kernel 内求值，**不建网格**。

1. 在 `render3d_gpu.py` 里加 `@cuda.jit(device=True)` 的场函数
2. 加一个 `F_XXX` 整型常量
3. 在 kernel 的 `_field()` 分派里加一个 `elif` 分支
4. 在 `gallery_gpu.py` 里用 `trace_surface(None, lo, hi, ..., kind=F_XXX)` 调用

**关键约束**：Python 闭包**无法**跨进 kernel。所以场函数必须是**设备函数 + 整型 id 分派**，
编译器生成分支而非函数指针。一个 kernel 服务所有解析场景。

**A 类的一个特例：距离估计场（DE）。** 迭代型分形（曼德球）没法写成闭式表达式，
但可以写成"每求值一次就跑一遍迭代、返回距离估计"的设备函数 —— 见
`_f_mandelbulb`（`F_MANDELBULB = 5`）。它仍属 A 类：**不建网格、不跑 EDT**，
但代价转移到了 GPU（唯一一张 GPU 成为瓶颈的图，2.19 s）。
写 DE 场必须保证两件事：<br>
① **距离估计要取"逃逸那一刻"的量**，不能在迭代结束后再取（轨道被冻结后值就塌了）；<br>
② **符号必须由"是否逃逸"给出**（逃逸 ⇒ 正，被捕获 ⇒ 负），不能靠 `log(max(r,1e-3))`
之类的"防溢出"写法 —— 那会把内部的负号也翻正，内部就此消失。

**A 类同样要走"场必须能自证"这一关**：交点前先量
`min / max / frac<0 / median|∇f|`。DE 场的合格线是 `min < 0`、`frac<0` 在 10%~40%、
`median|∇f| ≤ 1`（≤1 才允许近满步长，曼德球实测 0.63）。

### B. 参数曲面 → 点云 → SDF

1. 写参数方程 `fn(U, V) -> (n, 3)`
2. 用 `param_cloud(fn, nu, nv, u0, u1, v0, v1)` 采样
3. `sdf_from_points(P, pad=, thick=1, res=)` 建网格（CPU 上的 scipy EDT）

**必查两项**（错了就是"渲出一小片"或"摩尔纹"）：
- **参数域是否覆盖整个曲面** —— 见 `references/troubleshooting.md` 症状 1
- **两方向采样间距是否都 ≤ 体素** —— 见症状 2

### C. 占据场 / 分形 → SDF

1. 在规则网格上算出布尔占据 `keep`（分形迭代、轨道等值面等）
2. `sdf_from_occupancy(keep, lo, hi, thick=1, res=, smooth=)` 或 `grid_from_array`

**必查一项**：**占据网格分辨率必须 ≥ SDF 网格分辨率**。否则 SDF 只是三线性放大一个块状掩膜，
提 SDF 的 res 完全无效。见症状 3。

### D. 体积发光积分（吸引子专用）

1. 迭代出吸引子轨迹点云
2. `_tube_from_points(P, rad=, res=, gain=, dens=, close=)`
3. `trace_glow(...)` 沿视线做发光积分

**必查一项**：跳跃型映射（de Jong / Clifford）相邻点可相距**上百个体素**，
必须 `close=2` 做形态学膨胀把轨迹桥接成连续管，否则渲成一片碎点。见症状 4。

---

## 五、GPU 编译器坑（14 条，实测）

**这些文档里查不到，只有真跑才暴露。** 完整版见 `references/gpu-compiler-pitfalls.md`（独立完整副本，不引用外部技能）。

### 能用 / 不能用对照（最高频，先看这张）

| 写法 | 结果 |
|---|---|
| `math.sin/cos/tan/sqrt/exp/log/atan2/floor/ceil/fabs/copysign/pow/acos/asin/atan/tanh` | ✅ 17 个全可用，**优先级高于 libdevice** |
| `math.isnan` / `math.isinf` | ✅ 可用 |
| `cuda.libdevice.isnan/isinf/sign/abs2` | ❌ **不存在**，属性访问直接 AttributeError |
| `np.clip(v,a,b)` / `np.sin` / `np.minimum` | ❌ TypingError → 改 `min(max(v,a),b)` |
| `float(bool)` | ❌ 报 `float() only support for numbers`；**`int(bool)` 可以** |
| 嵌套 if/else、bool 局部量、`for`+`break`、`while`、tuple 返回、模块级 numpy 常量 | ✅ 全正常 |
| 动态循环边界 `range(n)`（n 为 kernel 参数） | ✅ 正常 |

### 五条最致命的

1. **3D 数组不能传进 device function**（作为 kernel 参数可以）
   → 网格传**扁平 1D float32** + 手工算 stride `b = (i0*ny + j0)*nz + k0`
2. **设备数组统一用扁平 1D** —— `(n,3)` 二维数组当 flat buffer 索引会报
   `Cannot unify float64 and array(float64, 1d, C)`。用 `np.zeros(n*3)` + 手动 `*3`
3. **`import math` 必须放文件顶部** —— 放末尾时装饰器已在 import 阶段执行，device function 引用 `math` 会失败
4. **`hasattr` / `try-except` 不能出现在 device function 里** —— 报 `Untyped global name` / `mark_try_block`。**写设备函数时不要用任何运行时反射或异常处理**
5. **`x != x` 检测 NaN 会被优化掉**（实测恒返回 False）→ 必须用 `math.isnan(x)`

### 性能真值（RTX 4060 Ti）

| 操作 | 耗时 |
|---|---|
| 1720×1720 光线步进 300 步 | **0.022 s** |
| 296 MB（420³ f32）host→device | **0.053 s** |
| 860×860 ss=2 全流程 | **0.096 s** |
| 860×860 ss=2 **曼德球**（解析 DE，16 迭代） | **2.19 s** |
| **kernel 首次编译**（冷启动） | **24 s**（2026-10-06 实测） |
| 同上，**缓存命中**（第二次起） | **0.9 s** |
| **EDT ×2（340³，scipy 单线程）** | **9.6 s** |
| 同上，**改用 `edt` 包**（多线程） | **0.30 s** |

`MAX_THREADS_PER_BLOCK = 1024`，64/128/256/512 实测差异在噪声内。
小网格的 `NumbaPerformanceWarning` **是警告不是错误，忽略**。

**kernel 编译缓存（2026-10-06 开启，覆盖全部 30 个 kernel）**

所有 `@cuda.jit` 均带 `cache=True`：首次编译的 cubin 落盘，后续**进程**直接读取，
跳过 24 s 的 JIT。这是"单张图 35.8 s"里最大的一笔开销，现已摊掉。

| 场景 | 原始（冷启动 + scipy） | 缓存命中 + `edt` |
|---|---|---|
| 单张 `klein_bottle_classic()` | 35.8 s | **2.6 s** |
| 一次进程跑完全部 22 场景 | 编译只付一次 | 建场同样受益 |

- **缓存位置**：`NUMBA_CACHE_DIR`；未设时 = `<scripts>/__pycache__/`，
  文件名形如 `render3d_gpu._k_surface-553.py312.nbi`
- **指定位置**：在 **import 引擎之前** 设 `$env:NUMBA_CACHE_DIR = "D:\kernel_cache"`
- **失效条件**：换 GPU、换编译器版本、或**改动 `render3d_gpu.py`（行号变了）**
  → 缓存自动失效并重编，**无需手动清理**，也不会用到陈旧产物
- 缓存只跳过编译，**不改变任何像素**（实测与缓存前逐像素 max diff = 0）

> 🔴 **最重要的一条性能认知（2026-10-05 实测全量；2026-10-06 修订）**：
> **GPU 只承担"沿视线求交 + 着色"这一步，全程所有图合计约 4 秒。
> 剩下的 273 秒（99%）全部花在 CPU 上用 numpy/scipy 把隐式场或点云
> 变成一张 3D 距离场网格。**
>
> 所以：单个图超过 20 秒**不是显卡慢**，而是 `scipy.ndimage.distance_transform_edt`
> 在单线程跑 O(N³)（res=520 就是 1.4 亿体素，而且要跑两遍夹壳层）。
>
> - **2026-10-06 已把这两笔大头都压掉**：kernel 编译 → 落盘缓存（首次 24 s，之后 0.9 s）；
>   EDT → `edt` 包多线程（9.6 s → 0.30 s）。**单张端到端 35.8 s → 2.6 s**
> - 若还想再压：降 `res`（340→300，IoU 99.75%，肉眼无差；成品仍建议 340）
> - **换更快的显卡一分钱都省不下来**
> - 曲面类想提速，**降 `res` 比减少采样点有效**（瓶颈是网格体积 `O(res³)`，不是点数）
>
> ⚠️ **唯一例外是曼德球**：它没有 CPU 建场那一步，2.19 s 全是 GPU 在跑
> 16 次迭代 × 每步 6 个超越函数的场求值 —— 所有图里唯一"GPU 真是瓶颈"的图。
>
> 逐图耗时、超过 20 秒的 6 个图形逐个归因，见 **`references/timings-22.md`**。

---

## 五·补、NaN 是静默的场杀手（2026-10-05 新增）

**这是本技能最容易产生"图像看起来莫名不对"的一类 bug，且不报任何警告。**

### 核心事实

1. **`NaN` 与任何阈值比较恒为 False。**
   `NaN < 0.0` → False，`NaN > 1e4` → False，`NaN == 0` → False。
   于是一个 `NaN` 体素会**静默退出**任何 `mask = f(grid) < thr` 或 `> thr` 判断，
   不报错、不告警，只是在物体上打出一个洞。

2. **NaN 会沿数组运算传播。** 一次 `np.where` / `np.minimum` / 归一化
   就能让污染扩散到整个数组。

3. **溢出是 NaN 的主要来源。** float64 的上限 ~1.8e308；
   高次幂（`z**8`）、连乘、迭代都会越过它。`inf * 0 = NaN`、
   `inf - inf = NaN`、`sqrt(负数) = NaN`。

### 防御写法（建场时的标准动作）

```python
# ① 迭代类：一旦逃逸就冻结，绝不让 inf/NaN 继续参与运算
esc = np.zeros(len(c), bool)
for _ in range(iters):
    r = np.abs(z)
    z = z * np.power(np.maximum(r, 1e-12), p - 1) + c
    esc |= (~np.isfinite(r)) | (r > BAIL)   # 先判定，再更新
    z = np.where(esc, 0.0, z)               # 冻结已逃逸的点

# ② 建场后、交给渲染器之前：断言 + 兜底
assert np.isfinite(field).all(), f"{int((~np.isfinite(field)).sum())} 个 NaN 体素"
field = np.nan_to_num(field, nan=<外部值>, posinf=<外部值>, neginf=<内部值>)
```

> ⚠ **`np.errstate(over="ignore")` 只是闭嘴，不是修复。**
> 它把警告吞掉，让 NaN 更容易混进最终图像。必须配 `esc` 冻结 + `isfinite` 断言。
>
> 💡 **自查探针**：`print((~np.isfinite(g)).sum(), g.size)`。
> 正常应为 0。任何非零都先修掉再谈渲染。

---

## 五·补二、距离场必须有"内部"（2026-10-05 新增）

**没有负值的场无法做 sphere tracing —— 光线只会蹭到最外层，渲出空壳或管子。**

`trace_surface` 的步进是 `t += k * |f(p)|`，并靠 `|f| < eps` 或**符号翻转**判定命中。
因此一个可用的场必须满足：

| 要求 | 不满足的后果 |
|---|---|
| 场内部为**负**、外部为**正** | 光线永不触发符号翻转 → 只碰到最外壳 → **渲成管子/空壳** |
| `\|∇f\| ≈ 1`（单位 Lipschitz） | 步长过大穿透表面，或过小耗尽步数 |
| 尺度与网格 `h` 同量级 | `eps = h*0.22` 相对过大 → 命中判定漂移 |

### 三个必须做的检查

```python
print("min/max :", f.min(), f.max())     # min 必须 < 0
print("frac<0  :", (f < 0).mean())       # 典型实体 0.1~0.4
gr,gg,gb = np.gradient(f, *h)
print("|grad|  :", np.median(np.sqrt(gr**2+gg**2+gb**2)))   # 应 ≈ 1
```

> 💡 **快速判据**：`frac<0 == 0` 或 `min >= 0` → 场一定有问题，别调相机、别调 `k`、
> 别调 `zoom`，**先把符号找回来**。
>
> ⚠ 特别注意 `np.log(np.maximum(r, 1.001))` 这类"防溢出"写法：
> `maximum` 会**改变 `log` 的符号**（把内部 `r<1` 的负值也变成正），
> 整个场的内部就此消失。见 `references/timings-22.md` 第五节。

---

## 六、排障速查（症状 → 病因）

完整版见 `references/troubleshooting.md`。**先量数值，别猜代码。**

| 症状 | 最可能病因 | 先跑这个探针 |
|---|---|---|
| **整张图全黑 / 纯色** | 场内部符号丢失（`frac<0 == 0`）或 `min()` 累积把包围盒填满 | `print(f.min(), f.max(), (f<0).mean())` |
| **渲成光滑管子 / 棱柱 / 空壳，认不出原物体** | ① 场沿某方向恒定不变（坐标被压成了二维，如 `X + i(Y+Z)`）② 场无负内部，光线只蹭最外壳 | ① 取两个"应当等价"的切片比 `np.array_equal`，相同即中招 ② `print(f.min(), f.max(), (f<0).mean())`；见「五·补二」 |
| **物体上莫名有隧道 / 空洞** | NaN 体素静默退出占据场 | `print((~np.isfinite(g)).sum())` |
| **只渲出一小片碎片** | 参数域没覆盖整个曲面 | `_diag_roman.py` |
| **同心环 / 条纹摩尔纹** | 某方向采样间距 > 体素 | `_diag_quality.py` |
| **物体偏小 / 偏暗** | 网格盒远大于物体 | `_diag_quality.py` |
| **满屏碎点噪点** | 点云断裂，需形态学桥接 | `_diag_spacing.py` |
| **网格盒切出平边** | 物体触到盒面 | `_diag_helicoid_edge.py` |
| **图只剩一半 / 缺瓣** | 阈值相对场上界设太高 | `_diag_quality.py` |
| **吸引子几乎全黑（亮度 < 0.2）** | 跳跃型映射桥接失败 + `gain` 过低 | 量轨迹相邻点步长中位数，与体素比较 |
| **反演/迭代生成的球数不增长** | 反演是对合（involution），重复反演只会振荡回原球 | 打印每轮新增球数，应指数增长 |
| **CPU/GPU 结果不一致** | 后处理或场函数有偏差 | 按下方「方法论」逐级数值对比 |
| **两条引擎渲出同样的错误结果** | 别怀疑渲染器 —— 它们多半读的是同一份错场 | 直接对场本身做数值探针 |

**方法论（比坑本身更重要）** —— 定位问题靠**逐级数值对比**，不是读代码猜：
1. **二分**：形体对不对？看 diff 图，diff=0 的区域说明那段代码是对的
2. **逐级拆解**：后处理拆成 downsample / clamp / blur / bloom_acc / tonemap 五级，每级单独 CPU vs GPU 比 maxdiff
3. **用针对性合成数据**（delta 图、常数图、非对称随机）代替真实渲染数据

> ⚠️ **踩过的弯路**：用真实渲染图做测试输入 → 多个缺陷互相掩盖，定位不了。必须构造只激活单一路径的输入。
> ⚠️ **验证边界约定不能用线性数据**：线性 ramp 下所有反射约定结果完全相同，会得出「我的实现是对的」这个**错误结论**。正确做法：**delta 图 + 非对称随机数据 + 大图内区对比**，三者结合。

---

## 七、校验标准

| 指标 | 含义 | 合格线 |
|---|---|---|
| **silhouette IoU** | 形体是否完全一致 | **= 1.00000** |
| **max abs diff** | 色彩偏差 | 视路径而异（见各配方） |
| `check_refs.py` | 画廊页与图片一一对应 | `refs: 22 / missing: none / unused: none` |

**为什么这样定**：单看 hash 会被浮点噪声干扰。IoU=1.0 说明形体完全一致，maxdiff 说明色彩偏差。
凡是 CPU↔GPU、或改版前后的图像对照，都按这两个指标判读。

> ℹ️ **迭代型场（mandelbulb）拿不到 1.00000**：CPU 走 float64、GPU 走 float32，
> 误差被 `8ⁿ` 指数放大，混沌边界上逃逸次数会差 1，边界像素错开约 1 px。
> **形体一致（肉眼无差）就算过**，不要为了刷到 1.0 去改精度。

---

## 八、目录结构

```
math-visual-assets-yashu/
├── SKILL.md                      本文件（入口）
├── references/
│   ├── recipes-22.md             22 图逐个配方：公式/参数/相机/坑/耗时
│   ├── klein-bottle-two-immersions.md  克莱因瓶两种浸入对比（8 字形 vs 瓶形）
│   ├── mandelbulb-postmortem.md  曼德球复盘：正确实现 + 8 个坑 + 定位流程（2026-10-06）
│   ├── timings-22.md             逐图耗时表 + 超 20s 图形的逐个归因（2026-10-05）
│   ├── gpu-compiler-pitfalls.md  14 条编译器坑（完整独立副本）
│   ├── build-methodology.md      四类场建法详解 + 新增图形检查清单
│   └── troubleshooting.md        症状→病因速查（含实测数据）
├── scripts/
│   ├── render3d_gpu.py           GPU 引擎（1235 行）
│   ├── gallery_gpu.py            22 场景定义（mandelbulb / menger / rose3d 已于 2026-10-06 修复，apollonian / dejong 于 2026-10-05 重写）
│   ├── render3d.py               CPU 引擎（回退 + 对照基准，未改动）
│   ├── gallery.py                CPU 场景定义（mandelbulb / menger / rose3d 于 2026-10-06 同步，与 GPU 版逐字对应）
│   ├── check_refs.py             画廊引用完整性校验
│   ├── test_smoke.py             CPU 冒烟测试
│   ├── probes/                   32 个诊断脚本（坑的可复现证据；含曼德球复盘 8 个）
│   └── _out/                     诊断脚本的输出目录（运行产物，可随时删）
└── assets/
    ├── figs/                     成品图 860×860（22 张，编号前缀命名）
    ├── index.html                画廊页（22 条 DATA 记录）
    └── FORMULAS.md               公式清单
```

> ℹ️ **`mandelbulb` 已于 2026-10-06 修复**（`assets/figs/15_mandelbulb.png`）。
> 旧文档说"数值场正确、问题在表面渲染器"是**误诊**：真正的 bug 是场景把三维坐标
> 塞进了一个复数（`X + i(Y+Z)`），场因此是二维集合的拉伸棱柱，渲出来必然是一根管子。
> 现已改为解析距离估计场 `F_MANDELBULB`。完整根因与复现证据见
> `references/recipes-22.md` #15。

> ℹ️ **`menger` 已于 2026-10-06 修复**（`assets/figs/16_menger.png`）。
> 原实现的 `face` 用"坐标对判据 + 放开第三个轴"，挖掉的是**贯穿整条轴的长条板**；
> 第 2 层起完全嵌套在第 1 层里，`keep &=` 删不掉任何东西 ——
> 写了 4 次迭代，实际只得 **1 级海绵**（实测填充率 0.7431 ≈ 20/27，
> 3 级应为 0.4064）。已改为**逐层三进制判据**（三个数字里至多一个为 1，
> 天然可叠加），并取 3 层、修正 EDT 的 `sampling`。
> 完整根因、层数取舍依据与复现证据见 `references/recipes-22.md` #16。

> ℹ️ **`rose3d` 已于 2026-10-06 重写**（`assets/figs/07_rose3d.png`）。
> 这张图的问题**不在渲染，而在构造**：原场景把平面玫瑰线 `r = cos(kφ)`
> **绕 z 轴旋转**，同一个旋转对称性既抹平了方位花瓣，又逼得代码自己加了一个
> 文档里没有的方位调制 `|cos(kφ)|` —— 而它给的是 **2k 个瓣，不是 k 个**
> （探针实测 k=5 时赤道有 10 个瓣，与注释 "gives k petals" 直接矛盾）。
> 于是每条"花瓣"成了沿整根 z 轴的径向厚壁，中心还是个贯穿洞 —— 肉眼就是个风车。
> 现改为**点云花瓣**：56 片各自带局部标架的凹面花瓣，按黄金角错位叠放
> （外瓣摊平、中瓣立起、内瓣卷成花心），另加纺锤 + 底座把花心封死。
> 根因链、构造选择与复现证据见 `references/recipes-22.md` #7。
> 旧解析场 `F_ROSE3D` 仍留在引擎里，可当"陀螺/风车"另用。

> ✅ **命名不一致已于 2026-10-06 修复**：`assets/figs/` 用编号文件名
> （`01_klein_bottle.png`），而 `index.html` 的 `d.k` 现已是**完整的文件名词干**
> （`k:"01_klein_bottle"`），模板 `figs/${d.k}.png` 直接命中。
> `check_refs.py` 结果：`refs: 22 / missing: none / unused: none / OK`。
> **约定**：新增图形时，`DATA` 里的 `k` 必须写成 `NN_<名字>`，与 `figs/` 的文件名完全一致。

**代码分工**：`render3d.py`（CPU 版）**保留不动**，作回退与对照基准。
GPU 版与 CPU 版场景定义逐字对应，只有渲染后端不同 —— 这是逐像素对照成立的前提。

---

## 九、修改本技能时的注意事项

1. **改场景参数优先用 `MATH3D_OUT`** 写到临时目录，确认效果再落到 `assets/figs/`
2. **新图形必须同步更新三处**：`SCENES` 列表、`index.html` 的引用、`references/recipes-22.md` 的配方表。
   其中 `index.html` 的 `k` 必须写成 **`NN_<名字>`**（与 `figs/` 文件名逐字一致），
   并把 `check_refs.py` 的 `EXPECTED` 加 1，之后应报 `refs: 22 / missing: none / unused: none`
3. `assets/figs/` 只放 22 张画廊图，**不要**往 `assets/` 下放任何调试图，否则 `check_refs.py` 会报 unused
