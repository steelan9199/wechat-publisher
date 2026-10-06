# 四类场的建法（新增图形的方法论）

要加第 22 个图形时，**先选对场类型** —— 这决定了性能、代码量和调试难度。

---

## 决策树

```
你的数学对象是什么？
│
├─ 有闭式表达式 F(p) = 0，且要快→ A. 解析场（0.07~2.19s）
│    例：gyroid / schwarz_d / heart / superformula / mandelbulb
│
├─ 有参数方程 x(u,v), y(u,v), z(u,v)，或由**多片**拼成？→ B. 参数曲面/点云 → SDF（2.7~23s）
│    例：klein_bottle / roman / boys / helicoid / enneper / rose3d
│
├─ 由迭代/布尔规则定义（分形、轨道）？→ C. 占据场 → SDF（2~27s）
│    例：mandelbulb / menger / apollonian / orbital_d,f
│
└─ 一维曲线（吸引子轨迹）？→ D. 体积发光积分（14~20s）
     例：lorenz / dejong / clifford
```

**优先选 A。** 解析场不建网格，是数量级的速度差异。

---

## A. 解析隐式场

### 怎么加（4 步）

**1** 在 `render3d_gpu.py` 里加 `@cuda.jit(device=True)` 场函数：

```python
@cuda.jit(device=True)
def _field_yourname(P, g, x, y, z):
    # 只能用 math.*，不能用 np.*
    return math.cos(x) * math.cos(y) + math.cos(y) * math.cos(z) \
         + math.cos(z) * math.cos(x)          # 例：gyroid
```

**2** 加一个整型常量（在 `F_` 常量区）：

```python
F_GYROID = 0
F_SCHWARZ_D = 1
F_YOURNAME = 2# 新增
```

**3** 在 kernel 的 `_field()` 分派里加分支：

```python
if kind == F_GYROID:
    ...
elif kind == F_YOURNAME:               # 新增
    return _field_yourname(P, g, x, y, z)
```

**4** 在 `gallery_gpu.py` 里调用：

```python
def yourname():
    L = 1.05 * np.pi
    return trace_surface(None, [-L]*3, [L]*3, W, H, SS,
                         azim=30, elev=18, k=0.62, maxsteps=300,
                         thin=0.7, kind=F_YOURNAME)
```

### 为什么必须「设备函数 + 整型 id 分派」

`AnalyticField(fn, ...)` 的 **Python 闭包无法跨进 kernel**。
一个 kernel 服务全场景，编译器生成分支而非函数指针。
这是**已验证的设计决策**，不要改成传函数对象。

### 参数怎么调

| 参数 | 作用 | 建议 |
|---|---|---|
| `k` | 步长比例 | 场有多处零点时必须小（0.2~0.6）；单连通光滑场可大（0.9） |
| `maxsteps` | 最大步数 | 域越大/结构越细越要加 |
| `thin` | 着色薄度 | 0.5~0.85 |
| `fov` | 视场（默认 30） | 想要透视畸变更强就调大 |

⚠️ 解析场**步进穿透薄面**是头号问题：表现为"表面出现黑洞或噪点"。
对策：先降 `k`，再升 `maxsteps`。

### 已有解析场可参考的实现

| 场 | 函数 ID | 特点 |
|---|---|---|
| Gyroid | `F_GYROID` | 三个零点方向，`k=0.62` |
| Schwarz D | `F_SCHWARZ_D` | 零点更多，`k=0.55` |
| Superformula | `F_SUPERFORMULA` | 用 `p0=(m,n1,n2)`、`p1=(n3,a,b)` 传参 |
| Rhodonea（陀螺形） | `F_ROSE3D` | 用 `p0=(k,0,0)` 传参。**画廊已不用它**：绕 z 轴旋转的构造产不出方位花瓣，数学玫瑰改走 B 类点云 |
| Heart | `F_HEART` | 高次幂，`thin=0.5` |

**传参技巧**：超过 4 个标量参数时，打包成一个 float32 数组
（`P[13:16]`、`P[16:19]` 等已预留给 `p0`/`p1`）。

---

## B. 参数曲面 → 点云 → SDF

### 怎么加

**1** 写参数方程与采样：

```python
def yourname():
    def fn(U, V):
        # U、V 是 meshgrid 出来的二维数组
        return np.stack([...], -1)         # (nu, nv, 3)

    P = param_cloud(fn, nu, nv, u0, u1, v0, v1)
    f = sdf_from_points(P, pad=0.05, thick=1, res=340)
    return trace_surface(f, f.lo, f.hi, W, H, SS, azim=38, elev=18,
                         k=0.95, glow=0.14, thin=0.7)
```

**2** 需要裁剪时（谨慎！）：`P = P[np.abs(P).max(1) < 阈值]`

**3** 需要沿曲线扫掠成管（knot/horn 类）时，用 **Frenet 标架**：
先算切线 `T`，再算法线 `N = cross(ref, T)`，副法线 `B = cross(T, N)`，
最后 `P = 中心 + rad·(cos(V)·N + sin(V)·B)`。参考 `trefoil()`。

**4** 一个"物体"由**许多片组成**时，别硬凑一张参数曲面 ——
给每一片建**它自己的局部标架**，各生成一段点云，拼接后统一交给
`sdf_from_points` 求并集。参考 `rose3d()`：56 片花瓣各自带方位角 `φ₀`、
基部半径/高度、倾角与截面凹度，`np.concatenate` 之后一次建场。
这条路能表达的形体比解析场宽得多（代价是慢一个数量级，见 `timings-22.md`）。

### 三个必查项（错了就是废图）

**① 参数域必须覆盖整个曲面**
对 `sin/cos` 参数化，范围少一半是**最常见错误**（roman 就栽在这）。
```python
print(Praw.min(0), Praw.max(0))          # 看包围盒是否被不对称切掉
```

**② 两个方向的采样间距都要 ≤ 体素**
摩尔纹的第一病因是欠采样，不是分辨率。
```python
dv = (v1 - v0) / nv
print(dv / vox)                           # 必须 <= 1
```

**③ 分辨率上限是硬约束**
`sdf_from_points` 里 `n = np.minimum(n, 420)`，**超过 420 静默失效**。

### 参数速查

| 参数 | 含义 | 经验值 |
|---|---|---|
| `pad` | 盒外留白比例 | 薄曲面 0.10，一般 0.05~0.06 |
| `thick` | 形态学膨胀层数 | 1（会额外再膨胀 1 层）；**壳很薄**（花瓣、叶面）用 2，否则曲面会时断时续 |
| `res` | 网格分辨率 | 290~420，越大越慢 |
| `wrap_u` | 是否周期 | 首尾相接的曲面用 `True`（`endpoint=False`） |

---

## C. 占据场 / 分形 → SDF

### 三条路

| 手段 | 适用 | 特点 |
|---|---|---|
| **距离估计场** | mandelbulb | 直接算 `de ≈ r·ln(r)/|dz|`，**天然平滑，无需 EDT** |
| **布尔占据 → EDT** | menger / orbital | `keep` 布尔数组 → `sdf_from_occupancy`；手写 EDT 时 `sampling` 必须等于掩膜自己的体素尺寸（见 recipes #16 坑 3） |
| **多个 SDF 取 min** | apollonian | 比反复采样快得多 |

### 必查项：**占据网格分辨率必须 ≥ SDF 网格分辨率**

这是**最反直觉的坑**：orbital 原来占据网格 res=240（体素 0.0096）
比 SDF 网格 384（体素 0.0060）**还粗**，
所以 SDF 只是三线性放大一个块状掩膜 —— **提 SDF 的 res 完全无效**，
块状壳层就表现为同心环摩尔纹。

**两个 res 必须一起提。**

```python
res = 384                # 占据网格
g = np.linspace(-half, half, res)
...
f = sdf_from_occupancy(keep, [g[0]]*3, [g[-1]]*3, thick=1,
                       res=384, smooth=0.8)   # SDF 网格，同为 384
```

`smooth` 参数：`sdf_from_points` 一直用 `sigma=0.6` 平滑，
但 `sdf_from_occupancy` 原本**不磨平** —— 用 `smooth=` 显式开启，
可消除体素台阶。默认 `smooth=0.0` 保持旧行为。

### 阈值必须相对场的实际上界设

orbital_f 栽在这：`c=0.95` 是对 `｜Y₃₀｜ = ｜cos3θ｜` 设的，
但**该场上界只有 1.0** → `|cos3θ| > 0.95` 只剩极值附近
→ 填充率 2.07%，塌成两片碎块。

```python
print(keep.mean())        # 填充率：1~10% 正常，<3% 很可能阈值过高
```

**`|Y_lm|` 的上界随 l 变化**：`Y₂₀` 上界 2.0（`c=0.62` 合理），
`Y₃₀` 上界 1.0（`c=0.95` 就过高，改 0.50）。

---

## D. 体积发光积分（吸引子）

### 怎么加

**1** 迭代出轨迹点云：

```python
def yourattractor():
    n = 130000
    x = np.empty(n); y = np.empty(n); z = np.empty(n)
    x[0], y[0], z[0] = 1.0, 1.0, 1.0
    for i in range(1, n):
        x[i] = ...                # 用 x[i-1], y[i-1], z[i-1]
    P = np.stack([x, y, z], 1)
    P = P - P.mean(0)            # 居中
    P /= np.abs(P).max() * 1.05# 归一化
    return _tube_from_points(P, rad=0.0045, res=420, gain=0.50,
                             dens=30.0, close=2)
```

**2** 三个必查项：

**① `close` —— 跳跃型映射必须桥接**
```python
d = np.linalg.norm(np.diff(P, axis=0), axis=1)
print(d.mean() / vox)            # > 3 体素就要加 close
```
| 类型 | 间距 | `close` |
|---|---|---|
| ODE 积分（lorenz） | 2.9 体素 | 0 |
| 跳跃映射（dejong） | 170 体素 | 需加 |
| 跳跃映射（clifford） | 238 体素 | 2 |

**② `rad` 会被静默抬到 `2.2*vox` 下限**
网格粗时你设的 `rad` 失效。`rad/vox` 至少要 2.2，否则被抬。

**③ 表面细密颗粒可能是真实结构**
吸引子是**充满空间的分形**，渲出来本就有丝状纹理。
用 `_diag_clifford_grain.py` 对比已验收场景的 `highfreq_rms`，
同量级就是真实结构，**不要修**。

### 参数速查

| 参数 | 含义 | 经验值 |
|---|---|---|
| `rad` | 管半径 | 会被抬到 `2.2*vox`；一般设小一点没关系 |
| `res` | 网格分辨率 | 380~420 |
| `gain` | 总亮度 | 0.40~0.62。`close` 加粗后要**提 gain** 补偿 |
| `dens` | 密度系数 | 30.0 |
| `steps` | 积分步数 | 170。dt=span/steps 远大于 sigma 会欠采样 |
| `sigma` | 高斯核宽度 | `_tube_from_points` 内部设为 `rad*wid` |

---

## 新增图形的检查清单

加完第 22 个图形后，逐项确认：

- [ ] 渲染出图了，且**形体完整**（不是一小片碎片）
- [ ] **无摩尔纹**（采样间距都 ≤ 体素）
- [ ] **取景合理**（物体不偏小、不出画）
- [ ] 打印过`P.min(0)/P.max(0)` 或 `keep.mean()` 验证过参数域/阈值
- [ ] `SCENES` 列表已加 `("key", "标题", 函数)`
- [ ] `index.html` 已加对应引用 `k:"key"`
- [ ] `references/recipes-22.md` 已加配方行
- [ ] `check_refs.py` 报 `refs: 22 / missing: none / unused: none`
- [ ] 图像放进 `assets/figs/`（**不要**往 `assets/` 下放调试图，会被报 unused）

---

## 性能真值

（RTX 4060 Ti）：1720² 光线步进 300 步 = 0.022s；
860×860 ss=2 全流程 = 0.096s；kernel 首次编译 24s（冷启动），
开启 `@cuda.jit(cache=True)` 落盘缓存后二次起 ~0.9s；EDT 改用 `edt` 包后
从 9.6s 降到 0.30s。单张端到端 35.8s → 2.6s。
