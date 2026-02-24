"""
Quick validation script for skills - minimal version
修复版：添加 UTF-8 编码支持

跨平台使用：python quick_validate.py
"""

import re
import sys
from pathlib import Path

import yaml


def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)
    warnings = []

    # Check SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "SKILL.md not found", []

    # Read and validate frontmatter (使用 UTF-8 编码)
    content = skill_md.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return False, "No YAML frontmatter found", []

    # Extract frontmatter
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format", []

    frontmatter_text = match.group(1)
    body = content[match.end() :]

    # Parse YAML frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary", []
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}", []

    # Define allowed properties
    ALLOWED_PROPERTIES = {
        "name",
        "description",
        "license",
        "allowed-tools",
        "metadata",
        "compatibility",
    }

    # Check for unexpected properties (excluding nested keys under metadata)
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return (
            False,
            (
                f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
                f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
            ),
            [],
        )

    # Check required fields
    if "name" not in frontmatter:
        return False, "Missing 'name' in frontmatter", []
    if "description" not in frontmatter:
        return False, "Missing 'description' in frontmatter", []

    # Extract name for validation
    name = frontmatter.get("name", "")
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}", []
    name = name.strip()
    if name:
        # Check naming convention (kebab-case: lowercase with hyphens)
        if not re.match(r"^[a-z0-9-]+$", name):
            return (
                False,
                f"Name '{name}' should be kebab-case (lowercase letters, digits, and hyphens only)",
                [],
            )
        if name.startswith("-") or name.endswith("-") or "--" in name:
            return (
                False,
                f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens",
                [],
            )
        # Check name length (max 64 characters per spec)
        if len(name) > 64:
            return (
                False,
                f"Name is too long ({len(name)} characters). Maximum is 64 characters.",
                [],
            )

    # Extract and validate description
    description = frontmatter.get("description", "")
    if not isinstance(description, str):
        return (
            False,
            f"Description must be a string, got {type(description).__name__}",
            [],
        )
    description = description.strip()
    if description:
        # Check for angle brackets
        if "<" in description or ">" in description:
            return False, "Description cannot contain angle brackets (< or >)", []
        # Check description length (max 1024 characters per spec)
        if len(description) > 1024:
            return (
                False,
                f"Description is too long ({len(description)} characters). Maximum is 1024 characters.",
                [],
            )

    # Validate compatibility field if present (optional)
    compatibility = frontmatter.get("compatibility", "")
    if compatibility:
        if not isinstance(compatibility, str):
            return (
                False,
                f"Compatibility must be a string, got {type(compatibility).__name__}",
                [],
            )
        if len(compatibility) > 500:
            return (
                False,
                f"Compatibility is too long ({len(compatibility)} characters). Maximum is 500 characters.",
                [],
            )

    # ==================== 新增检查规则（来自 skill-optimizer-yashu）====================

    # 1. 检查 description 格式（应包含功能和触发条件）
    if description:
        has_function = "[" in description and "]" in description
        has_trigger = any(kw in description for kw in ["当", "如果", "需要", "触发", "使用"])
        if not has_function:
            warnings.append("Description should include function in brackets, e.g., '[优化 skill]'")
        if not has_trigger:
            warnings.append("Description should include trigger condition, e.g., '当用户需要...时'")

    # 2. 检查渐进式披露（body 行数）
    body_lines = len(body.strip().split("\n"))
    if body_lines > 200:
        warnings.append(f"SKILL.md body is {body_lines} lines (recommended: < 200). Consider splitting into references/")

    # 3. 检查 Token 效率（是否有表格和列表）
    has_tables = "|" in body
    has_lists = re.search(r"^[\s]*[-*+][\s]", body, re.MULTILINE)
    if not has_tables and body_lines > 50:
        warnings.append("Consider using tables for better token efficiency")
    if not has_lists and body_lines > 30:
        warnings.append("Consider using lists for better token efficiency")

    # 4. 检查脚本文件大小
    scripts_dir = skill_path / "scripts"
    if scripts_dir.exists():
        for py_file in scripts_dir.glob("*.py"):
            line_count = len(py_file.read_text(encoding="utf-8").split("\n"))
            if line_count > 500:
                warnings.append(
                    f"Script '{py_file.name}' has {line_count} lines (recommended: < 500). Consider splitting functionality."
                )

    # 2. 检查文件引用格式
    # 提取代码块中的文件路径引用
    code_blocks = re.findall(r"```[\s\S]*?```", body)
    for block in code_blocks:
        # 查找代码块中的文件路径
        file_refs = re.findall(
            r"(?:python|bash|sh|cmd)\s+(scripts/\S+|references/\S+|assets/\S+)", block
        )
        for ref in file_refs:
            # 检查这个文件是否在正文中有 Markdown 链接引用
            md_link_pattern = rf"\[([^\]]+)\]\({re.escape(ref)}\)"
            if not re.search(md_link_pattern, body):
                warnings.append(
                    f"File '{ref}' is referenced in code example but missing Markdown link in body. Add: [{Path(ref).name}]({ref})"
                )

    # 3. 检查未引用的脚本
    if scripts_dir.exists():
        py_files = list(scripts_dir.glob("*.py"))
        # 提取所有引用的脚本
        md_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", body)
        referenced_scripts = [
            Path(link[1]).name for link in md_links if link[1].startswith("scripts/")
        ]
        code_refs = re.findall(r"`([^`]+)`", body)
        referenced_scripts += [
            Path(ref).name for ref in code_refs if ref.startswith("scripts/")
        ]

        unreferenced = [f.name for f in py_files if f.name not in referenced_scripts]
        if unreferenced:
            warnings.append(
                f"Unreferenced scripts in scripts/: {', '.join(unreferenced)}"
            )

    return True, "Skill is valid!", warnings


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)

    valid, message, warnings = validate_skill(sys.argv[1])
    print(message)

    if warnings:
        print("\nWarnings:")
        for i, warning in enumerate(warnings, 1):
            print(f"  {i}. {warning}")

    sys.exit(0 if valid else 1)
