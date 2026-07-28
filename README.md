# Skills 项目

网络搜集的各种skill.

**仓库地址:** https://github.com/steelan9199/wechat-publisher.git

## 安装单个技能

`feishu-bitable-yashu`是技能的名字, 也是技能文件夹的名字, 修改名字就可以了.

```
npx skills add  https://github.com/steelan9199/wechat-publisher/tree/main/skills/feishu-bitable-yashu
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
  - `context-handoff-yashu/` - 对话上下文交接文档生成工具
  - `contradiction-fixer-yashu/` - SKILL.md 矛盾检测与修复工具
  - `copy-folder-yashu/` - 文件夹复制工具（自动跳过 node_modules）
  - `coze-low-code-caller-yashu/` - 扣子低代码平台调用工具
  - `elite-intent-architect-yashu/` - 顶级意图架构与需求对齐工具
  - `error-friendly/` - 代码错误提示友好化工具
  - `feishu-bitable-yashu/` - 飞书多维表格操作工具
  - `feishu-docx-yashu/` - 飞书文档 Markdown 互转工具
  - `flat-illustration-asset-parser/` - 纯色平涂插画解析与 SAM3 提取提示词工具
  - `format-json/` - Markdown JSON 代码块格式化工具
  - `generate-cover-prompt-yashu/` - 封面提示词生成工具
  - `guizang-ppt-lite/` - 高级质感单文件 HTML 网页 PPT 生成工具
  - `image-pixel-viewer-yashu/` - 浏览器图片像素实时查看工具
  - `js-error-fixer/` - JavaScript 错误检查与修复工具
  - `js-project-refactor/` - JavaScript 项目架构重构与模块化工具
  - `json-to-markdown-files/` - JSON 转 Markdown 文件工具
  - `md-typeset-yashu/` - Markdown 文件排版优化工具
  - `move-big-folder-yashu/` - C 盘大文件夹迁移工具
  - `music/` - AI 音乐提示词生成工具
  - `node-version-compatibility-tester-yashu/` - Node.js 版本兼容性测试工具
  - `nodejs-cross-platform-checker-yashu/` - Node.js 跨平台兼容性检查工具
  - `paragraph-reorder-yashu/` - 文章段落主题聚类重排工具
  - `path-locator-checker-yashu/` - 脚本路径定位写法检查与修复工具
  - `phone-screenshot-yashu/` - 手机截图工具
  - `pyautogui-automation/` - 桌面自动化工具
  - `retest-generator/` - 技能复测脚本生成工具
  - `self-contained-auditor-yashu/` - 自包含技能评审器（检查技能知识是否全部内置、不依赖宿主私有接口）
  - `skill-bloat-auditor-yashu/` - 技能文档废话检查与诊断报告工具
  - `skill-description-optimizer-yashu/` - 技能 description 字段优化工具
  - `skill-failed-cleanup-yashu/` - 技能安装失败残留文件夹清理工具
  - `skill-get-link-yashu/` - 技能 GitHub 链接生成与剪贴板复制工具
  - `skill-logic-conflict-checker-yashu/` - 技能文档逻辑冲突检查工具
  - `skill-publish-yashu/` - 私有技能发布到公开目录工具
  - `skill-tester-yashu/` - 技能真实运行测试与报告工具
  - `skills-list-available-yashu/` - 可用技能列表查询工具
  - `svg-diagram-yashu/` - 扁平 SVG 图生成工具（架构图/中心辐射图/流程图/时序图/思维导图/组织架构图/对比矩阵/时间线/循环图/鱼骨图），支持 SVG 转 PNG 图片
  - `task-sop-architect-yashu/` - 任务 SOP 执行方案生成工具
  - `token-auditor-yashu/` - Token 消耗审计与优化工具
  - `video-course-recorder/` - Win11 视频课程录制一键启停助手
  - `webp-to-jpg/` - WebP 图片转 JPG 工具
  - `wechat-content-optimizer-yashu/` - 微信公众号内容优化工具
  - `wechat-publisher-yashu/` - 微信公众号发布工具
  - `wechat-skill-toggle-yashu/` - 公众号技能开关工具
  - `wechat-title-optimizer-yashu/` - 公众号标题优化工具
  - `win11-program-launcher/` - Win11 程序批量启停脚本工具
