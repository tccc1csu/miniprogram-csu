from pathlib import Path
import re, json

R=Path(__file__).resolve().parents[1]
D=R/'diagrams'/'analysis'; D.mkdir(parents=True,exist_ok=True)
S=(R/'requirements/system-use-case-specifications.md').read_text(encoding='utf-8')
T=dict(re.findall(r'^## (UC-[A-Z]+-\d{3})：(.+)$',S,re.M))
STYLE='''skinparam defaultFontName Microsoft YaHei
skinparam defaultFontSize 14
skinparam shadowing false
skinparam backgroundColor white
skinparam classAttributeIconSize 0
skinparam classBackgroundColor #F5FAFF
skinparam classBorderColor #46637F
skinparam ArrowColor #334155
skinparam nodesep 35
skinparam ranksep 45
'''
catalog={
'Member':('成员',['姓名','账号角色','启用'],['验证身份','验证业务资格','验证归属','沿用归档偏好']),
'Session':('登录会话',['有效期','终止时刻（可选）'],['建立会话']),
'Department':('部门',['名称','启用'],['验证成员归属','检查承办资格']),
'Organization':('中心组织',['名称'],['维护组织人员']),
'Editorial':('采编协同',['标题','截止日期（可选）','提交时刻','归档时刻（可选）'],['建立协同','派发同步','提交同步结果','审核并归档','提取应计贡献','完成归档']),
'Work':('作品',['名称','原创或转载'],['验证来源']),
'Version':('稿件版本',['版次','内容','提交时刻'],['验证送审条件','接受审查结论']),
'Outcome':('成果',['完成说明','提交时刻'],['验证完整性']),
'Publication':('发布成果',['平台','成果链接'],['验证发布依据']),
'Review':('审核结论',['审查层次','结论','意见','审查时刻'],['验证适用版本']),
'Schedule':('摄制日程',[],['受理预约']),
'BookingTerms':('摄制约定',['版本','生效范围','加急阈值','加急倍率'],['检查预约条件','判定加急']),
'Booking':('摄制预约',['任务名称','预约时段','地点','联系方式','提交时刻','抢单开放','承接方式','加急倍率','归档时刻（可选）'],['建立预约','确定承接','提交摄制成果','归档摄制成果','提取应计贡献','完成归档']),
'Workflow':('流转任务',['名称','需求来源','工作目标','结束时刻（可选）'],['建立任务','派发阶段','提交阶段成果','审查阶段稿件','确认阶段完成','提供待计量贡献']),
'Stage':('任务阶段',['次序','成果要求','截止日期（可选）','完成时刻（可选）'],['派发','提交成果','审查稿件','确认完成','检查可开始','提供贡献依据']),
'Ledger':('工作量台账',[],['归集贡献','查询个人工作量','核对部门工作量','生成中心周报','识别未计入贡献']),
'Contribution':('工作贡献',['贡献类型','发生时刻','基础工时','计入工时','适用倍率'],['验证计量依据','确认计量','核算津贴']),
'Weekly':('成员周汇总',['周次','/有效工时'],['按明细汇总','核对一致性','核算津贴']),
'Allowance':('津贴标准',['版本','生效范围','部门时薪','贡献计量约定'],['核定贡献工时','计算津贴']),
'Report':('中心周报',['周次','生成时刻'],['汇编统计结果']),
}

def cls(key):
    name,attrs,ops=catalog[key]
    no_args={'提取应计贡献','完成归档','提供待计量贡献','提供贡献依据','核算津贴'}
    return 'class "'+name+'" as '+key+' <<entity>> {\n'+''.join('  - '+a+'\n' for a in attrs)+''.join('  + '+o+('()' if o in no_args else '(业务信息)')+'\n' for o in ops)+'}\n'

classes=[]
def class_view(slug,title,keys,relations,note):
    text='@startuml\ntitle '+title+'\n'+STYLE+'hide empty members\n'
    text+=''.join(cls(k) for k in keys)+relations+'\nnote "'+note.replace('\n','\\n')+'" as Guidance\n@enduml\n'
    (D/(slug+'.puml')).write_text(text,encoding='utf-8')
    classes.append((slug,title))

class_view('class-editorial','分析类图（一）— 组织与稿件协同',
['Organization','Department','Member','Session','Editorial','Work','Version','Outcome','Publication','Review'],'''
Organization "1" -- "1..*" Department : 部门
Department "0..1" -- "0..*" Member : 当前所属
Member "1" -- "0..*" Session : 登录身份
Member "1" -- "0..*" Editorial : 发起人
Editorial "0..*" -- "0..1" Member : 当前办公承接人
Editorial "0..*" -- "1..*" Work : 同步作品
Work "1" *-- "1..*" Version : 历次稿件
Editorial "0..1" *-- "0..*" Outcome : 历次同步成果
Outcome "1" *-- "0..*" Publication : 各平台发布依据
Version "1" -- "0..*" Review : 对应版本审查
Editorial "0..1" -- "0..*" Review : 同步审核
Member "1" -- "0..*" Review : 审核人
Outcome "0..*" -- "0..*" Version : 涉及稿件
''','图中角色名限定关联意义。管理员可无所属部门。\n已派发协同恰有一名承接人；未派发时为 0。\n稿件版本及审核结论保留历史，重复提交不改写旧版本。')

class_view('class-production','分析类图（二）— 摄制预约',
['Member','Schedule','BookingTerms','Booking','Outcome'],'''
Schedule "1" -- "0..*" Booking : 有效预约
Schedule "1" -- "1..*" BookingTerms : 历次约定
Booking "0..*" -- "1" BookingTerms : 受理依据
Booking "0..*" -- "1" Member : 预约人
Booking "0..*" -- "0..1" Member : 当前摄制承接人
Booking "0..*" -- "0..1" Member : 指定办公归档人
Booking "0..1" *-- "0..1" Outcome : 提交的成果
''','派发和抢单共同调用确定承接()。\n该对象操作保证最多一名当前承接人。\n有冲突不建立摄制预约；加急判断保留受理时依据。\n冲突资源口径、两天的精度待确认，由摄制约定封装。')

class_view('class-workflow','分析类图（三）— 部门与跨部门流转',
['Member','Department','Workflow','Stage','Outcome','Version','Review'],'''
Member "1" -- "0..*" Workflow : 发起人
Workflow "1" *-- "1..*" Stage : 顺序阶段
Stage "后继 0..1" --> "前序 0..1" Stage : 相邻阶段
Stage "0..*" -- "1" Department : 承办部门
Stage "0..*" -- "0..1" Member : 当前承接人
Stage "0..1" *-- "0..*" Outcome : 历次成果
Stage "0..*" -- "0..1" Version : 当前送审版
Outcome "0..*" -- "0..*" Version : 涉及稿件
Version "1" -- "0..*" Review : 版本审查
Member "1" -- "0..*" Review : 审核人
''','任务拥有阶段，控制类先请求流转任务，再由任务委派阶段。\n每阶段一名当前承接人，贡献人员不等同于当前负责人。\n本轮按已有规约的顺序流转方案分析，不新增并行汇合制度。')

class_view('class-accounting','分析类图（四）— 工作贡献与津贴核算',
['Ledger','Contribution','Weekly','Allowance','Report','Member','Department'],'''
class "采编协同" as Editorial <<entity>>
class "摄制预约" as Booking <<entity>>
class "任务阶段" as Stage <<entity>>
class "流转任务" as Workflow <<entity>>
Ledger "1" -- "0..*" Contribution : 已确认贡献
Ledger "1" -- "0..*" Weekly : 成员周汇总
Ledger "1" -- "1..*" Allowance : 可用规则版本
Ledger "1" -- "0..*" Report : 生成周报
Editorial ..> Ledger : 归档时归集贡献
Booking ..> Ledger : 归档时归集贡献
Workflow ..> Ledger : 最后阶段完成时归集
Contribution "0..*" -- "1" Member : 贡献人
Contribution "0..*" -- "1" Department : 计量时所属部门
Contribution "0..*" -- "1" Allowance : 计量依据
Department "1" -- "1..*" Allowance : 历次标准
Weekly "0..*" -- "1" Member : 汇总对象
Weekly "1" -- "0..*" Contribution : 本周有效明细
Report "0..*" -- "0..*" Weekly : 统计依据
Editorial "0..1" -- "0..*" Contribution : 协同来源
Booking "0..1" -- "0..*" Contribution : 摄制来源
Stage "0..1" -- "0..*" Contribution : 阶段来源
note bottom of Contribution
  {xor} 三种来源恰有一种成立。
  每项贡献关联一个实际来源；
  来源、贡献类型、成员共同防止重复。
end note
''','工作贡献对应需求中的任务明细；成员周汇总对应每周一条汇总。\n每项贡献恰关联一个来源协同、预约或任务阶段，不能重复计量。\n同一成员、周次只有一份汇总；有效工时由明细推导。\n基础工时 → 计入工时 → 津贴，加急倍率只应用一次。')

# State and sequence messages use the same catalog of entity operations.
seqs=[]
roles={
'UC-AUTH-001':('登录用户','普通成员接口'),
'UC-ED-001':('采编成员','普通成员接口'),'UC-ED-002':('办公部部长','部长接口'),'UC-ED-003':('办公承接成员','普通成员接口'),'UC-ED-004':('指导老师','管理员接口'),
'UC-PR-001':('中心预约成员','普通成员接口'),'UC-PR-002':('摄制部部长','部长接口'),'UC-PR-003':('摄制承接成员','普通成员接口'),'UC-PR-004':('指定办公归档成员','普通成员接口'),'UC-PR-005':('摄制成员','普通成员接口'),
'UC-FL-001':('任务发起成员','普通成员接口'),'UC-FL-002':('阶段所属部长','部长接口'),'UC-FL-003':('阶段承接成员','普通成员接口'),'UC-FL-004':('阶段所属部长','部长接口'),
'UC-RV-001':('运营部部长','部长接口'),'UC-RV-002':('指导老师','管理员接口'),
'UC-REC-001':('部门部长','部长接口'),'UC-STAT-001':('办公部部长','部长接口'),'UC-ORG-001':('维护管理员','管理员接口'),'UC-VIEW-001':('普通成员','普通成员接口')}
def sequence(code,entities,body,desc,coverage='基本路径及简单扩展',auth=True):
    slug='seq-'+code.lower()
    actor,boundary=roles[code]
    s='@startuml\ntitle '+code+' '+T[code]+' — 分析序列图\n'+STYLE+'''hide footbox
autonumber
skinparam sequenceMessageAlign center
skinparam sequenceGroupBackgroundColor white
'''
    s+=f'actor "{actor}" as A\nboundary "接口:{boundary}" as B\ncontrol "控制:{T[code]}控制" as C\n'
    for alias,key in entities.items():s+=f'participant "{alias}:{catalog[key][0]}" as {alias}\n'
    s+=f'A -> B: {T[code]}(业务信息)\nactivate B\nB -> C: {T[code]}(业务信息)\nactivate C\n'
    if auth:
        s+='''C -> M: 验证业务资格(操作人、部门与职责)
M --> C: 资格结论
break 无权执行
  C --> B: 拒绝结果及原因
  B --> A: 拒绝结果及原因
end
'''
    if code in ['UC-ED-004','UC-PR-004','UC-FL-004']:
        s+='participant "G:工作贡献" as G\n'
        body=body.replace('R --> L: 计入工时及生效版本','R --> L: 计入工时及生效版本\n    L -> G: 确认计量(来源、成员、部门、工时、标准版本)\n    G --> L: 有效贡献')
        body=body.replace('R --> L: 计入工时、适用倍率及版本','R --> L: 计入工时、适用倍率及版本\n    L -> G: 确认计量(来源、成员、部门、工时、倍率、版本)\n    G --> L: 有效贡献')
        if code=='UC-FL-004':
            # G already names the stage; a contribution uses a distinct object alias.
            s=s.replace('participant "G:工作贡献" as G','participant "Item:工作贡献" as Item')
            body=body.replace('R --> L: 计量依据或待核对原因','R --> L: 计量依据或待核对原因\n    opt 计量依据齐备\n      L -> Item: 确认计量(实际来源、成员、部门、工时、标准版本)\n      Item --> L: 有效贡献\n    end')
    s+=body+'''
C --> B: 业务结果或拒绝原因
deactivate C
B --> A: 业务结果或拒绝原因
deactivate B
@enduml
'''
    (D/(slug+'.puml')).write_text(s,encoding='utf-8')
    seqs.append(dict(code=code,slug=slug,title=T[code],description=desc,coverage=coverage,entities=entities,boundary=boundary))

sequence('UC-AUTH-001',{'M':'Member','S':'Session'},'''
alt 微信授权凭据
  boundary "授权接口:微信授权服务接口" as W
  actor "微信授权服务" as X
  C -> W: 验证授权凭据(凭据)
  W -> X: 验证授权凭据(凭据)
  X --> W: 授权身份或失败
  W --> C: 授权身份或失败
else 账号登录凭据
  note right of C: 账号凭据直接交给成员验证。
end
break 授权凭据验证失败
  C --> B: 登录失败
  B --> A: 登录失败
end
C -> M: 验证身份(凭据或授权身份)
M --> C: 身份、有效职责及会话依据，或拒绝原因
opt 身份有效且账号角色关系合法
  C -> S: 建立会话(成员、有效职责、有效期)
  S --> C: 有效会话
end
''','微信授权边界封装外部身份服务，成员承担账号有效性与角色关系验证；图中的登录入口为三类角色共用。',auth=False)

sequence('UC-ED-001',{'M':'Member','E':'Editorial','W':'Work'},'''
C -> E: 建立协同(来源成员、作品、平台、可选期限)
activate E
E -> W: 验证来源(材料、原创或转载)
W --> E: 来源验证结果
E --> C: 待派发协同或信息不合法原因
deactivate E
''','协同负责建立可追踪的需求，作品验证稿件来源；截止日期为空不作为拒绝理由。')
sequence('UC-ED-002',{'M':'Member','E':'Editorial','O':'Member'},'''
C -> E: 派发同步(部长、承接成员、可选期限)
activate E
E -> O: 验证归属(办公部)
O --> E: 成员资格
E --> C: 唯一承接结果或状态不允许原因
deactivate E
''','派发资格由成员和协同各自验证；协同保证待派发条件及唯一承接责任。')
sequence('UC-ED-003',{'M':'Member','E':'Editorial','O':'Outcome'},'''
C -> E: 提交同步结果(承接人、平台、链接、说明)
activate E
E -> O: 验证完整性(成果材料)
O --> E: 完整性结论
E --> C: 待审核结果或拒绝原因
deactivate E
''','协同接收当前承接人的成果，并保留退回重提历史；成果对象验证完整性，控制类不逐项读取属性判断。')

sequence('UC-ED-004',{'M':'Member','E':'Editorial','O':'Outcome','L':'Ledger','R':'Allowance','W':'Weekly'},'''
C -> E: 审核并归档(老师、结论、意见、对应版本)
activate E
E -> O: 验证完整性(本次同步成果)
O --> E: 完整性结论
alt 无审核资格、状态不允许或材料不全
  E --> C: 拒绝且保持原结果
else 合法退回结论
  E --> C: 修改意见及待修改责任，未计量
else 已归档后的同一合法请求
  E --> C: 原归档结果，不重新计量
else 合法通过结论
  E -> E: 提取应计贡献()
  E -> L: 归集贡献(来源协同、原创采编及办公同步依据)
  activate L
  L -> L: 识别未计入贡献(来源、类型、成员)
  loop 每项未计入的有效贡献
    L -> R: 核定贡献工时(贡献依据)
    R --> L: 计入工时及生效版本
  end
  L -> W: 按明细汇总(本周有效贡献)
  W --> L: 更新后的汇总
  L --> E: 计量结果
  deactivate L
  E -> E: 完成归档()
  E --> C: 归档结果及计量依据
end
deactivate E
''','通过时分别归集原创采编和办公同步贡献；转载不产生原创写作贡献。退回不计量，重复合法归档返回原结果。归档与明细归集作为一致的业务结果完成；失败不留下半份有效结果。')

sequence('UC-PR-001',{'M':'Member','S':'Schedule','R':'BookingTerms'},'''
C -> S: 受理预约(预约人、时段、地点、联系方式)
activate S
S -> R: 检查预约条件(信息、有效预约集合)
R --> S: 完整性与冲突结论
alt 信息不全或时间冲突
  S --> C: 拒绝原因，不建立预约对象
else 可受理
  S -> R: 判定加急(提交时刻、预约开始时刻)
  R --> S: 加急结论、倍率及约定版本
  create participant "P:摄制预约" as P
  S -> P: 建立预约(完整信息、加急依据)
  P --> S: 未承接的预约
  S --> C: 受理结果
end
deactivate S
''','摄制日程负责受理并委托摄制约定判断冲突和加急；冲突分支没有预约对象。两天与 1.5 倍率作为约定依据保留，未明确的冲突资源范围不在分析中擅自定死。')
sequence('UC-PR-002',{'M':'Member','P':'Booking','N':'Member'},'''
C -> P: 确定承接(部长、指定成员、派发)
activate P
P -> N: 验证归属(摄制部)
N --> P: 成员资格
alt 无承接人且资格有效
  P --> C: 唯一承接结果
else 已被派发、抢单或资格无效
  P --> C: 拒绝，保留已有承接关系
end
deactivate P
''','派发与抢单都请求摄制预约的确定承接操作，由同一对象保护唯一承接关系。')
sequence('UC-PR-003',{'M':'Member','P':'Booking','O':'Outcome','N':'Member'},'''
C -> P: 提交摄制成果(承接人、成果、指定归档人)
activate P
P -> O: 验证完整性(拍摄或制作成果)
O --> P: 完整性结论
P -> N: 验证归属(办公部普通成员)
N --> P: 归档资格
P --> C: 待归档结果或拒绝原因
deactivate P
opt 提交成功
  C -> M: 沿用归档偏好(本次指定归档人)
  M --> C: 偏好已保留
end
''','预约核验当前承接人，成果与办公成员分别承担完整性及归属验证；沿用归档偏好不能替代本次责任确认。')
sequence('UC-PR-004',{'M':'Member','P':'Booking','O':'Outcome','L':'Ledger','R':'Allowance','W':'Weekly'},'''
C -> P: 归档摄制成果(操作人、归档结论)
activate P
alt 非指定归档人或当前不能归档
  P --> C: 拒绝且不改变原预约
else 同一归档人重复已完成归档
  P --> C: 原归档结果，不重复计量
else 首次有效归档
  P -> O: 验证完整性(成果及说明)
  O --> P: 完整性结论
  alt 成果不完整
    P --> C: 拒绝归档
  else 成果完整且计量依据齐备
  P -> P: 提取应计贡献()
  P -> L: 归集贡献(预约来源、摄制与归档贡献)
  activate L
  L -> L: 识别未计入贡献(来源、类型、成员)
  loop 两类贡献中尚未计入的项
    L -> R: 核定贡献工时(基础工时、受理时加急依据)
    R --> L: 计入工时、适用倍率及版本
  end
  L -> W: 按明细汇总(各成员本周有效贡献)
  W --> L: 成员周汇总
  L --> P: 计量结果
  deactivate L
  P -> P: 完成归档()
  P --> C: 归档及工时依据
  end
end
deactivate P
''','指定办公成员归档后形成摄制、归档两项贡献。加急是否适用于某类贡献由生效标准决定，不能直接把两类工时都乘 1.5；重复请求不再增加工时。')
sequence('UC-PR-005',{'M':'Member','P':'Booking'},'''
C -> P: 确定承接(申请成员、本人、抢单)
activate P
alt 已开放抢单且尚未承接，申请有效
  P --> C: 首个有效申请的唯一承接结果
else 本人重复请求已承接任务
  P --> C: 已有承接结果
else 未开放、无资格或已由其他人承接
  P --> C: 拒绝且保留既有责任人
end
deactivate P
note over C,P
  资格与“未承接”条件由确定承接操作共同保护。
  不采用先读承接人、再由控制类写入的分离动作。
end note
''','抢单与派发冲突时只有一个当前承接结果；抢单成功本身不计工时。')

sequence('UC-FL-001',{'M':'Member','F':'Workflow','G':'Stage','D':'Department'},'''
C -> F: 建立任务(需求来源、部门与有序阶段、成果要求)
activate F
loop 每个参与阶段
  F -> D: 检查承办资格(阶段工作要求)
  D --> F: 部门有效性与责任范围
end
F -> G: 检查可开始(前序条件)
G --> F: 首阶段可派发，后续阶段等待
F --> C: 有序阶段任务或信息不合法原因
deactivate F
''','发起人登记的部门和阶段由任务整体组织；需求来源可以是外部门，登记人仍按当前规约描述为中心成员。')
sequence('UC-FL-002',{'M':'Member','F':'Workflow','G':'Stage','N':'Member'},'''
C -> F: 派发阶段(部长、目标阶段、承接人、排班依据)
activate F
F -> G: 检查可开始(前序阶段完成情况)
G --> F: 可开始或等待前序
F -> G: 派发(部长、承接人、排班依据)
activate G
G -> N: 验证归属(阶段所属部门)
N --> G: 成员资格
G --> F: 唯一承接结果或拒绝原因
deactivate G
F --> C: 派发结果
deactivate F
''','控制类先请求流转任务整体，再由任务委托阶段。前序未完成时阶段拒绝派发，排班仅作为部长安排依据。')
sequence('UC-FL-003',{'M':'Member','F':'Workflow','G':'Stage','O':'Outcome','V':'Version'},'''
C -> F: 提交阶段成果(承接人、阶段、成果与贡献依据)
activate F
F -> G: 提交成果(承接人、成果与贡献依据)
activate G
G -> O: 验证完整性(成果材料)
O --> G: 完整性结论
opt 稿件成果
  G -> V: 验证送审条件(本版材料及已有结论)
  V --> G: 需一审、需二审、可发布或须重新审核
end
G --> F: 待审、待确认或拒绝结果
deactivate G
F --> C: 提交结果
deactivate F
''','阶段根据成果性质决定后续责任。稿件内容变更需重新审查；已审稿件仅补充发布链接时进入完成确认，不把链接补充误当新一版稿件。')
sequence('UC-FL-004',{'M':'Member','F':'Workflow','G':'Stage','Next':'Stage','L':'Ledger','R':'Allowance','W':'Weekly'},'''
C -> F: 确认阶段完成(部长、阶段、结论、依据)
activate F
F -> G: 确认完成(部长、结论、审核与成果依据)
G --> F: 完成、退回或拒绝
alt 退回或所需审核未通过
  F --> C: 本阶段结果，不开启后续阶段
else 已完成且还有后续阶段
  F -> Next: 检查可开始(前序条件)
  Next --> F: 下一阶段可安排
  F --> C: 阶段完成及下阶段责任
else 最后阶段已完成
  F -> F: 提供待计量贡献()
  F -> L: 归集贡献(各来源阶段、已确认贡献)
  L -> L: 识别未计入贡献(实际来源、类型、成员)
  loop 每项待计量贡献
    L -> R: 核定贡献工时(贡献依据)
    R --> L: 计量依据或待核对原因
  end
  L -> W: 按明细汇总(有效贡献)
  W --> L: 汇总结果
  L --> F: 有效明细、汇总及待核对项
  F --> C: 任务完成结果
end
deactivate F
''','完成确认先由阶段验证稿件审核与成果条件。任务最后一阶段完成后归集贡献，依据不足的项标为待核对；专门流程已计入的相同实际贡献不能重复计量。')
for code,level in [('UC-RV-001','一审'),('UC-RV-002','二审')]:
    sequence(code,{'M':'Member','F':'Workflow','G':'Stage','V':'Version','R':'Review'},f'''
C -> F: 审查阶段稿件(审核人、阶段、{level}结论、意见、版次)
activate F
F -> G: 审查稿件(审核人、{level}结论、意见、版次)
activate G
G -> V: 验证送审条件({level}、前序结论、当前版次)
V --> G: 送审条件结论
alt 资格、版次或前序结论不符
  G --> F: 拒绝保存审查结论
else 审查条件满足
  G -> V: 接受审查结论(审核人、{level}结论、意见)
  V -> R: 验证适用版本(本稿件版次)
  R --> V: 结论关联成立
  V --> G: 已保存的通过或退回结论
  G --> F: {'待老师二审或待修改' if level=='一审' else '待发布或待修改'}
end
deactivate G
F --> C: 审查结果
deactivate F
''',('运营部长一审通过后转老师二审；' if level=='一审' else '老师二审检查适用的前序结论；')+'稿件版本持有该版审查依据，不能以旧版本通过结论处理修改后的稿件。采编专门流程由 UC-ED-004 处理。')

sequence('UC-REC-001',{'M':'Member','L':'Ledger','W':'Weekly'},'''
C -> L: 核对部门工作量(部长、本部门、周次)
activate L
loop 本部门各成员周汇总
  L -> W: 核对一致性(对应有效贡献)
  W --> L: 一致结果或差异及来源
end
L --> C: 核对结果与异常，不补造明细
deactivate L
''','核对只比较有效明细及周汇总并标明差异，不能在查询期间悄悄补造贡献。')
sequence('UC-STAT-001',{'M':'Member','L':'Ledger','W':'Weekly','G':'Contribution','R':'Allowance','P':'Report'},'''
C -> L: 生成中心周报(办公部部长、周次、范围)
activate L
loop 范围内各成员周汇总
  L -> W: 核对一致性(有效贡献)
  W --> L: 核对结果及异常
  L -> W: 核算津贴()
  activate W
  loop 每项有效贡献
    W -> G: 核算津贴()
    G -> R: 计算津贴(计入工时、计量部门)
    R --> G: 津贴及标准版本
    G --> W: 本项金额及依据
  end
  W --> L: 本人汇总与津贴依据
  deactivate W
end
L -> P: 汇编统计结果(成员结果、异常、规则依据)
P --> L: 可导出的中心周报
L --> C: 周报及异常说明
deactivate L
note over G,R: 使用已核定计入工时，导出不再乘加急倍率。
''','台账组织汇总，成员周汇总委托各项贡献核算，贡献按关联标准计算津贴。控制类不自行计算工时或时薪；周报生成不新增工作贡献。')
sequence('UC-ORG-001',{'M':'Member','O':'Organization','D':'Department'},'''
C -> O: 维护组织人员(管理员、部门成员变更、生效时间)
activate O
O -> D: 验证成员归属(拟变更关系)
D --> O: 归属合法性
O --> C: 变更结果或拒绝原因
deactivate O
note over C,O: 停用不删除历史贡献与责任关联。
''','中心组织维护有效部门和成员关系；历史贡献保留计量时部门与规则依据，人员调整不改写既有统计。')
sequence('UC-VIEW-001',{'M':'Member','L':'Ledger','W':'Weekly'},'''
C -> L: 查询个人工作量(本人、周次范围)
activate L
L -> W: 核对一致性(本人有效明细)
W --> L: 汇总、明细与异常
L --> C: 本人可访问工作记录
deactivate L
''','个人查询返回本人明细、周汇总及异常；系统内部的台账和汇总对象不是外部执行者。')

# Explicit boundary/control/entity responsibility view for the central archive use case.
view='''@startuml
title 分析类图（五）— 归档摄制成果的边界、控制与实体职责
'''+STYLE+'''
left to right direction
class "普通成员接口" as UI <<boundary>> {
  + 归档摄制成果(业务信息)
}
class "归档摄制成果控制" as CT <<control>> {
  + 归档摄制成果(业务信息)
}
'''+''.join(cls(k) for k in ['Member','Booking','Ledger','Allowance','Weekly'])+'''
UI ..> CT : 请求用例服务
CT ..> Member : 验证操作人资格
CT ..> Booking : 委派归档责任
Booking ..> Ledger : 归集已确认贡献
Ledger ..> Allowance : 核定贡献工时
Ledger ..> Weekly : 按有效明细汇总
note bottom of CT
  控制类控制用例路径并分配责任。
  它不自行判断预约状态或计算津贴。
end note
@enduml
'''
(D/'class-responsibilities.puml').write_text(view,encoding='utf-8')
classes.append(('class-responsibilities','分析类图（五）— 归档摄制成果的边界、控制与实体职责'))

# All per-use-case controls are declared, with only their directly contacted entities.
# Entity attributes and full signatures remain in the four domain views.
groups=[
 ('class-controls-editorial','分析类图（六）— 采编协同用例职责',['UC-ED-001','UC-ED-002','UC-ED-003','UC-ED-004']),
 ('class-controls-production','分析类图（七）— 摄制预约用例职责',['UC-PR-001','UC-PR-002','UC-PR-003','UC-PR-004','UC-PR-005']),
 ('class-controls-workflow','分析类图（八）— 部门流转与稿件审核用例职责',['UC-FL-001','UC-FL-002','UC-FL-003','UC-FL-004','UC-RV-001','UC-RV-002']),
 ('class-controls-support','分析类图（九）— 登录、统计与组织用例职责',['UC-AUTH-001','UC-REC-001','UC-STAT-001','UC-ORG-001','UC-VIEW-001'])
]
for slug,title,codes in groups:
    s='@startuml\ntitle '+title+'\n'+STYLE+'left to right direction\nhide empty members\n'
    boundaries={}; entities=set(); links=[]
    for code in codes:
        item=next(x for x in seqs if x['code']==code)
        boundary=item['boundary']
        if boundary not in boundaries: boundaries[boundary]='B'+str(len(boundaries))
        ct='C'+code.replace('-','')
        s+=f'class "{T[code]}控制" as {ct} <<control>> {{\n  + {T[code]}(业务信息)\n}}\n'
        links.append(f'{boundaries[boundary]} ..> {ct} : {code}')
        source=(D/(item['slug']+'.puml')).read_text(encoding='utf-8')
        aliases=dict((a,c) for c,a in re.findall(r'(?:participant|create participant) "[^":]+:([^"]+)" as (\w+)',source))
        for alias in sorted(set(re.findall(r'^\s*C -> (\w+):',source,re.M))):
            if alias in aliases:
                name=aliases[alias]; entities.add(name)
                links.append(f'{ct} ..> E{list(catalog).index(next(k for k,v in catalog.items() if v[0]==name))} : 委派责任')
    for name,alias in boundaries.items():s+=f'class "{name}" as {alias} <<boundary>>\n'
    for name in sorted(entities):
        key=next(k for k,v in catalog.items() if v[0]==name)
        s+=f'class "{name}" as E{list(catalog).index(key)} <<entity>>\n'
    if 'UC-AUTH-001' in codes:
        s+='class "微信授权服务接口" as WX <<boundary>>\nCUCAUTH001 ..> WX : 请求身份验证\n'
    s+='\n'.join(links)+'\nnote "实体属性与操作详见前四张类图；\\n实体间协作详见对应序列图。\\n虚线表示职责依赖，不表示业务流转先后。" as Guidance\n@enduml\n'
    (D/(slug+'.puml')).write_text(s,encoding='utf-8');classes.append((slug,title))

states=[]
def state(slug,title,owner,body,desc):
    body=body.replace('() [','()\\n[').replace('] /',']\\n/')
    s='@startuml\ntitle '+title+'\n'+STYLE+'''hide empty description
skinparam stateBackgroundColor #F5FAFF
skinparam stateBorderColor #46637F
'''+body+'\n@enduml\n'
    (D/(slug+'.puml')).write_text(s,encoding='utf-8')
    states.append(dict(slug=slug,title=title,owner=owner,description=desc))

state('state-editorial','分析状态机图（一）— 采编协同','Editorial','''
state "待派发" as Unassigned
state "待同步" as Assigned
state "待审核" as Submitted
state "待修改" as Returned
state "已归档" as Archived
[*] --> Unassigned
note left of Unassigned: 有效需求建立协同后，默认进入待派发。
Unassigned --> Assigned : 派发同步() [部长有权且承接人属于办公部] / 确立承接关系
Assigned --> Submitted : 提交同步结果() [当前承接人且成果完整] / 保存成果版本
Submitted --> Returned : 审核并归档() [老师退回且意见完整] / 保留修改意见
Returned --> Submitted : 提交同步结果() [当前承接人且修订完整] / 保存修订版本
Submitted --> Archived : 审核并归档() [老师通过、材料齐备且计量依据可用] / 归集贡献并保存归档依据
Archived : 审核并归档() [同一合法归档请求] / 返回原结果，不重复计量
note bottom of Archived
  已归档对象继续供查询和重复请求核对，
  因此不画成对象消亡的终态。
  不满足事件资格或警戒条件时，拒绝并保持原状态。
end note
''','状态属于一条采编协同。迁移前核验审核、材料和可用计量依据，迁移动作完成贡献归集与归档；已归档仍可查询，重复合法归档用内部响应表示。')
state('state-production','分析状态机图（二）— 摄制预约','Booking','''
state "未承接" as Open
state "已承接待完成" as Assigned
state "成果齐备待归档" as Submitted
state "已归档" as Archived
[*] --> Open
note left of Open: 通过冲突检查后建立预约，默认未承接；保留加急依据。
Open --> Assigned : 确定承接() [部长派发合法且当前无人承接] / 确立承接关系
Open --> Assigned : 确定承接() [抢单开放且首个申请有效] / 确立承接关系
Assigned --> Submitted : 提交摄制成果() [当前承接人、成果齐备、归档人有效] / 确立归档责任
Submitted --> Archived : 归档摄制成果() [指定办公成员、成果齐备且计量依据可用] / 归集贡献并保存归档依据
Assigned : 确定承接() [本人重复抢单] / 返回已有承接结果
Assigned : 确定承接() [其他承接请求] / 拒绝，不覆盖责任人
Archived : 归档摄制成果() [原归档人重复请求] / 返回已有归档结果
note bottom of Open
  时间冲突在受理前拒绝，不产生预约对象，
  因而没有“冲突预约”状态。
  抢单开放条件由业务约定输入，不推定开放时机。
end note
note bottom of Archived
  未满足资格、成果或计量条件的事件被拒绝，原状态保持。
  已归档保留查询能力，不进入对象消亡终态。
end note
''','同一个确定承接事件按派发／抢单条件处理，未承接检查与建立承接关系作为一个对象责任。冲突拒绝发生在对象创建前。')
state('state-stage','分析状态机图（三）— 任务阶段（运营推文实例）','Stage','''
state "待前序" as Waiting
state "可派发" as Ready
state "待制作" as Working
state "待一审" as First
state "待二审" as Second
state "待修改" as Returned
state "审核通过待发布" as Publish
state "待完成确认" as Confirm
state "待补正成果" as Correct
state "已完成" as Done
[*] --> Waiting
Waiting --> Ready : 检查可开始() [无前序或前序已完成]
Ready --> Working : 派发() [部长有权且成员有效] / 确立阶段承接关系
Working --> First : 提交成果() [稿件完整且为当前承接人] / 保存稿件版本
First --> Second : 审查稿件() [运营部长一审通过且版本一致] / 保存一审结论
First --> Returned : 审查稿件() [一审退回且意见完整] / 保存修改意见
Second --> Returned : 审查稿件() [老师二审退回且意见完整] / 保存修改意见
Returned --> First : 提交成果() [修订完整] / 保存新版本，重新审核
Second --> Publish : 审查稿件() [老师二审通过且版本一致] / 保存二审结论
Publish --> Confirm : 提交成果() [稿件未变且发布依据完整] / 保存平台与链接
Publish --> First : 提交成果() [稿件内容改变] / 保存新版本，重新审核
Confirm --> Done : 确认完成() [部长有权、成果完整且适用审核通过] / 保留贡献依据
Confirm --> Correct : 确认完成() [成果退回且意见完整] / 保留补正要求
Correct --> Confirm : 提交成果() [仅补正发布依据且完整]
Correct --> First : 提交成果() [稿件内容改变] / 重新审核
Done : 确认完成() [重复合法确认] / 返回原结果，不重复归集
note bottom of Done
  本图只描述运营推文阶段对象，非整个组织审批流程。
  普通美编阶段不套用稿件一审、二审，见文字说明。
  未通过审核不得确认完成；阶段完成不等于已计入津贴。
end note
''','以已明确审核岗位的运营推文阶段为例。状态由承接、稿件版本、审核结论、发布依据共同决定；退回后分清稿件修改与发布依据补正。')

state('state-stage-design','分析状态机图（四）— 任务阶段（美编设计实例）','Stage','''
state "待前序" as Waiting
state "可派发" as Ready
state "待完成" as Working
state "待完成确认" as Confirm
state "待修改" as Returned
state "已完成" as Done
[*] --> Waiting
Waiting --> Ready : 检查可开始() [无前序或前序已完成]
Ready --> Working : 派发() [本部门部长有权且承接人有效] / 确立承接关系
Working --> Confirm : 提交成果() [当前承接人且设计成果完整] / 保存成果及贡献依据
Confirm --> Returned : 确认完成() [本部门部长退回且意见完整] / 保存修改要求
Returned --> Confirm : 提交成果() [当前承接人且修订完整] / 保留历次成果
Confirm --> Done : 确认完成() [本部门部长通过且成果齐备] / 确认贡献依据
Done : 确认完成() [重复合法请求] / 返回原结果
note bottom of Done
  本图限定为不涉及稿件内容审核的设计阶段。
  已完成阶段保留查询能力；计量由任务整体组织。
end note
''','美编设计阶段直接交部长确认，不套用运营稿件的一审、二审；退回保留原责任人与历史成果。')
state('state-workflow','分析状态机图（五）— 流转任务','Workflow','''
state "阶段进行中" as Active
state "已完成" as Completed
[*] --> Active
note left of Active: 有效任务及有序阶段建立后默认进行中。
Active : 派发阶段() [目标阶段可开始且部长有权] / 委托目标阶段派发
Active : 提交阶段成果() [当前承接人有权] / 委托目标阶段保存成果
Active : 审查阶段稿件() [当前审核人有权] / 委托阶段及稿件版本审查
Active : 确认阶段完成() [非末阶段确认通过] / 保存阶段结果并核验后继可开始
Active : 确认阶段完成() [合法退回] / 委托阶段保留补正责任
Active --> Completed : 确认阶段完成() [末阶段确认通过且全部阶段已完成] / 结束任务并归集可核实贡献，标明待核对项
Completed : 确认阶段完成() [重复合法请求] / 复用既有结果，不重复计量
note bottom of Completed
  已完成表示各阶段业务确认完成，
  不表示所有贡献都已有完整计量依据。
  非法事件被拒绝，原任务及阶段结果不变。
end note
''','整体任务只在全部阶段完成后结束；规则或贡献依据缺失时保留待核对项，不把任务完成等同于津贴已核实。')

manifest=dict(classes=classes,sequences=seqs,states=states,catalog=catalog)
(D/'model-index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Created {len(classes)} class views, {len(seqs)} analysis sequences, {len(states)} state machines.')
