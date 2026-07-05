# Skills 项目

网络搜集的各种skill.

**仓库地址:** https://github.com/steelan9199/wechat-publisher.git

## 安装单个技能

`feishu-docx`是技能的名字, 也是技能文件夹的名字, 修改名字就可以了.

```
npx skills add  https://github.com/steelan9199/wechat-publisher/tree/main/skills/feishu-docx
```

## 安装所有技能

```
npx skills add steelan9199/wechat-publisher
```

## 快速推送脚本

### 🚀 使用方法: 运行和调试面板

1. 点击左侧边栏的 **运行和调试** 图标 (或按 `Ctrl+Shift+D`)
2. 选择 **🚀 Push to GitHub**
3. 点击绿色的`开始调试`按钮

**两个选项:**

- **🚀 Push to GitHub** - 使用时间戳,一键推送
- **✏️ Push with Custom Message** - 输入自定义提交信息

## 项目结构

- `skills/` - 各种技能包
  - `backup-project/` - JS 项目代码备份工具
  - `chrome-devtools-skill/` - Chrome DevTools 网页分析工具
  - `context-handoff/` - 对话上下文交接文档生成工具
  - `copy-folder/` - 文件夹复制工具（自动跳过 node_modules）
  - `elite-intent-architect/` - 顶级意图架构与需求对齐工具
  - `error-friendly/` - 代码错误提示友好化工具
  - `failed-skill-cleanup/` - 技能安装失败残留文件夹清理工具
  - `feishu-bitable/` - 飞书多维表格操作工具
  - `feishu-docx/` - 飞书文档 Markdown 互转工具
  - `flat-illustration-asset-parser/` - 纯色平涂插画解析与 SAM3 提取提示词工具
  - `format-json/` - Markdown JSON 代码块格式化工具
  - `generate-cover-prompt/` - 封面提示词生成工具
  - `get-skill-link/` - 技能 GitHub 链接生成与剪贴板复制工具
  - `guizang-ppt-lite/` - 高级质感单文件 HTML 网页 PPT 生成工具
  - `js-error-fixer/` - JavaScript 错误检查与修复工具
  - `js-project-refactor/` - JavaScript 项目架构重构与模块化工具
  - `json-to-markdown-files/` - JSON 转 Markdown 文件工具
  - `move-big-folder/` - C 盘大文件夹迁移工具
  - `music/` - AI 音乐提示词生成工具
  - `node-version-compatibility-tester/` - Node.js 版本兼容性测试工具
  - `nodejs-cross-platform-checker/` - Node.js 跨平台兼容性检查工具
  - `pyautogui-automation/` - 桌面自动化工具
  - `retest-generator/` - 技能复测脚本生成工具
  - `skill-checker/` - Skill 功能完整性检测工具
  - `skill-description-optimizer/` - 技能 description 字段优化工具
  - `skill-laws/` - Skill 设计法则
  - `webp-to-jpg/` - WebP 图片转 JPG 工具
  - `wechat-content-optimizer/` - 微信内容优化工具
  - `wechat-publisher-yashu/` - 微信公众号发布工具
  - `wechat-title-optimizer/` - 公众号标题优化工具
  - `win11-program-launcher/` - Win11 程序批量启停脚本工具

- `push.js` - 快速推送脚本
