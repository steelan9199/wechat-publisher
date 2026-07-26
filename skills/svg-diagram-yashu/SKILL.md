---
name: svg-diagram-yashu
description: 生成扁平的 SVG 图（架构图、中心辐射图、流程图、简易时序图、思维导图、组织架构图、2×2
  对比矩阵、时间线、循环图、鱼骨图），也支持把已有 SVG 文件转成 PNG 图片。激活条件（满足任一即可）：生成类关键词
  `画架构图`、`画中心辐射图`、`画流程图`、`画时序图`、`画思维导图`、`画脑图`、`画组织架构图`、`画树形图`、`画对比矩阵`、`画四象限`、`画时间线`、`画循环图`、`画鱼骨图`、`画因果分析图`；转换类关键词
  `SVG 转图片`、`把 SVG 转成图片`、`把 SVG 转成 PNG`。
disable: false
---

# SVG 图生成器（也能把已有 SVG 转成图片）

本技能有两种用法：

1. **生成模式：生成 SVG 图** —— 按你的描述画出扁平、随主题切换的架构图、中心辐射图 / 流程图 / 时序图 / 思维导图 / 组织架构图 / 对比矩阵 / 时间线 / 循环图 / 鱼骨图，并保存为 `.svg` + 一张白底 `.html` 预览图 + 一张 2× 的 `.png`（用于插入公众号等文章）。
2. **转换模式：把已有 SVG 转成图片** —— 你手里有一份 `.svg` 文件（本技能生成的，还是别处来的都行），技能调用自带转换器把它栅格化成 2× 白底 `.png`，同样方便插入公众号等场景。

绘图规范完全内置在本技能内（见 `references/design-system.md`）。

## 使用场景

- 用户想*看*某个结构、流程或对比，而不是读大段文字。
- 用户手里有一份现成的 `.svg`（本技能生成过，还是别处来的都行），想快速转成可插入公众号的 PNG 图片。
- 不要拿它去*创作*位图、照片或基于组件的 UI 线框图——那属于别的技能；但把 SVG（含你已有的）导出成 PNG 是本职能力。

## 前置 · 环境检查

本技能的最终产物是能插入公众号的 PNG，导出依赖两项本机工具。每次执行前先确认，任一项不满足就提示用户安装并结束任务，不再继续：

- **Node.js 18+**：运行 `node --version`。若命令不存在（或版本低于 18），提示用户「未检测到 Node.js 或版本过低，请安装 Node.js 18+（https://nodejs.org）后重试」，然后结束任务。
- **Microsoft Edge**：运行 `node SKILL_DIR/scripts/check-edge.mjs`（把 `SKILL_DIR` 替换为技能安装路径）。退出码 0 表示已安装，退出码 1 表示未找到，提示用户「未检测到 Microsoft Edge，请安装 Edge（https://www.microsoft.com/edge）后重试」，然后结束任务。

两项都满足，才进入下面的工作流。

## 工作流 A · 生成 SVG 图（生成模式）

1. **读取内置设计规范 + 底层知识。** 用 Read 工具打开 `references/design-system.md`（全部硬约束：调色板、字体、viewBox 规则、箭头标记）**以及 `references/svg-drawing-knowledge.md`**（SVG 渲染机制、坐标几何计算、配色判断）。

2. **按用户意图选择图的类型**。选定后，**除通用规范外，还需遵守该图专属的视觉规则**（`references/rules-{type}.md`）——各图型独有的形状语义、坐标模板、连线样式、常见反例都在其中：
   - **架构图**——展示系统各组件及其关系的图。常见两类布局：① 自上而下**分层架构**（如接入层 / 服务层 / 数据层 / 基础设施），每层由若干节点组成、左侧放层级标签，层间用箭头表达依赖或数据流，可加底部反馈闭环；② **横向流水线**，沿一条调用链串联多个组件（如 AI 客户端 → 中继服务器 → 手机）。坐标模板见 `svg-drawing-knowledge.md` §2.6。**专属规则 `references/rules-architecture.md`**，示例 `references/example-architecture.svg`。
   - **中心辐射图**——一个中心节点向外辐射连接多个外围节点（例如一台服务器向多个客户端转发，或星型网络拓扑）。外围节点围绕中心分布，连线从中心向四周发散。**专属规则 `references/rules-radial.md`**（本技能暂无专用示例文件，按规则绘制即可）。
   - **流程图**——表达过程、算法或工作流：用形状区分语义（矩形=处理/步骤，菱形=判断/分支，椭圆=起止，平行四边形=输入/输出），箭头表示流向，支持判断分支、回环与合流。**专属规则 `references/rules-flowchart.md`**，示例 `references/example-flowchart.svg`。
   - **时序图**——顶部是参与者，消息用箭头向下流动。**专属规则 `references/rules-sequence.md`**，示例 `references/example-sequence.svg`。
   - **思维导图**——中心主题置于画布正中，分支向四周放射状展开，分支用曲线 `<path>` 连接；同一分支及其子节点使用同色系、子节点比父级浅；配色见 §3.2（一主分支一色，子节点用该色系更浅级）。**专属规则 `references/rules-mindmap.md`**，示例 `references/example-mindmap.svg`。
   - **组织架构图 / 树形图**——自上而下的层级结构，顶层为根节点，逐层向下展开，同级节点用同一色系，不同分支用不同色系。**专属规则 `references/rules-orgchart.md`**，示例 `references/example-orgchart.svg`。
   - **2×2 对比矩阵 / 四象限图**——横纵两轴划分四个象限，将选项分布在四个区域中，每个区域附简洁评价标签。轴标签位于两端。**专属规则 `references/rules-matrix.md`**，示例 `references/example-matrix.svg`。
   - **时间线**——水平时间轴贯穿左右，里程碑节点用圆点标注，事件卡片交替排布在轴的上方或下方，用虚线连接到对应圆点。**专属规则 `references/rules-timeline.md`**，示例 `references/example-timeline.svg`。
   - **循环图**——4–5 个节点围绕中心呈环形排列，节点间用曲线箭头连接形成闭环。每个节点用不同色系区分阶段。**专属规则 `references/rules-cycle.md`**，示例 `references/example-cycle.svg`。
   - **鱼骨图（因果分析图）**——中央水平主干线指向右侧"问题"鱼头，4–6 条斜肋从主干分叉出去，每条肋上挂 2–3 条虚线子原因。**专属规则 `references/rules-fishbone.md`**，示例 `references/example-fishbone.svg`。

3. **编写 SVG**，遵循 `references/design-system.md` 的硬性约束，套用 `references/svg-drawing-knowledge.md` 的坐标公式（§2）与配色规则（§3），**并遵守第 2 步选定的 `references/rules-{type}.md` 专属视觉规则**：
   - `viewBox="0 0 680 H"`（宽度 100%）；`H` = 最底部元素的位置 + 20。
   - 外层背景透明；只使用纯色填充，不要渐变、阴影、模糊或发光。
   - 仅两种字重：400（常规）和 500（中等）。正文 13px，标题 14px。字体不得小于 11px。
   - 文字颜色跟随客户端主题：浅色主题用深色文字，深色主题用浅色文字。每个图形都要显式设置 `fill`（不要用 CSS 继承）。
   - 每一水平层 ≤4 个框；色系数量 = 需区分的有意义类别数（如架构的分组、思维导图的各主分支、循环图的各阶段），只在类别有真实含义时加色，禁止为装饰加色；完整规则见 svg-drawing-knowledge.md §3.2。
   - 每条连接线 `<path>`/`<polyline>`：`fill="none"`。箭头使用 `design-system.md` 里的标记。
   - 框内每个 `<text>`：`dominant-baseline="central"`。
   - 根 `<svg>` 要加 `role="img"`，并把 `<title>` 和 `<desc>` 作为前两个子元素。
   - 不要有 `<!-- 注释 -->`、不要旋转文字、不要 `position: fixed`。

4. **展示图表。** 把生成的 `.html` / `.png` 文件交给用户打开。

5. **保存三个产物**到工作区，使用同一个有描述性的基础文件名（例如 `phone-screenshot-arch`）：
   - **`.svg`**——原始矢量文件（用 Write 工具写）。
   - **`.html`**——白底预览包装，方便手动用 Edge 截图。**用自带脚本生成，不要手写 HTML**（这是纯模板拼接，手写浪费 token）：
     ```
     node SKILL_DIR/scripts/svg-to-html.mjs --SvgPath SVG_PATH
     ```
     把 `SKILL_DIR` 替换为技能安装路径，SVG_PATH 替换为 .svg 文件路径。省略 `--OutPath` 时与 SVG 同名同目录输出 `.html`；页面标题自动取 SVG 内的 `<title>`。
   - **`.png`**——通过自带的 Node.js 转换器按 2× 栅格化。在 Bash 中运行（环境检查已确认 node 与 Edge 均可用）：
     ```
     node SKILL_DIR/scripts/svg-to-png.mjs --SvgPath SVG_PATH
     ```
     把 SKILL_DIR 替换为技能安装路径，SVG_PATH 替换为 .svg 文件路径。
     退出码为 2 表示找不到 Edge（环境检查遗漏），提示用户安装 Edge；退出码 4 表示截图未生成，提示改用下方「方法 2」手动截图。其余退出码见脚本头部注释。
     报告所有保存路径。

6. **用文字说明。** 把所有描述、背景和后续步骤都写在 SVG *之外*的对话消息里。SVG 只负责视觉。

## 工作流 B · 把已有 SVG 转成图片（转换模式）

当用户发来一份现成的 SVG（本技能生成过，或从别处得到），希望得到一张可插入公众号的 PNG 时使用。前置环境检查同上文「前置 · 环境检查」（Node 18+ 与 Edge 二者缺一不可）。

1. **拿到 SVG。**
   - **方式一 · 本地文件**：用户给出 `.svg` 路径，直接用该路径。
   - **方式二 · 直接粘贴代码**：用户把 SVG 源码贴在对话里。用 Write 工具把它落盘成一个临时 `.svg`（如 `user-svg.svg`），再用这个路径。
   - 若用户既没给路径也没贴代码，提示「请把 .svg 文件拖进来，或把 SVG 代码贴给我」，结束任务。

2. **环境检查**：同上文「前置 · 环境检查」，任一项不满足就提示安装并结束。

3. **调用转换器**（与生成模式共用同一脚本）：

   ```
   node SKILL_DIR/scripts/svg-to-png.mjs --SvgPath SVG_PATH [--OutPath OUT_PNG] [--Scale 2]
   ```

   把 `SKILL_DIR` 换成技能安装路径，`SVG_PATH` 换成上一步得到的 `.svg` 路径。可用 `--OutPath` 指定输出 PNG 位置，省略则与 SVG 同名同目录。
   退出码 2 = 找不到 Edge；4 = 截图未生成（提示改用下方「方法 2」手动截图）。

4. **交回结果**：把生成的 `.png` 路径告诉用户，说明它是 2× 白底 PNG，可直接拖进公众号。若用户贴的是代码，顺带说明已落盘的临时 `.svg` 路径，方便二次修改。

## 把图变成图片（公众号插入用）

公众号编辑器只接受 JPG / PNG，**不**接受 SVG 直接上传。无论是本技能刚生成的图，还是你已有的 SVG，导出 PNG 的方法都一样：技能默认会自动导出 PNG；若自动失败或你想手动控制，用以下方法：

**方法 1 · 自动导出 PNG（推荐）**
技能自带 Node.js 脚本（ES Module），用本机 Edge 浏览器无头截图，2 倍分辨率白底。在 Bash 里运行（需先通过环境检查）：

```
node <skill-dir>/scripts/svg-to-png.mjs --SvgPath <svg 路径>
```

输出与 SVG 同名、同目录的 `.png`，直接拖进公众号即可。若提示找不到 `node`，请先安装 Node.js 18+。

**方法 2 · 手动用 Edge 截图（脚本不可用时的备选）**

1. 双击技能生成的 `.html` 文件（白底预览），或在 Edge 里直接打开 `.svg`。
2. 按 `Ctrl + Shift + S` 调出 Edge「网页捕获」工具。
3. 拖框选中整张图，点「捕获」→ 保存为 PNG。

## 设计系统要点（速查）

- 调色板（9 个色系 × 7 级）：紫、蓝绿、珊瑚、粉、灰、蓝、绿、琥珀、红。浅色模式下用 50 级填充 + 600 级描边 + 800/600 级文字。
- 框宽公式：`rect_width = max(标题字符数 × 7, 副标题字符数 × 6) + 24`。
- 间距：框之间 ≥60px，内边距 24px。
- 从 `references/design-system.md` 复制标准的 `<defs>` 箭头标记。

## 自带资源

- `references/design-system.md`——完整的硬约束、调色板、箭头标记模板、框尺寸公式（"不能做什么"）。
- `references/svg-drawing-knowledge.md`——SVG 渲染机制、坐标几何计算（含 4 层架构坐标模板）、配色判断的权威规则（"怎么画才漂亮"）。
- `references/rules-architecture.md`、`rules-flowchart.md`、`rules-mindmap.md`、`rules-sequence.md`、`rules-orgchart.md`、`rules-matrix.md`、`rules-timeline.md`、`rules-cycle.md`、`rules-fishbone.md`、`rules-radial.md`——**10 种图各自的专属视觉规则**（形状语义、坐标模板、连线样式、常见反例）。绘制某类图时必读对应的 `rules-{type}.md`。
- `references/example-architecture.svg`、`example-flowchart.svg`、`example-sequence.svg`、`example-mindmap.svg`、`example-orgchart.svg`、`example-matrix.svg`、`example-timeline.svg`、`example-cycle.svg`、`example-fishbone.svg`——供风格和结构对齐的少样本示例。
- `scripts/svg-to-png.mjs`——Node.js（ESM）转换器：通过无头 Edge 把**任意** SVG 文件（不限于本技能生成的）转成 2× PNG。自动检测 Program Files 里的 msedge；找不到时以退出码 2 结束并给出手动回退指引。用 `node` 运行（Node 18+）。
- `scripts/svg-to-html.mjs`——Node.js（ESM）辅助脚本：把一份 SVG 内联进白底 HTML 预览页（纯文件拼接，无需浏览器）。生成 `.html` 预览包装时用它替代手写 HTML，省 token。参数 `--SvgPath`，可选 `--OutPath`；页面标题自动取 SVG 内 `<title>`，画布宽度自动取 viewBox。用 `node` 运行（Node 18+）。
- `scripts/check-edge.mjs`——Node.js（ESM）环境检测脚本：通过注册表 + 常见安装路径检测本机是否安装了 Microsoft Edge，退出码 0 表示已安装。
