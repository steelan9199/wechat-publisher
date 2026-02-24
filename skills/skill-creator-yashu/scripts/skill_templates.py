#!/usr/bin/env python3
"""
Skill 模板定义模块
包含 SKILL.md 和各种示例文件的模板
"""


def get_skill_template(skill_name: str, skill_title: str) -> str:
    """获取 SKILL.md 模板内容"""
    # 使用字符串拼接避免 f-string 嵌套问题
    return (
        "---\n"
        "name: " + skill_name + "\n"
        'description: "【一句话描述核心功能】。当用户【触发条件1】、【触发条件2】或【触发条件3】时，使用该技能。"\n'
        "---\n"
        "\n"
        "# " + skill_title + "\n"
        "\n"
        "## 功能概述\n"
        "\n"
        "【用1-2句话描述这个 skill 能做什么】\n"
        "\n"
        "## 如何使用\n"
        "\n"
        "### 执行步骤\n"
        "\n"
        "1. **【步骤1名称】**\n"
        "   - 【具体操作说明】\n"
        "   - 运行命令：`python scripts/【脚本名】.py 【参数】`\n"
        "\n"
        "2. **【步骤2名称】**\n"
        "   - 【具体操作说明】\n"
        "\n"
        "3. **【步骤3名称】**\n"
        "   - 【具体操作说明】\n"
        "\n"
        "### 输出格式\n"
        "\n"
        "```\n"
        "【示例输出格式】\n"
        "```\n"
        "\n"
        "### 示例\n"
        "\n"
        '**用户请求**："【具体示例请求】"\n'
        "\n"
        "**执行**：\n"
        "```bash\n"
        "python scripts/【脚本】.py 【参数】\n"
        "```\n"
        "\n"
        "**结果**：【结果说明】\n"
        "\n"
        "### 注意事项\n"
        "\n"
        "- 【重要提示1】\n"
        "- 【重要提示2】\n"
        "\n"
        "## Resources\n"
        "\n"
        "- [【脚本名】.py](scripts/【脚本名】.py) - 【脚本功能说明】\n"
    )


def get_example_script(skill_name: str) -> str:
    """获取示例脚本内容"""
    return (
        "#!/usr/bin/env python3\n"
        '"""\n'
        + skill_name + ' - 【一句话描述功能】\n'
        "\n"
        "【详细描述这个脚本的功能】\n"
        "\n"
        "使用示例：\n"
        '    python scripts/' + skill_name + '_helper.py --input "数据"\n'
        '"""\n'
        "\n"
        "import argparse\n"
        "import json\n"
        "import sys\n"
        "\n"
        "\n"
        "def main():\n"
        "    parser = argparse.ArgumentParser(description=\"【脚本功能描述】\")\n"
        '    parser.add_argument("--input", "-i", required=True, help=\"输入数据\")\n'
        "    args = parser.parse_args()\n"
        "    \n"
        "    try:\n"
        "        # TODO: 实现具体的处理逻辑\n"
        '        result = {"status": "success", "input": args.input, "output": "处理结果"}\n'
        "        print(json.dumps(result, ensure_ascii=False, indent=2))\n"
        "        return 0\n"
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
        "\n"
        "【详细说明】\n"
    )


# 示例资源文件内容
EXAMPLE_ASSET = """# 示例资源文件

这是一个示例资源文件。

根据 skill 的实际需求，可以：
1. 修改此文件内容
2. 删除此文件
3. 添加其他类型的资源文件
"""
