# 04 · JEV 慢循环接入

> ⛔ **下线公告（2026-09-25 老板拍板："JEV 大模型效果并不好，删了吧，我们不要了"）**：
> 工程 **0.8.0** 起 `ENABLE_JEV=false`，慢循环线程不再启动、**零网络请求**；决策全部回到本地
> （`aim.js` 基线几何 + `escapeReflex` 逃命反射，见 03 §三与 00 M15）。代码留档不删
> （`lib/jev.js` / 慢循环 / QUESTIONS 全部休眠），要恢复改回 true 即可。
> **本文档全文留档**：判断表、护栏、成本实测（drive 首局 224 次、mean 385ms、~3.2k tokens/次）对将来重启有参考价值。

> **什么时候读**：接 JEV、改判断、调阈值、JEV 超时 / 答得离谱 / 成本失控。
> **红线**：JEV **只吃结构化 state，永远不吃画面**。识别在本地做完，喂进去的必须是 `02` 定义的 JSON。
> **前置**：设计判断本身时，先加载 `typesafe-jev-decision-yashu` 技能，按它的执行顺序走；它产出的判断主表与阈值契约表**回填到本文件**。

---

## 一、接口事实（已核对官方文档 `docs.typesafe.ai/api.md`，改动须重核）

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <TYPESAFE_API_KEY>
Content-Type: application/json
```

请求体：

```json
{
  "state": { "...": "见 §二" },
  "model": "jev-latest",
  "questions": {
    "<question_id>": { "type": "choice|noul|score", "instructions": "...", "criteria": {} }
  }
}
```

响应体：

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "<question_id>": { "type": "...", "choice": "...", "probabilities": {}, "confidence": 0.81 }
  },
  "usage": { "input_tokens": 296, "output_tokens": 20 }
}
```

三种原语：`choice`（选一个，回 `choice` + `probabilities` + `confidence`）/ `noul`（是/否，回 0–1 的 `noul`）/ `score`（有序档位，回加权 `score` + `legend`）。
错误码：`401` 鉴权、`422` 请求体校验失败、`429` 限流、`529` 过载。**限流与过载要退避重试**。

> ⚠️ 官方文档里**没有**独立的 latency/limits 页面，延迟只能靠实测填 §六。**不许编数字。**

---

## 二、state 怎么裁（从 `02` 的 schema 精简）

**裁剪原则**：JEV 只需要它做判断必需的字段。塞太多球 = 注意力被稀释 + token 成本上升。

| 保留 | 理由 |
|---|---|
| `self.r` | 体型基准，判断大小的分母 |
| `self.n`（2026-09-25 加） | 当前球数：`use_split` 的必需输入（16 封顶机制，见 §三） |
| `balls`（≤ `JEV_MAX_BALLS`，默认 8） | 只保留威胁优先、其次最近的 |
| 每球的 `dx/dy`、`dist`、`size_ratio`、`edible`、`threat` | 决策必需 |
| `bounds`（= 自己边缘到场地边界的四向距离，0=贴死） | 贴边 / 被围判断；**此语义必须让模型知道**（已写进 question 正文） |
| `recent` | 判断上一轮动作是否奏效 |
| `prev`（2026-09-25 新增） | **运动信息**：慢循环上一拍的球位置快照（`dx/dy/dist/r/size_ratio` + `age_ms`），由 `main.js` 慢循环缓存产出（`JEV_PREV_MAX_AGE_MS=5000` 超龄不发）。为什么需要：感知层 `vx/vy` 是**死字段**（`vision.js` 恒 null），单帧静态几何分不清"接近/远离"，`is_pursued` 问"是否正在逼近"没有 prev 就**不可答**（typesafe-jev-decision §3.3 复核结论：缺失字段 → 代码补数据）。球的对应关系交给模型判，不写易错的跨帧匹配代码 |
| `stats.frame_ms` | 便于诊断（可保留，成本很低） |

**丢掉**：`ts`、`frame`、`vx/vy`（死字段，运动信息改由 `prev` 承担，2026-09-25）、超过上限的球、任何截图数据。

---

## 三、判断主表（2026-09-25 经 `typesafe-jev-decision-yashu` 复核**定稿**）

| ID | 一句话问题 | 原语 | state 路径 | 合成方式（§3.5.2） | 备注 |
|---|---|---|---|---|---|
| `posture` | 当前该采取哪种全局姿态 | choice | `self` `balls[]` `bounds` | choice 取 argmax，**不设阈值**；生效后写 `latestPolicy` → `POLICY_WEIGHTS` | 字段语义已写进正文 |
| `is_pursued` | 是否有更大的球正在向我逼近 | noul | `balls[].dist` `prev.balls[]` `prev.age_ms` | 硬规则：`noul ≥ 阈值` → 覆盖 retreat | **需新增 state 字段 `prev`**（已实现，见 §二） |
| `is_cornered` | 我是否被逼到边角且去路被封 | noul | `bounds.*` `balls[].size_ratio/dist` | 硬规则：`noul ≥ 阈值` → 覆盖 retreat | `bounds` 语义已写进正文 |
| `risk_appetite` | 现在应该冒进到什么程度 | score | `self.r` `balls[].threat/dist` | **保留独立信号**：记录期只采不用；生效期再映射权重强度 | 不设阈值 |

**Gate 0 划走（不进判断表）**：`target_rank`（最该追的球排第几）——快循环 `lib/aim.js` 已**确定性**
选球（`eat_best`，value = r/gap），存活优先的目标下 JEV 不参与选球。原初稿此行删除（2026-09-25）。

**全权驾驶三问（2026-09-25 老板拍板新增，`JEV_MODE="drive"` 直接生效）**：

| ID | 一句话问题 | 原语 | state 路径 | 合成方式 | 备注 |
|---|---|---|---|---|---|
| `steer` | 摇杆往哪开（8 方向罗盘 + maintain） | choice | `balls[]` `bounds` `prev` | **直接生效**：方向锁存到下一拍（`JEV_DRIVE_TTL_MS=6000` 超龄回基线） | 红线 1 改写：快循环不调用大模型，但**方向决定权移交 JEV** |
| `use_split` | 该不该分身 | choice | `self.n` `balls[].threat/dist` | 直接生效：边触发按一次；`self.n>=16` 硬护栏 | 游戏机制（老板口述）：分身**无冷却**，1→2→4→8→16 封顶 |
| `use_spit` | 该不该吐孢 | choice | `self.r` `balls[]` | 直接生效：边触发按一次 | 朝当前朝向喷质量，减重提速；喷出物可能喂大威胁 |

**模式开关 `CFG.JEV_MODE`**：`record`（纯观察采数期）/ `drive`（驾驶三问生效，阈值类继续记录）/
`full`（全生效，需阈值已标定——`assertCalibrated` 拒绝未标定的 full）。drive 能直接生效的方法论
依据：**choice 选最优不设阈值**（typesafe-ai「Compose and verify」），不产生"拿假参数跑"。

**硬护栏（本地否决权；①—⑤ 蓝图老板确认，⑥ 2026-09-25 老板拍板新增）**：①贴脸死球最小偏转（威胁球
`dist < self.r×JEV_IMMINENT_DIST_FACTOR(1.2)` 且 JEV 方向指向它 ⇒ 叠加远离分量）②贴死边界掐轴向分量
（`bounds <= EDGE_MARGIN`）③方向被掐光 ⇒ 回退本地基线向量 ④指令过期（TTL）回基线
⑤JEV 连续失败 3 次切纯基线（§五降级链不变）
⑥**逃命分身反射**（`main.js escapeReflex`，0.7.2 引入 / 0.7.3 两键齐发，**优先级最高、压过 drive 方向与基线**）：
最贴威胁球表面间距 `gap = dist-(self.r+b.r) < self.r×SPLIT_REFLEX_GAP_FACTOR(0.5)` ⇒ 方向掰向背离威胁、
朝向背对威胁后**分身+吐孢同拍齐按**（`SPLIT_REFLEX_COOLDOWN_MS=2000` 冷却；机制依据 00 M15：全是机器人、
追不上弹射；不做体积门控——00 M10 修订：大部分开局即可分）。
按键为**边触发**（一条指令只按一次，慢拍 1.5s 天然限频，另有 `CLICK_MAX_PER_SEC` 速率红线兜底）。

> **2026-09-25 目标口径二次变更（老板）**：**主动吃球长大是本局的意义，不被吃掉是前提**——光活着不吃球没有意义。
> steer/use_split/use_spit 三问正文已重写（吃球目标 + 00 M15 机器人情报）；决策层由此从"纯保命"转向"敢吃 + 反射保命"。

**复核改了什么（初稿 → 定稿）**：

1. `target_rank` 划走（理由如上）。
2. `is_pursued` 原措辞问"持续朝自己移动"但 state 无运动数据（`vx/vy` 死字段）⇒ **不可答**；
   新增 `prev` 快照（§二），措辞改为两拍对比 + prev 缺失/超龄时的静态退化口径。
3. 全部 4 条正文重写：**自足**（不依赖外部上下文）、字段语义写进正文（模型不知道 `bounds` 是
   "自己到边界的距离"）、**存活优先**写进 `posture`/`risk_appetite`（老板 2026-09-25 目标口径）。
4. `translate()`/`call()` 防御加固：answers 非对象 → 回 patrol；200 响应缺 answers → 按服务故障降级（§五）。

**`posture` 的候选值**（与 `03` §四 的快循环行为一一对应；label ID 是代码 key，不许改）：

```
chase     追击可吃目标
retreat   优先脱离威胁
patrol    保守游走，不主动冒险
hug_edge  主动贴边找小目标
```

**措辞注意**（来自 v6 §3.4）：question 正文要**自足**、不出现 ID；引用嵌套路径时**保留反引号字符**；label ID 用英文（要进代码当 key）。

---

## 四、阈值契约表

| 判断 | 阈值 | 基线数据（来源 + 条数） | 两类错误代价（误放 / 误拦） | 临界区动作 |
|---|---|---|---|---|
| `is_pursued` | `placeholder`（`THRESHOLDS.PLACEHOLDER=true`） | 无基线，记录模式采集中 | 误放"没被追"→ 被吃，**代价高** / 误拦"被追"→ 保守，代价低 | 0.4–0.6 → 一律按"被追"处理（保守优先） |
| `is_cornered` | `placeholder`（同上） | 无基线，记录模式采集中 | 误放"没被困"→ 撞死 / 误拦"被困"→ 空跑 | 临界区 → 触发 `retreat` |
| `risk_appetite` | 无阈值（score 直接映射，**暂不消费**） | — | 偏激进 → 死得快 / 偏保守 → 吃不到分 | — |

**模式与部署口径（工程 0.7.0）**：`CFG.JEV_MODE` 三态——`record` 只记录（照常调用+落 `ev=jev`
日志，不写任何策略，快循环行为=纯基线）；`drive` = **当前部署口径**：`steer`/`use_split`/`use_spit`
直接生效（HUD 同步显示指令），阈值类判断（posture/is_pursued/is_cornered）继续只记录；
`full` 在阈值回填后再开。守卫：`PLACEHOLDER=true` 时 `full` 被 `assertCalibrated` 拒绝启动。

**标定方案（数字不要现在编）**：

1. 记录模式跑 N 局（建议 ≥3 局，覆盖速死局与长活局），采每拍 `raw`（noul/confidence/probabilities）与 `snap`。
2. **配对真实结果**：`is_pursued` ↔ 该拍之后 threat 球是否真贴近（`snap.dmin_thr` 骤降或判死）；
   `is_cornered` ↔ 是否贴边死。配对规则在首局数据落地后细化。
3. 画 **confidence-vs-accuracy 曲线**取拐点作阈值；临界区一律向"保守"偏。
4. 回填本表「阈值/基线数据」两列 → `config.js` 改真值并把 `PLACEHOLDER` 改 false →
   切 `JEV_RECORD_ONLY=false` 生效，与基线对照（验收口径 = **存活时长**，先定门槛再跑）。

**临界区一律向"保守"偏**——这是实时生存类任务的通用取向：被吃是终局，保守只是少得分。

> **confidence 与 probability 不要混用**：阈值判定用 `noul` 值 / `confidence`；加权特征才用 `probabilities`。
> **Noul≈0.5 不是"中等程度"**，是"是/否等概率"——这正是临界区要保守处理的原因。

---

## 五、调用与降级（AutoJS 侧）

```javascript
// 子线程内执行，主循环不等它
function callJev(stateObj) {
  var res = http.postJson(JEV_ENDPOINT, payload, {
    headers: { "Authorization": "Bearer " + getKey(), "Content-Type": "application/json" },
    timeout: JEV_TIMEOUT_MS
  });
  if (res.statusCode !== 200) { return null; }   // 交给降级
  return res.body.json();
}
```

**降级链（必须实现，不许裸奔）**：

| 情况 | 动作 |
|---|---|
| 超时 / `429` / `529` | 退避重试 1 次；仍失败 → **沿用上一次策略** |
| 连续 `K` 次失败 | 切到**纯基线模式**（不调 JEV），并在日志里标记 |
| `401` / `422` | **不重试**（是配置或代码问题）→ 立即停止并上报，`422` 要打印校验信息 |
| 解析不出预期字段 | 当作服务故障，走降级，**不要 try 到一半继续用半个结果** |

**策略有效期**：一个策略默认生效 `POLICY_TTL_MS`；超时未刷新则退回基线（防止 JEV 长时间无声失效却还在被沿用）。

---

## 六、成本与延迟预算（先实测，再填）

| 项 | 值 | 怎么得 |
|---|---|---|
| 单次请求端到端耗时 | **mean 385 ms / p50 361 / max 1194**（2026-09-25 drive 首局 224 次实测，05 §4.6；连通性测试的 1477 ms 属冷启动单样本，不代表稳态） | 真机实测，记 20 次取中位数与 p95 |
| 官方宣称模型侧延迟 | 70–500ms（常见 ~100ms） | 来自官方/社区资料，**仅作参考** |
| 单次 token 用量 | **~2.9–3.0k in + 243 out**（drive 首局实测：8 球 + prev + 7 问；⚠️ 比本表原估 1300–1600 高约一倍） | 从响应 `usage` 读 |
| 单局调用次数 | **512 s 局实测 224 次**（实际节拍 ≈2.3 s/次 = `SLOW_TICK_MS` 1500 + 端到端延迟 + 循环开销） | 记录模式日志统计 |
| 单局成本 | **224 × ~3.2k ≈ 0.72 M tokens/局**（单价按 TypeSafe 计价折算） | 次数 × 单次 token × 单价 |
| 慢循环节拍 `SLOW_TICK_MS` | 1500（与实测延迟同量级 ⇒ 子线程顺序调用不堆积；`POLICY_TTL_MS=6000`） | 已验证：512 s 局 224 次零堆积、零失败 |

**触发方式（推荐组合，先做固定节拍）**：

1. **固定节拍**：每 `SLOW_TICK_MS` 一次。
2. **事件触发**（阶段 3 后期再加）：威胁数量突变 / 贴边 / 上一策略失效。

**预算红线**：单局成本超过 `placeholder` 时，先降节拍、再减 `JEV_MAX_BALLS`、最后减少判断条数——**按这个顺序**，不要一上来就砍判断。
