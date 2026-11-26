import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import request from 'supertest';
import ExcelJS from 'exceljs';
import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';
import {seed} from '../server/seed.js';
import {createJob} from '../server/jobs.js';
import {initializeProduction} from '../server/production.js';
import {scheduleReminders,deliverNotifications} from '../server/notifications.js';

let db,api;
const tokens=new Map();
const future=h=>new Date(Date.now()+h*3600000).toISOString();
before(async ()=>{
 db=await openDatabase({memory:true,url:null});
 await seed(db);
 api=request(createApp(db));
});
after(async ()=>{await db?.close();});

async function call(user,method,path,body,status=200){
 if(!tokens.has(user)){
  const login=await api.post('/api/v1/auth/login').set('X-Client','miniprogram').send({username:user,password:'Youth2026!'}).expect(200);
  tokens.set(user,login.body.token);
 }
 const req=api[method]('/api/v1'+path).set('Authorization','Bearer '+tokens.get(user));
 if(body!==undefined)req.send(body);
 return (await req.expect(status)).body;
}
const create=(user,body,status=201)=>call(user,'post','/tasks',body,status);
const get=(user,id,status=200)=>call(user,'get','/tasks/'+id,undefined,status);
const action=(user,id,a,body,status=200)=>call(user,'post','/tasks/'+id+'/actions/'+a,body,status);
const assign=(user,id,person)=>action(user,id,'assign',{assigneeId:person});
const submit=(user,id,body='成果交付说明')=>action(user,id,'submit',{body});
const accept=(user,t,extra={},status=200)=>action(user,t.id,'acceptance',{versionId:t.version.id,decision:'approve',...extra},status);
const logs=async id=>(await db.query('SELECT * FROM worklogs WHERE task_id=$1 ORDER BY kind,source_key,user_id',[id])).rows;

test('生产启动初始化独立账号，附件由数据库持久保存',async()=>{
 const isolated=await openDatabase({memory:true,url:null});
 try{
  await assert.rejects(initializeProduction(isolated,{}),/First startup/);
  const password='test-only-password-generated';
  await initializeProduction(isolated,{BOOTSTRAP_ADMIN_USERNAME:'release-admin',BOOTSTRAP_ADMIN_PASSWORD:password});
  await initializeProduction(isolated,{});
  const client=request(createApp(isolated,{production:true}));
  const login=await client.post('/api/v1/auth/login').set('X-Client','miniprogram')
   .send({username:'release-admin',password}).expect(200);
  assert.match(login.headers['set-cookie'][0],/Secure/);
  const auth='Bearer '+login.body.token;
  const task=await client.post('/api/v1/tasks').set('Authorization',auth)
   .send({kind:'design',title:'云端附件测试',complexity:'basic'}).expect(201);
  const content=Buffer.from('青年传媒中心生产存储验证');
  const upload=await client.post('/api/v1/tasks/'+task.body.id+'/files').set('Authorization',auth)
   .attach('file',content,'material.txt').expect(201);
  const anotherInstance=request(createApp(isolated,{production:true}));
  const download=await anotherInstance.get('/api/v1/files/'+upload.body.id).set('Authorization',auth).expect(200);
  assert.deepEqual(download.body,content);
  assert.deepEqual((await isolated.query('SELECT username FROM users')).rows,[{username:'release-admin'}]);
 }finally{await isolated.close();}
});

test('挂网逐篇逐网站计发，内容审校和成果验收独立，推文有来源',async ()=>{
 const {id}=await create('editor',{kind:'web_article',title:'校报投稿',reviewerIds:['editor','editor2','teacher'],teacherId:'teacher',
  lines:[{title:'同一篇文章',site:'升华网',original:true,authorId:'writer'},{title:'同一篇文章',site:'学工网',original:true,authorId:'writer'}]});
 await get('photo',id,403);
 await assign('office',id,'office2');
 await action('office2',id,'submit',{},422);
 let task=await submit('office2',id,'待审核稿件');
 assert.equal(task.state,'content');
 await accept('office',task,{},409);
 await action('teacher',id,'content',{versionId:task.version.id,decision:'approve'});
 task=await submit('office2',id,'两站均发布');
 assert.equal(task.version.number,2);
 await accept('editor',task);
 await accept('office',task);
 assert.equal((await get('editor',id)).task.state,'archived');
 const ledger=await logs(id);
 assert.deepEqual(ledger.map(x=>x.effective_units),[40000,40000,50000,50000,10000,10000]);
 assert.equal(ledger.filter(x=>x.user_id==='teacher').length,0);
 assert.match(ledger[0].source_key,/学工网|升华网/);
 const linked=await create('editor',{kind:'publication',title:'校报推文',layoutType:'basic',deadline:future(100),linkedTaskId:id});
 const published=await get('member',linked.id);
 assert.equal(published.linked[0].id,id);
 assert.equal((await logs(linked.id)).length,0);
 await create('editor',{kind:'publication',title:'重复关联',layoutType:'basic',deadline:future(100),linkedTaskId:id},409);
});

test('摄制 48 小时边界、抢单并发、退回及加急只乘创作者',async ()=>{
 const now=new Date(),external=(await db.query("SELECT * FROM users WHERE id='external'")).rows[0];
 const entry={kind:'photo',title:'摄制预约',location:'校礼堂',contact:'项目对接人'};
 const {id:ordinary}=await createJob(db,external,{...entry,deadline:new Date(+now+48*3600000).toISOString()},{now});
 assert.equal((await get('photo',ordinary)).task.urgent,false);
 await assign('photo',ordinary,'photo3');
 await accept('photo',await submit('photo3',ordinary));
 assert.deepEqual((await logs(ordinary)).map(x=>x.effective_units),[40000,20000]);

 const {id}=await create('external',{...entry,deadline:future(30)});
 assert.equal((await get('external',id)).task.urgent,true);
 for(const user of ['photo2','photo3'])await get(user,id);
 const raced=await Promise.all(['photo2','photo3'].map(user=>
  api.post('/api/v1/tasks/'+id+'/actions/claim').set('Authorization','Bearer '+tokens.get(user)).send({})
 ));
 assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
 const winner=raced.find(r=>r.status===200).body.assignee_id;
 await action('photo',id,'assign',{assigneeId:'photo2'},409);
 const first=await submit(winner,id);
 await accept('photo',first,{decision:'reject',reason:'请补广角图'});
 const second=await submit(winner,id);
 await accept('photo',first,{},409);
 await accept('photo',second);
 assert.deepEqual((await logs(id)).map(x=>[x.base_units,x.effective_units,x.rate_cents]),[[40000,60000,1000],[20000,20000,1000]]);
 assert.equal((await call('photo','get','/worklogs')).find(row=>row.task_id===id&&row.kind==='creator').adjustmentNote,'系统加急 ×1.5');
});

test('外部可选六部，美编三档独立规则，原创允许补登记',async ()=>{
 for(const [dept,minister,worker,rule] of [
  ['office','office','office2',14],['editorial','editor','writer',1],['operations','minister','member',21],
  ['photography','photo','photo2',18],['art','art','art2',9],['original','original','original2',undefined]
 ]){
  const {id}=await create('external',{kind:'request',title:'部门支持 '+dept,departmentId:dept,ruleId:rule});
  await assign(minister,id,worker);
  await accept(minister,await submit(worker,id));
  assert.equal((await get('external',id)).task.state,'archived');
  assert.equal((await get('external',id)).contributions.length,0);
  const ledger=await logs(id);
  assert.equal(ledger.length,rule?2:1);
  assert.equal(ledger.at(-1).user_id,minister);
  assert.equal(ledger.at(-1).effective_units,20000);
  if(!rule){
   const {id:entry}=await create(worker,{kind:'work_entry',title:'原创补登记',personId:worker,hours:2.25,week:5,linkedTaskId:id});
   assert.equal((await logs(entry))[0].effective_units,22500);
   await create(worker,{kind:'work_entry',title:'重复补登记',personId:worker,hours:2,week:5,linkedTaskId:id},409);
  }
 }
 for(const [size,hours,reviewHours] of [['basic',3,2],['complex',6,0],['large',9,2]]){
  const {id}=await create('member',{kind:'design',title:'海报设计 '+size,complexity:size});
  await assign('art',id,'art2');
  await accept('art',await submit('art2',id));
  assert.deepEqual((await logs(id)).map(x=>x.effective_units/10000),reviewHours?[hours,reviewHours]:[hours]);
 }
 const {id}=await create('external',{kind:'request',title:'系统管理员代审',departmentId:'operations',ruleId:21});
 await assign('admin',id,'member');
 await accept('admin',await submit('member',id));
 assert.deepEqual((await logs(id)).map(r=>r.user_id),['member']);
});

test('工时登记校验、跨部隔离、规则版次和封存快照',async ()=>{
 const input={kind:'work_entry',title:'会务补登记',personId:'member',week:10,hours:2.5};
 await create('member',{...input,hours:0},422);
 await create('member',{...input,week:54},422);
 await create('member',{...input,personId:'member2'},403);
 const {id}=await create('member',input);
 await get('member2',id,403);
 const log=(await logs(id))[0];
 const records=await call('office','get','/worklogs?week=10&department=operations');
 assert.equal(records.find(r=>r.id===log.id).week,10);
 await call('member2','patch','/tasks/'+id+'/report-note',{reportNote:'越权备注'},403);
 await call('member','patch','/tasks/'+id+'/report-note',{reportNote:'整理了现场物料'});
 await call('office','patch','/worklogs/'+log.id,{hours:3,reason:'跨部核定禁止'},403);
 await call('minister','patch','/worklogs/'+log.id,{hours:3,reason:'补记准备时间'});
 assert.equal((await logs(id))[0].effective_units,30000);
 await call('minister','patch','/worklogs/'+log.id,{hours:3,reason:'确认无误'});
 const today=new Date();
 const from=new Date(+today-86400000).toISOString().slice(0,10),to=new Date(+today+86400000).toISOString().slice(0,10);
 const seal=await call('office','post','/reports/seals',{name:'改规则前',from,to},201);
 await call('minister','patch','/worklogs/'+log.id,{hours:3.5,reason:'重新复核'});
 const snapshot=(await db.query('SELECT data FROM seal_rows WHERE seal_id=$1 AND source_id=$2',[seal.id,log.id])).rows[0].data;
 assert.equal(snapshot.hours,3);
 assert.equal(snapshot.adjustmentNote,'补记准备时间');
 await call('minister','patch','/tasks/'+id+'/report-note',{reportNote:'归档后补充'});
 async function excelRow(path){
  const file=await api.get('/api/v1'+path).set('Authorization','Bearer '+tokens.get('office'))
   .buffer(true).parse((res,done)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));res.on('error',done);}).expect(200);
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(file.body);
  const sheet=wb.getWorksheet(1);let found;
  sheet.eachRow(row=>{if(row.getCell(4).value===input.title)found=row;});
  assert.ok(found);assert.equal(sheet.getRow(1).getCell(14).value,'工时核定备注');
  return [found.getCell(8).value,found.getCell(13).value,found.getCell(14).value];
 }
 assert.deepEqual(await excelRow('/reports/export?week=10'),[3.5,'归档后补充','重新复核']);
 assert.deepEqual(await excelRow('/reports/seals/'+seal.id+'/export'),[3,'整理了现场物料','补记准备时间']);
 const options=await call('admin','get','/workflow/options');
 assert.equal(options.rules.length,24);
 const data={expectedVersion:options.policy.version,rateCents:1100,urgentFactor:16000,photoWindow:36,publicationWindow:48,reason:'测试新价目'};
 await call('minister','patch','/workflow/policy',data,403);
 await call('admin','patch','/workflow/policy',{...data,rules:[{id:24,hours:4}]},422);
 const next=await call('admin','patch','/workflow/policy',{...data,rules:[{id:21,hours:5}]});
 assert.equal((await logs(id))[0].rate_cents,1000);
 const fresh=await create('member',{...input,ruleId:21,hours:undefined});
 assert.deepEqual((await logs(fresh.id)).map(r=>[r.base_units,r.rate_cents,r.rule_version]),[[50000,1100,next.version]]);
});

test('临期与逾期去重、通知失败重试、强制归档零工时',async ()=>{
 const deadline=future(20);
 const {id}=await create('external',{kind:'photo',title:'即将到期的预约',location:'报告厅',contact:'小陈',deadline,reminderHours:5});
 assert.equal((await get('photo',id)).task.state,'awaiting_assignment');
 const due=new Date(+new Date(deadline)-3600000);
 await scheduleReminders(db,due);await scheduleReminders(db,due);
 await assign('photo',id,'photo3');
 const overdue=new Date(+new Date(deadline)+1);
 await scheduleReminders(db,overdue);await scheduleReminders(db,overdue);
 const reminders=(await db.query("SELECT id,event,recipient_id FROM outbox WHERE task_id=$1 AND event LIKE 'reminder:%' ORDER BY event",[id])).rows;
 assert.deepEqual(reminders.map(r=>[r.event,r.recipient_id]),[['reminder:due','photo'],['reminder:overdue','photo3']]);
 await db.query("UPDATE outbox SET status='sent' WHERE id!=$1",[reminders[0].id]);
 const sendCalls=[];
 await deliverNotifications(db,'http://local-test.invalid',undefined,{send:async(url,options)=>{
  sendCalls.push(options.headers['Idempotency-Key']);return new Response(null,{status:503});
 }});
 const attempt=(await db.query('SELECT status,attempts FROM outbox WHERE id=$1',[reminders[0].id])).rows[0];
 assert.deepEqual(attempt,{status:'failed',attempts:1});
 await db.query('UPDATE outbox SET next_attempt=now() WHERE id=$1',[reminders[0].id]);
 await deliverNotifications(db,'http://local-test.invalid',undefined,{send:async(url,options)=>{
  sendCalls.push(options.headers['Idempotency-Key']);return new Response(null,{status:200});
 }});
 assert.deepEqual(sendCalls,[reminders[0].id,reminders[0].id]);
 assert.equal((await db.query('SELECT status FROM outbox WHERE id=$1',[reminders[0].id])).rows[0].status,'sent');
 await action('photo3',id,'force-archive',{reason:'测试越权'},403);
 await action('photo',id,'force-archive',{reason:'原承接人离任'});
 assert.equal((await get('photo',id)).task.archive_reason,'原承接人离任');
 assert.deepEqual(await logs(id),[]);
});

test('新任务顺序轮值，默认承接优先，失效跳过，无名单可抢单',async()=>{
 const input={departmentId:'photography',personIds:['photo2','photo3']};
 const photo={kind:'photo',title:'轮值任务',location:'现场',contact:'小陈',deadline:future(28)};
 await call('office','put','/workflow/duty',input,403);
 await call('photo','put','/workflow/duty',{...input,personIds:['photo3','photo3']},422);
 await call('photo','put','/workflow/duty',input);
 const one=await create('external',{...photo,deadline:future(72)});
 const two=await create('external',{...photo,deadline:future(24)});
 const three=await create('external',{...photo,deadline:future(36)});
 const taskOf=async task=>(await get('photo',task.id)).task;
 assert.deepEqual(await Promise.all([one,two,three].map(async task=>(await taskOf(task)).assignee_id)),['photo2','photo3','photo2']);
 assert.ok((await get('photo',one.id)).events.some(event=>event.action==='按轮值顺序派发'));
 await action('photo',one.id,'assign',{assigneeId:'photo2',remember:true});
 assert.equal((await taskOf(await create('external',photo))).assignee_id,'photo2');
 assert.equal((await call('photo','get','/workflow/duty')).nextId,'photo3');
 await call('photo','delete','/workflow/defaults/photography/photo');
 await db.query("UPDATE users SET active=false WHERE id='photo3'");
 try{assert.equal((await taskOf(await create('external',photo))).assignee_id,'photo2');}
 finally{await db.query("UPDATE users SET active=true WHERE id='photo3'");}
 const pair=await Promise.all([create('external',photo),create('external',photo)]);
 assert.deepEqual((await Promise.all(pair.map(async task=>(await taskOf(task)).assignee_id))).sort(),['photo2','photo3']);
 await call('photo','put','/workflow/duty',{...input,personIds:[]});
 assert.equal((await taskOf(await create('external',photo))).state,'awaiting_assignment');
});

test('办公挂网承接可设默认、逐单覆盖，取消只影响后续任务',async ()=>{
 const make=()=>create('editor',{kind:'web_article',title:'办公对接默认承接',reviewerIds:['editor'],
  lines:[{title:'校园报道',site:'院网',original:true,authorId:'writer'}]});
 const one=await make();
 const assignBody={assigneeId:'office2',remember:true};
 await action('editor',one.id,'assign',assignBody,403);
 await action('office',one.id,'assign',assignBody);
 const second=await make();
 const initial=(await get('office',second.id)).task;
 assert.equal(initial.assignee_id,'office2');
 assert.equal(initial.automatic,true);
 assert.equal(initial.state,'awaiting_submission');
 await assign('office',second.id,'office');
 let changed=(await get('office',second.id)).task;
 assert.equal(changed.assignee_id,'office');
 assert.equal(changed.automatic,false);
 const third=await make();
 assert.equal((await get('office',third.id)).task.assignee_id,'office2');
 await call('editor','delete','/workflow/defaults/office/web_article',undefined,403);
 await call('office','delete','/workflow/defaults/office/web_article');
 const fourth=await make();
 assert.equal((await get('office',fourth.id)).task.state,'awaiting_assignment');
 changed=(await get('office',third.id)).task;
 assert.equal(changed.assignee_id,'office2');
});
