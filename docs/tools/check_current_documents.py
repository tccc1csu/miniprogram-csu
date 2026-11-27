"""Validate the maintained course/engineering documents without production access."""
from pathlib import Path
from hashlib import sha256
import json
import re
import sys
from urllib.parse import unquote
from render_course_diagrams import verify_svg

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
errors=[]
def check(condition,message):
    if not condition: errors.append(message)
def read(path): return path.read_text(encoding='utf-8-sig')

cases=json.loads(read(ROOT/'requirements/use-cases.json'))
ids=[u['id'] for u in cases]
check(len(ids)==33 and len(set(ids))==33,'Expected 33 unique use cases')
spec=read(ROOT/'requirements/system-use-case-specifications.md')
merged=read(ROOT/'course-assignment.md')
for u in cases:
    code=u['id']
    check(len(u['steps'])>=4 and all(u[k] for k in ['name','actor','pre','post','alt','fields','module']),code+': incomplete specification')
    check(spec.count('## '+code+'：')==1,code+': missing/duplicate specification')
    check(merged.count('## '+code+'：')==1,code+': missing/duplicate in course assignment')
    for module in u['module'].split(' / '): check((REPO/'workbench/server'/module).is_file(),code+': unknown module '+module)
index=json.loads(read(ROOT/'diagrams/analysis/model-index.json'))
check(index['useCases']==ids,'Analysis index differs from catalog')
seq=list((ROOT/'diagrams/analysis').glob('seq-*.puml'))
check({p.stem for p in seq}=={'seq-'+code.lower() for code in ids},'Sequence diagram IDs differ from catalog')
usecase_sources=[ROOT/'diagrams'/('system-use-case-'+g+'.puml') for g in ['publication','jobs','accounting','support']]
shown=[]
for p in usecase_sources: shown+=re.findall(r'usecase "(UC-[A-Z]+-\d+)',read(p))
check(sorted(shown)==sorted(ids),'Detailed use-case diagrams differ from catalog')
responsibilities=read(ROOT/'diagrams/analysis/class-responsibilities.puml')
class_operations={name:set(re.findall(r'^([^()\n]+)\(\)',body,re.M))
    for name,body in re.findall(r'class "([^"]+)" as \w+ <<\w+>> \{\n(.*?)\n\}',responsibilities,re.S)}
for p in seq:
    src=read(p)
    check('alt 业务条件满足' in src and 'else 业务条件不满足' in src,p.name+': missing success/failure branch')
    aliases={alias:name for name,alias in re.findall(r'^(?:control|entity) "([^"]+)" as (\w+)',src,re.M)}
    check('关系事实仓库' not in src,p.name+': analysis replaced by storage calls')
    check(not re.search(r'^actor\s*(?:->|-->)\s*(?:model|identity|ledger)',src,re.M),p.name+': actor directly writes entity')
    for receiver,op in re.findall(r'^\w+ -> (\w+) : ([^(\n]+)\(',src,re.M):
        if receiver in aliases:
            check(op in class_operations.get(aliases[receiver],set()),p.name+': receiver responsibility absent: '+aliases[receiver]+'.'+op)

schema=json.loads(read(ROOT/'database/runtime-schema.json'))
tables=schema['tables']; names={t['name'] for t in tables}
cols=sum(len(t['columns']) for t in tables)
fks=sum(sum(c['type']=='f' for c in t['constraints']) for t in tables)
check((len(tables),cols,fks)==(38,214,79),'Schema baseline differs from 38 tables / 214 columns / 79 FKs')
for name,digest in schema.get('migrationSha256',{}).items():
    check(sha256((REPO/'workbench/server/migrations'/name).read_bytes()).hexdigest()==digest,'Re-export stale migration: '+name)
check(set(schema.get('migrationSha256',{}))=={p.name for p in (REPO/'workbench/server/migrations').glob('*.sql')},'Migration hash manifest missing/incomplete')
dictionary=read(ROOT/'database/data-dictionary.md')
relations=read(ROOT/'database/foreign-key-relations.md')
for t in tables:
    check('## '+t['name']+' — ' in dictionary,'Dictionary missing '+t['name'])
    for c in t['columns']:
        check('| '+c['name']+' | '+c['type']+' |' in dictionary,'Dictionary missing field '+t['name']+'.'+c['name'])
    for c in t['constraints']:
        check(c['definition'].replace('|','／') in dictionary,'Dictionary missing constraint '+c['name'])
        if c['type']=='f': check(c['definition'].replace('|','／') in relations,'FK table missing '+c['name'])
dbindex=json.loads(read(ROOT/'diagrams/database/model-index.json'))
covered=set()
for group,(_,group_names) in dbindex['groups'].items():
    check(set(group_names)<=names,'Unknown tables in ER group '+group)
    src=read(ROOT/'diagrams/database'/('db-'+group+'.puml'))
    for n in group_names: check(' as '+n+' {' in src,'ER missing table '+n)
    covered.update(group_names)
check(covered==names,'ER partitions do not cover all tables')

trace=read(ROOT/'requirements/traceability.md')
check({*re.findall(r'REQ-\d{2}',trace)}=={'REQ-'+str(i).zfill(2) for i in range(1,15)},'Traceability must cover REQ-01 to REQ-14')
check(set(ids)<=set(re.findall(r'UC-[A-Z]+-\d+',trace)),'Traceability omits use cases')
std=read(ROOT/'STD.md')
test_ids=set(re.findall(r'^\| (T-\d{2}) \|',std,re.M))
check(set(re.findall(r'\bT-\d{2}\b',trace))<=test_ids,'Traceability references undefined tests')
routes=re.findall(r"api\.(get|post|put|patch|delete)\('([^']+)'",read(REPO/'workbench/server/app.js'))
api=read(ROOT/'design/api-contracts.md')
for m,p in routes: check('| '+m.upper()+' | /api/v1'+p+' |' in api,'API inventory missing '+m+' '+p)

current=[REPO/'README.md',ROOT/'README.md',ROOT/'course-assignment.md',ROOT/'SRS.md',ROOT/'SDD.md',ROOT/'STD.md']
for folder in ['analysis','requirements','design']:
    current+=sorted((ROOT/folder).glob('*.md'))
current+=[ROOT/'database/data-dictionary.md',ROOT/'database/foreign-key-relations.md',ROOT/'diagrams/system-use-case-notes.md']
current+=list((REPO/'workbench/specs/008-course-documentation').rglob('*.md'))
current+=list(ROOT.glob('*-framework.md'))
links=0
for p in current:
    content=read(p)
    check('\ufffd' not in content,str(p.relative_to(REPO))+': replacement character')
    check(not re.search(r'(?:根据|参见|见|按照)\s*(?:PPT|ppt|课件)\s*第?\s*\d+\s*页',content),str(p.relative_to(REPO))+': course page reference')
    # Only actual Markdown links, not snippets in fenced examples.
    text=re.sub(r'(?ms)^\s*(```|~~~).*?^\s*\1\s*$', '', content)
    targets=re.findall(r'\]\(([^)]+)\)',text)+re.findall(r'<img\b[^>]*\bsrc="([^"]+)"',text)
    for target in targets:
        target=target.strip().split(' "')[0].strip('<>')
        if re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:',target): continue
        path,_,frag=unquote(target).partition('#')
        dest=(p.parent/path).resolve() if path else p
        check(dest.exists(),str(p.relative_to(REPO))+': broken link '+target)
        if not path and frag:
            check('id="'+frag+'"' in text or re.search(r'^#+ '+re.escape(frag)+r'\s*$',text,re.M|re.I),str(p.relative_to(REPO))+': missing fragment '+frag)
        links+=1
sources=sorted((ROOT/'diagrams').rglob('*.puml'))
check(len(sources)==58,'Expected 58 maintained diagram sources')
for p in sources:
    for ext in ['.png','.svg']: check(p.with_suffix(ext).is_file(),p.name+': missing '+ext)
    if p.with_suffix('.svg').exists():
        try: verify_svg(p,p.with_suffix('.svg'))
        except Exception as e: errors.append(str(e))
    check(p.with_suffix('.svg').relative_to(ROOT).as_posix() in merged,p.name+': not included in course assignment')
qr=REPO/'docs/assets/experience-qrcode.png'
check(qr.is_file(),'Original experience QR is absent')
if errors:
    print('FAIL: '+str(len(errors))+' documentation errors\n'+'\n'.join(errors))
    sys.exit(1)
print(f'PASS: {len(ids)} use cases/sequences; {len(sources)} PNG/SVG diagram pairs; 38 tables/{cols} columns/{fks} FKs; 14 requirements; {len(routes)} routes; {len(current)} Markdown files/{links} local links.')
