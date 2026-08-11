# autojs-project —— AI 写 AutoJS 工程的默认目录

本目录是 **AI 端编写 AutoJS 多文件工程（要部署到手机的项目）的统一存放位置**。

## 约定

- 每个工程一个子目录，目录名即工程名：`<skill_dir>/scripts/autojs-project/<工程名>/`
- 工程内部结构参照同级的 `../autojs-min-project-template` 范本：
  - `main.js`        入口（被 require / 运行）
  - `modules/`       业务模块，内部互相 `require('./x')`
  - `assets/`        图片/音频等资源，原样下发
  - `project.json`   可选，name=工程名、main="main.js"、ignore=[...]
- **一次性、单文件的临时脚本不要放这里**，写到 `<skill_dir>/temp/` 目录（见 SKILL.md「现场脚本规范」）。

## 部署到手机

```bash
cd /c/Users/Administrator/.workbuddy/skills/autojs-task-runner-yashu && \
  node scripts/deploy_project.js scripts/autojs-project/<工程名> --name <工程名> --args '{...}'
```

工程较复杂（多模块 / 带资源）时，用 `--zip` 模式整体打包、只走一次传输：

```bash
node scripts/deploy_project.js scripts/autojs-project/<工程名> --zip
```

> 工程编码硬约束（ES5 / var only、入口回执、相对 require 由运行侧注入）详见 SKILL.md「工程代码编写规范」。
