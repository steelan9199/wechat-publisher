# Chrome DevTools Skill 参考脚本

这里存放使用 Chrome DevTools Protocol 的示例脚本和工具类。

## 文件说明

| 文件 | 说明 | 适用场景 |
|-----|------|---------|
| `baidu_search_example.py` | 后台模式百度搜索示例 | 数据抓取、批量处理（推荐） |
| `baidu_search_visual.py` | 前台模式百度搜索示例 | 演示、教学（需要可视化） |
| `cdp_helper.py` | CDP 客户端封装类 | 简化 WebSocket 通信 |

## 搜索类任务指南

### 选择哪种方式？

**后台方式（推荐）**：
- ✅ 直接构造搜索URL，简单可靠
- ✅ 速度快，无需等待输入动画
- ✅ 代码简洁，易于维护
- ❌ 用户看不到操作过程

**前台方式**：
- ✅ 可视化操作，用户能看到过程
- ✅ 适合演示和教学
- ❌ 实现复杂，需要处理坐标和时序
- ❌ 速度较慢，需要等待输入动画

### 快速选择

```
用户说"搜索XXX并抓取数据" → 使用后台方式
用户说"用可视化/前台方式搜索XXX" → 使用前台方式
```

## 快速开始

### 1. 启动 Chrome 远程调试

```bash
# Windows
start chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-devtools-profile"

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$TMPDIR/chrome-devtools-profile"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-devtools-profile"
```

### 2. 运行示例

```bash
python baidu_search_example.py
```

## 常见问题

### 1. WebSocket 响应匹配

必须按 `id` 匹配请求和响应，因为会收到各种事件消息：

```python
# 正确做法
await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", ...}))

while True:
    msg = await ws.recv()
    data = json.loads(msg)
    if data.get('id') == 1:  # 匹配请求 id
        return data
```

### 2. 中文编码问题

Windows 终端需要设置 UTF-8 编码：

```python
import sys
sys.stdout.reconfigure(encoding='utf-8')
```

### 3. 页面加载等待

执行导航后需要等待页面加载：

```python
await asyncio.sleep(2)  # 简单等待
# 或等待特定元素
```

### 4. 页面 ID 动态获取

页面 ID 是动态生成的，不要硬编码，应该动态获取：

```python
import urllib.request
import json

def get_ws_url():
    req = urllib.request.Request('http://127.0.0.1:9222/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())
    return pages[0]['webSocketDebuggerUrl'] if pages else None
```

### 5. 动态内容提取技巧

如果提取的内容不完整（如摘要为空）：

```javascript
// 使用多个选择器匹配
const abstract = item.querySelector('.c-abstract, .abstract, [class*="abstract"]')?.innerText;

// 滚动页面加载更多内容
window.scrollTo(0, document.body.scrollHeight);
```

### 6. 前台可视化操作

如果需要在浏览器中显示操作过程（如输入文字、点击按钮），使用 Input 域：

```python
# 模拟键盘输入（用户能看到逐字输入）
for char in "美女":
    await ws.send(json.dumps({
        "id": 10,
        "method": "Input.dispatchKeyEvent",
        "params": {
            "type": "char",
            "text": char
        }
    }))
    await asyncio.sleep(0.1)  # 打字间隔

# 模拟鼠标点击
await ws.send(json.dumps({
    "id": 11,
    "method": "Input.dispatchMouseEvent",
    "params": {
        "type": "mousePressed",
        "x": 100,  # 点击位置 X 坐标
        "y": 200,  # 点击位置 Y 坐标
        "button": "left"
    }
}))
```

**后台 vs 前台对比**：

| 方式 | 方法 | 用户可见 | 适用场景 |
|------|------|---------|---------|
| 后台 | `Runtime.evaluate` | ❌ 不可见 | 数据抓取、自动化测试 |
| 前台 | `Input.dispatchKeyEvent/MouseEvent` | ✅ 可见 | 演示、教学、需要可视化反馈 |

## 参考文档

- [Chrome DevTools Protocol 文档](https://chromedevtools.github.io/devtools-protocol/)
- [CDP 方法列表](https://chromedevtools.github.io/devtools-protocol/tot/)
