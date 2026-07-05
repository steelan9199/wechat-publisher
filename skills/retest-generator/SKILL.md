---
name: "retest-generator"
description: "为已由 AI 测试成功的技能功能生成一键复测脚本和文档，让用户零 AI 消耗地独立复现测试。当用户说『为 XX 技能生成复测工具』、『生成手动测试脚本』、『我要手动复测』时触发。"
---

# retest-generator（复测工具生成器）

为已由 AI 验证成功的技能功能，在目标技能目录下生成一键复测脚本 + 使用文档，让用户之后无需 AI 即可独立复现该测试。

## 核心理念

**AI 测试消耗算力 = 花钱。** 已验证成功的测试流程，应固化成用户可独立运行的脚本，避免重复消耗 AI 算力。

## 触发条件

当用户在以下情境中调用本技能：

- 用户与 AI 已在当前对话中**成功测试**了某技能的某功能
- 用户希望之后能**独立复现**该测试，不再依赖 AI

典型触发语：

- "为 coze-caller 生成复测工具"
- "生成手动测试脚本"
- "我要手动复测 XX 技能"
- "把这个测试过程固化成脚本"

## AI 行为规范（关键）

### 生成依据优先级（严格按序）

1. **第一优先：当前对话中已成功测试的真实过程**（黄金蓝本）
   - AI 实际执行的命令链
   - 实际传入的参数格式
   - 实际得到的输出（session_id、chat_id、status、content 等）
   - 测试中踩过的坑、修正过的问题（如 JSON 输出在 stderr、路径必须绝对等）
   - 四步流程的真实串联逻辑

2. **第二优先：目标技能的 SKILL.md 和参考文档**
   - 补充参数定义、边界条件、异常处理
   - 确认脚本路径、配置文件位置

3. **第三优先：已验证的成熟范式**
   - `spawnSync` 调用封装脚本（非 execSync）
   - 合并 stdout + stderr 后用 `indexOf('{')` ~ `lastIndexOf('}')` 提取 JSON
   - ESM 语法（`import`，配合 `"type": "module"`）
   - 轮询逻辑用 `await sleep(interval * 1000)`

> ⚠️ **强制要求**：AI 生成脚本前，必须先回顾当前对话中与目标技能相关的成功测试过程。**禁止仅凭技能文档凭空推导**，因为文档不会记录实际运行时的细节坑点。

## 执行流程

### 步骤 1：识别目标技能和功能

从用户请求中识别：

- **目标技能名**：如 `coze-caller`
- **要复测的功能**：如"智能体调用"、"工作流执行"

### 步骤 2：回顾测试上下文

AI 回顾当前对话中：

- 测试该功能时执行了哪些命令？
- 每步的输入参数从哪里来（配置文件 / 上一步输出 / 用户输入）？
- 每步的输出字段是什么？传给下一步哪个参数？
- 遇到了什么问题？如何修正的？
- 涉及异步吗？轮询逻辑是什么？

### 步骤 3：读取目标技能文档（补充）

读取以下文件补充细节：

- `$SKILL_DIR/SKILL.md`（目标技能的技能说明）
- `$SKILL_DIR/references/` 下的相关参考文档
- `$SKILL_DIR/config/` 下的配置文件结构
- `$SKILL_DIR/.env` 的配置项（如轮询间隔）

### 步骤 4：在目标技能目录下生成文件

**输出位置：** `目标技能/手动测试技能/`

生成以下 3 个文件：

#### 4.1 `retest.js`（一键复测脚本）

**必须包含：**

- 命令行参数解析（如 `node retest.js "今天天气怎么样？"`）
- 路径定义（基于 `__dirname` 推导目标技能的 scripts、temp、config 目录）
- 工具函数：`extractJson`、`runScript`（spawnSync + 合并 stdout/stderr）、`parseEnv`
- 主流程：按测试顺序串联封装脚本，自动传递中间参数
- 轮询逻辑（若涉及异步状态查询）
- 清晰的步骤输出（▶ 第 N 步 / ✓ 输出 xxx）
- 错误处理（exit 1 + 友好错误信息）

**代码范式（必须沿用）：**

```javascript
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 目标技能根目录（手动测试技能 的上一级）
const SKILL_DIR = resolve(__dirname, "..");
const SCRIPTS_DIR = join(SKILL_DIR, "scripts");

// 从脚本输出提取 JSON（封装脚本可能把 JSON 输出到 stderr）
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("脚本输出中未找到 JSON：\n" + text);
  }
  return JSON.parse(text.slice(start, end + 1));
}

// 用 spawnSync 调用封装脚本，合并 stdout+stderr
function runScript(args, label) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync("node", args, { cwd: SCRIPTS_DIR, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(
      `脚本执行失败（exit ${r.status}）：\n${r.stdout || ""}${r.stderr || ""}`,
    );
  }
  const combined = `${r.stdout || ""}\n${r.stderr || ""}`;
  return extractJson(combined);
}
```

#### 4.2 `使用文档.md`

**必须包含：**

- 文件清单
- 前置条件
- 快速使用（3 步：编辑输入 → 运行 → 查看结果）
- **四步流程详解**（每步的输入参数表格 + 输出参数表格 + 实际命令）
- 完整运行示例
- 常见问题表格

#### 4.3 `package.json`

```json
{
  "type": "module"
}
```

### 步骤 5：告知用户使用方式

生成完成后，向用户说明：

- 文件生成位置
- 如何运行复测脚本（给出具体命令示例）
- 如何更换测试输入

## 命名规范

- 脚本名统一用 `retest.js`（若目标技能已有该文件则覆盖，因为用户调用本技能意味着要更新复测工具）
- 文档名统一用 `使用文档.md`
- 配置文件根据功能需要命名（如 `question.txt`、`input.json` 等）

## 重要约束

1. **禁止凭空推导**：必须基于当前对话的真实测试过程生成脚本
2. **禁止直接调用目标技能的 HTTP API**：复测脚本必须通过目标技能的封装脚本调用
3. **所有路径用绝对路径**：临时文件放在目标技能的 `scripts/temp/` 下
4. **沿用成熟范式**：spawnSync + 合并 stdout/stderr + extractJson，避免重复踩坑
5. **ESM 语法**：与目标技能 scripts 目录风格一致
6. **不判断技能是否已验证**：这是用户自己的责任，用户只会在测试成功后才调用本技能
