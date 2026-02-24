"""
SKILL.md 优化器
根据分析结果生成优化后的文档

跨平台使用：python optimize.py
"""

import argparse
import re
import sys
from pathlib import Path


class SkillOptimizer:
    """SKILL.md 文档优化器"""

    def __init__(self, skill_path: Path):
        self.skill_path = Path(skill_path)
        self.original_content = ""
        self.optimized_content = ""

    def load(self) -> bool:
        """加载 SKILL.md 文件"""
        skill_md = self.skill_path / "SKILL.md"
        if not skill_md.exists():
            print(f"错误: 找不到 {skill_md}")
            return False

        self.original_content = skill_md.read_text(encoding="utf-8")
        return True

    def optimize(self) -> str:
        """执行优化"""
        try:
            content = self.original_content

            # 1. 确保有 frontmatter
            content = self._ensure_frontmatter(content)

            # 2. 将强制规则移到顶部
            content = self._move_rules_to_top(content)

            # 3. 优化长段落为表格/列表
            content = self._optimize_format(content)

            # 4. 添加 AI 调用规范（如果不存在）
            content = self._add_ai_guideline(content)

            # 5. 添加快速参考表（如果不存在）
            content = self._add_quick_reference(content)

            # 6. 清理冗余内容
            content = self._cleanup(content)

            # 6. 验证优化后的内容
            if not self._validate(content):
                print("警告: 优化后的文档验证未通过，使用原始内容")
                return self.original_content

            self.optimized_content = content
            return content
        except Exception as e:
            print(f"优化过程中出错: {e}")
            return self.original_content

    def _validate(self, content: str) -> bool:
        """验证优化后的内容是否有效"""
        # 检查 frontmatter 是否完整
        if not content.strip().startswith("---"):
            return False

        # 检查是否有 name 和 description
        if "name:" not in content or "description:" not in content:
            return False

        # 检查 frontmatter 是否正确闭合
        fm_matches = re.findall(r"^---\s*$", content, re.MULTILINE)
        if len(fm_matches) < 2:
            return False

        return True

    def _ensure_frontmatter(self, content: str) -> str:
        """确保有 frontmatter，并将自定义字段移到 metadata 对象中"""
        from datetime import datetime

        today = datetime.now().strftime("%Y-%m-%d")

        if content.strip().startswith("---"):
            # 已有 frontmatter，规范化字段
            fm_match = re.search(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
            if fm_match:
                fm_content = fm_match.group(1)

                # 定义应该移到 metadata 的自定义字段
                custom_fields = ["author", "updated", "version", "tags"]
                metadata = {}
                core_fields = {}

                # 解析现有字段
                for line in fm_content.strip().split("\n"):
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if ":" in line:
                        key = line.split(":")[0].strip()
                        value = line.split(":", 1)[1].strip()
                        # 去除引号
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        if key in custom_fields:
                            metadata[key] = value
                        elif key != "metadata":
                            core_fields[key] = value

                # 如果已有 metadata 对象，合并进去
                existing_metadata_match = re.search(
                    r"^metadata:\s*\n((?:\s+\w+:\s*.+\n)*)", fm_content, re.MULTILINE
                )
                if existing_metadata_match:
                    # 解析现有的 metadata
                    for line in existing_metadata_match.group(1).strip().split("\n"):
                        if ":" in line:
                            key = line.split(":")[0].strip()
                            value = line.split(":", 1)[1].strip()
                            if value.startswith('"') and value.endswith('"'):
                                value = value[1:-1]
                            metadata[key] = value
                    # 移除旧的 metadata 块
                    fm_content = re.sub(
                        r"^metadata:\s*\n(?:\s+\w+:\s*.+\n)*",
                        "",
                        fm_content,
                        flags=re.MULTILINE,
                    )

                # 确保 updated 字段存在，使用标准格式: YYYY-MM-DD HH:MM:SS
                from datetime import datetime

                now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                metadata["updated"] = now

                # 构建新的 frontmatter
                new_fm = "---\n"
                for key in ["name", "description"]:
                    if key in core_fields:
                        new_fm += f"{key}: {core_fields[key]}\n"

                # 添加 metadata 对象
                if metadata:
                    new_fm += "metadata:\n"
                    for key, value in metadata.items():
                        new_fm += f'  {key}: "{value}"\n'

                new_fm += "---\n"

                # 替换原 frontmatter
                content = (
                    content[: fm_match.start()] + new_fm + content[fm_match.end() :]
                )
            return content

        # 没有 frontmatter，创建新的
        skill_name = self.skill_path.name

        # 尝试从内容中提取 description
        desc_match = re.search(
            r"description[:\s]+(.+?)(?:\n|$)", content, re.IGNORECASE
        )
        if desc_match:
            description = desc_match.group(1).strip()
        else:
            description = f"{skill_name} 技能"

        frontmatter = f"""---
name: {skill_name}
description: {description}
metadata:
  updated: "{today} 00:00:00"
---

"""
        return frontmatter + content

    def _move_rules_to_top(self, content: str) -> str:
        """将强制规则移到文档顶部（frontmatter之后）"""
        # 如果已经有强制规则在顶部，跳过
        first_section = re.search(
            r"^---\s*\n.*?^---\s*\n\s*##\s*", content, re.MULTILINE | re.DOTALL
        )
        if first_section:
            section_start = content.find("##", first_section.end() - 10)
            next_section = content[section_start : section_start + 50]
            if "⚠️" in next_section or "强制" in next_section:
                return content

        # 查找强制规则部分
        rules_pattern = r"(##\s*[^\n]*(?:强制|必须|⚠️)[^\n]*\n.*?)(?=\n##\s|$)"
        rules_match = re.search(rules_pattern, content, re.DOTALL | re.IGNORECASE)

        if rules_match:
            rules_section = rules_match.group(1)
            # 从原位置移除
            content = content.replace(rules_section, "", 1)
            # 插入到 frontmatter 之后
            fm_end = re.search(
                r"^---\s*\n.*?^---\s*\n", content, re.MULTILINE | re.DOTALL
            )
            if fm_end:
                insert_pos = fm_end.end()
                content = (
                    content[:insert_pos]
                    + "\n"
                    + rules_section
                    + "\n"
                    + content[insert_pos:]
                )

        return content

    def _optimize_format(self, content: str) -> str:
        """优化格式，将长段落转为表格/列表"""
        # 将 "用户表达 -> 意图 -> 操作" 段落转为表格
        content = self._convert_to_table(content)

        # 优化列表格式
        content = self._optimize_lists(content)

        return content

    def _convert_to_table(self, content: str) -> str:
        """尝试将某些段落转换为表格"""
        # 如果已经有表格，保持原样
        if "| 用户输入 |" in content or "| 用户表达 |" in content:
            return content

        # 尝试将 "当用户...时 -> 执行..." 格式的段落转换为表格
        # 匹配模式：当用户[条件]时，[操作]
        pattern = (
            r"当用户(.+?)(?:时|表达|说|输入).*?(?:触发|执行|使用|调用)(.+?)(?:\n|$)"
        )
        matches = re.findall(pattern, content, re.IGNORECASE)

        if len(matches) >= 3:
            # 构建表格
            table = "\n| 用户输入 | AI 行动 |\n|----------|----------|\n"
            for user_input, action in matches[:10]:  # 最多10行
                user_input = user_input.strip()[:30]  # 截断过长内容
                action = action.strip()[:40]
                table += f"| {user_input} | {action} |\n"

            # 在第一个匹配位置插入表格
            first_match = re.search(pattern, content, re.IGNORECASE)
            if first_match:
                insert_pos = first_match.start()
                content = content[:insert_pos] + table + "\n" + content[insert_pos:]

        return content

    def _optimize_lists(self, content: str) -> str:
        """优化列表格式"""
        # 确保列表项之间有适当空行
        content = re.sub(
            r"(^[\s]*[-*+][\s].*\n)(?=[\s]*[-*+])", r"\1\n", content, flags=re.MULTILINE
        )
        return content

    def _add_ai_guideline(self, content: str) -> str:
        """添加 AI 调用规范

        所有 Skill 都是给 AI 使用的，统一添加 AI 调用规范声明。
        """
        # 如果已存在 AI 调用规范，跳过
        if "AI 调用规范" in content or "专为 AI 设计" in content:
            return content

        ai_guideline = """**AI 调用规范**：本 Skill 专为 AI 设计，人类用户只需用自然语言描述需求，AI 自动完成所有操作。

"""

        # 尝试在 "## 功能概述" 或 "## 如何使用" 后插入
        patterns = [
            r"(## 功能概述\s*\n)",
            r"(## 如何使用\s*\n)",
            r"(## 概述\s*\n)",
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                insert_pos = match.end()
                content = (
                    content[:insert_pos] + "\n" + ai_guideline + content[insert_pos:]
                )
                return content

        # 如果没有找到合适的插入位置，在 frontmatter 后插入
        fm_end = re.search(r"^---\s*\n.*?^---\s*\n", content, re.MULTILINE | re.DOTALL)
        if fm_end:
            insert_pos = fm_end.end()
            content = content[:insert_pos] + "\n" + ai_guideline + content[insert_pos:]

        return content

    def _add_quick_reference(self, content: str) -> str:
        """添加快速参考表"""
        if "## 快速参考" in content or "## 快速参考表" in content:
            return content

        # 提取用户输入模式
        quick_ref = """
## 快速参考表

| 用户输入 | AI 行动 |
|----------|---------|
| "xxx" | 直接执行 xxx |

"""
        # 添加到文档末尾
        content = content.rstrip() + "\n" + quick_ref
        return content

    def _cleanup(self, content: str) -> str:
        """清理冗余内容"""
        # 移除多余的空行
        content = re.sub(r"\n{3,}", "\n\n", content)

        # 修复列表项之间的多余空行（保留表格前的空行）
        content = re.sub(
            r"(^[\s]*[-][\s].*\n)\n+(?=[\s]*[-])", r"\1", content, flags=re.MULTILINE
        )

        return content

    def generate_report(self) -> str:
        """生成优化报告"""
        original_lines = len(self.original_content.split("\n"))
        optimized_lines = len(self.optimized_content.split("\n"))

        report = f"""# 优化报告

## 统计对比

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 行数 | {original_lines} | {optimized_lines} | {optimized_lines - original_lines:+d} |
| 字符数 | {len(self.original_content)} | {len(self.optimized_content)} | {len(self.optimized_content) - len(self.original_content):+d} |

## 优化项

- [x] 确保 frontmatter 完整
- [x] 强制规则前置
- [x] 格式优化（表格/列表）
- [x] 添加 AI 调用规范
- [x] 添加快速参考表
- [x] 清理冗余内容

## 使用建议

1. 检查优化后的文档是否符合预期
2. 验证所有链接和脚本引用是否正确
3. 测试 AI 是否能正确理解执行步骤
"""
        return report


def main():
    parser = argparse.ArgumentParser(description="优化 SKILL.md 文档")
    parser.add_argument("skill_name", help="技能名称")
    parser.add_argument("--folder", required=True, help="技能父文件夹路径")
    parser.add_argument("--output", required=True, help="输出优化后的文件路径")
    parser.add_argument("--report", help="输出报告文件路径")

    args = parser.parse_args()

    skill_path = Path(args.folder) / args.skill_name
    optimizer = SkillOptimizer(skill_path)

    if not optimizer.load():
        sys.exit(1)

    optimized = optimizer.optimize()

    # 保存优化后的文档
    output_path = Path(args.output)
    output_path.write_text(optimized, encoding="utf-8")
    print(f"优化后的文档已保存到: {output_path}")

    # 保存报告
    if args.report:
        report = optimizer.generate_report()
        Path(args.report).write_text(report, encoding="utf-8")
        print(f"优化报告已保存到: {args.report}")


if __name__ == "__main__":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    main()
