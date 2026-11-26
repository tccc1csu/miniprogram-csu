// Verify the permanent acceptance data through public HTTPS, without advancing it.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ExcelJS from 'exceljs';
import {chromium} from 'playwright';
import {createCloudRpc} from '../server/cloud-rpc.js';
const origin='https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com';
const credentials=JSON.parse(await readFile(new URL('../.data/cloud-acceptance-accounts.json',import.meta.url)));
const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
const {rpc}=createCloudRpc({envId:runtime.envId,key:runtime.key});
const evidence={origin,startedAt:new Date().toISOString(),checks:[],roles:[]},tokens=new Map();let browser;
const pass=name=>{evidence.checks.push({name,passed:true});console.log('PASS '+name);};
async function response(route,token,{method='GET',data}={}){
 return fetch(origin+'/api/v1'+route,{method,headers:{'X-Client':'miniprogram',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(60000)});
}
async function api(route,token,options){const r=await response(route,token,options),body=await r.json();assert(r.ok,route+' '+JSON.stringify(body));return body;}
async function excel(route,token){const r=await response(route,token);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),book=new ExcelJS.Workbook();await book.xlsx.load(bytes);return {book,bytes};}
try{
 const health=await api('/health');assert(health.database.ready);assert.equal(health.database.provider,'cloudbase-http');pass('public_cloud_database_ready');
 for(const account of credentials.accounts){
  const signed=await api('/auth/login',null,{method:'POST',data:{username:account.username,password:credentials.password}});
  assert.equal(signed.user.id,account.id);assert.equal(signed.user.role,account.role);assert.equal(signed.user.departmentId,account.department);
  tokens.set(account.username,signed.token);
  const tasks=await api('/tasks',signed.token);assert(tasks.length>0,'No visible cases for '+account.username);
  evidence.roles.push({username:account.username,role:account.role,department:account.department,visibleTasks:tasks.length});
  if(['teacher','external'].includes(account.role))assert.equal((await response('/worklogs',signed.token)).status,403);
  else{
   const logs=await api('/worklogs',signed.token);
   if(account.role==='member')assert(logs.every(r=>r.user_id===account.id),'Member report scope');
   if(account.role==='minister'&&account.department!=='office')assert(logs.every(r=>r.department_id===account.department),'Minister report scope');
  }
 }
 pass('all_21_role_accounts_public_login_cases_and_payroll_scope');
 const admin=tokens.get('demo-admin'),tasks=await api('/tasks',admin),map=new Map(tasks.map(t=>[t.id,t]));
 for(const scenario of credentials.scenarios)assert.equal(map.get(scenario.id)?.state,scenario.state,scenario.title);
 assert.equal(new Set(credentials.scenarios.map(s=>s.department)).size,6);assert.equal(new Set(credentials.scenarios.map(s=>s.state)).size,14);
 pass('all_47_cases_six_departments_and_14_states');
 const snapshot=(await rpc('wb_snapshot')).tables,users=new Map(snapshot.users.map(u=>[u.id,u]));
 const logs=await api('/worklogs',tokens.get('office'));
 assert(logs.length>=30);assert.equal(new Set(logs.map(l=>l.department_id)).size,6);
 assert(logs.every(l=>['member','minister'].includes(users.get(l.user_id).role)&&users.get(l.user_id).payable));
 const forced=tasks.find(t=>t.archive_reason?.includes('活动取消'));assert(forced);assert(!logs.some(l=>l.task_id===forced.id));
 assert(logs.some(l=>l.multiplier===15000));assert(logs.some(l=>l.baseHours!==l.hours&&l.adjustmentNote.includes('验收样例')));
 assert(logs.some(l=>l.confirmed)&&logs.some(l=>!l.confirmed));
 evidence.worklogs=logs.length;pass('internal_only_payroll_urgent_adjustment_and_forced_close_zero');
 const defaults=await api('/workflow/publication',tokens.get('minister'));
 assert.notEqual(snapshot.publication_defaults[0].teacher1_id,snapshot.publication_defaults[0].teacher2_id);
 const duty=await api('/workflow/duty?department=photography',tokens.get('photo'));
 assert.deepEqual(duty.members.map(m=>users.get(m.id).username),['photo2','photo3']);assert.equal(users.get(duty.nextId).username,'photo2');
 const fixed=await api('/workflow/defaults?department=office',tokens.get('office'));
 assert(fixed.some(r=>r.kind==='web_article'&&users.get(r.id).username==='office2'));
 const annotated=credentials.scenarios.find(s=>s.state==='teacher1');
 const detail=await api('/tasks/'+annotated.id,tokens.get('teacher'));assert(detail.annotations.length>0);
 const linked=credentials.scenarios.find(s=>s.title.includes('挂网关联推文'));
 assert.equal((await api('/tasks/'+linked.id,admin)).linked.length,1);
 pass('distinct_teachers_annotations_linked_jobs_defaults_and_rotation');
 const {book,bytes}=await excel('/reports/export',tokens.get('office'));
 assert.equal(book.worksheets[0].rowCount,logs.length+2);
 assert.equal(book.worksheets[0].getRow(1).getCell(13).value,'任务备注');assert.equal(book.worksheets[0].getRow(1).getCell(14).value,'工时核定备注');
 const sealed=await excel('/reports/seals/'+credentials.sealId+'/export',tokens.get('office'));
 const changed=logs.find(l=>l.id===credentials.adjustedLogId),sealedRow=snapshot.seal_rows.find(r=>r.seal_id===credentials.sealId&&r.source_id===changed.id);
 assert.equal(changed.hours,sealedRow.data.hours+0.5);assert(sealed.book.worksheets[0].rowCount>30);
 await mkdir('artifacts/cloudbase',{recursive:true});await writeFile('artifacts/cloudbase/acceptance-report.xlsx',bytes);
 pass('public_excel_notes_and_immutable_seal_after_later_adjustment');
 const files=snapshot.files.filter(f=>f.owner_id.startsWith(credentials.dataset+':'));assert.equal(files.length,28);
 for(const file of files){const r=await response('/files/'+file.id,admin);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,file.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 const others=files.find(f=>users.get(f.owner_id).role!=='external');assert.equal((await response('/files/'+others.id,tokens.get('external'))).status,403);
 pass('all_28_private_attachments_public_download_and_external_scope');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(origin,{waitUntil:'networkidle'});await page.locator('#welcome-username, #submitBtn').first().waitFor({state:'visible',timeout:30000});
 if(await page.locator('#submitBtn').isVisible()){await page.locator('#submitBtn').click();await page.waitForLoadState('networkidle');}
 await page.locator('#welcome-username').waitFor({state:'visible',timeout:30000});
 await page.getByLabel('账号',{exact:true}).fill('minister');await page.getByLabel('密码',{exact:true}).fill(credentials.password);await page.locator('.landing-login-submit').click();
 await page.locator('nav[aria-label="主导航"]').waitFor({timeout:30000});await page.getByText('正在加载…',{exact:true}).first().waitFor({state:'hidden',timeout:30000});
 await page.screenshot({path:'artifacts/cloudbase/acceptance-workbench.png',fullPage:true});
 await page.goto(origin+'/#reports');await page.getByRole('heading',{name:'工时与报表',exact:true}).waitFor();
 await page.getByRole('row').filter({hasText:'【验收】'}).first().waitFor({state:'visible',timeout:30000});
 await page.screenshot({path:'artifacts/cloudbase/acceptance-reports.png',fullPage:true});
 assert.deepEqual(errors,[]);assert(requests.every(url=>!/^https?:\/\/(localhost|127\.)/.test(url)));
 pass('real_public_browser_role_workbench_reports_and_no_local_requests');
}catch(error){evidence.failure=error.message;process.exitCode=1;console.error(error.message);}
finally{
 await browser?.close();
 // Remove verification sessions only; permanent cases and accounts remain available.
 for(const token of tokens.values())await response('/auth/logout',token,{method:'POST',data:{}}).catch(()=>{});
 evidence.finishedAt=new Date().toISOString();await mkdir('artifacts/cloudbase',{recursive:true});await writeFile('artifacts/cloudbase/acceptance-public.json',JSON.stringify(evidence,null,2));
}
