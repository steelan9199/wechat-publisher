# Skills 项目

个人技能包和工具集合。

**仓库地址:** https://github.com/steelan9199/wechat-publisher.git

## 安装单个技能

`feishu-docx`是技能的名字, 也是技能文件夹的名字, 修改名字就可以了.

```
npx skills add  https://github.com/steelan9199/wechat-publisher/tree/main/skills/feishu-docx
```

## 快速推送脚本

### 🚀 使用方法: 运行和调试面板

1. 点击左侧边栏的 **运行和调试** 图标 (或按 `Ctrl+Shift+D`)
2. 选择 **🚀 Push to GitHub**
3. 点击绿色播放按钮 ▶️ (或按 `F5`)

**两个选项:**

- **🚀 Push to GitHub** - 使用时间戳,一键推送
- **✏️ Push with Custom Message** - 输入自定义提交信息

## 项目结构

- `skills/` - 各种技能包
  - `chrome-devtools-skill/` - Chrome DevTools 网页分析工具
  - `create-symlink/` - 创建符号链接工具
  - `feishu-bitable/` - 飞书多维表格操作工具
  - `feishu-docx/` - 飞书文档 Markdown 互转工具
  - `generate-cover-prompt/` - 封面提示词生成工具
  - `pyautogui-automation/` - 桌面自动化工具
  - `skill-creator-yashu/` - 技能创建工具
  - `skill-hide/` - 隐藏或恢复技能
  - `skill-optimizer-yashu/` - 分析和优化 Skill
  - `skill-refresh/` - 技能刷新工具
  - `vscode-theme-colors/` - VSCode 主题颜色工具
  - `webp-to-jpg/` - WebP 图片转 JPG 工具
  - `wechat-content-optimizer/` - 微信内容优化工具
  - `wechat-publisher-yashu/` - 微信公众号发布工具

- `push.js` - 快速推送脚本
