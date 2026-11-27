"""Build the current course model from a canonical use-case catalog and real PG schema."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CAT = []

# Describe the facts changed by each command, rather than sending user actions
# such as "read the draft" to an entity lifeline.
EFFECTS = {
 'AUTH-001':'会话令牌摘要与失效时刻', 'AUTH-002':'当前会话注销',
 'OL-001':'任务、审校岗位、教师路由与创建审计',
 'OL-002':'源稿版本及材料关联', 'OL-003':'当前源稿的内容审核事件',
 'OL-004':'承接安排及可选默认承接', 'OL-005':'排版版本及材料关联',
 'OL-006':'内部审校事件与教师待办', 'OL-007':'教师一审事件与二审待办',
 'OL-008':'教师二审事件', 'OL-009':'发布、归档、合格贡献与通知意图',
 'OL-010':'报名及本人材料关联', 'RV-001':'绑定版本与阶段的选区批注',
 'ED-001':'采编任务、稿件站点行及承接事实', 'PR-001':'摄制任务及预约资料',
 'ER-001':'目标部门任务及需求资料', 'DS-001':'设计任务及复杂度',
 'JOB-001':'部门承接安排及可选默认值', 'JOB-002':'唯一摄制承接安排',
 'JOB-003':'当前内容或最终交付版本', 'JOB-004':'指定老师的内容审核事件',
 'JOB-005':'验收、归档、合格贡献与通知意图',
 'JOB-006':'强制归档、关闭原因及审计', 'REC-001':'人工登记及关联工时来源',
 'REC-002':'工时核定值及调整前后审计', 'STAT-002':'封存批次及不可变行快照',
 'CFG-001':'教师路由、默认承接或轮转配置', 'CFG-002':'政策版本及规则修订',
 'NOTE-001':'任务报表备注及变更事件',
}

def uc(code, name, actor, group, pre, steps, post, alt, fields, module):
    CAT.append(dict(id='UC-'+code, name=name, actor=actor, group=group, pre=pre,
                    steps=steps.split('；'), post=post, alt=alt, fields=fields, module=module))

uc('AUTH-001','登录工作台','使用者','support','账号有效且启用',
   '提交账号和密码；验证凭据和账号状态；建立有效会话并返回身份；展示身份允许的业务入口',
   '网页或手机获得同一账号的权限范围','凭据错误拒绝；频繁失败限流；停用账号不得建立会话','账号、密码','auth.js')
uc('AUTH-002','退出工作台','使用者','support','存在登录会话',
   '提出退出请求；注销当前会话；清除终端会话；返回登录入口',
   '原会话不能再次访问受保护资源','会话失效时仍清理终端状态；网络失败不宣称服务端注销成功','当前会话','auth.js')
uc('TASK-001','查看任务与办理进度','使用者','support','已登录',
   '提出任务查询条件；确定可见范围；汇总版本审核归档和材料；返回任务详情和允许的操作',
   '获得权限范围内任务事实','越权任务拒绝；任务不存在返回未找到；外部只下载本人材料','业务类型、部门、任务编号','domain.js')
uc('OL-001','提出推文任务','推文发起人','publication','外部组织、运营管理人员或符合关联条件的办公采编人员',
   '提交标题类型期限和来源；校验角色与关联任务；创建任务并记录教师及审校安排；返回源稿或承接待办',
   '形成唯一编号的推文任务','外部来稿必须先采编内容审核；关联稿件必须已正常归档；不合法教师或审校安排拒绝','标题、排版类型、期限、两位教师、两位审校、关联任务、备注','domain.js')
uc('OL-002','提交或修订源稿','外部来稿人','publication','本人推文需要源稿且未归档',
   '提交完整稿件和本人材料；验证任务状态与材料归属；保存新源稿版本；送采编内容审核',
   '形成可追溯的源稿版本','非本人或非源稿阶段拒绝；退回后可修订；旧版本保留','正文、预览地址、附件','domain.js')
uc('OL-003','审阅外部源稿内容','采编部长','publication','存在待内容审核的当前源稿',
   '阅读源稿和材料；提交内容审核决定；校验当前版本和审核权限；记录决定并开放安排或退回源稿',
   '通过后可以进入运营安排','管理员可按权限办理；退回必须填写原因；版本过期拒绝','版本、通过或退回、原因','domain.js')
uc('OL-004','安排推文承接','运营部长','publication','源稿内容审核已通过或不需要源稿审核，未归档',
   '确定排版承接人；提交安排及可选默认承接设置；校验承接资格；记录安排并通知承接人',
   '任务具有排版承接人','管理员可办理；默认人优先于轮值；手工安排可覆盖尚未交付的安排','承接人、记为默认承接','domain.js')
uc('OL-005','提交排版版本','排版承接人','publication','本人已承接且任务允许新版本',
   '提交排版正文预览及材料；校验提交权限；保存完整新版本；送运营内部审校',
   '当前版本从内部审校重新开始','退回修改后两位老师审核也须重走；未清洗的预览不能作为批注坐标来源','正文、预览链接、预览HTML、附件','domain.js')
uc('OL-006','确认运营内部审校','指定运营审校部长','publication','当前版本待内审，属于两位指定审校之一',
   '检查排版版本和材料；提交审校结论；核实版本和指定身份；记录真实审核事件并送教师一审或退回',
   '任意一位指定部长通过即进入教师一审','管理员可依权限内审；退回必须有原因；另一部长没有点击不伪造审核事件','版本、结论、原因','domain.js')
uc('OL-007','完成教师一审','一审指导老师','publication','本人为本任务一审老师，内部审校通过',
   '阅读当前排版；提交一审意见；核实教师身份及阶段；记录一审并送二审或退回排版',
   '通过后待不同的二审老师处理','管理员不能冒充老师；退回必须有原因；旧版本拒绝','版本、结论、原因','domain.js')
uc('OL-008','完成教师二审','二审指导老师','publication','本人为本任务二审老师且与一审不同，一审通过',
   '阅读一审通过的版本；提交二审意见；核实教师身份及阶段；记录二审并开放发布或退回排版',
   '通过后可登记发布','两阶段不得同一老师；不计教师工时；旧版本拒绝','版本、结论、原因','domain.js')
uc('OL-009','登记推文发布','运营管理人员','publication','当前版本全部审核通过，未归档',
   '提交发布地址；校验当前版本与发布权限；确认发布归档和工时事实；返回归档任务及贡献明细',
   '发布、归档、排版与审校工时同时成功且仅计一次','并发重复发布不重复计时；事务失败整体回滚；老师外部和管理员不自动计酬','版本、公开发布地址','domain.js')
uc('OL-010','报名公开征集','外部组织','publication','推文开放报名，未到截止时间且未归档',
   '提交报名说明和本人材料；核实报名窗口；记录本组织报名；返回报名回执',
   '报名及材料可追溯','同一账号同一任务不得重复报名；不能提交他人附件','说明、附件','domain.js')
uc('RV-001','标注稿件意见','当前阶段审阅人','publication','有当前版本当前阶段的审阅权限',
   '选中工作台预览文本并填写意见；提交原文选区及意见；验证选区与当前版本正文精确相符；保存定位批注供修改者查看',
   '意见绑定版本、阶段、选区和作者','直接公众号原网页不修改；旧坐标或引文不一致拒绝；新版本不搬用旧坐标','版本、阶段、起止偏移、引文、意见','annotations.js')
uc('ED-001','建立采编办公稿件任务','采编人员','jobs','内部有创建资格，包含稿件站点清单',
   '提交稿件站点作者及可选内容老师；核验原创作者和对接范围；建立稿件逐行任务；开放办公承接或内容送审',
   '采编创作与办公对接使用同一稿件清单','管理员可创建；每行单独计量；非原创不产生创作工时；只有正常归档后可关联推文','每行标题、站点、原创标志、作者、内容老师','jobs.js')
uc('PR-001','提出摄制预约','摄制需求人','jobs','内部人员、外部组织或管理员有预约资格',
   '提交预约时间地点和联系人；核验预约与加急规则；建立摄影任务；开放承接或领取',
   '保留预约资料与加急判定','预约前不足48小时按规则计算创作者加急；当前没有区间资源冲突检查','预约时间、地点、联系人、需求、备注','jobs.js')
uc('ER-001','提出部门需求','需求方','jobs','外部组织或管理员；原创部长可提本部门需求',
   '提交目标部门及工作说明；核验创建范围及适用规则；建立部门需求；交目标部门安排',
   '六部门需求都有统一任务入口','原创无预设费率时走人工登记；不凭客户端自报身份放行','部门、规则、期限、说明、备注','jobs.js')
uc('DS-001','提出设计任务','设计需求人','jobs','内部人员、外部组织、教师或管理员有创建资格',
   '提交设计要求和复杂度；验证需求完整性；建立美编任务；交美编安排承接',
   '基本复杂大型设计进入同一交付流程','复杂设计审校费率未定不得臆造，需另行登记；教师作为需求方不计工时','复杂度、期限、需求、附件','jobs.js')
uc('JOB-001','安排部门任务','目标部门部长','jobs','普通任务未归档且可重新安排',
   '选择本部门有效承接人；提交安排和可选默认值；校验部门范围；记录安排并生成待办',
   '承接人明确且安排可审计','管理员可办理；默认承接可撤销；无默认时按任务先后轮转而非时段排班','任务、承接人、默认标志','jobs.js')
uc('JOB-002','领取摄制任务','摄制干事','jobs','未来预约尚无人承接，本人为有效摄制干事',
   '选择可领取任务；申请领取；核验任务仍未分配；记录唯一承接并返回结果',
   '只有一人成功领取','并发领取一人成功；部长不能作为普通干事抢单；已过预约时间拒绝','任务编号','jobs.js')
uc('JOB-003','提交部门交付物','任务承接人','jobs','本人承接且未归档，处于可提交阶段',
   '提交完整正文和附件；核验阶段与材料；保存内容或交付版本；生成相应老师或验收待办',
   '形成下一环节可核验的版本','采编指定老师时先内容再最终交付；退回后形成新版本；阶段不可跳过','正文、附件、阶段','jobs.js')
uc('JOB-004','审阅采编内容','指定内容老师','jobs','当前采编任务已配置本人为内容老师且有待审内容版本',
   '阅读内容版本；给出内容意见；校验老师身份与版本；记录决定并开放最终交付或退回',
   '内容通过后仍由承接人提交最终交付','内容审核和最终验收是不同事实；教师不计工时；过期版本拒绝','版本、结论、原因','jobs.js')
uc('JOB-005','验收并归档部门任务','目标部门部长','jobs','存在待验收交付物；采编办公由办公或采编管理人员办理',
   '检查交付物；提交验收结论；按业务规则确认贡献；正常归档并生成一次工时或退回修改',
   '验收通过归档且仅生成合格内部人员工时','管理员可办理但不自动计自己的审校费；并发与失败不得留下半笔归档','版本、结论、原因','jobs.js')
uc('JOB-006','强制关闭异常任务','目标部门部长','jobs','任务未归档且管理范围匹配',
   '说明异常关闭原因；确认强制关闭；记录强制归档事实；关闭待办且不自动生成工时',
   '任务可查，原因保留，零自动工时','管理员可办理；不把强制关闭当正常验收；空原因拒绝','任务、原因','jobs.js')
uc('REC-001','登记例外工作量','内部计酬成员','accounting','本人或管理权限内有效计酬成员',
   '提交人员周次和工作事实；选择适用规则或明确人工工时；核验权限与正数；保存登记任务和工时来源',
   '登记形成可追溯工时，不假装普通交付归档','部长可在范围内代录；教师外部拒绝；仅允许规定的关联补记','人员、周次1至53、规则或小时、说明、关联任务','jobs.js')
uc('REC-002','核定特殊工时','工时管理人员','accounting','工时属于可管理范围',
   '查阅规则值和现核定值；提交新核定值及原因；核验权限与有效数值；保留调整前后值操作者和时间',
   '实时统计采用新值，审计完整','空原因拒绝；封存报表保持原快照；不得给外部或教师造自动工时','工时记录、新工时、原因','reports.js')
uc('STAT-001','筛选并导出工时报表','内部成员','accounting','有工时查询权限',
   '提交范围时间与筛选条件；限制本人本部门或全中心范围；汇总规则工时核定工时备注和金额；展示并导出Excel或保存个人视图',
   '得到与屏幕同一权限范围的明细','部长可看部门，办公部长及管理员可看全中心；普通自动工时无周次字段时按日期筛选','日期、人员、状态、搜索、列顺序、视图配置','reports.js')
uc('STAT-002','封存结算报表','办公部长','accounting','有全中心报表权限且日期范围有效',
   '确定结算日期区间；核验当前工时清单；保存不可变行快照；按快照导出结算明细',
   '后续调整不改变既有封存行','管理员可办理；空快照或无效范围拒绝；不是原数据永久锁死','名称、起止日期','reports.js')
uc('CFG-001','配置教师与承接规则','部门管理人员','support','有对应部门的配置权限',
   '选择配置范围；提交教师路由默认承接或轮值队列；校验身份部门及互异约束；保存配置供后续任务采用',
   '配置影响后续自动安排；已有任务保留自身路由','撤销默认后恢复轮转；两位教师不同；机器人路由配置不表示消息已发','两位教师、审校人、群路由、提及值、队列、默认人','approval.js / rotation.js / flow-defaults.js')
uc('CFG-002','维护工时规则版本','管理员','accounting','有全局政策维护权限',
   '填写调整原因及规则值；校验可修改规则与数值；追加政策和规则修订版本；向新任务提供新版本',
   '旧任务及旧封存保留原规则依据','审校基础总额固定2小时；原创和复杂设计审校无预设值不擅补；不原地覆盖历史','费率、倍率、窗口、创作规则、原因','policy.js')
uc('VIEW-001','查看个人工作与工时','内部成员','support','已登录',
   '提出个人查询；确定当前账号；汇总本人待办和贡献；展示任务记录与个人工时',
   '个人工作可以追溯到任务','教师外部只看到适用的任务信息，不展示计酬工时；会话失效重新登录','个人状态与日期条件','domain.js / reports.js')
uc('MSG-001','查看任务通知','使用者','support','已登录且有本人通知',
   '查询本人消息；限制收件人身份；关联任务事件和路由记录；展示站内待办及发送状态',
   '用户能追溯任务通知','未配置群机器人与订阅消息时显示未配置；重试不重复产生同一事件收件人记录','消息、任务、事件、发送状态','notifications.js')
uc('NOTE-001','维护任务报表备注','任务相关人员','support','创建人承接人或部门管理人员具有修改资格',
   '填写业务备注；提交任务报表说明；校验身份并记录变更事件；在详情和Excel导出中展示备注',
   '备注能够说明工时差异背景','工时调整原因另有独立审计；归档后按权限可补备注，封存行保持不变','任务、报表备注','domain.js')

def write(name, content):
    p=ROOT/name
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(content.strip()+'\n',encoding='utf-8',newline='\n')

def diagram(name, body, title):
    style=''
    if 'business-sequence' in name or name.startswith('analysis/seq-') or name.startswith('system-sequence-'):
        style='''skinparam defaultFontSize 14
skinparam sequenceLifeLineBorderColor #9AA8B8
skinparam sequenceArrowColor #334155
skinparam sequenceGroupBorderColor #94A3B8
skinparam sequenceGroupBackgroundColor #F8FAFC
skinparam sequenceParticipantPadding 18
skinparam maxMessageSize 240
hide footbox
autonumber
'''
    if 'business-sequence' in name:
        style+='!include course-notation.iuml\nskinparam sequenceParticipantBorderColor transparent\nskinparam sequenceParticipantBackgroundColor transparent\n'
    write('diagrams/'+name+'.puml','@startuml\nskinparam defaultFontName Microsoft YaHei\nskinparam shadowing false\nskinparam backgroundColor #FFFFFF\nskinparam ArrowColor #466482\nskinparam classAttributeIconSize 0\nhide empty members\n'+style+'title '+title+'\n'+body+'\n@enduml')

def table(headers, rows):
    return '| '+' | '.join(headers)+' |\n| '+' | '.join('---' for _ in headers)+' |\n'+''.join('| '+' | '.join(str(x).replace('|','／').replace('\n',' ') for x in row)+' |\n' for row in rows)

def build_cases():
    write('requirements/use-cases.json',json.dumps(CAT,ensure_ascii=False,indent=2))
    text='# 系统用例规约\n\n版本：2.0；基线日期：2026-11-27。软件边界包含网页、小程序、统一后端及其自动处理。\n\n'
    text+='## 用例目录\n\n'+table(['编号','业务目标','主要执行者','实现模块'],[(u['id'],u['name'],u['actor'],u['module']) for u in CAT])
    for u in CAT:
        text+='\n## '+u['id']+'：'+u['name']+'\n\n'
        text+=table(['项目','规约'],[
            ('执行者',u['actor']+'；文中明确的管理替代者按服务端授权办理'),
            ('触发事件','执行者希望'+u['name']),
            ('前置条件',u['pre']),('后置条件',u['post']),
            ('涉众利益','执行者获得明确回执；中心保留责任和业务证据；计酬成员的贡献可核验'),
            ('字段列表',u['fields'])])
        text+='\n**基本路径**\n\n'+''.join(str(i+1)+'. '+s+'。\n' for i,s in enumerate(u['steps']))
        text+='\n**扩展路径**：'+u['alt']+'。\n'
        text+='\n**分析实现**：[责任序列图](../diagrams/analysis/seq-'+u['id'].lower()+'.svg)。控制责任由 '+u['module']+' 承担，图中对象是分析抽象，不表示源码使用同名面向对象类。\n'
    text+='''
## 公共补充约束

所有授权以服务端会话为准。敏感写操作校验角色、部门、当前版本和阶段。失败不得形成部分归档。附件限制为单文件12 MiB且验证任务归属；外部用户只能取自己的附件。自动工时只面向有效内部计酬成员。

新版本保留历史审核和批注，重新进入适用审核链。备注与工时调整原因是不同字段；前者说明任务，后者逐次解释核定变动。封存保存当时结果。

## 路径评审规则

基本路径按业务意图描述，不以按钮或SQL作为用户目标。替代路径明确失败、退回及恢复位置；不同频率的业务通过独立任务及关联字段连接。自动归档与计时是完成行为的后置条件，不另画“系统”参与者。
'''
    write('requirements/system-use-case-specifications.md',text)
    for group,label in [('publication','推文审校与发布'),('jobs','部门协作与交付'),('accounting','工时统计与结算'),('support','公共访问与配置')]:
        subset=[u for u in CAT if u['group']==group]
        actors=list(dict.fromkeys(u['actor'] for u in subset))
        body='left to right direction\n'
        body+='\n'.join('actor "'+a+'" as a'+str(i) for i,a in enumerate(actors))
        body+='\nrectangle "青年传媒中心统一工作台" {\n'
        body+='\n'.join('usecase "'+u['id']+r'\n'+u['name']+'" as u'+str(i) for i,u in enumerate(subset))
        body+='\n}\n'+'\n'.join('a'+str(actors.index(u['actor']))+' -- u'+str(i) for i,u in enumerate(subset))
        diagram('system-use-case-'+group,body,label)
    diagram('system-use-case-overview',r'''
left to right direction
actor "中心内部成员" as internal
actor "部门管理人员" as manager
actor "指导老师" as teacher
actor "外部组织" as external
rectangle "统一工作台（分区详图见四张系统用例图）" {
rectangle "推文审校与发布" as p
rectangle "部门协作与交付" as j
rectangle "工时统计与结算" as a
rectangle "公共访问与配置" as s
}
internal -- p
internal -- j
internal -- a
manager -- s
teacher -- p
teacher -- j
external -- p
external -- j
note bottom of s
此图是功能分区导航，不新增用例编号。
系统与数据库均在软件边界内，不是参与者。
end note
''','系统功能与参与者导航')
    write('diagrams/system-use-case-notes.md','''
# B 系统用例与参与者

![系统功能导航](system-use-case-overview.svg)

软件边界包括网页、小程序和统一后端。使用者是访问软件的人；中心工作人员在业务组织内部，但在软件边界外，因此属于系统参与者。账号角色与业务岗位不是一一对应：不同任务可指定不同审校人。管理员替代办理范围以规约为准，不能代替指定老师。

一个用例可以关联多个参与者，这是合法UML。本稿按主要责任分区并在规约说明协同及授权替代，减少交叉线；不为减少线条伪造角色继承或删掉真实业务责任。四个详图的编号与规约完全一致。

![推文系统用例](system-use-case-publication.svg)

![部门协作系统用例](system-use-case-jobs.svg)

![工时系统用例](system-use-case-accounting.svg)

![公共系统用例](system-use-case-support.svg)
''')

def build_analysis():
    # Domain responsibilities are separate from HTTP orchestration and SQL storage.
    # Collection aggregates can receive creation requests before an individual task exists.
    details = {
      'AUTH-001':('账号与会话',['验证密码与启用状态','建立有时限的可信会话']),
      'AUTH-002':('账号与会话',['使当前会话失效']),
      'TASK-001':('任务工作簿',['限制可见任务范围','汇集版本审核与归档事实']),
      'OL-001':('推文协作簿',['验证来源与关联稿件','建立任务及审核岗位路由']),
      'OL-002':('推文协作簿',['验证本人材料归属','追加源稿版本并保留历史']),
      'OL-003':('推文协作簿',['验证当前源稿与采编资格','记录内容审核及后续状态']),
      'OL-004':('推文协作簿',['核验承接人资格','保存安排及可选默认值']),
      'OL-005':('推文协作簿',['验证本人承接与材料','追加排版版本并重启审核链']),
      'OL-006':('推文协作簿',['核验两位指定岗位之一','仅记录实际审校人的结论']),
      'OL-007':('推文协作簿',['核验指定一审老师与版本','记录一审结论及后续状态']),
      'OL-008':('推文协作簿',['核验不同的二审老师与版本','记录二审结论及后续状态']),
      'OL-009':('推文协作簿',['验证全部审核通过','形成发布与正常归档事实']),
      'OL-010':('推文协作簿',['核验窗口与本人材料','拒绝重复并保存报名']),
      'RV-001':('推文协作簿',['核验当前阶段审阅资格','比对UTF16选区并绑定版本']),
      'ED-001':('部门任务簿',['核验稿件行与原创作者','建立逐行任务并选择承接']),
      'PR-001':('部门任务簿',['按预约窗口判定加急','建立预约并开放承接']),
      'ER-001':('部门任务簿',['核验目标部门与规则','建立部门需求及来源']),
      'DS-001':('部门任务簿',['核验设计复杂度与规则','建立设计任务']),
      'JOB-001':('部门任务簿',['校验本部门承接资格','保存安排及可选默认值']),
      'JOB-002':('部门任务簿',['检查未来预约尚未承接','确定唯一当前承接人']),
      'JOB-003':('部门任务簿',['检查内容与交付阶段','保存版本并产生下一环节待办']),
      'JOB-004':('部门任务簿',['核验指定内容老师与版本','记录内容结论及后续状态']),
      'JOB-005':('部门任务簿',['核验验收资格和交付版本','形成正常验收与归档事实']),
      'JOB-006':('部门任务簿',['验证管理范围与非空原因','保留强制关闭且不计自动工时']),
      'REC-001':('工时台账',['核验计酬资格与人工规则','登记带来源的例外贡献']),
      'REC-002':('工时台账',['核验管理范围与核定原因','追加调整审计并更新实时值']),
      'STAT-001':('工时台账',['限制人员日期与列配置','按当前有效值形成报表']),
      'STAT-002':('工时台账',['验证全中心结算范围','复制不可变封存行']),
      'CFG-001':('承接与政策配置',['核验配置部门与教师互异','保存后续任务默认配置']),
      'CFG-002':('承接与政策配置',['核验可调规则与原因','追加政策版本并保留旧值']),
      'VIEW-001':('任务工作簿',['限定本人任务与计酬范围','汇总个人工作和贡献']),
      'MSG-001':('通知收件箱',['限定当前收件人','返回真实渠道状态与任务入口']),
      'NOTE-001':('任务工作簿',['核验任务相关身份','更新备注并保留变更事件']),
    }
    aggregate_ops={}
    controls={}
    for u in CAT:
        key=u['id'].removeprefix('UC-')
        aggregate,operations=details[key]
        aggregate_ops.setdefault(aggregate,['核验当前条件'])
        aggregate_ops[aggregate]+= [u['name']]+operations
        control = ('身份控制' if key.startswith('AUTH-') else
                   {'publication':'推文控制','jobs':'部门协作控制','accounting':'结算控制','support':'公共访问控制'}[u['group']])
        controls.setdefault(control,set()).update([aggregate,'账号与会话'])
        body='actor "'+u['actor']+'" as actor\nboundary "业务页面" as page\ncontrol "'+control+'" as ctl\n'
        if aggregate!='账号与会话': body+='entity "账号与会话" as identity\n'
        body+='entity "'+aggregate+'" as model\n'
        complete=key in ['OL-009','JOB-005']
        if complete: body+='entity "工时台账" as ledger\n'
        body+='actor -> page : '+u['name']+r'\n'+u['fields']+'\nactivate page\npage -> ctl : 协调业务请求('+u['id']+')\nactivate ctl\n'
        if aggregate!='账号与会话':
            body+='ctl -> identity : 验证访问资格(会话、业务职责)\nactivate identity\nidentity --> ctl : 可信身份与可用范围\ndeactivate identity\n'
        body+='ctl -> model : 核验当前条件(输入、身份)\nactivate model\n'
        for operation in operations[:-1]: body+='model -> model : '+operation+'()\n'
        body+='model --> ctl : 可办理结果／失败原因\ndeactivate model\n'
        body+='alt 业务条件满足\nctl -> model : '+u['name']+'()\nactivate model\n'
        if complete: body+='group 完成、归档与贡献整体生效\n'
        for operation in operations[-1:]: body+='model -> model : '+operation+'()\n'
        if complete:
            body+='model -> ledger : 登记合格贡献(内部资格、规则版本、来源键)\nactivate ledger\nledger --> model : 唯一贡献结果\ndeactivate ledger\nend\n'
        body+='model --> ctl : 业务结果与后续操作\ndeactivate model\nctl --> page : 成功回执\npage --> actor : 展示结果\n'
        body+='else 业务条件不满足\nctl --> page : 失败原因与可恢复条件\npage --> actor : 保留输入并显示原因\nend\ndeactivate ctl\ndeactivate page\n'
        import textwrap
        body+='legend bottom left\n前置条件：\n'+'\n'.join(textwrap.wrap(u['pre'],38))+'\n'
        if key in EFFECTS:
            body+='成功事实：\n'+'\n'.join(textwrap.wrap(EFFECTS[key],38))+'\n'
        if complete: body+='完成、归档、合格贡献一起生效；重复不再计时。\n'
        if key in ['OL-003','OL-006','OL-007','OL-008','JOB-004']:
            body+='审核退回须留原因；仅通过才开放下一环节。\n'
        body+='endlegend\n'
        diagram('analysis/seq-'+u['id'].lower(),body,u['id']+' '+u['name']+' · 分析序列')
    aggregate_ops['账号与会话']+=['验证访问资格']
    aggregate_ops['工时台账']+=['登记合格贡献']
    diagram('analysis/class-domain',r'''
class "账号" as User <<entity>> {
账号编号
角色
部门
计酬资格
核验活动身份()
}
class "任务" as Task <<entity>> {
任务编号
业务类型
期限
报表备注
推导当前办理状态()
核验安排和归档()
}
class "承接安排" as Assignment <<entity>> {
承接人
安排人
自动安排标记
}
class "稿件版本" as Version <<entity>> {
版本号
阶段
正文与清洗预览
保留历史版本()
}
class "审核事件" as Review <<entity>> {
阶段
结论
原因
实际审核人
}
class "选区批注" as Annotation <<entity>> {
起止偏移
引文
意见
校验精确选区()
}
class "归档事实" as Archive <<entity>> {
完成版本
强制原因
}
class "工时贡献" as Worklog <<entity>> {
规则值
核定值
倍率
费率
来源键
}
class "核定审计" as Adjustment <<entity>> {
原值
新值
原因与操作者
}
class "封存行" as SealRow <<entity>> {
来源工时编号
不可变JSON快照
}
User "1" -- "0..*" Task : 发起
Task "1" -- "0..1" Assignment
Task "1" -- "0..*" Version
Version "1" -- "0..*" Review
Version "1" -- "0..*" Annotation
User "1" -- "0..*" Review : 实际审核
Task "1" -- "0..1" Archive
Task "1" -- "0..*" Worklog
Worklog "1" -- "0..*" Adjustment
Worklog "1" -- "0..*" SealRow
note bottom of Review
两位运营审校岗位安排与实际审核事件分离。
任一确认可送教师，不能伪造另一人的点击。
end note
''','C 领域分析类及职责')
    body='top to bottom direction\nclass "业务页面" as UI <<boundary>> {\n收集完整业务信息()\n展示处理回执()\n}\n'
    for i,(control,aggregates) in enumerate(controls.items()):
        body+='class "'+control+'" as C'+str(i)+' <<control>> {\n协调业务请求()\n传递可信身份与领域结果()\n}\nUI --> C'+str(i)+'\n'
    aliases={name:'E'+str(i) for i,name in enumerate(aggregate_ops)}
    for aggregate,operations in aggregate_ops.items():
        body+='class "'+aggregate+'" as '+aliases[aggregate]+' <<entity>> {\n'
        body+='\n'.join(op+'()' for op in dict.fromkeys(operations))+'\n}\n'
    for i,aggregates in enumerate(controls.values()):
        for name in sorted(aggregates): body+='C'+str(i)+' --> '+aliases[name]+'\n'
    body+=aliases['推文协作簿']+' --> '+aliases['工时台账']+' : 完成贡献\n'
    body+=aliases['部门任务簿']+' --> '+aliases['工时台账']+' : 完成贡献\n'
    body+='note bottom of '+aliases['任务工作簿']+'\n分析聚合持有业务事实并保护本身规则。\n集合实体受理创建；单个任务在受理后建立。\n控制协调路径，关系库与HTTP适配留在D章。\nend note\n'
    diagram('analysis/class-responsibilities',body,'C 边界控制实体职责分配')
    diagram('analysis/state-publication',r'''
[*] --> Source : 外部来稿
[*] --> Arrange : 内部任务
state "等待源稿" as Source
state "采编内容审核" as Editorial
state "等待安排" as Arrange
state "等待排版版本" as Layout
state "运营内审" as Internal
state "教师一审" as Teacher1
state "教师二审" as Teacher2
state "待登记发布" as Publish
state "退回修改" as Returned
state "正常归档" as Archived
state "强制关闭" as Forced
Source --> Editorial : 提交源稿
Editorial --> Source : 退回及原因
Editorial --> Arrange : 通过
Arrange --> Layout : 安排承接
Layout --> Internal : 提交版本
Internal --> Teacher1 : 指定部长任一通过
Teacher1 --> Teacher2 : 一审老师通过
Teacher2 --> Publish : 不同二审老师通过
Internal --> Returned : 退回
Teacher1 --> Returned : 退回
Teacher2 --> Returned : 退回
Returned --> Internal : 提交新排版版本
Publish --> Archived : 登记发布／原子归档计时
Arrange --> Forced : 有原因的强制关闭
Layout --> Forced : 有原因的强制关闭
Returned --> Forced : 有原因的强制关闭
Archived --> [*]
Forced --> [*]
note bottom of Forced
任何未归档阶段均可由有权限管理者强制关闭；
为保持图面清楚，其余到此转换省略。零自动工时。
end note
''','C 推文任务状态机')
    diagram('analysis/state-jobs',r'''
[*] --> Waiting
state "等待承接" as Waiting
state "等待交付" as Delivery
state "内容待老师审核" as Content
state "等待最终交付" as Final
state "等待验收" as Acceptance
state "正常归档" as Archived
state "强制关闭" as Forced
Waiting --> Delivery : 手动／默认／轮转安排或摄影领取
Delivery --> Content : 指定内容老师的采编稿件提交内容
Content --> Delivery : 内容退回
Content --> Final : 内容通过
Final --> Acceptance : 承接人提交最终交付
Delivery --> Acceptance : 不需要内容审核的任务提交交付
Acceptance --> Delivery : 验收退回
Acceptance --> Archived : 验收通过／归档计时同事务
Waiting --> Forced : 管理者说明原因
Delivery --> Forced : 管理者说明原因
Archived --> [*]
Forced --> [*]
note bottom of Forced
任意未归档阶段可强制关闭，不自动计时。
工作登记直接产生登记与工时，不使用本状态机。
end note
''','C 部门任务状态机')
    diagram('analysis/state-accounting',r'''
state "工时及结算的并行生命周期" as Accounting {
[*] --> Live
state "实时工时" as Live
state "调整后的实时工时" as Adjusted
Live --> Adjusted : 有权限核定／记录原值新值原因
Adjusted --> Adjusted : 再次核定／追加审计
--
[*] --> Unsealed
state "尚未生成本批次快照" as Unsealed
state "封存行快照" as Snapshot
Unsealed --> Snapshot : 办公部长或管理员封存／复制当时实时行
Snapshot --> Snapshot : 导出原快照
}
note bottom of Accounting
实时工时后续可调整，封存行保持当时值。
封存是复制快照，不是冻结整个业务库。
end note
''','C 工时核定与封存生命周期')
    text='''
# C 分析模型

## 分析边界与职责

边界对象接收完整业务信息，控制对象协调请求路径，账号实体验证访问资格，各业务聚合核验自身条件并承载事实与规则。消息名描述接收者执行的动作；返回箭头传递结果。分析类不是对数据库表或实际JavaScript类的机械复制。

![分析职责](../diagrams/analysis/class-responsibilities.svg)

![领域分析类](../diagrams/analysis/class-domain.svg)

## 状态与事件

任务状态由承接、当前版本、审核和归档事实推导，实际tasks表没有status列。推文源稿与排版是不同phase；新排版版本重走内部、一审、二审。内容老师和最终验收各有独立事件。

![推文状态机](../diagrams/analysis/state-publication.svg)

![部门任务状态机](../diagrams/analysis/state-jobs.svg)

![工时生命周期](../diagrams/analysis/state-accounting.svg)

## 用例实现序列

下列是白盒分析序列，不是黑盒系统序列。每个系统用例均有独立实现视图，使用boundary（边界）、control（控制）、entity（实体）的图形符号；激活条表示执行，实线为调用，虚线为返回，alt区分成功和条件失败。推文协作簿、部门任务簿、工时台账等是领域聚合，不是数据库表；创建请求先交集合实体受理。序列中的具体动作与职责类图对应，控制不通过读取属性替代实体核验规则。条件失败不改变既有事实；发布和验收整体生效，D章再说明SQL事务与HTTP持久化方式。
'''
    for u in CAT:
        text+='\n### '+u['id']+' '+u['name']+'\n\n![用例实现](../diagrams/analysis/seq-'+u['id'].lower()+'.svg)\n'
    write('analysis/05-analysis-models.md',text)
    write('diagrams/analysis/model-index.json',json.dumps({'useCases':[u['id'] for u in CAT],'classes':['class-domain','class-responsibilities'],'states':['state-publication','state-jobs','state-accounting']},ensure_ascii=False,indent=2))

def build_database():
    schema=json.loads((ROOT/'database/runtime-schema.json').read_text(encoding='utf-8'))
    tables=schema['tables']
    labels=dict(zip(
      'departments users sessions tasks task_reviewers assignments files versions version_files reviews registrations registration_files publications archives worklogs adjustments saved_views report_seals seal_rows events outbox workflow_policy labor_rules rule_revisions jobs bookings article_lines work_entries duty_slots reminders publication_routing publication_defaults teacher_delivery version_annotations flow_defaults duty_rotation duty_rotation_members file_payloads'.split(),
      '部门 账号 会话 任务 审校岗位安排 承接安排 附件元数据 稿件版本 版本附件 审核事件 公开报名 报名附件 发布事实 归档事实 工时贡献 核定审计 个人报表视图 封存批次 封存行快照 任务审计 通知发件箱 政策版本 工时规则 规则修订 部门任务扩展 预约资料 稿件站点行 人工登记 历史时段表 提醒去重 推文教师路由 推文默认配置 教师通知路由 选区批注 默认承接 轮转指针 轮转成员 附件兼容载荷'.split()))
    groups={
      'organization':('组织身份',['departments','users','sessions']),
      'publication':('推文闭环',['tasks','task_reviewers','assignments','versions','reviews','publications','archives','publication_routing']),
      'materials':('材料与批注',['tasks','versions','files','version_files','version_annotations','registrations','registration_files','file_payloads']),
      'jobs':('六部门任务',['tasks','jobs','bookings','article_lines','work_entries','departments']),
      'accounting':('工时与结算',['tasks','worklogs','adjustments','saved_views','report_seals','seal_rows','users']),
      'policy':('政策与默认值',['workflow_policy','labor_rules','rule_revisions','publication_defaults','teacher_delivery','flow_defaults','users']),
      'rotation':('轮转与通知',['tasks','assignments','duty_rotation','duty_rotation_members','duty_slots','reminders','outbox','events','users'])}
    text='# 当前PostgreSQL数据字典\n\n版本2.0；从应用迁移001–005构建隔离空库后读取pg_catalog。无业务数据、账号密码或连接串。38张业务表、214字段、79外键；不含迁移记录和云适配辅助表。\n\n'
    text+=table(['表','职责','字段数'],[(t['name'],labels[t['name']],len(t['columns'])) for t in tables])
    relations=[]
    for t in tables:
        text+='\n## '+t['name']+' — '+labels[t['name']]+'\n\n'
        text+=table(['字段','PostgreSQL类型','非空','默认表达式'],[(c['name'],c['type'],'是' if c['not_null'] else '否',c['default_value'] or '—') for c in t['columns']])
        text+='\n'+table(['约束名','类型','定义'],[(c['name'],{'p':'主键','f':'外键','u':'唯一','c':'检查'}.get(c['type'],c['type']),c['definition']) for c in t['constraints']])
        text+='\n'+table(['索引','定义'],[(c['name'],c['definition']) for c in t['indexes']])
        relations.extend((t['name'],c['target'],c['definition']) for c in t['constraints'] if c['type']=='f')
    write('database/data-dictionary.md',text)
    write('database/foreign-key-relations.md','# 当前外键关系\n\n以下79项来自实际迁移后的pg_constraint。复合外键保持列顺序，不能拆成无约束的普通关联。\n\n'+table(['来源表','目标表','完整约束'],relations))
    byname={t['name']:t for t in tables}
    from build_full_erd import build_full_erd
    build_full_erd(tables, labels, write, table)
    for slug,(label,names) in groups.items():
        body='left to right direction\n'
        for name in names:
            t=byname[name]
            body+='entity "'+labels[name]+r'\n'+name+'" as '+name+' {\n'
            pk=' '.join(c['definition'] for c in t['constraints'] if c['type']=='p')
            fk=' '.join(c['definition'].split('REFERENCES')[0] for c in t['constraints'] if c['type']=='f')
            for c in t['columns']:
                key=('PK ' if re.search(r'\b'+c['name']+r'\b',pk) else '')+('FK ' if re.search(r'\b'+c['name']+r'\b',fk) else '')
                body+=('  * ' if c['not_null'] else '  ')+c['name']+' : '+c['type']+(' <<'+key.strip()+'>>' if key else '')+'\n'
            body+='}\n'
        for source,target,definition in relations:
            if source in names and target in names:
                cols=definition.split('REFERENCES')[0].replace('FOREIGN KEY','').strip()
                body+=source+' --> '+target+' : '+cols+'\n'
        body+='legend bottom\n箭头为外键依赖（指向被引用表），不是流程。\n* 非空；PK主键；FK外键。完整唯一与检查约束见数据字典。\n跨分区外键未全部显示，完整外键表列出所有79项。\nendlegend\n'
        diagram('database/db-'+slug,body,'D 数据层：'+label)
    overview='left to right direction\n'
    for i,(slug,(label,names)) in enumerate(groups.items()):
        overview+='package "'+label+'" as g'+str(i)+' {\n'+'\n'.join('rectangle "'+n+'" as t_'+n for n in names if n not in [x for _,(_,ns) in list(groups.items())[:i] for x in ns])+'\n}\n'
    overview+='t_tasks --> t_users : 发起人\nt_tasks --> t_workflow_policy : 规则版本\nt_versions --> t_tasks\nt_reviews --> t_versions\nt_archives --> t_tasks\nt_worklogs --> t_tasks\nt_adjustments --> t_worklogs\nt_seal_rows --> t_worklogs\nt_files --> t_tasks\nt_outbox --> t_tasks\n'
    overview+='legend bottom\n38张业务表完整分区清单；这里只保留主干关系。\n字段与79项外键见分区ER图及数据字典。\nendlegend'
    diagram('database/db-overview',overview,'D 当前关系数据库分区总览')
    write('diagrams/database/model-index.json',json.dumps({'tables':len(tables),'columns':214,'foreignKeys':len(relations),'groups':groups},ensure_ascii=False,indent=2))
    text='''
# D 设计模型

## D.1 数据层的精化

当前生产权威数据为CloudBase PostgreSQL环境tccc-qncmzx-d0gxalbv77f0dae9f，业务schema为youth_workbench。云托管通过HTTPS/PostgREST与受控RPC访问，不依赖微型规格未开放的PG TCP连接。本地空库重放相同001–005迁移，用于提取结构与测试，不承载云端权威数据。

业务层实际有38张表、214字段、79外键。结构化关系、复合唯一键、外键和检查约束负责底层一致性；岗位资格、当前审核阶段与计时规则由服务端协调验证。用例与表是多对多关系，不能把每个业务用例直接变成一张表。

### 完整物理关系大图

下图在同一画布列出38张实际业务表、214字段及79项外键。每表只出现一次，按业务领域着色，跨区域外键和复合外键均保留。F编号对应字段与关系线，精确定义见[大图外键索引](../database/full-erd.md)。

[打开SVG原图](../diagrams/database/db-full.svg) · [单页矢量PDF](../diagrams/database/db-full.pdf) · [PNG](../diagrams/database/db-full.png) · [PlantUML源](../diagrams/database/db-full.puml)

![完整数据库关系大图](../diagrams/database/db-full.svg)

### 分区导航

下面仅保留主干关系作导航；完整物理关系以大图为准，后续分区图便于局部阅读。

![关系库分区导航](../diagrams/database/db-overview.svg)

### 规范化与必要快照

部门、用户、任务、版本、审核、工时分别保存独立事实，避免名称和角色在每项任务中重复作为权威值。task_reviewers保存岗位安排，reviews保存实际审核；article_lines按稿件站点逐行计量。关联表使用复合键，版本和任务用复合外键防止跨任务误引用。

saved_views.config、outbox.payload与seal_rows.data使用JSONB表示用户视图、通知信封与不可变历史快照，是有明确生命周期的文档值，不代替核心实体关系。worklogs保留当时规则、倍率、费率与来源，属于有意保留的结算依据，不随政策变更回写。

### 字段与关系索引

[完整字段字典](../database/data-dictionary.md)逐表列出类型、非空、默认值、PK/FK/UNIQUE/CHECK和索引；[完整外键关系](../database/foreign-key-relations.md)保留复合列顺序；机器可读结构见[迁移提取结果](../database/runtime-schema.json)。

'''
    for slug,(label,names) in groups.items():
        text+='### '+label+'\n\n![分区关系图](../diagrams/database/db-'+slug+'.svg)\n\n'
    text+='''
### 技术表与兼容边界

本地schema_migrations记录迁移执行，不算业务表。云端另外有_state、_requests、_uploads三个支持表，分别管理修订号、幂等请求和对象上传准备/回收；它们不是旧文档型数据库。

duty_slots仍留在迁移结构中，仅为兼容历史；当前代码不以时间段排班，实际使用duty_rotation和duty_rotation_members按先后任务轮转。file_payloads是测试及兼容载荷；云端正式附件在私有对象存储workbench-private，files只保存元数据与完整性哈希。

## D.2 业务层的精化

表示层只提交业务命令。app.js负责HTTP路由、会话、来源校验和输入错误映射；domain.js负责推文，jobs.js负责部门任务，reports.js负责工时与报表，annotations.js负责选区批注。配置、默认承接、轮转与通知各有独立模块。

发布与正常验收把完成事实、archives、worklogs、events及通知意图放在同一事务。唯一约束阻止重复贡献；失败整体回滚。强制关闭写原因且不生成自动工时。小时使用万分之一小时整数，金额使用分；创作者加急倍率与审校分摊分开计算，教师、外部和不符合计酬资格者排除。

云端cloud-db.js先用wb_snapshot读取一致快照，在一次性PGlite工作区运行现有SQL规则，产生变更集，再通过单次wb_command事务以修订号CAS、请求ID和摘要提交。工作区是可丢弃的请求计算材料，权威事实在云端。冲突返回明确失败，调用方刷新后再办，不以本地文件充当生产数据库。

服务端密钥保留在云托管；客户端不得直写业务表或自报角色。云schema对匿名及普通客户端角色撤销直接权限，核心业务只能走经认证的后端。小程序薄网关只允许固定上游和路径，不是第二业务后端。

## D.3 表示层的精化

网页提供登录前介绍、角色首页、按业务分区的任务、详情与版本、精细选区批注、报表列配置与封存、政策与默认承接配置。手机保留蓝色卡片和首页／协作广场／我的三底栏，提供轻量创建、领取、交付、审核、消息、个人记录和工时。

两端请求同一/api/v1契约；Web使用安全会话Cookie，小程序使用Bearer会话经网关转发。所有可见按钮只是提示，服务端再次授权；失败保留输入并解释权限、过期版本或状态冲突。复杂Excel和封存以Web为主，不在手机再造第二套逻辑。

附件上传先完成私有对象准备，再提交元数据，下载必须验权并检查长度与SHA256。批注只标工作台清洗后的预览或正文，不能声称直接在公众号线上页面修改。

## D.4 部署和运行边界

网页/API在CloudBase云托管运行，PG和私有对象存储均在云端，本机关闭不影响正常功能。站内消息已实现；群机器人、订阅消息和微信正式版发布尚未完成，不把outbox记录当成已送达群消息。旧接入环境的薄网关需在2026-12-11试用到期前续期或迁移，详见现有部署文档。
'''
    write('design/01-database-design.md',text)

if __name__=='__main__':
    build_cases()
    build_analysis()
    build_database()
    print('Generated',len(CAT),'use cases and analysis sequences; database 38 tables / 79 FKs.')
