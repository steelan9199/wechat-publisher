# 克莱因瓶的两种浸入（8 字形 vs 瓶形）

> 本技能同时提供 **两种** 克莱因瓶的画法。它们**拓扑完全等价**，外形却差别巨大，
> 选错会出现"这根本不像克莱因瓶"的翻车。本文说明差异、给出两组公式和取舍建议。

## 一句话区分

| | `#1` 克莱因瓶（8 字形浸入） | `#22` 瓶形克莱因瓶（bottle form） |
|---|---|---|
| 外形 | 一根扭转的环管，**没有把手** | 胖瓶身 + 瓶颈穿回瓶身，**有把手** |
| 常见误认 | 像莫比乌斯环 / 甜甜圈 | 一眼认出是克莱因瓶 |
| 参数化 | 简单，一行闭式 | 复杂，含 `cos⁴u` ~ `cos⁷u` |
| 何时用 | 展示"单面 / 自交"、要规则的环状结构 | 要"一看就是克莱因瓶"、教学插图 |

## 一、两者是同一个曲面

克莱因瓶是**拓扑**对象：一个无边、单面、不可定向的紧致曲面。
它**无法**在不自交的前提下嵌入三维欧氏空间 —— 所以任何三维图都只是一个"浸入"
（immersion），允许自交。既然允许自交，就有无穷多种画法，其中最有名的是这两种：

- **8 字形浸入**：把一根管子绕成环，管子截面扭成 8 字，走一圈回来正好翻转 —— 闭合成单面。
- **瓶形浸入**：做成一个瓶子，瓶颈弯下来、穿过瓶壁、从内部连回瓶底。

两者可以互相连续变形（不需要剪开或粘合），所以在拓扑学家眼里是**同一个东西**。

## 二、公式

### 8 字形浸入（技能里的 `klein_bottle`，图 `01_klein_bottle.png`）

```
x = (a + cos(u/2)·sin v − sin(u/2)·sin 2v)·cos u
y = (a + cos(u/2)·sin v − sin(u/2)·sin 2v)·sin u
z = sin(u/2)·sin v + cos(u/2)·sin 2v

u, v ∈ [0, 2π)，a > 2（技能取 a = 2）
```

### 瓶形浸入（技能里的 `klein_bottle_classic`，图 `22_klein_bottle_classic.png`）

```
x = −(2/15)·cos u·( 3cos v − 30 sin u + 90 cos⁴u sin u − 60 cos⁶u sin u
                    + 5 cos u cos v sin u )

y = −(1/15)·sin u·( 3cos v − 3 cos²u cos v − 48 cos⁴u cos v + 48 cos⁶u cos v
                    − 60 sin u + 5 cos u cos v sin u − 5 cos³u cos v sin u
                    − 80 cos⁵u cos v sin u + 80 cos⁷u cos v sin u )

z = (2/15)·(3 + 5 cos u sin u)·sin v

u, v ∈ [0, 2π)
```

> 注意这组公式**不需要分段**。y 前面的 `sin u` 在 u 跨过 π 时自动变号，
> 而那个变号正是"瓶颈穿过瓶壁"的来源。
> 早年的分段写法（`u < π` 用 `cos v`、`u ≥ π` 用 `cos(v+π)`，形如
> `x = 6cos u(1+sin u) + …`）是**另一种环状参数化，画不出把手**，别用错。

## 三、在技能里怎么用

```python
# GPU 版
from gallery_gpu import klein_bottle, klein_bottle_classic
klein_bottle()          # 8 字形，成品图 01
klein_bottle_classic()  # 瓶形，成品图 22

# 命令行只渲其中一张
python gallery_gpu.py klein_bottle_classic
```

两版引擎（`gallery_gpu.py` / `gallery.py`）的场景定义**逐字对应**，
CPU 版可作逐像素对照基准。逐图配方与耗时见 `recipes-22.md`、`timings-22.md`。

## 四、踩过的坑（给下一个 AI）

1. **不要以为"克莱因瓶只有一种"。** 本技能最初只有 8 字形，用户看到后质疑
   "克莱因瓶不是有把手吗？"—— 不是渲染错了，是参数化选的是另一种浸入。
2. **不要用分段参数化冒充瓶形。** 那种写法画出来是一根高瘦的环，**没有把手**。
3. **瓶形物体的尺度很小**（约 4.4 个单位跨度），点云采样必须比体素更细
   （技能用 1600×1000 采样、`res=340`，体素约 0.011），否则管子会碎成点。
4. **薄壳要加厚**：瓶形用 `thick=2`（8 字形用 1 即可）。

---

**图**：`assets/figs/01_klein_bottle.png`（8 字形）、`assets/figs/22_klein_bottle_classic.png`（瓶形）
