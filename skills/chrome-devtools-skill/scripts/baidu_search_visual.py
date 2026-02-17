"""
百度搜索可视化操作示例（前台模式）

此脚本演示如何在浏览器中显示操作过程：
- 用户能看到文字逐字输入到搜索框
- 用户能看到搜索按钮被点击
- 适合演示、教学等需要可视化反馈的场景

工作流程:
1. 启动 Chrome 远程调试模式
2. 通过 WebSocket 连接到 Chrome DevTools
3. 使用 Input 域模拟真实用户输入（可视化）
4. 使用 Input 域模拟鼠标点击（可视化）
5. 等待页面加载并提取结果
"""

import asyncio
import websockets
import json
import urllib.request
import ssl
import sys

# 修复 Windows 终端中文输出乱码
sys.stdout.reconfigure(encoding='utf-8')

# 忽略 SSL 验证
ssl._create_default_https_context = ssl._create_unverified_context

CDP_HTTP_URL = "http://127.0.0.1:9222"


async def get_page_ws_url():
    """获取第一个页面的 WebSocket URL"""
    req = urllib.request.Request(f'{CDP_HTTP_URL}/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())
    if pages:
        return pages[0]['webSocketDebuggerUrl']
    return None


async def search_baidu_visual(keyword):
    """
    可视化搜索百度 - 用户能在浏览器中看到操作过程

    Args:
        keyword: 搜索关键词

    Returns:
        搜索结果列表
    """
    ws_url = await get_page_ws_url()
    if not ws_url:
        print("未找到可用的 Chrome 页面")
        return []

    print(f"连接到: {ws_url}")
    print(f"\n=== 开始可视化操作 ===")
    print(f"请在浏览器中观察操作过程...\n")

    async with websockets.connect(ws_url) as ws:
        msg_id = 0

        def send_msg(method, params=None):
            nonlocal msg_id
            msg_id += 1
            msg = {"id": msg_id, "method": method}
            if params:
                msg["params"] = params
            return msg_id, json.dumps(msg)

        # 1. 启用 Runtime 和 Input 域
        await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
        await ws.send(json.dumps({"id": 2, "method": "Input.enable"}))
        await asyncio.sleep(0.5)

        # 2. 聚焦到搜索框
        print("步骤 1: 聚焦搜索框...")
        mid, msg = send_msg("Runtime.evaluate", {
            "expression": "document.querySelector('#kw').focus();",
            "returnByValue": True
        })
        await ws.send(msg)
        await asyncio.sleep(0.5)

        # 3. 逐字输入关键词（用户能看到输入过程）
        print(f"步骤 2: 输入关键词 '{keyword}'...")
        for char in keyword:
            mid, msg = send_msg("Input.dispatchKeyEvent", {
                "type": "char",
                "text": char
            })
            await ws.send(msg)
            await asyncio.sleep(0.1)  # 模拟真实打字间隔

        await asyncio.sleep(0.5)

        # 4. 获取搜索按钮位置并点击
        print("步骤 3: 点击搜索按钮...")

        # 先获取按钮位置
        mid, msg = send_msg("Runtime.evaluate", {
            "expression": """
                (function() {
                    var btn = document.querySelector('#su');
                    var rect = btn.getBoundingClientRect();
                    return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
                })()
            """,
            "returnByValue": True
        })
        await ws.send(msg)

        # 接收按钮位置
        btn_pos = None
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == mid:
                btn_pos = data.get('result', {}).get('result', {}).get('value')
                break

        if btn_pos:
            # 模拟鼠标按下
            mid, msg = send_msg("Input.dispatchMouseEvent", {
                "type": "mousePressed",
                "x": btn_pos['x'],
                "y": btn_pos['y'],
                "button": "left",
                "clickCount": 1
            })
            await ws.send(msg)

            # 模拟鼠标释放
            mid, msg = send_msg("Input.dispatchMouseEvent", {
                "type": "mouseReleased",
                "x": btn_pos['x'],
                "y": btn_pos['y'],
                "button": "left",
                "clickCount": 1
            })
            await ws.send(msg)

        print("步骤 4: 等待页面加载...")
        await asyncio.sleep(4)

        # 5. 提取搜索结果
        print("步骤 5: 提取搜索结果...\n")
        mid, msg = send_msg("Runtime.evaluate", {
            "expression": """
                (function() {
                    var results = [];
                    var containers = document.querySelectorAll('.result, .c-container');
                    containers.forEach(function(item, index) {
                        var titleEl = item.querySelector('h3 a, .t a');
                        if (!titleEl) return;
                        var title = titleEl.innerText.trim();
                        var link = titleEl.href;
                        var abstractEl = item.querySelector('.c-abstract, .abstract');
                        var abstract = abstractEl ? abstractEl.innerText.trim() : '';
                        if (title) {
                            results.push({
                                index: index + 1,
                                title: title,
                                link: link,
                                abstract: abstract.substring(0, 200)
                            });
                        }
                    });
                    return results;
                })()
            """,
            "returnByValue": True
        })
        await ws.send(msg)

        # 获取结果
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == mid:
                return data.get('result', {}).get('result', {}).get('value', [])

    return []


async def main():
    """主函数"""
    keyword = "美女"
    print(f"准备搜索: {keyword}")
    print("请确保 Chrome 浏览器已打开并处于前台\n")

    results = await search_baidu_visual(keyword)

    print(f"=== 百度搜索 '{keyword}' 结果 ===")
    print(f"共找到 {len(results)} 条结果\n")

    for item in results:
        print(f"[{item['index']}] {item['title']}")
        print(f"    链接: {item['link'][:60]}...")
        if item['abstract']:
            print(f"    摘要: {item['abstract'][:100]}...")
        print()

    return results


if __name__ == "__main__":
    results = asyncio.run(main())
