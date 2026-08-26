---
name: functionpage-addfn-yashu
description: 给本地功能网页（D:\software\functionPage）新增一个功能页面。当用户说「给功能网页加个 XX 功能」「给功能网页加一个 XX 功能」「给功能网页新增 XX 功能」时启用。功能可为纯前端（计算/复制/取色等），或需要本地 Hono 后台（server/routes/<id>.js）调用本机程序；自动创建对应文件并登记到 functions.js，首页功能列表即可见、可用。
---

# 给功能网页加新功能

## 作用
为本地多页面功能网页 `D:\software\functionPage` 新增一个**独立、可直接使用**的功能。
用户描述需求 → 一键产出完整功能页面 → 自动出现在首页功能列表里。
功能分两类：
- **纯前端功能**：计算、复制、取色、本地字符串处理等，浏览器内即可完成，无后台。
- **需后台功能**：要调用本机程序（如 `node` 跑脚本、读取/执行技能目录里的程序）的功能，必须经本地 Hono 后台转发——浏览器（file://）无法直接调本机程序。

## 激活条件
用户消息须同时包含「功能网页」+「加/新增」+「功能」语义，典型句式：
- `给功能网页加个 XX 功能`
- `给功能网页加一个 XX 功能`
- `给功能网页新增 XX 功能`

（只说「新增一个功能」「加个 AI 功能」但没提「功能网页」的，不触发。）

## 工程位置（固定）
`D:\software\functionPage`
- 首页：`index.html`（读取 `functions.js` 渲染功能列表）
- 共用：`style.css`（样式）、`base.js`（提供 `window.showToast(msg)` 提示）
- 配置：`functions.js`（`window.FUNCTIONS` 数组，每项 = 一个功能）
- 各功能：`functions/<id>/index.html` + `functions/<id>/index.js`
- 后台（仅"需后台功能"用到）：`server/index.js`（Hono 网关，自动装载 `routes/*.js` + CORS + `/api/health`）、`server/routes/<id>.js`（插件路由）、`server/package.json`（依赖 `hono` + `@hono/node-server`）、`server/node_modules`（已 gitignore）
- 启动脚本：`start-server.bat`（双击启动后台，端口见下方「端口怎么改」）

### 架构总览
```
functionPage/
├─ index.html / style.css / base.js / functions.js   # 前端壳 + 功能注册表
├─ start-server.bat                                  # 双击启动后台
├─ functions/
│  ├─ <纯前端id>/ index.html + index.js              # 浏览器内完成，无后台
│  └─ <需后台id>/ index.html + index.js [+ config.json] # 前端采集数据
└─ server/
   ├─ index.js                                       # Hono 网关（装载 routes/*.js）
   ├─ routes/<需后台id>.js                            # 该功能的后台逻辑
   └─ package.json
```
前端（file:// 打开）通过 `fetch('http://localhost:默认端口/api/<id>/...')` 与后台通信；后台已开 CORS（`origin: '*'`），放行 file:// 的 null 源。

**端口（默认 `18789`，全文档唯一数字定义处）**：改端口只需动下方"端口怎么改"指明的入口，正文其他地方统称"默认端口"，无需改动。
- 后端：`server/index.js` 的 `PORT`（读取环境变量 `PORT`，未设则回落到默认端口）。
- 启动脚本：`start-server.bat` 的 `PORT=`（或直接 `start-server.bat <端口>` 用命令行参数覆盖）。
- 前端页面：功能页顶部「后台地址」输入框（默认值即默认端口，改动后自动记忆到 localStorage），状态检测与发送都按框里的值走。**改端口后须让前端框里的地址与后台实际端口一致。**

## 执行流程（严格按顺序）
1. **解析需求**：从消息里「给功能网页加个 <需求>」提取 <需求>。
2. **判断是否需要后台**（关键决策）：
   - 功能只需浏览器内计算/复制/取色/文本处理 → **纯前端**，走旧流程。
   - 功能要调用本机程序（如 `node xxx.js`、执行技能脚本、读本地文件/目录）→ **需后台**，必须新增 `server/routes/<id>.js`，前端改为 `fetch` 后台。
   - 不确定时问用户一句："这个功能需要调用你电脑上的程序吗？"
3. **补齐规格**（只在必要处问，禁止审讯式连问）：
   - 功能**中文显示名**、**英文 id**（文件夹名，全小写+短横）
   - 做什么、输入/输出、是否复制结果
   - 需后台功能：要明确"前端发给后台什么、后台去调什么程序、日志怎么回传"
   - 用户已描述清楚的，跳过提问直接下一步。
4. **确认再写**：把「中文名 + 英文 id + 一句话功能说明 + 是否需后台」回显确认；用户 OK 后才创建文件。
5. **创建前端文件**（以 `functions/filename-fix/` 为结构模板）：
   - `functions/<id>/index.html`：含「← 返回功能中心」链接、`.wrap > .card`、引用 `../../style.css`、底部 `../../base.js` + `./index.js`。
   - `functions/<id>/index.js`：IIFE 封装；提示用 `window.showToast(msg)`；复制用下方 file:// 兼容函数。
   - **需后台功能额外**：
     - 页面顶部加"后台状态点"（fetch `/api/health`，在线才启用发送按钮）；
     - 发送按钮 `fetch('http://localhost:默认端口/api/<id>/...', {method, body})`；
     - 若需实时日志，用 `resp.body.getReader()` 逐块读取并追加到日志区；
     - 配置类数据可放 `functions/<id>/config.json`，由后台 GET 接口读取返回。
6. **需后台功能：创建路由插件** `server/routes/<id>.js`：
   - 默认导出 `function(app){ app.get('/api/<id>/xxx', ...); app.post('/api/<id>/yyy', ...); }`
   - 需要调本机程序时：用 `spawn(process.execPath, [脚本, ...参数], {cwd})` 启动（复用启动后台的同一个 node，已满足版本要求）；
   - 流式日志：`return new Response(new ReadableStream({start(controller){ child.stdout/stderr.on('data', d=>controller.enqueue(encoder.encode(d.toString()))); child.on('close', ()=>controller.close()); }}))`
   - 写临时文件用 `mkdtemp` + `tmpdir()`，不要污染技能目录或功能 config.json。
7. **登记到 functions.js**：`window.FUNCTIONS` 追加 `{ id:'<id>', name:'<中文名>', icon:'<emoji>', desc:'<一句话说明>' }`。
8. **校验**：确认 `functions/<id>/` 两文件已生成；`node --check` 前端 `index.js` 与后台 `routes/<id>.js`；纯前端无需启动后台，需后台功能确认 `node server/index.js` 能起、接口可通。
9. **汇报**：新功能路径、首页入口、是否需先双击 `start-server.bat` 启动后台。

## 共用复制函数（file:// 兼容，直接复用）
```js
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function (resolve, reject) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}
```

## 约束
- 前端纯本地、不联网：禁止外部 CDN、网络字体；禁止 `fetch` 读取本地文件系统中的文件（file:// 下被拦截）。
- **允许** `fetch('http://localhost:默认端口/api/...')` 访问本地后台（后台已开 CORS）。需要调用本机程序的功能**必须**走后台，浏览器（file://）不能直接 spawn/exec。
- 复用 `style.css` 与 `base.js`；只有该功能的专属样式才往 `style.css` 追加。
- 生成**完整可运行**代码，不留 TODO（用户选的是「一键完整功能」）。
- 不要删除/改动其他已有功能文件夹；新增后台路由不影响现有纯前端功能。
- id 与文件名一律用英文/数字/短横，避免中文路径兼容问题。
- 每个功能一个文件夹，逻辑与界面自包含。

## 示例
**纯前端**：用户「给功能网页加个 颜色转换器，输入十六进制颜色，输出 RGB 和反向色」
→ 提议 id=`color-converter` → 确认 → 生成 `functions/color-converter/` 两文件（计算+复制）→ 追加 `functions.js` → 首页出现入口。

**需后台**：用户「给功能网页加个功能，输入本地 .md 绝对路径，把它发到公众号」
→ 判断需调本机 `node` 跑发布脚本 → 提议 id=`wechat-publish`、需后台 → 生成前端 `functions/wechat-publish/`（路径输入 + 可编辑 config.json + 发送按钮 + 流式日志区 + 后台状态点），并新增 `server/routes/wechat-publish.js`（GET 读配置 / POST 流式 spawn 发布脚本）；后台用临时配置文件喂给 `node scripts/index.js --config <临时文件>`，脚本日志经 ReadableStream 回传前端。用户使用前需双击 `start-server.bat` 启动后台。
