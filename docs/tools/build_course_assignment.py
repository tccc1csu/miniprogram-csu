"""Assemble the course assignment from its maintained source documents."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(name):
    return (ROOT / name).read_text(encoding='utf-8')

def demote(text):
    return re.sub(r'^(#{1,5}) ', r'\1# ', text, flags=re.M)

vision = demote(read('analysis/01-vision.md'))
business = demote(read('analysis/02-business-modeling.md'))
business = business.replace('../diagrams/', 'diagrams/').replace('../requirements/', 'requirements/')
views = demote(read('diagrams/system-use-case-notes.md'))
views = re.sub(r'\]\(([^)]+)\)', lambda m: '](' + 'diagrams/' + m[1] + ')', views)
specs = read('requirements/system-use-case-specifications.md')
body = specs[specs.index('## 2. 用例目录'):specs.index('## 4. 路径评审规则')]
body = body.replace('## 2. 用例目录', '## 4.1 用例目录').replace('## 3. 公共补充约束', '## 4.2 公共补充约束')
body = demote(body)
out = '# 青年传媒中心系统分析与设计课程作业\n\n'
out += vision + '\n' + business + '\n' + views + '\n## 4 系统用例规约\n\n' + body
analysis = demote(read('analysis/05-analysis-models.md'))
analysis = analysis.replace('../diagrams/', 'diagrams/')
out += '\n' + analysis
design = demote(read('design/01-database-design.md'))
design = design.replace('../diagrams/', 'diagrams/').replace('../database/', 'database/')
out += '\n' + design
(ROOT / 'course-assignment.md').write_text(out, encoding='utf-8')

errors = []
links = 0
files = [ROOT/'course-assignment.md', ROOT/'README.md', *sorted((ROOT/'analysis').glob('*.md')),
         *sorted((ROOT/'design').glob('*.md')), *sorted((ROOT/'database').glob('*.md')),
         ROOT/'requirements/system-use-case-specifications.md', ROOT/'diagrams/system-use-case-notes.md']
for file in files:
    for link in re.findall(r'\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
        if link.startswith(('http:', 'https:', '#')):
            continue
        links += 1
        if not (file.parent / link.split('#')[0]).exists():
            errors.append(f'Missing local link: {file}: {link}')

headings = re.findall(r'^## (UC-[A-Z]+-\d{3})', specs, re.M)
diagram_ids = set()
for file in (ROOT/'diagrams').glob('system-use-case*.puml'):
    diagram_ids.update(re.findall(r'^\s*usecase\s+"(UC-[A-Z]+-\d{3})', file.read_text(encoding='utf-8'), re.M))
if len(headings) != len(set(headings)):
    errors.append('Duplicate specification headings')
if diagram_ids != set(headings):
    errors.append(f'Diagram/specification mismatch: {diagram_ids ^ set(headings)}')
for code in headings:
    unit = re.search(r'^## '+code+r'：.*?(?=^## |\Z)', specs, re.M | re.S).group()
    for field in ['执行者', '触发事件', '前置条件', '后置条件', '涉众利益', '基本路径', '扩展路径', '字段列表']:
        if field not in unit:
            errors.append(f'{code}: missing {field}')
for file in (ROOT/'diagrams').rglob('*.svg'):
    if 'Syntax Error' in file.read_text(encoding='utf-8'):
        errors.append(f'Rendered syntax error: {file.name}')
print(f'Checked {links} local links, {len(headings)} specifications, {len(diagram_ids)} diagram use cases.')
for error in errors:
    print(error)
if errors:
    raise SystemExit(1)
print('Course assignment assembled; consistency checks passed.')
