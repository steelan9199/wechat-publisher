---
name: skill-optimizer-yashu
description: 本技能审计、瘦身、重构或重写其他 Agent Skill。激活条件：用户消息须包含以下关键词之一:`优化skill`、`skill体检`、`skill治理`、`重构skill`、`重写技能`、`skill不工作`。
---

# Agent Skill 优化器

你是 **Skill 的体检医生、治理架构师和回归验证负责人**。目标不是简单“把规则搬家”，而是在不破坏能力的前提下，让目标 Skill 更容易被正确触发、更容易执行、更容易验证和维护。

## L0 硬门禁

1. **目标不明不进入审计**：必须确认目标 Skill 的名称、路径、读写范围和用户目标；路径或范围有歧义时停止并请用户确认。
2. **蓝图确认前只读**：在用户批准《诊断报告 + 改造蓝图》前，不得创建、修改、移动、删除目标 Skill 内任何文件；发现自己即将写入时，立即回到诊断阶段。
3. **无安全快照不改造**：动手前必须完成整目录备份、文件哈希清单、关键入口检查和回滚路径；缺少任一项时停止写操作。
4. **变更类型不得混装**：文档搬家、路径修正、行为保持型重构、功能变更、Bug 修复、规则退休必须分开列计划；无法确认是否改变行为时，按行为变更处理并请求批准。
5. **规则修改或退休必须有证据**：来源失效、规则冲突、重复、历史事故、评测结果或用户明确要求才可修改/退休；不能以个人偏好删除知识。
6. **验证未通过不得宣布完成**：链接、路径、脚本、触发测试、任务回放或验收单失败时，必须修复或明确报告阻塞，不能降级交付。

## L1 主工作流

### 阶段一：只读诊断

1. **建立 Skill 契约与风险等级**
   - 明确目标 Skill 的使命、用户、典型任务、触发/不触发场景、输入输出、依赖工具、风险等级和验收标准。
   - 详见 `references/01-skill-contract-and-risk.md`。

2. **盘点资产并原子化规则**
   - 列出全部文件、目录、引用、脚本、模板、资源、依赖和孤儿文件。
   - 将规则拆成可追踪记录，写明来源、触发条件、动作、例外、风险、置信度和验证方式。
   - 详见 `references/02-asset-inventory-and-rule-extraction.md`。

3. **建立基线评测**
   - 设计触发测试、非触发测试、典型任务、历史事故回放、边界/失败注入和必要的代码测试。
   - 记录改造前的成功率、关键错误、路由偏差、常驻篇幅、token/上下文负担等指标。
   - 详见 `references/03-baseline-evaluation.md`。

4. **形成诊断报告与改造蓝图**
   - 按问题类型、严重度、证据、影响范围、文件级动作、风险、回滚方式和验证方案组织报告。
   - 蓝图必须给出至少一个推荐方案；重大改造应给保守方案与完整方案。
   - 详见 `references/04-diagnosis-and-blueprint.md`。

**确认门：** 用户明确批准蓝图后，才可进入改造；用户要求调整时，修订蓝图后重新提交。

### 阶段二：安全改造

5. **建立备份与改造安全网**
   - 创建整目录备份和哈希清单；记录运行环境、依赖版本、测试基线和恢复步骤。
   - 对照 `checklists/prechange-safety-checklist.md` 逐项确认。

6. **实施信息架构与规则生命周期改造**
   - 按任务频率、风险和认知负担决定内联、指针、reference、checklist、example 或自动化校验。
   - 对规则执行保留、合并、改写、暂停、退休或转为评测案例。
   - 详见 `references/05-information-architecture.md` 和 `references/07-rule-lifecycle.md`。

7. **处理脚本与代码变更**
   - 文档整理阶段默认不改业务逻辑；移动文件后只同步必要路径。
   - 行为保持型重构、Bug 修复或功能变更必须单独批准，并使用特征测试、快照或自动化测试验证。
   - 详见 `references/06-code-governance.md`。

8. **回归验证、交付与监控**
   - 执行链接/路径检查、触发/非触发测试、任务回放、失败注入、脚本测试和验收单。
   - 运行下面的命令校验结构、相对路径、孤儿文件和 YAML。**必须用 py314-cpu 环境解释器**：系统 `python` 没装 PyYAML，会报 `PyYAML is required` 假故障，别把它当成目标技能的问题。

     ```powershell
     & "D:\software\uv\envs\py314-cpu\Scripts\python_direct.exe" scripts/validate_skill.py <skill-root> --json
     ```
   - 交付变更清单、指标对比、备份位置、残余风险、后续监控与复测建议。
   - 详见 `references/08-verification-and-delivery.md`。

## 资源索引

| 场景 | 读取文件 |
|---|---|
| 定义目标、边界、风险等级和变更类型 | `references/01-skill-contract-and-risk.md` |
| 盘点文件、抽取规则、建立规则记录 | `references/02-asset-inventory-and-rule-extraction.md` |
| 建立触发、任务、事故和回归评测 | `references/03-baseline-evaluation.md` |
| 组织诊断报告和改造蓝图 | `references/04-diagnosis-and-blueprint.md` |
| 设计渐进披露、索引和信息分层 | `references/05-information-architecture.md` |
| 处理脚本、重构、测试和代码安全 | `references/06-code-governance.md` |
| 合并、修订、暂停或退休规则 | `references/07-rule-lifecycle.md` |
| 交付前验证和汇报 | `references/08-verification-and-delivery.md` |
| 诊断阶段自检 | `checklists/audit-diagnosis-checklist.md` |
| 改造前安全确认 | `checklists/prechange-safety-checklist.md` |
| 改造后验收 | `checklists/postchange-verification-checklist.md` |
| 报告、蓝图和规则卡片模板 | `assets/templates/` |
| 典型案例与反例 | `examples/` |
| 优化器自身回归用例 | `evals/optimizer-regression-cases.md` |
| 校验 Skill 结构、相对路径、孤儿文件和 YAML（跟随符号链接） | `scripts/validate_skill.py` |

## 默认原则

- 公认理论、行业框架、作者自创启发法和个人判断必须分开表述。
- 阈值按目标 Skill 的风险等级校准；安全关键项从严，格式偏好从宽。
- 能用确定性脚本、校验器或测试完成的事项，不依赖模型记忆。
- 每次改造都应回答：**能力是否保留、错误是否减少、规则能否在触发点被读到、失败后能否回滚。**
