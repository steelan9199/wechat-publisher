# skill-publish-auditor（技能发布前审核器）

在把一个 WorkBuddy 技能发布到网上**之前**，用它对技能目录跑一遍体检，自动揪出会导致发布翻车的问题。

## 它能查什么

- **隐私泄露**：私人截图 / 剪贴板 / 数据库 / 硬编码的局域网 IP / 密钥明文 / 写死的私人绝对路径
- **引用完整性**：SKILL.md 里引用的 `scripts/...`、`references/...`、`temp/...` 路径是否真实存在
- **运行产物残留**：`uploads/`、`temp/` 里混入了真实使用痕迹（截图、中转文件）
- **依赖与体积**：node_modules 体积、package.json 是否配套
- **合规**：是否缺 LICENSE / .gitignore / README
- **安全**：是否用了 `eval` / 子进程执行（需人工确认安全性）

结果分三级：**P0 阻断发布 / P1 建议必改 / P2 可选优化**。

## 用法

```bash
node scripts/audit.js <技能目录> [--json] [--verbose]
```

- `--json`：输出机器可读 JSON（适合接 CI）。
- 退出码：`0` = 无 P0；`1` = 有 P0（可当 CI 卡点）；`2` = 用法/路径错误。

例：

```bash
node scripts/audit.js ../autojs-task-runner-yashu --verbose
```

## 审核维度明细

见 `references/audit-checklist.md`。

## 与「发布技能」技能的关系

`skill-publish-yashu` 负责把私有技能按白名单复制到公开目录（发布动作）；
本技能负责发布**之前**的体检。推荐流程：先跑本审核 → 修掉 P0/P1 → 再用发布技能复制出去。
