---
name: feishu-token-updater
description: 更新飞书技能 feishu-docx-yashu 的 tenant_access_token 字段。激活条件：用户消息包含「更新/设置飞书 token」。
metadata:
  author: "AI Assistant"
  updated: "2026-08-06 17:00:00"
  version: "2.2.0"
---

# 飞书 tenant_access_token 更新器

## 用途

只做一件事：把用户**剪贴板**里的飞书访问令牌（`tenant_access_token`）写入配置文件：

`C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\config.default.json`

- 只改 `tenant_access_token` 的**值**，键名永远不动。
- 不碰 `appId`、`appSecret`、`member_id`、`custom` 等其它任何字段。

## 核心原则：Token 不进上下文

token 极长（数百~数千字符）且是敏感凭证，放进聊天框纯属浪费 token 和泄露风险。因此：

- **用户禁止把 token 粘贴到聊天消息里**，只需复制到剪贴板。
- 完整 token 只允许出现在「剪贴板 → 临时文件 → Node.js 脚本内部变量」这条链路里。
- AI 与用户只接触 token 的前 ~20 字符前缀。
- 仅当剪贴板内容**未通过校验**时，额外显示其前 10 与后 10 字符（换行/制表符转为 `\n`、`\r`、`\t` 形式）及总长度 `len`，供用户确认复制的到底是不是 token。

## 流程

1. 用户把 token 复制到剪贴板，然后发「更新飞书 token」（不要粘贴 token 到聊天框）。
2. 执行「第二步：读取剪贴板」（token 不进上下文）。
3. 执行「第三步：Node.js 校验特征并写入」（代码里检测，只输出结果与前缀）。
4. 执行「第四步：清理临时文件」。
5. 执行「第五步：回执」。

## 第一步：触发

用户消息含「更新/设置飞书 token」即触发，**不要等用户粘贴 token**，直接执行第二步。token 是否有效由第三步的代码判断。

## 第二步：读取剪贴板 → 临时文件（内容不进上下文）

用 PowerShell 把剪贴板原样写入临时文件（管道输出不会回显剪贴板内容）：

```powershell
Get-Clipboard -Raw | Set-Content -LiteralPath "C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_token.txt" -Encoding UTF8 -NoNewline
```

要点：

- `-Raw` 取剪贴板全文，`-NoNewline` 避免额外换行。
- 剪贴板为空时临时文件为空，属正常，交由第三步判为无效。
- 此命令输出为空，不会把 token 打到终端。

## 第三步：Node.js 校验特征并写入（只输出结果与前缀）

> 注意：PowerShell 5 会把 `node -e '...'` 内联脚本中的双引号吞掉导致 SyntaxError，因此必须先把脚本写入临时文件再执行。

先用 Write 工具创建临时脚本 `C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_update.js`，内容如下：

```javascript
const fs = require("fs");
const cfgPath =
  "C:/Users/Administrator/.skills-manager/skills/feishu-docx-yashu/config.default.json";
const tokPath =
  "C:/Users/Administrator/.skills-manager/skills/feishu-docx-yashu/_tmp_token.txt";
let raw = fs.readFileSync(tokPath, "utf-8").replace(/^\uFEFF/, "");
// 不可见字符转义为可见形式，保证 head/tail 单行展示
const visible = (s) =>
  s.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
const reportInvalid = () => {
  console.log(
    "NO_VALID_TOKEN_IN_CLIPBOARD head=" +
      visible(raw.slice(0, 10)) +
      " tail=" +
      visible(raw.slice(-10)) +
      " len=" +
      raw.length,
  );
  process.exit(1);
};
// 特征1：先剔除一切杂质（换行/制表/空格/零宽字符等），只保留 JWT 字符集（字母数字 . _ -），
// 再匹配 eyJ 开头、两段点分隔的 base64url 结构 —— 可容忍复制时夹带的换行或隐藏字符
const cleaned = raw.replace(/[^A-Za-z0-9_.\-]/g, "");
const m = cleaned.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
if (!m) {
  reportInvalid();
}
const newToken = m[0];
// 特征2：解码 payload 校验 token 类型为 access_token。
// 注意：飞书 JWT 的键是标准注册声明 "typ"（不是 "type"），两版都兼容
let payload = null;
try {
  const b64 = newToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
} catch (e) {}
if (
  !payload ||
  (payload.type !== "access_token" && payload.typ !== "access_token")
) {
  reportInvalid();
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
const oldPrefix = (cfg["tenant_access_token"] || "").slice(0, 20);
cfg["tenant_access_token"] = newToken;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
console.log("UPDATED old=" + oldPrefix + " new=" + newToken.slice(0, 20));
```

再执行：

```bash
node "C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_update.js"
```

执行后，与 `_tmp_token.txt` 一起在「第四步」清理删除。

说明：

- 校验逻辑全部在代码里完成，AI 不参与看内容，完整 token 不会进入上下文。
- 打印只含新旧前缀（各 20 字符）与 `UPDATED` / `NO_VALID_TOKEN_IN_CLIPBOARD` 标记。
- 校验失败时，`NO_VALID_TOKEN_IN_CLIPBOARD` 一行同时输出 `head=`（剪贴板内容前 10 字符）、`tail=`（后 10 字符）、`len=`（总长度），换行/制表符会以 `\n`、`\r`、`\t` 形式显示；用户可据此判断：复制内容是不是完整 token、是不是复制错了东西、或 token 是否真的无效。
- 路径用 `/`，Windows 下 Node 可直接识别，避免反斜杠转义问题。
- `JSON.stringify(cfg, null, 2)` 等价 indent=2，默认保留中文。

## 第四步：清理临时文件

用 DeleteFile 工具删除 `C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_token.txt` 与 `C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_update.js`；或 PowerShell：

```powershell
Remove-Item -LiteralPath "C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_token.txt","C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\_tmp_update.js" -Force
```

## 第五步：回执

- 输出 `UPDATED`：告知用户已更新，只显示新 token 前 ~20 字符（如 `eyJhbGciOiJF...`）供核对。**完整 token 不要回显。**
- 输出 `NO_VALID_TOKEN_IN_CLIPBOARD`：说明剪贴板里没有符合特征的 token，并**原样展示 `head=`、`tail=`、`len=` 三个字段**（剪贴板内容前 10 / 后 10 字符与总长度），供用户确认复制内容是否为完整 token、是否复制错内容；随后引导走「兜底：发链接」。

## 兜底：发链接引导（剪贴板无有效 token 时）

把链接原样发给用户（不要自己打开、不要代填）：

`https://open.feishu.cn/api-explorer/cli_a74fda9e3ad8901c?apiName=create&project=docx&resource=document&version=v1`

并附引导：

> 打开上面的飞书 API Explorer 链接，授权/操作后从请求头复制 `tenant_access_token`（一长串字符），**复制到剪贴板即可，不要粘贴到聊天框**，然后回复「更新飞书 token」，我会自动读取剪贴板并写入配置。

## 硬性约束

- 配置文件路径固定为 `C:\Users\Administrator\.skills-manager\skills\feishu-docx-yashu\config.default.json`，不要写到其它位置。
- 只改 `tenant_access_token` 这一个字段的值；键名永不修改。
- token 属敏感凭证：完整值不回显、不落盘到日志/无关文件；临时文件用后即删。
- 用户环境为 Windows（Win 11 / PowerShell 5），命令按 PowerShell 语法编写。
