# 获取电脑的局域网 IP

> 用途：本技能在**手机端需要连电脑中继服务**时，必须知道电脑在局域网里的 IP
> （填进 `scripts/autojs-phone-client.js` 的 `SERVER_IP`，端口 `9421`）。
> 已固化一个脚本，直接跑就行，无需每次重新摸索。

## 一、最快方式：直接跑脚本（推荐）

脚本位置：`scripts/get-lan-ip.js`（本技能内）

```bash
# 用 WorkBuddy 自带的托管 Node 运行
C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe ^
  C:/Users/Administrator/.workbuddy/skills/autojs-phone-run-yashu/scripts/get-lan-ip.js

# 只输出「推荐」的 IP（管道 / 脚本调用时用）
.../node.exe .../scripts/get-lan-ip.js --first

# 输出完整 JSON（含网卡名、MAC）
.../node.exe .../scripts/get-lan-ip.js --json
```

- 默认模式：列出所有非回环 IPv4，并标注「推荐」项。
- `--first`：只打印推荐 IP，方便 `IP=$(... --first)` 之类调用。
- 推荐逻辑：优先选 **RFC1918 私有网段**（10.x / 172.16–31.x / 192.168.x），
  并排除 Clash fake-ip（198.18.x）、链路本地（169.254.x）、CGNAT（100.64.x）等虚拟/无效地址。

## 二、为什么不用 ipconfig / PowerShell（踩过的坑）

本机实测：

| 方式 | 结果 |
| --- | --- |
| `ipconfig` + grep | 输出是 **GBK 编码**，shell 里 grep 直接报「Binary file matches」，中文乱码 |
| `PowerShell Get-NetIPAddress` | 在某些环境下**无输出**（空），拿不到地址 |
| `hostname -I` | 本机不可用 |

Node 的 `os.networkInterfaces()` 直接返回结构化数据，**无编码坑、跨平台、毫秒级**，所以选用它。

## 三、手动兜底（脚本不可用时的备选）

1. **ipconfig（看编码）**
   - 在 Windows 终端运行 `ipconfig`，找「IPv4 地址」。
   - 若输出乱码，把结果写入文件再用 Read 工具看：`ipconfig > ip.txt`（Read 能正确解码 GBK）。
2. **PowerShell（若可用）**
   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 |
     Where-Object { $_.InterfaceAlias -notlike '*Loopback*' } |
     Select-Object InterfaceAlias, IPAddress
   ```

> ⚠️ 局域网 IP 通常是 **DHCP 动态分配**，换网络/重连后会变。脚本每次现取即可，不要写死到代码里。

## 四、在 AutoJS 联机里的用法

1. 电脑上运行 `node scripts/autojs-relay-server.js`（可在终端直接跑，也可让 AI 后台启动），中继监听 `9421`。
2. 运行本脚本取「推荐」IP，例如 `192.168.0.41`。
3. 把该 IP 填进手机端 `scripts/autojs-phone-client.js`：搜索 `var SERVER_IP =`，把等号右边引号里的 IP 改成刚取到的地址（示例：`"192.168.0.41"`）。
4. 手机与电脑需在同一 Wi-Fi 网段（都是 `192.168.0.x`）。
5. 手机 AutoJS 运行 `autojs-phone-client.js`，电脑侧显示「手机已连接」即可开始探测。
