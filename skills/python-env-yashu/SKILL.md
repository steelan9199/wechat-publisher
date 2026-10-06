---
name: python-env-yashu
description: 本机 Python 解释器与虚拟环境的权威清单。激活条件：用户消息须包含以下关键词之一：`python环境`、`虚拟环境`、`venv`、`解释器`、`interpreter`、`装依赖`、`安装包`、`pip install`、`uv pip`、`用哪个python`、`python版本`、`环境共享`、`共享环境`、`GPU环境`、`numba`、`cupy`、`CUDA环境`。
agent_created: true
---

# Python 环境（Yashu）

## Overview

本机 Python 相关的解释器与虚拟环境**有两套**，统一放在 `D:\software\uv\envs\`，用途不同，**不要混用**。

| 用途 | 环境名 | 解释器路径 | Python |
|---|---|---|---|
| **CPU 通用环境** | `py314-cpu` | `D:\software\uv\envs\py314-cpu\Scripts\python.exe` | 3.14.7 |
| **GPU 渲染环境** | `py312-gpu` | `D:\software\uv\envs\py312-gpu\Scripts\python.exe` | **3.12.13** |

命名规则：**`py<版本>-<用途>`**。新增环境请沿用此规范，让目录名一眼看出 Python 版本和用途。

> ⚠️ **不要把虚拟环境建在 `D:\software\workBuddyWorkspace` 里** —— 那是工作区，老板会随时清理。
> 所有环境一律放 `D:\software\uv\envs\`。

系统里由 uv 托管的裸解释器（不直接用，仅 `uv venv --python 3.12` 拉环境时用到）：
`D:\software\uv\python3.12.exe`、`D:\software\uv\python3.14.exe`。

---

## 关键铁律：GPU 只能用 Python 3.12

**不要为了装 numba / numba-cuda / cupy 去降级或重建 `py314-cpu`。**

已实测（2026-10-05，RTX 4060 Ti / CC 8.9 / 驱动 591.86 / CUDA Toolkit 12.6）：

| 组合 | 结果 |
|---|---|
| `numba-cuda-mlir` + **Python 3.12** | ✅ 正常，raymarch 实测 **117x** 加速 |
| `numba-cuda-mlir` + Python 3.14 | ❌ 编译 kernel 触发 compiler bug |
| `numba-cuda` + Python 3.14 | ❌ numpy 2.5 删了 `np.row_stack`，import 即崩 |
| `cupy-cuda12x` + Python 3.12 | ❌ kernel 启动硬崩（无 traceback） |
| `cupy-cuda12x` + Python 3.14 | ⚠️ 可跑，但不如 mlir 稳定，不推荐 |

`numba-cuda` 已被官方标记为维护模式，继任者是 `numba-cuda-mlir`——**直接用 mlir，不要碰 numba-cuda**。

---

## 怎么用

### 装包（这两个 venv 都没有 pip，必须用 uv）

```powershell
$py = "D:\software\uv\envs\py312-gpu\Scripts\python.exe"    # 或 py314-cpu
uv pip install --python $py <包名>
```

### 跑脚本

**输出一律重定向到文件再读**（本机 stdout 常不回传，看着像卡死，判断成败看副作用）：

```powershell
& $py "脚本.py" *> "D:\software\workBuddyWorkspace\_out.txt"
"exit=$LASTEXITCODE" *>> "D:\software\workBuddyWorkspace\_out.txt"
```

然后用 Read 读 `_out.txt`。

### 新建环境（沿用命名规范）

```powershell
# GPU 环境
uv venv --python 3.12 "D:\software\uv\envs\py312-gpu"
uv pip install --python "D:\software\uv\envs\py312-gpu\Scripts\python.exe" "numba-cuda-mlir[cu12]" numpy scipy pillow
```

`[cu12]` 后缀必须带，它会拉入 `cuda-bindings 12.x` / `cuda-core` / `nvidia-cuda-*` 运行时，缺了就崩。

### 环境可以重命名

uv venv **支持目录重命名**（内部用相对定位）。改名前后都要验证：

```powershell
Rename-Item "D:\software\uv\envs\<旧名>" "<新名>"
& "D:\software\uv\envs\<新名>\Scripts\python.exe" -c "import numpy; print(numpy.__version__)"
```

---

## GPU 编程要点

```python
from numba_cuda_mlir import cuda

@cuda.jit(device=True)          # 场函数用 device=True
def fld(x, y, z):
    return cuda.libdevice.sin(x) * cuda.libdevice.cos(y)

@cuda.jit                     # kernel 里用 cuda.grid(1)
def kern(out, n):
    i = cuda.grid(1)
    if i < n:
        out[i] = fld(i, 0.0, 0.0)
```

- **数学函数用 `math.*` 或 `cuda.libdevice.*`**，不是 `np.*`。
- **kernel 内不能调任何 Python 函数**。想传场函数，就写成 `device=True` 的 device function，或传标量参数。
- 传 numpy 数组会触发 `NumbaPerformanceWarning`（host→device 拷贝开销）；正式代码用 `cuda.to_device` 显式搬到显存。
- **每个线程负责一个像素**，从像素编号现算光线方向，不要预先物化光线数组——省显存也省带宽。
- 全程用 **float32**。float64 会让显存占用和带宽需求翻倍，加速比直接砍半。
- kernel 首次编译约 1~2 秒，之后热启动毫秒级；批量渲染时同一 kernel 只编译一次。

---

## ⚠️ numba-cuda-mlir 编译器的真实坑（2026-10-05 实测，14 条）

这些**全是跑起来才暴露**的，文档里查不到。每条都是「症状 → 原因 → 解法」。

### 能用 / 不能用

| 写法 | 结果 |
|---|---|
| `math.sin/cos/tan/sqrt/exp/log/atan2/floor/ceil/fabs/copysign/pow/acos/asin/atan/tanh` | ✅ 17 个全可用，**优先级高于 libdevice** |
| `math.isnan` / `math.isinf` | ✅ 可用 |
| `cuda.libdevice.isnan/isinf/sign/abs2` | ❌ **不存在**，属性访问直接 AttributeError |
| `libdevice` 其余（`sin/cos/fmax/fmin/max/min/...`） | ✅ 存在（共 324 个） |
| `np.clip(v,a,b)` / `np.sin` / `np.sqrt` / `np.minimum` | ❌ TypingError |
| `float(bool)` / `int(bool)` | ❌ float 不行（`float() only support for numbers`）；**int 可以** |
| `min(max(v,a),b)` | ✅ 替代 `np.clip` |
| 嵌套 if/else、bool 局部变量、`for`+`break`、`while`、tuple 返回、模块级 numpy 常量被 device fn 引用 | ✅ 全部正常 |
| 动态循环边界（`for _ in range(n)`，n 为 kernel 参数） | ✅ 正常 |

### 坑 1：3D 数组**不能传进 device function**

作为 kernel 参数可以，作为 device function 的参数会报
`input and output rank must be > 0`。

**解法**：网格传**扁平 1D float32** + 手工算stride。
```python
b = (i0 * ny + j0) * nz + k0      # 而不是 g[i0, j0, k0]
```

### 坑 2：`import math` 必须放文件顶部

放文件末尾时，`@cuda.jit(device=True)` 装饰器已在import 阶段执行，device function 里引用 `math` 会失败。

### 坑 3：`hasattr` / `try-except` 不能出现在 device function 里

`hasattr` 报 `Untyped global name 'hasattr': Cannot determine Numba type`；
`try` 报 `mark_try_block`。**写device function 时不要用任何运行时反射/异常处理。**

### 坑 4：设备数组统一用扁平 1D

`(n, 3)` 的二维数组当flat buffer 索引（`out[i*3]`）会在类型推断期报
`Cannot unify float64 and array(float64, 1d, C)`。
**所有 device buffer 一律 `np.zeros(n*3)` + 手动 `*3` 索引**，不要用二维。

### 坑 5：`x != x` 检测 NaN 会被编译器优化掉

实测对 `nan` 返回 `False`（恒等于"不是 nan"）。要用 `math.isnan(x)`。

### 坑 6：kernel 数组参数个数不是问题

23 个参数的 kernel 实测正常。所有标量参数打包成一个 float32 device 数组传，签名只留 4 个，是可行且推荐的做法。

### 坑 7：`carray` 的签名反直觉

`carray(arr, shape)` 缺 shape 报错；传 numpy 数组报 `expected a ctypes pointer`。
**直接用 `cuda.to_device(arr)`，别用 carray。**

### 坑 8：`MAX_THREADS_PER_BLOCK = 1024`，但 64/128/256/512 实测差异在噪声内

小网格（<16 block）会触发 `NumbaPerformanceWarning: Grid size N will likely result in GPU under-utilization`。
**这是警告不是错误，忽略即可。**

### 坑 9：真实性能参考（RTX 4060 Ti）

| 操作 | 耗时 |
|---|---|
| 1720×1720 光线步进 300 步 | **0.022 s** |
| 296 MB（420³ f32）host→device | **0.053 s** |
| 860×860 ss=2 全流程（kernel+bloom+tonemap） | **0.096 s** |
| kernel 首次编译（本机，含 mlir 编译） | **12~13 s** |

**kernel 编译要 12秒**（比文档说的 1~2 秒慢一个量级），批量渲染时一次即可摊销。

### 坑 10：scipy 的 `gaussian_filter` 标量 sigma 会**连颜色轴一起模糊**

`gaussian_filter(img, 3.0)` 作用在 `(H,W,3)` 上时，三个轴都被平滑。
复现到 GPU 时必须补一个 3×3 颜色混合矩阵（按 sigma 生成，独立一趟 kernel），
否则 max diff 差 **0.30**。

### 坑 11：scipy 边界模式 = numpy `symmetric`

索引映射 `-1→0, -2→1, n→n-1`：
```python
while i < 0 or i >= n:
    if i < 0: i = -i - 1
    else:      i = 2 * n - 1 - i
```
用**线性 ramp 数据验证不出来**（几种约定结果相同），**必须用非对称数据测**。

### 坑 12：`gaussian_filter1d` 的权重公式

```python
r = int(4.0 * sigma + 0.5)          # truncate=4.0
x = np.arange(-r, r + 1)
w = np.exp(-0.5 * (x / sigma) ** 2)
w /= w.sum()
```
按此生成可与 scipy 达到 **5e-8**（float32 精度极限）一致。

### 坑 13：验证渲染结果别用"线性数据"测边界

线性渐变下所有边界约定结果相同 → 会得出"我的实现是对的"这个**错误结论**。
本项目因此浪费了两轮：先是用 9×11 小图测（r=5 时每个像素都在反射区，无解），
后是用线性 ramp 测1D 映射（假通过）。**用delta 图 + 非对称随机数据 + 大图内区**才能定位。

### 坑 14：GPU 后处理里累加器不能和输入同一 buffer

`acc += f(blur)` 若 `acc is blur`，则累加器初值变成 blur 本身，且多档 sigma 会互相覆盖。
**必须三个独立 buffer：`base` / `blur` / `acc`。**

---

## 已装包速查

**py314-cpu（3.14.7，705 MB）**：`numpy 2.5.3`、`scipy 1.18.1`、`matplotlib 3.11.2`、`pillow 12.3.0`、`numba 0.68.0`、`llvmlite 0.50.0`，另有 manim / mcp / moderngl / playwright / av 等。

**py312-gpu（3.12.13，~700 MB）**：`numba-cuda-mlir 0.5.4`、`numpy 2.5.3`、`scipy 1.18.1`、`pillow 12.3.0`、`matplotlib 3.11.2`（2026-10-05 为做 CPU/GPU 对照补装）、`cuda-bindings 12.9.9`、`cuda-core 1.2.1`、`cuda-toolkit 12.9.2.0`、`nvidia-cuda-* 12.9.86`。

**已从 py314-cpu 清理**（2026-10-05）：`numba-cuda`、`numba-cuda-mlir`、`cupy-cuda12x`、`cuda-*`、`nvidia-cuda-*` 共 11 个包。`numba` 本体保留（纯 CPU JIT 可用）。

**环境迁移记录**（2026-10-05）：原 `envs\geo` → 重命名为 `envs\py314-cpu`；原 `workBuddyWorkspace\math3d\.venv-gpu` → 重建为 `envs\py312-gpu`。重命名后已验证解释器与全部包正常（uv venv 支持重定位）。

---

## 硬件事实

- GPU：NVIDIA GeForce RTX 4060 Ti，8188 MiB，compute capability 8.9
- 驱动：591.86（支持 CUDA 13.x）
- CUDA Toolkit：v12.6 已装于 `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6`，`nvcc` 在 PATH
- CPU：12th Gen Intel Core i5-12600KF，10 核 16 线程
- 内存：31.8 GB
- MSVC `cl.exe` **未安装**。用预编译 wheel 就不需要它；只有要编译 C++ 扩展才需装 Build Tools。

---

## Notes

- 两个环境隔离，**py314-cpu 保持 3.14 不动**，GPU 相关的一律进 `py312-gpu`。
- **虚拟环境不要建在工作区**（`D:\software\workBuddyWorkspace`），一律放 `D:\software\uv\envs\`。
- `numba` 装在 py314-cpu 里可用于**纯 CPU JIT 加速**（典型 5~15x），例如把 numpy 的逐步循环改成 `@njit`。这与 GPU 无关，可按需使用。
- 并行跑多个进程前设 `OMP_NUM_THREADS=1`、`OPENBLAS_NUM_THREADS=1`、`MKL_NUM_THREADS=1`，并用 `multiprocessing` 的 `spawn` 方式（Windows 必须），否则可能撞 `0xC0000004`。

---

## 已验证的参考实现

`D:\software\workBuddyWorkspace\math3d\render3d_gpu.py`（1235 行）是一份完整可跑的
GPU 光线步进渲染器，覆盖 march / 软阴影 / AO / 体积发光 / bloom / filmic 调色，
**三条路径均与 CPU 版逐像素一致**（IoU 1.0）。写新 kernel 时照它的模式抄最省事。

配套探测脚本在 `math3d\_probes\`（14 个），是本文档各条坑的**可复现证据**，
改编译器版本后应重跑 `_verify_paths.py` 复验。
