---
name: "error-friendly"
description: "优化代码错误提示，让普通用户能看懂问题和解决方法。Invoke when there's a technical error message that needs to be made user-friendly."
---

# Error-Friendly

优化代码中的错误提示，使普通用户（非技术人员）能够：
1. 看懂发生了什么问题
2. 知道应该怎么解决

## 原则

- **说人话**：避免技术术语（如 param.json、content 字段、object_string 等）
- **给出行动指引**：告诉用户具体该做什么
- **保持简洁**：一行能说清的不要用两句
- **语气友好**：用「请」「比如」等温和表达

## 使用场景

当你发现代码中有 `console.error` 或 `throw new Error` 时，检查是否：
- 包含技术名词（文件名、变量名、API 名）
- 没有告诉用户下一步该做什么
- 语气过于冰冷

## 修改示例

❌ 修改前（技术人员视角）：
```
console.error("COZE_API_KEY 环境变量未设置");
```

✅ 修改后（用户视角）：
```
❌ 发送失败：缺少 API Key
   请确保已在 .env 文件中配置 COZE_API_KEY
   获取方式：https://coze.cn/settings
```

## 输出格式

修改后的错误提示应包含：
1. **emoji 图标**：让错误更醒目（❌ 错误、⚠️ 警告、💡 提示）
2. **简短说明**：一句话说清问题
3. **解决建议**：告诉用户具体怎么做

如需更详细指引，可添加「更多信息」或「示例」。