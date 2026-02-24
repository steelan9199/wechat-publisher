"""AI 友好性检查模块

检查 SKILL.md 主文档和 references/ 目录下文档的 AI 友好性。
主文档要求更严格，引用文档适当放宽。

跨平台使用：python analyzer_ai_friendly.py
"""

import re
from typing import Any, Dict


def check_ai_friendly(analyzer) -> Dict[str, Any]:
    """检查 SKILL.md 和 references/ 文档是否对 AI 友好"""
    result = {
        "score": 100,
        "checks": {},
        "improvements": [],
        "main_doc": {},
        "reference_docs": [],
    }

    # 1. 检查主文档 SKILL.md
    main_result = _check_single_document(
        content=analyzer.body,
        frontmatter=analyzer.frontmatter,
        is_main_doc=True,
    )
    result["main_doc"] = main_result

    # 将主文档问题添加到全局 issues
    for issue in main_result["issues"]:
        analyzer.issues.append(f"AI友好(主文档): {issue}")

    # 2. 检查 references/ 目录下的文档
    references_dir = analyzer.skill_path / "references"
    if references_dir.exists():
        for ref_file in sorted(references_dir.glob("*.md")):
            ref_content = ref_file.read_text(encoding="utf-8")
            ref_result = _check_single_document(
                content=ref_content,
                frontmatter={},  # 引用文档通常没有 frontmatter
                is_main_doc=False,
                filename=ref_file.name,
            )
            ref_result["filename"] = ref_file.name
            result["reference_docs"].append(ref_result)

            # 将引用文档问题添加到全局 issues（严重程度降低）
            for issue in ref_result["issues"]:
                analyzer.issues.append(f"AI友好(引用文档-{ref_file.name}): {issue}")

    # 计算总体评分（主文档占 70%，引用文档占 30%）
    main_score = main_result["score"]
    if result["reference_docs"]:
        ref_avg_score = sum(r["score"] for r in result["reference_docs"]) / len(
            result["reference_docs"]
        )
        result["score"] = int(main_score * 0.7 + ref_avg_score * 0.3)
    else:
        result["score"] = main_score

    # 评级
    if result["score"] >= 90:
        result["rating"] = "优秀"
    elif result["score"] >= 75:
        result["rating"] = "良好"
    elif result["score"] >= 60:
        result["rating"] = "一般"
    else:
        result["rating"] = "需改进"

    return result


def _is_instruction_document(filename: str, content: str) -> bool:
    """判断文档是否是操作指令类文档

    操作指令类文档：告诉 AI 如何执行某个任务，需要错误处理说明
    参考/建议类文档：提供最佳实践、规范说明等，不需要错误处理说明

    Args:
        filename: 文件名
        content: 文档内容

    Returns:
        True 表示是操作指令类文档，需要检查错误处理说明
    """
    # 1. 从文件名判断（这些关键词通常表示建议/参考类文档）
    guide_keywords = [
        "guide",
        "optimization",
        "best-practice",
        "reference",
        "spec",
        "规范",
        "指南",
        "建议",
        "参考",
        "最佳实践",
        "说明",
    ]
    filename_lower = filename.lower()
    for keyword in guide_keywords:
        if keyword in filename_lower:
            return False

    # 2. 从标题判断
    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if title_match:
        title = title_match.group(1)
        guide_title_keywords = [
            "指南",
            "建议",
            "规范",
            "参考",
            "最佳实践",
            "说明",
            "优化",
        ]
        for keyword in guide_title_keywords:
            if keyword in title:
                return False

    # 3. 从内容特征判断（建议类措辞多于指令类措辞）
    suggestive_patterns = [r"建议", r"推荐", r"可以", r"考虑", r"可选"]
    suggestive_count = sum(len(re.findall(p, content)) for p in suggestive_patterns)

    imperative_patterns = [
        r"运行\s+",
        r"执行\s+",
        r"调用\s+",
        r"使用\s+",
        r"必须",
        r"步骤",
    ]
    imperative_count = sum(len(re.findall(p, content)) for p in imperative_patterns)

    # 如果建议性措辞明显多于指令性措辞，认为是参考文档
    if suggestive_count > imperative_count * 2:
        return False

    return True


def _check_single_document(
    content: str,
    frontmatter: Dict[str, Any],
    is_main_doc: bool,
    filename: str = "SKILL.md",
) -> Dict[str, Any]:
    """检查单个文档的 AI 友好性

    Args:
        content: 文档内容（不含 frontmatter）
        frontmatter: frontmatter 数据
        is_main_doc: 是否为主文档
        filename: 文件名
    """
    issues = []
    score = 100
    checks = {}

    # 判断文档类型（用于决定是否检查错误处理说明）
    is_instruction_doc = _is_instruction_document(filename, content)

    # 根据文档类型设置不同的检查严格度
    if is_main_doc:
        # 主文档：严格要求
        min_desc_length = 20
        long_para_threshold = 500
        score_penalty = {
            "description": 15,
            "imperative": 10,
            "examples": 15,
            "decision": 10,
            "output": 10,
            "error": 10,
            "long_para": 5,
            "file_ref": 5,
        }
    else:
        # 引用文档：放宽要求
        min_desc_length = 10
        long_para_threshold = 800
        score_penalty = {
            "description": 5,  # 引用文档可以没有 description
            "imperative": 5,
            "examples": 5,
            "decision": 5,
            "output": 5,
            "error": 5,
            "long_para": 3,
            "file_ref": 3,
        }

    # 1. 检查 description（仅主文档）
    if is_main_doc:
        desc = frontmatter.get("description", "")
        checks["clear_description"] = {
            "passed": len(desc) > min_desc_length and ("当" in desc or "需要" in desc),
            "message": "description 应清晰描述功能和触发条件",
        }
        if not checks["clear_description"]["passed"]:
            score -= score_penalty["description"]
            issues.append(
                "description 不够清晰，AI 难以判断何时触发此 skill，建议明确描述使用场景"
            )

    # 2. 检查是否有明确的指令
    imperative_patterns = [
        r"运行\s+",
        r"执行\s+",
        r"调用\s+",
        r"使用\s+",
        r"检查\s+",
        r"分析\s+",
        r"创建\s+",
        r"生成\s+",
        r"读取\s+",
        r"写入\s+",
        r"参考\s+",
        r"查看\s+",
    ]
    has_imperative = any(
        re.search(p, content, re.IGNORECASE) for p in imperative_patterns
    )
    checks["imperative_instructions"] = {
        "passed": has_imperative,
        "message": "使用祈使句给出明确指令",
    }
    if not has_imperative:
        score -= score_penalty["imperative"]
        issues.append(
            "缺少明确的操作指令，建议使用祈使句（如'运行'、'执行'、'参考'等）"
        )

    # 3. 检查是否有具体的示例
    has_code_example = "```" in content
    has_user_example = bool(re.search(r"[\"'][^\"']{10,}[\"']", content))
    checks["concrete_examples"] = {
        "passed": has_code_example or has_user_example,
        "message": "提供具体的代码示例或用户请求示例",
    }
    if not (has_code_example or has_user_example):
        score -= score_penalty["examples"]
        issues.append(
            "缺少具体示例，AI 难以理解如何执行，建议添加代码示例或用户请求示例"
        )

    # 4. 检查是否有决策树或条件判断
    has_decision_tree = bool(
        re.search(r"(如果|若|当|是否|选择|分支)", content) or "**" in content
    )
    checks["decision_making"] = {
        "passed": has_decision_tree or len(content) < 200,
        "message": "复杂任务提供决策树或条件判断",
    }
    if len(content) > 400 and not has_decision_tree:
        score -= score_penalty["decision"]
        issues.append("文档较长但缺少决策逻辑，建议为复杂任务添加条件判断或决策树")

    # 5. 检查输出格式是否明确（仅主文档严格要求）
    if is_main_doc:
        output_patterns = [
            r"输出[:：]",
            r"返回[:：]",
            r"格式[:：]",
            r"结果[:：]",
            r"##\s*输出",
            r"##\s*结果",
        ]
        has_output_spec = any(
            re.search(p, content, re.IGNORECASE) for p in output_patterns
        )
        checks["output_specification"] = {
            "passed": has_output_spec,
            "message": "明确说明输出格式",
        }
        if not has_output_spec:
            score -= score_penalty["output"]
            issues.append("缺少输出格式说明，建议明确说明 skill 应该输出什么内容")

    # 6. 检查是否有错误处理说明
    # 只有主文档或操作指令类文档才需要检查错误处理说明
    # 参考/建议类文档（如 check-spec.md）不需要
    if is_main_doc or is_instruction_doc:
        error_patterns = [r"错误", r"异常", r"失败", r"如果.*不", r"注意", r"警告"]
        has_error_handling = any(re.search(p, content) for p in error_patterns)
        checks["error_handling"] = {
            "passed": has_error_handling,
            "message": "说明错误处理或边界情况",
        }
        if not has_error_handling:
            score -= score_penalty["error"]
            issues.append("缺少错误处理说明，建议添加异常情况的处理方式")
    else:
        # 参考/建议类文档，跳过错误处理检查
        checks["error_handling"] = {
            "passed": True,
            "message": "参考类文档不需要错误处理说明",
            "skipped": True,
        }

    # 7. 检查长段落（排除表格和代码块）
    paragraphs = content.split("\n\n")
    long_paragraphs = [
        p
        for p in paragraphs
        if len(p) > long_para_threshold
        and not p.startswith("```")
        and not p.startswith("|")
        and "|" not in p[:10]
    ]
    checks["avoid_long_paragraphs"] = {
        "passed": len(long_paragraphs) == 0,
        "message": f"避免超过 {long_para_threshold} 字符的长段落",
        "long_paragraphs_count": len(long_paragraphs),
    }
    if long_paragraphs:
        score -= score_penalty["long_para"]
        issues.append(
            f"有 {len(long_paragraphs)} 个超过 {long_para_threshold} 字符的长段落，建议拆分为列表或表格"
        )

    # 8. 检查文件引用清晰度
    md_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content)
    has_file_refs = len(md_links) > 0
    checks["file_reference_clarity"] = {
        "passed": has_file_refs
        or not re.search(r"scripts/|references/|assets/", content),
        "message": "引用的文件需要有说明",
    }
    if not checks["file_reference_clarity"]["passed"]:
        score -= score_penalty["file_ref"]
        issues.append("引用的文件缺少 Markdown 链接说明，建议使用 [文件名](路径) 格式")

    return {
        "score": max(0, score),
        "checks": checks,
        "issues": issues,
        "is_main_doc": is_main_doc,
        "filename": filename,
    }
