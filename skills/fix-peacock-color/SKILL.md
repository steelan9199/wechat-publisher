---
name: fix-peacock-color
description: 修复 Trae 编辑器中 Peacock 插件的颜色配置问题，确保标签页、状态栏和标题栏的文字颜色具有良好的可读性和对比度。当用户遇到 Peacock 颜色显示异常（如白底白字、对比度不足）、需要优化编辑器主题颜色配置、或调整 Trae/VS Code 的 Peacock 插件颜色设置时使用此技能
version: 1.0.0
tags:
  - vscode
  - trae
  - peacock
  - theme
  - color
---

# Fix Peacock Color

修复 Trae 编辑器中 Peacock 插件的颜色配置问题，解决对比度不足导致的文字难以辨认问题。

## 前置条件

- 项目根目录存在 `.vscode/settings.json` 文件
- 项目中已安装并配置了 Peacock 插件
- `settings.json` 中包含 `peacock.color` 或 `workbench.colorCustomizations` 配置

## 快速开始

当用户报告 Peacock 颜色问题（如标签页白底白字）时：

1. 读取 `.vscode/settings.json` 文件
2. 提取当前的 `peacock.color` 作为主色
3. 生成修复后的完整颜色配置
4. 更新 `settings.json` 文件

## 颜色修复原理

### 问题诊断

Peacock 在 Trae 中常见的问题：
- 标签页背景色与文字颜色对比度不足（白色背景配白色文字）
- 状态栏和标题栏的文字颜色在某些主题下难以辨认
- 缺少编辑器、侧边栏、终端等关键区域的颜色配置

### 对比度标准

根据 WCAG 2.1 无障碍标准：
- **正常文字**: 对比度至少 4.5:1
- **大文字** (18pt+ 或 14pt+粗体): 对比度至少 3:1
- **UI组件/图形**: 对比度至少 3:1

### 本技能使用的对比度标准

| 场景 | 背景色 | 文字色 | 对比度 |
|------|--------|--------|--------|
| 标签页激活 | Peacock主色 (~#b1e4cb) | #000000 | ~8.5:1 ✓ |
| 标签页非激活 | 浅色变体 (~#d7f1e4) | #00000099 | ~6:1 ✓ |
| 编辑器 | #ffffff | #212529 | ~16:1 ✓ |
| 侧边栏 | #f8f9fa | #212529 | ~14:1 ✓ |
| 状态栏 | Peacock主色 | #000000 | ~8.5:1 ✓ |

### 亮度调整算法

基于 Peacock 主色生成变体：
- **更亮变体** (lighter): 亮度 × 1.15，用于非激活背景
- **更暗变体** (darker): 亮度 × 0.85，用于悬停状态
- **激活变体** (active): 亮度 × 0.70，用于选中/激活状态

### 中性色阶

为避免视觉混乱，使用固定的中性色阶：
- **纯白**: #ffffff (编辑器背景)
- **浅灰白**: #f8f9fa (侧边栏、面板背景)
- **浅灰**: #e9ecef (分隔区域)
- **边框灰**: #dee2e6 (边框、分割线)
- **中灰**: #6c757d (次要文字、行号)
- **深灰**: #212529 (主要文字)
- **纯黑**: #000000 (高对比度文字)

### 半透明文字

非激活状态使用半透明黑色：
- `#000000` (完全不透明) = 激活/主要文字
- `#00000099` (60%不透明) = 非激活/次要文字
- `#15202b99` (深色半透明) = 活动栏次要文字

## 修复规则详解

修复脚本会保留原有的 Peacock 主色调，但会修复以下颜色配置：

### 活动栏 (Activity Bar)
- `activityBar.activeBackground`: 使用更深的主题色变体 (亮度 × 0.70)
  - 依据: 激活状态需要明显区分，使用深色变体提供视觉权重
- `activityBar.background`: 使用浅色主题色变体 (亮度 × 1.15)
  - 依据: 作为大面积背景，使用较浅颜色避免视觉疲劳
- `activityBar.foreground`: 深色文字 (#15202b)
  - 依据: 与浅绿背景对比度 > 10:1，远超 WCAG AAA 标准

### 状态栏 (Status Bar)
- `statusBar.background`: 保持原 Peacock 颜色
- `statusBar.foreground`: 纯黑色 (#000000)
  - 依据: 与典型 Peacock 浅色背景对比度 ~8.5:1，满足 WCAG AA 标准
- `statusBarItem.remoteForeground`: 纯黑色 (#000000)
  - 依据: 远程指示器需要清晰可见

### 标题栏 (Title Bar)
- `titleBar.activeBackground`: 保持原 Peacock 颜色
- `titleBar.activeForeground`: 纯黑色 (#000000)
  - 依据: 窗口标题需要最高可读性
- `titleBar.inactiveForeground`: 半透明黑色 (#00000099)
  - 依据: 非激活窗口使用 60% 透明度降低视觉优先级，但仍保持可读性

### 标签页 (Tabs) - **重点修复**
- `tab.activeBackground`: 使用 Peacock 主题色
  - 依据: 激活标签需要与主题色关联，提供窗口识别
- `tab.activeForeground`: 纯黑色 (#000000)
  - 依据: **关键修复** - 与浅色背景对比度 > 8:1，解决白底白字问题
- `tab.inactiveBackground`: 使用浅色主题色变体 (亮度 × 1.15)
  - 依据: 非激活标签后退一步，使用更浅颜色形成层级
- `tab.inactiveForeground`: 半透明黑色 (#00000099)
  - 依据: 60% 透明度降低视觉权重，但仍保持 > 6:1 对比度
- `tab.border`: 浅灰色边框 (#dee2e6)
  - 依据: 中性灰边框不干扰主题色，提供清晰分隔

### 编辑器 (Editor)
- `editor.background`: 纯白色 (#ffffff)
  - 依据: 代码编辑需要最大背景亮度，减少眼睛疲劳
- `editor.foreground`: 深灰色 (#212529)
  - 依据: 纯白背景上 #212529 提供 16:1 对比度，适合长时间阅读代码
- `editorLineNumber.foreground`: 中灰色 (#6c757d)
  - 依据: 行号是辅助信息，使用 7:1 对比度既可见又不分散注意力
- `editor.selectionBackground`: 浅蓝色 (#cce7ff)
  - 依据: 蓝色选区与白色背景对比度适中，不会刺眼

### 侧边栏 (Sidebar)
- `sideBar.background`: 浅灰白 (#f8f9fa)
  - 依据: 比纯白稍暗，与编辑器形成微妙区分，但不突兀
- `sideBar.foreground`: 深灰色 (#212529)
  - 依据: 与 #f8f9fa 背景对比度 ~14:1，确保文件树清晰可读
- `sideBar.border`: 浅灰色 (#dee2e6)
  - 依据: 1px 边框提供视觉分隔，颜色与背景对比度 < 3:1 避免过于明显

### 终端 (Terminal)
- `terminal.background`: 浅灰白 (#f8f9fa)
  - 依据: 与侧边栏保持一致，形成统一的面板区域视觉
- `terminal.foreground`: 深灰色 (#212529)
  - 依据: 终端文字需要与编辑器代码同等可读性

## 使用工具

- `Read` - 读取 `.vscode/settings.json` 文件
- `Edit` - 更新颜色配置

## 输出格式

修复完成后，向用户报告：
1. 检测到的 Peacock 主色
2. 修复的颜色配置项数量
3. 关键修复点（如标签页文字颜色）
4. 建议用户重启 Trae 以查看效果

## 示例

### 修复前

```json
{
  "workbench.colorCustomizations": {
    "activityBar.background": "#d7f1e4",
    "statusBar.background": "#b1e4cb",
    "titleBar.activeBackground": "#b1e4cb"
  },
  "peacock.color": "#b1e4cb"
}
```

### 修复后

```json
{
  "workbench.colorCustomizations": {
    "activityBar.activeBackground": "#7ca08e",
    "activityBar.background": "#cbefe0",
    "activityBar.foreground": "#15202b",
    "activityBar.inactiveForeground": "#15202b99",
    "activityBarBadge.background": "#af89d6",
    "activityBarBadge.foreground": "#15202b",
    "commandCenter.border": "#15202b99",
    "sash.hoverBorder": "#cbefe0",
    "statusBar.background": "#b1e4cb",
    "statusBar.foreground": "#000000",
    "statusBarItem.hoverBackground": "#96c2ad",
    "statusBarItem.remoteBackground": "#b1e4cb",
    "statusBarItem.remoteForeground": "#000000",
    "titleBar.activeBackground": "#b1e4cb",
    "titleBar.activeForeground": "#000000",
    "titleBar.inactiveBackground": "#b1e4cb99",
    "titleBar.inactiveForeground": "#00000099",
    "editor.background": "#ffffff",
    "editor.foreground": "#212529",
    "editorLineNumber.foreground": "#6c757d",
    "editorCursor.foreground": "#007acc",
    "editor.selectionBackground": "#cce7ff",
    "editor.inactiveSelectionBackground": "#80e9ecef",
    "tab.activeBackground": "#b1e4cb",
    "tab.activeForeground": "#000000",
    "tab.inactiveBackground": "#cbefe0",
    "tab.inactiveForeground": "#00000099",
    "tab.border": "#dee2e6",
    "panel.background": "#f8f9fa",
    "sideBar.background": "#f8f9fa",
    "sideBar.border": "#dee2e6",
    "sideBar.foreground": "#212529",
    "terminal.background": "#f8f9fa",
    "terminal.foreground": "#212529",
    "terminal.border": "#dee2e6"
  },
  "peacock.color": "#b1e4cb"
}
```

## 注意事项

1. 修复脚本会保留原始的 `peacock.color` 值
2. 如果 `settings.json` 中已有其他配置，修复脚本会保留这些配置
3. 修复后的颜色配置针对 Trae 编辑器优化，确保文字可读性
4. 修复后建议重启 Trae 编辑器以完全应用颜色更改
