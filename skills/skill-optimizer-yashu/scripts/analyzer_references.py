"""文件引用完整性检查模块

跨平台使用：python analyzer_references.py
"""

import re
from pathlib import Path
from typing import Any, Dict


def check_file_references(analyzer) -> Dict[str, Any]:
    """检查文件引用完整性"""
    result = {
        "scripts_referenced": [],
        "scripts_missing": [],
        "references_referenced": [],
        "references_missing": [],
        "assets_referenced": [],
        "assets_missing": [],
    }

    # 移除代码块内容，避免分析示例代码
    content_without_code_blocks = re.sub(r"```[\s\S]*?```", "", analyzer.content)

    # 提取引用的文件路径
    md_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content_without_code_blocks)
    code_refs = re.findall(r"`([^`]+)`", content_without_code_blocks)

    all_refs = [link[1] for link in md_links] + code_refs

    for ref in all_refs:
        ref_path = ref.strip()

        # 检查 scripts/
        if ref_path.startswith("scripts/") or ref_path.startswith("scripts\\"):
            script_name = Path(ref_path).name
            result["scripts_referenced"].append(script_name)

            script_file = analyzer.skill_path / ref_path.replace("\\", "/")
            if not script_file.exists():
                result["scripts_missing"].append(ref_path)
                analyzer.issues.append(f"错误: 引用的脚本不存在: {ref_path}")

        # 检查 references/
        elif ref_path.startswith("references/") or ref_path.startswith("references\\"):
            ref_name = Path(ref_path).name
            result["references_referenced"].append(ref_name)

            ref_file = analyzer.skill_path / ref_path.replace("\\", "/")
            if not ref_file.exists():
                result["references_missing"].append(ref_path)
                analyzer.issues.append(f"错误: 引用的参考文件不存在: {ref_path}")

        # 检查 assets/
        elif ref_path.startswith("assets/") or ref_path.startswith("assets\\"):
            asset_name = Path(ref_path).name
            result["assets_referenced"].append(asset_name)

            asset_file = analyzer.skill_path / ref_path.replace("\\", "/")
            if not asset_file.exists():
                result["assets_missing"].append(ref_path)
                analyzer.issues.append(f"错误: 引用的资源不存在: {ref_path}")

    # 检查是否有未引用的脚本
    scripts_dir = analyzer.skill_path / "scripts"
    if scripts_dir.exists():
        py_files = list(scripts_dir.glob("*.py"))
        referenced_names = set(result["scripts_referenced"])

        unreferenced = [f.name for f in py_files if f.name not in referenced_names]
        if unreferenced:
            analyzer.issues.append(
                f"提示: scripts/ 中有未引用的文件: {', '.join(unreferenced)}"
            )

        # 检查脚本文件大小（推荐 < 500 行）
        for py_file in py_files:
            line_count = len(py_file.read_text(encoding="utf-8").split("\n"))
            if line_count > 500:
                analyzer.issues.append(
                    f"建议: 脚本文件 '{py_file.name}' 有 {line_count} 行，建议保持在 500 行以内，考虑拆分功能"
                )

    # 检查文件引用格式
    code_blocks = re.findall(r"```[\s\S]*?```", analyzer.content)
    for block in code_blocks:
        file_refs = re.findall(
            r"(?:python|bash|sh|cmd)\s+(scripts/\S+|references/\S+|assets/\S+)",
            block,
        )
        for ref in file_refs:
            md_link_pattern = rf"\[([^\]]+)\]\({re.escape(ref)}\)"
            if not re.search(md_link_pattern, analyzer.content):
                analyzer.issues.append(
                    f"建议: 文件 '{ref}' 在代码示例中被引用，建议在正文中添加 Markdown 链接说明，如 [{Path(ref).name}]({ref})"
                )

    # 检查 references/ 目录下的文件是否都被引用
    references_dir = analyzer.skill_path / "references"
    if references_dir.exists():
        ref_files = list(references_dir.glob("*.md"))
        referenced_files = set(result["references_referenced"])

        for ref_file in ref_files:
            ref_name = ref_file.name
            if ref_name not in referenced_files:
                analyzer.issues.append(
                    f"警告: references/ 中的文件 '{ref_name}' 没有在 SKILL.md 中被引用，"
                    f"建议添加引用如 [描述文字](references/{ref_name})"
                )

    # 检查引用格式是否规范（显示文本应该描述文件内容，而不只是文件名）
    for link_text, link_path in md_links:
        if link_path.startswith("references/") or link_path.startswith("references\\"):
            ref_name = Path(link_path).name
            # 如果显示文本就是文件名（没有描述性内容），给出建议
            if link_text == ref_name or link_text == ref_name.replace(".md", ""):
                analyzer.issues.append(
                    f"提示: 引用 '{link_path}' 的显示文本可以更具描述性，"
                    f"当前为 '[{link_text}]'，建议改为 '[描述文件内容的文字]({link_path})'"
                )

    return result
