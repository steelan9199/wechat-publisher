"""Frontmatter 检查模块

跨平台使用：python analyzer_frontmatter.py
"""

import re
from typing import Any, Dict


def semantic_check_description(desc: str) -> Dict[str, Any]:
    """
    语义检查 description 是否包含功能描述和触发条件
    返回包含 has_function_desc 和 has_trigger_condition 的字典
    """
    result = {
        "has_function_desc": False,
        "has_trigger_condition": False,
        "function_keywords": [],
        "trigger_keywords": [],
        "suggestions": [],
    }

    # 功能描述关键词（表示这个 skill 是做什么的）
    function_indicators = [
        "分析",
        "检查",
        "优化",
        "生成",
        "创建",
        "转换",
        "处理",
        "管理",
        "查询",
        "搜索",
        "下载",
        "上传",
        "同步",
        "部署",
        "构建",
        "测试",
        "调试",
        "监控",
        "备份",
        "恢复",
        "清理",
        "统计",
        "计算",
        "验证",
        "修复",
        "更新",
        "删除",
        "添加",
        "用于",
        "用来",
        "功能",
        "作用",
        "可以",
        "能够",
    ]

    # 触发条件关键词（表示什么时候使用这个 skill）
    trigger_indicators = [
        "当",
        "如果",
        "遇到",
        "需要",
        "想要",
        "希望",
        "时",
        "情况下",
        "场景",
        "情形",
        "使用此技能",
        "使用本技能",
        "使用这个 skill",
        "触发",
        "执行",
        "调用",
    ]

    # 检查功能描述
    found_function = []
    for keyword in function_indicators:
        if keyword in desc:
            found_function.append(keyword)

    # 判断是否包含功能描述（至少包含2个功能相关词，或描述足够详细）
    if len(found_function) >= 2 or (len(found_function) >= 1 and len(desc) > 30):
        result["has_function_desc"] = True
    result["function_keywords"] = found_function

    # 检查触发条件
    found_trigger = []
    for keyword in trigger_indicators:
        if keyword in desc:
            found_trigger.append(keyword)

    # 判断是否包含触发条件（多种表达方式都可以）
    # 方式1: "当...时" 结构（如：当用户说...时、当遇到...时）
    has_when_structure = "当" in desc and (
        "时" in desc or "情况下" in desc or "场景" in desc
    )

    # 方式2: "何时使用" 格式（推荐格式）
    has_when_use_format = "何时使用" in desc or "何时触发" in desc

    # 方式3: 明确的触发词
    has_explicit_trigger = any(
        kw in desc
        for kw in ["使用此技能", "使用本技能", "使用这个 skill", "触发", "调用"]
    )

    # 方式4: 包含足够多的触发相关词（至少1个）
    has_enough_trigger_words = len(found_trigger) >= 1

    # 满足任一条件即认为有触发条件说明
    if (
        has_when_structure
        or has_when_use_format
        or has_explicit_trigger
        or has_enough_trigger_words
    ):
        result["has_trigger_condition"] = True
    result["trigger_keywords"] = found_trigger

    # 生成建议
    if not result["has_function_desc"]:
        result["suggestions"].append(
            "description 应该清晰说明这个 skill 的功能（如：分析、生成、处理等）"
        )

    if not result["has_trigger_condition"]:
        result["suggestions"].append(
            "description 应该包含使用场景或触发条件（如：何时使用：当用户说...时、用于...场景、遇到...情况时）"
        )

    return result


def check_frontmatter(analyzer) -> Dict[str, Any]:
    """检查 frontmatter 格式"""
    result = {
        "has_frontmatter": bool(analyzer.frontmatter),
        "name": {"value": "", "valid": False, "issues": []},
        "description": {"value": "", "valid": False, "issues": []},
        "optional_fields": {},
    }

    if not analyzer.frontmatter:
        analyzer.issues.append("错误: 缺少 frontmatter (--- name/description ---)")
        return result

    # 检查 name
    name = analyzer.frontmatter.get("name", "")
    result["name"]["value"] = name

    if not name:
        result["name"]["issues"].append("name 不能为空")
        analyzer.issues.append("错误: frontmatter 缺少 name 字段")
    elif len(name) > 64:
        result["name"]["issues"].append(f"name 长度 {len(name)} 超过 64 字符限制")
        analyzer.issues.append(f"错误: name 长度 {len(name)} 超过 64 字符")
    elif not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name):
        result["name"]["issues"].append(
            "name 只能包含小写字母、数字、连字符，不能以连字符开头或结尾"
        )
        analyzer.issues.append(f"错误: name '{name}' 格式不符合规范")
    else:
        result["name"]["valid"] = True

    # 检查 description
    desc = analyzer.frontmatter.get("description", "")
    result["description"]["value"] = desc

    if not desc:
        result["description"]["issues"].append("description 不能为空")
        analyzer.issues.append("错误: frontmatter 缺少 description 字段")
    elif len(desc) > 1024:
        result["description"]["issues"].append(
            f"description 长度 {len(desc)} 超过 1024 字符限制"
        )
        analyzer.issues.append(f"错误: description 长度 {len(desc)} 超过 1024 字符")
    else:
        result["description"]["valid"] = True

    # 使用语义检查 description 内容质量
    if desc:
        semantic_result = semantic_check_description(desc)

        result["description"]["has_function"] = semantic_result["has_function_desc"]
        result["description"]["has_trigger"] = semantic_result["has_trigger_condition"]
        result["description"]["semantic_check"] = semantic_result

        # 根据语义检查结果添加建议
        if not semantic_result["has_function_desc"]:
            result["description"]["issues"].append(
                f"description 缺少清晰的功能描述（检测到的功能词: {', '.join(semantic_result['function_keywords']) or '无'}）"
            )
            analyzer.issues.append(
                "建议: description 应该清晰说明这个 skill 的功能，如'分析...'、'生成...'、'处理...'等"
            )

        if not semantic_result["has_trigger_condition"]:
            result["description"]["issues"].append(
                f"description 缺少触发条件说明（检测到的触发词: {', '.join(semantic_result['trigger_keywords']) or '无'}）"
            )
            analyzer.issues.append(
                "建议: description 应该包含使用场景和触发条件，如'当用户需要...时'、'当遇到...情况时'"
            )

        # 如果语义检查通过，给出正面反馈
        if (
            semantic_result["has_function_desc"]
            and semantic_result["has_trigger_condition"]
        ):
            result["description"]["quality"] = "良好"
        elif (
            semantic_result["has_function_desc"]
            or semantic_result["has_trigger_condition"]
        ):
            result["description"]["quality"] = "一般"
        else:
            result["description"]["quality"] = "需改进"

    # 检查可选字段
    optional_fields = ["license", "compatibility", "metadata", "allowed-tools"]
    for field in optional_fields:
        if field in analyzer.frontmatter:
            result["optional_fields"][field] = analyzer.frontmatter[field]

    # 检查是否有非法的顶层字段（应该在 metadata 下的字段）
    invalid_top_level_fields = ["author", "updated", "version", "tags"]
    for field in invalid_top_level_fields:
        if field in analyzer.frontmatter:
            analyzer.issues.append(
                f"警告: '{field}' 字段应该放在 'metadata' 对象下，而不是 frontmatter 根级别"
            )

    # 检查 metadata.updated 字段格式
    metadata = analyzer.frontmatter.get("metadata", {})
    if metadata and "updated" in metadata:
        updated_value = metadata["updated"]
        # 标准格式: YYYY-MM-DD HH:MM:SS（必须精确到秒）
        if not re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", updated_value):
            analyzer.issues.append(
                f"警告: metadata.updated 格式不正确 '{updated_value}'，必须使用 'YYYY-MM-DD HH:MM:SS' 格式并精确到秒（如: 2026-02-24 14:30:00）"
            )
        result["optional_fields"]["metadata_updated"] = updated_value

    return result
