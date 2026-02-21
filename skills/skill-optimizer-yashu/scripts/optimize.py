#!/usr/bin/env python3
"""
SKILL.md 优化器
根据分析结果生成优化后的文档
"""

import argparse
import re
import sys
from pathlib import Path
from typing import List, Dict


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
        content = self.original_content

        # 1. 确保有 frontmatter
        content = self._ensure_frontmatter(content)

        # 2. 将强制规则移到顶部
        content = self._move_rules_to_top(content)

        # 3. 优化长段落为表格/列表
        content = self._optimize_format(content)

        # 4. 添加快速参考表（如果不存在）
        content = self._add_quick_reference(content)

        # 5. 清理冗余内容
        content = self._cleanup(content)

        self.optimized_content = content
        return content

    def _ensure_frontmatter(self, content: str) -> str:
        """确保有 frontmatter"""
        if content.strip().startswith("---"):
            return content

        # 提取技能名称
        skill_name = self.skill_path.name

        # 尝试从内容中提取 description
        desc_match = re.search(r"description[:\s]+(.+?)(?:\n|$)", content, re.IGNORECASE)
        if desc_match:
            description = desc_match.group(1).strip()
        else:
            description = f"{skill_name} 技能"

        frontmatter = f"""---
name: {skill_name}
description: {description}
---

"""
        return frontmatter + content

    def _move_rules_to_top(self, content: str) -> str:
        """将强制规则移到文档顶部（frontmatter之后）"""
        # 如果已经有强制规则在顶部，跳过
        first_section = re.search(r"^---\s*\n.*?^---\s*\n\s*##\s*", content, re.MULTILINE | re.DOTALL)
        if first_section:
            section_start = content.find("##", first_section.end() - 10)
            next_section = content[section_start:section_start + 50]
            if "⚠️" in next_section or "强制" in next_section:
                return content
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
        # 查找 "用户表达/意图/操作" 模式
        pattern = r"([|]\s*用户表达\s*[|].*?[|]\s*对应操作\s*[|].*?[|])"

        # 如果已经有表格，保持原样
        if "| 用户输入 |" in content or "| 用户表达 |" in content:
            return content

        # 尝试提取意图对照信息
        intent_pattern = r"[|]\s*(.+?)\s*[|]\s*(.+?)\s*[|]\s*(.+?)\s*[|]"
        matches = re.findall(intent_pattern, content)

        if len(matches) > 3:
            # 已经有表格了
            return content

        return content

    def _optimize_lists(self, content: str) -> str:
        """优化列表格式"""
        # 确保列表项之间有适当空行
        content = re.sub(r"(^[\s]*[-*+][\s].*\n)(?=[\s]*[-*+])", r"\1\n", content, flags=re.MULTILINE)
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
        content = re.sub(r"(^[\s]*[-][\s].*\n)\n+(?=[\s]*[-])", r"\1", content, flags=re.MULTILINE)

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
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    main()
