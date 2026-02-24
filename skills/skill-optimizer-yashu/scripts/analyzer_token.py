"""Token 效率检查模块

跨平台使用：python analyzer_token.py
"""

import re
from typing import Any, Dict


def check_token_efficiency(analyzer) -> Dict[str, Any]:
    """检查 Token 效率"""
    result = {
        "char_count": len(analyzer.content),
        "has_tables": "|" in analyzer.content,
        "has_lists": bool(re.search(r"^[\s]*[-*+\d]\.", analyzer.body, re.MULTILINE)),
        "verbose_paragraphs": [],
    }

    # 检查长段落
    paragraphs = analyzer.body.split("\n\n")
    for p in paragraphs:
        if len(p) > 300 and not p.startswith("```") and not p.startswith("|"):
            result["verbose_paragraphs"].append(p[:80] + "...")

    if len(result["verbose_paragraphs"]) > 3:
        analyzer.issues.append(
            f"建议: 有 {len(result['verbose_paragraphs'])} 个长段落，考虑用表格或列表简化"
        )

    # 检查是否有重复内容
    lines = [l.strip() for l in analyzer.body.split("\n") if l.strip()]
    unique_lines = set(lines)
    if len(lines) > 50 and len(unique_lines) / len(lines) < 0.7:
        analyzer.issues.append("建议: 文档可能有较多重复内容")

    return result
