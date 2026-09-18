# 足球（FOOTBALL）

## 1. 定位
蓝白足球皮肤，3 stage / 13 笔 path。截角二十面体正对一个五边形的正交投影：中心 1 个大蓝五边形 + 外围 5 个贴边裁切蓝月牙，白底为六边形留白。

## 2. 文件路径
- 脚本：`scripts/draw_football.js`
- 数据源：`scripts/_src/football/football_data.json`
- 生成器：`scripts/_src/football/gen_draw_football.py`、`build_football.py`
- 预览图：`outputs/football.png`

## 3. 执行命令
```powershell
cd <autojs 技能目录>
# 全跑
node scripts/run-task.js <qiu技能目录>/scripts/draw_football.js --args '{}'
# 只画中心五边形（stage 1）
node scripts/run-task.js <qiu技能目录>/scripts/draw_football.js --args '{\"stage\":1}'
# dryRun 预览
node scripts/run-task.js <qiu技能目录>/scripts/draw_football.js --args '{\"dryRun\":true}'
```

## 4. 参数
- `palette`: `{bg, border, pent}` 三槽改色
- `clear`/`bg`/`clearRounds`/`stage`/`from`/`to`/`maxMs`/`gap`/`dryRun` 同 tiger
- stage: 0=白底蓝边回画笔, 1=中心大五边形, 2=外围5个贴边五边形

## 5. 默认配色
bg=white, border=blue, pent=blue

## 6. 回执
ok=1 成功 / 2 有 errors / 0 失败；missing 非空=缺标定。dryRun 时 paths=0，executedStages 里每 stage 预览笔数与 ms。

## 7. 题材坑
- 几何必须先算（截角二十面体顶点方向），凭感觉摆位置会偏 36°（见 SKILL §C 几何建模先行）
- 外围五边形中心在 radial=0.894r，R=110 让外圈超出圆盘 ~92px 被自然裁切，才有球面透视
- 中心五边形 R=160（≈0.3r），小了像浮在中间

## 8. 无效方案
- 灰色代替蓝色：对比不够，不像足球
- 6 个五边形均匀完整居中：像花/骰子，无透视
- 外围五边形不推到圆边：贴纸感，不像贴在球面上
