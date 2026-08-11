---
title: 引擎 self 识别与 isSelf 判定
summary: 在 AutoJS6 脚本里判断"某个运行中的引擎是不是当前正在执行代码的自己"的正确方法
read_when:
  - 写/改任意需要"标出自己"或"保护自身不被停止"的手机模板(list_running_scripts / stop_script_by_name 等)
  - 遇到 isSelf / 自保护 / 跳过自身 / eng === myEngine 相关逻辑
---

# 引擎 self 识别与 isSelf 判定

## 一句话结论
判断"某条运行中的引擎是不是当前正在执行这段代码的自己",**必须用双要素匹配:id 相等 且 文件名(基名)相等**。**绝不能用 `eng === myEngine` 引用相等。**

## 错在哪里:`eng === myEngine`
模板里最直觉的写法:
```js
var myEngine = engines.myEngine();
var isSelf = (eng === myEngine);   // ❌ 中继下发场景下恒为 false
```
**为什么错**:本技能里所有任务脚本都不是手机端直接双击运行,而是 PC 中继 → 手机常驻客户端(`autojs-task-phone-client.js`)→ `engines.execScriptFile(临时文件)` 下发给"子引擎"执行。在这个路径下,`engines.all()` 返回的引擎对象集合 与 `engines.myEngine()` 返回的当前引擎对象,**不是同一个引用实例**(AutoJs6 Rhino 已知怪癖)。于是哪怕 `eng` 逻辑上就是"自己",`===` 也判不相等,`isSelf` 永远 `false`。

已踩坑证据:实测 `list_running_scripts` 回执里,真正在跑任务的临时包 `run_<ts>.js`(id 150)被标成 `isSelf:false`——它就是自己却没被认出。

## 对的方法:双要素匹配
```js
// 取"自己"的判据(循环外只算一次)
var myEngine = engines.myEngine();
var myId = (typeof myEngine.id === "number" || typeof myEngine.id === "string") ? myEngine.id : null;
var myName = "";
try { var s = myEngine.getSource(); if (s) myName = files.getName(s); }
catch (e) { try { var s2 = myEngine.source; if (s2) myName = files.getName(s2); } catch (e2) {} }

// 遍历 engines.all(),逐条比对
for (...) {
  var engId = safeId(eng);                       // 同模板 safeId():只收 number/非空 string
  var engName = "";
  try { var es = eng.getSource(); if (es) engName = files.getName(es); } catch (e) {}
  var isSelf = (myId !== null && engId !== null && engId === myId)
            && (myName !== "" && engName !== "" && engName === myName);
}
```
- **要素 1 · id 相等**:`eng.id === myEngine.id`。id 是引擎唯一编号,最稳。`safeId` 只收 `number` 或 非空 `string`,其余当 `null`(不参与匹配)。
- **要素 2 · 文件名(基名)相等**:`files.getName(eng.getSource()) === files.getName(myEngine.getSource())`。`getSource()` 抛错时用 `.source` 属性兜底。

两要素**同时成立**才认作"自己"。文件名作为第二重保险,可防 id 复用/碰撞导致的误判。

## 关键陷阱:文件名是"实际执行路径的基名",不是模板逻辑名
`getSource()` 返回的是脚本**实际被执行的文件路径**的基名,例如:
- 常驻客户端:`$remote/1.js`(经中继 `$remote` 通道下发,被命名成 `1.js`)
- 任务模板:`/sdcard/脚本/tap_point.js`(PC 经 /run 下发后,手机端写到 AutoJS 默认脚本文件夹 `/sdcard/脚本/`,文件名即模板原名)

`files.getName()` 取到的基名是 `1.js` / `tap_point.js`,**不是** `autojs-task-phone-client.js` / `list_running_scripts.js`。(内联 code 下发的脚本基名为固定名 `autojs_inline_task.js`,也不等于模板名。)

这没问题——只要 `myEngine` 和每个 `eng` 用**同一套取法**(`getSource()` → `files.getName()`),两边拿到的是同一个基名,比较自然一致。**无需、也不能**依赖"模板逻辑名"来判断自己。

## 防御式写法要点
- `id` 类型不保证:可能是 `number` 也可能是 `string`(某些 AutoJs6 版本),比较前统一判空、不混类型;
- `getSource()` 可能抛异常 → `try/catch` 并用 `.source` 兜底;
- 文件名取不到(`""`)时**不参与匹配**(置为不匹配),避免空串误判;
- `engines.all()` 取不到当空数组(`if (!all) all = []`),整体抛错回 `{ok:0, err:"..."}`。

## 技能内已采用/可参考
- `scripts/autojs-task-phone-client.js` 第 39–52 行:自身巡检即 `if (eng.id === myEngine.id)` 跳过自己(id 单要素,已验证可用)。
- `scripts/tasks/list_running_scripts/list_running_scripts.js`:已采用上述 id+文件名 双要素(见第 49 行附近 myId/myName 计算、第 65 行附近 isSelf 计算)。
- `scripts/tasks/stop_script_by_name/stop_script_by_name.js`:自保护(默认 `includeSelf=false` 时跳过自身)已采用双要素(见第 42 行附近 myId/myName 计算、第 55 行附近自保护判断);文件名任一侧取不到时退化为仅按 id 判定(更保守,宁错保不误杀自己),勿用 `===`。
