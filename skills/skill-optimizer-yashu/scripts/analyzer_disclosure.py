"""渐进式披露结构检查模块

跨平台使用：python analyzer_disclosure.py
"""

import re
from pathlib import Path
from typing import Any, Dict


def check_progressive_disclosure(analyzer) -> Dict[str, Any]:
    """检查渐进式披露结构"""
    result = {
        "line_count": len(analyzer.content.split("\n")),
        "body_line_count": len(analyzer.body.split("\n")),
        "too_long": False,
        "should_split": False,
        "references_exist": (analyzer.skill_path / "references").exists(),
        "scripts_exist": (analyzer.skill_path / "scripts").exists(),
        "assets_exist": (analyzer.skill_path / "assets").exists(),
    }

    # 检查行数（推荐 < 500 行）
    if result["line_count"] > 500:
        result["too_long"] = True
        analyzer.issues.append(
            f"警告: SKILL.md 共 {result['line_count']} 行，建议保持在 500 行以内"
        )
        result["should_split"] = True

    # 检查大段落（可能适合移到 references/）
    large_sections = []
    sections = re.findall(r"^##\s+(.+)$", analyzer.body, re.MULTILINE)

    for section in sections:
        pattern = rf"##\s+{re.escape(section)}\n(.*?)(?=##\s+|\Z)"
        match = re.search(pattern, analyzer.body, re.DOTALL)
        if match:
            section_lines = len(match.group(1).split("\n"))
            if section_lines > 100:
                large_sections.append({"name": section, "lines": section_lines})

    if large_sections:
        result["large_sections"] = large_sections
        for sec in large_sections:
            analyzer.issues.append(
                f"建议: 章节 '{sec['name']}' 有 {sec['lines']} 行，考虑移到 references/"
            )

    return result
