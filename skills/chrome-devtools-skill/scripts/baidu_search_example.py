"""
使用 Chrome DevTools Protocol 搜索百度并提取结果的完整示例

工作流程:
1. 启动 Chrome 远程调试模式（固定用户数据目录）
2. 通过 WebSocket 连接到 Chrome DevTools
3. 导航到百度搜索页面
4. 执行搜索
5. 提取搜索结果
"""

import asyncio
import websockets
import json
import urllib.request
import ssl
import sys

# 忽略 SSL 验证
ssl._create_default_https_context = ssl._create_unverified_context

# 固定的用户数据目录（重要：保持一致性）
CHROME_USER_DATA_DIR = "%TEMP%\\chrome-devtools-profile"
CDP_HTTP_URL = "http://127.0.0.1:9222"


async def get_page_ws_url():
    """获取第一个页面的 WebSocket URL"""
    req = urllib.request.Request(f'{CDP_HTTP_URL}/json/list')
    with urllib.request.urlopen(req) as response:
        pages = json.loads(response.read().decode())

    if pages:
        return pages[0]['webSocketDebuggerUrl']
    return None


async def search_baidu(keyword):
    """
    在百度上搜索关键词并提取结果

    Args:
        keyword: 搜索关键词

    Returns:
        搜索结果列表
    """
    # 获取页面 WebSocket URL
    ws_url = await get_page_ws_url()
    if not ws_url:
        print("未找到可用的 Chrome 页面")
        return []

    print(f"连接到: {ws_url}")

    async with websockets.connect(ws_url) as ws:
        # 启用 Runtime 域
        await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))

        # 等待启用响应
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == 1:
                break

        # 导航到百度搜索页面
        navigate_script = f'''
        window.location.href = "https://www.baidu.com/s?wd={keyword}";
        '''

        await ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {"expression": navigate_script}
        }))

        # 等待导航完成
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == 2:
                break

        # 等待页面加载
        await asyncio.sleep(3)

        # 提取搜索结果
        extract_script = """
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
        """

        await ws.send(json.dumps({
            "id": 3,
            "method": "Runtime.evaluate",
            "params": {
                "expression": extract_script,
                "returnByValue": True
            }
        }))

        # 获取响应
        while True:
            msg = await ws.recv()
            data = json.loads(msg)
            if data.get('id') == 3:
                result_value = data.get('result', {}).get('result', {}).get('value', [])
                return result_value

    return []


async def main():
    """主函数"""
    # 设置 UTF-8 编码输出
    sys.stdout.reconfigure(encoding='utf-8')

    # 搜索关键词
    keyword = "美女"
    print(f"正在搜索: {keyword}\n")

    results = await search_baidu(keyword)

    print(f"\n=== 百度搜索 '{keyword}' 结果 ===")
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
