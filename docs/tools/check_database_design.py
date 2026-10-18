"""Execute meaningful integrity scenarios against the isolated reference database."""
from pathlib import Path
import sqlite3, json, re, math
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.executescript((ROOT/'database/schema.sqlite.sql').read_text(encoding='utf-8'))
passed=[]
def ok(name,condition):
    if not condition:raise AssertionError(name)
    passed.append(name)
def reject(name,sql,args=()):
    db.execute('SAVEPOINT rejection')
    try:
        db.execute(sql,args)
    except sqlite3.IntegrityError:
        db.execute('ROLLBACK TO rejection');db.execute('RELEASE rejection');passed.append(name)
    else:
        db.execute('ROLLBACK TO rejection');db.execute('RELEASE rejection');raise AssertionError('Accepted invalid data: '+name)

db.executescript('''
INSERT INTO organization VALUES(1,'青年传媒中心');
INSERT INTO department VALUES(1,1,'办公部',1),(2,1,'摄制部',1),(3,1,'运营部',1),(4,1,'美编部',1),(5,1,'采编部',1);
INSERT INTO member VALUES(1,'老师','teacher',NULL,'ADMIN',NULL,1),(2,'办公成员','office',NULL,'MEMBER',1,1),(3,'摄制成员','camera',NULL,'MEMBER',2,1),(4,'摄制部长','camera_head',NULL,'MINISTER',2,1),(5,'办公部长','office_head',NULL,'MINISTER',1,1),(6,'运营成员','ops',NULL,'MEMBER',3,1),(7,'运营部长一','ops_head',NULL,'MINISTER',3,1),(8,'采编成员','editor',NULL,'MEMBER',5,1),(9,'运营部长二','ops_head2',NULL,'MINISTER',3,1);
INSERT INTO production_schedule VALUES(1,2);
INSERT INTO booking_terms VALUES(1,1,1,'2026-10-01 00:00:00',2,'HOURS_24',15000,'本测试采用隔离日程，不代表会议冲突口径');
INSERT INTO production_booking VALUES(1,8,1,'拍摄','2026-10-13 12:00:00','2026-10-13 14:00:00','校园','联系说明','2026-10-12 12:00:00',1,1);
INSERT INTO production_assignment VALUES(1,3,4,'ASSIGN','2026-10-12 13:00:00');
INSERT INTO production_archive_responsibility VALUES(1,2,3,'2026-10-13 14:30:00');
INSERT INTO business_source VALUES(1,NULL,1,NULL,NULL,NULL);
INSERT INTO outcome VALUES(1,1,1,3,'拍摄完成','2026-10-13 14:30:00');
INSERT INTO contribution_type VALUES(1,'PRODUCTION','摄制'),(2,'ARCHIVE','办公归档'),(3,'DESIGN','设计');
INSERT INTO allowance_standard VALUES(1,2,1,'2026-10-01 00:00:00',1200),(2,1,1,'2026-10-01 00:00:00',1000),(3,4,1,'2026-10-01 00:00:00',1000);
INSERT INTO contribution_policy VALUES(1,1,1,'测试基础工时',1),(2,2,2,'测试基础工时',0),(3,3,3,'测试基础工时',0);
INSERT INTO contribution_basis VALUES(1,1,1,3,2,'2026-10-13 14:00:00','摄制贡献'),(2,1,2,2,1,'2026-10-13 15:00:00','办公归档贡献');
INSERT INTO editorial VALUES(99,8,'仅用于双来源约束检查','2026-10-13 08:00:00',NULL);
INSERT INTO production_booking VALUES(99,8,1,'仅用于抢单资格检查','2026-10-13 16:00:00','2026-10-13 17:00:00','校园','联系说明','2026-10-12 12:00:00',1,1);
''')
reject('canonical timestamps reject mixed T formatting',"INSERT INTO login_session VALUES(99,1,'test-token','2026-10-13T08:00:00','2026-10-13 09:00:00',NULL)")
reject('invalid timestamp is rejected',"INSERT INTO login_session VALUES(99,1,'test-token','invalid','2026-10-13 09:00:00',NULL)")
reject('non-admin requires a department',"INSERT INTO member VALUES(99,'无部门','bad',NULL,'MEMBER',NULL,1)")
reject('unique login name',"INSERT INTO member VALUES(99,'同名账号','camera',NULL,'MEMBER',2,1)")
reject('FK rejects orphan member department',"INSERT INTO member VALUES(99,'孤儿','orphan',NULL,'MEMBER',99,1)")
reject('source requires exactly one owner',"INSERT INTO business_source VALUES(99,NULL,NULL,NULL,NULL,NULL)")
reject('source may not have two owners',"INSERT INTO business_source VALUES(99,99,1,NULL,NULL,NULL)")
reject('specialized source is unique',"INSERT INTO business_source VALUES(99,NULL,1,NULL,NULL,NULL)")
reject('assignment and claim compete for one PK',"INSERT INTO production_assignment VALUES(1,3,3,'CLAIM','2026-10-12 13:01:00')")
reject('claim actor must claim for self',"INSERT INTO production_assignment VALUES(99,3,4,'CLAIM','2026-10-12 13:01:00')")
reject('source type member deduplicates contribution',"INSERT INTO contribution_basis VALUES(99,1,1,3,2,'2026-10-13 14:00:00','重复')")
reject('unarchived work cannot be measured',"INSERT INTO contribution_measurement VALUES(1,1,20000,'2026-10-13 15:00:00')")
reject('wrong archive member',"INSERT INTO production_archive VALUES(1,1,3,'2026-10-13 15:00:00')")
db.execute("INSERT INTO production_archive VALUES(1,1,2,'2026-10-13 15:00:00')")
reject('duplicate archive',"INSERT INTO production_archive VALUES(1,1,2,'2026-10-13 15:00:00')")
reject('zero is not valid measured work',"INSERT INTO contribution_measurement VALUES(1,1,0,'2026-10-13 15:00:00')")
reject('policy must match historical department and type',"INSERT INTO contribution_measurement VALUES(1,2,20000,'2026-10-13 15:00:00')")
db.execute("INSERT INTO contribution_measurement VALUES(1,1,20000,'2026-10-13 15:00:00')")
db.execute("INSERT INTO contribution_measurement VALUES(2,2,10000,'2026-10-13 15:00:00')")
ok('urgent multiplier is applied once',db.execute('SELECT counted_hours_u,allowance_cents FROM v_contribution_money WHERE basis_id=1').fetchone()==(30000,3600))
ok('non-urgent-applicable archive does not multiply',db.execute('SELECT counted_hours_u,allowance_cents FROM v_contribution_money WHERE basis_id=2').fetchone()==(10000,1000))
db.execute("UPDATE member SET department_id=1 WHERE member_id=3")
ok('member transfer does not change historical department or rate',db.execute('SELECT department_id,hourly_rate_cents,allowance_cents FROM v_contribution_money WHERE basis_id=1').fetchone()==(2,1200,3600))
db.execute("INSERT INTO allowance_standard VALUES(4,2,2,'2026-10-14 00:00:00',2000)")
ok('new standard does not reprice history',db.execute('SELECT allowance_cents FROM v_contribution_money WHERE basis_id=1').fetchone()==(3600,))
reject('cannot rewrite historical rate',"UPDATE allowance_standard SET hourly_rate_cents=9999 WHERE standard_id=1")
reject('cannot rewrite measurement',"UPDATE contribution_measurement SET base_hours_u=30000 WHERE basis_id=1")
ok('weekly view has one member week row',db.execute("SELECT COUNT(*),SUM(total_hours_u) FROM v_member_weekly_summary WHERE member_id=3 AND week_start='2026-10-12'").fetchone()==(1,30000))
ok('Sunday and Monday belong to correct weeks',db.execute("SELECT date('2026-10-18 23:59:59','weekday 0','-6 days'),date('2026-10-19 00:00:00','weekday 0','-6 days')").fetchone()==('2026-10-12','2026-10-19'))

# External requests and the upgraded operations-layout review workflow.
db.executescript('''
INSERT INTO external_request VALUES(1,8,1,'外部排版需求','兄弟部门需求','2026-10-20 18:00:00','2026-10-18 09:00:00');
INSERT INTO operations_layout_task VALUES(1,'运营排版','BASIC','2026-10-20 18:00:00',7,'2026-10-18 09:00:00');
INSERT INTO business_source VALUES(11,NULL,NULL,NULL,NULL,1);
''')
reject('external request cannot assign outside target department',"INSERT INTO external_request_assignment VALUES(1,8,5,'2026-10-18 09:10:00')")
reject('external request cannot be dispatched by unrelated department',"INSERT INTO external_request_assignment VALUES(1,2,4,'2026-10-18 09:10:00')")
reject('operations layout cannot assign outside operations',"INSERT INTO operations_layout_assignment VALUES(1,8,7,'2026-10-18 09:05:00')")
reject('layout review slot requires operations minister',"INSERT INTO source_review_assignment VALUES(11,1,6,7,'2026-10-18 09:06:00')")
db.executescript('''
INSERT INTO external_request_assignment VALUES(1,2,5,'2026-10-18 09:10:00');
INSERT INTO business_source VALUES(10,NULL,NULL,NULL,1,NULL);
INSERT INTO outcome VALUES(10,10,1,2,'外部需求成果','2026-10-18 12:00:00');
INSERT INTO source_review VALUES(10,10,10,1,1,5,'PASS','审核通过','2026-10-18 12:10:00',NULL);
INSERT INTO source_archive VALUES(10,10,10,5,'2026-10-18 12:11:00');
INSERT INTO operations_layout_assignment VALUES(1,6,7,'2026-10-18 09:05:00');
INSERT INTO outcome VALUES(11,11,1,6,'排版成果','2026-10-18 13:00:00');
INSERT INTO source_review_assignment VALUES(11,1,7,7,'2026-10-18 09:06:00'),(11,2,9,7,'2026-10-18 09:06:00');
INSERT INTO source_review VALUES(11,11,11,1,1,7,'PASS','一审通过','2026-10-18 13:10:00',NULL);
''')
reject('assigned layout reviewer cannot be replaced by a different reviewer',"INSERT INTO source_review VALUES(90,11,11,1,2,9,'PASS','越权审核','2026-10-18 13:10:30',NULL)")
reject('different second reviewer cannot archive after first review',"INSERT INTO source_archive VALUES(11,11,11,7,'2026-10-18 13:11:00')")
db.executescript("INSERT INTO source_review VALUES(12,11,11,2,1,9,'PASS','二审通过','2026-10-18 13:12:00',11); INSERT INTO source_archive VALUES(11,11,12,9,'2026-10-18 13:13:00');")
db.executescript('''
INSERT INTO operations_layout_task VALUES(2,'同人审核排版','PHOTO','2026-10-21 18:00:00',7,'2026-10-18 10:00:00');
INSERT INTO operations_layout_assignment VALUES(2,6,7,'2026-10-18 10:05:00');
INSERT INTO business_source VALUES(12,NULL,NULL,NULL,NULL,2);
INSERT INTO outcome VALUES(12,12,1,6,'同人审核成果','2026-10-18 14:00:00');
INSERT INTO source_review_assignment VALUES(12,1,7,7,'2026-10-18 10:06:00'),(12,2,7,7,'2026-10-18 10:06:00');
INSERT INTO source_review VALUES(13,12,12,1,1,7,'PASS','一审通过','2026-10-18 14:10:00',NULL);
INSERT INTO source_archive VALUES(12,12,13,7,'2026-10-18 14:11:00');
''')
ok('external request archives after one authorized review',db.execute('SELECT COUNT(*) FROM source_archive WHERE source_id=10').fetchone()==(1,))
ok('different reviewers require a second review',db.execute('SELECT final_review_id FROM source_archive WHERE source_id=11').fetchone()==(12,))
ok('same reviewer archives directly after first review',db.execute('SELECT final_review_id FROM source_archive WHERE source_id=12').fetchone()==(13,))

# Two versions of one work: an old review must never authorize the new draft.
db.executescript('''
INSERT INTO work VALUES(1,'推文','ORIGINAL');
INSERT INTO platform VALUES(1,'测试平台');
INSERT INTO manuscript_version VALUES(1,1,1,'第一版',6,'2026-10-13 09:00:00'),(2,1,2,'修改版',6,'2026-10-13 10:00:00');
INSERT INTO manuscript_review VALUES(1,1,1,1,7,'PASS','一审通过','2026-10-13 09:10:00',NULL),(2,1,2,1,1,'PASS','二审通过','2026-10-13 09:20:00',1);
INSERT INTO workflow VALUES(1,6,'运营推文','中心任务','发布推文','2026-10-13 08:00:00');
INSERT INTO task_stage VALUES(1,1,3,1,'完成并发布推文','OPERATIONS_TWO_LEVEL',NULL);
INSERT INTO business_source VALUES(2,NULL,NULL,1,NULL,NULL);
INSERT INTO stage_source VALUES(1,2);
INSERT INTO stage_assignment VALUES(1,6,7,'2026-10-13 08:30:00',NULL);
INSERT INTO outcome VALUES(2,2,1,6,'新版本成果','2026-10-13 10:00:00');
INSERT INTO outcome_version VALUES(2,2);
INSERT INTO stage_current_draft VALUES(1,2,2);
INSERT INTO stage_confirmation VALUES(1,1,2,7,'PASS','材料确认','2026-10-13 10:50:00');
''')
reject('old first review cannot authorize new second review',"INSERT INTO manuscript_review VALUES(99,2,2,1,1,'PASS','通过','2026-10-13 10:30:00',1)")
reject('old passed version cannot complete changed draft',"INSERT INTO stage_completion VALUES(1,1,2)")
reject('publication version must belong to outcome',"INSERT INTO publication VALUES(99,2,1,1,'https://example.invalid')")
reject('workflow cannot end before stages complete',"INSERT INTO workflow_completion VALUES(1,'2026-10-13 11:00:00')")
db.executescript('''
INSERT INTO manuscript_review VALUES(3,2,1,1,7,'PASS','通过','2026-10-13 10:10:00',NULL),(4,2,2,1,1,'PASS','通过','2026-10-13 10:20:00',3);
INSERT INTO stage_completion VALUES(1,1,4);
INSERT INTO workflow_completion VALUES(1,'2026-10-13 11:00:00');
''')
reject('completed draft cannot be changed',"UPDATE stage_current_draft SET version_id=1 WHERE stage_id=1")
reject('cannot append stage to completed workflow',"INSERT INTO task_stage VALUES(99,1,4,2,'设计','NONE',NULL)")

# Generic stage final collection and explicit pending contribution.
db.executescript('''
INSERT INTO workflow VALUES(2,6,'设计流转','中心任务','设计成果','2026-10-13 08:00:00');
INSERT INTO task_stage VALUES(2,2,4,1,'设计','NONE',NULL),(3,2,3,2,'接收设计','NONE',NULL);
INSERT INTO business_source VALUES(3,NULL,NULL,2,NULL,NULL),(4,NULL,NULL,3,NULL,NULL);
INSERT INTO stage_source VALUES(2,3),(3,4);
INSERT INTO outcome VALUES(3,3,1,6,'设计成果','2026-10-13 09:00:00'),(4,4,1,6,'后续成果','2026-10-13 10:00:00');
INSERT INTO contribution_basis VALUES(3,3,3,6,4,'2026-10-13 09:00:00','设计贡献');
''')
reject('cannot assign stage before predecessor completes',"INSERT INTO stage_assignment VALUES(3,6,7,'2026-10-13 08:30:00',NULL)")
db.executescript('''
INSERT INTO stage_confirmation VALUES(2,2,3,7,'PASS','确认','2026-10-13 10:00:00');
INSERT INTO stage_completion VALUES(2,2,NULL);
INSERT INTO stage_assignment VALUES(3,6,7,'2026-10-13 10:01:00',NULL);
''')
reject('final-stage counting waits for whole workflow',"INSERT INTO contribution_measurement VALUES(3,3,10000,'2026-10-13 11:00:00')")
db.executescript('''
INSERT INTO stage_confirmation VALUES(3,3,4,7,'PASS','确认','2026-10-13 11:00:00');
INSERT INTO stage_completion VALUES(3,3,NULL);
INSERT INTO workflow_completion VALUES(2,'2026-10-13 11:00:00');
''')
ok('unmeasured basis is pending rather than zero',db.execute('SELECT basis_id FROM v_pending_contribution').fetchall()==[(3,)])
db.executescript('''
INSERT INTO weekly_report VALUES(1,'2026-10-12',5,'2026-10-13 16:00:00',NULL);
INSERT INTO report_department VALUES(1,1),(1,2),(1,4);
''')
reject('report cannot seal while in-scope items missing',"INSERT INTO report_seal VALUES(1)")
db.executescript('''
INSERT INTO report_contribution VALUES(1,1),(1,2);
INSERT INTO report_pending VALUES(1,3,'规则依据待核对');
INSERT INTO report_seal VALUES(1);
INSERT INTO weekly_report VALUES(2,'2026-10-12',5,'2026-10-13 16:01:00',NULL);
INSERT INTO report_department VALUES(2,1),(2,2),(2,4);
INSERT INTO report_contribution VALUES(2,1),(2,2);
INSERT INTO report_pending VALUES(2,3,'规则依据待核对');
INSERT INTO report_seal VALUES(2);
''')
ok('repeat report does not double work',db.execute('SELECT COUNT(*),SUM(counted_hours_u) FROM v_contribution_money').fetchone()==(2,40000))
ok('report totals equal selected detail amounts',db.execute('SELECT SUM(total_allowance_cents) FROM v_report_member_summary WHERE report_id=1').fetchone()==(4600,))
reject('sealed report input cannot grow',"INSERT INTO report_contribution VALUES(1,2)")
db.execute("INSERT INTO contribution_measurement VALUES(3,3,10000,'2026-10-13 17:00:00')")
ok('later measurement does not change historical report',db.execute('SELECT SUM(total_allowance_cents) FROM v_report_member_summary WHERE report_id=1').fetchone()==(4600,))
ok('historic pending reason retained after later resolution',db.execute('SELECT COUNT(*) FROM report_pending WHERE report_id=1').fetchone()==(1,))
db.executescript('''
INSERT INTO weekly_report VALUES(3,'2026-10-19',5,'2026-10-19 12:00:00',NULL);
INSERT INTO report_department VALUES(3,2);
''')
reject('wrong week cannot enter report',"INSERT INTO report_contribution VALUES(3,1)")
reject('referenced member cannot be deleted',"DELETE FROM member WHERE member_id=3")
ok('all foreign keys remain valid',db.execute('PRAGMA foreign_key_check').fetchall()==[])

index=json.loads((ROOT/'diagrams/database/model-index.json').read_text(encoding='utf-8'))
actual={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
ok('diagram catalog covers every physical table',set(index['tables'])==actual)
covered={t for fig in index['figures'] for t in fig['tables']}
ok('every table has a complete ER subview',covered==actual)
overview=index['overview']
source=(ROOT/'diagrams/database/db-overview.puml').read_text(encoding='utf-8')
declared=re.findall(r'^entity .*? as (\w+) ',source,re.M)
ok('ONE overview declares each table and view exactly once',len(declared)==len(set(declared)) and set(declared)==actual|set(index['views']))
ok('ONE overview uses orthogonal connectors','skinparam linetype ortho' in source)
expected=[]
for name in actual:
    fks=list(db.execute(f'PRAGMA foreign_key_list({name})'))
    for fid in {f[0] for f in fks}:
        parts=sorted([f for f in fks if f[0]==fid],key=lambda f:f[1])
        expected.append((name,parts[0][2],tuple(f[3] for f in parts),tuple(f[4] for f in parts)))
modeled=[(r['child'],r['parent'],tuple(r['columns']),tuple(r['target_columns'])) for r in overview['relations']]
ok('ONE overview preserves EVERY real FK including composite and parallel FKs',sorted(expected,key=str)==sorted(modeled,key=str))
for r in overview['relations']:
    assert re.search(r'^'+r['parent']+r' .* '+r['child']+r' : '+r['code']+r'$',source,re.M),r
ok('all FK relation IDs are drawn in the ONE overview',True)
catalog=json.loads((ROOT/'diagrams/analysis/model-index.json').read_text(encoding='utf-8'))['catalog']
ok('class mapping covers original analysis entity catalog',set(index['class_mapping'])==set(catalog))
ok('class mapping accounts for all tables and views',{n for names in index['class_mapping'].values() for n in names}==actual|set(index['views']))
figures=index['figures']+[overview]
for f in figures:
    p=ROOT/'diagrams/database'/f['slug']
    source=p.with_suffix('.puml').read_text(encoding='utf-8')
    ok(f'{f["slug"]} uses orthogonal connectors','skinparam linetype ortho' in source)
    for ext in ['.png','.svg']:ok(f'{f["slug"]} rendered {ext}',p.with_suffix(ext).exists())
    ok(f'{f["slug"]} has no render error','Syntax Error' not in p.with_suffix('.svg').read_text(encoding='utf-8'))
    ok(f'{f["slug"]} render is current',all(p.with_suffix(ext).stat().st_mtime>=p.with_suffix('.puml').stat().st_mtime for ext in ['.svg','.png']))
svg=ET.parse(ROOT/'diagrams/database/db-overview.svg').getroot()
layout=json.loads((ROOT/'diagrams/database/overview-layout.json').read_text(encoding='utf-8'))
cards=layout['cards']
groups={g.attrib['data-name']:g for g in svg.iter() if 'data-name' in g.attrib}
ok('compact SVG contains exactly all tables and views',set(groups)==actual|set(index['views']))
edges={g.attrib['id']:g for g in svg.iter() if g.attrib.get('class')=='edge'}
ok('compact SVG draws ALL business FK relations and local shared references',set(edges)=={'edge-'+r['id'] for r in layout['routes']} and set(edges)=={'edge-'+r['code'] for r in overview['relations'] if r['code'] not in layout['omitted_shared_references']})
for r in overview['relations']:
    if r['code'] in layout['omitted_shared_references']:
        assert r['parent'] in ['member','department'] and cards[r['child']]['region']!=0,r
ok('only remote member/department shared-reference lines are omitted',True)
for edge in edges.values():
    assert any(t.tag.endswith('circle') or t.tag.endswith('ellipse') for t in edge.iter()),edge.attrib['id']
    assert len([t for t in edge.iter() if t.tag.endswith('line')])>=2,edge.attrib['id']
ok('every external relationship visibly carries cardinality markers at both ends',True)
for r in overview['relations']:
    child=groups[r['child']]
    refs=[t.attrib for t in child.iter() if t.attrib.get('data-relation')==r['code']]
    expectedrefs=[]
    for i,col in enumerate(r['columns']):
        target=r['target_columns'][i]
        if target is None:target=next(c['name'] for c in index['tables'][r['parent']]['columns'] if c['pk']==i+1)
        expectedrefs.append((col,r['parent']+'.'+target))
    assert sorted((t['data-fk-column'],t['data-target']) for t in refs)==sorted(expectedrefs),r['code']
ok('all FK columns retain exact references in model metadata',True)
for n in actual:
    targettexts=[t.text for t in groups[n].iter() if 'data-target-table' in t.attrib]
    for row in cards[n]['lines']:
        if row['refs']:
            parents=list(dict.fromkeys(r['table'] for r in row['refs']))
            assert ' / '.join(parents) in targettexts,(n,row['name'])
ok('every FK field displays its referenced table name',True)
visibletexts=[t.text or '' for t in svg.iter() if t.tag.endswith('text')]
ok('main diagram omits R labels, type/null columns and constraint expressions',not any(re.search(r'R\d{3}|^(TYPE|NULL)$|^PK \(|^UQ \(',s) for s in visibletexts))
for n in actual:
    displayed={t.attrib['data-column'] for t in groups[n].iter() if 'data-column' in t.attrib}
    assert displayed=={c['name'] for c in index['tables'][n]['columns']},n
    texts=[''.join(t.itertext()) for t in groups[n].iter() if t.tag.endswith('text')]
    pk=[c['name'] for c in sorted(index['tables'][n]['columns'],key=lambda c:c['pk']) if c['pk']]
    for c in index['tables'][n]['columns']:
        if c['pk']:assert any('PK'+str(c['pk']) in t.attrib.get('data-key','') for t in groups[n].iter()),(n,c)
    shownpk={t.attrib['data-column'] for t in groups[n].iter() if t.attrib.get('class')=='pk-icon'}
    assert shownpk==set(pk),n
ok('every base-table field and every primary-key icon is visible',True)
rects=[(n,c['x'],c['y'],c['x']+c['width'],c['y']+c['height']) for n,c in cards.items()]
for i,(n,l,t,r,b) in enumerate(rects):
    for nn,ll,tt,rr,bb in rects[i+1:]:assert not (max(l,ll)<min(r,rr) and max(t,tt)<min(b,bb)),(n,nn)
for route in layout['routes']:
    for (x,y),(xx,yy) in zip(route['points'],route['points'][1:]):
        assert x==xx or y==yy,route['id']
        for n,l,t,r,b in rects:
            if x==xx:assert not (l<x<r and max(min(y,yy),t)<min(max(y,yy),b)),(route['id'],n)
            else:assert not (t<y<b and max(min(x,xx),l)<min(max(x,xx),r)),(route['id'],n)
ok('cards do not overlap and no relationship crosses a table interior',True)
for route in layout['routes']:
    for (x,y),(xx,yy) in zip(route['points'],route['points'][1:]):
        for z in layout['zones']:
            l=z['x']+21;r=z['x']+336;t=z['y']+8;b=z['y']+42
            if x==xx:assert not (l<x<r and max(min(y,yy),t)<min(max(y,yy),b)),(route['id'],z['id'])
            else:assert not (t<y<b and max(min(x,xx),l)<min(max(x,xx),r)),(route['id'],z['id'])
ok('relationship routes avoid region headings',True)
ok('every region reserves a small extension strip',all(z['reserve']>=24 and z['reserve']<z['h']*0.15 for z in layout['zones']))
ok('compact canvas is under half the prior diagram area',layout['width']*layout['height']<math.prod(layout['old_dimensions'])*0.5)
paths=[p for p in svg.iter() if p.tag.endswith('path')]
for p in paths:
    tokens=re.findall(r'[A-Za-z]|-?\d+(?:\.\d+)?',p.attrib['d'])
    i=0;position=None
    while i<len(tokens):
        command=tokens[i];i+=1
        count={'M':2,'L':2,'C':6}.get(command)
        assert count is not None,(p.attrib.get('id'),command)
        values=list(map(float,tokens[i:i+count]));i+=count
        points=([position] if position else [])+list(zip(values[::2],values[1::2]))
        position=points[-1]
        # Graphviz emits C even for straight segments, including a short diagonal
        # at the self-reference. Collinear control points describe a straight
        # line, not a curve. All other relationship trunks must be orthogonal.
        a=points[0];b=points[-1]
        norm=max(1,abs(b[0]-a[0])+abs(b[1]-a[1]))
        assert all(abs((x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]))/norm<0.02 for x,y in points),(p.attrib.get('id'),points)
        if p.attrib.get('id')!='manuscript_review-manuscript_review':
            assert (max(x for x,y in points)-min(x for x,y in points)<0.02 or
                    max(y for x,y in points)-min(y for x,y in points)<0.02),(p.attrib.get('id'),points)
ok('rendered overview has only straight line segments and polylines (no curved Beziers)',bool(paths))
result=f'PASS: {len(passed)} scenario/artifact checks; {len(actual)} tables; 5 views; ONE complete overview + {len(index["figures"])} detail views.\n'
(ROOT/'database/verification.txt').write_text(result+'\n'.join('PASS '+p for p in passed)+'\n\nReference SQLite constraints verified; live cloud database and application behavior were not tested.\n',encoding='utf-8')
print(result.strip())
print('Reference database only; no live/cloud database accessed.')
