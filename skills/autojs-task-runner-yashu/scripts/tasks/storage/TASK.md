---
name: storage
description: "手机本地命名空间(storages)存取统一入口：op=get读/set存/remove删键/clear删整个命名空间，跨脚本持久。"
args: { "op": "string*", "name": "string*", "key": "string?", "value": "any?" }
---

# storage · 手机本地数据存储（storages 统一入口）

## 使用场景
- 保存脚本运行中间结果 / 配置 / 清单到手机，跨脚本、跨任务持久传递数据；
- 读回之前保存的数据，或清理键/命名空间。

## 什么时候不该用
- 存敏感数据（密码/token/隐私）→ 不适合，storages 脚本间共享、不加密，需加密可先自行封装再存。
- 一次性临时数据、用完即弃 → 无需落存储，脚本内变量即可。

## 参数细节与坑
- `op` 必填：`get` / `set` / `remove` / `clear`。
  - `get`：读键，命中 `{ok:1, found:1, value, type}`，未命中 `{ok:1, found:0}`（不算错误）。
  - `set`：存键值，`value` 必填，支持 number/boolean/string/Array/Object，返回 `{ok:1, size:N}`。
  - `remove`：删单个键，幂等返回 `{ok:1}`。
  - `clear`：删整个命名空间，幂等返回 `{ok:1}`（此时不需要 `key`）。
- `name` 必填字符串，命名空间（类似"库名"），不同 name 数据独立；建议具体命名避免误删他脚本数据。
- `key` get/set/remove 时必填，支持中文。
- `value` set 时必填；**不支持 null/undefined**（存 null 读回 undefined，与"不存在"无法区分），空态用 `""`/`0`。
- `set` 会回读比对，不一致报 `{ok:0, err:"写入后回读不一致..."}`，不静默假成功。
- `get` 的 value 若较大（大数组/对象），回执偏大，注意控制体量。

## 真机实测结论（勿再猜）
- `storages.create(name)` 返回 Storage 实例；同名 create 返回数据共享副本（非引用）。
- `sto.put(key, value)` 同步生效，put 后立即 get 可读到；数据跨脚本/跨任务持久。
- `storages.remove(name)` 返回值恒为 `null`（非文档所称 boolean），删除动作本身已验证生效，故不依赖返回值判断。
- `sto.size` 是**属性**（number），不是方法；`sto.contains(key)` 返回 Storage 对象本身，不能判断键是否存在——判断用 `sto.get(key) !== undefined`。

## 示例调用
```bash
# 保存
node run-task.js storage --args '{"op":"set","name":"app-config","key":"theme","value":"dark"}'
# → {"ok":1,"size":1}

# 读取
node run-task.js storage --args '{"op":"get","name":"app-config","key":"theme"}'
# → {"ok":1,"found":1,"value":"dark","type":"string"}

# 删单个键
node run-task.js storage --args '{"op":"remove","name":"app-config","key":"theme"}'
# → {"ok":1}

# 删整个命名空间
node run-task.js storage --args '{"op":"clear","name":"app-config"}'
# → {"ok":1}
```

## 红线提醒
- 命名空间脚本间共享且不加密，**不要存敏感数据**。
- `clear` 删整个命名空间不可逆，执行前确认 name 无误。
