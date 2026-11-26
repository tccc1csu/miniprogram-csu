import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {openDatabase} from '../server/db.js';
import {seed} from '../server/seed.js';
import {createApp} from '../server/app.js';
let db,app,dir;const agents={};
before(async()=>{dir=await mkdtemp(path.join(tmpdir(),'youth-tests-'));db=await openDatabase({memory:true});await seed(db);app=createApp(db,{uploadDir:dir});
for(const username of ['external','external2','minister','minister2','member','member2','teacher','teacher2','office','editor','photo','admin']){
const a=request.agent(app);const r=await a.post('/api/v1/auth/login').send({username,password:'Youth2026!'});assert.equal(r.status,200);agents[username]=a;}});
after(async()=>{await db?.close();if(dir)await rm(dir,{recursive:true,force:true});});
const post=(who,url,data)=>agents[who].post('/api/v1'+url).set('X-Requested-With','workbench').send(data);
async function create({openRegistration=false,withSource=true}={}){
const r=await post('external','/tasks',{title:'九院联合活动 · 测试',layoutType:'basic',deadline:new Date(Date.now()+24*3600000).toISOString(),openRegistration,notes:'完整流程验证'});assert.equal(r.status,201,JSON.stringify(r.body));
if(withSource){
 const id=r.body.id;
 const source=await post('external','/tasks/'+id+'/source',{body:'组织初稿'});
 assert.equal(source.status,201,JSON.stringify(source.body));
 const reviewed=await post('editor','/tasks/'+id+'/reviews',{stage:'editorial',decision:'approve',versionId:source.body.id});
 assert.equal(reviewed.status,200,JSON.stringify(reviewed.body));
}
return r.body.id;}
async function assigned(){
const id=await create();assert.equal((await post('minister',`/tasks/${id}/assign`,{assigneeId:'member',reviewerIds:['minister','minister2']})).status,200);return id;}
async function reviewReady(){
const id=await assigned();const v=await post('member',`/tasks/${id}/versions`,{body:'正式稿正文：活动圆满完成。',previewUrl:'https://example.com/preview',fileIds:[]});assert.equal(v.status,201,JSON.stringify(v.body));
const versionId=v.body.id;
for(const [who,stage]of [['minister','internal'],['teacher','teacher1'],['teacher2','teacher2']]){
const r=await post(who,`/tasks/${id}/reviews`,{stage,decision:'approve',reason:'审核通过',versionId});assert.equal(r.status,200,JSON.stringify(r.body));}
return {id,versionId};}
test('完整发布自动归档；十次并发重试仍只计4+1+1h，老师外部无工时',async()=>{
const {id,versionId}=await reviewReady();
assert.equal((await db.query('SELECT * FROM worklogs WHERE task_id=$1',[id])).rows.length,0);
const results=await Promise.all(Array.from({length:10},()=>post('member',`/tasks/${id}/publish`,{url:'https://example.com/published',versionId})));
for(const r of results)assert.equal(r.status,200,JSON.stringify(r.body));
const logs=(await db.query('SELECT * FROM worklogs WHERE task_id=$1 ORDER BY base_units DESC',[id])).rows;
assert.deepEqual(logs.map(x=>x.base_units),[40000,10000,10000]);assert.ok(logs.every(x=>!['teacher','teacher2','external','admin'].includes(x.user_id)));
assert.equal(logs.reduce((n,x)=>n+Math.round(x.effective_units*x.rate_cents/10000),0),6000);
assert.equal((await db.query('SELECT * FROM archives WHERE task_id=$1',[id])).rows.length,1);
assert.equal((await post('member',`/tasks/${id}/versions`,{body:'恶意覆盖'})).status,409);
assert.equal((await post('member',`/tasks/${id}/publish`,{url:'https://example.com/different',versionId})).status,409);
});
test('越权派发、非法跳审、退回原因和旧版审批拒绝',async()=>{
const id=await create();assert.equal((await post('photo',`/tasks/${id}/assign`,{assigneeId:'member',reviewerIds:['minister','minister2']})).status,403);
assert.equal((await post('minister',`/tasks/${id}/assign`,{assigneeId:'photo',reviewerIds:['minister','minister2']})).status,422);
await post('minister',`/tasks/${id}/assign`,{assigneeId:'member',reviewerIds:['minister','minister2']});
let v=await post('member',`/tasks/${id}/versions`,{body:'初稿'});
assert.equal((await post('teacher2',`/tasks/${id}/reviews`,{stage:'teacher2',decision:'approve',versionId:v.body.id})).status,409);
assert.equal((await post('minister',`/tasks/${id}/reviews`,{stage:'internal',decision:'reject',reason:'',versionId:v.body.id})).status,422);
assert.equal((await post('minister',`/tasks/${id}/reviews`,{stage:'internal',decision:'reject',reason:'请补活动时间',versionId:v.body.id})).status,200);
const old=v.body.id;v=await post('member',`/tasks/${id}/versions`,{body:'修改稿'});
assert.equal((await post('minister',`/tasks/${id}/reviews`,{stage:'internal',decision:'approve',versionId:old})).status,409);
assert.equal((await agents.external2.get('/api/v1/tasks/'+id)).status,403);
});
test('报名严格范围、重复防护与加急仅乘创作工时',async()=>{
const id=await create({openRegistration:true});
await post('minister',`/tasks/${id}/assign`,{assigneeId:'member',reviewerIds:['minister','minister2']});
const first=await post('external2',`/tasks/${id}/register`,{notes:'补充资料',fileIds:[]});assert.equal(first.status,201);
assert.equal((await post('external2',`/tasks/${id}/register`,{notes:'重复'})).status,409);
assert.equal((await agents.member.get('/api/v1/tasks/'+id)).body.task.urgent,true);
const other=await assigned();assert.equal((await post('external2',`/tasks/${other}/register`,{})).status,403);
});
test('归档事务注入故障时发布、档案、工时全部回滚',async()=>{
const {id,versionId}=await reviewReady();
const broken={...db,transaction:fn=>db.transaction(tx=>fn({...tx,query:(sql,args)=>{if(sql.startsWith('INSERT INTO worklogs'))throw new Error('injected ledger failure');return tx.query(sql,args);}}))};
const failing=request.agent(createApp(broken,{uploadDir:dir,quiet:true}));
await failing.post('/api/v1/auth/login').send({username:'member',password:'Youth2026!'});
assert.equal((await failing.post('/api/v1/tasks/'+id+'/publish').set('X-Requested-With','workbench').send({url:'https://example.com/failure',versionId})).status,500);
for(const table of ['archives','publications','worklogs'])assert.equal((await db.query('SELECT * FROM '+table+' WHERE task_id=$1',[id])).rows.length,0);
});
test('核定审计、筛选导出和封存快照一致',async()=>{
const {id,versionId}=await reviewReady();await post('member',`/tasks/${id}/publish`,{url:'https://example.com/report',versionId});
const log=(await db.query("SELECT * FROM worklogs WHERE task_id=$1 AND user_id='member'",[id])).rows[0];
assert.equal((await agents.photo.patch('/api/v1/worklogs/'+log.id).set('X-Requested-With','workbench').send({hours:6,reason:'越权'})).status,403);
assert.equal((await agents.minister.patch('/api/v1/worklogs/'+log.id).set('X-Requested-With','workbench').send({hours:5.5,reason:'多次修改'})).status,200);
assert.equal((await agents.minister.get('/api/v1/worklogs/'+log.id+'/adjustments')).body.length,1);
const dates={from:'2020-01-01',to:'2099-12-31',name:'学期封存'};
const seal=await post('office','/reports/seals',dates);assert.equal(seal.status,201,JSON.stringify(seal.body));
const before=(await db.query('SELECT data FROM seal_rows WHERE seal_id=$1 ORDER BY source_id',[seal.body.id])).rows;
await agents.minister.patch('/api/v1/worklogs/'+log.id).set('X-Requested-With','workbench').send({hours:6,reason:'复核补充'});
const after=(await db.query('SELECT data FROM seal_rows WHERE seal_id=$1 ORDER BY source_id',[seal.body.id])).rows;assert.deepEqual(after,before);
const exported=await agents.office.get('/api/v1/reports/export?member=member&status=confirmed').buffer(true).parse((res,cb)=>{const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>cb(null,Buffer.concat(chunks)));});
assert.equal(exported.status,200);const wb=new ExcelJS.Workbook();await wb.xlsx.load(exported.body);assert.equal(wb.worksheets[0].getRow(2).getCell(1).value,'许星禾');
assert.equal((await agents.external.get('/api/v1/worklogs')).status,403);
assert.equal((await agents.teacher.get('/api/v1/reports/seals')).status,403);
const view=await post('office','/views',{name:'常用视图',config:{member:'member',status:'confirmed',columns:['name','hours'],group:'name'}});assert.equal(view.status,201);
assert.equal((await agents.office.get('/api/v1/views')).body[0].config.member,'member');
});
test('文件上传、归档关联及跨账号下载保护',async()=>{
const id=await assigned();
const upload=await agents.member.post('/api/v1/tasks/'+id+'/files').set('X-Requested-With','workbench').attach('file',Buffer.from('真实持久成果内容'),'稿件.txt');assert.equal(upload.status,201,JSON.stringify(upload.body));
assert.equal((await agents.external2.get('/api/v1/files/'+upload.body.id)).status,403);
assert.equal((await agents.minister.get('/api/v1/files/'+upload.body.id)).status,200);
const v=await post('member',`/tasks/${id}/versions`,{body:'',fileIds:[upload.body.id]});assert.equal(v.status,201);
assert.equal((await agents.member.post('/api/v1/tasks/'+id+'/files').set('Origin','https://evil.example').set('X-Requested-With','workbench').attach('file',Buffer.from('x'),'x.txt')).status,403);
});

test('兄弟组织先过采编，退回后重新送审并保留原稿批注',async()=>{
 const id=await create({withSource:false});
 const assign={assigneeId:'member',reviewerIds:['minister','minister2']};
 assert.equal((await post('minister','/tasks/'+id+'/assign',assign)).status,409);
 assert.equal((await post('external2','/tasks/'+id+'/source',{body:'越权送审'})).status,403);
 const first=await post('external','/tasks/'+id+'/source',{body:'活动介绍需要补充'});
 assert.equal(first.status,201);
 const versionId=first.body.id;
 const annotation={versionId,start:0,end:4,quote:'活动介绍',body:'请写全名称'};
 assert.equal((await post('minister','/tasks/'+id+'/annotations',annotation)).status,403);
 assert.equal((await post('editor','/tasks/'+id+'/annotations',annotation)).status,201);
 assert.equal((await post('editor','/tasks/'+id+'/reviews',{stage:'editorial',decision:'reject',versionId})).status,200);
 const returned=(await agents.external.get('/api/v1/tasks/'+id)).body;
 assert.equal(returned.task.state,'source_returned');
 assert.equal(returned.annotations[0].body,'请写全名称');
 const revised=await post('external','/tasks/'+id+'/source',{body:'学生会主题活动介绍'});
 assert.equal(revised.status,201);
 assert.equal((await post('editor','/tasks/'+id+'/annotations',annotation)).status,409);
 assert.equal((await post('editor','/tasks/'+id+'/reviews',{
  stage:'editorial',decision:'approve',versionId:revised.body.id
 })).status,200);
 assert.equal((await post('minister','/tasks/'+id+'/assign',assign)).status,200);
 const ops=(await agents.member.get('/api/v1/tasks/'+id)).body;
 assert.equal(ops.versions.length,2);
 assert.equal(ops.annotations[0].version_id,versionId);
 assert.equal((await db.query('SELECT id FROM worklogs WHERE task_id=$1',[id])).rows.length,0);
});

test('富文本精确定位，两审分别鉴权并产生各自群与 @ 路由',async()=>{
 const routes=[
  ['teacher','teacher1','公众号一审群','first-teacher'],
  ['teacher2','teacher2','公众号二审群','second-teacher']
 ];
 for(const [who,,channel,mention] of routes){
  const response=await agents.minister.put('/api/v1/workflow/publication/teachers/'+who)
   .set('X-Requested-With','workbench').send({channel,mention});
  assert.equal(response.status,200);
 }
 const id=await create();
 assert.equal((await post('minister','/tasks/'+id+'/assign',{
  assigneeId:'member',teacherIds:['teacher','teacher']
 })).status,422);
 assert.equal((await post('minister','/tasks/'+id+'/assign',{
  assigneeId:'member',teacherIds:['teacher','teacher2']
 })).status,200);
 const manuscript=await post('member','/tasks/'+id+'/versions',{previewHtml:
  '<p>活动🙂<strong>第二场</strong>活动</p><script>window.reviewMarker=1</script><img src="https://example.org/a" onerror="alert(1)">'
 });
 assert.equal(manuscript.status,201);
 const versionId=manuscript.body.id;
 const task=(await agents.minister.get('/api/v1/tasks/'+id)).body;
 assert.equal(task.task.version.preview_html,'<p>活动🙂<strong>第二场</strong>活动</p>');
 const comment={versionId,start:7,end:9,quote:'活动',body:'这里是第二处'};
 assert.equal((await post('minister','/tasks/'+id+'/annotations',{...comment,quote:'场活'})).status,422);
 assert.equal((await post('minister','/tasks/'+id+'/annotations',comment)).status,201);
 assert.equal((await post('minister2','/tasks/'+id+'/reviews',{stage:'internal',decision:'approve',versionId})).status,200);
 for(const [who,stage,group,mention] of routes){
  const queued=(await db.query("SELECT recipient_id,payload FROM outbox WHERE task_id=$1 AND payload->>'stage'=$2",[id,stage])).rows;
  assert.equal(queued.length,1);
  assert.equal(queued[0].recipient_id,who);
  assert.equal(queued[0].payload.group,group);
  assert.equal(queued[0].payload.mention,mention);
  assert.equal(queued[0].payload.taskPath,'/#task/'+id);
  const other=who==='teacher'?'teacher2':'teacher';
  assert.equal((await post(other,'/tasks/'+id+'/reviews',{stage,decision:'approve',versionId})).status,403);
  assert.equal((await post(other,'/tasks/'+id+'/annotations',comment)).status,403);
  assert.equal((await post(who,'/tasks/'+id+'/reviews',{stage,decision:'approve',versionId})).status,200);
 }
 const external=(await agents.external.get('/api/v1/tasks/'+id)).body;
 assert.deepEqual(external.annotations,[]);
 assert.ok(external.versions.every(v=>v.phase==='source'));
 assert.equal((await post('member','/tasks/'+id+'/publish',{url:'https://example.org/news',versionId})).status,200);
 const archived=(await agents.teacher.get('/api/v1/tasks/'+id)).body;
 assert.equal(archived.annotations[0].start_offset,7);
});
