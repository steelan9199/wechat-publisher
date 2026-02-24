"""使用说明完整性检查模块

跨平台使用：python analyzer_usage.py
"""

import re
from typing import Any, Dict


def check_usage_guide(analyzer) -> Dict[str, Any]:
    """检查是否包含'如何使用这个 skill'的内容"""
    result = {
        "has_usage_guide": False,
        "usage_section_title": None,
        "suggested_content": [],
    }

    # 定义可能的章节标题模式（中英文）
    usage_patterns = [
        r"##\s*如何使用这个\s*[Ss]kill",
        r"##\s*如何使用",
        r"##\s*使用说明",
        r"##\s*使用指南",
        r"##\s*Usage",
        r"##\s*How to Use",
        r"##\s*Getting Started",
    ]

    # 检查是否包含使用说明章节
    for pattern in usage_patterns:
        match = re.search(pattern, analyzer.body, re.IGNORECASE)
        if match:
            result["has_usage_guide"] = True
            result["usage_section_title"] = match.group(0).strip()
            break

    if not result["has_usage_guide"]:
        analyzer.issues.append(
            "建议: SKILL.md 缺少'如何使用这个 skill'的说明章节，建议添加 '## 如何使用这个 Skill' 部分"
        )
        result["suggested_content"] = [
            "功能概述 - 描述 skill 的核心功能和适用场景",
            "使用方式 - 列出用户触发 skill 的示例方式",
            "工作流程 - 说明 skill 被触发后的执行步骤",
            "注意事项 - 重要提示和限制",
        ]
    else:
        # 检查使用说明章节的内容完整性
        section_title = result["usage_section_title"]
        # 使用负向前瞻，确保只匹配 ## 而不是 ###
        pattern = rf"{re.escape(section_title)}\n(.*?)(?=\n##[^#]|\Z)"
        match = re.search(pattern, analyzer.body, re.DOTALL | re.IGNORECASE)

        if match:
            usage_content = match.group(1)
            # 过滤空行后计算有效行数
            non_empty_lines = [
                line for line in usage_content.split("\n") if line.strip()
            ]
            usage_lines = len(non_empty_lines)

            # 检查内容是否足够详细（至少 5 行有效内容）
            if usage_lines < 5:
                analyzer.issues.append(
                    f"建议: '{section_title}' 章节内容较简略（仅 {usage_lines} 行有效内容），建议补充更详细的使用说明"
                )

            # 检查是否包含示例（代码块或引号内的示例）
            has_examples = bool(
                re.search(r"```", usage_content)  # 代码块
                or re.search(r"[\"'][^\"']{5,}[\"']", usage_content)  # 引号内的文本
                or "示例" in usage_content
                or "Example" in usage_content
            )
            if not has_examples:
                analyzer.issues.append(
                    f"建议: '{section_title}' 章节缺少具体示例，建议添加用户请求示例"
                )

    return result
