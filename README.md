# Skills 项目

个人技能包和工具集合。

## 快速推送脚本

### 🚀 推荐方式: 运行和调试面板

1. 点击左侧边栏的 **运行和调试** 图标 (或按 `Ctrl+Shift+D`)
2. 选择 **🚀 Push to GitHub**
3. 点击绿色播放按钮 ▶️ (或按 `F5`)

**两个选项:**

- **🚀 Push to GitHub** - 使用时间戳,一键推送
- **✏️ Push with Custom Message** - 输入自定义提交信息

### 其他方式

**快捷键:**

- `Ctrl+Shift+G` - 快速推送(时间戳)
- `Ctrl+Alt+G` - 推送(自定义信息)

**命令行:**

```powershell
.\push.ps1                    # 使用默认时间戳
.\push.ps1 "修复了bug"    # 自定义提交信息
```

## 项目结构

- `skills/` - 各种技能包

  - `wechat-publisher/` - 微信公众号发布工具
  - `wechat-content-optimizer/` - 微信内容优化工具
  - `wechat-title-optimizer/` - 微信标题优化工具
  - `webp-to-jpg/` - WebP 图片转 JPG 工具
  - `create-symlink/` - 创建符号链接工具
  - `move-big-folder/` - 大文件夹迁移工具
  - `empjs-skill/` - empjs 技能管理工具
  - `generate-cover-prompt/` - 封面提示词生成工具

- `push.ps1` - 快速推送脚本
