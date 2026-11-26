// Explicit acceptance fixtures. Never called by production startup.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {hashPassword} from '../server/auth.js';
import {createTask,assignTask,submitSource,submitVersion,reviewTask,publishTask,
 loadTask,registerTask,saveReportNote} from '../server/domain.js';
import {createJob,jobAction} from '../server/jobs.js';
import {addAnnotation} from '../server/annotations.js';
import {adjust,seal,saveView} from '../server/reports.js';
import {saveRotation} from '../server/rotation.js';
import {saveFlowDefault} from '../server/flow-defaults.js';

export const dataset='acceptance-v1';
export const marker=dataset+':dataset';
export const accounts=[
 ['minister','林知夏','minister','operations'],['minister2','陈予安','minister','operations'],
 ['member','许星禾','member','operations'],['member2','周时宁','member','operations'],
 ['teacher','一审指导老师','teacher',null],['teacher2','二审指导老师','teacher',null],
 ['office','办公部部长','minister','office'],['office2','办公部干事','member','office'],
 ['editor','采编部部长','minister','editorial'],['editor2','采编部审校部长','minister','editorial'],
 ['writer','采编部干事','member','editorial'],
 ['photo','摄制部部长','minister','photography'],['photo2','摄制部干事','member','photography'],['photo3','摄制部值班干事','member','photography'],
 ['art','美编部部长','minister','art'],['art2','美编部干事','member','art'],
 ['original','原创部部长','minister','original'],['original2','原创部干事','member','original'],
 ['external','学生会对接人','external',null],['external2','青志部对接人','external',null],
 ['demo-admin','验收管理员','admin',null]
];
const future=hours=>new Date(Date.now()+hours*3600000).toISOString();
const title=text=>'【验收】'+text;
const notes=text=>`[${dataset}] 仅供功能验收，不作为真实历史结算。${text}`;

export async function buildAcceptanceData(db,{password}){
 // Refuse collisions instead of silently resetting real users or global routing.
 const collisions=(await db.query('SELECT username FROM users WHERE username=ANY($1::text[])',[accounts.map(a=>a[0])])).rows;
 assert.equal(collisions.length,0,'Acceptance usernames already exist; existing accounts will not be overwritten');
 for(const table of ['flow_defaults','duty_rotation'])assert.equal((await db.query('SELECT count(*)::int n FROM '+table)).rows[0].n,0,'Existing routing will not be overwritten');
 const defaults=(await db.query('SELECT * FROM publication_defaults')).rows[0];
 assert(!defaults.teacher1_id&&!defaults.teacher2_id&&!defaults.reviewer1_id&&!defaults.reviewer2_id,'Existing publication routing will not be overwritten');
 const people={},scenarios=[],attachments=[];
 for(const [username,name,role,department] of accounts){
  const userId=dataset+':'+username;
  people[username]=(await db.query(`INSERT INTO users(id,username,name,password_hash,role,department_id,payable)
   VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[userId,username,name,hashPassword(password),role,department,['member','minister'].includes(role)])).rows[0];
 }
 const uid=name=>people[name].id;
 const reviewers=[uid('minister'),uid('minister2')],teachers=[uid('teacher'),uid('teacher2')];
 await db.query('UPDATE publication_defaults SET initialized=true,teacher1_id=$1,teacher2_id=$2,reviewer1_id=$3,reviewer2_id=$4 WHERE singleton',[...teachers,...reviewers]);
 async function file(taskId,owner,name,text){
  const bytes=Buffer.from(text),id=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
  const row={id,task_id:taskId,owner_id:uid(owner),storage_name:'attachments/'+id,name,size:bytes.length,sha256};
  await db.query('INSERT INTO files(id,task_id,owner_id,storage_name,name,size,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',Object.values(row));
  attachments.push({file:row,bytes});return id;
 }
 async function remember(id,expected,hint){
  const task=await loadTask(db,id);assert.equal(task.state,expected,task.title+' state');
  await saveReportNote(db,people['demo-admin'],id,{reportNote:'验收说明：'+hint});
  scenarios.push({id,title:task.title,kind:task.kind,department:task.department_id,state:task.state,hint});return task;
 }
 async function publication(name,target,{layoutType='basic',assignee='member',external='external',linkedTaskId,open=false,urgent=false}={}){
  const creator=linkedTaskId?people.office:people[external];
  const task=await createTask(db,creator,{title:title(name),layoutType,deadline:future(urgent?20:168),
   reviewerIds:reviewers,notes:notes('供稿、采编预审、排版、运营内审、两位老师审校、发布归档。'),openRegistration:open,...(linkedTaskId?{linkedTaskId}:{})});
  if(!linkedTaskId){
   if(target==='source_pending')return remember(task.id,target,'external 提交供稿，editor 审核内容后才可排版。');
   const fid=await file(task.id,external,'活动供稿说明.txt','验收材料：活动时间、主办单位、现场照片说明。\n内容仅作测试。');
   const source=await submitSource(db,creator,task.id,{body:name+'\n活动由校学生组织发起，地点为学生活动中心。',fileIds:[fid]});
   if(target==='editorial')return remember(task.id,target,'editor/ editor2 审核兄弟组织来稿内容。');
   if(target==='source_returned'){
    await reviewTask(db,people.editor,task.id,{versionId:source.id,stage:'editorial',decision:'reject',reason:'请补充主办单位全称和活动日期。'});
    return remember(task.id,target,'external 可看到采编意见并重新提交供稿。');
   }
   await reviewTask(db,people.editor,task.id,{versionId:source.id,stage:'editorial',decision:'approve',reason:'已核对主办方、活动时间和正文内容。'});
  }
  if(target==='awaiting_assignment'){
   if(open)await registerTask(db,people.external2,task.id,{notes:'青志部报名参与联合活动，请保留联合主办信息。'});
   return remember(task.id,target,'minister 派发；此样例也可查看兄弟组织报名记录。');
  }
  await assignTask(db,people.minister,task.id,{assigneeId:uid(assignee),reviewerIds:reviewers,teacherIds:teachers});
  if(target==='awaiting_submission')return remember(task.id,target,assignee+' 交稿，部长可在交付前改派。');
  const body=name+'\n青春在校园汇聚。活动团队共同完成策划、执行与记录。\n请核对活动时间和参与人数，审核通过后再发布。';
  const version=await submitVersion(db,people[assignee],task.id,{body,previewHtml:'<article><h2>'+name+'</h2><p>青春在校园汇聚。活动团队共同完成策划、执行与记录。</p><p>请核对活动时间和参与人数，审核通过后再发布。</p></article>'});
  if(target==='internal')return remember(task.id,target,'minister 或 minister2 任一确认即可送老师一审。');
  await reviewTask(db,people.minister2,task.id,{versionId:version.id,stage:'internal',decision:'approve',reason:'两位运营部长已沟通，任一确认送审。'});
  if(target==='teacher1'||target==='returned'){
   const current=await loadTask(db,task.id),quote='活动时间',text=current.version.preview_html.replace(/<[^>]+>/g,'');
   const start=text.indexOf(quote);
   await addAnnotation(db,people.teacher,task.id,{versionId:version.id,start,end:start+quote.length,quote,body:'请写明具体日期，统一全篇的时间表述。'});
   if(target==='returned')await reviewTask(db,people.teacher,task.id,{versionId:version.id,stage:'teacher1',decision:'reject',reason:''});
   return remember(task.id,target,target==='returned'?'member 按文中批注修改后重新提交，保留旧版意见。':'teacher 选中文字批注，然后通过或退回。');
  }
  await reviewTask(db,people.teacher,task.id,{versionId:version.id,stage:'teacher1',decision:'approve',reason:'一审已完成事实和措辞核对。'});
  if(target==='teacher2')return remember(task.id,target,'teacher2 独立二审；teacher 无法替代其审批。');
  await reviewTask(db,people.teacher2,task.id,{versionId:version.id,stage:'teacher2',decision:'approve',reason:'二审通过，同意发布。'});
  if(target==='awaiting_publish')return remember(task.id,target,assignee+' 填正式发布链接后自动归档并生成内部工时。');
  await publishTask(db,people[assignee],task.id,{versionId:version.id,url:'https://example.org/acceptance/'+task.id});
  return remember(task.id,'archived','示例发布链接为占位地址；检查归档、两位老师记录和内部工时。');
 }
 for(const [name,state,options] of [
  ['社团嘉年华｜等待供稿','source_pending'],['劳动教育月｜供稿补充材料','source_returned'],
  ['校园文化节开幕报道','editorial'],['联合团支书培训会｜待安排','awaiting_assignment',{open:true}],
  ['校运会｜排版待交稿','awaiting_submission'],['商学院赛场纪实｜部长内审','internal'],
  ['逛一所校园｜秋日影像志','teacher1',{layoutType:'photo'}],['研途盲盒｜毕业条件指南','teacher2'],
  ['志愿服务月｜等待发布','awaiting_publish',{layoutType:'repost'}],['迎新专题｜按批注修改','returned'],
  ['新生图鉴｜已发布归档','archived'],['摄影特辑｜已归档','archived',{layoutType:'photo',assignee:'member2'}],
  ['青年说｜加急转载归档','archived',{layoutType:'repost',urgent:true}]
 ])await publication(name,state,options);

 async function job(name,input,target,{creator='external',manager,assignee,teacherReview=false,reject=false}={}){
  const t=await createJob(db,people[creator],{title:title(name),notes:notes('可以继续操作本任务，检查派发、交付、验收与工时。'),...input});
  if(target==='awaiting_assignment')return remember(t.id,target,'由对应部门部长派发；摄制未派单时也可由干事抢单。');
  const role=manager||({office:'office',editorial:'editor',photography:'photo',art:'art',original:'original',operations:'minister'}[input.departmentId]??(input.kind==='photo'?'photo':input.kind==='design'?'art':'office'));
  await jobAction(db,people[role],t.id,'assign',{assigneeId:uid(assignee)});
  if(target==='awaiting_submission')return remember(t.id,target,assignee+' 提交成果，保留任务备注。');
  if(target==='forced'){
   await jobAction(db,people[role],t.id,'force-archive',{reason:'验收样例：活动取消，保留任务记录，不自动发放工时。'});
   return remember(t.id,'archived','强制关闭：工时应为零。');
  }
  const fid=await file(t.id,assignee,'交付说明.txt',name+'\n验收成果：已整理材料、完成校核，请部长验收。');
  let current=await jobAction(db,people[assignee],t.id,'submit',{body:'验收成果：已整理材料并完成校核，详见附件。',fileIds:[fid]});
  if(teacherReview){
   if(target==='content')return remember(t.id,target,'teacher 先审内容；通过后 office2 再提交最终挂网成果。');
   await jobAction(db,people.teacher,t.id,'content',{versionId:current.version.id,decision:'approve',reason:'老师已审核稿件内容。'});
   current=await jobAction(db,people[assignee],t.id,'submit',{body:'内容审核后，三个网站的挂网记录已整理完成。',fileIds:[fid]});
  }
  if(target==='acceptance')return remember(t.id,target,role+' 核对成果后验收，自动归档。');
  if(reject||target==='returned'){
   await jobAction(db,people[role],t.id,'acceptance',{versionId:current.version.id,decision:'reject',reason:'请补全最终成果说明并重新提交。'});
   return remember(t.id,'returned',assignee+' 修改成果后再次交付。');
  }
  await jobAction(db,people[role],t.id,'acceptance',{versionId:current.version.id,decision:'approve',reason:'验收完成，成果材料齐全。'});
  return remember(t.id,'archived','正常完成自动归档；教师与外部发起人不计工时。');
 }
 const web={kind:'web_article',lines:[{title:'校园文化节开幕新闻',original:true,authorId:uid('writer')},{title:'校级通知转载',site:'院网',original:false}],reviewerIds:[uid('editor'),uid('editor2'),uid('teacher')],teacherId:uid('teacher')};
 await job('新闻挂网｜待办公部承接',web,'awaiting_assignment',{creator:'writer'});
 await job('新闻挂网｜等待老师内容审校',web,'content',{creator:'writer',assignee:'office2',teacherReview:true});
 await job('新闻挂网｜待验收',web,'acceptance',{creator:'writer',assignee:'office2',teacherReview:true});
 const linked=await job('新闻挂网｜三站已完成',web,'archived',{creator:'writer',assignee:'office2',teacherReview:true});
 await publication('校园文化节｜挂网关联推文','awaiting_submission',{linkedTaskId:linked.id});

 const photo={kind:'photo',deadline:future(96),location:'学生活动中心',contact:'验收联系人（非真实联系方式）'};
 await job('讲座摄影｜可抢单',{...photo},'awaiting_assignment');
 await job('体育节摄影｜待交付',{...photo},'awaiting_submission',{assignee:'photo2'});
 await job('合唱比赛｜待验收',{...photo},'acceptance',{assignee:'photo3'});
 await job('校园舞台｜照片需补充',{...photo},'returned',{assignee:'photo2'});
 await job('晚会摄制｜加急完成',{...photo,deadline:future(18),urgentReason:'临时确定的校园晚会拍摄，预约距活动不足48小时。'},'archived',{assignee:'photo3'});
 await job('讲坛纪实｜普通完成',{...photo},'archived',{assignee:'photo2'});
 const forced=await job('活动取消｜强制关闭',{...photo},'forced',{assignee:'photo2'});

 await job('志愿服务海报｜待安排',{kind:'design',complexity:'basic'},'awaiting_assignment');
 await job('读书节海报｜待交付',{kind:'design',complexity:'basic'},'awaiting_submission',{assignee:'art2'});
 await job('原创栏目封面｜待验收',{kind:'design',complexity:'basic'},'acceptance',{assignee:'art2'});
 await job('海报修改｜已退回',{kind:'design',complexity:'basic'},'returned',{assignee:'art2'});
 await job('讲座海报｜基础设计归档',{kind:'design',complexity:'basic'},'archived',{assignee:'art2'});
 await job('年度专题｜复杂设计归档',{kind:'design',complexity:'complex'},'archived',{assignee:'art2'});
 await job('校园文化节｜大型设计归档',{kind:'design',complexity:'large'},'archived',{assignee:'art2'});
 await job('书推栏目｜待采编验收',{kind:'request',departmentId:'editorial',ruleId:3},'acceptance',{assignee:'writer'});
 await job('纪录时刻｜视频归档',{kind:'request',departmentId:'editorial',ruleId:6},'archived',{assignee:'writer'});
 await job('迎新活动｜办公策划归档',{kind:'request',departmentId:'office',ruleId:14},'archived',{assignee:'office2'});
 await job('原创选题｜等待承接',{kind:'request',departmentId:'original'},'awaiting_assignment',{creator:'original'});
 const original=await job('青年访谈｜原创成品归档',{kind:'request',departmentId:'original'},'archived',{creator:'original',assignee:'original2'});
 for(const [person,ruleId,hours,label,linkedTaskId] of [
  ['office2',15,null,'活动组织周登记'],['writer',7,null,'纪录时刻周登记'],['member2',21,null,'排版周登记'],
  ['photo2',18,null,'摄制周登记'],['art2',9,null,'美编周登记'],['original2',null,4.5,'原创访谈补登记',original.id],
  ['art',null,1.5,'复杂设计审校补登记']
 ]){
  const entry=await createJob(db,people[person],{kind:'work_entry',title:title(label),notes:notes('人工登记或规则登记，须由部长核定。'),personId:uid(person),week:48,
   ...(ruleId?{ruleId}:{hours}),...(linkedTaskId?{linkedTaskId}:{})});
  await remember(entry.id,'recorded','部长在工时报表核定；规则工时和核定工时分别保留。');
 }
 const logs=(await db.query('SELECT * FROM worklogs WHERE user_id LIKE $1 ORDER BY created_at,id',[dataset+':%'])).rows;
 const changed=logs.find(l=>l.department_id==='operations'&&l.kind==='creator');
 await adjust(db,people.minister,changed.id,{hours:changed.effective_units/10000+1,reason:'验收样例：补做手机端适配和素材整理，核增1小时。'});
 for(const log of logs.filter(l=>l.id!==changed.id).slice(0,12))await adjust(db,people['demo-admin'],log.id,{hours:log.effective_units/10000,reason:'验收样例：对照成果确认规则工时。'});
 const today=new Date().toISOString().slice(0,10);
 const sealed=await seal(db,people.office,{name:'【验收】本期工时封存样例',from:today,to:new Date(Date.now()+86400000).toISOString().slice(0,10)});
 // A later change proves the stored seal remains unchanged.
 await adjust(db,people.minister,changed.id,{hours:changed.effective_units/10000+1.5,reason:'验收样例：封存后补计0.5小时，旧封存保持原样。'});
 await saveView(db,people.office,{name:'验收 · 全中心按部门汇总',config:{group:'department',sort:'hours',columns:['name','department','title','base','hours','amount','taskNote','adjustmentNote']}});
 await saveView(db,people.minister,{name:'验收 · 运营待核定',config:{status:'pending',department:'operations',columns:['name','title','base','hours','amount','status','taskNote','adjustmentNote']}});
 await db.transaction(tx=>saveFlowDefault(tx,people.office,'office','web_article',uid('office2')));
 const automatic=await createJob(db,people.writer,{...web,title:title('固定对接｜自动分配办公干事'),notes:notes('固定默认承接样例。')});
 await remember(automatic.id,'awaiting_submission','已自动分配 office2；可在交付前改派或取消默认值。');
 await saveRotation(db,people.photo,{departmentId:'photography',personIds:[uid('photo2'),uid('photo3')]});
 for(let n=1;n<=2;n++){
  const rotated=await createJob(db,people.external,{...photo,title:title('顺序轮值｜第'+n+'单'),notes:notes('按任务顺序轮转，不按时间段排班。')});
  const t=await remember(rotated.id,'awaiting_submission','依次派给 photo2、photo3，下一单回到 photo2。');
  assert.equal(t.assignee_id,uid(n===1?'photo2':'photo3'));
 }
 const saved=await saveView(db,people['demo-admin'],{name:'验收数据 v1',config:{search:'【验收】',columns:['name','department','title','base','hours','taskNote','adjustmentNote']}});
 await db.query('UPDATE saved_views SET id=$1 WHERE id=$2',[marker,saved.id]);
 assert.equal((await db.query("SELECT count(*)::int n FROM worklogs w JOIN users u ON u.id=w.user_id WHERE u.id LIKE $1 AND (NOT u.payable OR u.role IN('teacher','external','admin'))",[dataset+':%'])).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM worklogs WHERE task_id=$1',[forced.id])).rows[0].n,0);
 assert.equal(new Set(scenarios.map(s=>s.department)).size,6);
 return {dataset,accounts:accounts.map(([username,name,role,department])=>({username,name,role,department,id:uid(username)})),scenarios,attachments,sealId:sealed.id,adjustedLogId:changed.id};
}
