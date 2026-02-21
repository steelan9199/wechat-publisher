#!/usr/bin/env python3
"""
PyAutoGUI 自动化操作脚本
支持截图、点击、颜色获取、鼠标控制等功能
"""

import argparse
import json
import sys
import time
from pathlib import Path


def ensure_pyautogui():
    """确保 pyautogui 已安装"""
    try:
        import pyautogui

        return pyautogui
    except ImportError:
        print("正在安装 pyautogui...")
        import subprocess

        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "pyautogui", "-q"]
        )
        import pyautogui

        return pyautogui


def ensure_pillow():
    """确保 pillow 已安装"""
    try:
        from PIL import Image

        return Image
    except ImportError:
        print("正在安装 pillow...")
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
        from PIL import Image

        return Image


pyautogui = ensure_pyautogui()
Image = ensure_pillow()

# 安全设置
pyautogui.FAILSAFE = True  # 鼠标移到左上角触发异常停止
pyautogui.PAUSE = 0.1  # 每个操作后的暂停时间


def screenshot(output_path=None):
    """截图并保存到文件，返回文件路径"""
    if output_path is None:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_path = f"screenshot_{timestamp}.png"

    screenshot = pyautogui.screenshot()
    screenshot.save(output_path)
    return str(Path(output_path).resolve())


def click(x, y, button="left", clicks=1, interval=0.0):
    """在指定坐标点击"""
    pyautogui.click(x, y, button=button, clicks=clicks, interval=interval)
    return {"success": True, "x": x, "y": y, "button": button, "clicks": clicks}


def double_click(x, y, button="left"):
    """在指定坐标双击"""
    pyautogui.doubleClick(x, y, button=button)
    return {"success": True, "x": x, "y": y, "button": button}


def get_pixel_color(x, y):
    """获取指定坐标的颜色 (RGB)"""
    color = pyautogui.pixel(x, y)
    return {
        "success": True,
        "x": x,
        "y": y,
        "rgb": color,
        "hex": "#{:02x}{:02x}{:02x}".format(*color),
    }


def find_color(target_rgb, region=None, tolerance=0):
    """在屏幕上查找指定颜色，返回找到的所有位置"""
    if region is None:
        width, height = pyautogui.size()
        region = (0, 0, width, height)

    x, y, w, h = region
    screenshot = pyautogui.screenshot(region=region)

    positions = []
    target_r, target_g, target_b = target_rgb

    for px in range(w):
        for py in range(h):
            r, g, b = screenshot.getpixel((px, py))
            if (
                abs(r - target_r) <= tolerance
                and abs(g - target_g) <= tolerance
                and abs(b - target_b) <= tolerance
            ):
                positions.append({"x": x + px, "y": y + py})

    return {
        "success": True,
        "target_rgb": target_rgb,
        "found_count": len(positions),
        "positions": positions[:50],  # 限制返回数量
    }


def get_mouse_position():
    """获取当前鼠标位置"""
    x, y = pyautogui.position()
    return {"success": True, "x": x, "y": y}


def move_mouse(x, y, duration=0.0):
    """移动鼠标到指定位置"""
    pyautogui.moveTo(x, y, duration=duration)
    return {"success": True, "x": x, "y": y, "duration": duration}


def drag_mouse(x, y, duration=0.0, button="left"):
    """拖拽鼠标到指定位置"""
    pyautogui.dragTo(x, y, duration=duration, button=button)
    return {"success": True, "x": x, "y": y, "duration": duration, "button": button}


def scroll(amount, x=None, y=None):
    """滚动鼠标滚轮"""
    if x is not None and y is not None:
        pyautogui.scroll(amount, x, y)
    else:
        pyautogui.scroll(amount)
    return {"success": True, "amount": amount, "x": x, "y": y}


def get_screen_size():
    """获取屏幕分辨率"""
    width, height = pyautogui.size()
    return {"success": True, "width": width, "height": height}


def sleep(seconds):
    """等待指定秒数"""
    time.sleep(seconds)
    return {"success": True, "slept": seconds}


def type_text(text, interval=0.0):
    """输入文本"""
    pyautogui.typewrite(text, interval=interval)
    return {"success": True, "text": text, "interval": interval}


def press_key(key):
    """按下键盘按键"""
    pyautogui.press(key)
    return {"success": True, "key": key}


def hotkey(*keys):
    """按下组合键"""
    pyautogui.hotkey(*keys)
    return {"success": True, "keys": list(keys)}


def locate_on_screen(image_path, confidence=None, region=None):
    """在屏幕上查找图片位置"""
    try:
        if confidence is not None:
            location = pyautogui.locateOnScreen(
                image_path, confidence=confidence, region=region
            )
        else:
            location = pyautogui.locateOnScreen(image_path, region=region)

        if location:
            center = pyautogui.center(location)
            return {
                "success": True,
                "found": True,
                "left": location.left,
                "top": location.top,
                "width": location.width,
                "height": location.height,
                "center_x": center.x,
                "center_y": center.y,
            }
        else:
            return {"success": True, "found": False}
    except Exception as e:
        return {"success": False, "error": str(e)}


def locate_all_on_screen(image_path, confidence=None, region=None):
    """在屏幕上查找所有匹配的图��位置"""
    try:
        if confidence is not None:
            locations = list(
                pyautogui.locateAllOnScreen(
                    image_path, confidence=confidence, region=region
                )
            )
        else:
            locations = list(pyautogui.locateAllOnScreen(image_path, region=region))

        results = []
        for loc in locations:
            center = pyautogui.center(loc)
            results.append(
                {
                    "left": loc.left,
                    "top": loc.top,
                    "width": loc.width,
                    "height": loc.height,
                    "center_x": center.x,
                    "center_y": center.y,
                }
            )

        return {"success": True, "found_count": len(results), "locations": results}
    except Exception as e:
        return {"success": False, "error": str(e)}


def alert(title, text, button="OK"):
    """显示警告对话框"""
    pyautogui.alert(text=text, title=title, button=button)
    return {"success": True}


def confirm(title, text, buttons=["OK", "Cancel"]):
    """显示确认对话框"""
    result = pyautogui.confirm(text=text, title=title, buttons=buttons)
    return {"success": True, "result": result}


def prompt(title, text, default=""):
    """显示输入对话框"""
    result = pyautogui.prompt(text=text, title=title, default=default)
    return {"success": True, "result": result}


def main():
    parser = argparse.ArgumentParser(description="PyAutoGUI 自动化操作")
    parser.add_argument(
        "action",
        choices=[
            "screenshot",
            "click",
            "double_click",
            "get_pixel_color",
            "find_color",
            "get_mouse_position",
            "move_mouse",
            "drag_mouse",
            "scroll",
            "get_screen_size",
            "sleep",
            "type_text",
            "press_key",
            "hotkey",
            "locate_on_screen",
            "locate_all_on_screen",
            "alert",
            "confirm",
            "prompt",
        ],
        help="要执行的操作",
    )

    # 通用参数
    parser.add_argument("--x", type=int, help="X 坐标")
    parser.add_argument("--y", type=int, help="Y 坐标")
    parser.add_argument("--duration", type=float, default=0.0, help="持续时间")
    parser.add_argument("--output", help="输出文件路径")

    # 点击相关
    parser.add_argument(
        "--button", default="left", choices=["left", "right", "middle"], help="鼠标按钮"
    )
    parser.add_argument("--clicks", type=int, default=1, help="点击次数")
    parser.add_argument("--interval", type=float, default=0.0, help="点击间隔")

    # 颜色相关
    parser.add_argument("--rgb", help="目标颜色 RGB，格式: R,G,B")
    parser.add_argument("--tolerance", type=int, default=0, help="颜色容差")
    parser.add_argument("--region", help="搜索区域，格式: x,y,w,h")

    # 文本和按键
    parser.add_argument("--text", help="要输入的文本")
    parser.add_argument("--key", help="按键名称")
    parser.add_argument("--keys", help="组合键，用逗号分隔")

    # 图像识别
    parser.add_argument("--image", help="图像文件路径")
    parser.add_argument(
        "--confidence", type=float, help="置信度 (0-1)，需要 opencv-python"
    )

    # 对话框
    parser.add_argument("--title", default="提示", help="对话框标题")
    parser.add_argument("--buttons", help="按钮列表，用逗号分隔")
    parser.add_argument("--default", default="", help="默认值")

    # 其他
    parser.add_argument("--amount", type=int, help="滚动量")
    parser.add_argument("--seconds", type=float, help="等待秒数")

    args = parser.parse_args()

    result = None

    try:
        if args.action == "screenshot":
            result = screenshot(args.output)

        elif args.action == "click":
            if args.x is None or args.y is None:
                raise ValueError("点击操作需要提供 --x 和 --y 参数")
            result = click(args.x, args.y, args.button, args.clicks, args.interval)

        elif args.action == "double_click":
            if args.x is None or args.y is None:
                raise ValueError("双击操作需要提供 --x 和 --y 参数")
            result = double_click(args.x, args.y, args.button)

        elif args.action == "get_pixel_color":
            if args.x is None or args.y is None:
                raise ValueError("获取颜色操作需要提供 --x 和 --y 参数")
            result = get_pixel_color(args.x, args.y)

        elif args.action == "find_color":
            if args.rgb is None:
                raise ValueError("查找颜色操作需要提供 --rgb 参数，格式: R,G,B")
            rgb = tuple(map(int, args.rgb.split(",")))
            region = tuple(map(int, args.region.split(","))) if args.region else None
            result = find_color(rgb, region, args.tolerance)

        elif args.action == "get_mouse_position":
            result = get_mouse_position()

        elif args.action == "move_mouse":
            if args.x is None or args.y is None:
                raise ValueError("移动鼠标操作需要提供 --x 和 --y 参数")
            result = move_mouse(args.x, args.y, args.duration)

        elif args.action == "drag_mouse":
            if args.x is None or args.y is None:
                raise ValueError("拖拽鼠标操作需要提供 --x 和 --y 参数")
            result = drag_mouse(args.x, args.y, args.duration, args.button)

        elif args.action == "scroll":
            if args.amount is None:
                raise ValueError("滚动操作需要提供 --amount 参数")
            result = scroll(args.amount, args.x, args.y)

        elif args.action == "get_screen_size":
            result = get_screen_size()

        elif args.action == "sleep":
            if args.seconds is None:
                raise ValueError("等待操作需要提供 --seconds 参数")
            result = sleep(args.seconds)

        elif args.action == "type_text":
            if args.text is None:
                raise ValueError("输入文本操作需要提供 --text 参数")
            result = type_text(args.text, args.interval)

        elif args.action == "press_key":
            if args.key is None:
                raise ValueError("按键操作需要提供 --key 参数")
            result = press_key(args.key)

        elif args.action == "hotkey":
            if args.keys is None:
                raise ValueError("组合键操作需要提供 --keys 参数，格式: key1,key2,key3")
            keys = args.keys.split(",")
            result = hotkey(*keys)

        elif args.action == "locate_on_screen":
            if args.image is None:
                raise ValueError("图像识别操作需要提供 --image 参数")
            region = tuple(map(int, args.region.split(","))) if args.region else None
            result = locate_on_screen(args.image, args.confidence, region)

        elif args.action == "locate_all_on_screen":
            if args.image is None:
                raise ValueError("图像识别操作需要提供 --image 参数")
            region = tuple(map(int, args.region.split(","))) if args.region else None
            result = locate_all_on_screen(args.image, args.confidence, region)

        elif args.action == "alert":
            if args.text is None:
                raise ValueError("警告对话框需要提供 --text 参数")
            result = alert(args.title, args.text, args.button)

        elif args.action == "confirm":
            if args.text is None:
                raise ValueError("确认对话框需要提供 --text 参数")
            buttons = args.buttons.split(",") if args.buttons else ["OK", "Cancel"]
            result = confirm(args.title, args.text, buttons)

        elif args.action == "prompt":
            if args.text is None:
                raise ValueError("输入对话框需要提供 --text 参数")
            result = prompt(args.title, args.text, args.default)

    except Exception as e:
        result = {"success": False, "error": str(e)}

    # 输出 JSON 格式结果
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
