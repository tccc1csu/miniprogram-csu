"""Build the complete PlantUML physical model from the migration catalog.

No database connections or business data are involved. FK identifiers are shared
by card fields, relationship lines and the exact constraint register.
"""
import json
import re
AREAS = {
    'organization': ('组织与身份', '#EAF2F8', ['departments', 'users', 'sessions']),
    'publication': ('任务与推文闭环', '#E4F2F1', ['tasks', 'assignments', 'task_reviewers', 'versions', 'reviews', 'publication_routing', 'publications', 'archives']),
    'materials': ('材料、报名与批注', '#F0EAF8', ['files', 'file_payloads', 'version_files', 'version_annotations', 'registrations', 'registration_files']),
    'jobs': ('六部门任务扩展', '#FFF1D6', ['jobs', 'bookings', 'article_lines', 'work_entries']),
    'accounting': ('工时、核定与封存', '#EAF3E3', ['worklogs', 'adjustments', 'report_seals', 'seal_rows', 'saved_views']),
    'policy': ('政策与默认配置', '#FBE8E5', ['workflow_policy', 'labor_rules', 'rule_revisions', 'publication_defaults', 'teacher_delivery', 'flow_defaults']),
    'rotation': ('轮转、审计与通知', '#E8ECFA', ['duty_rotation', 'duty_rotation_members', 'duty_slots', 'events', 'outbox', 'reminders']),
}


def columns(definition):
    return [name.strip() for name in re.search(r'\(([^)]+)\)', definition)[1].split(',')]


def build_full_erd(tables, labels, write, table):
    byname = {t['name']: t for t in tables}
    assert sorted(n for _, _, names in AREAS.values() for n in names) == sorted(byname)
    relations = []
    for t in tables:
        unique = [set(columns(c['definition'])) for c in t['constraints'] if c['type'] in ('p', 'u')]
        nulls = {c['name']: not c['not_null'] for c in t['columns']}
        for c in t['constraints']:
            if c['type'] != 'f':
                continue
            cols = columns(c['definition'])
            relations.append(dict(id=f'F{len(relations)+1:03}', source=t['name'], target=c['target'],
                name=c['name'], columns=cols, definition=c['definition'],
                optional=any(nulls[n] for n in cols), unique=any(u <= set(cols) for u in unique)))
    write('diagrams/database/db-full.puml', dot_body(tables, labels, relations))
    write('diagrams/database/full-model-index.json', json.dumps(dict(areas=AREAS, foreignKeys=relations), ensure_ascii=False, indent=2))
    text='''# 完整ERD与外键索引

完整大图把实际38张表、214个字段和79项外键放在同一画布；背景色只表示阅读分区，不是数据库schema。每张表只出现一次；跨区外键、同表自引用以及复合外键均保留。

- [SVG矢量大图](../diagrams/database/db-full.svg)：浏览器打开后放大查看。
- [单页矢量PDF](../diagrams/database/db-full.pdf)：适合大幅打印及缩放阅读。
- [完整PNG](../diagrams/database/db-full.png) · [PlantUML源文件](../diagrams/database/db-full.puml)

![完整物理ERD](../diagrams/database/db-full.svg)

## 读图约定

每个字段保留实际名称、PostgreSQL类型、非空及主外键标记。F编号同时出现在字段和关系线上，下面的登记表精确列出源列、目标列与删除规则。复合外键的各字段共用同一编号，不拆成多个独立约束。

箭头表示表级依赖，由引用表指向被引用表；箭头在表边的位置不表示字段对应，精确字段由F编号定位。复合外键整体连接，不拆成独立关系。图源采用PlantUML的DOT模式固定表卡位置，避免自动布局把公共身份引用拉成超宽图。非空不等同于必有子记录；业务上的必须完成审核、计酬资格等由服务端规则保障。唯一、检查约束、默认值和索引完整定义见[数据字典](data-dictionary.md)。

## 全部外键

'''
    text += table(['图中编号', '来源表', '约束名', '精确约束'], [(r['id'], r['source'], r['name'], r['definition']) for r in relations])
    write('database/full-erd.md', text)


def dot_body(tables, labels, relations):
    """PlantUML DOT mode supports a fixed poster layout and table-level FK arrows."""
    from html import escape
    byname = {t['name']: t for t in tables}
    card_width, col_gap, row_gap = 340, 65, 60
    # Three columns of colored business areas; the central workflow spans four
    # table columns, so long shared references have routing lanes around cards.
    layout = [
        ('organization', 0, 0, 2),
        ('jobs', 0, None, 2),
        ('materials', 0, None, 3),
        ('publication', 980, 0, 4),
        ('accounting', 980, None, 3),
        ('policy', 2740, 0, 2),
        ('rotation', 2740, None, 2),
    ]
    body = ['@startdot', 'digraph YouthMedia {',
        '// Generated from runtime-schema.json by build_full_erd.py; no business data.',
        'graph [layout=neato, overlap=true, splines=ortho, outputorder=edgesfirst, bgcolor="#FFFFFF", pad="0.5", fontname="Microsoft YaHei"];',
        'node [shape=plain, pin=true, fontname="Microsoft YaHei", fontsize=12];',
        'edge [color="#8A9AAF", penwidth=0.75, arrowsize=0.55, fontname="Microsoft YaHei", fontsize=9, fontcolor="#54677E"];',
    ]
    bottoms = {}
    for slug, x, top, width in layout:
        label, color, names = AREAS[slug]
        card_width = 260 if slug == 'materials' else 340
        if top is None:
            top = bottoms[x] + 140
        rows = [names[j:j+width] for j in range(0, len(names), width)]
        area_width = width * card_width + (width-1) * col_gap
        body += [f'subgraph cluster_{slug} {{', f'bgcolor="{color}"; color="{color}"; style="rounded"; margin=28;']
        header = f'area_{slug}_header [pos="{(x+area_width/2)/72:.3f},{-(top+18)/72:.3f}!", width={area_width/72:.3f}, height=0.5, label=<<B>{escape(label)}</B>>, fontsize=20, fontcolor="#22374B"];'
        body.append(header)
        cursor = top + 70
        for row in rows:
            heights = {n: 48 + 23*len(byname[n]['columns']) for n in row}
            max_height = max(heights.values())
            for i, name in enumerate(row):
                t = byname[name]
                px, py = (x + i*(card_width+col_gap) + card_width/2)/72, -(cursor+heights[name]/2)/72
                pk = {n for c in t['constraints'] if c['type']=='p' for n in columns(c['definition'])}
                header = f'<TR><TD BGCOLOR="{color}" ALIGN="LEFT" HEIGHT="43" WIDTH="{card_width}"><FONT POINT-SIZE="14"><B>{escape(labels[name])}</B></FONT><BR ALIGN="LEFT"/><FONT POINT-SIZE="10">{name}</FONT></TD></TR>'
                card = [f'<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" COLOR="#93A3B5" BGCOLOR="white" WIDTH="{card_width}">', header]
                for c in t['columns']:
                    refs = [r['id'] for r in relations if r['source']==name and c['name'] in r['columns']]
                    marker = (['PK'] if c['name'] in pk else []) + (['FK ' + ','.join(refs)] if refs else [])
                    key = ' / '.join(marker)
                    key_text = escape(key) or '&#160;'
                    field = ('* ' if c['not_null'] else '  ') + c['name']
                    # Explicit metadata permits coverage checks independent of
                    # any font metrics or SVG serializer.
                    body.append('// FIELD '+name+'.'+c['name']+' : '+c['type'])
                    card.append(f'<TR><TD PORT="{c["name"]}" ALIGN="LEFT" HEIGHT="23" WIDTH="{card_width}">{escape(field)} <FONT COLOR="#68798D" POINT-SIZE="10">: {escape(c["type"])}</FONT> <FONT COLOR="#326595" POINT-SIZE="9">{key_text}</FONT></TD></TR>')
                card.append('</TABLE>')
                body.append(f'{name} [pos="{px:.3f},{py:.3f}!", label=<'+''.join(card)+'>];')
            cursor += max_height + row_gap
        bottoms[x] = cursor - row_gap
        body.append('}')
    for r in relations:
        # Draw table-level dependencies. Graphviz orthogonal routing does not
        # reliably respect HTML field ports; exact columns are mapped by FK IDs.
        body.append('// '+r['id']+' '+r['source']+'.'+r['name']+': '+r['definition'])
        body.append(f'{r["source"]} -> {r["target"]} [xlabel="{r["id"]}"];')
    end = max(bottoms.values()) + 155
    body.append('diagram_title [pos="24,1.5!", label=<<B>青年传媒中心工作台 · 完整数据库关系图</B>>, fontsize=28, fontcolor="#22374B"];')
    body.append('diagram_subtitle [pos="24,0.9!", label="38张业务表 · 214字段 · 79项外键", fontsize=15, fontcolor="#54677E"];')
    legend = '<TABLE BORDER="0" CELLBORDER="0" CELLPADDING="5"><TR><TD ALIGN="LEFT"><B>读图约定</B>　PK 主键　FK 外键　* 非空　F001–F079 约束编号（字段与关系线对应）</TD></TR><TR><TD ALIGN="LEFT">箭头为表级依赖，端点不定位字段；复合外键整体保留。精确源列、目标列与删除规则见《完整ERD与外键索引》。</TD></TR><TR><TD ALIGN="LEFT">数据源：实际001–005迁移；schema youth_workbench。duty_slots为历史兼容表。图中不含账号密码或业务数据。</TD></TR><TR><TD ALIGN="LEFT">CloudBase技术支持表_state、_requests、_uploads不计入38张业务表。所有表卡和连线由PlantUML DOT模式渲染。</TD></TR></TABLE>'
    body.append(f'diagram_legend [pos="24,{-end/72:.3f}!", label=<{legend}>, fontsize=14];')
    body += ['}', '@enddot']
    return '\n'.join(body)
