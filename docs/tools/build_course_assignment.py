"""Assemble the complete A-D assignment without brittle heading slices."""
from pathlib import Path
import posixpath
import re

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = [
    ('a', 'A 业务建模', ['analysis/01-vision.md', 'analysis/02-business-modeling.md']),
    ('b', 'B 系统需求', ['diagrams/system-use-case-notes.md', 'requirements/system-use-case-specifications.md']),
    ('c', 'C 分析模型', ['analysis/05-analysis-models.md']),
    ('d', 'D 设计模型', ['design/01-database-design.md']),
]


def relocate(text, source):
    """Resolve local Markdown destinations relative to the merged file."""
    def replace(match):
        target = match[1]
        if re.match(r'^(?:[a-z]+:|#|/)', target):
            return match[0]
        path, separator, fragment = target.partition('#')
        path = posixpath.normpath(posixpath.join(posixpath.dirname(source), path))
        return '](' + path + (separator + fragment if separator else '') + ')'
    return re.sub(r'\]\(([^)]+)\)', replace, text)


def chapter(source, omit_title=False):
    text = (ROOT / source).read_text(encoding='utf-8').strip()
    if omit_title:
        text = re.sub(r'^# [^\n]+\n+', '', text, count=1)
        # Existing subsections belong immediately under their A-D chapter.
        text = re.sub(r'^(#{2,5}) ', r'\1# ', text, flags=re.M)
        return relocate(text, source)
    text = re.sub(r'^(#{1,5}) ', r'\1# ', text, flags=re.M)
    return relocate(text, source)


def main():
    parts = ['''# 青年传媒中心工作台：系统分析与设计课程作业

版本 2.0｜2026-11-27

本稿描述网页与原生微信小程序共享的任务协作、审校、自动归档和工时结算系统。
业务依据为[长期业务基准](../workbench/背景文件/BIZ-RULES-FULL.md)及[确认决定](../workbench/specs/decisions.md)；
数据设计以当前迁移001–005为准。历史访谈估计、当前实现与待验收能力在正文中分别说明。

目录：[A 业务建模](#a) · [B 系统需求](#b) · [C 分析模型](#c) · [D 设计模型](#d) · [附录](#appendix)
''']
    for anchor, title, sources in SECTIONS:
        parts.append(f'<a id="{anchor}"></a>\n\n## {title}')
        for source in sources:
            parts.append(chapter(source, omit_title=anchor in ('c', 'd')))
    parts.append('''<a id="appendix"></a>

## 附录：工程与审查资料

本稿已包含33个系统用例规约、33个分析序列、领域与职责类图、3个状态机、
数据库总览及7张分区关系图。214个字段及完整约束另附于[数据字典](database/data-dictionary.md)，
79项外键另附于[外键关系表](database/foreign-key-relations.md)。

- [课程要求核对](analysis/03-course-checklist.md)
- [业务差异审查](analysis/04-business-review.md) · [分析审查](analysis/06-analysis-review.md) · [设计审查](design/02-database-review.md)
- [SRS需求](SRS.md) · [SDD设计](SDD.md) · [STD测试](STD.md) · [统一追踪矩阵](requirements/traceability.md)
- [本轮验证证据](../workbench/specs/008-course-documentation/validation.md)

维护分文件后运行docs/tools/build_course_assignment.py重建本稿；当前图源与PNG/SVG同步维护。
''')
    (ROOT / 'course-assignment.md').write_text('\n\n'.join(parts).strip() + '\n', encoding='utf-8', newline='\n')
    print('Assembled complete A-D assignment with all 33 use-case specifications.')


if __name__ == '__main__':
    main()
