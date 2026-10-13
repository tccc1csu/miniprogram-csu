"""One complete ER diagram, with class traceability and numbered FK relations."""
from pathlib import Path
import json, sqlite3

ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'diagrams/database'
idx=json.loads((D/'model-index.json').read_text(encoding='utf-8'))
tables=idx['tables']
mapping={
'Organization': ['organization'],
'Department': ['department'],
'Member': ['member','external_identity','archive_preference'],
'Session': ['login_session'],
'Editorial': ['editorial','editorial_work','editorial_target','editorial_assignment','editorial_archive'],
'Work': ['work','platform'],
'Version': ['manuscript_version'],
'Outcome': ['outcome','outcome_attachment','outcome_version'],
'Publication': ['publication'],
'Review': ['manuscript_review','editorial_review','editorial_review_item'],
'Schedule': ['production_schedule'],
'BookingTerms': ['booking_terms'],
'Booking': ['production_booking','production_assignment','production_archive_responsibility','production_archive'],
'Workflow': ['workflow','workflow_completion','business_source'],
'Stage': ['task_stage','stage_assignment','stage_source','stage_current_draft','stage_confirmation','stage_completion','stage_contribution'],
'Ledger': ['contribution_basis','contribution_measurement','v_contribution_detail','v_contribution_money','v_pending_contribution'],
'Contribution': ['contribution_basis','contribution_measurement','contribution_type','v_contribution_detail','v_contribution_money'],
'Weekly': ['v_member_weekly_summary'],
'Allowance': ['allowance_standard','contribution_policy'],
'Report': ['weekly_report','report_department','report_contribution','report_pending','report_seal','v_report_member_summary'],
}
catalog=json.loads((ROOT/'diagrams/analysis/model-index.json').read_text(encoding='utf-8'))['catalog']
regions=[
('组织与账号','#EAF2FB',['organization','department','member','external_identity','login_session','archive_preference']),
('采编协同与稿件','#FFF5E8',['editorial','editorial_work','editorial_target','editorial_assignment','work','manuscript_version','platform','editorial_review','editorial_review_item','editorial_archive']),
('摄制预约','#EAF6F0',['production_schedule','booking_terms','production_booking','production_assignment','production_archive_responsibility','production_archive']),
('流转任务与阶段','#F0EDFA',['workflow','task_stage','stage_assignment','business_source','stage_source','stage_confirmation','stage_completion','workflow_completion']),
('成果与版本审核','#FFF0F1',['outcome','outcome_attachment','outcome_version','publication','stage_current_draft','manuscript_review']),
('工作贡献与津贴规则','#EFF8FA',['contribution_type','allowance_standard','contribution_policy','contribution_basis','stage_contribution','contribution_measurement','v_contribution_detail','v_contribution_money','v_member_weekly_summary','v_pending_contribution']),
('中心周报','#F7F6E8',['weekly_report','report_department','report_contribution','report_pending','report_seal','v_report_member_summary']),
]
relations=[]
for n,t in tables.items():
    for fid in sorted({f['id'] for f in t['fks']}):
        parts=sorted([f for f in t['fks'] if f['id']==fid],key=lambda f:f['seq'])
        cols=[f['col'] for f in parts]
        pk=[c['name'] for c in sorted(t['columns'],key=lambda c:c['pk']) if c['pk']]
        unique=set(cols)==set(pk) or any(set(u['columns'])==set(cols) and not u['partial'] for u in t['uniques'])
        nullable=any(c['nullable'] for c in t['columns'] if c['name'] in cols)
        relations.append(dict(code=f'R{len(relations)+1:03}',child=n,parent=parts[0]['target'],columns=cols,
                              target_columns=[f['to'] for f in parts],nullable=nullable,unique=unique))
dependencies={
'v_contribution_detail':['contribution_basis','contribution_measurement','contribution_policy','allowance_standard','business_source','production_booking','booking_terms'],
'v_contribution_money':['v_contribution_detail'],
'v_member_weekly_summary':['v_contribution_money'],
'v_pending_contribution':['contribution_basis','contribution_measurement'],
'v_report_member_summary':['report_contribution','report_seal','v_contribution_money'],
}
db=sqlite3.connect(':memory:');db.executescript((ROOT/'database/schema.sqlite.sql').read_text(encoding='utf-8'))
view_labels={'v_contribution_detail':'有效贡献工时','v_contribution_money':'贡献津贴','v_member_weekly_summary':'成员周汇总','v_pending_contribution':'待核对贡献','v_report_member_summary':'历史周报成员汇总'}
source='''@startuml
title
图 46  青年传媒中心数据库关系总图
分析实体映射 · 47 张基表与 5 个派生视图 · 七个分区共用一个关系模型
end title
skinparam defaultFontName Microsoft YaHei
skinparam defaultFontSize 12
skinparam shadowing false
skinparam linetype ortho
skinparam nodesep 24
skinparam ranksep 34
skinparam packageStyle rectangle
skinparam backgroundColor white
skinparam ArrowColor #526579
skinparam ArrowFontSize 10
skinparam entityBorderColor #465C70
skinparam entityBackgroundColor white
hide circle
'''
for ri,(label,color,members) in enumerate(regions):
    source+=f'package "{ri+1}. {label}" as region{ri} {color} {{\n'
    for n in members:
        owners=[catalog[k][0] for k,v in mapping.items() if n in v and k!='Ledger']
        if n=='business_source':owners=['跨流程来源标识（设计辅助）']
        caption='／'.join(owners)
        title=tables[n]['label'] if n in tables else view_labels[n]
        source+=f'entity "{title}\\n{n}" as {n} <<{caption}'+(' · VIEW' if n not in tables else '')+'>>'+(' #E1F3E6' if n not in tables else '')+' {\n'
        if n in tables:
            t=tables[n]
            pk=[c['name'] for c in sorted(t['columns'],key=lambda c:c['pk']) if c['pk']]
            for c in sorted(t['columns'],key=lambda c:(not bool(c['pk']),c['cid'])):
                keys=[]
                if c['pk']:keys.append('PK'+str(c['pk']))
                codes=[r['code'] for r in relations if r['child']==n and c['name'] in r['columns']]
                if codes:keys.append('FK '+','.join(codes))
                if any(u['columns']==[c['name']] and not u['partial'] for u in t['uniques']):keys.append('UQ')
                keys.append('NULL' if c['nullable'] else 'NN')
                source+=f'  {c["name"]} : '+('I64' if c['type']=='INTEGER' else c['type'])+' ['+'; '.join(keys)+']\n'
            source+='  --\n  PK('+', '.join(pk)+')\n'
            for r in [r for r in relations if r['child']==n]:
                targetcols=r['target_columns']
                if any(c is None for c in targetcols):
                    targetcols=[c['name'] for c in sorted(tables[r['parent']]['columns'],key=lambda c:c['pk']) if c['pk']]
                source+='  '+r['code']+' FK('+', '.join(r['columns'])+')\n'
                source+='    → '+r['parent']+'('+', '.join(targetcols)+')\n'
            multi=[','.join(u['columns'])+(' [WHERE]' if u['partial'] else '') for u in t['uniques'] if len(u['columns'])>1]
            if multi:
                source+='  --\n'
                for u in multi:source+='  UQ('+u+')\n'
        else:
            for c in db.execute(f'PRAGMA table_info({n})'):source+=f'  {c[1]}\n'
        source+='}\n'
    source+='}\n'
for r in relations:
    source+=f'{r["parent"]} '+('|o' if r['nullable'] else '||')+'--'+('o|' if r['unique'] else 'o{')+f' {r["child"]} : {r["code"]}\n'
for view,parents in dependencies.items():
    for parent in parents:source+=f'{parent} ..> {view}\n'
source+='''legend bottom
  实线：真实 FK 关系，R 编号对应字段内 FK 编号及外键关系清单；同一对表的不同外键分别绘制。
  || 恰好一；|o 零或一；o{ 零到多。组合关系由子表 NN 外键实现。
  PK 主键；FK 外键；UQ 唯一约束；NN 非空；NULL 可空；I64 64 位整数；TEXT 文本或参考稿时间。
  绿色 VIEW 为派生视图，虚线箭头表示计算依赖，不表示外键；视图没有物理主键约束。
  <<名称>> 对应分析实体；设计辅助表用于规范化和引用完整性，未新增业务执行者或业务用例。
  [WHERE] 为条件唯一约束；具体条件见数据字典与 DDL。时间、倍率和工时单位见第 6 节。
endlegend
@enduml
'''
(D/'db-overview.puml').write_text(source,encoding='utf-8')
idx['overview']=dict(slug='db-overview',regions=[dict(label=l,tables=m) for l,c,m in regions],relations=relations,dependencies=dependencies)
idx['class_mapping']=mapping
(D/'model-index.json').write_text(json.dumps(idx,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
out='# 数据库外键关系清单\n\n本清单列出全部真实外键，R 编号对应完整 PlantUML 模型及模型索引。作业主图按示范只显示字段旁蓝色箭头与目标表名、表外关键关联；没有显示的表外线不表示删除外键。复合外键是一个整体关系，完整组成列及基数见下表。\n\n| 编号 | 子表（外键列） | 父表（被引用列） | 每条子记录对应父记录 | 一个父记录对应子记录 |\n| --- | --- | --- | --- | --- |\n'
for r in relations:
    parentcols=r['target_columns']
    if any(c is None for c in parentcols):parentcols=[c['name'] for c in sorted(tables[r['parent']]['columns'],key=lambda c:c['pk']) if c['pk']]
    out+=f'| {r["code"]} | {r["child"]}（'+', '.join(r['columns'])+'） | '+r['parent']+'（'+', '.join(parentcols)+'） | '+('0..1' if r['nullable'] else '1')+' | '+('0..1' if r['unique'] else '0..*')+' |\n'
out+='\n`business_source` 的三条可空外键受“恰好一列非空”的 CHECK 联合限制。`publication` 的复合外键允许非稿件成果的 version_id 为空，但 outcome_id 仍由单独外键保证存在。父记录至少拥有一个子记录等跨行完整性，在发布／归档事务中检查。\n'
(ROOT/'database/foreign-key-relations.md').write_text(out,encoding='utf-8')
print(f'Built ONE overview: {len(tables)} tables, {len(dependencies)} views, {len(relations)} FK relations, {len(mapping)} analysis-entity mappings.')
