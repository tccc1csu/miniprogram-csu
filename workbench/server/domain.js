import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {canManage,canReportAll} from './auth.js';
import {jobState,jobLabels} from './jobs.js';
import {policy,rulesFor,activePerson,addContribution} from './policy.js';
import {publicationRouting,publicationDefaults,validPair,saveTeacherPair,teacherPair,reviewerPair,notifyReview} from './approval.js';
import {defaultAssignee,saveFlowDefault,automaticallyAssign} from './flow-defaults.js';
import {cleanPreview,mayReviewPublication,listAnnotations} from './annotations.js';
import {activeIds,currentRecipients} from './jobs.js';
import {takeRotationTurn} from './rotation.js';
import {taskViewer} from './workspace.js';
export const id=()=>randomUUID();
export class HttpError extends Error{constructor(status,message,code='BUSINESS_RULE'){super(message);this.status=status;this.code=code;}}
export function requireThat(value,status,message){if(!value)throw new HttpError(status,message);}
const text=z.string().trim();
const url=text.max(2000).refine(v=>{try{return ['http:','https:'].includes(new URL(v).protocol);}catch{return false;}},'请填写有效的http(s)链接');
export const createSchema=z.object({title:text.min(2).max(180),layoutType:z.enum(['basic','photo','repost']),deadline:z.iso.datetime({offset:true}),notes:text.max(10000).default(''),openRegistration:z.boolean().default(false),linkedTaskId:text.min(1).optional(),reminderHours:z.number().min(0).max(720).optional(),reviewerIds:z.array(text).length(2).optional()});
export const reviewSchema=z.object({stage:z.enum(['editorial','internal','teacher1','teacher2']),decision:z.enum(['approve','reject']),versionId:text.min(1),reason:text.max(5000).default('')});
const stageLabels={editorial:'采编内容审核',internal:'部长内审',teacher1:'老师一审',teacher2:'老师二审'};
export const stateLabels={source_pending:'待交供稿',source_returned:'供稿退回',editorial:'采编内容审核',awaiting_assignment:'待接单',awaiting_submission:'待交稿',internal:'部长内审',teacher1:'老师一审',teacher2:'老师二审',awaiting_publish:'待发布',archived:'已归档',returned:'已退回'};
export async function event(tx,taskId,user,action,detail=''){await tx.query('INSERT INTO events(id,task_id,actor_id,action,detail) VALUES($1,$2,$3,$4,$5)',[id(),taskId,user.id,action,detail]);}
export async function notify(tx,taskId,key,recipients,payload){
 for(const recipient of new Set(recipients.filter(Boolean)))await tx.query('INSERT INTO outbox(id,task_id,event,recipient_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id(),taskId,key,recipient,JSON.stringify(payload)]);
}
export function deriveState(t){
 if(t.archive_id)return 'archived';
 if(t.source_required){
  if(!t.source)return 'source_pending';
  if(t.source_review?.decision==='reject')return 'source_returned';
  if(t.source_review?.decision!=='approve')return 'editorial';
 }
 if(!t.assignee_id)return 'awaiting_assignment';
 if(!t.version)return 'awaiting_submission';
 if(t.reviews.some(x=>x.decision==='reject'))return 'returned';
 for(const stage of ['internal','teacher1','teacher2'])if(!t.reviews.some(x=>x.stage===stage&&x.decision==='approve'))return stage;
 return 'awaiting_publish';
}
export async function loadTask(tx,taskId,lock=false){
 const t=(await tx.query('SELECT t.*,d.name department_name,a.assignee_id,a.automatic,u.name assignee_name,p.url publication_url,ar.id archive_id,ar.created_at archived_at,ar.reason archive_reason FROM tasks t JOIN departments d ON d.id=t.department_id LEFT JOIN assignments a ON a.task_id=t.id LEFT JOIN users u ON u.id=a.assignee_id LEFT JOIN publications p ON p.task_id=t.id LEFT JOIN archives ar ON ar.task_id=t.id WHERE t.id=$1'+(lock?' FOR UPDATE OF t':''),[taskId])).rows[0];
 requireThat(t,404,'任务不存在');
 t.reviewers=(await tx.query('SELECT u.id,u.name FROM task_reviewers r JOIN users u ON u.id=r.user_id WHERE r.task_id=$1 ORDER BY u.id',[taskId])).rows;
 t.version=(await tx.query("SELECT * FROM versions WHERE task_id=$1 AND phase!='source' ORDER BY number DESC LIMIT 1",[taskId])).rows[0]||null;
 t.reviews=t.version?(await tx.query('SELECT r.*,u.name actor_name FROM reviews r JOIN users u ON u.id=r.actor_id WHERE r.version_id=$1 ORDER BY r.created_at',[t.version.id])).rows:[];
 if(t.kind==='publication'){
  Object.assign(t,await publicationRouting(tx,t));
  if(t.source_required){
   t.source=(await tx.query("SELECT * FROM versions WHERE task_id=$1 AND phase='source' ORDER BY number DESC LIMIT 1",[taskId])).rows[0];
   if(t.source)t.source_review=(await tx.query("SELECT * FROM reviews WHERE version_id=$1 AND stage='editorial'",[t.source.id])).rows[0];
  }
  if(t.teacher1_id||t.teacher2_id){
   const teachers=(await tx.query("SELECT id,name FROM users WHERE id=ANY($1::text[])",[[t.teacher1_id,t.teacher2_id].filter(Boolean)])).rows;
   for(const stage of ['teacher1','teacher2'])t[stage+'_name']=teachers.find(teacher=>teacher.id===t[stage+'_id'])?.name;
  }
 }else if(t.kind!=='work_entry'){
  Object.assign(t,(await tx.query('SELECT review_mode,rule_id,complexity,source_department,teacher_id,urgent_reason FROM jobs WHERE task_id=$1',[taskId])).rows[0]);
 }
 t.state=t.kind==='publication'?deriveState(t):t.kind==='work_entry'?'recorded':jobState(t);
 t.stateLabel=t.kind==='publication'?stateLabels[t.state]:t.state==='recorded'?'已登记':jobLabels[t.state];
 return t;
}
export async function canView(tx,u,t){
 if(t.kind==='work_entry'){
  if(u.id===t.creator_id||canReportAll(u)||canManage(u,t.department_id))return true;
  return (await tx.query('SELECT person_id FROM work_entries WHERE task_id=$1',[t.id])).rows[0]?.person_id===u.id;
 }
 if(['admin','teacher'].includes(u.role)||u.department_id===t.department_id||u.id===t.creator_id||u.id===t.assignee_id||t.reviewers.some(r=>r.id===u.id))return true;
 const internal=['minister','member'].includes(u.role);
 if(internal&&t.source_department===u.department_id)return true;
 if(t.kind==='publication'&&t.source_required&&canManage(u,'editorial'))return true;
 if(internal&&u.department_id==='operations'&&t.kind==='web_article'){
  if((await tx.query("SELECT 1 FROM tasks WHERE linked_task_id=$1 AND kind='publication'",[t.id])).rows.length)return true;
 }
 return (await tx.query('SELECT 1 FROM events WHERE task_id=$1 AND actor_id=$2 LIMIT 1',[t.id,u.id])).rows.length>0;
}
export async function assertView(tx,u,t){requireThat(await canView(tx,u,t),403,'你没有查看此任务的权限');}
export async function saveReportNote(db,user,taskId,input){
 const {reportNote}=z.object({reportNote:text.max(2000)}).parse(input);
 return db.transaction(async tx=>{
  const task=await loadTask(tx,taskId,true);
  requireThat(canManage(user,task.department_id)||[task.creator_id,task.assignee_id].includes(user.id),403,'仅任务发起人、承接人或承接部门管理人员可编辑备注');
  if(task.report_note!==reportNote){
   await tx.query('UPDATE tasks SET report_note=$2 WHERE id=$1',[taskId,reportNote]);
   await event(tx,taskId,user,'更新任务备注',reportNote||'清空备注');
  }
  return {reportNote};
 });
}
export function assertManage(u,t){requireThat(canManage(u,t.department_id),403,'仅承接部门部长或管理员可操作');}
function assertSubmit(u,t){requireThat(t.assignee_id===u.id||canManage(u,t.department_id),403,'仅承接人或本部部长可交稿');}
async function validateReviewers(tx,ids){
 requireThat(ids?.length===2&&new Set(ids).size===2,422,'请选择两位不同的运营部部长');
 const r=await tx.query("SELECT id FROM users WHERE id=ANY($1::text[]) AND active=true AND role='minister' AND department_id='operations' AND payable=true",[ids]);requireThat(r.rows.length===2,422,'审校人员须为有效运营部部长');
}
export async function attachFiles(tx,fileIds,taskId,u){
 for(const fid of [...new Set(fileIds)]){
 const f=(await tx.query('SELECT * FROM files WHERE id=$1 AND task_id=$2',[fid,taskId])).rows[0];
 requireThat(f,422,'附件不属于当前任务');requireThat(u.role!=='external'||f.owner_id===u.id,403,'只能提交本人上传的附件');}
}
export async function createTask(db,u,input){
 const data=createSchema.parse(input);
 requireThat(u.role==='external'||canManage(u)||(data.linkedTaskId&&['minister','member'].includes(u.role)&&['office','editorial'].includes(u.department_id)),403,'此身份不能发起推文排版');requireThat(new Date(data.deadline)>new Date(),422,'截止时间须晚于现在');
 return db.transaction(async tx=>{
 const taskId=id();if(data.reviewerIds)await validateReviewers(tx,data.reviewerIds);
 const number='RW-'+new Date().getUTCFullYear()+'-'+taskId.slice(0,8).toUpperCase();
 const settings=await policy(tx);
 if(data.linkedTaskId){
  const parent=await loadTask(tx,data.linkedTaskId,true);
  await assertView(tx,u,parent);
  requireThat(u.role!=='external'&&parent.kind==='web_article'&&parent.archive_id&&!parent.archive_reason,422,'只能关联已正常归档的挂网任务');
  requireThat(!(await tx.query("SELECT id FROM tasks WHERE linked_task_id=$1 AND kind='publication'",[parent.id])).rows.length,409,'这单挂网任务已有排版任务');
 }
 await tx.query('INSERT INTO tasks(id,number,title,creator_id,department_id,layout_type,deadline,notes,open_registration,linked_task_id,config_version,reminder_hours) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[taskId,number,data.title,u.id,'operations',data.layoutType,data.deadline,data.notes,data.openRegistration,data.linkedTaskId??null,settings.version,data.reminderHours??null]);
 const defaults=await publicationDefaults(tx);
 const reviewers=data.reviewerIds??(await validPair(tx,defaults.reviewerIds,'minister','operations')?defaults.reviewerIds:[]);
 const teachers=await validPair(tx,defaults.teacherIds,'teacher')?defaults.teacherIds:[null,null];
 await tx.query('INSERT INTO publication_routing(task_id,source_required,teacher1_id,teacher2_id) VALUES($1,$2,$3,$4)',
  [taskId,u.role==='external',...teachers]);
 for(const reviewer of reviewers)await tx.query('INSERT INTO task_reviewers(task_id,user_id) VALUES($1,$2)',[taskId,reviewer]);
 await event(tx,taskId,u,'发起需求',data.notes);
 const task=await loadTask(tx,taskId);
 if(task.state==='awaiting_assignment')await queuePublication(tx,task);
 return {id:taskId,number};
 });
}
async function queuePublication(tx,task){
 const ready=await validPair(tx,task.reviewers.map(r=>r.id),'minister','operations')&&
  await validPair(tx,[task.teacher1_id,task.teacher2_id],'teacher');
 const preferred=ready?(await defaultAssignee(tx,'operations','publication')??await takeRotationTurn(tx,'operations')):null;
 if(preferred){
  await saveTeacherPair(tx,task.id,[task.teacher1_id,task.teacher2_id]);
  await automaticallyAssign(tx,task,preferred);
 }else await notify(tx,task.id,'ready-to-assign',await activeIds(tx,'operations'),{title:task.title,message:'新需求待接单'});
}

const manuscript=z.object({body:text.max(100000).default(''),
 previewUrl:z.union([url,z.literal('')]).default(''),previewHtml:z.string().max(600000).default(''),
 fileIds:z.array(text).max(30).default([])});

async function recordManuscript(tx,task,user,data,phase){
 const body=data.body.replace(/\r\n?/g,'\n').replace(/\0/g,'');
 const html=cleanPreview(data.previewHtml);
 requireThat(body||html||data.fileIds.length,422,'请填写正文、导入预览或上传稿件材料');
 await attachFiles(tx,data.fileIds,task.id,user);
 const current=phase==='source'?task.source:task.version;
 const versionId=id(),number=(current?.number||0)+1;
 // The shared versions table has a single sequence per task.
 const last=(await tx.query('SELECT max(number) AS number FROM versions WHERE task_id=$1',[task.id])).rows[0].number;
 await tx.query('INSERT INTO versions(id,task_id,number,body,preview_url,author_id,phase,preview_html) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
  [versionId,task.id,(last||0)+1,body,data.previewUrl,user.id,phase,html]);
 for(const fid of new Set(data.fileIds))await tx.query('INSERT INTO version_files(version_id,file_id) VALUES($1,$2)',[versionId,fid]);
 const isSource=phase==='source';
 await event(tx,task.id,user,isSource?'提交供稿':'提交稿件','第'+number+'版');
 const stage=isSource?'editorial':'internal';
 await notifyReview(tx,{...task,state:stage},'version:'+versionId,isSource?await activeIds(tx,'editorial'):task.reviewers.map(r=>r.id),
  isSource?'兄弟组织供稿等待采编审核':'排版稿等待部长内审');
 return {id:versionId};
}

export async function submitSource(db,user,taskId,input){
 const data=manuscript.parse(input);
 return db.transaction(async tx=>{
  const task=await loadTask(tx,taskId,true);
  requireThat(task.source_required&&(user.id===task.creator_id||user.role==='admin'),403,'仅需求发起人或管理员可提交此供稿');
  requireThat(['source_pending','source_returned'].includes(task.state),409,'供稿正在审核或已通过');
  return recordManuscript(tx,task,user,data,'source');
 });
}

export async function assignTask(db,u,taskId,input){
 const data=z.object({assigneeId:text.min(1),reviewerIds:reviewerPair.optional(),teacherIds:teacherPair.optional(),
  remember:z.boolean().default(false),rememberReviewers:z.boolean().default(false)}).parse(input);
 return db.transaction(async tx=>{
 const t=await loadTask(tx,taskId,true);requireThat(t.kind==='publication',409,'请使用对应业务入口');assertManage(u,t);requireThat(['awaiting_assignment','awaiting_submission'].includes(t.state),409,'已进入审校或完成，不能更换安排');
 const member=(await tx.query("SELECT id,name FROM users WHERE id=$1 AND department_id=$2 AND role IN('member','minister') AND active=true AND payable=true",[data.assigneeId,t.department_id])).rows[0];
 requireThat(member,422,'请选择承接部门的有效成员');
 const defaults=await publicationDefaults(tx);
 const reviewerIds=data.reviewerIds??(t.reviewers.length===2?t.reviewers.map(r=>r.id):defaults.reviewerIds);
 await validateReviewers(tx,reviewerIds);
 await saveTeacherPair(tx,taskId,data.teacherIds??[t.teacher1_id,t.teacher2_id]);
 await tx.query('INSERT INTO assignments(task_id,assignee_id,actor_id) VALUES($1,$2,$3) ON CONFLICT(task_id) DO UPDATE SET assignee_id=$2,actor_id=$3,created_at=now(),automatic=false',[taskId,data.assigneeId,u.id]);
 await tx.query('DELETE FROM task_reviewers WHERE task_id=$1',[taskId]);for(const r of reviewerIds)await tx.query('INSERT INTO task_reviewers(task_id,user_id) VALUES($1,$2)',[taskId,r]);
 if(data.remember)await saveFlowDefault(tx,u,t.department_id,t.kind,member.id);
 if(data.rememberReviewers)await tx.query('UPDATE publication_defaults SET reviewer1_id=$1,reviewer2_id=$2 WHERE singleton',reviewerIds);
 if(data.remember)await event(tx,taskId,u,'保存流程默认承接人',member.name);
 if(data.rememberReviewers)await event(tx,taskId,u,'保存排版默认内审组合');
 await event(tx,taskId,u,'安排排版',member.name+' · 固定两位部长审校');await notify(tx,taskId,'assigned:'+data.assigneeId,[data.assigneeId],{title:t.title,message:'你有一项排版待完成'});return loadTask(tx,taskId);
 });
}
export async function changeTaskTeachers(db,user,taskId,input){
 const data=z.object({teacherIds:teacherPair}).parse(input);
 return db.transaction(async tx=>{
  const task=await loadTask(tx,taskId,true);
  requireThat(task.kind==='publication'&&canManage(user,'operations'),403,'仅运营部长或管理员可调整老师');
  requireThat(!task.archive_id&&task.state!=='awaiting_publish',409,'审校已完成');
  if(task.state==='teacher2')requireThat(task.teacher1_id===data.teacherIds[0],409,'已完成一审，不能更换一审老师');
  await saveTeacherPair(tx,task.id,data.teacherIds);
  const next=await loadTask(tx,task.id);
  await event(tx,task.id,user,'调整两审老师',[next.teacher1_name,next.teacher2_name].join('、'));
  if(['teacher1','teacher2'].includes(next.state))await notifyReview(tx,next,'route:'+id(),await currentRecipients(tx,next),next.stateLabel);
  return next;
 });
}

export async function submitVersion(db,u,taskId,input){
 const data=manuscript.parse(input);
 return db.transaction(async tx=>{
 const t=await loadTask(tx,taskId,true);requireThat(t.kind==='publication',409,'请使用对应业务入口');assertSubmit(u,t);requireThat(t.assignee_id,409,'请先安排承接人');requireThat(['awaiting_submission','returned','internal'].includes(t.state),409,'当前环节不能覆盖稿件；审查退回后重新交稿');
 requireThat(t.reviewers.length===2,409,'请先配置两位运营审校部长');
 requireThat(await validPair(tx,[t.teacher1_id,t.teacher2_id],'teacher'),409,'请先指定两位不同的老师');
 await saveTeacherPair(tx,t.id,[t.teacher1_id,t.teacher2_id]);
 return recordManuscript(tx,t,u,data,'delivery');
 });
}
export async function reviewTask(db,u,taskId,input){
 const data=reviewSchema.parse(input);
 return db.transaction(async tx=>{
 const t=await loadTask(tx,taskId,true);requireThat(t.kind==='publication',409,'请使用对应业务入口');
 requireThat(mayReviewPublication(u,t,data.stage),403,'此环节由指定的审校人员处理');
 const current=data.stage==='editorial'?t.source:t.version;
 requireThat(current?.id===data.versionId,409,'稿件版本已变化，请刷新后审阅');
 requireThat(t.state===data.stage,409,'当前尚未轮到此审核环节或已有审核结果');
 let reason=data.reason;
 if(data.decision==='reject'&&!reason){
  const count=(await tx.query('SELECT count(*)::int AS total FROM version_annotations WHERE version_id=$1 AND stage=$2 AND actor_id=$3',
   [current.id,data.stage,u.id])).rows[0].total;
  requireThat(count,422,'退回请填写修改原因或添加文中批注');
  reason='请按文中 '+count+' 条批注修改';
 }
 if(data.stage==='internal'&&data.decision==='approve'){
  requireThat(await validPair(tx,[t.teacher1_id,t.teacher2_id],'teacher'),409,'请先指定两位不同的老师');
  await saveTeacherPair(tx,taskId,[t.teacher1_id,t.teacher2_id]);
 }
 await tx.query('INSERT INTO reviews(id,task_id,version_id,stage,decision,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id(),taskId,data.versionId,data.stage,data.decision,reason,u.id]);
 await event(tx,taskId,u,stageLabels[data.stage]+(data.decision==='approve'?'通过':'退回'),reason);
 const next=await loadTask(tx,taskId);
 if(next.state==='awaiting_assignment')await queuePublication(tx,next);
 else await notifyReview(tx,next,'review:'+data.versionId+':'+data.stage,await currentRecipients(tx,next),next.stateLabel);
 return loadTask(tx,taskId);
 });
}
export async function publishTask(db,u,taskId,input){
 const data=z.object({url,versionId:text.min(1)}).parse(input);
 return db.transaction(async tx=>{
 const t=await loadTask(tx,taskId,true);requireThat(t.kind==='publication',409,'请使用对应业务入口');assertSubmit(u,t);
 if(t.archive_id){requireThat(t.version?.id===data.versionId&&t.publication_url===data.url,409,'任务已归档，不能替换发布结果');return t;}
 requireThat(t.state==='awaiting_publish'&&t.version.id===data.versionId,409,'须当前版本老师二审通过后才能发布');
 await tx.query('INSERT INTO publications(task_id,version_id,url,actor_id) VALUES($1,$2,$3,$4)',[taskId,t.version.id,data.url,u.id]);
 await tx.query('INSERT INTO archives(id,task_id,version_id) VALUES($1,$2,$3)',[id(),taskId,t.version.id]);
 const settings=await policy(tx,t.config_version);
 const rules=new Map((await rulesFor(tx,settings.version)).map(rule=>[rule.id,rule]));
 const creator=rules.get({basic:21,photo:22,repost:23}[t.layout_type]),review=rules.get(24);
 await addContribution(tx,t,settings,{person:await activePerson(tx,t.assignee_id,'operations'),kind:'creator',rule:creator,multiplier:t.urgent?settings.urgent_factor:10000});
 for(const reviewer of t.reviewers)await addContribution(tx,t,settings,{person:await activePerson(tx,reviewer.id,'operations'),kind:'reviewer',rule:review,units:review.units/2,name:'排版审校 · 两部长平分2h'});
 await event(tx,taskId,u,'发布并自动归档',data.url);
 await notify(tx,taskId,'archived',[t.creator_id,t.assignee_id,...t.reviewers.map(x=>x.id)],{title:t.title,message:'已自动归档，内部工时待核定'});return loadTask(tx,taskId);
 });
}
export async function registerTask(db,u,taskId,input){
 requireThat(u.role==='external',403,'此入口仅对兄弟组织开放');
 const data=z.object({notes:text.max(10000).default(''),fileIds:z.array(text).max(30).default([])}).parse(input);
 return db.transaction(async tx=>{
 const t=await loadTask(tx,taskId,true);requireThat(t.kind==='publication',409,'请使用对应业务入口');requireThat(t.open_registration,403,'此任务未开放报名');
 requireThat(!t.archive_id&&new Date(t.deadline)>new Date(),409,'报名已截止');
 requireThat(!(await tx.query('SELECT id FROM registrations WHERE task_id=$1 AND user_id=$2',[taskId,u.id])).rows.length,409,'你已经报名，无需重复提交');
 await attachFiles(tx,data.fileIds,taskId,u);const rid=id();
 await tx.query('INSERT INTO registrations(id,task_id,user_id,notes) VALUES($1,$2,$3,$4)',[rid,taskId,u.id,data.notes]);
 for(const fid of new Set(data.fileIds))await tx.query('INSERT INTO registration_files(registration_id,file_id) VALUES($1,$2)',[rid,fid]);
 if(new Date(t.deadline)-new Date()<(await policy(tx,t.config_version)).publication_window*3600000)await tx.query('UPDATE tasks SET urgent=true WHERE id=$1',[taskId]);
 await event(tx,taskId,u,'组织报名',data.notes);await notify(tx,taskId,'registration:'+rid,[t.assignee_id,...t.reviewers.map(x=>x.id)],{title:t.title,message:'收到新的报名材料，请留意加急'});return {id:rid};
 });
}
export async function listTasks(db,u){
  const rows=(await db.query(`SELECT t.id, EXISTS(SELECT 1 FROM reviews r WHERE r.task_id=t.id AND r.actor_id=$1) reviewed_by_me
  FROM tasks t LEFT JOIN jobs j ON j.task_id=t.id
  LEFT JOIN work_entries we ON we.task_id=t.id
  LEFT JOIN assignments a ON a.task_id=t.id
  LEFT JOIN archives ar ON ar.task_id=t.id
  WHERE ($2='admin')
  OR (t.kind='work_entry' AND (t.creator_id=$1 OR we.person_id=$1 OR
       ($2='minister' AND (t.department_id=$3 OR $3='office'))))
  OR (t.kind!='work_entry' AND (
   $2='teacher' OR t.creator_id=$1 OR t.department_id=$3 OR j.source_department=$3 OR a.assignee_id=$1
   OR ($2='minister' AND $3='editorial' AND EXISTS(SELECT 1 FROM publication_routing p WHERE p.task_id=t.id AND p.source_required))
   OR EXISTS(SELECT 1 FROM task_reviewers r WHERE r.task_id=t.id AND r.user_id=$1)
   OR EXISTS(SELECT 1 FROM events e WHERE e.task_id=t.id AND e.actor_id=$1)
   OR ($3='operations' AND t.kind='web_article' AND EXISTS(SELECT 1 FROM tasks p WHERE p.linked_task_id=t.id AND p.kind='publication'))
   OR ($2='external' AND t.open_registration AND ar.id IS NULL AND t.deadline>now())
  ))
  ORDER BY t.created_at DESC LIMIT 500`,[u.id,u.role,u.department_id])).rows;
 const result=[];
 for(const row of rows){const t=await loadTask(db,row.id);const own=await canView(db,u,t);
 if(own&&u.role!=='external')result.push({...t,viewer:taskViewer(u,t,row.reviewed_by_me)});
 else if(own)result.push({...externalTask(t),viewer:taskViewer(u,t)});
 else if(u.role==='external'&&t.open_registration&&!t.archive_id&&new Date(t.deadline)>new Date()){
  const {id,number,title,deadline,state,stateLabel}=t;
  const registered=!!(await db.query('SELECT id FROM registrations WHERE task_id=$1 AND user_id=$2',[id,u.id])).rows.length;
  result.push({id,number,title,deadline,state,stateLabel,open_registration:true,publicOnly:true,registered});
 }}
 return result;
}
function externalTask(t,canEditReportNote){const {id,kind,number,title,notes,report_note,deadline,state,stateLabel,layout_type,urgent,open_registration,publication_url,department_id,department_name,archived_at,archive_reason,complexity,source_required,source_review}=t;return {id,kind,number,title,notes,report_note,canEditReportNote,deadline,state,stateLabel,layout_type,urgent,open_registration,publication_url,department_id,department_name,archived_at,archive_reason,complexity,source_required,sourceFeedback:source_review?.reason};}
export async function taskDetail(db,u,taskId){
 const t=await loadTask(db,taskId);await assertView(db,u,t);
 const extra={};
 if(t.kind==='photo')extra.booking=(await db.query('SELECT location,contact FROM bookings WHERE task_id=$1',[taskId])).rows[0];
 if(u.role==='external') {
  const files=(await db.query('SELECT id,name,size FROM files WHERE task_id=$1 AND owner_id=$2 ORDER BY created_at',[taskId,u.id])).rows;
  const versions=t.source_required?(await db.query("SELECT * FROM versions WHERE task_id=$1 AND phase='source' ORDER BY number DESC",[taskId])).rows:[];
  for(const version of versions)version.files=(await db.query(`SELECT f.id,f.name,f.size FROM version_files vf JOIN files f ON f.id=vf.file_id
   WHERE vf.version_id=$1 AND f.owner_id=$2`,[version.id,u.id])).rows;
  const reviews=t.source_required?(await db.query("SELECT r.*,u.name actor_name FROM reviews r JOIN users u ON u.id=r.actor_id WHERE r.task_id=$1 AND r.stage='editorial' ORDER BY r.created_at",[taskId])).rows:[];
  return {...extra,task:externalTask(t,t.creator_id===u.id),files,versions,reviews,annotations:t.source_required?await listAnnotations(db,taskId,{sourceOnly:true}):[],events:[],registrations:[],contributions:[]};
 }
 if(t.kind==='work_entry')extra.entry=(await db.query('SELECT w.*,u.name FROM work_entries w JOIN users u ON u.id=w.person_id WHERE w.task_id=$1',[taskId])).rows[0];
 if(t.kind==='web_article')extra.lines=(await db.query('SELECT l.*,u.name author_name FROM article_lines l LEFT JOIN users u ON u.id=l.author_id WHERE task_id=$1 ORDER BY position',[taskId])).rows;
 const linked=(await db.query('SELECT id,title,number,kind FROM tasks WHERE linked_task_id=$1 OR id=$2 ORDER BY created_at',[taskId,t.linked_task_id])).rows;
 extra.linked=[];
 for(const candidate of linked)if(await canView(db,u,await loadTask(db,candidate.id)))extra.linked.push(candidate);
 if(t.linked_task_id&&extra.linked.some(l=>l.id===t.linked_task_id)){
  extra.linkedFiles=(await db.query('SELECT id,name,size FROM files WHERE task_id=$1 ORDER BY created_at',[t.linked_task_id])).rows;
 }

 if(t.kind==='publication')extra.annotations=await listAnnotations(db,taskId);
 const versions=(await db.query('SELECT v.*,u.name author_name FROM versions v JOIN users u ON u.id=v.author_id WHERE v.task_id=$1 ORDER BY v.number DESC',[taskId])).rows;
 for(const v of versions)v.files=(await db.query('SELECT f.id,f.name,f.size,f.sha256 FROM version_files vf JOIN files f ON f.id=vf.file_id WHERE vf.version_id=$1',[v.id])).rows;
 const reviews=(await db.query('SELECT r.*,u.name actor_name FROM reviews r JOIN users u ON u.id=r.actor_id WHERE r.task_id=$1 ORDER BY r.created_at',[taskId])).rows;
 const events=(await db.query('SELECT e.*,u.name actor_name FROM events e JOIN users u ON u.id=e.actor_id WHERE e.task_id=$1 ORDER BY e.created_at',[taskId])).rows;
 const files=(await db.query('SELECT id,name,size,owner_id FROM files WHERE task_id=$1 ORDER BY created_at',[taskId])).rows;
 const registrations=(await db.query('SELECT r.*,u.name FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.task_id=$1',[taskId])).rows;
 const contribution=(await db.query('SELECT w.id,w.user_id,w.department_id,u.name,w.kind,w.base_units,w.effective_units,w.rate_cents,w.confirmed,w.rule_name,w.source_key FROM worklogs w JOIN users u ON u.id=w.user_id WHERE w.task_id=$1',[taskId])).rows;
 return {...extra,task:t,versions,reviews,events,files,registrations,contributions:canReportAll(u)?contribution:contribution.filter(x=>x.user_id===u.id||(u.role==='minister'&&x.department_id===u.department_id))};
}
