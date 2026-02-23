#!/usr/bin/env python3
"""Frontmatter 检查模块"""

import re
from typing import Any, Dict, List


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

    # 检查 description 内容质量：是否包含触发条件
    if desc:
        has_function = len(desc) > 10
        trigger_patterns = [
            r"当[^。]+时",
            r"使用此技能",
            r"触发",
            r"需要[^。]+(?:帮助|协助|支持)",
        ]
        has_trigger = any(re.search(p, desc) for p in trigger_patterns)

        result["description"]["has_function"] = has_function
        result["description"]["has_trigger"] = has_trigger

        if not has_trigger:
            result["description"]["issues"].append(
                "description 缺少触发条件，建议添加'当...时使用此技能'"
            )
            analyzer.issues.append(
                "建议: description 应包含使用场景和触发条件，如'当用户需要...时使用此技能'"
            )

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

    return result
