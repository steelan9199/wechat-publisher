"""
Skill 模板定义模块
包含 SKILL.md 和各种示例文件的模板
遵循 skill-laws 核心法则设计

跨平台使用：python skill_templates.py
"""


def get_skill_template(skill_name: str, skill_title: str) -> str:
    """获取 SKILL.md 模板内容 - 符合 skill-laws 核心法则"""
    return (
        "---\n"
        "name: " + skill_name + "\n"
        'description: 【一句话描述核心功能】。何时使用：当用户说"【触发词1】"、"【触发词2】"或"【触发词3】"时。\n'
        "---\n"
        "\n"
        "## 🎯 触发映射\n"
        "\n"
        "| 用户输入触发词 | AI 执行动作 |\n"
        "| -------------- | ----------- |\n"
        '| "【触发词1】" / "【触发词2】" | 按【主模式】执行 |\n'
        "\n"
        "## 【主模式】\n"
        "\n"
        "### 执行步骤\n"
        "\n"
        "| 步骤 | 执行动作 | 具体命令/操作 |\n"
        "| ---- | -------- | ------------- |\n"
        "| 1 | 【动作描述】 | 运行 `【工具名】` 【参数说明】 |\n"
        "| 2 | 【动作描述】 | 运行 `【工具名】` 【参数说明】 |\n"
        "| 3 | 【动作描述】 | 运行 `【工具名】` 【参数说明】 |\n"
        "\n"
        "### 输出结果\n"
        "\n"
        "**成功时输出示例：**\n"
        "\n"
        "```\n"
        "✅ 【成功状态描述】\n"
        "\n"
        "📋 输出内容：\n"
        "- 【输出项1】: {值1}\n"
        "- 【输出项2】: {值2}\n"
        "\n"
        "📝 下一步：【后续操作建议】\n"
        "```\n"
        "\n"
        "**失败时输出示例：**\n"
        "\n"
        "```\n"
        "❌ 【失败状态描述】\n"
        "\n"
        "错误原因：{具体错误信息}\n"
        "解决建议：{针对性解决方案}\n"
        "```\n"
        "\n"
        "### 错误处理\n"
        "\n"
        "| 错误场景 | 错误表现 | 处理方式 |\n"
        "| -------- | -------- | -------- |\n"
        "| 【场景1】 | 【表现描述】 | 运行 `【检查命令】`，然后【处理动作】 |\n"
        "| 【场景2】 | 【表现描述】 | 运行 `【检查命令】`，然后【处理动作】 |\n"
        "\n"
        "## Resources\n"
        "\n"
        "- [【脚本名】.py](scripts/【脚本名】.py) - 【脚本功能说明】\n"
    )


def get_example_script(skill_name: str) -> str:
    """获取示例脚本内容 - AI友好的输入输出格式"""
    return (
        "#!/usr/bin/env python3\n"
        '"""\n' + skill_name + " - 【一句话描述功能】\n"
        "\n"
        "AI友好设计：\n"
        "- 输入：命令行参数，支持 JSON 格式\n"
        "- 输出：结构化 JSON，包含明确字段名\n"
        "- 错误：返回非零退出码，错误信息输出到 stderr\n"
        '"""\n'
        "\n"
        "import argparse\n"
        "import json\n"
        "import sys\n"
        "\n"
        "\n"
        "def main():\n"
        '    parser = argparse.ArgumentParser(description="【脚本功能描述】")\n'
        '    parser.add_argument("--input", "-i", required=True, help="输入数据(JSON格式)")\n'
        "    args = parser.parse_args()\n"
        "    \n"
        "    try:\n"
        "        # 解析输入\n"
        '        input_data = json.loads(args.input) if args.input.startswith("{") else {"data": args.input}\n'
        "        \n"
        "        # TODO: 实现具体的处理逻辑\n"
        "        result = {\n"
        '            "status": "success",\n'
        '            "data": input_data,\n'
        '            "output": "处理结果",\n'
        '            "message": "操作成功完成"\n'
        "        }\n"
        "        \n"
        "        # AI友好的输出\n"
        "        print(json.dumps(result, ensure_ascii=False, indent=2))\n"
        "        return 0\n"
        "    except json.JSONDecodeError as e:\n"
        '        error = {"status": "error", "error": f"JSON解析错误: {str(e)}"}\n'
        "        print(json.dumps(error, ensure_ascii=False), file=sys.stderr)\n"
        "        return 1\n"
        "    except Exception as e:\n"
        '        error = {"status": "error", "error": str(e)}\n'
        "        print(json.dumps(error, ensure_ascii=False), file=sys.stderr)\n"
        "        return 1\n"
        "\n"
        "\n"
        'if __name__ == "__main__":\n'
        "    sys.exit(main())\n"
    )


def get_example_reference(skill_title: str) -> str:
    """获取示例参考文档内容"""
    return (
        "# " + skill_title + " 详细参考\n"
        "\n"
        "## 概述\n"
        "\n"
        "本文档提供 " + skill_title + " 的详细参考信息。\n"
        "\n"
        "## 使用场景\n"
        "\n"
        "### 场景1：【场景描述】\n"
        "\n" + '**触发条件**：当用户说"【具体话术】"时\n'
        "\n"
        "**执行步骤**：\n"
        "\n"
        "| 步骤 | 动作 | 命令 |\n"
        "| ---- | ---- | ---- |\n"
        "| 1 | 【动作】 | 运行 `【命令】` |\n"
        "\n"
        "**预期输出**：\n"
        "\n"
        "```\n"
        "【输出示例】\n"
        "```\n"
    )


# 示例资源文件内容
EXAMPLE_ASSET = """# 示例资源文件

这是一个示例资源文件。

根据 skill 的实际需求，可以：
1. 修改此文件内容
2. 删除此文件
3. 添加其他类型的资源文件

## AI友好原则

- 资源文件应该便于 AI 理解和使用
- 使用结构化格式（JSON/YAML/表格）
- 避免需要复杂解析的自然语言描述
"""
