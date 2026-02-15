# 微信公众号文章发布工具

将本地 Markdown 文章一键发布到微信公众号草稿箱的工具。

## 功能特性

- 将本地 Markdown 文件转换为适合微信公众号的文章格式
- 支持多种主题样式（共17种主题可选）
- 自动上传正文中和封面图片
- 支持数学公式渲染
- 支持代码块高亮显示
- 支持对话气泡样式
- 支持多种Markdown扩展语法

## 支持的主题

系统提供 17 种文章渲染主题：

- **sakura（樱花主题）**：日系樱花主题，柔和少女风格
- **minimal（极简主题）**：极简灰色主题，素雅简洁风格
- **amber（琥珀主题）**：温暖琥珀主题，金色阳光风格
- **blue（蓝色主题）**：清新蓝色主题，专业稳重风格
- **cyan（青色主题）**：清爽青色主题，科技现代风格
- **green（绿色主题）**：自然绿色主题，清新环保风格
- **indigo（靛蓝主题）**：深邃靛蓝主题，优雅高贵风格
- **lavender（薰衣草主题）**：淡雅薰衣草主题，浪漫温馨风格
- **mint（薄荷主题）**：清新薄荷主题，简约时尚风格
- **orange（橙色主题）**：活力橙色主题，热情积极风格
- **pink（粉色主题）**：甜美粉色主题，可爱温柔风格
- **purple（紫色主题）**：神秘紫色主题，高贵典雅风格
- **red（红色主题）**：经典红色主题，醒目有力风格
- **rose（玫瑰主题）**：浪漫玫瑰主题，优雅华丽风格
- **sky（天空主题）**：明亮天空主题，开阔清新风格
- **teal（青绿主题）**：优雅青绿主题，平衡和谐风格
- **vintage（复古主题）**：怀旧复古主题，经典文艺风格

## 环境要求

- Node.js >= 24.13.0
- 使用 ES Module

## 安装依赖

```bash
npm install
```

## 使用方法

### 1. 配置文件设置

复制 `config.default.json` 为 `config.json` 并按需修改配置：

```json
{
  "markdownFilePath": "你的 Markdown 文章路径",
  "title": "文章标题（可选，默认使用文件名）",
  "theme": "blue",
  "AUTHOR": "作者名称",
  "prefix": "文章前缀内容（可选）",
  "suffix": "文章后缀内容（可选）",
  "APP_ID": "微信公众号 AppID",
  "APP_SECRET": "微信公众号 AppSecret",
  "coverFilePath": "./cover.jpg"
}
```

### 2. 运行程序

```bash
npm start
```

或者直接运行：

```bash
node index.js --config ./config.json
```

## 配置说明

| 参数 | 说明 |
|------|------|
| markdownFilePath | 要发布的 Markdown 文件路径 |
| title | 文章标题（可选） |
| theme | 文章主题样式（可选，默认 blue） |
| AUTHOR | 文章作者名称 |
| prefix | 文章前缀内容（可选） |
| suffix | 文章后缀内容（可选） |
| APP_ID | 微信公众号 AppID |
| APP_SECRET | 微信公众号 AppSecret |
| coverFilePath | 封面图片路径 |

## 主题预览

可以访问 [https://5g6pxtj3zg.coze.site/](https://5g6pxtj3zg.coze.site/) 查看不同主题的实际效果。

## 版权说明

该项目包含授权机制，详情请参考源码中的许可证处理部分。