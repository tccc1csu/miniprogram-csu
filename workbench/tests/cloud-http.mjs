// Opt-in integration against the real CloudBase database. Creates random-password
// temporary users; cleans only its own rows. Never touches the legacy mini database.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import request from 'supertest';
import ExcelJS from 'exceljs';
import {openCloudDatabase} from '../server/cloud-db.js';
import {createCloudStorage} from '../server/cloud-storage.js';
import {createCloudRpc} from '../server/cloud-rpc.js';
import {createApp} from '../server/app.js';
import {hashPassword,digest} from '../server/auth.js';
import {scheduleReminders} from '../server/notifications.js';
import {backupAndVerify} from '../deployment/cloud-backup.mjs';
const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
const options={envId:runtime.envId,key:runtime.key};
const evidence={startedAt:new Date().toISOString(),checks:[]};
const pass=name=>{evidence.checks.push({name,passed:true});console.log('PASS '+name);};
const prefix='cloudtest-'+randomUUID().slice(0,8),password=randomBytes(24).toString('base64url');
let db,second,file;
const roles=[['ops','minister','operations'],['ops2','minister','operations'],['member','member','operations'],['member2','member','operations'],['editor','minister','editorial'],['writer','member','editorial'],['office','minister','office'],['office2','member','office'],['photo','minister','photography'],['photo2','member','photography'],['photo3','member','photography'],['art','minister','art'],['art2','member','art'],['original','minister','original'],['original2','member','original'],['teacher','teacher',null],['teacher2','teacher',null],['external','external',null],['external2','external',null]];
const uid=who=>prefix+'-'+who,tokens={};
const taskIds=[];let sealId;
try{
 db=await openCloudDatabase(options);second=await openCloudDatabase(options);
 const hash=hashPassword(password);
 await db.transaction(async tx=>{for(const [who,role,department] of roles)await tx.query('INSERT INTO users(id,username,name,password_hash,role,department_id,payable) VALUES($1,$1,$2,$3,$4,$5,$6)',[uid(who),'云验收 '+who,hash,role,department,['member','minister'].includes(role)]);});
 const storage=createCloudStorage(options),api=request(createApp(db,{storage,production:false})),api2=request(createApp(second,{storage,production:false}));
 const call=async(who,method,url,data,status=200,other=false)=>{
  let r=(other?api2:api)[method]('/api/v1'+url).set('Authorization','Bearer '+tokens[who]);if(data!==undefined)r=r.send(data);
  const result=await r;assert.equal(result.status,status,method+' '+url+' '+JSON.stringify(result.body));return result.body;
 };
 for(const [who] of roles){const r=await api.post('/api/v1/auth/login').set('X-Client','miniprogram').send({username:uid(who),password});assert.equal(r.status,200);tokens[who]=r.body.token;}
 pass('real_cloud_login_and_shared_sessions');
 await call('ops','put','/workflow/publication',{reviewerIds:[uid('ops'),uid('ops2')],teacherIds:[uid('teacher'),uid('teacher2')]});
 const create=async(who,data)=>{const task=await call(who,'post','/tasks',data,201);taskIds.push(task.id);return task.id;};
 const future=h=>new Date(Date.now()+h*3600000).toISOString();
 const task=await create('external',{title:prefix+' 公众号闭环',layoutType:'basic',deadline:future(72)});
 const source=await call('external','post',`/tasks/${task}/source`,{body:'兄弟组织新闻稿'},201);
 await call('ops','post',`/tasks/${task}/assign`,{assigneeId:uid('member')},409);
 await call('editor','post',`/tasks/${task}/reviews`,{stage:'editorial',decision:'approve',versionId:source.id});
 await call('ops','post',`/tasks/${task}/assign`,{assigneeId:uid('member')});
 const uploaded=await api.post(`/api/v1/tasks/${task}/files`).set('Authorization','Bearer '+tokens.member).attach('file',Buffer.from('cloud private file 中文'),'稿件.txt');assert.equal(uploaded.status,201,JSON.stringify(uploaded.body));file=uploaded.body;
 const downloaded=await api2.get('/api/v1/files/'+file.id).set('Authorization','Bearer '+tokens.member);assert.equal(downloaded.status,200);assert.equal(digest(downloaded.body),file.sha256);
 await call('external2','get','/files/'+file.id,undefined,403);
 pass('private_cloud_storage_cross_instance_integrity_and_permissions');
 const version=await call('member','post',`/tasks/${task}/versions`,{body:'云端正式稿',fileIds:[file.id]},201);
 await call('teacher2','post',`/tasks/${task}/reviews`,{stage:'teacher2',decision:'approve',versionId:version.id},409);
 for(const [who,stage] of [['ops','internal'],['teacher','teacher1'],['teacher2','teacher2']])await call(who,'post',`/tasks/${task}/reviews`,{stage,decision:'approve',versionId:version.id});
 const broken={...db,transaction:fn=>db.transaction(tx=>fn({...tx,query:(sql,args)=>{if(sql.startsWith('INSERT INTO worklogs'))throw new Error('injected');return tx.query(sql,args);}}))};
 await request(createApp(broken,{quiet:true})).post(`/api/v1/tasks/${task}/publish`).set('Authorization','Bearer '+tokens.member).send({versionId:version.id,url:'https://example.com/cloud-verification'}).expect(500);
 assert.equal((await second.query('SELECT count(*)::int AS n FROM archives WHERE task_id=$1',[task])).rows[0].n,0);
 pass('cloud_archive_and_worklog_atomic_rollback');
 await Promise.all(Array.from({length:4},(_,i)=>call('member','post',`/tasks/${task}/publish`,{versionId:version.id,url:'https://example.com/cloud-verification'},200,!!(i%2))));
 const logs=(await second.query('SELECT * FROM worklogs WHERE task_id=$1 ORDER BY base_units DESC',[task])).rows;
 assert.deepEqual(logs.map(r=>r.base_units),[40000,10000,10000]);
 pass('cross_instance_concurrent_publish_exactly_once_and_teacher_exclusion');
 await call('member','patch',`/tasks/${task}/report-note`,{reportNote:'复杂调整验收备注'});
 await call('ops','patch','/worklogs/'+logs[0].id,{hours:5.5,reason:'云端补充制作'});
 const seal=await call('office','post','/reports/seals',{name:prefix,from:'2020-01-01',to:'2099-12-31'},201);sealId=seal.id;
 const sealed=(await db.query('SELECT data FROM seal_rows WHERE seal_id=$1 ORDER BY source_id',[sealId])).rows;
 await call('ops','patch','/worklogs/'+logs[0].id,{hours:6,reason:'再次核定'});
 assert.deepEqual((await second.query('SELECT data FROM seal_rows WHERE seal_id=$1 ORDER BY source_id',[sealId])).rows,sealed);
 const excel=await api.get('/api/v1/reports/export').set('Authorization','Bearer '+tokens.office).buffer(true).parse((res,cb)=>{const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>cb(null,Buffer.concat(chunks)));});
 assert.equal(excel.status,200);const book=new ExcelJS.Workbook();await book.xlsx.load(excel.body);assert(book.worksheets[0].rowCount>=4);
 await call('external','get','/worklogs',undefined,403);
 pass('cloud_adjustment_audit_immutable_seals_excel_and_reporting_permissions');
 await call('photo','put','/workflow/duty',{departmentId:'photography',personIds:[uid('photo2'),uid('photo3')]});
 const photos=await Promise.all([0,1].map(async i=>{const t=await call('external','post','/tasks',{kind:'photo',title:prefix+' 摄制 '+i,deadline:future(72),location:'校园',contact:'内部联调'},201,!!i);taskIds.push(t.id);return t.id;}));
 const assigned=await Promise.all(photos.map(t=>call('photo','get','/tasks/'+t)));
 assert.deepEqual(assigned.map(r=>r.task.assignee_id).sort(),[uid('photo2'),uid('photo3')].sort());
 pass('cloud_compare_and_swap_retry_keeps_rotation_sequential');
 const complete=async(kind,creator,manager,member,data)=>{
  const t=await create(creator,{kind,title:prefix+' '+kind,...data});
  await call(manager,'post',`/tasks/${t}/actions/assign`,{assigneeId:uid(member)});
  const delivered=await call(member,'post',`/tasks/${t}/actions/submit`,{body:'云端成果'});
  await call(manager,'post',`/tasks/${t}/actions/acceptance`,{versionId:delivered.version.id,decision:'approve'});
  assert.equal((await call(manager,'get','/tasks/'+t)).task.state,'archived');return t;
 };
 await complete('design','external','art','art2',{complexity:'basic'});
 await complete('request','external','original','original2',{departmentId:'original'});
 await complete('request','external','editor','writer',{departmentId:'editorial',ruleId:3});
 await complete('web_article','writer','office','office2',{reviewerIds:[uid('editor')],lines:[{title:'云端新闻稿',site:'院网',original:true,authorId:uid('writer')}]});
 await create('original2',{kind:'work_entry',title:prefix+' 人工补登',personId:uid('original2'),week:48,hours:2});
 pass('six_department_workflows_and_manual_work_entries');
 await db.run(()=>scheduleReminders(db,new Date(Date.now()+100*3600000)));
 const before=(await db.query('SELECT count(*)::int AS n FROM reminders WHERE task_id=ANY($1::text[])',[taskIds])).rows[0].n;
 await second.run(()=>scheduleReminders(second,new Date(Date.now()+100*3600000)));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM reminders WHERE task_id=ANY($1::text[])',[taskIds])).rows[0].n,before);assert(before>0);
 pass('cloud_reminders_catch_up_and_deduplicate');
 await second.close();second=await openCloudDatabase(options);
 assert.equal((await second.query('SELECT count(*)::int AS n FROM archives WHERE task_id=$1',[task])).rows[0].n,1);
 pass('new_process_workspace_recovers_only_from_cloud');
 const backup=await backupAndVerify(options);assert(backup.restoreVerified&&backup.files===1);pass('consistent_backup_attachment_hashes_and_full_restore_foreign_keys');
 const unauth=await fetch(`https://${runtime.envId}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/wb_snapshot`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert(!unauth.ok);
 pass('anonymous_rpc_access_denied');
}catch(error){evidence.failure=error.message;process.exitCode=1;console.error(error);}
finally{
 try{if(db){
  const testUsers=roles.map(([who])=>uid(who));
  // Include a task whose creation committed but whose HTTP response was lost.
  const owned=(await db.query('SELECT id FROM tasks WHERE creator_id=ANY($1::text[])',[testUsers])).rows.map(r=>r.id);
  await db.transaction(async tx=>{
   if(sealId){await tx.query('DELETE FROM seal_rows WHERE seal_id=$1',[sealId]);await tx.query('DELETE FROM report_seals WHERE id=$1',[sealId]);}
   await tx.query('DELETE FROM adjustments WHERE log_id IN(SELECT id FROM worklogs WHERE task_id=ANY($1::text[]))',[owned]);
   for(const table of ['worklogs','archives','publications','reviews','version_annotations','events','outbox','reminders','assignments','task_reviewers','jobs','bookings','article_lines','work_entries','publication_routing'])await tx.query('DELETE FROM '+table+' WHERE task_id=ANY($1::text[])',[owned]);
   await tx.query('DELETE FROM version_files WHERE version_id IN(SELECT id FROM versions WHERE task_id=ANY($1::text[]))',[owned]);
   await tx.query('DELETE FROM registration_files WHERE registration_id IN(SELECT id FROM registrations WHERE task_id=ANY($1::text[]))',[owned]);
   for(const table of ['versions','registrations','files','tasks'])await tx.query('DELETE FROM '+table+' WHERE '+(table==='tasks'?'id':'task_id')+'=ANY($1::text[])',[owned]);
   await tx.query('DELETE FROM duty_rotation_members WHERE user_id=ANY($1::text[])',[testUsers]);
   await tx.query('DELETE FROM duty_rotation WHERE updated_by=ANY($1::text[])',[testUsers]);
   await tx.query('UPDATE publication_defaults SET teacher1_id=NULL,teacher2_id=NULL,reviewer1_id=NULL,reviewer2_id=NULL WHERE teacher1_id=ANY($1::text[])',[testUsers]);
   await tx.query('DELETE FROM sessions WHERE user_id=ANY($1::text[])',[testUsers]);
   await tx.query('DELETE FROM users WHERE id=ANY($1::text[])',[testUsers]);
  });
  if(file)await createCloudStorage(options).cancel(file.id,'attachments/'+file.id);
  evidence.cleanedUp=true;
 }}catch(e){evidence.cleanupFailure=e.message;process.exitCode=1;console.error('Test cleanup failed',e);}
 await second?.close();await db?.close();
 evidence.finishedAt=new Date().toISOString();await mkdir('artifacts/cloudbase',{recursive:true});await writeFile('artifacts/cloudbase/business-http.json',JSON.stringify(evidence,null,2));
}
