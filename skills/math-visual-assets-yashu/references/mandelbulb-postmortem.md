# 曼德球 Mandelbulb 复盘（2026-10-06 修复）

> 本文只讲一件事：**怎么稳定地渲出一张正确的曼德球**。
> 记录 2026-10-05~06 这次修复中踩过的每一个坑、判断依据、修法，
> 以及一套"结果不对时"的定位流程。
> 下次无论是要重渲、换参数，还是中途又渲出了问题，**先看这份**。
>
> 关联文件：`recipes-22.md` #15（配方）、`timings-22.md` 第五节（根因与耗时）、
> `troubleshooting.md` 症状 8、`assets/FORMULAS.md` #10。

---

## 0. 三十秒速查（先看这里）

**正确做法**：用**解析距离估计场**，不要用「迭代逃逸 + EDT 建网格」。

| 项 | 值 |
|---|---|
| 场类型 | A 解析场，设备函数 `render3d_gpu._f_mandelbulb`，`F_MANDELBULB = 5` |
| 迭代式 | `z ← rᵖ·(sin pθ cos pφ, sin pθ sin pφ, cos pθ) + c`，`θ=acos(z_z/r)`，`φ=atan2(z_y,z_x)` |
| 距离估计 | `de = ½·ln(r)·r / dr`，**`r` 取逃逸那一瞬的 `|z|`** |
| 符号 | 逃逸 → `+de`；未逃逸（内部）→ `−de` |
| 参数 | `power=8, iters=16`，场盒 `[−1.45,1.45]³` |
| 相机 | `azim=35, elev=30, zoom=0.68, k=0.95, maxsteps=420` |
| 光照 | `glow=0.12, light=0.62, thin=0.45, contrast=1.00` |
| 画幅 | `W=H=860, SS=2` |
| 耗时 | **2.19 s**（旧实现 60.6 s） |
| 成品 | `assets/figs/15_mandelbulb.png`（860×860） |

**一键重渲**：

```powershell
$env:MATH3D_OUT = "$env:TEMP\mb_out"          # 输出目录，任选
& 'D:\software\uv\envs\py312-gpu\Scripts\python.exe' `
  'C:\Users\Administrator\.workbuddy\skills\math-visual-assets-yashu\scripts\gallery_gpu.py' mandelbulb
```

**出图后必须过的三条数值门限**（不过就是又坏了）：

| 指标 | 合格值 | 含义 |
|---|---|---|
| `min(de)` | **< 0**（实测 −0.183） | 场有负内部。全正 = 只能蹭外壳 → 一定是管子/空壳 |
| `median \|∇de\|` | **≤ 1**（实测 0.63） | 步长安全。>1 会穿透表面，出现毛边/空洞 |
| `frac(de<0)` | 0.1~0.4（实测 0.253） | 实心占比合理。≈0 或 ≈1 都是场塌了 |

---

## 1. 正确实现（逐字）

### 1.1 GPU 设备函数 —— `scripts/render3d_gpu.py`

整型 id 分派：`F_MANDELBULB = 5`（`F_GRID=100` 之下）。

```python
@cuda.jit(device=True)
def _f_mandelbulb(x, y, z, power, iters, spare):
    it = int(iters)
    zx, zy, zz = x, y, z
    dr = 1.0
    r = 0.0
    r_esc = 0.0
    escaped = 0
    for _ in range(it):
        r = math.sqrt(zx * zx + zy * zy + zz * zz)
        if escaped == 0:
            if r > 2.0:                       # 逃逸：记下那一刻的 r，之后冻结轨道
                escaped = 1
                r_esc = r
            else:
                rs = r if r > 1e-12 else 1e-12
                ct = zz / rs
                if ct < -1.0: ct = -1.0
                if ct >  1.0: ct =  1.0
                theta = math.acos(ct) * power
                phi   = math.atan2(zy, zx) * power
                dr = math.pow(rs, power - 1.0) * power * dr + 1.0
                zr = math.pow(rs, power)
                st = math.sin(theta)
                zx = zr * st * math.cos(phi) + x
                zy = zr * st * math.sin(phi) + y
                zz = zr * math.cos(theta) + z
        else:
            zx = zy = zz = 0.0

    if escaped == 1:
        r = r_esc                             # ← 关键：用逃逸那一刻的 r
    else:
        r = math.sqrt(zx * zx + zy * zy + zz * zz)
    if r < 1e-12: r = 1e-12
    de = 0.5 * math.log(r) * r / dr
    if de < 0.0: de = -de                     # 取绝对值
    if escaped == 1: return de                # 外部为正
    return -de                                # 内部为负，制造符号变化
```

分派处（`render3d_gpu.py` 约 318 行）：

```python
        return _f_mandelbulb(x, y, z, P[13], P[14], P[15])
```

### 1.2 CPU 回退闭包 —— `scripts/gallery.py`

```python
def fn(x, y, z):
    zx, zy, zz = x, y, z
    dr = np.ones_like(zx)
    escaped = np.zeros(zx.shape, bool)
    r_esc = np.zeros(zx.shape)
    r = np.zeros(zx.shape)
    for _ in range(IT):
        r = np.sqrt(zx * zx + zy * zy + zz * zz)
        newly = (~escaped) & (r > 2.0)
        r_esc = np.where(newly, r, r_esc)
        escaped = escaped | newly
        rs = np.where(r > 1e-12, r, 1e-12)
        theta = np.arccos(np.clip(zz / rs, -1.0, 1.0)) * POWER
        phi   = np.arctan2(zy, zx) * POWER
        dr = np.where(escaped, dr,
                      np.power(rs, POWER - 1.0) * POWER * dr + 1.0)
        zr = np.power(rs, POWER)
        st = np.sin(theta)
        ax = zr * st * np.cos(phi) + x
        ay = zr * st * np.sin(phi) + y
        az = zr * np.cos(theta)     + z
        keep = ~escaped
        zx = np.where(keep, ax, 0.0)
        zy = np.where(keep, ay, 0.0)
        zz = np.where(keep, az, 0.0)
    r = np.where(escaped, r_esc, np.sqrt(zx * zx + zy * zy + zz * zz))
    r = np.maximum(r, 1e-12)
    de = np.abs(0.5 * np.log(r) * r / dr)
    return np.where(escaped, de, -de)
```

### 1.3 两条引擎共用的场景定义

```python
def mandelbulb(power=8, iters=16):
    return trace_surface(None, [-1.45] * 3, [1.45] * 3, W, H, SS,
                         azim=35, elev=30, k=0.95, maxsteps=420,
                         glow=0.12, light=0.62, thin=0.45, zoom=0.68,
                         contrast=1.00,
                         kind=F_MANDELBULB,
                         p0=(float(power), float(iters), 0.0))
```

CPU 版把 `fn` 包进 `AnalyticField(fn, [-1.45]*3, [1.45]*3)` 再走 `trace_surface`，
其余参数逐字相同 —— 这是本技能"两条引擎只换渲染器"的硬约定。

---

## 2. 本次踩过的坑（8 个）

### 坑 1 ★根因★ 三维坐标被压成了一个复数 → 场退化成二维

**症状**：渲出来是一根光滑的扭曲管子/薄板，完全不是球，且**任何视角都像"蕾丝球"**。

**坏代码**（`gallery.py` 与 `gallery_gpu.py` 各有一份）：

```python
c = (X + 1j * Y).ravel() + 1j * Z.ravel()      # == X + i·(Y+Z)
```

**根因**：复数只有实部/虚部两格，这句把 `y` 和 `z` 挤进了同一个虚部。
整个场只依赖 `x` 与 `y+z` —— 即"二维集合沿 (0,1,−1) 方向拉伸出的棱柱"。
**这就是那根管子。** 球坐标幂映射需要全部三个坐标分量，`_f_mandelbulb` 才有。

**铁证**（保持 `y+z` 不变取两张切片，必须逐位相同）：

```python
np.array_equal(field(X, 0, Z), field(X, 0.4, Z - 0.4))   # -> True
```

**修法**：改用三维球坐标幂映射（见 §1）。

**再踩的识别**：只要出图是"管子/棱柱/沿某方向拉长"，先查场里有没有把 3D 坐标塞进 1 个复数。

---

### 坑 2 距离估计里的 `r` 取错了时刻 → 整个场塌成噪声

**症状**：切片的 `de` 最大值只有 **6e-4**（应为 0.8 量级），场像一层薄雾，没有形体。

**坏写法**：循环结束后统一取 `r = |z|`。但逃逸后的点轨道已被冻结成 0，
`|z|` 不再是逃逸那一刻的模长。

**修法**：在**首次越界的那一次迭代内**记下 `r_esc = r`，循环后
`r = r_esc if escaped else |z|`。见 §1.1。

**自检**：`min(de)` 若接近 0 且 `max(de)` 也在 1e-3 级 → 多半是这个。

---

### 坑 3 防溢出的 `log(max(r,1.001))` 会把内部负号翻正

**症状**：场**全场为正**（实测 `min = +0.000`），没有负内部。
没有负内部的场没法做球体步进，光线只能蹭最外壳 → 又变成管子/空壳。

**坏写法**：

```python
de = r * np.log(np.maximum(r, 1.001)) / np.abs(dz)      # ✗
```

`maximum(r, 1.001)` 在 `r < 1`（即内部）时把 `ln` 的负号**截掉**了。

**修法**：符号**由"是否逃逸"给出**，不要指望 `ln` 的符号：

```python
de = np.abs(0.5 * np.log(r) * r / dr)
return np.where(escaped, de, -de)      # 逃逸为正，内部为负
```

**逻辑上必须成立**：逃逸点 `r > 2` ⇒ `ln r > 0` ⇒ `de > 0`；内部点直接给负。
这样场在表面两侧有符号变化，步进器的二分细化才能咬住。

---

### 坑 4 float64 `z**8` 溢出成 inf → NaN，**NaN 静默吃掉体素**

**症状**：占据场上被打出隧道。`res=80` 时 **19%** 的格子是 NaN。

**根因**：`z**8` 在 float64 下溢出为 `inf` → 下一步 `inf - inf` 得 `NaN`。
**关键陷阱：`NaN` 与任何阈值比较都是 `False`**，于是这些体素在所有
`(r > BAIL)` 之类的判断里静默落选，既不"内"也不"外"，直接消失。

**修法**（两条都做）：
1. 用 `np.errstate(over="ignore", invalid="ignore")` 包住迭代；
2. 逃逸后把 `z` 显式冻结成 0（`z = np.where(esc, 0.0, z)`），从源头断掉 NaN 传播。

**推广**：任何"越界比较"式的判据都怕 NaN。判据要么先 `isfinite`，要么**主动消除 NaN**。

---

### 坑 5 误诊：把"渲染器坏"当成结论（旧文档的错误）

旧 `recipes-22.md` #15 写着：

> "数值全部正确（占据率 19.9%、中心实心、点探针与解析答案一致），
> 但 GPU 与 CPU 两条独立引擎仍然都把它渲成管子……责任在**表面渲染器**。"

**这是错的。** 推理漏洞在于："两条独立引擎都错 ⇒ 渲染器错" —— 但如果
**两条引擎读的是同一份错场**，照样会一起错。事实正是如此：根因在场（坑 1）。

**教训（重要）**：**"两个实现都错"不能推出"错在公共下游"**。
先确认**上游输入是否被共享**。本案里 `gallery.py` 与 `gallery_gpu.py`
把同一句塌缩写法各抄了一份，看起来"独立"，其实是同一个 bug 的两份拷贝。

**修法**：删掉该段误诊结论，改写为根因描述（已在 #15 与 `timings-22.md` 更新）。

---

### 坑 6 `ss=1` 是引擎没走过的分支 → 对照实验当场冤枉了 GPU

**症状**：做 CPU/GPU 同图对照时，GPU 那张**下半幅全黑**，一度以为 GPU 引擎坏了。

**根因**：为了省时间把对照分辨率调小，顺手写了 `SS = 1`。
但**画廊恒用 `SS=2`**，`ss=1` 这条分支引擎从没走过，行为未定义。

**修法**：对照实验一律沿用 `SS=2`。改成 `SS=2` 后两张图马上肉眼一致。

**推广**：**做对照实验时，参数必须落在产品实际走过的取值上**，
不要为了图快引入"从没测试过"的组合，否则差异来自未测分支，白费一轮。

---

### 坑 7 把"阴影色 ≈ 背景色"误读成"几何透光"

**症状**：图里能从物体**中间**看见背景色，像是几何被打穿了 → 一度判断是
"光线大量脱靶"的几何问题。

**真相**：用 numpy 独立复刻 `_march` 统计后——
脱靶 **0** 条、无空洞、无毛边（`missed by marcher = 0`）。
所谓"透光"其实是**自阴影过深**，阴影处的深色调碰巧和背景渐变撞色了。

**修法**：把 `light` 拉高（0.95→0.62 是另一组参数下的调整）、`glow` 微调。

**推广**：**"看起来像几何问题"不等于几何问题。**
在动几何/场之前，先用独立步进器数一遍脱靶率（见 §3 步骤 C）。

---

### 坑 8 迭代次数是**形状参数**，不是"填够就行"的摆设

**症状**：一开始担心迭代太少导致形状不对，但也不确定该取几次。

**实测**（860×860，以 `iters=40` 为收敛基准，统计与基准不同的像素占比）：

| iters | maxdiff | 像素差 >8/255 | 像素差 >32/255 |
|---|---|---|---|
| 4 | 153 | **22.18%** | **6.47%** |
| 6 | 91 | 4.68% | 0.73% |
| 8 | 73 | 1.57% | 0.16% |
| 12 | 66 | 0.64% | 0.025% |
| 20 | 47 | 0.26% | 0.004% |
| 40 | 0 | — | — |

**结论**：4 次迭代**形状确实不够**（22% 像素可见差异，球更"胖钝"）；
差异随迭代单调收敛，**8~12 次起就只差分形边界的亚百分比像素**。
取 **16** 是稳妥点（离收敛足够近，又不为收敛尾巴付时间）。

**推广**：迭代型场（曼德球/吸引子）的迭代数是**几何参数**，
换个 `iters` 就是换一个形状，别当成"性能旋钮"随意调小。

---

## 3. 定位流程（结果不对时照这个走）

### A. 先分清"场错"还是"渲染器错"

判据：**绕过渲染器，独立把场画成切片**（`_mb_probe.py` 的做法）。

```python
# 把场在某平面上求值，负值涂暗，直接存成 PNG 看
vis = np.where(d < 0, 0.15, 1.0 - np.clip(d / 0.6, 0, 1))
```

- 切片**有正确的分形形状**（7/8 重对称、有负内部）→ 场没问题，查渲染器；
- 切片是**管状/条纹/沿某方向拉长** → **场的问题**，回到坑 1/2/3/4。

> ⚠ 顺序很重要。本案第一版就是"看渲染结果就下结论"，白跑了一轮。
> **永远先看场的切片，再看渲染图。**

### B. 证明"维度塌缩"用**逐位比对**，不要用肉眼

保持某个组合量不变，取两张切片，要求 `np.array_equal(...) == True` 才算坐实。
肉眼"看着像管状"只是线索，不是证据。

### C. 证明"渲染器是否脱靶"用**独立 numpy 步进器**（`_mb_march.py`）

把 `render3d_gpu._march` 用 numpy 复刻一遍，打印：

```
box-hit rays           : 命中包围盒的光线数
marched hits           : 步进命中的
misses (background)    : 脱靶（背景）
of which step-exhausted: 其中因步数耗尽的
analytic silhouette    : 解析轮廓（沿光线密集采样看 de 是否变号）
missed by marcher      : 轮廓存在但步进没命中  ← 这个大就是渲染器有洞
hit but not a surface  : 步进命中但没有轮廓      ← 这个大就是幻影命中
```

**合格基线（本案）**：`missed by marcher = 0`、`step-exhausted = 0`、
`median steps ≈ 20`。两个"坏数"都为 0 ⇒ 渲染器健康。

### D. 两侧引擎一致性用 **IoU**（`_mb_parity.py`）

同场景、同参数、`SS=2`、分辨率调小（如 240）跑 CPU 与 GPU，
用技能既有的轮廓 IoU 判据比对。

**本案**：`IoU = 0.991`，`maxdiff = 0.079`。
残差**全部落在混沌边界** —— 源于 CPU float64 / GPU float32 的舍入被 `8ⁿ` 迭代放大。
**这是迭代型场的理论上限，不用再追。** 不要因为这 0.9% 去改渲染器。

### E. 形态对不对，靠**公认参考图**目视确认

去 Wikimedia Commons 拉一张公认的 power-8 曼德球（`Power_8_mandelbulb_fractal_overview` 等），
并排看。**power 8 的曼德球本来就是"珊瑚/花椰菜球"形态**，不是光球——
先确认自己的形状和它同族，再谈细节。

---

## 4. 出图前检查清单

- [ ] 场用解析 DE（`F_MANDELBULB`），**不建网格、不跑 EDT**
- [ ] `min(de) < 0` 且 `median|∇de| ≤ 1`
- [ ] 切片呈正确的分形形状（非管状/条纹）
- [ ] 两条引擎都能出图，IoU ≥ 0.95
- [ ] 成品图写进 `assets/figs/15_mandelbulb.png`
- [ ] 本图（曼德球）体检 `max ≥ 0.5`、`std ≥ 0.07`（实测 0.76 / 0.206；全局最小值见 `timings-22.md` §七）

---

## 5. 本次用过的探针脚本（可复用）

全部在技能内 **`scripts/probes/`**，输出写到 `scripts/_out/_mandelbulb/`（可用 `MATH3D_OUT` 覆盖）。
脚本用 `__file__` 定位引擎，**不依赖任何外部目录**，可独立复跑。

| 脚本（`scripts/probes/`） | 作用 | 关键输出 |
|---|---|---|
| `_mandelbulb_probe.py` | 证明旧场二维塌缩 + 验证新 DE（§3A/§3B） | `identical slices -> True`；`min=-0.183, frac<0=0.253, \|grad\|=0.63` |
| `_mandelbulb_march.py` | numpy 复刻步进器，统计脱靶（§3C） | `missed by marcher = 0`、`step-exhausted = 0` |
| `_mandelbulb_parity.py` | CPU↔GPU 同图 IoU 对照（§3D；注意必须 `SS=2`） | `IoU = 0.991` |
| `_mandelbulb_iters.py` | 迭代次数扫描（坑 8） | `i04…i40.png` |
| `_mandelbulb_preview.py` / `_mandelbulb_preview2.py` | 多参数共用一次 kernel 编译，批量试相机/曝光 | 4+6 张变体 |
| `_mandelbulb_final.py` | 最终曝光候选二选一 | `F1.png` / `F2.png` |
| `_figs_health.py` | 成品图 max/std/主体占比体检 | 见 `timings-22.md` §七 |

---

## 6. 时间线（供回顾）

1. 出图 → 是管子；查旧文档 → 发现 `⚠ KNOWN BAD OUTPUT` 与"渲染器有缺陷"的结论。
2. 读场景代码 → 发现 `(X + iY) + iZ` 塌缩 → **疑根因**。
3. 写 `_mb_probe.py` → 逐位比对坐实"二维塌缩"（坑 1），同时验证新 DE。
4. 新 DE 第一版塌成 6e-4 → 定位"`r` 取错时刻"（坑 2）→ 修。
5. DE 符号：`log(max(r,1.001))` 翻正负号（坑 3）→ 改用逃逸判据给符号。
6. 改为解析场（`F_MANDELBULB`）→ 出真正的曼德球。
7. 曝光过亮、镜头偏正 → 批量预览调参（坑 7 的"透光"实为阴影撞色）。
8. `_mb_march.py` 独立步进 → 脱靶 0，排除几何问题。
9. 迭代扫描（坑 8）→ 定 `iters=16`。
10. 参考图确认形态族 → 定稿曝光与镜头。
11. CPU 版同步改写（同一句塌缩，另一份拷贝）。
12. `_mb_parity.py` IoU 0.991；期间踩了 `ss=1` 未测分支（坑 6）。
13. 回归对照：klein / lorenz 与此前基线逐位一致，未引入回归。
14. 全 21 图端到端重渲（364.6 s），曼德球 **2.19 s**。
15. 成品落盘 `figs/`，文档同步，删除旧误诊结论（坑 5）。
