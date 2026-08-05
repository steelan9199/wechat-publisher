# 打包流程与配置参考

## config.json 字段说明

| 字段                          | 类型     | 说明                                                        |
| ----------------------------- | -------- | ----------------------------------------------------------- |
| `defaultSkillsDir`            | string   | 传入"技能名"时的查找目录（传绝对路径时不用）                |
| `compressionLevel`            | number   | zlib 压缩级别 0-9，默认 6（0 最快不压缩，9 最慢压缩率最高） |
| `hardBlacklist.dirsAnyLevel`  | string[] | 任意层级命中即排除的目录名                                  |
| `hardBlacklist.filesAnyLevel` | string[] | 任意层级命中即排除的文件名                                  |
| `hardBlacklist.patterns`      | string[] | 任意层级命中即排除的 glob 模式（支持 `*`）                  |
| `toolModules`                 | object   | 工具模块判定规则（skill-laws 规范要求，本技能无工具模块）   |

### 必打包项（脚本内硬编码）

以下三个顶层条目无需在 `.pack-include.json` 中声明，自动打包：

| 条目          | 说明                                              |
| ------------- | ------------------------------------------------- |
| `SKILL.md`    | 技能说明文件（必备）                              |
| `scripts/`    | 脚本目录（递归打包，任意层级排除 `node_modules`） |
| `references/` | 参考文档目录                                      |

### 判定规则

对每个技能目录，遍历其顶层条目，按下述顺序判定（技能级配置最高优先，B 方案）：

**顶层条目判定**（按序）：

1. 命中该技能的 `.pack-include.json` blacklist -> 跳过（记录原因"技能黑名单(.pack-include.json)"）
2. 命中该技能的 `.pack-include.json` whitelist -> 直接放行（覆盖硬黑名单与必打包项限制）
3. 命中硬黑名单 -> 跳过（记录原因"硬黑名单"）
4. 不在必打包项（`SKILL.md`/`scripts`/`references`）-> 跳过（记录原因"不在白名单"）
5. 通过上述四关 -> 放行，进入递归

**递归子条目判定**（按序）：

1. 命中该技能的 `.pack-include.json` blacklist -> 跳过（记录原因"技能黑名单(.pack-include.json)"）
2. 命中硬黑名单 -> 跳过（记录原因"硬黑名单(任意层级)"）
3. 通过上述两关 -> 放行

**关键点**：技能 whitelist 只覆盖顶层条目本身被硬黑名单排除的情况；递归进入子目录后硬黑名单仍正常生效（whitelist 不豁免整个子树）。这样 `scripts/`（必打包）会被打包，但 `scripts/node_modules/`（硬黑名单）在递归时被排除；`<技能名>.skill`（已有包）也会被 `*.skill` 模式在顶层排除，防止自打包（除非被技能 whitelist 显式放行）。

## .pack-include.json 文件

放在技能根目录下，JSON 格式，同时支持**白名单**（声明额外要打包的顶层条目）和**黑名单**（声明要排除的条目，可作用于任意层级）。

### 格式

```json
{
  "whitelist": ["config", "themes"],
  "blacklist": ["scripts/draft.md", "*.log"]
}
```

- `whitelist`：数组，声明额外要打包的**顶层条目名**（仅顶层生效）
- `blacklist`：数组，声明要排除的条目，**任意层级生效**，支持两种形式：
  - **纯名称**（不含 `/`）：按名称任意层级匹配，与硬黑名单一致，支持 `*` 通配符
    - 如 `temp.js` 排除任意层级名为 `temp.js` 的文件；`*.log` 排除任意层级所有 `.log` 文件
  - **相对路径**（含 `/`）：按相对路径精确匹配，`*` 仅匹配非 `/` 字符（不跨目录）
    - 如 `scripts/draft.md` 仅排除该具体文件；`scripts/temp/*` 排除 `scripts/temp/` 下直接子项；`scripts/draft` 排除该目录及其下所有子路径
- 相对路径基准：技能根目录
- 该文件本身在硬黑名单中，不会被打入包

### 示例

某技能目录结构：

```
wechat-publisher-yashu/
  SKILL.md            # 必打包项
  scripts/            # 必打包项
  references/         # （本技能无此目录，可忽略）
  themes/             # 额外，需声明
  cover.jpg           # 额外，需声明
  prompt/             # 额外，需声明
  scripts/draft.md    # 必打包项内的草稿，需排除
  license-key.txt     # 硬黑名单
  scripts-backup/     # 硬黑名单
  wechat-publisher-yashu.skill  # 硬黑名单（防自打包）
```

若 `themes`、`cover.jpg`、`prompt` 需要打包，同时要排除 `scripts/draft.md` 草稿，在该技能目录下创建 `.pack-include.json`：

```json
{
  "whitelist": ["themes", "cover.jpg", "prompt"],
  "blacklist": ["scripts/draft.md"]
}
```

运行打包后，`themes`、`cover.jpg`、`prompt` 会被打入 `.skill`，`scripts/draft.md` 因技能黑名单被跳过，`license-key.txt`、`scripts-backup`、`wechat-publisher-yashu.skill` 因硬黑名单被跳过。

## manifest.json（包内自动生成）

打包时在 `.skill` 包内自动生成 `manifest.json`，记录文件清单与校验值，便于完整性校验。**不输出到技能目录**，只存在于包内。

### 结构

```json
{
  "skill": "coze-low-code-caller-yashu",
  "packedAt": "2026-08-01T04:00:00.000Z",
  "fileCount": 12,
  "files": [
    {
      "path": "SKILL.md",
      "sha256": "a1b2c3...",
      "size": 4567
    },
    {
      "path": "scripts/check_status.js",
      "sha256": "d4e5f6...",
      "size": 2345
    }
  ]
}
```

解压 `.skill` 后查看 `manifest.json` 可核对文件是否完整、是否被篡改。

## 为什么 config.json 不被打包

`config.json` 含用户私有配置（`defaultSkillsDir` 等），属于个人配置，不应随包分发。如需打包配置模板，可在 `.pack-include.json` 中声明 `config.default.json`。

## 完整示例输出

```
== 技能: coze-low-code-caller-yashu ==
源目录: d:/skill/private-skills/.trae/skills/coze-low-code-caller-yashu
打包产物: d:/skill/private-skills/.trae/skills/coze-low-code-caller-yashu/coze-low-code-caller-yashu.skill

已打包 (15):
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
  + manifest.json  [自动生成]

已跳过 (5):
  - config                          [原因: 不在白名单]
  - license-key.txt                 [原因: 硬黑名单]
  - scripts-backup                  [原因: 硬黑名单]
  - 测试用例.md                     [原因: 不在白名单]
  - coze-low-code-caller-yashu.skill [原因: 硬黑名单(任意层级)]

产物大小: 45678 字节
结果: 成功
```
