# Manim API 查证与踩坑记录（math-animation-video 专用）

> **版本锁定：Manim Community Edition 0.21.0**（版本固定，勿升级）
> 本机源码：`D:\software\uv\envs\geo\Lib\site-packages\manim`
> 官方仓库：<https://github.com/ManimCommunity/manim>
> 渲染器 Python：`D:\software\uv\envs\geo\Scripts\python_direct.exe`
>
> 本文件记录「怎么查 API」的方法，以及一次真实交付（环面纽结三维动画）
> 中实际校验过的 API 论断。**所有结论都经过本机实测，不是抄文档。**

---

## 零、版本规则（先读这一节）

### 0.1 只认社区版 0.21.0

| 项目 | 值 |
|---|---|
| 发行版 | **Manim Community Edition**（`Author: The Manim Community Developers`） |
| 版本 | **0.21.0**（社区仓库 `main` 分支当前即此版本） |
| 官方仓库 | <https://github.com/ManimCommunity/manim> |

**不要**混用 3b1b 版（`/3b1b/manim` 是**另一个项目**）或 ManimGL。

### 0.2 Context7 只用 `/manimcommunity/manim`

| libraryId | 状态 | 说明 |
|---|---|---|
| **`/manimcommunity/manim`** | ✅ **唯一允许** | Manim CE 官方库，905 snippets，High reputation |
| `/3b1b/manim` | ❌ 禁用 | **另一个项目**，API 与 CE 不同 |
| `/websites/3b1b_github_io_manim` | ❌ 禁用 | 3b1b 文档站 |
| `/adithya-s-k/manim_skill` | ❌ 禁用 | 第三方技能库 |
| `/websites/deepwiki_manimcommunity_manim` | ❌ 禁用 | DeepWiki 镜像 |

### 0.3 Context7 无法锁定版本（实测结论）

尝试使用版本化 libraryId 会直接失败：

```
DeferExecuteTool("mcp__context7__query-docs",
  params={"libraryId": "/manimcommunity/manim/0.21.0", ...})
→ "Version \"0.21.0\" not found for library \"/manimcommunity/manim\".
   This library has no versions."
```

`resolve-library-id` 返回的 5 个候选里也**都没有 Versions 字段**。

**结论：「在 Context7 里只查 0.21.0」在技术上无法实现。** 替代方案：

- Context7 **只当「用法参考」**（找官方示例、确认命名、查参数含义）
- **版本权威永远是本机源码**——它能 100% 证明本机跑得通
- 关键 API **用本机再确认一次**（30 秒自查法，见第三节）

### 0.4 三者已确认同源

| 验证项 | 结果 |
|---|---|
| 本机 `manim.__version__` | `0.21.0` |
| 本机 `importlib.metadata.version("manim")` | `0.21.0` |
| dist-info | `manim-0.21.0.dist-info`（由 `uv` 安装） |
| METADATA `Author` | `The Manim Community Developers, Grant '3Blue1Brown' Sanderson` |
| 结论 | **本机 = 社区版 0.21.0**，与官方仓库 `main` 同源 |

所以 Context7 的示例对本机**直接有效**——不必担心「主干比本机新」。

### 0.5 升级后必跑守门脚本

本文件所有 API 结论都基于 0.21.0。一旦升级会**静默失效**：

```powershell
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" "<本技能目录>/scripts/check_manim_version.py"
```

| 退出码 | 含义 | 该做什么 |
|---|---|---|
| `0` | 通过，6 条锚点均符合 | 可放心使用本技能模板 |
| `1` | **锚点漂移**：API 事实变了 | 更新本文档第五节 + `scene-template.md` |
| `2` | **版本/来源不符** | 文档需**整体复核**，逐条重跑 30 秒自查法 |

脚本校验：版本号、dist-info、社区版来源识别，以及 6 条 API 锚点
（`CYAN`/`MAGENTA` 不存在、`TEAL` 存在、`time_since_start` 不存在、
`self.time` 存在、`interpolate_color` 第三参数名为 `alpha`）。

---

## 一、为什么要写这份文件

Manim 的 API 迭代很快，而本机**锁定 0.21.0**。凭记忆写代码是本技能最大的风险来源
——本次交付中 11 次渲染里有 3 次直接崩溃，**全部是 API 问题**（不是逻辑问题）：

1. 用了 `CYAN` → `NameError`（该常量不存在）
2. `np.linspace` 末位索引越界 → `IndexError`
3. 写了 `self.time_since_start` → `AttributeError`（该属性不存在）

第 1、3 条都是「凭印象写 API」的直接后果。这份文件的作用是：
**把「猜 API」变成「查 API」，并给出查的顺序。**

---

## 二、信源分工（社区版 0.21.0，三者同源）

| 角色 | 信源 | 怎么用 | 边界 |
|---|---|---|---|
| **版本权威** | **本机源码** `...\site-packages\manim` | Read / Grep 真实文件 | 与任何文档冲突时**以它为准** |
| **用法参考** | **Context7** `/manimcommunity/manim` | 查官方示例、确认命名 | ⚠️ **无版本索引**，不能锁版本 |
| **变更历史** | 官方仓库 | 读 issue / PR / CHANGELOG | 理解版本变更来龙去脉 |

因为三者同源，Context7 的示例**对本机直接有效**；但**关键 API 仍建议本机再确认一次**
——这是唯一能100% 证明「跑得通」的方式，且只需 30 秒。

**为什么仍要本机确认**：
- Context7 返回的是文档摘要，不一定包含全部参数与边界条件
- 本机源码是**唯一可执行验证**的信源
- 30 秒自查成本远低于一次渲染失败（本次单次渲染 25～41 s）

---

## 三、Context7 MCP 用法（本技能标准流程）

### 第 1 步：确认库 ID

**已固定为 `/manimcommunity/manim`，不需要每次重新解析。**
若确需解析：

```
ToolSearch(tool_names=["mcp__context7__resolve-library-id"])
DeferExecuteTool(toolName="mcp__context7__resolve-library-id",
  params={"libraryName": "Manim",
          "query": "Manim Community animation library Python scene rendering"})
```

实测返回（High reputation，905 snippets）：

| Library ID | 说明 | 选定 |
|---|---|---|
| **`/manimcommunity/manim`** | Manim CE 官方仓库| ✅ **唯一允许** |
| `/3b1b/manim` | 3Blue1Brown 的 3b1b 版本（**不同项目**） | ❌ 禁用 |
| `/websites/3b1b_github_io_manim` | 3b1b 文档站 | ❌ 禁用 |
| `/adithya-s-k/manim_skill` | 第三方 manim 技能库 | ❌ 禁用 |
| `/websites/deepwiki_manimcommunity_manim` | DeepWiki 镜像 | ❌ 禁用 |

> ⚠️ **坑**：`/3b1b/manim` 和 `/manimcommunity/manim` **是两个不同的项目**。
> 本技能锁定 **Manim Community Edition**，别选错。
>
> ⚠️ 候选结果里**没有 Versions 字段**——Context7 对本库无版本索引（见 0.3）。

### 第 2 步：查文档

```
ToolSearch(tool_names=["mcp__context7__query-docs"])
DeferExecuteTool(toolName="mcp__context7__query-docs",
  params={"libraryId": "/manimcommunity/manim",
          "query": "ThreeDScene camera orientation phi theta zoom and fixed_in_frame_mobjects API"})
```

**查询要点**：
- `libraryId` **只能是** `/manimcommunity/manim`（不要加版本后缀，会报错）
- 一次只问**一个概念**，别把多个不相关问题塞进同一个 query
- 带上具体类名/方法名，能显著提高命中率
- 优先查 `docs/source/examples.rst` 里的官方示例，示例比签名更能说明正确用法
- **查完的关键 API 用本机再确认一次**（第三节）

---

## 四、30 秒自查法（比翻文档快）

**不确定某个名字是否存在时，直接跑一行 Python**，比查任何文档都快且准。

```powershell
# 1. 某个常量/类是否存在
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "import manim; print([n for n in dir(manim) if 'CYAN' in n])"

# 2. 某个类有没有某个属性
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "from manim import Scene; print(hasattr(Scene,'time'))"

# 3. 某个函数的准确签名
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "import inspect; from manim import interpolate_color; print(inspect.signature(interpolate_color))"

# 4. 某个方法属于哪个类（定位源码文件）
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "from manim import ThreeDScene; print(ThreeDScene.move_camera.__module__)"

# 5. 一次性校验版本 + 全部锚点（推荐）
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" "<本技能目录>/scripts/check_manim_version.py"
```

### 读本机源码定位具体实现

```
Grep(pattern="def set_camera_orientation", path="D:\software\uv\envs\geo\Lib\site-packages\manim")
Read(file_path="D:\software\uv\envs\geo\Lib\site-packages\manim\scene\three_d_scene.py")
```

常用源码位置：

| 想查什么 | 去哪看 |
|---|---|
| 3D 相机、运镜 | `manim\scene\three_d_scene.py` |
| 3D 相机投影数学 | `manim\camera\three_d_camera.py` |
| 2D 相机基类 | `manim\camera\camera.py` |
| 颜色工具 | `manim\utils\color\core.py` |
| Text/MathTex | `manim\mobject\text\text_mobject.py`、`tex_mobject.py` |
| ValueTracker | `manim\mobject\value_tracker.py` |
| 命名空间导出清单 | `manim\__init__.py` |
| 版本与来源（METADATA） | `site-packages\manim-0.21.0.dist-info\METADATA` |

---

## 五、本次实战校验记录（0.21.0 实测，非文档摘抄）

以下每条都跑过验证，且由 `scripts/check_manim_version.py` 持续守护。
**别再重复踩。**

### 5.1 `from manim import *` 到底导出了什么颜色常量

**实测结论**：`manim` 命名空间共有 **158个大写常量**，其中：

| 存在 | 不存在 |
|---|---|
| `BLUE` `RED` `GREEN` `YELLOW` `ORANGE` `PURPLE` `TEAL` `PINK` `GOLD` `WHITE` `BLACK` `GREY` `GRAY` `MAROON` | **`CYAN`** **`MAGENTA`** |

同时存在 `PURE_CYAN`（`#00FFFF`）、`PURE_MAGENTA`（`#FF00FF`）、
以及全套 `_A`~`_E` 变体（`BLUE_A`…`TEAL_E`）。

> **本次踩坑**：写标定场景时凭印象用了 `CYAN`，渲染直接
> `NameError: name 'CYAN' is not defined`。
>
> **教训**：想要精确的霓虹色（如 `#22D3EE`）**一律自己定义十六进制常量**，
> 不要赌 Manim 有没有这个名字。

### 5.2 `Scene` 的时间属性

| 论断 | 实测结果 |
|---|---|
| `Scene.time_since_start` | ❌ **不存在**，用了必报 `AttributeError` |
| `Scene.time` | ✅ **存在**，`float`，随 `play`/`wait` 推进 |

实测输出：`self.time` 初值 `0.0`，`self.wait(0.3)` 后为 `0.3`。

写法 A（推荐）：`ValueTracker`，时间轴完全可控、可从 0 重新开始

```python
head_u = ValueTracker(0.0)
self.play(head_u.animate.set_value(1.0), run_time=3.0)
```

写法 B：读 `self.time`，适合连续循环运动

```python
def follow(m, dt):
    m.move_to(curve[int((self.time * 0.35 % 1.0) * (N - 1))])
```

⚠️ `self.time` 是**场景累计时间、不会重置**。多幕复用同一逻辑时注意相位；
需要「从 0 开始的进度」时用写法 A。

> **本次踩坑**：我曾断言「`Scene` 没有时间属性，只能用 ValueTracker」，
> 被本次校验推翻——`self.time` 是有的，只是不叫 `time_since_start`。
> **教训：写「某 API 不存在」这种断言前，必须先 `hasattr` 验一遍。**

### 5.3 3D 相关 API（与 Context7 官方示例核对一致）

以下均与 Context7 `/manimcommunity/manim` 的 `docs/source/examples.rst` 官方示例一致：

```python
ThreeDScene.set_camera_orientation(phi=75*DEGREES, theta=30*DEGREES)
ThreeDScene.move_camera(phi=..., theta=..., zoom=..., frame_center=...)
ThreeDScene.add_fixed_in_frame_mobjects(text3d)   # 官方示例 FixedInFrameMobjectTest
ThreeDScene.remove_fixed_in_frame_mobjects(text3d)
ThreeDScene.begin_ambient_camera_rotation(rate=0.1)
ThreeDScene.stop_ambient_camera_rotation()
```

**相机投影的真实数学**（`manim\camera\three_d_camera.py`，反算 zoom 时要用）：

```python
points = points - frame_center                   # 先平移到 frame_center
points = points @ rotation_matrix.T              # 按 phi/theta 旋转
factor = focal_distance / (focal_distance - z)   # 透视除法
points[:, 0] *= factor * zoom
points[:, 1] *= factor * zoom
```

所以 `focal_distance` 越大越接近正交投影（本次用 30.0）。
**这就是为什么「把物体摆到原点 + 设 zoom」不能保证画面居中**——
必须用 `cam.project_points()` 反算，见 `scene-template.md` 的 3D-2。

### 5.4 颜色工具

| 项 | 结论 |
|---|---|
| `interpolate_color(color1, color2, alpha)` | 返回 `ManimColor`；第三个参数是 `alpha`（**不是** `f`） |
| `ManimColor("#22D3EE")` | 构造接受十六进制字符串，直接返回 `ManimColor` |
| 与 `set_stroke()` 配合 | `interpolate_color` 的返回值可直接喂给 `set_stroke()` |

### 5.5 性能实测（与文档数字一致，复测通过）

| 操作 | 单次耗时 | 备注 |
|---|---|---|
| `VMobject().set_points_smoothly(300 点)` | ≈ 4.7 ms | 优美好看，但贵 |
| `VMobject().set_points_smoothly(600 点)` | ≈ 9.3 ms | 点数翻倍，耗时翻倍 |
| `VMobject().set_points_as_corners(450 点)` | ≈ **0.08 ms** | 便宜两个数量级 |
| `Sphere(resolution=(6,6))` | ≈ 6.1 ms | 3D 小球别每帧新建 |

> **实践建议**：需要 updater 的对象**数量控制在 2～3 个**。
> 若要每帧更新大量点，优先用 `set_points_as_corners`（便宜 100 倍），
> 或把点云预处理好只更新少量顶点。

---

## 六、版本漂移处理流程

发现 Context7 与本机源码冲突，或升级后守门脚本报警时：

```
1. 跑 check_manim_version.py，确认是版本问题还是锚点问题
        ↓
2. 本机跑 hasattr / dir 确认实际存在什么
        ↓
3. grep 本机源码看真实签名与实现
        ↓
4. 查官方仓库 CHANGELOG / PR，确认是不是版本变更
        ↓
5. 按本机版本写代码，并在注释里标注：
   # 本机 0.21.0 有效；主干已改名为 XXX，升级后需同步
        ↓
6. 更新本文档第五节 + scene-template.md，并同步ANCHORS 期望值
```

**不要做的事**：
- ❌ 看到 `NameError` 就换名字试（可能掩盖真正的版本问题）
- ❌ 直接抄 Context7 代码片段就跑（不验证等于没查）
- ❌ 在文档里写「X API 不存在」而不做 `hasattr` 验证（本次就犯过这个错）
- ❌ 升级 Manim 后不跑守门脚本（会让整份文档静默失效）

---

## 七、什么时候**必须**查、什么时候可以直接写

| 场景 | 动作 |
|---|---|
| 用本文件第五节已列出的 API | 直接写，不用查 |
| 写过的 2D 模板里的 API（`Axes`/`NumberPlane`/`ValueTracker`/`always_redraw`） | 直接写 |
| 报 `NameError` / `AttributeError` | **必查**，用 30 秒自查法 |
| 用不熟的类（`Surface`/`ParametricFunction`/`ThreeDAxes`） | 先查 Context7 拿示例，再本机确认 |
| 传参数拿不准 | 查 `inspect.signature` |
| 要找「有没有现成方法做 X」 | 先查 Context7，有就用，别手写 |
| 性能相关（`resolution=` / 点数） | 查本机源码默认值 + 自己 benchmark |
| 每次开工前 | 跑一次 `check_manim_version.py` |

---

## 八、相关文件

- `SKILL.md` 的「版本规则」与「遇到 Manim API 问题时」—— 速查版
- `scripts/check_manim_version.py` —— 版本守门，升级后必跑
- `references/scene-template.md` —— 二维模板 + **真 3D 场景模板**（含 `fit_zoom` 反算实现）
- 官方仓库：<https://github.com/ManimCommunity/manim>
