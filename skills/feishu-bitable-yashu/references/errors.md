# 常见错误及解决方案

## 错误类型对照表

| 错误类型     | 错误信息/原因                                         | 解决方案                                                    |
| ------------ | ----------------------------------------------------- | ----------------------------------------------------------- |
| 参数错误     | 参数格式不正确                                        | 使用 `--help` 查看参数格式，严格按照 JSON Schema 构造参数   |
| 路径错误     | 文件路径找不到                                        | 使用完整绝对路径，分隔符使用 `/`                            |
| 日期格式错误 | `DatetimeFieldConvFail: ... must be a unix timestamp` | 日期转为 Unix 时间戳（毫秒级），如 `1749504000000`          |
| 参数传递错误 | `unrecognized arguments: --tenant-access-token`       | 将参数放入 JSON 配置文件，通过 `--parameter-file-path` 传递 |
| 权限错误     | 应用未添加到多维表格                                  | 检查是否已在飞书多维表格中添加了企业自建应用                |
| Token 过期   | `tenant_access_token expired`                         | 重新获取 `tenant_access_token`，有效期约 2 小时             |

---

| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 10003 | invalid parameter | 请求参数缺失或者有误，更多错误信息请参考请求返回的error message |
| 99991663 | Invalid access token for authorization. Please make a request with token attached | 请求所使用的访问凭证无效。原因可能是 tenant_access_token 已过期 |

## 日期字段处理

飞书多维表格的日期字段需要使用 Unix 时间戳（毫秒级）。

### JavaScript 日期转时间戳

```javascript
// 方式1：Date.now() 获取当前时间戳
const timestamp = Date.now();

// 方式2：new Date().getTime()
const timestamp = new Date().getTime();

// 方式3：指定日期转时间戳
const timestamp = new Date("2025-01-01").getTime();
```

## URL 解析注意事项

URL 中包含 `&` 符号，命令行直接传递容易出错，建议使用参数文件方式：

```json
{
  "tenant_access_token": "t-g1042xxx",
  "url": "https://kr0lqjlbmo.feishu.cn/wiki/To1Swkz5riWl7qklbHVca4AEnWe?fromScene=spaceOverview&table=tblHOUZ30Wp572MX&view=vewbWH6HHe"
}
```
