"""
Skill Creator Helper Script
自动生成符合 Agent Skills 规范的 skill 目录和 SKILL.md 文件

跨平台使用：python create-skill.py
"""

import os
import re
import sys
from datetime import datetime


def to_valid_skill_name(name: str) -> str:
    """将输入转换为有效的 skill 名称"""
    # 转换为小写
    name = name.lower()
    # 替换空格和特殊字符为连字符
    name = re.sub(r"[^a-z0-9]+", "-", name)
    # 移除开头和结尾的连字符
    name = name.strip("-")
    # 移除连续连字符
    name = re.sub(r"-+", "-", name)
    # 限制长度
    if len(name) > 64:
        name = name[:64].rstrip("-")
    return name


def create_skill(skill_name: str, description: str, output_dir: str = ".") -> str:
    """创建一个新的 skill"""

    # 验证并转换名称
    valid_name = to_valid_skill_name(skill_name)
    if not valid_name:
        raise ValueError(f"无法从 '{skill_name}' 生成有效的 skill 名称")

    # 创建目录
    skill_dir = os.path.join(output_dir, valid_name)
    if os.path.exists(skill_dir):
        raise FileExistsError(f"目录已存在: {skill_dir}")

    os.makedirs(skill_dir)

    # 生成 SKILL.md 内容
    today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    skill_md_content = f"""---
name: {valid_name}
description: {description}
metadata:
  updated: "{today}"
---

# {valid_name.replace("-", " ").title()}

## 何时使用此 skill

- 场景1：描述使用场景
- 场景2：描述使用场景
- 场景3：描述使用场景

## 核心功能

### 功能1
描述功能1的详细说明

### 功能2
描述功能2的详细说明

## 使用步骤

1. **步骤一**：描述第一步
2. **步骤二**：描述第二步
3. **步骤三**：描述第三步

## 示例

### 示例1：描述示例
输入：示例输入
输出：示例输出

## 注意事项

- 注意事项1
- 注意事项2
- 注意事项3

## 参考

- [Agent Skills 规范](https://agentskills.io/specification)
"""

    # 写入 SKILL.md
    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    with open(skill_md_path, "w", encoding="utf-8") as f:
        f.write(skill_md_content)

    return skill_dir


def validate_skill(skill_dir: str) -> list:
    """验证 skill 是否符合规范"""
    errors = []

    skill_md_path = os.path.join(skill_dir, "SKILL.md")

    # 检查 SKILL.md 是否存在
    if not os.path.exists(skill_md_path):
        errors.append("缺少 SKILL.md 文件")
        return errors

    # 读取内容
    with open(skill_md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 检查前置元数据
    if not content.startswith("---"):
        errors.append("SKILL.md 必须以 YAML 前置元数据开始")
        return errors

    # 提取前置元数据
    parts = content.split("---", 2)
    if len(parts) < 3:
        errors.append("前置元数据格式不正确")
        return errors

    frontmatter = parts[1].strip()

    # 检查必需字段
    if "name:" not in frontmatter:
        errors.append("缺少必需的 'name' 字段")

    if "description:" not in frontmatter:
        errors.append("缺少必需的 'description' 字段")

    # 检查 name 字段值
    import re as regex

    name_match = regex.search(r"^name:\s*(.+)$", frontmatter, regex.MULTILINE)
    if name_match:
        name = name_match.group(1).strip()
        dir_name = os.path.basename(skill_dir)

        if name != dir_name:
            errors.append(f"name 字段 '{name}' 与目录名 '{dir_name}' 不匹配")

        # 检查命名规范
        if not regex.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name):
            errors.append(
                f"name 字段 '{name}' 不符合命名规范（只能包含小写字母、数字和连字符）"
            )

        if len(name) > 64:
            errors.append("name 字段长度超过 64 字符")

    # 检查 description 字段值
    desc_match = regex.search(r"^description:\s*(.+)$", frontmatter, regex.MULTILINE)
    if desc_match:
        description = desc_match.group(1).strip()
        if len(description) > 1024:
            errors.append("description 字段长度超过 1024 字符")
        if len(description) < 1:
            errors.append("description 字段不能为空")
        # 检查是否包含 "何时使用" 格式
        if "何时使用" not in description and "何时触发" not in description:
            errors.append(
                'description 应该使用 "何时使用：" 格式来分隔功能描述和触发条件'
            )

    return errors


def main():
    if len(sys.argv) < 2:
        print("用法: python create-skill.py <命令> [参数]")
        print("")
        print("命令:")
        print("  create <skill-name> <description> [output-dir]  创建新 skill")
        print("  validate <skill-dir>                            验证 skill")
        print("")
        print("示例:")
        print('  python create-skill.py create "PDF Processor" "处理 PDF 文件"')
        print("  python create-skill.py validate ./my-skill")
        sys.exit(1)

    command = sys.argv[1]

    if command == "create":
        if len(sys.argv) < 4:
            print("错误: create 命令需要 skill-name 和 description")
            sys.exit(1)

        skill_name = sys.argv[2]
        description = sys.argv[3]
        output_dir = sys.argv[4] if len(sys.argv) > 4 else "."

        try:
            skill_dir = create_skill(skill_name, description, output_dir)
            print(f"✓ Skill 创建成功: {skill_dir}")
            print(f"✓ 生成的 SKILL.md: {os.path.join(skill_dir, 'SKILL.md')}")
        except Exception as e:
            print(f"✗ 错误: {e}")
            sys.exit(1)

    elif command == "validate":
        if len(sys.argv) < 3:
            print("错误: validate 命令需要 skill-dir 参数")
            sys.exit(1)

        skill_dir = sys.argv[2]
        errors = validate_skill(skill_dir)

        if errors:
            print(f"✗ 验证失败，发现 {len(errors)} 个问题:")
            for error in errors:
                print(f"  - {error}")
            sys.exit(1)
        else:
            print(f"✓ Skill 验证通过: {skill_dir}")

    else:
        print(f"未知命令: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
