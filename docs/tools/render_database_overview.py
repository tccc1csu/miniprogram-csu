"""Compact, deterministic ERD layout from the same schema catalog as PlantUML.

All keys are visible; each FK states its exact target. Orthogonal A* routing
avoids card interiors. Logical SVG text/ports retain identifiers for QA.
"""
from pathlib import Path
from html import escape
import json, sqlite3, math, heapq, collections

ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'diagrams/database'
idx=json.loads((D/'model-index.json').read_text(encoding='utf-8'))
tables=idx['tables'];overview=idx['overview'];rels=overview['relations']
catalog=json.loads((ROOT/'diagrams/analysis/model-index.json').read_text(encoding='utf-8'))['catalog']
db=sqlite3.connect(':memory:');db.executescript((ROOT/'database/schema.sqlite.sql').read_text(encoding='utf-8'))
CW=520;GAP=54;PAD=26;ZONEW=CW*2+GAP+PAD*2;LANEGAP=64
def width(s,size=14,code=False):
    # Conservative monospace/CJK bounds, without platform font-engine coupling.
    return sum(size if ord(c)>127 else size*0.62 for c in s)
def wrap(s,limit,size=12,code=True):
    words=s.split(' ');lines=[];line=''
    for word in words:
        trial=(line+' '+word).strip()
        if width(trial,size,code)>limit and line:lines.append(line);line=word
        else:line=trial
    if line:lines.append(line)
    return lines

cards={}
for n in list(tables)+idx['views']:
    t=tables.get(n)
    owners=[catalog[k][0] for k,v in idx['class_mapping'].items() if n in v and k!='Ledger']
    if n=='business_source':owners=['跨流程来源标识（设计辅助）']
    label=t['label'] if t else {'v_contribution_detail':'有效贡献工时','v_contribution_money':'贡献津贴','v_member_weekly_summary':'成员周汇总','v_pending_contribution':'待核对贡献','v_report_member_summary':'历史周报成员汇总'}[n]
    lines=[];ports={};offset=96
    cols=sorted(t['columns'],key=lambda c:(not bool(c['pk']),c['cid'])) if t else [dict(name=c[1],type='',pk=0,nullable=True) for c in db.execute(f'PRAGMA table_info({n})')]
    for c in cols:
        fkparts=[f for f in t['fks'] if f['col']==c['name']] if t else []
        keys=[]
        if c['pk']:keys.append('PK'+str(c['pk']))
        if fkparts:keys.append('FK')
        if t and any(u['columns']==[c['name']] and not u['partial'] for u in t['uniques']):keys.append('UQ')
        refs=[]
        for r in [r for r in rels if r['child']==n and c['name'] in r['columns']]:
            pi=r['columns'].index(c['name']);tc=r['target_columns'][pi]
            if tc is None:tc=next(x['name'] for x in tables[r['parent']]['columns'] if x['pk']==pi+1)
            refs.append(dict(relation=r['code'],target=r['parent']+'.'+tc,table=r['parent']))
        lines.append(dict(kind='field',name=c['name'],keys=' '.join(keys),refs=refs,y=offset))
        ports[c['name']]=offset-5
        offset+=25
    footer=[]
    if t:
        pk=[c['name'] for c in sorted(t['columns'],key=lambda c:c['pk']) if c['pk']]
        footer+=wrap('PK ('+', '.join(pk)+')',CW-24)
        for u in t['uniques']:
            if len(u['columns'])>1 and u['columns']!=pk:
                where=''
                if u['partial']:
                    statement=db.execute('SELECT sql FROM sqlite_master WHERE name=?',(u['name'],)).fetchone()[0]
                    where=' WHERE '+statement.split('WHERE',1)[1].strip().rstrip(';')
                footer+=wrap('UQ ('+', '.join(u['columns'])+')'+where,CW-24)
        for r in [r for r in rels if r['child']==n and len(r['columns'])>1]:
            footer+=wrap(r['code']+' FK ('+', '.join(r['columns'])+') · 复合外键',CW-24)
        if n=='business_source':footer+=['CHECK：三种来源外键恰好一列非空']
    else:footer=['VIEW · 派生结果，无物理 PK / FK',{'v_contribution_detail':'粒度：basis_id','v_contribution_money':'粒度：basis_id','v_member_weekly_summary':'粒度：member_id + week_start','v_pending_contribution':'粒度：basis_id','v_report_member_summary':'粒度：report_id + member_id'}[n]]
    widths=[width(n,17)+28,width(label,15)+28,width('分析类：'+'／'.join(owners),11)+28]
    for line in lines:
        targets=' / '.join(dict.fromkeys(r['table'] for r in line['refs']))
        widths.append(18+len(line['name'])*7.7+8+(24 if 'PK' in line['keys'] else 0)+(26+len(targets)*7.8 if targets else 0)+18)
    cards[n]=dict(name=n,label=label,owner='／'.join(owners),lines=lines,ports=ports,footer=[],
                  width=math.ceil(max(300,max(widths))/10)*10,height=offset+8,view=not bool(t))

# Three lanes; each region is a two-column compact row layout. A small strip
# per region is explicitly reserved for additions, instead of global blank space.
bands=[[0,2,1,6],[3,4,5]]
colors=['#EAF2FB','#FFF3E3','#E8F4ED','#EFEBF8','#FCECEF','#E8F4F6','#F5F2DD']
columns={
0:[['organization','department','member'],['external_identity','login_session','archive_preference']],
1:[['work','manuscript_version','platform'],['editorial','editorial_work','editorial_target','editorial_assignment'],['editorial_review','editorial_review_item','editorial_archive']],
2:[['production_schedule','booking_terms','production_booking'],['production_assignment','production_archive_responsibility','production_archive']],
3:[['workflow','task_stage','stage_assignment'],['business_source','stage_source','workflow_completion'],['stage_confirmation','stage_completion']],
4:[['outcome','outcome_attachment','outcome_version'],['manuscript_review','stage_current_draft','publication']],
5:[['allowance_standard','contribution_policy','contribution_measurement'],['contribution_type','contribution_basis','stage_contribution'],['v_contribution_detail','v_pending_contribution'],['v_contribution_money','v_member_weekly_summary']],
6:[['weekly_report','report_department','report_seal'],['report_contribution','report_pending','v_report_member_summary']],
}
zones=[];totalwidths=[];y=126
for regions in bands:
    x=48;bandheight=0
    for ri in regions:
        cursors=[y+54]*len(columns[ri])
        colwidths=[max(cards[n]['width'] for n in members) for members in columns[ri]]
        cx=x+PAD
        for col,members in enumerate(columns[ri]):
            for n in members:
                cards[n].update(x=cx,y=cursors[col],region=ri)
                cursors[col]+=cards[n]['height']+46
            cx+=colwidths[col]+GAP
        cursor=max(cursors)
        reserve=32
        zh=cursor-y+reserve+10
        zw=sum(colwidths)+GAP*(len(colwidths)-1)+PAD*2
        zones.append(dict(id=ri,x=x,y=y,w=zw,h=zh,color=colors[ri],label=overview['regions'][ri]['label'],reserve=reserve))
        x+=zw+LANEGAP;bandheight=max(bandheight,zh)
    totalwidths.append(x-LANEGAP+48)
    y+=bandheight+72
W=max(totalwidths);H=y+156

# Route all relations from the child's actual FK field to the exact referenced
# parent column. Every segment stays in the corridors outside card rectangles.
routes=[]
def endpoint_pair(child,parent,cy,py):
    c=cards[child];p=cards[parent]
    if child==parent:cs=ps='right'
    elif c['x']<p['x']:cs='right';ps='left'
    elif c['x']>p['x']:cs='left';ps='right'
    else:cs=ps='right'
    def point(card,side,y):return (card['x']+(card['width'] if side=='right' else 0),card['y']+y)
    a=point(c,cs,cy);b=point(p,ps,py)
    return a,b,(a[0]+(16 if cs=='right' else -16),a[1]),(b[0]+(16 if ps=='right' else -16),b[1])
omitted=[]
for r in rels:
    # Shared member/department references are labeled in the field, as in the
    # examples' shared-reference area. All business-to-business FKs are drawn.
    if r['parent'] in ['member','department'] and cards[r['child']]['region']!=0:
        omitted.append(r['code']);continue
    col=r['columns'][0];pc=r['target_columns'][0]
    if pc is None:pc=next(c['name'] for c in tables[r['parent']]['columns'] if c['pk']==1)
    a,b,s,e=endpoint_pair(r['child'],r['parent'],cards[r['child']]['ports'][col],cards[r['parent']]['ports'][pc])
    child=cards[r['child']];parent=cards[r['parent']]
    if child['x']==parent['x'] and abs(child['y']-parent['y'])<max(child['height'],parent['height'])+80:
        if child['y']>parent['y']:
            a=(child['x']+child['width']/2,child['y']);b=(parent['x']+parent['width']/2,parent['y']+parent['height'])
            s=(a[0],a[1]-16);e=(b[0],b[1]+16)
        else:
            a=(child['x']+child['width']/2,child['y']+child['height']);b=(parent['x']+parent['width']/2,parent['y'])
            s=(a[0],a[1]+16);e=(b[0],b[1]-16)
    routes.append(dict(id=r['code'],child=r['child'],parent=r['parent'],a=a,b=b,start=s,end=e,relation=r,kind='fk'))

xs=set([24,W-24]);ys=set([112,H-170])
for card in cards.values():
    xs.update([card['x']-16,card['x']+card['width']+16])
    xs.update([card['x']-28,card['x']+card['width']+28])
    ys.update([card['y']-16,card['y']+card['height']+16])
    xs.update([card['x']-40,card['x']+card['width']+40])
    ys.update([card['y']-28,card['y']+card['height']+28])
for z in zones:ys.update([z['y']+45,z['y']+z['h']-22])
for r in routes:
    xs.update([r['start'][0],r['end'][0]]);ys.update([r['start'][1],r['end'][1]])
xs=sorted(xs);ys=sorted(ys);xi={v:i for i,v in enumerate(xs)};yi={v:i for i,v in enumerate(ys)}
blocked=set();rects=[(c['x']-7,c['y']-7,c['x']+c['width']+7,c['y']+c['height']+7) for c in cards.values()]
rects += [(z['x']+PAD-5,z['y']+8,z['x']+PAD+310,z['y']+42) for z in zones]
# Grid nodes and edges whose geometric segment intersects a card are blocked.
adj=collections.defaultdict(list)
for i,x in enumerate(xs):
    for j,y in enumerate(ys):
        if any(l<x<rr and t<y<bb for l,t,rr,bb in rects):continue
        here=(i,j)
        if i+1<len(xs):
            xx=xs[i+1]
            if not any(t<y<bb and max(x,l)<min(xx,rr) for l,t,rr,bb in rects):
                there=(i+1,j);adj[here].append((there,xx-x,0));adj[there].append((here,xx-x,0))
        if j+1<len(ys):
            yy=ys[j+1]
            if not any(l<x<rr and max(y,t)<min(yy,bb) for l,t,rr,bb in rects):
                there=(i,j+1);adj[here].append((there,yy-y,1));adj[there].append((here,yy-y,1))
usage=collections.Counter()
def route(r):
    start=(xi[r['start'][0]],yi[r['start'][1]]);goal=(xi[r['end'][0]],yi[r['end'][1]])
    q=[(0,0,start,-1)];best={(start,-1):0};prev={};found=None
    while q:
        _,cost,p,di=heapq.heappop(q)
        if cost!=best.get((p,di)):continue
        if p==goal:found=(p,di);break
        for np,length,nd in adj[p]:
            edge=tuple(sorted([p,np]));nc=cost+length+(35 if di!=-1 and di!=nd else 0)+usage[edge]*900
            state=(np,nd)
            if nc<best.get(state,float('inf')):
                best[state]=nc;prev[state]=(p,di)
                h=abs(xs[np[0]]-xs[goal[0]])+abs(ys[np[1]]-ys[goal[1]])
                heapq.heappush(q,(nc+h,nc,np,nd))
    assert found,r['id']
    chain=[]
    while found in prev:chain.append(found[0]);found=prev[found]
    chain.append(start);chain.reverse()
    for a,b in zip(chain,chain[1:]):usage[tuple(sorted([a,b]))]+=1
    pts=[r['a']]+[(xs[i],ys[j]) for i,j in chain]+[r['b']]
    compact=[]
    for p in pts:
        if compact and p==compact[-1]:continue
        if len(compact)>1 and (compact[-2][0]==compact[-1][0]==p[0] or compact[-2][1]==compact[-1][1]==p[1]):compact.pop()
        compact.append(p)
    return compact
for r in sorted(routes,key=lambda r:abs(r['a'][0]-r['b'][0])+abs(r['a'][1]-r['b'][1])):r['points']=route(r)

svg=[]
def emit(s):svg.append(s)
def txt(x,y,s,size=14,color='#263749',weight='normal',family='Microsoft YaHei',**attrs):
    extra=' '.join(f'{k.replace("_","-")}="{escape(str(v),quote=True)}"' for k,v in attrs.items())
    emit(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" font-family="{family}" {extra}>{escape(s)}</text>')
def key_icon(x,y,**attrs):
    extra=' '.join(f'{k.replace("_","-")}="{escape(str(v),quote=True)}"' for k,v in attrs.items())
    emit(f'<g class="pk-icon" transform="translate({x},{y})" {extra}><title>主键 PK</title>')
    emit('<polygon points="10,8 3,15 3,19 7,19 7,16 10,16 10,13 13,10" fill="#FFD43B" stroke="#C69516" stroke-width="0.8"/>')
    emit('<circle cx="13" cy="6" r="6" fill="#FFD43B" stroke="#C69516" stroke-width="0.8"/>')
    emit('<circle cx="14.5" cy="4.5" r="1.8" fill="white"/>')
    emit('</g>')
def fk_icon(x,y,**attrs):
    extra=' '.join(f'{k.replace("_","-")}="{escape(str(v),quote=True)}"' for k,v in attrs.items())
    emit(f'<g class="fk-icon" transform="translate({x},{y})" {extra}><title>外键 FK</title>')
    emit('<polygon points="0,1 19,8 0,15 5,8" fill="#00AEEF"/>')
    emit('</g>')
emit(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
emit('''<style>.relation {stroke:#526579;stroke-width:1.7;fill:none} .edge:hover .relation {stroke:#1b67af;stroke-width:3} .card:hover rect {stroke:#245e95;stroke-width:1.8}</style>''')
emit(f'<rect width="{W}" height="{H}" fill="#fff"/>')
txt(48,42,'图 46  青年传媒中心 · 数据库关系总图',30,weight='bold')
txt(48,75,'47 张基表 / 5 个派生视图 · 完整业务关联与基数 · 黄色钥匙标主键 / 蓝色箭头标外键目标表',17,color='#526579')
for z in zones:
    emit(f'<g id="region-{z["id"]}"><rect x="{z["x"]}" y="{z["y"]}" width="{z["w"]}" height="{z["h"]}" rx="0" fill="{z["color"]}" stroke="#bac6d2"/>')
    txt(z['x']+PAD,z['y']+32,str(z['id']+1)+'  '+z['label'],19,weight='bold')
    txt(z['x']+PAD,z['y']+z['h']-15,'扩展区',11,color='#788896')
    emit('</g>')

def marker(point,adjpoint,cardinality,color):
    x,y=point;dx=adjpoint[0]-x;dy=adjpoint[1]-y;length=math.hypot(dx,dy)
    assert length>0
    ux=dx/length;uy=dy/length;vx=-uy;vy=ux
    def line(ax,ay,bx,by):emit(f'<line x1="{ax}" y1="{ay}" x2="{bx}" y2="{by}" stroke="{color}" stroke-width="1.3"/>')
    def bar(d):line(x+ux*d+vx*5,y+uy*d+vy*5,x+ux*d-vx*5,y+uy*d-vy*5)
    if cardinality.endswith('*'):
        for s in [-1,0,1]:line(x+ux*2+vx*5*s,y+uy*2+vy*5*s,x+ux*12,y+uy*12)
        emit(f'<circle cx="{x+ux*18}" cy="{y+uy*18}" r="3.5" fill="white" stroke="{color}"/>')
    else:
        bar(5)
        if cardinality=='1':bar(12)
        else:emit(f'<circle cx="{x+ux*14}" cy="{y+uy*14}" r="3.5" fill="white" stroke="{color}"/>')

for r in routes:
    points=r['points'];path='M '+' L '.join(f'{x},{y}' for x,y in points)
    emit(f'<g class="edge" id="edge-{r["id"]}" data-child="{r["child"]}" data-parent="{r["parent"]}">')
    if r['kind']=='fk':
        rr=r['relation'];targetcols=rr['target_columns']
        if any(c is None for c in targetcols):targetcols=[c['name'] for c in sorted(tables[rr['parent']]['columns'],key=lambda c:c['pk']) if c['pk']]
        title=rr['code']+' '+rr['child']+'('+', '.join(rr['columns'])+') → '+rr['parent']+'('+', '.join(targetcols)+')'
        emit('<title>'+escape(title)+'</title>')
        emit(f'<path d="{path}" fill="none" stroke="white" stroke-width="4.8"/>')
        emit(f'<path class="relation" id="{r["id"]}" d="{path}"/>')
        marker(points[0],points[1],'0..1' if rr['unique'] else '0..*','#526579')
        marker(points[-1],points[-2],'0..1' if rr['nullable'] else '1','#526579')
    else:
        emit('<title>'+escape(r['parent']+' → '+r['child']+' 派生计算依赖')+'</title>')
        emit(f'<path class="dependency" id="{r["id"]}" d="{path}"/>')
    emit('</g>')

for n,c in cards.items():
    x=c['x'];y=c['y'];h=c['height']
    cw=c['width']
    emit(f'<g class="card" id="table-{n}" data-name="{n}" data-view="{str(c["view"]).lower()}">')
    emit(f'<rect x="{x}" y="{y}" width="{cw}" height="{h}" fill="white" stroke="#7b8b9b" stroke-width="1"/>')
    emit(f'<rect x="{x}" y="{y}" width="{cw}" height="78" fill="'+('#E0EEE2' if c['view'] else '#F7F9FC')+'"/>')
    assert width(n,17,True)<cw-28,(n,width(n,17,True))
    txt(x+14,y+25,n,17,weight='bold',family='Consolas')
    txt(x+14,y+49,c['label'],16,weight='bold')
    txt(x+14,y+68,'分析类：'+c['owner'],12,color='#5c7083')
    emit(f'<line x1="{x}" y1="{y+78}" x2="{x+cw}" y2="{y+78}" stroke="#b9c6d3"/>')
    for row in c['lines']:
        yy=y+row['y']
        if row['kind']=='field':
            emit(f'<g data-key="{row["keys"]}">')
            txt(x+18,yy,row['name'],14,family='Consolas',data_column=row['name'])
            iconx=x+18+len(row['name'])*7.7+8
            if 'PK' in row['keys']:
                key_icon(iconx,yy-15,data_column=row['name'],data_table=n)
                iconx+=24
            if 'FK' in row['keys']:
                fk_icon(iconx,yy-12,data_column=row['name'],data_table=n)
                iconx+=26
                parents=[]
                for ref in row['refs']:
                    if ref['table'] not in parents:parents.append(ref['table'])
                    emit(f'<g data-relation="{ref["relation"]}" data-target="{ref["target"]}" data-fk-column="{row["name"]}"><title>{escape(ref["target"])}</title></g>')
                label=' / '.join(parents)
                size=min(13,(cw-14-(iconx-x))/max(1,len(label)*0.62))
                assert size>=10,(n,row['name'],label,size)
                txt(iconx,yy,label,size,color='#235c85',family='Consolas',data_target_table=label)
            emit('</g>')
        else:
            txt(x+65,yy,row['text'],12,color='#235c85',family='Consolas',data_relation=row['relation'],data_target=row['target'],data_fk_column=row['column'])
    emit('</g>')
legendy=H-136
txt(48,legendy,'读图与键约束',18,weight='bold')
key_icon(48,legendy+13)
txt(75,legendy+29,'= 主键',15)
fk_icon(162,legendy+16)
txt(189,legendy+29,'= 外键，箭头后为目标表名；同一字段可同时显示两个独立图标。',15)
txt(48,legendy+57,'乌鸦脚：|| 恰好一；○| 零或一；○< 零到多。一对多两端分别标一／多，中间表保留两端关联。',15)
txt(48,legendy+85,'全部业务表之间的外键均绘制连线；跨区的共享成员／部门引用仅在字段旁标注。绿色卡片为视图。',15)
txt(48,legendy+113,'复合外键组成、目标列、唯一约束、类型与空值规则详见数据字典及参考 DDL。',15)
emit('</svg>')
(D/'db-overview.svg').write_text('\n'.join(svg),encoding='utf-8')
geometry=dict(width=W,height=H,card_width=CW,zones=zones,cards=cards,routes=routes,
              omitted_shared_references=omitted,old_dimensions=[8193,3542],renderer='render_database_overview.py')
(D/'overview-layout.json').write_text(json.dumps(geometry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Compact SVG: {W} x {H}; {len(cards)} cards; all {len(rels)} FK targets in fields; {len(routes)} business/shared-local relationships with cardinality.')
