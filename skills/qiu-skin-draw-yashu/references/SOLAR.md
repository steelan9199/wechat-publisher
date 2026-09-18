# draw_solar.js · 太阳系皮肤一键复现

> ## 📌 接口卡（AI 执行时**只读本节**，正文不读）
>
> **脚本禁忌**：`draw_solar.js` 约 32KB（坐标数据），**禁止 Read 进上下文**。只执行、只读回执 JSON。
>
> **位置**：脚本 `scripts/draw_solar.js` ｜ 数据链 `scripts/_src/solar/` ｜ 预览图 `outputs/solar.png`
>
> **执行**（先 cd 到 `autojs-mobile-automation-yashu` 技能目录）：
> ```bash
> D="C:/Users/Administrator/.workbuddy/skills/qiu-skin-draw-yashu/scripts/draw_solar.js"
> node scripts/run-task.js "$D" --args '{"stage":0}'      # 清空+深蓝底+橙边框，再依次 stage 1→6（全图约 70s 务必逐 stage）
> node scripts/run-task.js "$D" --args '{"dryRun":true}'  # 只算坐标不下笔，验存储与笔数
> ```
>
> **参数**：`palette{bg,border,sun_outer,sun_inner,mercury,earth,land,white,mars,jupiter,stripe,saturn,neptune}` 13 slot；`stage 0..6`；`from/to`；`clearRounds` 默认 2 **别设 1**；`bg/clear`；`maxMs 25000`；`gap 220`；`dryRun`。
>
> **stage**：0 背景边框(含清空) 1 太阳外圈 2 太阳内圈 3 水星/地球(斑块云朵) 4 火星/木星 5 木条纹/土星环 6 海王星/星星
>
> **回执**：`ok:1` 全成 / `ok:2` 有错看 `errors` / `ok:0` 缺标定看 `missing`+`hint`；`nextStage` 非 null = 停 stage 边界，下次按它续跑。
>
> **必知坑**：① 清空可能"成功"而实际没清（回执 `ok:1` 不报错）——只能看画板截图判断；② **地球蓝色=背景深蓝会隐形**——脚本已内置白点云朵+浅绿大陆斑块补救，改 palette 换地球色时务必同换 `land`/`white` 保对比。
>
> ---

1. **定位**：太阳 + 6 行星（水星/地球/火星/木星/土星/海王星）环绕，7 stage / 31 笔，深蓝太空+橙边框。
2. **数据**：零硬编码坐标，运行时查 `qiu-calib`/`qiu-board`/`qiu-brush-width`，缺测跑 `qiu-board-measure`/`qiu-brush-width-measure`/`qiu-calib`。
3. **归一化**：`uv=((x-cx)/r,(y-cy)/r)`，已还原与原稿 949 控制点逐点比对，最大误差 0.5px。
4. **全跑续跑**：`run-task.js <脚本> --args '{}' --wait 0` → `--status <taskId>` 拿 `nextStage` → `--args '{"from":N}'` 续跑。
5. **默认配色**：bg=蓝 border=橙 sun_outer=橙 sun_inner=黄 mercury=灰 earth=蓝 land=浅绿 white=白 mars=红 jupiter=橙 stripe=红 saturn=黄 neptune=浅蓝。
6. **题材专属坑**：同色隐形（见接口卡②）；外围行星推圆边被裁切造球面感（土星 0.88r/木星 0.84r）；土星环先球后环（环线穿球=前环）；木星条纹端头缩进 26px 防细笔露球缘；单 stage 最重 b3=10 笔 9.5s。
7. **无效方案**：无（一次成型）。
8. **改造**：改 `SOLAR.stages` 的 `uv` 即可。生成链 `_src/solar/`：`gen_draw_solar.py`(批次生成) → `batch/b1~b7.json`(原稿) → `build_solar.py`(归一化套模板出脚本) → `verify_solar.py`(还原比对)。改完重跑 build+verify+dryRun。

---

**版本 1.0（2026-09-18 首次沉淀）**：真机成功稿 7 批 31 笔归一化生成，949 点最大误差 0.5px；dryRun missing 空；真机逐 stage 0→6 完整重画一轮全部 `ok:1`、errors 空，复现稿与首稿视觉一致。
