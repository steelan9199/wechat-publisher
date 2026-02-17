#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
百度搜索前台模式完整模板
基于成功实战经验编写

使用方法:
1. 先启动 Chrome: start chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-devtools-profile" https://www.baidu.com
2. 等待 3-5 秒
3. 运行此脚本: python baidu-search-template.py
"""

import asyncio
import websockets
import json
import urllib.request
import sys

# Windows 中文输出编码设置
sys.stdout.reconfigure(encoding='utf-8')


async def get_ws_url():
    """获取 Chrome DevTools WebSocket URL"""
    req = urllib.request.Request('http://127.0.0.1:9222/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())
    return pages[0]['webSocketDebuggerUrl'] if pages else None


async def baidu_search_frontend(keyword, max_results=10):
    """
    使用前台模式（可视化）在百度上搜索关键词

    Args:
        keyword: 搜索关键词
        max_results: 最大返回结果数量

    Returns:
        搜索结果列表
    """
    ws_url = await get_ws_url()
    if not ws_url:
        raise Exception("无法连接到 Chrome DevTools，请确保 Chrome 已启动")

    async with websockets.connect(ws_url) as ws:
        print(f"开始搜索: {keyword}")
        print("-" * 60)

        # ========== 步骤 1: 启用 Input 域 ==========
        print("[1/5] 启用 Input 域...")
        await ws.send(json.dumps({
            'id': 1,
            'method': 'Input.enable'
        }))
        await asyncio.sleep(0.3)

        # ========== 步骤 2: 聚焦并清空搜索框 ==========
        print("[2/5] 聚焦搜索框...")
        await ws.send(json.dumps({
            'id': 2,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': 'document.querySelector("#kw").focus();',
                'returnByValue': True
            }
        }))
        await asyncio.sleep(0.5)

        # 清空输入框
        await ws.send(json.dumps({
            'id': 3,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': 'document.querySelector("#kw").value = "";',
                'returnByValue': True
            }
        }))

        # ========== 步骤 3: 逐字输入关键词（前台模式） ==========
        print(f"[3/5] 输入关键词（前台可视化模式）...")
        for i, char in enumerate(keyword):
            await ws.send(json.dumps({
                'id': 10 + i,
                'method': 'Input.dispatchKeyEvent',
                'params': {
                    'type': 'char',
                    'text': char
                }
            }))
            await asyncio.sleep(0.15)  # 打字间隔，让用户能看到动画

        print(f"     已输入: {keyword}")

        # ========== 步骤 4: 点击搜索按钮 ==========
        print("[4/5] 点击搜索按钮...")
        await ws.send(json.dumps({
            'id': 100,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': 'document.querySelector("#su").click();',
                'returnByValue': True
            }
        }))

        # 等待搜索结果页加载
        print("     等待页面加载...")
        await asyncio.sleep(4)

        # ========== 步骤 5: 提取搜索结果 ==========
        print("[5/5] 提取搜索结果...")
        await ws.send(json.dumps({
            'id': 200,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': f'''
                    (() => {{
                        const results = [];
                        const items = document.querySelectorAll('.result, .c-container');

                        items.forEach((item, index) => {{
                            const titleEl = item.querySelector('h3 a, .t a');
                            const abstractEl = item.querySelector('.c-abstract, [class*="abstract"]');
                            const linkEl = item.querySelector('h3 a, .t a');

                            if (titleEl) {{
                                results.push({{
                                    index: index + 1,
                                    title: titleEl.innerText?.trim() || '',
                                    abstract: abstractEl?.innerText?.trim() || '',
                                    link: linkEl?.href || ''
                                }});
                            }}
                        }});

                        return results.slice(0, {max_results});
                    }})()
                ''',
                'returnByValue': True
            }
        }))

        # 接收响应
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == 200:
                results = data.get('result', {}).get('result', {}).get('value', [])
                return results


def print_results(results):
    """格式化输出搜索结果"""
    print()
    print("=" * 80)
    print("搜索结果")
    print("=" * 80)
    print()

    for item in results:
        print(f"[{item['index']}] {item['title']}")
        print(f"    链接: {item['link']}")
        if item['abstract']:
            abstract = item['abstract'][:120]
            if len(item['abstract']) > 120:
                abstract += "..."
            print(f"    摘要: {abstract}")
        print()

    print("=" * 80)
    print(f"共找到 {len(results)} 条结果")
    print("=" * 80)


async def main():
    """主函数"""
    # 搜索关键词
    keyword = "球球大作战团队模式教程"

    try:
        results = await baidu_search_frontend(keyword, max_results=10)
        print_results(results)
    except Exception as e:
        print(f"错误: {e}")
        print()
        print("请确保:")
        print("1. Chrome 已启动并开启了远程调试端口")
        print("2. 命令: start chrome --remote-debugging-port=9222 --user-data-dir=\"%TEMP%\\chrome-devtools-profile\"")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
