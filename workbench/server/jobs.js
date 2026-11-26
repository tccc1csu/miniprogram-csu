import {z} from 'zod';
import {canManage} from './auth.js';
import {id, requireThat, event, notify, loadTask, attachFiles} from './domain.js';
import {policy,rulesFor,addContribution,activePerson,hoursValue} from './policy.js';
import {defaultAssignee,saveFlowDefault,automaticallyAssign} from './flow-defaults.js';

import {takeRotationTurn} from './rotation.js';

const text=z.string().trim();
const key=text.min(1).max(180);
const date=z.iso.datetime({offset:true});
const departments=['office','editorial','operations','photography','art','original'];
const designRules={basic:[9,12],complex:[10,null],large:[11,13]};
export const sites=['院网','升华网','学工网'];
const form=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('web_article'),lines:z.array(z.object({title:key,site:key.optional(),original:z.boolean(),authorId:key.optional()})).min(1).max(50),
  reviewerIds:z.array(key).min(1).max(20),teacherId:key.optional()}),
 z.object({kind:z.literal('photo'),deadline:date,location:key,contact:key,urgentReason:text.max(1000).default('')}),
 z.object({kind:z.literal('request'),departmentId:z.enum(departments),ruleId:z.number().int().optional()}),
 z.object({kind:z.literal('design'),complexity:z.enum(['basic','complex','large'])}),
 z.object({kind:z.literal('work_entry'),week:z.number().int().min(1).max(53),personId:key,linkedTaskId:key.optional(),ruleId:z.number().int().optional(),hours:hoursValue.optional()})
]);
const common=z.object({title:text.min(2).max(180),deadline:date.optional(),notes:text.max(10000).default(''),reminderHours:z.number().min(0).max(720).optional()});
const delivery=z.object({body:text.max(100000).default(''),fileIds:z.array(key).max(30).default([])});
const decisionSchema=z.object({versionId:key,decision:z.enum(['approve','reject']),reason:text.max(5000).default('')});

export const jobLabels={awaiting_assignment:'待派发',awaiting_submission:'待交付',content:'老师内容审校',acceptance:'待验收',returned:'已退回',archived:'已归档'};
export function jobState(task){
 if(task.archive_id)return 'archived';
 if(!task.assignee_id)return 'awaiting_assignment';
 if(!task.version)return 'awaiting_submission';
 if(task.reviews.some(review=>review.decision==='reject'))return 'returned';
 if(task.version.phase==='content'){
  return task.reviews.some(review=>review.stage==='content'&&review.decision==='approve')?'awaiting_submission':'content';
 }
 return 'acceptance';
}

export async function activeIds(tx,department,role='minister'){
 return (await tx.query('SELECT id FROM users WHERE role=$1 AND department_id=$2 AND active ORDER BY id',[role,department])).rows.map(row=>row.id);
}
export function mayAccept(u,t){
 return canManage(u,t.department_id)||(t.kind==='web_article'&&canManage(u,'editorial'));
}
export async function currentRecipients(tx,t){
 if(t.state==='source_pending'||t.state==='source_returned')return [t.creator_id];
 if(t.state==='editorial')return activeIds(tx,'editorial');
 if(t.state==='awaiting_assignment')return activeIds(tx,t.department_id);
 if(['awaiting_submission','returned','awaiting_publish'].includes(t.state))return [t.assignee_id];
 if(t.state==='content')return [t.teacher_id];
 if(t.state==='acceptance'){
  const ministers=await activeIds(tx,t.department_id);
  if(t.kind==='web_article')ministers.push(...await activeIds(tx,'editorial'));
  return ministers;
 }
 if(t.state==='internal')return t.reviewers.map(r=>r.id);
 if(['teacher1','teacher2'].includes(t.state))return [t[t.state+'_id']];
 return [];
}

async function chooseRule(tx,version,ruleId,department,{creatorOnly=false}={}){
 if(!ruleId)return null;
 const match=(await rulesFor(tx,version)).find(rule=>rule.id===ruleId&&rule.department_id===department&&(!creatorOnly||!rule.review));
 requireThat(match,422,'请选择本部门适用的工时规则');
 return match;
}

export async function createJob(db,u,input,{now=new Date()}={}){
 const base=common.parse(input),data=form.parse(input);
 const internal=['member','minister','admin'].includes(u.role);
 return db.transaction(async tx=>{
  const settings=await policy(tx),taskId=id();
  const deadline=base.deadline||null;
  requireThat(!deadline||new Date(deadline)>now,422,'截止或预约时间须晚于现在');
  let department, person, rule, lines=[], reviewers=[];
  switch(data.kind){
   case 'web_article':
    requireThat(u.role==='admin'||(internal&&u.department_id==='editorial'),403,'请由采编部或管理员发起');
    department='office';
    for(const line of data.lines){
     if(line.original)await activePerson(tx,line.authorId||u.id,'editorial');
     for(const site of line.site?[line.site]:sites)lines.push({...line,site,authorId:line.original?(line.authorId||u.id):null});
    }
    requireThat(new Set(lines.map(l=>JSON.stringify([l.title,l.site]))).size===lines.length,422,'同一稿名和网站只能登记一次');
    for(const reviewer of new Set(data.reviewerIds)){
     const selected=(await tx.query("SELECT * FROM users WHERE id=$1 AND active AND (role='teacher' OR (payable AND department_id='editorial' AND role='minister'))",[reviewer])).rows[0];
     requireThat(selected,422,'请选择采编部长或指导老师');
     reviewers.push(reviewer);
    }
    if(data.teacherId)requireThat((await tx.query("SELECT id FROM users WHERE id=$1 AND role='teacher' AND active",[data.teacherId])).rows.length,422,'请选择有效指导老师');
    break;
   case 'photo':
    requireThat(internal||u.role==='external',403,'此身份不能预约');
    department='photography';
    break;
   case 'request':
    requireThat(['external','admin'].includes(u.role)||canManage(u,'original')&&data.departmentId==='original',403,'此身份不能发起该部门需求');
    department=data.departmentId;
    rule=await chooseRule(tx,settings.version,data.ruleId,department,{creatorOnly:true});
    requireThat(rule||department==='original',422,'请选择对应部门的创作规则');
    break;
   case 'design':
    requireThat(internal||u.role==='external'||u.role==='teacher',403,'此身份不能提设计需求');
    department='art';
    break;
   case 'work_entry':
    requireThat(internal,403,'工作登记只对内部成员开放');
    person=await activePerson(tx,data.personId);
    requireThat(u.id===person.id||canManage(u,person.department_id),403,'只能为本人或本部门成员登记');
    department=person.department_id;
    rule=await chooseRule(tx,settings.version,data.ruleId,department);
    requireThat(rule||data.hours,422,'人工填报须输入正数工时');
    break;
  }
  if(data.kind==='work_entry'&&data.linkedTaskId){
   const parent=await loadTask(tx,data.linkedTaskId,true);
   requireThat(parent.archive_id&&parent.department_id===department,422,'只能补登本部门已归档的工作');
   const isOriginal=parent.kind==='request'&&parent.department_id==='original'&&parent.assignee_id===person.id;
   const isManualReviewer=(parent.kind==='design'&&parent.complexity==='complex'||parent.kind==='request'&&parent.department_id==='original'&&parent.source_department==='original')&&
    parent.reviews.some(r=>r.stage==='acceptance'&&r.decision==='approve'&&r.actor_id===person.id)&&person.role==='minister';
   const isForced=!!parent.archive_reason&&(parent.assignee_id===person.id||canManage(u,department));
   requireThat(isOriginal||isManualReviewer||isForced,422,'该成员在此任务中没有待补登的贡献');
   requireThat(!rule,422,'例外工时须人工填报');
   requireThat(!(await tx.query("SELECT 1 FROM tasks t JOIN work_entries w ON w.task_id=t.id WHERE t.linked_task_id=$1 AND w.person_id=$2",[parent.id,person.id])).rows.length,409,'此成员已有该任务的补登记');
  }
  const urgent=data.kind==='photo'&&new Date(deadline)-now<settings.photo_window*3600000;
  const number='RW-'+now.getUTCFullYear()+'-'+taskId.slice(0,8).toUpperCase();
  await tx.query(`INSERT INTO tasks(id,number,title,creator_id,department_id,kind,deadline,notes,urgent,config_version,reminder_hours,linked_task_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[taskId,number,base.title,u.id,department,data.kind,deadline,base.notes,urgent,settings.version,base.reminderHours??null,data.kind==='work_entry'?data.linkedTaskId??null:null]);
  if(data.kind==='work_entry'){
   await tx.query('INSERT INTO work_entries(task_id,person_id,week,rule_id) VALUES($1,$2,$3,$4)',[taskId,person.id,data.week,rule?.id??null]);
   await addContribution(tx,{id:taskId},settings,{person,kind:'entry',rule,
    units:rule?.units??Math.round(data.hours*10000),name:rule?.name??'人工填报'});
  }else{
   const source=data.kind==='web_article'?'editorial':u.department_id??null;
   await tx.query(`INSERT INTO jobs(task_id,review_mode,rule_id,complexity,source_department,teacher_id,urgent_reason)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[taskId,!!data.teacherId,rule?.id??null,data.complexity??null,source,data.teacherId??null,data.urgentReason??'']);
  }
  if(data.kind==='photo')await tx.query('INSERT INTO bookings(task_id,location,contact) VALUES($1,$2,$3)',[taskId,data.location,data.contact]);
  for(const [i,line] of lines.entries())await tx.query('INSERT INTO article_lines(task_id,position,title,site,original,author_id) VALUES($1,$2,$3,$4,$5,$6)',[taskId,i+1,line.title,line.site,line.original,line.authorId]);
  for(const reviewer of reviewers)await tx.query('INSERT INTO task_reviewers(task_id,user_id) VALUES($1,$2)',[taskId,reviewer]);
  await event(tx,taskId,u,data.kind==='work_entry'?'登记工时':'发起需求',base.notes);
  const preferred=data.kind==='work_entry'?null:(await defaultAssignee(tx,department,data.kind)??await takeRotationTurn(tx,department));
  if(preferred)await automaticallyAssign(tx,{id:taskId,title:base.title},preferred);
  else await notify(tx,taskId,'created',await activeIds(tx,department),{title:base.title,message:data.kind==='work_entry'?'工作登记等待核定':'新需求待派发'});
  return {id:taskId,number};
 });
}

async function assign(tx,u,t,input,claim){
 if(claim){
  requireThat(t.kind==='photo'&&u.department_id==='photography'&&u.role==='member',403,'仅摄制干事可抢单');
  requireThat(new Date(t.deadline)>new Date(),409,'预约时间已过');
 }else requireThat(canManage(u,t.department_id),403,'仅承接部门部长或管理员可派发');
 const manualOverride=!claim&&t.automatic&&t.state==='awaiting_submission'&&!t.version;
 requireThat(t.state==='awaiting_assignment'||manualOverride,409,'已经有人承接');
 const data=claim?{assigneeId:u.id,remember:false}:z.object({assigneeId:key,remember:z.boolean().default(false)}).parse(input);
 const person=await activePerson(tx,data.assigneeId,t.department_id);
 if(manualOverride)await tx.query('UPDATE assignments SET assignee_id=$2,actor_id=$3,automatic=false,created_at=now() WHERE task_id=$1',[t.id,person.id,u.id]);
 else await tx.query('INSERT INTO assignments(task_id,assignee_id,actor_id) VALUES($1,$2,$3)',[t.id,person.id,u.id]);
 if(data.remember){
  await saveFlowDefault(tx,u,t.department_id,t.kind,person.id);
  await event(tx,t.id,u,'保存流程默认承接人',person.name);
 }
 await event(tx,t.id,u,claim?'抢单成功':'派发',person.name);
 await notify(tx,t.id,'assigned:'+person.id,[person.id],{title:t.title,message:'你有一项任务待交付'});
}

async function submit(tx,u,t,input){
 requireThat(t.assignee_id&&(u.id===t.assignee_id||canManage(u,t.department_id)),403,'仅承接人及本部管理人员可交付');
 requireThat(['awaiting_submission','returned'].includes(t.state),409,'当前环节不可替换成果');
 const data=delivery.parse(input);
 requireThat(data.body||data.fileIds.length,422,'请填写结果说明或上传成果附件');
 await attachFiles(tx,data.fileIds,t.id,u);
 const nextNeedsContent=t.review_mode&&(!t.version||t.version.phase==='content'&&t.state==='returned');
 const phase=nextNeedsContent?'content':'delivery';
 const version=id(),number=(t.version?.number??0)+1;
 await tx.query('INSERT INTO versions(id,task_id,number,body,author_id,phase) VALUES($1,$2,$3,$4,$5,$6)',[version,t.id,number,data.body,u.id,phase]);
 for(const file of new Set(data.fileIds))await tx.query('INSERT INTO version_files(version_id,file_id) VALUES($1,$2)',[version,file]);
 await event(tx,t.id,u,phase==='content'?'提交待审稿件':'提交成果','第 '+number+' 版');
 const next=await loadTask(tx,t.id);
 await notify(tx,t.id,'version:'+version,await currentRecipients(tx,next),{title:t.title,message:next.stateLabel});
}

async function calculate(tx,t,u){
 const settings=await policy(tx,t.config_version);
 const rules=new Map((await rulesFor(tx,settings.version)).map(rule=>[rule.id,rule]));
 const add=async(personId,kind,ruleId,details={})=>{
  const person=await activePerson(tx,personId,kind==='reviewer'&&t.kind==='web_article'?'editorial':details.department??t.department_id);
  await addContribution(tx,t,settings,{...details,person,kind,rule:rules.get(ruleId)});
 };
 if(t.kind==='web_article'){
  const lines=(await tx.query('SELECT * FROM article_lines WHERE task_id=$1 ORDER BY position',[t.id])).rows;
  for(const line of lines){
   const source='稿件 '+line.position+' · '+line.title+' · '+line.site;
   if(line.original)await add(line.author_id,'creator',1,{source,department:'editorial'});
   await add(t.assignee_id,'coordinator',17,{source});
  }
  const eligible=(await tx.query(`SELECT u.id FROM task_reviewers r JOIN users u ON u.id=r.user_id
   WHERE r.task_id=$1 AND u.role='minister' AND u.payable AND u.department_id='editorial' ORDER BY u.id`,[t.id])).rows;
  const total=rules.get(2).units;
  for(const [index,reviewer] of eligible.entries()){
   const share=Math.floor(total/eligible.length)+(index<total%eligible.length?1:0);
   await add(reviewer.id,'reviewer',2,{units:share});
  }
  return;
 }
 const design=designRules[t.complexity];
 const creatorId=t.kind==='photo'?18:t.kind==='design'?design[0]:t.rule_id;
 if(creatorId)await add(t.assignee_id,'creator',creatorId,{multiplier:t.urgent?settings.urgent_factor:10000});
 else await event(tx,t.id,u,'创作工时待人工登记','部门暂无适用的自动计发规则');
 if(u.role!=='minister'||!u.payable||u.department_id!==t.department_id)return;
 if(t.kind==='request'){
  const creator=(await tx.query('SELECT role,department_id FROM users WHERE id=$1',[t.creator_id])).rows[0];
  if(creator.role==='external'||creator.role==='admin')await add(u.id,'reviewer',null,{name:'外部需求审核',units:20000});
  else await event(tx,t.id,u,'审校工时待人工登记','原创部暂无审核规则');
 }
 if(t.kind==='photo')await add(u.id,'reviewer',19);
 if(t.kind==='design'){
  if(design[1])await add(u.id,'reviewer',design[1]);
  else await event(tx,t.id,u,'审校工时待人工登记','复杂设计暂无审核规则');
 }
}

async function review(tx,u,t,input,stage){
 const data=decisionSchema.parse(input);
 requireThat(data.decision==='approve'||data.reason,422,'退回须填写修改理由');
 requireThat(stage==='content'?u.role==='teacher'&&u.id===t.teacher_id:mayAccept(u,t),403,'此审核由当前责任人处理');
 requireThat(t.version?.id===data.versionId,409,'版本已变化，请刷新');
 if(stage==='acceptance'&&t.archive_id&&!t.archive_reason&&data.decision==='approve')return;
 requireThat(t.state===stage,409,'尚未到此审核环节或已经处理');
 await tx.query('INSERT INTO reviews(id,task_id,version_id,stage,decision,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id(),t.id,data.versionId,stage,data.decision,data.reason,u.id]);
 await event(tx,t.id,u,(stage==='content'?'内容审校':'验收')+(data.decision==='approve'?'通过':'退回'),data.reason);
 if(stage==='acceptance'&&data.decision==='approve'){
  await calculate(tx,t,u);
  await tx.query('INSERT INTO archives(id,task_id,version_id) VALUES($1,$2,$3)',[id(),t.id,data.versionId]);
  await event(tx,t.id,u,'自动归档');
 }
 const next=await loadTask(tx,t.id);
 const recipients=next.archive_id?[t.creator_id,t.assignee_id]:await currentRecipients(tx,next);
 await notify(tx,t.id,stage+':'+data.versionId,recipients,{title:t.title,message:next.stateLabel});
}

export async function jobAction(db,u,taskId,action,input={}){
 return db.transaction(async tx=>{
  const task=await loadTask(tx,taskId,true);
  if(action==='force-archive'){
   requireThat(task.kind!=='work_entry'&&canManage(u,task.department_id),403,'仅本部部长或管理员可强制归档');
   requireThat(!task.archive_id,409,'任务已归档');
   const reason=text.min(1).max(5000).parse(input.reason);
   await tx.query('INSERT INTO archives(id,task_id,version_id,reason) VALUES($1,$2,$3,$4)',[id(),taskId,task.version?.id??null,reason]);
   await event(tx,taskId,u,'强制归档 · 工时未自动核算',reason);
   await notify(tx,taskId,'force-archived',[task.creator_id,task.assignee_id],{title:task.title,message:'已强制归档，工时未自动核算'});
  }else{
   requireThat(!['publication','work_entry'].includes(task.kind),409,'此任务类型不支持该操作');
   if(action==='assign'||action==='claim')await assign(tx,u,task,input,action==='claim');
   else if(action==='submit')await submit(tx,u,task,input);
   else if(['content','acceptance'].includes(action))await review(tx,u,task,input,action);
   else requireThat(false,404,'任务操作不存在');
  }
  return loadTask(tx,taskId);
 });
}

export async function workflowOptions(db,u){
 const settings=await policy(db);
 const isInternal=['member','minister','admin'].includes(u.role);
 const people=(isInternal?(await db.query(`SELECT id,name,department_id,role FROM users
  WHERE active AND (payable OR role='teacher') ORDER BY department_id,role,name`)).rows:[]);
 return {policy:settings,rules:await rulesFor(db,settings.version),
  departments:(await db.query('SELECT * FROM departments ORDER BY name')).rows,people,sites};
}
