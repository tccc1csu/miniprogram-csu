// Public HTTPS verification: no local HTTP listener is started or used.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import ExcelJS from 'exceljs';
import {openCloudDatabase} from '../server/cloud-db.js';
import {createCloudStorage} from '../server/cloud-storage.js';
import {hashPassword,digest} from '../server/auth.js';
const origin='https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com';
const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
const admin=JSON.parse(await readFile(new URL('../.data/cloud-admin-bootstrap.json',import.meta.url)));
const options={envId:runtime.envId,key:runtime.key},db=await openCloudDatabase(options),userId='release-test-'+randomUUID(),password=randomBytes(24).toString('base64url');
const evidence={origin,startedAt:new Date().toISOString(),checks:[]};let taskId,file,browser;
const pass=name=>{evidence.checks.push({name,passed:true});console.log('PASS '+name);};
async function api(method,path,data,token){
 const response=await fetch(origin+'/api/v1'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'X-Client':'miniprogram',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(60000)});
 const body=await response.json();assert(response.ok,method+' '+path+' '+JSON.stringify(body));return body;
}
try{
 const health=await api('GET','/health');assert.equal(health.database.provider,'cloudbase-http');pass('public_https_database_ready');
 const signed=await api('POST','/auth/login',{username:admin.username,password:admin.password});assert.equal(signed.user.role,'admin');const adminToken=signed.token;
 await db.query("INSERT INTO users(id,username,name,password_hash,role,department_id,payable) VALUES($1,$1,'云域名验收临时成员',$2,'member','art',true)",[userId,hashPassword(password)]);
 const member=(await api('POST','/auth/login',{username:userId,password})).token;
 const task=await api('POST','/tasks',{kind:'design',title:'临时云域名验收 '+userId,complexity:'basic'},adminToken);taskId=task.id;
 await api('POST',`/tasks/${taskId}/actions/assign`,{assigneeId:userId},adminToken);
 const form=new FormData(),bytes=Buffer.from('Public HTTPS persistent attachment 中文');form.append('file',new Blob([bytes]),'cloud.txt');
 const uploaded=await fetch(origin+`/api/v1/tasks/${taskId}/files`,{method:'POST',headers:{Authorization:'Bearer '+member},body:form});assert.equal(uploaded.status,201);file=await uploaded.json();
 const downloaded=await fetch(origin+'/api/v1/files/'+file.id,{headers:{Authorization:'Bearer '+member}});assert.equal(downloaded.status,200);assert.equal(digest(Buffer.from(await downloaded.arrayBuffer())),digest(bytes));
 pass('public_login_task_assignment_and_private_attachment_roundtrip');
 const version=await api('POST',`/tasks/${taskId}/actions/submit`,{body:'云端验收成果',fileIds:[file.id]},member);
 await api('POST',`/tasks/${taskId}/actions/acceptance`,{versionId:version.version.id,decision:'approve'},adminToken);
 const detail=await api('GET','/tasks/'+taskId,undefined,member);assert.equal(detail.task.state,'archived');
 const logs=await api('GET','/worklogs',undefined,member);assert.equal(logs.filter(r=>r.task_id===taskId).length,1);
 const exported=await fetch(origin+'/api/v1/reports/export',{headers:{Authorization:'Bearer '+member}});assert.equal(exported.status,200);
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await exported.arrayBuffer()));assert(book.worksheets[0].rowCount>=2);
 pass('public_completion_archive_worklogs_and_excel');
 const unauthorized=await fetch(origin+'/api/v1/internal/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauthorized.status,401);pass('cloud_scheduler_rejects_missing_secret');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(origin,{waitUntil:'networkidle'});
 // Tencent's default testing domain shows its own first-visit interstitial.
 await page.locator('#welcome-username, #submitBtn').first().waitFor({state:'visible',timeout:30000});
 const confirm=page.locator('#submitBtn');if(await confirm.isVisible()){await confirm.click();await page.waitForLoadState('networkidle');}
 await page.locator('#welcome-username').waitFor({state:'visible',timeout:30000}).catch(async error=>{console.log((await page.locator('body').innerText()).slice(0,1500));await page.screenshot({path:'artifacts/cloudbase/browser-error.png',fullPage:true});throw error;});
 await page.getByLabel('账号',{exact:true}).fill(admin.username);await page.getByLabel('密码',{exact:true}).fill(admin.password);
 await page.locator('.landing-login-submit').click();
 await page.locator('nav[aria-label="主导航"]').waitFor({timeout:30000});
 await page.goto(origin+'/#reports');await page.getByRole('heading',{name:'工时与报表',exact:true}).waitFor();
 await page.getByRole('row').filter({hasText:'临时云域名验收 '+userId}).waitFor({state:'visible',timeout:30000});
 await page.getByText('正在加载…',{exact:true}).first().waitFor({state:'hidden',timeout:30000});
 await mkdir('artifacts/cloudbase',{recursive:true});await page.screenshot({path:'artifacts/cloudbase/public-workbench.png',fullPage:true});
 assert.deepEqual(errors,[]);assert(requests.every(url=>!/^https?:\/\/(localhost|127\.)/.test(url)));pass('real_browser_login_reports_and_no_localhost_requests');
}catch(error){evidence.failure=error.message;process.exitCode=1;console.error(error);}
finally{
 await browser?.close();
 try{await db.transaction(async tx=>{
  const ids=(await tx.query('SELECT id FROM tasks WHERE title LIKE $1',['%'+userId+'%'])).rows.map(r=>r.id);
  for(const table of ['worklogs','archives','publications','reviews','events','outbox','assignments','task_reviewers','jobs','reminders'])await tx.query('DELETE FROM '+table+' WHERE task_id=ANY($1::text[])',[ids]);
  await tx.query('DELETE FROM version_files WHERE version_id IN(SELECT id FROM versions WHERE task_id=ANY($1::text[]))',[ids]);
  for(const table of ['versions','files','tasks'])await tx.query('DELETE FROM '+table+' WHERE '+(table==='tasks'?'id':'task_id')+'=ANY($1::text[])',[ids]);
  await tx.query('DELETE FROM sessions WHERE user_id=$1',[userId]);await tx.query('DELETE FROM users WHERE id=$1',[userId]);
 });if(file)await createCloudStorage(options).cancel(file.id,'attachments/'+file.id);evidence.cleanedUp=true;}
 catch(error){evidence.cleanupFailure=error.message;process.exitCode=1;}
 await db.close();evidence.finishedAt=new Date().toISOString();await mkdir('artifacts/cloudbase',{recursive:true});await writeFile('artifacts/cloudbase/public-release.json',JSON.stringify(evidence,null,2));
}
