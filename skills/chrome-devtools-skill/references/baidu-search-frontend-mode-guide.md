# 百度搜索前台模式完整实战指南

> 记录一次成功的百度搜索前台模式操作经验
> 日期: 2026-02-17
> 任务: 使用浏览器前台模式打开百度，输入关键词并搜索，抓取结果

---

## 任务概述

**目标**: 使用 Chrome DevTools Skill 以**前台模式**（可视化操作）完成百度搜索任务

**前台模式特点**:
- 用户能在浏览器中看到完整的操作过程（输入文字、点击按钮）
- 使用 CDP 的 `Input.dispatchKeyEvent` 模拟真实键盘输入
- 适合演示、教学等需要可视化反馈的场景

---

## 完整执行步骤

### 步骤 1: 启动 Chrome 浏览器（远程调试模式）

**Windows 命令**:
```bash
start chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-devtools-profile" https://www.baidu.com
```

**关键参数说明**:
- `--remote-debugging-port=9222`: 启用远程调试端口，CDP 通过此端口通信
- `--user-data-dir="%TEMP%\chrome-devtools-profile"`: 使用固定用户数据目录，保持登录状态和缓存
- `https://www.baidu.com`: 直接打开百度首页

**注意事项**:
1. 使用固定的 `user-data-dir` 名称，不要每次使用不同文件夹
2. 这样 Chrome 会记住 Cookie 和缓存，下次启动更快
3. Windows 使用 `start` 命令可以在前台打开浏览器窗口

**等待时间**: 启动后等待 3-5 秒确保 Chrome 完全加载

```bash
ping -n 4 127.0.0.1 > nul
```

---

### 步骤 2: 前台模式输入搜索关键词

**核心代码** (Python + WebSocket):

```python
import asyncio
import websockets
import json
import urllib.request

async def search():
    # 1. 获取页面 WebSocket URL
    req = urllib.request.Request('http://127.0.0.1:9222/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())
    ws_url = pages[0]['webSocketDebuggerUrl']

    async with websockets.connect(ws_url) as ws:
        # 2. 启用 Input 域（必须先启用才能发送键盘事件）
        await ws.send(json.dumps({'id': 1, 'method': 'Input.enable'}))

        # 3. 聚焦搜索框（关键步骤！）
        await ws.send(json.dumps({
            'id': 2,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': 'document.querySelector("#kw").focus();',
                'returnByValue': True
            }
        }))
        await asyncio.sleep(0.5)  # 等待聚焦完成

        # 4. 清空输入框（确保输入框为空）
        await ws.send(json.dumps({
            'id': 3,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': 'document.querySelector("#kw").value = "";',
                'returnByValue': True
            }
        }))

        # 5. 逐字输入文字（前台模式，用户能看到逐字输入动画）
        text = '球球大作战团队模式教程'
        for i, char in enumerate(text):
            await ws.send(json.dumps({
                'id': 10 + i,
                'method': 'Input.dispatchKeyEvent',
                'params': {
                    'type': 'char',      # 输入字符
                    'text': char         # 要输入的字符
                }
            }))
            await asyncio.sleep(0.15)  # 打字间隔 0.15 秒

        print('输入完成:', text)

asyncio.run(search())
```

**关键要点**:

1. **必须先启用 Input 域**: `Input.enable` 是使用键盘事件的前提
2. **必须先聚焦输入框**: `document.querySelector("#kw").focus()` 是关键，否则键盘事件可能无效
3. **百度搜索框选择器**: `#kw` 是百度搜索框的 ID
4. **打字间隔**: 0.1-0.2 秒最合适，太短可能漏字，太长用户等待久
5. **支持中文**: 无需额外编码处理，直接发送中文字符即可

---

### 步骤 3: 点击搜索按钮

**代码**:

```python
await ws.send(json.dumps({
    'id': 1,
    'method': 'Runtime.evaluate',
    'params': {
        'expression': 'document.querySelector("#su").click();',
        'returnByValue': True
    }
}))
```

**关键要点**:
- 百度搜索按钮选择器: `#su` 是百度"百度一下"按钮的 ID
- 使用 `Runtime.evaluate` 执行点击脚本即可
- 点击后等待页面跳转和加载

**等待时间**: 点击后等待 4-5 秒确保搜索结果页加载完成

```bash
ping -n 5 127.0.0.1 > nul
```

---

### 步骤 4: 抓取搜索结果数据

**核心代码**:

```python
# 提取搜索结果
await ws.send(json.dumps({
    'id': 1,
    'method': 'Runtime.evaluate',
    'params': {
        'expression': '''
            (() => {
                const results = [];
                // 使用多个选择器匹配不同结构的搜索结果
                const items = document.querySelectorAll('.result, .c-container');

                items.forEach((item, index) => {
                    // 标题选择器: 尝试多种可能的结构
                    const titleEl = item.querySelector('h3 a, .t a, [data-click*="title"]');
                    // 摘要选择器
                    const abstractEl = item.querySelector('.c-abstract, .content-right_8Zs40, [class*="abstract"]');
                    // 链接选择器
                    const linkEl = item.querySelector('h3 a, .t a');

                    if (titleEl) {
                        results.push({
                            index: index + 1,
                            title: titleEl.innerText?.trim() || '',
                            abstract: abstractEl?.innerText?.trim() || '',
                            link: linkEl?.href || ''
                        });
                    }
                });
                return results.slice(0, 10);  // 只取前10条
            })()
        ''',
        'returnByValue': True
    }
}))
```

**数据提取技巧**:

1. **多选择器匹配**: 百度搜索结果可能有不同结构，使用逗号分隔多个选择器
   - `.result` - 普通搜索结果
   - `.c-container` - 另一种结果容器

2. **标题提取**:
   - `h3 a` - 最常见的标题结构
   - `.t a` - 另一种标题结构

3. **摘要提取**:
   - `.c-abstract` - 普通摘要
   - `.content-right_8Zs40` - 某些特殊结果的摘要

4. **使用可选链操作符**: `?.` 防止元素不存在时报错

5. **限制结果数量**: 使用 `.slice(0, 10)` 只取前10条，避免数据过多

---

## 完整执行流程总结

```
1. 启动 Chrome（调试模式）
   ↓
2. 等待 3-5 秒确保加载完成
   ↓
3. 前台模式输入关键词
   - 启用 Input 域
   - 聚焦输入框 (#kw)
   - 清空输入框
   - 逐字输入（间隔 0.15 秒）
   ↓
4. 点击搜索按钮 (#su)
   ↓
5. 等待 4-5 秒确保结果页加载
   ↓
6. 提取搜索结果数据
   ↓
7. 格式化输出结果
```

---

## 踩坑记录与解决方案

### 坑 1: 输入框没有聚焦导致输入无效

**现象**: 发送了键盘事件但输入框没有文字

**原因**: 没有先执行 `focus()` 聚焦输入框

**解决**: 必须先执行 `document.querySelector("#kw").focus()`

---

### 坑 2: 打字速度太快导致漏字

**现象**: 输入的文字不完整，少了几个字

**原因**: 打字间隔太短，浏览器来不及处理

**解决**: 将间隔从 0.05 秒调整为 0.15 秒

---

### 坑 3: 页面还没加载完就提取数据

**现象**: 提取不到搜索结果或结果为空

**原因**: 搜索结果页是异步加载的，需要时间渲染

**解决**: 点击搜索后等待至少 4-5 秒再提取数据

---

### 坑 4: Windows 终端中文输出乱码

**现象**: 抓取的中文内容显示为乱码

**原因**: Windows 终端默认使用 GBK 编码

**解决**: 在 Python 脚本开头添加编码配置

```python
import sys
sys.stdout.reconfigure(encoding='utf-8')
```

---

## 关键选择器参考

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 搜索框 | `#kw` | 百度输入框 ID |
| 搜索按钮 | `#su` | "百度一下"按钮 ID |
| 搜索结果容器 | `.result`, `.c-container` | 两种常见结构 |
| 标题 | `h3 a`, `.t a` | 标题链接 |
| 摘要 | `.c-abstract` | 结果摘要文本 |

---

## 最佳实践建议

1. **使用固定 user-data-dir**: 保持一致的 Chrome 配置
2. **适当的等待时间**: 每一步操作后都要有等待时间
3. **多选择器匹配**: 提高数据提取的兼容性
4. **错误处理**: 使用可选链操作符防止空值报错
5. **限制结果数量**: 避免返回过多数据
6. **前台模式仅用于需要可视化的场景**: 纯数据抓取建议用后台模式

---

## 代码模板

### 前台模式搜索模板

```python
import asyncio
import websockets
import json
import urllib.request
import sys
sys.stdout.reconfigure(encoding='utf-8')

async def baidu_search_frontend(keyword):
    # 获取 WebSocket URL
    req = urllib.request.Request('http://127.0.0.1:9222/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())
    ws_url = pages[0]['webSocketDebuggerUrl']

    async with websockets.connect(ws_url) as ws:
        # 启用 Input
        await ws.send(json.dumps({'id': 1, 'method': 'Input.enable'}))

        # 聚焦并清空输入框
        await ws.send(json.dumps({
            'id': 2,
            'method': 'Runtime.evaluate',
            'params': {'expression': 'document.querySelector("#kw").focus();'}
        }))
        await asyncio.sleep(0.5)

        await ws.send(json.dumps({
            'id': 3,
            'method': 'Runtime.evaluate',
            'params': {'expression': 'document.querySelector("#kw").value = "";'}
        }))

        # 逐字输入
        for i, char in enumerate(keyword):
            await ws.send(json.dumps({
                'id': 10 + i,
                'method': 'Input.dispatchKeyEvent',
                'params': {'type': 'char', 'text': char}
            }))
            await asyncio.sleep(0.15)

        # 点击搜索
        await ws.send(json.dumps({
            'id': 100,
            'method': 'Runtime.evaluate',
            'params': {'expression': 'document.querySelector("#su").click();'}
        }))

        # 等待加载
        await asyncio.sleep(4)

        # 提取结果
        await ws.send(json.dumps({
            'id': 200,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': '''
                    (() => {
                        const items = document.querySelectorAll('.result, .c-container');
                        return Array.from(items).map((item, i) => ({
                            index: i + 1,
                            title: item.querySelector('h3 a')?.innerText?.trim() || '',
                            link: item.querySelector('h3 a')?.href || ''
                        })).filter(r => r.title);
                    })()
                ''',
                'returnByValue': True
            }
        }))

        # 接收响应
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == 200:
                return data.get('result', {}).get('result', {}).get('value', [])

# 使用
results = asyncio.run(baidu_search_frontend('你的关键词'))
for r in results:
    print(f"[{r['index']}] {r['title']}")
```

---

## 总结

这次成功的关键经验:

1. **严格按顺序执行**: 启用 Input → 聚焦 → 清空 → 输入 → 点击 → 等待 → 提取
2. **适当的等待时间**: 每个步骤之间都要有等待，特别是页面加载
3. **多选择器兼容**: 百度搜索结果结构多样，使用多个选择器提高成功率
4. **前台模式的核心**: 使用 `Input.dispatchKeyEvent` 而不是直接修改 value

希望这份指南能帮助后续使用者顺利完成类似任务！
