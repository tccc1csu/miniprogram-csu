"""Validate references between course analysis artifacts, not application behavior."""
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'diagrams/analysis'
m=json.loads((D/'model-index.json').read_text(encoding='utf-8'))
specs=(ROOT/'requirements/system-use-case-specifications.md').read_text(encoding='utf-8')
expected=set(re.findall(r'^## (UC-[A-Z]+-\d{3})',specs,re.M))
actual=[s['code'] for s in m['sequences']]
errors=[]
if expected!=set(actual) or len(actual)!=len(set(actual)):
    errors.append('Use-case coverage mismatch or duplicate sequence')
catalog={v[0]:v[2] for v in m['catalog'].values()}
calls=0
control_views='\n'.join((D/(slug+'.puml')).read_text(encoding='utf-8') for slug,_ in m['classes'])
chapter=(ROOT/'analysis/05-analysis-models.md').read_text(encoding='utf-8')
for s in m['sequences']:
    text=(D/(s['slug']+'.puml')).read_text(encoding='utf-8')
    entities=dict((alias,cls) for cls,alias in re.findall(r'participant "[^":]+:([^"]+)" as (\w+)',text))
    for alias,cls in entities.items():
        if cls not in catalog: errors.append(f'{s["code"]}: unknown entity {cls}')
    for receiver,op in re.findall(r'^\s*\w+ -> (\w+): ([^(\n]+)\(',text,re.M):
        if receiver not in entities: continue
        calls+=1
        if op not in catalog.get(entities[receiver],[]):
            errors.append(f'{s["code"]}: undeclared operation {entities[receiver]}.{op}')
    control=s['title']+'控制'
    if control not in text: errors.append(f'{s["code"]}: missing per-use-case control')
    if f'class "{control}"' not in control_views:
        errors.append(f'{s["code"]}: missing control in analysis class views')
for state in m['states']:
    text=(D/(state['slug']+'.puml')).read_text(encoding='utf-8')
    operations=m['catalog'][state['owner']][2]
    for line in text.splitlines():
        match=re.match(r'^\w+(?:\s+-->\s+\w+)?\s*:\s*([^ (]+)\(',line)
        if match and match[1] not in operations:
            errors.append(f'{state["slug"]}: event not an owner operation: {match[1]}')
for p in D.glob('*.puml'):
    if f'{p.stem}.png)' not in chapter: errors.append(f'Diagram missing from chapter {p.stem}')
    for extension in ['.png','.svg']:
        if not p.with_suffix(extension).exists(): errors.append(f'Missing render {p.stem}{extension}')
    if p.with_suffix('.svg').exists() and 'Syntax Error' in p.with_suffix('.svg').read_text(encoding='utf-8'):
        errors.append(f'Rendered syntax error {p.stem}')
for name in ['class-editorial','class-production','class-workflow','class-accounting']:
    text=(D/(name+'.puml')).read_text(encoding='utf-8')
    if re.search(r'^\s*-\s*(?:状态|\w*ID)\s*$',text,re.M):
        errors.append(f'{name}: technical ID or blanket state attribute')
print(f'Checked {len(actual)} use cases, {calls} entity operation calls, {len(m["states"])} state machines, {len(list(D.glob("*.puml")))} diagrams.')
for e in errors: print(e)
if errors: raise SystemExit(1)
print('Analysis model consistency checks passed; application behavior not tested.')
