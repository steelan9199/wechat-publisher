# Chrome DevTools 前台模式速查表

> 快速参考：如何使用 CDP 进行前台模式（可视化）操作

---

## 前台模式 vs 后台模式

| 特性 | 前台模式 | 后台模式 |
|------|----------|----------|
| 用户可见 | ✅ 能看到输入、点击过程 | ❌ 直接操作 DOM，无动画 |
| 速度 | 较慢（需要模拟真实操作） | 快（直接执行脚本） |
| 适用场景 | 演示、教学、需要可视化反馈 | 数据抓取、自动化测试 |
| 实现方式 | `Input.dispatchKeyEvent` | `Runtime.evaluate` 直接修改 |

---

## 核心方法

### 1. 启用 Input 域（必须！）

```python
await ws.send(json.dumps({
    'id': 1,
    'method': 'Input.enable'
}))
```

**注意**: 所有键盘/鼠标事件之前必须先启用 Input 域

---

### 2. 聚焦元素

```python
await ws.send(json.dumps({
    'id': 2,
    'method': 'Runtime.evaluate',
    'params': {
        'expression': 'document.querySelector("#input-id").focus();'
    }
}))
await asyncio.sleep(0.5)  # 等待聚焦完成
```

**关键**: 输入前必须先聚焦，否则键盘事件可能无效

---

### 3. 逐字输入文字

```python
text = '要输入的文字'
for i, char in enumerate(text):
    await ws.send(json.dumps({
        'id': 10 + i,
        'method': 'Input.dispatchKeyEvent',
        'params': {
            'type': 'char',      # 输入字符
            'text': char,        # 字符内容
            'unmodifiedText': char
        }
    }))
    await asyncio.sleep(0.15)  # 打字间隔
```

**参数说明**:
- `type`: `'char'` 表示输入字符，`'keyDown'`/`'keyUp'` 用于特殊按键
- `text`: 要输入的字符（支持中文）
- `unmodifiedText`: 未修饰的文本（可选）

**打字间隔建议**:
- 普通场景: 0.1-0.15 秒
- 需要更真实: 0.05-0.1 秒
- 避免漏字: 不小于 0.05 秒

---

### 4. 模拟按键（如 Enter、Tab）

```python
# 按下 Enter
await ws.send(json.dumps({
    'id': 1,
    'method': 'Input.dispatchKeyEvent',
    'params': {
        'type': 'keyDown',
        'key': 'Enter',
        'code': 'Enter',
        'keyCode': 13
    }
}))

await ws.send(json.dumps({
    'id': 2,
    'method': 'Input.dispatchKeyEvent',
    'params': {
        'type': 'keyUp',
        'key': 'Enter',
        'code': 'Enter',
        'keyCode': 13
    }
}))
```

**常用按键代码**:

| 按键 | key | code | keyCode |
|------|-----|------|---------|
| Enter | 'Enter' | 'Enter' | 13 |
| Tab | 'Tab' | 'Tab' | 9 |
| Escape | 'Escape' | 'Escape' | 27 |
| Backspace | 'Backspace' | 'Backspace' | 8 |
| 空格 | ' ' | 'Space' | 32 |

---

### 5. 模拟鼠标点击

```python
# 方法 1: 使用 Runtime.evaluate 直接点击元素
await ws.send(json.dumps({
    'id': 1,
    'method': 'Runtime.evaluate',
    'params': {
        'expression': 'document.querySelector("#button").click();'
    }
}))

# 方法 2: 使用 Input.dispatchMouseEvent 模拟真实点击（带坐标）
await ws.send(json.dumps({
    'id': 1,
    'method': 'Input.dispatchMouseEvent',
    'params': {
        'type': 'mousePressed',
        'x': 100,           # X 坐标
        'y': 200,           # Y 坐标
        'button': 'left',   # 左键
        'clickCount': 1
    }
}))

await ws.send(json.dumps({
    'id': 2,
    'method': 'Input.dispatchMouseEvent',
    'params': {
        'type': 'mouseReleased',
        'x': 100,
        'y': 200,
        'button': 'left',
        'clickCount': 1
    }
}))
```

---

## 常见网站选择器参考

### 百度搜索

| 元素 | 选择器 |
|------|--------|
| 搜索框 | `#kw` |
| 搜索按钮 | `#su` |
| 搜索结果 | `.result`, `.c-container` |
| 结果标题 | `h3 a`, `.t a` |
| 结果摘要 | `.c-abstract` |

### 谷歌搜索

| 元素 | 选择器 |
|------|--------|
| 搜索框 | `textarea[name="q"]` |
| 搜索按钮 | `input[name="btnK"]` |
| 搜索结果 | `.g`, `[data-ved]` |
| 结果标题 | `h3` |

### 通用表单元素

| 元素类型 | 选择器示例 |
|----------|-----------|
| 输入框 (by ID) | `#username` |
| 输入框 (by name) | `input[name="email"]` |
| 输入框 (by type) | `input[type="password"]` |
| 按钮 (by ID) | `#submit-btn` |
| 按钮 (by text) | `button:contains("提交")` |
| 链接 (by text) | `a:contains("点击这里")` |

---

## 完整示例：前台模式登录表单

```python
import asyncio
import websockets
import json
import urllib.request

async def login_frontend(username, password):
    # 获取 WebSocket URL
    req = urllib.request.Request('http://127.0.0.1:9222/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())
    ws_url = pages[0]['webSocketDebuggerUrl']

    async with websockets.connect(ws_url) as ws:
        # 1. 启用 Input
        await ws.send(json.dumps({'id': 1, 'method': 'Input.enable'}))

        # 2. 输入用户名
        await ws.send(json.dumps({
            'id': 2,
            'method': 'Runtime.evaluate',
            'params': {'expression': 'document.querySelector("#username").focus();'}
        }))
        await asyncio.sleep(0.3)

        for i, char in enumerate(username):
            await ws.send(json.dumps({
                'id': 10 + i,
                'method': 'Input.dispatchKeyEvent',
                'params': {'type': 'char', 'text': char}
            }))
            await asyncio.sleep(0.1)

        # 3. 按 Tab 切换到密码框
        await ws.send(json.dumps({
            'id': 50,
            'method': 'Input.dispatchKeyEvent',
            'params': {'type': 'keyDown', 'key': 'Tab', 'keyCode': 9}
        }))
        await ws.send(json.dumps({
            'id': 51,
            'method': 'Input.dispatchKeyEvent',
            'params': {'type': 'keyUp', 'key': 'Tab', 'keyCode': 9}
        }))
        await asyncio.sleep(0.3)

        # 4. 输入密码
        for i, char in enumerate(password):
            await ws.send(json.dumps({
                'id': 60 + i,
                'method': 'Input.dispatchKeyEvent',
                'params': {'type': 'char', 'text': char}
            }))
            await asyncio.sleep(0.1)

        # 5. 按 Enter 提交
        await ws.send(json.dumps({
            'id': 100,
            'method': 'Input.dispatchKeyEvent',
            'params': {'type': 'keyDown', 'key': 'Enter', 'keyCode': 13}
        }))
        await ws.send(json.dumps({
            'id': 101,
            'method': 'Input.dispatchKeyEvent',
            'params': {'type': 'keyUp', 'key': 'Enter', 'keyCode': 13}
        }))

        print('登录表单已提交')

# 使用
asyncio.run(login_frontend('myuser', 'mypass'))
```

---

## 常见问题排查

### 问题 1: 键盘事件发送了但输入框没反应

**检查清单**:
1. ✅ 是否启用了 `Input.enable`?
2. ✅ 是否先执行了 `focus()`?
3. ✅ 等待时间是否足够（focus 后至少 0.3 秒）?
4. ✅ 选择器是否正确?

### 问题 2: 中文输入乱码

**解决**: 确保 Python 脚本开头设置编码

```python
import sys
sys.stdout.reconfigure(encoding='utf-8')
```

### 问题 3: 打字太快导致漏字

**解决**: 增加打字间隔到 0.15-0.2 秒

### 问题 4: 页面还没加载完就操作

**解决**: 增加等待时间，或使用 `wait_for` 等待特定元素

```python
# 等待元素出现
await ws.send(json.dumps({
    'id': 1,
    'method': 'Runtime.evaluate',
    'params': {
        'expression': '''
            new Promise((resolve) => {
                const check = () => {
                    if (document.querySelector('.result')) {
                        resolve('loaded');
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            })
        ''',
        'awaitPromise': True
    }
}))
```

---

## 快速命令参考

### 启动 Chrome（Windows）

```bash
start chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-devtools-profile" [URL]
```

### 获取页面列表

```bash
curl -s http://127.0.0.1:9222/json/list | python -m json.tool
```

### 等待命令（Windows）

```bash
ping -n 4 127.0.0.1 > nul  # 等待约 3 秒
```

---

## 最佳实践

1. **总是先启用 Input 域**
2. **输入前总是先聚焦**
3. **使用适当的等待时间**
4. **使用多选择器提高兼容性**
5. **前台模式仅用于需要可视化的场景**
6. **后台模式更适合纯数据抓取**

---

*最后更新: 2026-02-17*
