#!/usr/bin/env python3
"""
SKILL.md 文档分析器
根据 Agent Skills 规范分析文档质量
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

import yaml

# 导入分析模块
from analyzer_ai_friendly import check_ai_friendly
from analyzer_disclosure import check_progressive_disclosure
from analyzer_frontmatter import check_frontmatter
from analyzer_references import check_file_references
from analyzer_token import check_token_efficiency
from analyzer_usage import check_usage_guide


class SkillAnalyzer:
    """SKILL.md 文档分析器"""

    def __init__(self, skill_path: Path):
        self.skill_path = Path(skill_path)
        self.content = ""
        self.frontmatter: Dict[str, Any] = {}
        self.body = ""
        self.issues: List[str] = []

    def load(self) -> bool:
        """加载 SKILL.md 文件"""
        skill_md = self.skill_path / "SKILL.md"
        if not skill_md.exists():
            self.issues.append(f"错误: 找不到 {skill_md}")
            return False

        self.content = skill_md.read_text(encoding="utf-8")
        self._parse_frontmatter()
        return True

    def _parse_frontmatter(self) -> None:
        """解析 YAML frontmatter"""
        pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
        match = re.search(pattern, self.content, re.MULTILINE | re.DOTALL)

        if match:
            fm_text = match.group(1)
            self.body = match.group(2)
            self.frontmatter = yaml.safe_load(fm_text) or {}
        else:
            self.body = self.content

    def analyze(self) -> Dict[str, Any]:
        """执行完整分析"""
        if not self.content:
            return {"error": "无法加载文件"}

        return {
            "frontmatter": check_frontmatter(self),
            "progressive_disclosure": check_progressive_disclosure(self),
            "file_references": check_file_references(self),
            "token_efficiency": check_token_efficiency(self),
            "usage_guide": check_usage_guide(self),
            "ai_friendly": check_ai_friendly(self),
            "issues": self.issues,
            "summary": self._generate_summary(),
        }

    def _generate_summary(self) -> Dict[str, Any]:
        """生成分析摘要"""
        errors = len([i for i in self.issues if i.startswith("错误:")])
        warnings = len([i for i in self.issues if i.startswith("警告:")])
        suggestions = len([i for i in self.issues if i.startswith("建议:")])
        hints = len([i for i in self.issues if i.startswith("提示:")])

        # 确定评级
        if errors > 0:
            level = "需修复"
        elif warnings > 0:
            level = "良好"
        elif suggestions > 0:
            level = "优秀"
        elif hints > 0:
            level = "很好"
        else:
            level = "完美"

        return {
            "level": level,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "hints": hints,
            "total_issues": len(self.issues),
        }


def main():
    parser = argparse.ArgumentParser(description="分析 SKILL.md 文档质量")
    parser.add_argument("skill_name", help="技能名称")
    parser.add_argument("--folder", required=True, help="技能父文件夹路径")
    parser.add_argument("--output", help="输出 JSON 报告文件路径")

    args = parser.parse_args()

    skill_path = Path(args.folder) / args.skill_name
    analyzer = SkillAnalyzer(skill_path)

    if not analyzer.load():
        print(
            json.dumps(
                {"error": "无法加载文件", "issues": analyzer.issues},
                ensure_ascii=False,
                indent=2,
            )
        )
        sys.exit(1)

    result = analyzer.analyze()

    # 打印摘要
    summary = result["summary"]
    print(f"\n{'=' * 50}")
    print(f"分析结果: {summary['level']}")
    print(f"{'=' * 50}")
    print(
        f"错误: {summary['errors']} | 警告: {summary['warnings']} | 建议: {summary['suggestions']} | 提示: {summary['hints']}"
    )

    if analyzer.issues:
        print("\n发现的问题:")
        for issue in analyzer.issues:
            print(f"  - {issue}")

    # 保存报告
    if args.output:
        Path(args.output).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\n分析报告已保存到: {args.output}")


if __name__ == "__main__":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    main()
