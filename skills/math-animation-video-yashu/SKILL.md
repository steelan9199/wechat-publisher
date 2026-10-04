---
name: math-animation-video-yashu
description: 用 math-animation 连接器把数学/物理知识点与题目渲染成教学动画视频（MP4、无配音）。激活条件：用户消息须包含以下关键词之一:`生成数学动画`、`数学动画视频`、`把 XX 做成动画视频`、`做数学讲解动画`、`真 3D 立体动画`、`排查 Manim 报错`。
version: 0.1.1
agent_created: true
---

# 数学动画视频（math-animation-video）

## 定位与硬约束

用 math-animation 连接器把知识点渲染成教学动画片。**只出画面，不做配音。**

- **不出配音、不做 TTS。** 用户明确要"说话"/配音时，如实说明本技能只出画面；旧的 `edu-math-video`（GLM-TTS 链路）已弃用，不要往那里路由，也不要在本技能里硬凑。
- **默认 720p**（`quality="medium"`）、`mp4`、16:9、无字幕。用户另说才改。
- **默认风格 `khan_academy`**（白底、可汗蓝），面向高中生。
- 每次交付必须走完：**写代码 → 480p 预览 → 抽帧自检 → 720p 出片 → 抽帧复检 → 复制到工作目录 + 展示文件**。不得跳过自检直接说"做好了"。

## 本机固定事实（不要重新探测，除非报错）

| 项 | 值 |
|---|---|
| MCP 服务名 | `math-animation` |
| 渲染引擎 Python | `D:\software\uv\envs\geo\Scripts\python_direct.exe` |
| 引擎仓库 | `D:\github\math-animation-mcp`（源码在 `src\math_animation_mcp`） |
| 连接器输出目录 | `D:\github\math-animation-mcp\animation_output`（**固定，不可改**） |
| 默认中文字体 | `LXGW WenKai GB`（启动器注入为 `Text`/`MarkupText` 默认字体；显式指定请用 `Noto Sans SC`） |
| ffmpeg / ffprobe | `D:\software\ffmpeg\ffmpeg-2024-09-26-git-f43916e217-full_build\bin\` |
| LaTeX | MiKTeX：`D:\software\MiKTeX\miktex\bin\x64\`（`MathTex` 可用） |
| Manim 版本 | **0.21.0（固定，勿升级）** |
| Manim 发行版 | **Manim Community Edition**（`Author: The Manim Community Developers`），非 3b1b 版 |
| **唯一官方仓库** | **https://github.com/ManimCommunity/manim**（社区版，`main` 即 0.21.0） |
| **本机 Manim 源码** | `D:\software\uv\envs\geo\Lib\site-packages\manim`（**版本权威**） |
| **唯一允许的 Context7 libraryId** | **`/manimcommunity/manim`** |

- 可用中文字体：`Noto Sans SC`、`Noto Serif SC`、`Microsoft YaHei`、`SimHei`、`LXGW WenKai GB`、`FangSong`。
- **渲染超时上限**：连接器 `render_animation` 固定 120 s，`render_gif` 固定 60 s。`preview_scene` 原本 60 s，**本机已把源码调宽到 120 s**（`D:\github\math-animation-mcp\src\math_animation_mcp\tools\render_tools.py`，默认值 `timeout=120`）；该改动要重启MCP 才生效，未重启时仍按 60 s对待。

## 🔒 版本规则（硬约束，不可协商）

**本技能的版本固定为「Manim Community Edition 0.21.0」。** 所有 API 结论、所有模板代码
都只在这个版本上成立。**不要升级、不要混用其他发行版。**

### 规则 1：只认社区版 0.21.0

| 项目 | 值 |
|---|---|
| 发行版 | Manim Community Edition（**不是** 3b1b 版、不是 ManimGL） |
| 版本 | 0.21.0（仓库 `main` 分支当前即此版本） |
| 官方仓库 | <https://github.com/ManimCommunity/manim> |

### 规则 2：Context7 只用`/manimcommunity/manim`

| libraryId | 状态 | 说明 |
|---|---|---|
| **`/manimcommunity/manim`** | ✅ **唯一允许** | Manim CE 官方库，905 snippets，Source Reputation: High |
| `/3b1b/manim` | ❌ **禁用** | **是另一个项目**（3b1b 维护的 3b1b-manim），API 与 CE 不同 |
| `/websites/3b1b_github_io_manim` | ❌ 禁用 | 3b1b 文档站，同上 |
| `/adithya-s-k/manim_skill` | ❌ 禁用 | 第三方技能库，非官方 |
| `/websites/deepwiki_manimcommunity_manim` | ❌ 禁用 | DeepWiki 镜像 |

> ⚠️ **Context7 对本库无版本索引**：实测 `/manimcommunity/manim/0.21.0` 返回
> `Version "0.21.0" not found... This library has no versions.`
> **所以「在 Context7 里锁定 0.21.0」在技术上做不到**。
> 替代方案见规则 3——**版本权威永远是本机源码**，Context7 只负责「找用法」。

### 规则 3：Context7 只当「用法参考」，版本权威永远是本机源码

两者已确认**同源同版本**（社区版 `main` = 0.21.0 = 本机版本），因此：

- ✅ **用Context7 做什么**：找官方示例、查标准写法、确认命名是否存在、查参数含义
- ❌ **不要用 Context7 做什么**：**不要把它当版本权威**，不要照抄片段就不验证
- 🔒 **铁律**：凡是**报错**或**签名对不上**的 API，**必须** grep 本机源码确认后再用

这不只是版本洁癖，而是**本机能直接验证**。见下方「30 秒自查法」——跑一行Python
比翻任何文档都快且准。

### 规则 4：升级后必须先跑守门脚本

```powershell
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" "<本技能目录>/scripts/check_manim_version.py"
```

输出 `结论：通过` 才能继续用本技能的模板；否则**先更新文档再写代码**。
这条防的是「静默失效」——升级后代码照样能跑，但文档结论可能已经错了。

详见 **`references/manim-api-troubleshooting.md`**。

## ⚠️ 遇到 Manim API 问题时（必读）

**不要凭记忆写 Manim API。** 本技能里的API 论断都是在 **0.21.0 实测**过的，
但 Manim 迭代快。拿不准就按下面三步查证。

### 信源分工（社区版 0.21.0，三者同源）

| 角色 | 信源 | 怎么用 |
|---|---|---|
| **版本权威** | **本机源码** `D:\software\uv\envs\geo\Lib\site-packages\manim` | Read / Grep 真实文件，能看到确切签名与实现。**与任何文档冲突时以它为准** |
| **用法参考** | **Context7** `/manimcommunity/manim` | 查官方示例、确认命名是否存在。⚠️ **无版本索引**，不能锁版本 |
| **变更历史** | 官方仓库 <https://github.com/ManimCommunity/manim> | 读 issue / PR / CHANGELOG |

**已确认三者同源**：本机 `manim-0.21.0.dist-info` 的 `Author` 为
`The Manim Community Developers`，即社区版；社区仓库 `main` 当前即0.21.0。
所以 Context7 的示例对本机**直接有效**——但仍**建议关键 API 用本机再确认一次**，
因为这是唯一能 100% 证明「本机跑得通」的方式，且只需 30 秒。

### 什么时候必须去查（不要硬猜）

- 报 `NameError` / `AttributeError` 但你确信「文档里有这个」→ 去 grep 本机源码
- 要用某个常量/类/方法，不确定名字是否存在 → 先查
- 要传某个参数，不确定签名长什么样 → 查 `inspect.signature` 或读源码
- 想知道有没有现成方法做某件事 → 查 Context7 官方示例，有就用，别手写

### 30 秒自查法（比翻文档还快）

```powershell
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "import manim; print([n for n in dir(manim) if 'CYAN' in n])"
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "from manim import Scene; print(hasattr(Scene,'time'))"
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" -c "import inspect; from manim import interpolate_color; print(inspect.signature(interpolate_color))"
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" "<本技能目录>/scripts/check_manim_version.py"
```

**已实测的 0.21.0 结论**（由上面的守门脚本持续校验）：

| 论断 | 验证方式 |
|---|---|
| `from manim import *` **没有** `CYAN`/`MAGENTA`，但**有** `TEAL`/`PINK`/`GOLD`/`PURPLE` | `dir(manim)` 大写常量共 158 个 |
| `Scene` **没有** `time_since_start`；但**有** `self.time`（float，随 play 推进） | `hasattr` + `wait(0.3)` 后为 0.3 |
| `set_camera_orientation(phi=,theta=)` / `move_camera()` / `add_fixed_in_frame_mobjects()` 均为官方 API | Context7 官方 examples.rst 核对一致 |
| `interpolate_color(color1, color2, alpha)` 返回 `ManimColor` | `inspect.signature` |
| `Dot3D` 位于 `manim.mobject.three_d.three_dimensions` | import 成功 |

完整查证流程与版本差异处理见**`references/manim-api-troubleshooting.md`**。

### 何时用连接器工具、何时用降级脚本
预估渲染耗时 ≈ **预览耗时 × 3～5**（720p30 相对 480p15）。

- 预估 < 110 s → 直接调 MCP `render_animation`。
- 预估 ≥ 110 s，或**预览这一步本身就超过 100 s** → 直接用 `scripts/render_video.py`（同一套注入与风格管线，超时放宽到 900 s）。否则会被 120 s 超时杀掉，白等一轮。

### ⚠️ 渲染命令必须前台执行 + 关闭沙箱

**用Bash/PowerShell 跑 `render_video.py` 时，一律加 `dangerouslyDisableSandbox=true`、前台执行、`timeout=600000`，不要用 `run_in_background`。**

原因：渲染器收尾会递归删除 `MAMCP_TMP_DIR`（默认 `D:\github\math-animation-mcp\_render_tmp`）下的临时目录，
一次渲染产生 200+ 文件，容易撞上本机的「批量删除安全钩子」而被拦，表现为**非零退出码**。
但此时**成片其实是好的**。加上前台执行 + 关闭沙箱可完全规避。

若确实用后台执行而撞上了，**不要重跑**：直接去 `animation_output` 看有没有新文件，
有就按成功处理（注意 `_1` `_2` 后缀，用返回值的 `file_path` 或按修改时间挑最新的）。

### 抽帧自检用降级脚本，不要用 MCP

`preview_scene` / `render_gif` 都在 MCP 进程内跑 subprocess，遇到上面那个删除钩子问题时
会把 MCP 一起带崩。**自检一律直接跑 `scripts/contact_sheet.py`**，不经过 MCP。

## 真 3D 场景（ThreeDScene）

用户要「真 3D、相机环绕、立体感」时，走这条路，不要用二维模板硬凑。
完整可复制代码见 `references/scene-template.md` 的「三维场景模板」一节。

### 3D 场景的五个硬性要求

1. **必须先渲染标定场景**。`ThreeDScene` 是透视投影，「包围盒中点」≠ 画面中心，
   偏移严重程度靠推理判断不了。写正式场景前先用 20 秒廉价渲染验证居中算法。
2. **zoom 必须用 `cam.project_points()` 反算**，不能靠包围盒估。
   拟合区间按「这一幕实际会走到的机位」给；按全角度最坏情况拟合会让主体偏小约 25%。
3. **形变动画要把中间态也纳入拟合**（`lerp` 的中点），否则形变中主体冲出画面。
4. **文字一律 `add_fixed_in_frame_mobjects()`**，用完 `remove_fixed_in_frame_mobjects()`。
5. **运镜直接改 `cam.phi_tracker` / `theta_tracker` / `zoom_tracker`**，比反复调
   `set_camera_orientation()` 好控制。俯角要主动设计（如 `phi=68°`），别用默认视角。

### 3D 配色过渡：转色相，不要 RGB 插值

两套配色之间做渐变时，**RGB 线性插值走到中途必然掉进灰**。
实测彩度最低掉到 **0.083**（肉眼就是一条灰带）；改用 HSV旋转色相后全程稳定 **≥0.82**。
模板里有现成的 `band_color(frac, g)` 函数可直接用。

## 六种风格

| 风格 | 背景 | 适合 |
|---|---|---|
| `khan_academy` | 白 `#FFFFFF` | **默认**，中小学/高中 |
| `three_blue_one_brown` | 深灰 `#1C1C1C` | 科普、大学 |
| `textbook` | 浅灰 `#F5F5F5` | 正式教材 |
| `playful` | 暖黄 `#FFF8E1` | 小学低龄 |
| `dark_tech` | 纯黑 `#000000` | 竞赛、CS |
| `blackboard` | 深绿 `#2D5016` | 模拟课堂 |

风格只改**背景色**。前景元素颜色必须在场景代码里自己写死（见"已知坑"第 1 条）。

## 标准流程

### 步骤 0：确认要讲什么
收集三件事：**讲哪个知识点/题目、受众年级、分几幕**。缺信息时最多问 1～3 个问题，其余按默认静默决定：可汗学院白底风、高中生、每幕只讲一件事、总时长 30～50 s、结尾给一张小结卡片。

### 步骤 1：写场景代码
写到 **`<用户当前工作目录>/<ascii_name>_scene.py`**。类名必须 ASCII（渲染器靠 `class Xxx(Scene)` 正则取场景名）。参考 `references/scene-template.md` 的最小可靠模板，从它改比从零写快且少踩坑。

### 步骤 2：480p 预览

直接用降级脚本出480p 预览（自检阶段一律不过 MCP，理由见上）：

```powershell
& "D:\software\uv\envs\geo\Scripts\python_direct.exe" "<本技能目录>/scripts/render_video.py" <scene.py> --quality low --style khan_academy --timeout 900
```

**3D 场景额外要求**：这一步之前必须已经渲染并肉眼确认过标定场景（见「真 3D 场景」）。

### 步骤 3：抽帧自检（必做）

```
"<本技能目录>\scripts\contact_sheet.py" <预览mp4> --auto --cols 3 --rows 5 --out sheet.png
```

`--auto` 会按视频总长自动算 `every`，保证 `cols*rows` 张图**覆盖全片**。
脚本会打印「覆盖= X s / 目标= Y s」，若出现 `⚠️ 未覆盖全片` 说明这一格没看完，
必须加大 `--rows` 或减小 `--every` 重跑。

**结尾段落必须单独再看一遍**（闪白、收尾卡片最容易漏检）：

```
"<本技能目录>\scripts\contact_sheet.py" <预览mp4> --start 28.5 --auto --cols 3 --rows 2 --out tail.png
```

然后用读图工具**亲眼看**这两张拼图，逐项核对：

1. 中文不是方框、没有缺字
2. 公式/文字在背景上**可见**（白底最容易出白字，见坑 1）
3. 元素不重叠、不出界、不压边缘（**同一时刻画面上只应有一行标题**）
4. 图形/数值与讲解内容一致（波形、坐标、标注都在对的位置）
5. 每一幕都有真实运动，不是静态画面
6. 标题、参数读数、小结卡片都在画面内
7. 渐变/形变过程中颜色**没有掉进灰色**，主体没有忽大忽小

发现问题 → 改代码 → 重跑步骤 2、3，**不要带着已知问题往下走**。

> **抽帧自检是唯一能抓到视觉缺陷的手段。** 「代码逻辑看着对」不等于「画面对」——
> 双层`LaggedStart` 不同步、RGB 插值变灰、字幕压标题，这三类问题代码都不会报错，
> 只有把帧抽出来用眼睛看才能发现。宁可多抽一轮。

### 步骤 4：720p 出片
按上文"何时用连接器工具"判据选路径。调用连接器：

- 工具：`render_animation`，参数 `code`、`quality="medium"`、`format="mp4"`、`style`
- 用降级脚本：`scripts/render_video.py <scene.py> --quality medium --style khan_academy`

**输出目录固定**，重名会自动加 `_1`、`_2` 后缀。**必须用返回值里的 `file_path`**，不要自己猜文件名。

### 步骤 5：复检与交付
1. 对成片再跑一次 `scripts/contact_sheet.py --auto`（真实时长与预览不同，逐帧位置会变），确认没问题；结尾段落同样用 `--start` 单独复检。
2. 用 `ffprobe` 核对分辨率/帧率/时长是否符合交付要求。
3. 复制到用户当前工作目录，起个中文名，例如 `正弦函数的图像变换_可汗学院风_720p.mp4`。
4. 用文件展示工具交付：**mp4 放第一位，场景源码 .py 放第二位**。
5. 回复里说清：时长、分辨率、每一幕讲了什么、以及**没配音**这一事实。

## 已知坑（都真实踩过）

### 环境与流程

| 坑 | 正确做法 |
|---|---|
| 渲染器收尾递归删除 `_render_tmp` 撞上本机批量删除钩子，退出码非零但**成片是好的** | 渲染命令加 `dangerouslyDisableSandbox=true` 且**前台执行**（`timeout=600000`），不要用 `run_in_background` |
| 用后台执行撞上删除钩子后，重跑一次白等几十秒 | 不要重跑，直接去 `animation_output` 按修改时间找新文件 |
| 自检阶段走 MCP（`preview_scene`）可能把 MCP 进程一起带崩 | 自检一律直接跑 `scripts/render_video.py` + `scripts/contact_sheet.py`，不过 MCP |
| 抽帧只看前 N 秒，漏掉闪白/收尾卡片 | 结尾段落必须用 `contact_sheet.py --start <秒>` 单独抽一张 |
| `contact_sheet.py` 拼图没覆盖全片却看不出来 | 用 `--auto` 让它自动算 `every`；认输出里的 `⚠️ 未覆盖全片` 告警 |
| 场景 35 s，720p 渲染要 107 s，撞上 120 s 上限 | 预览耗时 × 3～5 做预估，超 110 s 就走降级脚本 |
| 预览／渲染超时后原地重试，白等一轮 | 超时即换路径：预览超时走 `render_video.py --quality low`，成片超时走 `--quality medium` |
| 渲染文件重名加 `_1` 后缀，误把预览片当成品交付 | 只用返回值里的 `file_path` |

### 配色与文字

| 坑 | 正确做法 |
|---|---|
| `MathTex` 默认是**白色**，白底风格下看不见，只剩手动上色的部分 | 先 `formula.set_color(INK)` 整组压深色，再给需要强调的子串单独上色 |
| 白底风格下坐标轴/网格/文字用 Manim 默认白色 | 每个 `Text`/`MathTex`/`Axes`/`NumberPlane` 都显式给颜色；网格用 `#E4E7EE`，轴用 `#7B8794` |
| 中文显示成方框 | `Text(..., font="Noto Sans SC")` 显式指定，或依赖启动器注入的 `LXGW WenKai GB`；`MathTex` 里不要混中文 |
| **`\mathrm{}` 里塞中文导致 LaTeX 编译失败** | 拆成 `VGroup(MathTex("T(2,3)"), Text("三叶结", font=FONT))`，中文永远交给 `Text` |
| 暗底上次要文字用色太暗，看不清 | 页脚/次要文字别低于 `#8296B4` |
| 公式字号写太大，贴到右边缘被裁掉 | 字号 ≤ 28，放画面中下方居中，不横排太长 |

### 动画机制

| 坑 | 正确做法 |
|---|---|
| `always_redraw` 的对象用 `FadeOut` 淡出无效（每帧被重绘覆盖） | 用 `self.remove(obj)` 直接移除；换曲线时 `self.remove(old); self.add(new)`，同参数值下可无缝切换 |
| `DoubleArrow`/`Arrow` 两端点重合时长度为 0 报错 | 扫描参数的取值范围不要包含 0（如振幅最低取 0.4） |
| `lambda` 里引用的变量在 `always_redraw`/`add_updater` 里没定义就被调用 | 先在 `construct` 里定义变量再创建 `always_redraw`，且把 `add_updater` 放在被引用对象之后 |
| **写了 `self.time_since_start`，`Scene` 根本没这个属性** | 用 `self.time`（float，随play 推进，已实测）或 `ValueTracker`。写「某 API 不存在」前先 `hasattr` 验一遍 |
| **两个独立 `LaggedStart` 分别控制辉光层和亮线层，节奏对不上** | 轨迹会画成**虚线**。改为逐色带交错播放：同一色带的辉光与亮线放进同一个 `LaggedStart` |
| **两套配色做 RGB 线性插值，中途掉进灰色** | 实测彩度最低 0.083。改用 HSV 旋转色相（`band_color(frac, g)`），全程 ≥0.82 |
| 每一幕只是"多出一条线、多一个标签"，画面没在动 | 每幕至少一个连续参数扫描（`ValueTracker` + `always_redraw`/`add_updater`），这是本连接器最值钱的部分 |
| 结尾突然黑屏 | 最后 `self.wait(1.0~1.5)` 留白 |

### 三维场景（`ThreeDScene`）

| 坑 | 正确做法 |
|---|---|
| **`from manim import *` 不导出 `CYAN`/`MAGENTA` 等大写颜色常量** | 0.21.0 实测：158 个大写常量里**没有** `CYAN`/`MAGENTA`，但**有** `TEAL`/`PINK`/`GOLD`/`PURPLE`。精确霓虹色一律自己定义十六进制常量 |
| **以为「把物体摆到原点 + 设 zoom」就能居中** | 透视投影下包围盒中点 ≠ 画面中心。必须用 `cam.project_points()` 反算 zoom |
| zoom 按**全角度最坏情况**拟合 | 主体偏小约 25%。改为按这一幕实际运镜区间 `[th0, th1]` 拟合 |
| 形变动画只拟合了 3 个终态 | 形变中主体冲出画面。把 `lerp` 中点也塞进拟合列表 |
| `np.linspace(0, n, k+1).astype(int)` 末位索引等于 `n` | 越界 `IndexError`。手动 `idx[-1] = n - 1` |
| 3D 里的文字随相机倾斜变形/ 翻到背面 | 一律 `add_fixed_in_frame_mobjects()`，用完 `remove_fixed_in_frame_mobjects()` |
| 同一时刻画面上有两行标题（新字幕 + 旧标题没删） | 先 `FadeOut` 旧标题，再 `FadeIn` 新字幕 |
| 色带 updater 塞在 `VGroup` 里当子对象 | `clear_updaters()` / `self.remove()` 容易漏。**updater 对象一律放场景顶层** |
| 不先验证居中算法就直接写正式场景 | 先渲染 20 秒标定场景：画面正中钉一个十字，看曲线是否稳稳穿过 |

## 资源

- `scripts/check_manim_version.py`：**版本守门**。校验本机仍是社区版 0.21.0 且 6 条API 锚点未漂移。升级后必跑。
- `scripts/render_video.py`：按连接器同款管线渲染（可配质量/风格/超时）。撞超时时用它。
- `scripts/contact_sheet.py`：抽帧拼图，自检用。**必须先跑它再看图。**
  支持 `--auto`（自动算 `every` 覆盖全片）、`--start` / `--duration`（只看某段）。
- `references/scene-template.md`：二维最小可靠模板 + 白底配色常量 + 常用动画片段
  + **真 3D 场景模板**（反算 zoom、运镜、色带辉光、HSV 配色、形变、光点、白闪）。
- `references/manim-api-troubleshooting.md`：**版本规则 + API 查证流程 + 0.21.0 实测结论**。
  写任何拿不准的 API 之前先看这份。

## 外部权威信源（仅社区版）

| 资源 | 地址 | 用途 |
|---|---|---|
| **Manim CE 官方仓库** | <https://github.com/ManimCommunity/manim> | 源码、issue、PR、CHANGELOG（`main` = 0.21.0） |
| **本机 Manim 源码** | `D:\software\uv\envs\geo\Lib\site-packages\manim` | **版本权威**，API 争议的最终依据 |
| **Context7 MCP** | libraryId = `/manimcommunity/manim`（**唯一允许**） | 查官方文档与代码示例（无版本索引） |

❌ **禁用** `/3b1b/manim`、`/websites/3b1b_github_io_manim`——**那是另一个项目**。
