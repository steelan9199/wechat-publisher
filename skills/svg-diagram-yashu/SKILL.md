---
name: svg-diagram-yashu
description: "生成扁平的 SVG 图（架构图/中心辐射图、线性流程图、简易时序图）。激活条件：用户消息须包含以下关键词之一:`画架构图`、`画流程图`、`画时序图`、`画个状态机`。"
---

# SVG 图生成器

生成扁平、随主题切换的 SVG 图，并保存为 `.svg` + 一张白底 `.html` 预览图 + 一张 2× 的 `.png`（用于插入公众号等文章）。绘图规范完全内置在本技能内（见 `references/design-system.md`），不依赖任何外部 AI 客户端命令。不生成位图。

## 使用场景

- 用户想*看*某个结构、流程或对比，而不是读大段文字。
- 不要用于位图、照片或基于组件的 UI 线框图——那些属于别的技能。

## 前置 · 环境检查

本技能的最终产物是能插入公众号的 PNG，导出依赖两项本机工具。每次执行前先确认，任一项不满足就提示用户安装并结束任务，不再继续：

- **Node.js 18+**：运行 `node --version`。若命令不存在（或版本低于 18），提示用户「未检测到 Node.js 或版本过低，请安装 Node.js 18+（https://nodejs.org）后重试」，然后结束任务。
- **Microsoft Edge**：运行 `where msedge`。若命令返回空（即未找到），提示用户「未检测到 Microsoft Edge，请安装 Edge（https://www.microsoft.com/edge）后重试」，然后结束任务。

两项都满足，才进入下面的工作流。

## 工作流

1. **读取内置设计规范。** 用 Read 工具打开 `references/design-system.md`，获取全部绘图约束（调色板、字体、viewBox 规则、箭头标记）。本规范已内置、自包含，不依赖任何外部命令。

2. **按用户意图选择图的类型**：
   - **架构图 / 中心辐射图**——组件围绕一个中心节点（例如一台服务器向多个客户端转发）。参见 `references/example-architecture.svg`。
   - **流程图**——顺序步骤 / 因果，单向，≤4–5 个节点。参见 `references/example-flowchart.svg`。
   - **时序图**——顶部是参与者，消息用箭头向下流动。参见 `references/example-sequence.svg`。
   - **状态机图**——节点为状态，箭头为状态转移，支持分支与合流。参见 `references/example-state-machine.svg`。

3. **编写 SVG**，遵循 `references/design-system.md` 中的硬性约束（也汇总如下）：
   - `viewBox="0 0 680 H"`（宽度 100%）；`H` = 最底部元素的位置 + 20。
   - 外层背景透明；只使用纯色填充，不要渐变、阴影、模糊或发光。
   - 仅两种字重：400（常规）和 500（中等）。正文 13px，标题 14px。字体不得小于 11px。
   - 文字颜色跟随客户端主题：浅色主题用深色文字，深色主题用浅色文字。每个图形都要显式设置 `fill`（不要用 CSS 继承）。
   - 每一水平层 ≤4 个框；整张图 ≤2 个色阶。
   - 每条连接线 `<path>`/`<polyline>`：`fill="none"`。箭头使用 `design-system.md` 里的标记。
   - 框内每个 `<text>`：`dominant-baseline="central"`。
   - 根 `<svg>` 要加 `role="img"`，并把 `<title>` 和 `<desc>` 作为前两个子元素。
   - 不要有 `<!-- 注释 -->`、不要旋转文字、不要 `position: fixed`。

4. **展示图表。** 把生成的 `.html` / `.png` 文件交给用户打开。

5. **保存三个产物**到工作区，使用同一个有描述性的基础文件名（例如 `phone-screenshot-arch`）：
   - **`.svg`**——原始矢量文件（用 Write 工具写）。
   - **`.html`**——白底预览包装，方便手动用 Edge 截图（用 Write 工具写）。把 SVG 内联进这个模板：
     ```
     <!doctype html><html><head><meta charset=utf-8><style>html,body{margin:0;background:#fff}body{display:flex;justify-content:center;padding:20px}svg{width:680px;height:auto;display:block}</style></head><body>INLINE_SVG</body></html>
     ```
   - **`.png`**——通过自带的 Node.js 转换器按 2× 栅格化。在 Bash 中运行（环境检查已确认 node 与 Edge 均可用）：
     ```
     node SKILL_DIR/scripts/svg-to-png.mjs --SvgPath SVG_PATH
     ```
     把 SKILL_DIR 替换为技能安装路径，SVG_PATH 替换为 .svg 文件路径。
     退出码为 2 表示找不到 Edge（环境检查遗漏），提示用户安装 Edge；退出码 4 表示截图未生成，提示改用下方「方法 2」手动截图。其余退出码见脚本头部注释。
     报告所有保存路径。

6. **用文字说明。** 把所有描述、背景和后续步骤都写在 SVG *之外*的对话消息里。SVG 只负责视觉。

## 把图变成图片（公众号插入用）

公众号编辑器只接受 JPG / PNG，**不**接受 SVG 直接上传。技能默认会自动导出 PNG；若自动失败或你想手动控制，用以下方法：

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

- `references/design-system.md`——完整的约束、调色板、箭头标记模板，以及框尺寸公式。技能自包含，规范全部内置在此文件，不依赖任何外部命令。
- `references/example-architecture.svg`、`example-flowchart.svg`、`example-sequence.svg`、`example-state-machine.svg`——供风格和结构对齐的少样本示例。
- `scripts/svg-to-png.mjs`——Node.js（ESM）转换器：通过无头 Edge 把 SVG 转成 2× PNG。自动检测 Program Files 里的 msedge；找不到时以退出码 2 结束并给出手动回退指引。用 `node` 运行（Node 18+）。
