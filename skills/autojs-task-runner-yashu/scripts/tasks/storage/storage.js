/**
 * storage.js - 手机本地命名空间数据存储（storages 模块）统一入口
 *
 * 输入（任务单注入 __TASK_ARGS_PATH，按单文件 scripts-from-computer/data/task-args/<taskId>.json）:
 *   op    {string} 必填  操作：get | set | remove | clear
 *   name  {string} 必填  存储命名空间（脚本间共享，建议具体命名，如 "project-publishing-schedule"）
 *   key   {string} get/set/remove 时必填  键名（支持中文）
 *   value {any}    set 时必填  要保存的值：number/boolean/string/Array/Object（自动 JSON 序列化）
 * 输出:
 *   get    命中 {ok:1, found:1, value:<原值>, type:"number|boolean|string|array|object"}
 *         未命中 {ok:1, found:0}   （键不存在不算错误）
 *   set    {ok:1, size:N}  N=写入后该命名空间键数量
 *   remove {ok:1}  （删单个键，幂等）
 *   clear  {ok:1}  （删整个命名空间，幂等）
 *   失败   {ok:0, err:"原因"}
 *
 * 真机实测结论（已逐条验证，勿猜）:
 *   - put 后立即 get 可读到（同步生效），数据跨脚本/跨任务持久保存
 *   - get 不存在的键返回 undefined（用 found 字段明确标记，不靠 value 判断）
 *   - 不支持存 null/undefined：存 null 后 get 返回 undefined，与"键不存在"无法区分（falsy 值 0/false/"" 正常）
 *   - storages.remove(name) 返回值恒为 null（非文档所称 boolean），删除动作本身生效，不可依赖返回值判断
 *   - Storage#size 是属性（number），不是方法；contains(key) 返回 Storage 对象本身，不能判断键是否存在
 * 语法: ES5 (var only)。单文件自包含。
 */

function readArgs() {
  try {
    if (typeof __TASK_ARGS_PATH !== "undefined" && __TASK_ARGS_PATH) {
      return JSON.parse(files.read(__TASK_ARGS_PATH));
    }
  } catch (e) {}
  return {};
}

function typeOf(v) {
  return Array.isArray(v) ? "array" : (typeof v === "object" ? "object" : typeof v);
}

var result = { ok: 0, err: "脚本未产出结果" };
try {
  var args = readArgs();
  var op = args.op;
  var name = args.name;
  var key = args.key;

  if (typeof name !== "string" || name === "") {
    result = { ok: 0, err: "缺少参数 name（必须是字符串，存储命名空间）" };
  } else if (op === "clear") {
    storages.remove(name);
    result = { ok: 1 };
  } else if (typeof key !== "string" || key === "") {
    result = { ok: 0, err: "op=" + op + " 缺少参数 key（必须是字符串，键名）" };
  } else if (op === "get") {
    var v = storages.create(name).get(key);
    if (typeof v === "undefined") {
      result = { ok: 1, found: 0 };
    } else {
      result = { ok: 1, found: 1, value: v, type: typeOf(v) };
    }
  } else if (op === "set") {
    if (typeof args.value === "undefined") {
      result = { ok: 0, err: "op=set 缺少参数 value（要保存的值；不支持 null/undefined，可用空字符串或 0 代替）" };
    } else {
      var sto = storages.create(name);
      sto.put(key, args.value);
      var back = sto.get(key);
      if (JSON.stringify(back) === JSON.stringify(args.value)) {
        result = { ok: 1, size: sto.size };
      } else {
        result = { ok: 0, err: "写入后回读不一致，回读: " + String(back).slice(0, 100) };
      }
    }
  } else if (op === "remove") {
    storages.create(name).remove(key);
    result = { ok: 1 };
  } else {
    result = { ok: 0, err: "不支持的 op=" + String(op) + "（可选 get/set/remove/clear）" };
  }
} catch (e) {
  result = { ok: 0, err: e.toString() };
}
events.on("exit", function () {
  events.broadcast.emit("autojs_result", JSON.stringify(result));
});
