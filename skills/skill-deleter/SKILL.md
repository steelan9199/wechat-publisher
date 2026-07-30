---
name: "skill-deleter"
description: "从技能管理目录中删除一个技能文件夹。当用户说『删掉技能』或『删除技能』并提供要删除的技能名字时调用。"
---

# 技能删除器

本技能用于从本地技能管理目录中删除一个技能文件夹。

## 脚本说明

| 文件                                 | 说明                                               |
| ------------------------------------ | -------------------------------------------------- |
| `$SKILL_DIR/scripts/delete-skill.js` | 删除脚本（ES6 语法 + ES Module）                   |
| `$SKILL_DIR/scripts/package.json`    | npm 配置，声明 `"type": "module"` 以支持 ES Module |

> `$SKILL_DIR` 指代本技能所在目录（即包含 SKILL.md 的文件夹）。执行命令时必须替换为实际绝对路径，**不要**把它当作环境变量。

## 执行步骤

### 1. 解析技能名

从用户消息中解析出要删除的技能名字。技能名字是触发词后面的内容。

示例：

| 用户消息                                          | 解析出的技能名                           |
| ------------------------------------------------- | ---------------------------------------- |
| `删掉技能 phone-screenshot-yashu`                 | `phone-screenshot-yashu`                 |
| `删除技能 phone-screenshot-yashu 和 image-viewer` | `phone-screenshot-yashu`、`image-viewer` |

### 2. 环境检查

运行 `node -v` 检查 Node.js 是否已安装。若未安装，提示用户安装 Node.js（建议 18+）后结束任务。

### 3. 运行删除脚本

将 `$SKILL_DIR` 替换为本技能的实际绝对路径，执行：

```bash
node "$SKILL_DIR/scripts/delete-skill.js" "<技能名1>" "<技能名2>" ...
```

### 4. 读取脚本输出并反馈用户

脚本会输出以下信息，AI 需据此向用户反馈：

- **找到的匹配文件夹列表**：让用户确认删除范围
- **删除结果**：每个文件夹是成功还是失败
- **汇总统计**：成功/失败数量

### 5. 结束

任务结束。若有失败项，将失败原因一并告知用户。

## 匹配规则

脚本在技能目录的第一层级子文件夹中查找，匹配规则如下（不区分大小写）：

| 规则             | 说明                                                | 示例（技能名为 `phone-screenshot-yashu`）                             |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| **完全匹配**     | 文件夹名与技能名完全相同                            | `phone-screenshot-yashu`                                              |
| **数字后缀匹配** | 文件夹名为「技能名 + 短横线 + 数字」                | `phone-screenshot-yashu-2`、`phone-screenshot-yashu-3`                |
| **暂存匹配**     | 文件夹名为「.技能名.staged-<uuid>」的隐藏暂存文件夹 | `.phone-screenshot-yashu.staged-2cd867ba-501b-4876-88f9-2f7839991110` |

> 数字后缀匹配用于处理技能管理软件安装同名技能时自动加上的序号；暂存匹配用于清理技能发布过程中产生的临时暂存副本。

## 脚本输出示例

成功删除时：

```
技能目录：C:\Users\Administrator\.skills-manager\skills
待删除技能：phone-screenshot-yashu

找到 2 个匹配的文件夹：
  - phone-screenshot-yashu
  - phone-screenshot-yashu-2

开始删除...

删除结果：
  [成功] phone-screenshot-yashu
  [成功] phone-screenshot-yashu-2

总计：2 个成功，0 个失败。
```

未找到匹配时：

```
技能目录：C:\Users\Administrator\.skills-manager\skills
待删除技能：some-skill

未找到任何匹配的技能文件夹。
```

## 重要说明

- 只能删除 `C:\Users\Administrator\.skills-manager\skills` 路径下的文件夹。
- 只搜索该路径下第一层级的子文件夹，不递归搜索子目录内部的文件夹。
- 绝不能删除该路径之外的任何文件夹。
- 文件夹名称与用户提供的技能名字进行匹配（不区分大小写）。
- 删除前脚本会先确认文件夹存在；如果不存在，不会尝试删除任何内容。
- 脚本对单个文件夹删除失败时会自动重试最多 3 次（每次间隔 500ms），以处理文件被其他进程占用的情况。
- 必须先安装 Node.js（建议 18+），脚本依赖内置的 `fs/promises` 模块，无需 `npm install` 安装额外依赖。
