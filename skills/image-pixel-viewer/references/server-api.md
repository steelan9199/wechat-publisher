# 服务器脚本说明（server.js）

## 用途

启动 HTTP 服务器（端口 18098），提供图片像素查看器所需的网页服务和图片读取接口。

## 执行命令

```powershell
# PowerShell 5 / 7+
cd "$SKILL_DIR/scripts"; if ($?) { node server.js }
```

```bash
# bash/zsh
cd "$SKILL_DIR/scripts" && node server.js
```

> ⚠️ `$SKILL_DIR` 仅为文档占位符，不是环境变量，执行命令时必须替换为实际绝对路径。

## 参数

无命令行参数。

## 输出

服务器启动后通过 `console.error` 输出：

```
图片像素查看器服务器已启动:
  访问地址: http://localhost:18098/
  健康检查: http://localhost:18098/health
```

## HTTP 接口

| 路径 | 方法 | 功能 | 返回 |
|---|---|---|---|
| `/health` | GET | 健康检查 | `{"status":"ok","port":18098}` |
| `/api/image?path=<绝对路径>` | GET | 读取任意位置的图片文件 | 图片文件内容（带正确 MIME 类型） |
| `/` | GET | 返回网页 | `web/index.html` 内容 |
| `/web/<文件名>` | GET | 返回网页相关静态文件 | 对应文件内容 |

## 安全机制

- `/api/image` 接口仅允许图片文件扩展名：`.png`、`.jpg`、`.jpeg`、`.gif`、`.bmp`、`.svg`、`.webp`
- 静态文件服务限制在技能根目录范围内，防止路径遍历
- 服务器是长驻进程，启动后会持续运行直到被手动终止

## 运行特性

- 服务器为长驻进程，**必须使用非阻塞方式执行**（对应工具的 `blocking: false`）
- 服务器启动后即可通过健康检查接口验证是否就绪
- 服务器采用常驻复用策略，后续切换图片无需重启服务器，只需用浏览器访问新 URL
