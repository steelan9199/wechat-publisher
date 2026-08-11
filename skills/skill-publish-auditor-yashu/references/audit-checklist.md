# 技能发布前审核检查清单（权威维度）

本文件是 `scripts/audit.js` 检测的权威维度说明，也供人工补检参考。每条标注：自动(P0/P1/P2) 或 人工。

---

## A. 结构与元数据
- A1 自动(P0)：技能根目录存在 `SKILL.md`。
- A2 自动(P0/P1)：`SKILL.md` 顶部 `---` 包裹的 frontmatter 含 `name` 与 `description`；缺失则 P1，完全无 frontmatter 则 P0。
- A3 自动(P2)：`description` 含可识别的激活关键词（反引号包裹的触发词 / "激活条件" / 明确动作词）；长度建议 ≤ 300 字。
- A4 自动(P1)：`SKILL.md` 正文引用的 `scripts/...`、`references/...`、`assets/...`、`temp/...` 路径真实存在（占位符 `<...>` 不检查）。

## B. 隐私与敏感信息
- B1 自动(P1)：文件名匹配私人数据模式 —— `screenshot_*`、`crop_*`、`clipboard_*`、`user_*`、`*_demo.db`、任意 `*.db`。
- B2 自动(P1/P0)：图片落在 `uploads/`、`temp/`、`tmp/`、`cache/` 等运行产物目录 → P1（可能含私人截图）；非资源目录的图片 → P2（人工确认）。
- B3 自动(P0 代码 / P2 文档)：硬编码私人局域网 IP（192.168.x / 10.x / 172.16-31.x）。出现在 `.js`/`.ts`/`.json`/`.py` 等代码默认值里判 P0，出现在 `.md` 文档示例里判 P2。
- B4 自动(P2)：写死私人绝对路径 `C:/Users/<用户名>/...` 等。
- B5 自动(P1)：疑似密钥/密码明文（api_key / secret / token / password / Bearer 等）。
- B6 人工：个人信息（姓名、电话、地址、聊天记录）出现在任何文件。

## C. 引用完整性
- C1 自动(P1)：见 A4。
- C2 人工：references 文件之间互相引用是否可达；SKILL.md 提到的"例子库""手册"是否真存在。

## D. 依赖与体积
- D1 自动(P2)：含 `node_modules` 时报告体积；纯 JS 依赖随包可开箱即用，否则需加 `npm install` 说明。
- D2 自动(P1)：有 `node_modules` 却无 `package.json`；或 `package.json` 声明依赖但未随包且未安装。
- D3 人工：技能总体积（不含 node_modules）是否合理，有无多余大文件。

## E. 合规与署名
- E1 自动(P1/P2)：有 `LICENSE` 文件；若 `package.json` 声明了 `license` 却无 `LICENSE` 文件 → P1，否则 P2。
- E2 自动(P2)：有 `.gitignore`，忽略 `node_modules/`、`uploads/*`、`temp/*` 等运行产物。
- E3 人工：技能命名是否中性 / 署名清晰；是否含个人手柄导致分叉混淆。

## F. 安全
- F1 自动(P2)：使用 `eval` / `new Function`（需确认非执行不可信输入）。
- F2 自动(P2)：使用子进程/命令执行（`child_process` / `exec` / `spawn`）（需确认不越权）。
- F3 人工：脚本是否会无审查地把用户私密目录文件外发、是否从网络拉取并直接执行远端代码。

## G. 文档
- G1 自动(P2)：有 `README.md` 说明安装/前置/首次使用。
- G2 人工：首次使用指引是否清晰、激活词是否容易被用户说中。

---

## 判定结论
- 任意 P0 → `BLOCKED`：阻断发布。
- 仅 P1 → `NEEDS_FIX`：建议发布前修完。
- 仅 P2 / 无问题 → `READY`：可发布，P2 为可选优化。
