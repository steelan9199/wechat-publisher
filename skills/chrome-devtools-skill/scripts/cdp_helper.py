"""
Chrome DevTools Protocol (CDP) 助手类

封装了常用的 CDP 操作，简化 WebSocket 通信
"""

import asyncio
import websockets
import json
import urllib.request
import ssl
import sys
from typing import Optional, Any, Dict, List

# 修复 Windows 终端中文输出乱码问题
sys.stdout.reconfigure(encoding='utf-8')

ssl._create_default_https_context = ssl._create_unverified_context


class CDPClient:
    """Chrome DevTools Protocol 客户端"""

    def __init__(self, debugger_url: str = "http://127.0.0.1:9222"):
        self.debugger_url = debugger_url
        self.ws = None
        self.message_id = 0
        self.pending_messages: Dict[int, asyncio.Future] = {}

    async def connect(self, page_id: Optional[str] = None) -> bool:
        """
        连接到 Chrome DevTools

        Args:
            page_id: 页面 ID，如果不指定则连接第一个页面

        Returns:
            是否连接成功
        """
        try:
            if page_id:
                ws_url = f"ws://127.0.0.1:9222/devtools/page/{page_id}"
            else:
                # 获取第一个页面
                pages = self.get_pages()
                if not pages:
                    print("未找到可用的页面")
                    return False
                ws_url = pages[0]['webSocketDebuggerUrl']

            self.ws = await websockets.connect(ws_url)

            # 启动消息接收循环
            asyncio.create_task(self._receive_loop())

            # 启用 Runtime
            await self.send_command("Runtime.enable")

            return True
        except Exception as e:
            print(f"连接失败: {e}")
            return False

    def get_pages(self) -> List[Dict]:
        """获取所有页面列表"""
        req = urllib.request.Request(f'{self.debugger_url}/json/list')
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())

    async def _receive_loop(self):
        """接收消息循环"""
        try:
            async for message in self.ws:
                data = json.loads(message)

                # 处理带 id 的响应
                if 'id' in data and data['id'] in self.pending_messages:
                    future = self.pending_messages.pop(data['id'])
                    future.set_result(data)

                # 可以在这里处理事件（如 console.log）
                elif 'method' in data:
                    pass  # 忽略事件

        except websockets.exceptions.ConnectionClosed:
            print("WebSocket 连接已关闭")

    async def send_command(self, method: str, params: Optional[Dict] = None) -> Dict:
        """
        发送 CDP 命令

        Args:
            method: CDP 方法名
            params: 方法参数

        Returns:
            响应数据
        """
        self.message_id += 1
        msg_id = self.message_id

        command = {
            "id": msg_id,
            "method": method
        }
        if params:
            command["params"] = params

        # 创建 Future 等待响应
        future = asyncio.Future()
        self.pending_messages[msg_id] = future

        # 发送命令
        await self.ws.send(json.dumps(command))

        # 等待响应
        return await future

    async def evaluate(self, script: str, return_by_value: bool = True) -> Any:
        """
        在页面中执行 JavaScript

        Args:
            script: JavaScript 代码
            return_by_value: 是否返回值

        Returns:
            执行结果
        """
        response = await self.send_command("Runtime.evaluate", {
            "expression": script,
            "returnByValue": return_by_value
        })

        result = response.get('result', {}).get('result', {})

        if 'value' in result:
            return result['value']
        elif 'description' in result:
            return result['description']
        else:
            return None

    async def navigate(self, url: str) -> bool:
        """
        导航到指定 URL

        Args:
            url: 目标 URL

        Returns:
            是否导航成功
        """
        try:
            await self.evaluate(f'window.location.href = "{url}";')
            await asyncio.sleep(2)  # 等待页面加载
            return True
        except Exception as e:
            print(f"导航失败: {e}")
            return False

    async def screenshot(self, output_path: str = "screenshot.png") -> bool:
        """
        截取页面截图

        Args:
            output_path: 截图保存路径

        Returns:
            是否截图成功
        """
        try:
            import base64

            response = await self.send_command("Page.captureScreenshot")
            data = response.get('result', {}).get('data', '')

            if data:
                with open(output_path, 'wb') as f:
                    f.write(base64.b64decode(data))
                print(f"截图已保存: {output_path}")
                return True
        except Exception as e:
            print(f"截图失败: {e}")
        return False

    async def close(self):
        """关闭连接"""
        if self.ws:
            await self.ws.close()


# 使用示例
async def example():
    """使用 CDPClient 的示例"""
    client = CDPClient()

    # 连接 Chrome
    if not await client.connect():
        return

    try:
        # 导航到百度
        await client.navigate("https://www.baidu.com")

        # 执行搜索
        await client.evaluate('''
            document.querySelector('#kw').value = 'Python';
            document.querySelector('#su').click();
        ''')

        await asyncio.sleep(3)

        # 提取搜索结果
        results = await client.evaluate('''
            (function() {
                var items = document.querySelectorAll('.result');
                var data = [];
                items.forEach(function(item, i) {
                    var title = item.querySelector('h3 a');
                    if (title) {
                        data.push({
                            index: i + 1,
                            title: title.innerText
                        });
                    }
                });
                return data;
            })()
        ''')

        print("搜索结果:", results)

        # 截图
        await client.screenshot("baidu_python.png")

    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(example())
