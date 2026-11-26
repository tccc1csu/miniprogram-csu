import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { ZodError } from 'zod';
import { digest, publicUser, userForToken, login, canManage, canReportAll } from './auth.js';
import { HttpError, id, requireThat, createTask, assignTask, submitVersion, reviewTask, publishTask, registerTask, listTasks, taskDetail, loadTask, assertView, submitSource, changeTaskTeachers, saveReportNote } from './domain.js';
import { adjust, assertReporting, worklogs, workbook, saveView, seal } from './reports.js';
import { createJob, jobAction, workflowOptions } from './jobs.js';
import { updatePolicy } from './policy.js';
import {addAnnotation} from './annotations.js';
import {configurePublication,publicationSettings,setTeacherDelivery} from './approval.js';
import {listFlowDefaults,clearFlowDefault} from './flow-defaults.js';

import {rotationSettings,saveRotation} from './rotation.js';

const cookieName='youth_session';
const authToken=req=>req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1]||req.headers.cookie?.match(/(?:^|;\s*)youth_session=([a-f0-9]{64})(?:;|$)/)?.[1];
const safeName=name=>{const b=Buffer.from(name,'latin1');const decoded=b.toString('utf8');return (decoded.includes('\uFFFD')?name:decoded).replace(/[\\/\x00-\x1f]/g,'_').slice(0,180)||'附件';};
const sendWorkbook=(res,data)=>res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('work-hours.xlsx').send(Buffer.from(data));

export function createApp(db,{uploadDir=path.resolve(process.env.DATA_DIR||'.data','uploads'),quiet=false,staticDir=path.resolve('dist'),production=process.env.NODE_ENV==='production',databaseUploads=production,storage,jobs}={}){
 const app=express();app.disable('x-powered-by');
 app.use(express.json({limit:'1mb'}));
 app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');next();});
 const api=express.Router(), upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024,files:1}});
 if(db.middleware)api.use((req,res,next)=>req.path==='/internal/jobs'?next():db.middleware(req,res,next));
 const loginAttempts=new Map();
 api.get('/health',async(req,res)=>{
  if(db.status&&!db.status.ready)return res.status(503).json({ok:false,database:{ready:false},groupNotifications:process.env.NOTIFICATION_ENDPOINT?'configured':'unconfigured'});
  try{if(db.health)await db.health();else await db.query('SELECT 1');}
  catch{return res.status(503).json({ok:false,database:{ready:false}});}
  res.json({ok:true,database:{ready:true,provider:db.provider||'postgres'},groupNotifications:process.env.NOTIFICATION_ENDPOINT?'configured':'unconfigured'});
 });
 api.post('/internal/jobs',async(req,res)=>{
  const expected=process.env.JOB_TRIGGER_TOKEN;
  requireThat(expected&&digest(req.get('Authorization')||'')===digest('Bearer '+expected),401,'无效调度凭证');
  requireThat(jobs,503,'调度暂未就绪');await jobs();res.json({ok:true});
 });
 api.post('/auth/login',async(req,res)=>{
  const {username,password}=req.body||{};requireThat(typeof username==='string'&&username.length<=100&&typeof password==='string'&&password.length<=200,422,'请填写账号和密码');
  const now=Date.now();if(loginAttempts.size>1000)for(const [k,v] of loginAttempts)if(v.until<now)loginAttempts.delete(k);
  const key=req.ip;const old=loginAttempts.get(key);const attempt=old?.until>now?old:{count:0,until:now+15*60000};requireThat(attempt.count<35,429,'尝试次数过多，请稍后登录');
  const result=await login(db,username.trim(),password);if(!result){attempt.count++;loginAttempts.set(key,attempt);throw new HttpError(401,'账号或密码不正确','LOGIN_FAILED');}
  loginAttempts.delete(key);
  res.cookie(cookieName,result.token,{httpOnly:true,sameSite:'strict',secure:production,maxAge:12*3600000,path:'/'});
  res.json(req.get('X-Client')==='miniprogram'?result:{user:result.user});
 });
 api.use(async(req,res,next)=>{
  const token=authToken(req);req.user=token?await userForToken(db,token):null;requireThat(req.user,401,'请先登录');
  db.authorize?.({session:digest(token),id:req.user.id,role:req.user.role,department_id:req.user.department_id,payable:req.user.payable});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.headers.authorization?.match(/^Bearer [a-f0-9]{64}$/i)){
   const origin=req.get('Origin');const host=req.get('Host');const allowed=process.env.APP_ORIGIN;
   requireThat(req.get('X-Requested-With')==='workbench'&&(!origin||origin===allowed||origin===(production?'https':req.protocol)+'://'+host),403,'请求来源不允许');
  }
  res.set('Cache-Control','no-store');next();
 });
 api.get('/auth/me',(req,res)=>res.json(publicUser(req.user)));
 api.post('/auth/logout',async(req,res)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(authToken(req))]);res.clearCookie(cookieName,{path:'/',sameSite:'strict',secure:production});res.json({ok:true});});
 api.get('/people',async(req,res)=>{
  requireThat(canManage(req.user),403,'仅运营部可查排版成员');
  res.json((await db.query("SELECT id,name,role FROM users WHERE active=true AND payable=true AND department_id='operations' ORDER BY role,name")).rows);
 });
 api.get('/workflow/publication',async(req,res)=>res.json(await publicationSettings(db,req.user)));
 api.put('/workflow/publication',async(req,res)=>res.json(await configurePublication(db,req.user,req.body)));
 api.put('/workflow/publication/teachers/:id',async(req,res)=>{
  await setTeacherDelivery(db,req.user,req.params.id,req.body);
  res.json({ok:true});
 });
 api.get('/workflow/defaults',async(req,res)=>res.json(await listFlowDefaults(db,req.user,String(req.query.department||req.user.department_id||'operations'))));
 api.delete('/workflow/defaults/:department/:kind',async(req,res)=>{
  await clearFlowDefault(db,req.user,req.params.department,req.params.kind);res.json({ok:true});
 });
 api.get('/workflow/options',async(req,res)=>res.json(await workflowOptions(db,req.user)));
 api.patch('/workflow/policy',async(req,res)=>res.json(await updatePolicy(db,req.user,req.body)));
 api.get('/workflow/duty',async(req,res)=>res.json(await rotationSettings(db,req.user,String(req.query.department||req.user.department_id||'operations'))));
 api.put('/workflow/duty',async(req,res)=>res.json(await saveRotation(db,req.user,req.body)));
 api.get('/inbox',async(req,res)=>res.json((await db.query('SELECT id,task_id,event,payload,created_at FROM outbox WHERE recipient_id=$1 ORDER BY created_at DESC LIMIT 150',[req.user.id])).rows));
 api.get('/tasks',async(req,res)=>res.json(await listTasks(db,req.user)));
 api.post('/tasks',async(req,res)=>res.status(201).json(await (!req.body?.kind||req.body.kind==='publication'?createTask(db,req.user,req.body):createJob(db,req.user,req.body))));
 api.get('/tasks/:id',async(req,res)=>res.json(await taskDetail(db,req.user,req.params.id)));
 api.patch('/tasks/:id/report-note',async(req,res)=>res.json(await saveReportNote(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/actions/:action',async(req,res)=>res.json(await jobAction(db,req.user,req.params.id,req.params.action,req.body)));
 api.post('/tasks/:id/assign',async(req,res)=>res.json(await assignTask(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/source',async(req,res)=>res.status(201).json(await submitSource(db,req.user,req.params.id,req.body)));
 api.put('/tasks/:id/teachers',async(req,res)=>res.json(await changeTaskTeachers(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/annotations',async(req,res)=>res.status(201).json(await addAnnotation(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/versions',async(req,res)=>res.status(201).json(await submitVersion(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/reviews',async(req,res)=>res.json(await reviewTask(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/publish',async(req,res)=>res.json(await publishTask(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/register',async(req,res)=>res.status(201).json(await registerTask(db,req.user,req.params.id,req.body)));
 api.post('/tasks/:id/files',upload.single('file'),async(req,res)=>{
  requireThat(req.file?.size,422,'请选择非空附件');const taskId=req.params.id,u=req.user;
  const file={id:id(),name:safeName(req.file.originalname),size:req.file.size,sha256:digest(req.file.buffer)};
  const location=path.resolve(uploadDir,file.id);let written=false,cloudKey;
  if(storage){cloudKey=await storage.prepare(file);await storage.put(cloudKey,req.file.buffer);}
  try{await db.transaction(async tx=>{
   const t=await loadTask(tx,taskId,true);
   const externalAllowed=u.role==='external'&&(t.creator_id===u.id||(t.open_registration&&new Date(t.deadline)>new Date()));
   requireThat(!t.archive_id,409,'已归档任务不可新增材料');
   requireThat(externalAllowed||canManage(u,t.department_id)||t.assignee_id===u.id||(t.kind!=='publication'&&u.id===t.creator_id),403,'没有上传材料权限');
     if(!storage&&!databaseUploads){await mkdir(uploadDir,{recursive:true});await writeFile(location,req.file.buffer,{flag:'wx'});written=true;}
   await tx.query('INSERT INTO files(id,task_id,owner_id,storage_name,name,size,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[file.id,taskId,u.id,cloudKey||file.id,file.name,file.size,file.sha256]);
   if(!storage&&databaseUploads)await tx.query('INSERT INTO file_payloads(file_id,content) VALUES($1,$2)',[file.id,req.file.buffer]);
  });}catch(e){if(written)await unlink(location).catch(()=>{});
   // A lost commit response is ambiguous: retain the prepared object for the cloud reconciler.
   if(cloudKey&&e.code!=='CLOUD_UNAVAILABLE')await storage.cancel(file.id,cloudKey).catch(()=>{});throw e;}
  if(storage)await storage.complete(file.id).catch(()=>{});res.status(201).json(file);
 });
 api.get('/files/:id',async(req,res,next)=>{
  const f=(await db.query('SELECT * FROM files WHERE id=$1',[req.params.id])).rows[0];requireThat(f,404,'附件不存在');
  const u=req.user;if(u.role==='external')requireThat(f.owner_id===u.id,403,'只能下载自己提交的材料');else await assertView(db,u,await loadTask(db,f.task_id));
  if(storage){const bytes=await storage.get(f.storage_name);requireThat(bytes.length===f.size&&digest(bytes)===f.sha256,503,'附件完整性校验失败');return res.attachment(f.name).type('application/octet-stream').send(bytes);}
  if(databaseUploads){
   const payload=(await db.query('SELECT content FROM file_payloads WHERE file_id=$1',[f.id])).rows[0];
   requireThat(payload,404,'附件内容未找到');
   return res.attachment(f.name).type('application/octet-stream').send(Buffer.from(payload.content));
  }
  res.attachment(f.name).type('application/octet-stream').sendFile(f.storage_name,{root:path.resolve(uploadDir)},err=>{if(err)next(err);});
 });
 api.get('/worklogs',async(req,res)=>res.json(await worklogs(db,req.user,req.query)));
 api.patch('/worklogs/:id',async(req,res)=>res.json(await adjust(db,req.user,req.params.id,req.body)));
 api.get('/worklogs/:id/adjustments',async(req,res)=>{
  assertReporting(req.user);const scope=(await db.query('SELECT department_id,user_id FROM worklogs WHERE id=$1',[req.params.id])).rows[0];requireThat(scope,404,'条目不存在');
  requireThat(canReportAll(req.user)||scope.user_id===req.user.id||canManage(req.user,scope.department_id),403,'条目不可见');
  res.json((await db.query('SELECT a.*,u.name actor_name FROM adjustments a JOIN users u ON u.id=a.actor_id WHERE log_id=$1 ORDER BY a.created_at DESC',[req.params.id])).rows);
 });
 api.get('/views',async(req,res)=>{assertReporting(req.user);res.json((await db.query('SELECT * FROM saved_views WHERE user_id=$1 ORDER BY name',[req.user.id])).rows);});
 api.post('/views',async(req,res)=>res.status(201).json(await saveView(db,req.user,req.body)));
 api.get('/reports/export',async(req,res)=>sendWorkbook(res,await workbook(await worklogs(db,req.user,req.query))));
 api.get('/reports/seals',async(req,res)=>{
  requireThat(canReportAll(req.user),403,'仅办公部部长或管理员能查看封存');
  res.json((await db.query('SELECT s.*,count(r.source_id)::int row_count FROM report_seals s LEFT JOIN seal_rows r ON r.seal_id=s.id GROUP BY s.id ORDER BY s.created_at DESC')).rows);
 });
 api.post('/reports/seals',async(req,res)=>res.status(201).json(await seal(db,req.user,req.body)));
 api.get('/reports/seals/:id/export',async(req,res)=>{
  requireThat(canReportAll(req.user),403,'仅办公部部长或管理员能导出封存');
  const rows=(await db.query('SELECT data FROM seal_rows WHERE seal_id=$1 ORDER BY source_id',[req.params.id])).rows;requireThat(rows.length,404,'未找到封存报表');sendWorkbook(res,await workbook(rows.map(r=>r.data),'封存工时明细'));
 });
 api.get('/outbox',async(req,res)=>{
  requireThat(req.user.role==='minister'||req.user.role==='admin',403,'通知记录仅供管理人员查看');
  const all=req.user.role==='admin';res.json((await db.query('SELECT o.id,o.task_id,o.event,o.payload,o.status,o.attempts,o.last_error,o.created_at,t.number FROM outbox o JOIN tasks t ON t.id=o.task_id'+(all?'':' WHERE t.department_id=$1')+' ORDER BY o.created_at DESC LIMIT 100',all?[]:[req.user.department_id])).rows);
 });
 api.use((req,res)=>res.status(404).json({error:'接口不存在',code:'NOT_FOUND'}));
 app.use('/api/v1',api);
 if(existsSync(path.join(staticDir,'index.html'))){app.use(express.static(staticDir,{index:false}));app.get('/{*path}',(req,res)=>res.sendFile(path.join(staticDir,'index.html')));}
 app.use((err,req,res,next)=>{
  if(res.headersSent)return next(err);
  if(err instanceof ZodError)return res.status(422).json({error:err.issues.map(x=>(x.path.join('.')?x.path.join('.')+'：':'')+x.message).join('；'),code:'INVALID_INPUT'});
  if(err instanceof multer.MulterError)return res.status(422).json({error:err.code==='LIMIT_FILE_SIZE'?'附件最多 12 MB':'附件格式不正确',code:err.code});
  if(err instanceof HttpError)return res.status(err.status).json({error:err.message,code:err.code});
  if(err.code==='23505')return res.status(409).json({error:'记录已经存在，请刷新重试',code:'CONFLICT'});
  if(err.status&&err.status<500)return res.status(err.status).json({error:'请求无法处理',code:'BAD_REQUEST'});
  if(!quiet)console.error(err);res.status(500).json({error:'处理失败，请稍后重试',code:'INTERNAL_ERROR'});
 });
 return app;
}
