# 发布流程与配置参考

## config.json 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `sourceDir` | string | 私有技能目录的绝对路径（待发布的技能所在目录） |
| `targetDir` | string | 公开技能目录的绝对路径（发布目标） |
| `globalWhitelist` | string[] | 允许复制的**顶层**条目清单（文件名或文件夹名） |
| `hardBlacklist.dirsAnyLevel` | string[] | 任意层级命中即排除的目录名 |
| `hardBlacklist.filesAnyLevel` | string[] | 任意层级命中即排除的文件名 |
| `hardBlacklist.patterns` | string[] | 任意层级命中即排除的 glob 模式（支持 `*`） |
| `toolModules` | object | 工具模块判定规则（skill-laws 规范要求，本技能无工具模块） |

### 判定规则

对每个技能目录，遍历其顶层条目，按下述顺序判定：

1. 命中硬黑名单 -> 跳过（记录原因"硬黑名单"）
2. 不在全局白名单 且 不在该技能的 `.publish-include` 中 -> 跳过（记录原因"不在白名单"）
3. 通过上述两关 -> 复制；递归进入子目录时，子条目再次套用硬黑名单（任意层级生效）

**关键点**：白名单只在顶层生效；硬黑名单在所有层级生效。这样 `scripts/`（白名单）会被复制，但 `scripts/node_modules/`（硬黑名单）在递归时被排除。

## .publish-include 文件

放在技能根目录下，用于声明该技能"额外"要包含的顶层条目（不在全局白名单中的合法文件/文件夹）。

### 格式

- 每行一个条目名（文件名或文件夹名，与顶层条目名一致）
- `#` 开头为注释
- 空行忽略
- 该文件本身在硬黑名单中，不会被复制到目标目录

### 示例

某技能目录结构：

```
wechat-publisher-yashu/
  SKILL.md
  scripts/
  references/
  themes/          # 全局白名单未包含
  cover.jpg        # 全局白名单未包含
  prompt/          # 全局白名单未包含
  license-key.txt  # 硬黑名单
  scripts-backup/  # 硬黑名单
```

若 `themes`、`cover.jpg`、`prompt` 需要发布，在该技能目录下创建 `.publish-include`：

```
# 额外发布的顶层条目
themes
cover.jpg
prompt
```

运行发布后，`themes`、`cover.jpg`、`prompt` 会被复制，`license-key.txt`、`scripts-backup` 因硬黑名单被跳过。

## 为什么 config.json 不在白名单

`config.json` 含用户私有路径（`sourceDir`、`targetDir`），属于个人配置，不应公开。全局白名单只含 `config.default.json`（模板）。发布到公开目录后，使用者需自行复制 `config.default.json` 为 `config.json` 并填写自己的路径。

## 完整示例输出

```
== 技能: coze-low-code-caller-yashu ==
源目录: d:/skill/private-skills/.trae/skills/coze-low-code-caller-yashu
目标目录: D:/software/skills/skills/coze-low-code-caller-yashu

已复制 (15):
  + SKILL.md
  + .gitignore
  + scripts/check_status.js
  + scripts/check_workflow_result.js
  + scripts/clear_temp.js
  + scripts/create_session.js
  + scripts/get_messages.js
  + scripts/get_workflow_info.js
  + scripts/package-lock.json
  + scripts/package.json
  + scripts/run_workflow.js
  + scripts/send_message.js
  + scripts/upload_file.js
  + references/bot-api.md
  + references/workflow-api.md

已跳过 (4):
  - config                  [原因: 不在白名单]
  - license-key.txt         [原因: 硬黑名单]
  - scripts-backup          [原因: 硬黑名单]
  - 测试用例.md             [原因: 不在白名单]

结果: 成功

总计: 1 个技能, 0 个失败
```
