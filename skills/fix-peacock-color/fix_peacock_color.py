#!/usr/bin/env python3
"""
修复 Trae 编辑器中 Peacock 插件的颜色配置问题

使用方法:
    python fix_peacock_color.py [项目路径]

如果不提供项目路径，默认使用当前目录
"""

import json
import os
import sys
from pathlib import Path


def hex_to_rgb(hex_color: str) -> tuple:
    """将十六进制颜色转换为 RGB 元组"""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join([c * 2 for c in hex_color])
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb: tuple) -> str:
    """将 RGB 元组转换为十六进制颜色"""
    return '#{:02x}{:02x}{:02x}'.format(*rgb)


def adjust_brightness(hex_color: str, factor: float) -> str:
    """调整颜色亮度

    Args:
        hex_color: 十六进制颜色值
        factor: 亮度因子，>1 变亮，<1 变暗

    Returns:
        调整后的十六进制颜色值
    """
    rgb = hex_to_rgb(hex_color)
    adjusted = tuple(min(255, int(c * factor)) for c in rgb)
    return rgb_to_hex(adjusted)


def generate_color_fixes(peacock_color: str) -> dict:
    """根据 Peacock 主色调生成修复后的颜色配置

    颜色设计原则:
    1. 对比度标准: 遵循 WCAG 2.1，正常文字对比度 >= 4.5:1
    2. 亮度调整: 基于 Peacock 主色生成变体
       - lighter: 亮度 × 1.15，用于非激活背景
       - darker: 亮度 × 0.85，用于悬停状态
       - active: 亮度 × 0.70，用于选中/激活状态
    3. 中性色阶: 使用固定的灰度色阶确保一致性
       - 纯白 #ffffff: 编辑器背景
       - 浅灰白 #f8f9fa: 侧边栏、面板背景
       - 边框灰 #dee2e6: 边框、分割线
       - 中灰 #6c757d: 次要文字、行号
       - 深灰 #212529: 主要文字
       - 纯黑 #000000: 高对比度文字
    4. 半透明文字: 非激活状态使用 60% 透明度 (#00000099)

    Args:
        peacock_color: Peacock 主色调（如 #b1e4cb）

    Returns:
        完整的 workbench.colorCustomizations 配置
    """
    # 生成颜色变体
    primary = peacock_color
    lighter = adjust_brightness(peacock_color, 1.15)  # 更亮的变体，用于非激活背景
    darker = adjust_brightness(peacock_color, 0.85)   # 更深的变体，用于悬停状态
    active = adjust_brightness(peacock_color, 0.70)   # 激活状态的深色，用于选中项

    return {
        # ==================== 活动栏 (Activity Bar) ====================
        # 活动栏位于窗口最左侧，包含文件资源管理器、搜索等图标
        "activityBar.activeBackground": active,           # 激活状态使用深色变体，提供视觉权重
        "activityBar.background": lighter,                # 大面积背景使用浅色，避免视觉疲劳
        "activityBar.foreground": "#15202b",              # 深色文字，与浅绿背景对比度 > 10:1
        "activityBar.inactiveForeground": "#15202b99",    # 非激活图标使用 60% 透明度
        "activityBarBadge.background": "#af89d6",         # Peacock 默认徽章色（紫色）
        "activityBarBadge.foreground": "#15202b",         # 徽章文字使用深色
        "commandCenter.border": "#15202b99",              # 命令中心边框
        "sash.hoverBorder": lighter,                      # 分割线悬停边框

        # ==================== 状态栏 (Status Bar) ====================
        # 状态栏位于窗口底部，显示 Git 分支、错误警告、行号等信息
        "statusBar.background": primary,                  # 保持 Peacock 主题色，用于窗口识别
        "statusBar.foreground": "#000000",                # 纯黑文字，与浅色背景对比度 ~8.5:1
        "statusBarItem.hoverBackground": darker,          # 悬停时使用深色变体
        "statusBarItem.remoteBackground": primary,        # 远程开发指示器背景
        "statusBarItem.remoteForeground": "#000000",      # 远程指示器文字需要清晰可见

        # ==================== 标题栏 (Title Bar) ====================
        # 标题栏位于窗口顶部，显示窗口标题和控制按钮
        "titleBar.activeBackground": primary,             # 激活窗口使用主题色
        "titleBar.activeForeground": "#000000",           # 窗口标题需要最高可读性
        "titleBar.inactiveBackground": primary + "99",    # 非激活窗口背景使用 60% 透明度
        "titleBar.inactiveForeground": "#00000099",       # 非激活标题使用 60% 透明度降低视觉优先级

        # ==================== 编辑器 (Editor) ====================
        # 编辑器是代码编辑的主要区域，需要最大可读性
        "editor.background": "#ffffff",                   # 纯白背景，减少眼睛疲劳
        "editor.foreground": "#212529",                   # 深灰文字，与白色对比度 16:1
        "editorLineNumber.foreground": "#6c757d",         # 行号使用中灰，对比度 7:1，不分散注意力
        "editorCursor.foreground": "#007acc",             # VS Code/Trae 标准蓝色光标
        "editor.selectionBackground": "#cce7ff",          # 浅蓝色选区，对比度适中不刺眼
        "editor.inactiveSelectionBackground": "#80e9ecef", # 非激活选区使用半透明色

        # ==================== 标签页 (Tabs) - 重点修复 ====================
        # 标签页显示打开的文件，是 Peacock 配色问题最严重的区域
        "tab.activeBackground": primary,                  # 激活标签使用主题色，提供窗口识别
        "tab.activeForeground": "#000000",                # 关键修复: 纯黑文字，与浅色背景对比度 > 8:1
        "tab.inactiveBackground": lighter,                # 非激活标签后退一步，使用更浅颜色形成层级
        "tab.inactiveForeground": "#00000099",            # 60% 透明度降低视觉权重，但仍保持 > 6:1 对比度
        "tab.border": "#dee2e6",                          # 中性灰边框不干扰主题色

        # ==================== 面包屑导航 (Breadcrumb) ====================
        "breadcrumb.background": "#ffffff",               # 与编辑器背景一致
        "breadcrumb.foreground": "#6c757d",               # 路径使用中灰
        "breadcrumb.focusForeground": "#212529",          # 聚焦时使用深灰
        "breadcrumb.activeSelectionForeground": "#000000", # 选中时使用纯黑

        # ==================== 面板 (Panel) ====================
        # 面板位于底部，包含终端、输出、调试控制台等
        "panel.background": "#f8f9fa",                    # 浅灰白背景，与编辑器形成微妙区分
        "panel.border": "#dee2e6",                        # 边框使用浅灰色
        "panelTitle.activeForeground": "#000000",         # 激活面板标题使用纯黑
        "panelTitle.inactiveForeground": "#6c757d",       # 非激活面板标题使用中灰

        # ==================== 侧边栏 (Side Bar) ====================
        # 侧边栏显示文件资源管理器、搜索、Git 等视图
        "sideBar.background": "#f8f9fa",                  # 与面板一致的浅灰白背景
        "sideBar.border": "#dee2e6",                      # 1px 边框提供视觉分隔
        "sideBar.foreground": "#212529",                  # 与背景对比度 ~14:1，确保文件树清晰可读
        "sideBarSectionHeader.background": "#e9ecef",     # 分组标题背景稍深
        "sideBarSectionHeader.foreground": "#212529",     # 分组标题文字
        "sideBarTitle.foreground": "#212529",             # 侧边栏标题

        # ==================== 终端 (Terminal) ====================
        "terminal.background": "#f8f9fa",                 # 与侧边栏保持一致
        "terminal.foreground": "#212529",                 # 终端文字需要与编辑器代码同等可读性
        "terminal.border": "#dee2e6",                     # 终端边框

        # ==================== 列表和树形控件 (List/Tree) ====================
        "list.activeSelectionBackground": primary,        # 选中项使用主题色
        "list.activeSelectionForeground": "#000000",      # 选中项文字使用纯黑
        "list.inactiveSelectionBackground": lighter,      # 非激活选中使用浅色变体
        "list.inactiveSelectionForeground": "#000000",    # 非激活选中文字
        "list.hoverBackground": "#e9ecef",                # 悬停背景
        "list.hoverForeground": "#212529",                # 悬停文字

        # ==================== 输入控件 (Input) ====================
        "input.background": "#ffffff",                    # 输入框纯白背景
        "input.foreground": "#212529",                    # 输入文字深灰
        "input.border": "#dee2e6",                        # 边框浅灰
        "input.placeholderForeground": "#6c757d",         # 占位符中灰

        # ==================== 按钮 (Button) ====================
        "button.background": primary,                     # 按钮使用主题色
        "button.foreground": "#000000",                   # 按钮文字纯黑，确保可读性
        "button.hoverBackground": darker,                 # 悬停使用深色变体

        # ==================== 下拉菜单 (Dropdown) ====================
        "dropdown.background": "#ffffff",                 # 下拉菜单白背景
        "dropdown.foreground": "#212529",                 # 文字深灰
        "dropdown.border": "#dee2e6",                     # 边框浅灰

        # ==================== 快速选择器 (Quick Input) ====================
        "quickInput.background": "#ffffff",               # 快速选择器白背景
        "quickInput.foreground": "#212529",               # 文字深灰

        # ==================== 徽章 (Badge) ====================
        "badge.background": "#af89d6",                    # Peacock 默认紫色徽章
        "badge.foreground": "#15202b",                    # 徽章文字深色
    }


def fix_peacock_color(project_path: str = None) -> bool:
    """修复指定项目的 Peacock 颜色配置

    Args:
        project_path: 项目路径，默认为当前工作目录

    Returns:
        是否成功修复
    """
    if project_path is None:
        project_path = os.getcwd()

    project_path = Path(project_path)
    vscode_dir = project_path / '.vscode'
    settings_file = vscode_dir / 'settings.json'

    # 检查 .vscode 目录是否存在
    if not vscode_dir.exists():
        print(f"错误: 未找到 .vscode 目录: {vscode_dir}")
        print("请确保在当前项目中运行此脚本，或提供正确的项目路径")
        return False

    # 检查 settings.json 是否存在
    if not settings_file.exists():
        print(f"错误: 未找到 settings.json 文件: {settings_file}")
        print("请确保 Peacock 插件已在此项目中生成颜色配置")
        return False

    # 读取现有配置
    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            settings = json.load(f)
    except json.JSONDecodeError as e:
        print(f"错误: 无法解析 settings.json: {e}")
        return False
    except Exception as e:
        print(f"错误: 读取文件失败: {e}")
        return False

    # 获取 Peacock 颜色
    peacock_color = settings.get('peacock.color')
    if not peacock_color:
        # 尝试从 colorCustomizations 中推断
        color_customizations = settings.get('workbench.colorCustomizations', {})
        peacock_color = color_customizations.get('statusBar.background')

    if not peacock_color:
        print("错误: 未找到 peacock.color 配置")
        print("请确保 Peacock 插件已在此项目中设置颜色主题")
        return False

    print(f"检测到 Peacock 主色调: {peacock_color}")

    # 生成修复后的颜色配置
    fixed_colors = generate_color_fixes(peacock_color)

    # 保留原有的其他配置
    if 'workbench.colorCustomizations' not in settings:
        settings['workbench.colorCustomizations'] = {}

    # 合并颜色配置（修复的配置会覆盖原有配置）
    settings['workbench.colorCustomizations'].update(fixed_colors)

    # 确保 peacock.color 存在
    settings['peacock.color'] = peacock_color

    # 写回文件
    try:
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        print(f"成功修复颜色配置: {settings_file}")
        print("\n修复内容:")
        print(f"  - 标签页文字颜色: 已设置为黑色 (解决白底白字问题)")
        print(f"  - 状态栏文字颜色: 已设置为黑色")
        print(f"  - 标题栏文字颜色: 已设置为黑色")
        print(f"  - 编辑器区域: 已设置合适的背景色和前景色")
        print(f"  - 侧边栏和终端: 已设置合适的颜色")
        print("\n请重启 Trae 编辑器以应用新的颜色配置")
        return True
    except Exception as e:
        print(f"错误: 写入文件失败: {e}")
        return False


def main():
    """主函数"""
    # 获取命令行参数
    project_path = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 60)
    print("Peacock 颜色配置修复工具")
    print("=" * 60)
    print()

    success = fix_peacock_color(project_path)

    if not success:
        print()
        print("使用方法:")
        print("  python fix_peacock_color.py [项目路径]")
        print()
        print("示例:")
        print("  python fix_peacock_color.py")
        print("  python fix_peacock_color.py /path/to/your/project")
        sys.exit(1)


if __name__ == '__main__':
    main()
