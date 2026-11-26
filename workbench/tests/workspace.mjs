import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {openDatabase} from '../server/db.js';
import {seed,seedExamples} from '../server/seed.js';
import {createApp} from '../server/app.js';

const db=await openDatabase({memory:true,url:null,schema:null});
const data=await mkdtemp(path.join(tmpdir(),'youth-workspace-'));
let server,browser;
try{
 await seed(db);await seedExamples(db);
 server=await new Promise(resolve=>{const s=createApp(db,{quiet:true,uploadDir:path.join(data,'uploads')}).listen(0,'127.0.0.1',()=>resolve(s));});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const apiContexts={};
 async function as(name){if(!apiContexts[name]){const ctx=await browser.newContext();const result=await ctx.request.post(origin+'/api/v1/auth/login',{data:{username:name,password:process.env.DEMO_PASSWORD||'Youth2026!'}});assert.equal(result.status(),200);apiContexts[name]=ctx;}return apiContexts[name].request;}
 async function call(name,url,method='get',data){const request=await as(name);const res=await request[method](origin+'/api/v1'+url,{data,headers:{'X-Requested-With':'workbench'}});assert.ok(res.ok(),method+' '+url+' '+res.status()+' '+await res.text());return res.json();}
 async function list(name){return call(name,'/tasks');}
 const target=(rows,id)=>rows.find(t=>t.id===id);
 async function signIn(name,route='home'){
  await context.clearCookies();const res=await context.request.post(origin+'/api/v1/auth/login',{data:{username:name,password:process.env.DEMO_PASSWORD||'Youth2026!'}});assert.ok(res.ok());
  await page.goto(origin+'/#'+route);await page.reload();await page.locator('nav[aria-label="主导航"]').waitFor();await page.locator('.inline-msg').waitFor({state:'hidden'});if(!route.startsWith('task/'))await page.getByText('正在加载任务…',{exact:true}).waitFor({state:'hidden'});
 }
 const title='工作区验收 · 公众号完整责任链';
 const t=await call('external','/tasks','post',{kind:'publication',title,layoutType:'basic',deadline:new Date(Date.now()+5*86400000).toISOString(),notes:'隔离数据'});
 assert.equal(target(await list('external'),t.id).viewer.action,'source');
 assert.equal(target(await list('external2'),t.id),undefined);
 const source=await call('external','/tasks/'+t.id+'/source','post',{body:'学校活动供稿正文'});
 assert.equal(target(await list('external'),t.id).viewer.action,null);
 assert.equal(target(await list('editor'),t.id).viewer.action,'review');
 await call('editor','/tasks/'+t.id+'/reviews','post',{stage:'editorial',decision:'approve',versionId:source.id,reason:'内容正确'});
 assert.equal(target(await list('minister'),t.id).viewer.action,'assign');
 assert.equal(target(await list('editor'),t.id).viewer.reviewedByMe,true);
 await call('minister','/tasks/'+t.id+'/assign','post',{assigneeId:'member',reviewerIds:['minister','minister2']});
 assert.equal(target(await list('member'),t.id).viewer.action,'submit');
 assert.equal(target(await list('member2'),t.id).viewer.action,null);
 const v=await call('member','/tasks/'+t.id+'/versions','post',{body:'第一版公众号正文'});
 assert.equal(target(await list('minister2'),t.id).viewer.action,'review');
 await call('minister2','/tasks/'+t.id+'/reviews','post',{stage:'internal',decision:'approve',versionId:v.id});
 assert.equal(target(await list('minister'),t.id).viewer.action,null);
 assert.equal(target(await list('teacher'),t.id).viewer.action,'review');
 assert.equal(target(await list('teacher2'),t.id).viewer.action,null);
 await signIn('teacher','review');await page.getByRole('link',{name:title,exact:true}).waitFor();
 await signIn('teacher2','review');assert.equal(await page.getByRole('link',{name:title,exact:true}).count(),0);
 await call('teacher','/tasks/'+t.id+'/reviews','post',{stage:'teacher1',decision:'reject',versionId:v.id,reason:'修改标题'});
 assert.equal(target(await list('member'),t.id).viewer.action,'submit');
 assert.equal(target(await list('teacher'),t.id).viewer.reviewedByMe,true);
 const v2=await call('member','/tasks/'+t.id+'/versions','post',{body:'第二版修改后的公众号正文'});
 await call('minister','/tasks/'+t.id+'/reviews','post',{stage:'internal',decision:'approve',versionId:v2.id});
 await call('teacher','/tasks/'+t.id+'/reviews','post',{stage:'teacher1',decision:'approve',versionId:v2.id});
 assert.equal(target(await list('teacher'),t.id).viewer.action,null);
 assert.equal(target(await list('teacher2'),t.id).viewer.action,'review');
 await call('teacher2','/tasks/'+t.id+'/reviews','post',{stage:'teacher2',decision:'approve',versionId:v2.id});
 assert.equal(target(await list('member'),t.id).viewer.action,'publish');
 await call('member','/tasks/'+t.id+'/publish','post',{url:'https://example.org/workspace',versionId:v2.id});
 assert.equal(target(await list('member'),t.id).viewer.action,null);
 assert.equal(target(await list('teacher'),t.id).viewer.reviewedByMe,true);

 const open=await call('minister','/tasks','post',{kind:'publication',title:'工作区验收 · 公开报名',layoutType:'basic',deadline:new Date(Date.now()+4*86400000).toISOString(),openRegistration:true});
 const publicTask=target(await list('external2'),open.id);assert.equal(publicTask.publicOnly,true);assert.equal(publicTask.viewer,undefined);
 await mkdir('artifacts/workspace',{recursive:true});
 for(const [name,caption] of [['minister','先安排承接，再推进交付'],['member','今天，从我的待办开始'],['teacher','把每一篇稿件，审得更清楚'],['office','把每一份贡献，核对清楚'],['external','你的需求，进度一目了然'],['admin','让中心协作，有序推进']]){
  const start=requests.length;await signIn(name);
  await page.getByRole('heading',{name:caption,exact:true}).waitFor();
  await page.locator('.workspace-metric strong').first().filter({hasNotText:'—'}).waitFor();
  assert.equal(await page.locator('.sidebar-group').count(),['minister','office','admin'].includes(name)?4:3);
  if(['teacher','external'].includes(name)){
   assert.ok(!requests.slice(start).some(url=>/\/(worklogs|reports\/seals)/.test(url)),name+' must not fetch hours');
   assert.equal(await page.locator('nav').getByRole('link',{name:'工时与报表',exact:true}).count(),0);
  }
  await page.screenshot({path:'artifacts/workspace/'+name+'.png',fullPage:true});
 }
 await signIn('member','mine');await page.locator('.workspace-result-count').filter({hasNotText:'正在加载'}).waitFor();
 const memberMine=(await list('member')).filter(t=>t.viewer?.action);assert.equal(await page.locator('.workspace-task-table tbody tr').count(),memberMine.length);
 await signIn('external','created?tab=all');await page.getByRole('link',{name:title,exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'工作区验收 · 公开报名',exact:true}).count(),0);
 await signIn('teacher','review?tab=reviewed');await page.getByRole('link',{name:title,exact:true}).waitFor();
 await signIn('teacher','reports');await page.getByRole('heading',{name:'暂时无法访问'}).waitFor();
 await signIn('member','settings');await page.getByRole('heading',{name:'暂时无法访问'}).waitFor();
 await signIn('minister');await page.getByRole('link',{name:'核定部门工时',exact:true}).click();await page.getByRole('heading',{name:'工时与报表',exact:true}).waitFor();
 assert.equal(await page.getByLabel('按核定状态').inputValue(),'pending');assert.equal(await page.getByLabel('筛选部门').inputValue(),'operations');
 for(const [kind,label]of Object.entries({publication:'公众号排版',web_article:'采编挂网',photo:'摄制预约',request:'部门需求',design:'美编设计',work_entry:'工作登记'})){
  await signIn('admin');await page.locator('.workspace-business-grid').getByRole('link',{name:new RegExp(label)}).click();
  assert.equal(await page.getByLabel('业务类型筛选').inputValue(),kind);
  await page.getByRole('button',{name:'看板',exact:true}).click();await page.reload();await page.getByLabel('业务类型筛选').waitFor();
  assert.equal(await page.getByLabel('业务类型筛选').inputValue(),kind);assert.equal(await page.getByRole('button',{name:'看板',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'新建需求',exact:true}).click();const kindField=page.getByRole('dialog').getByLabel('业务类型');await kindField.waitFor();assert.equal(await kindField.inputValue(),kind);await page.getByRole('button',{name:'关闭',exact:true}).click();
 }
 await signIn('minister','tasks?view=board');await page.locator('.workspace-task-card').first().waitFor();await page.screenshot({path:'artifacts/workspace/board.png',fullPage:true});
 const card=page.locator('.workspace-task-card').first();const link=await card.getAttribute('href'),cardTitle=await card.locator('strong').textContent();await card.click();assert.equal(new URL(page.url()).hash,link);await page.getByRole('heading',{name:cardTitle,exact:true}).waitFor();
 await signIn('minister');
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home overflow at '+width);
  if(width<761){
   await page.getByRole('button',{name:'打开导航'}).click();assert.equal(await page.getByRole('button',{name:'打开导航'}).getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'打开导航'}).evaluate(el=>el===document.activeElement),true);
   if(width===390)await page.screenshot({path:'artifacts/workspace/mobile.png',fullPage:true});
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/#tasks?view=board');await page.locator('.workspace-task-card').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'打开导航'}).click();await page.locator('nav').getByRole('link',{name:/^我的待办/}).click();await page.getByRole('heading',{name:'我的待办',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'打开导航'}).getAttribute('aria-expanded'),'false');
 // A real network failure must never look like an empty successful queue.
 await page.route('**/api/v1/tasks',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试服务暂不可用'})}));
 await page.goto(origin+'/#home');await page.getByRole('button',{name:'刷新工作区'}).click();await page.getByRole('alert').filter({hasText:'测试服务暂不可用'}).first().waitFor();
 assert.equal(await page.getByText('当前待办已处理完',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('Workspace passed: primary responsibility across source/assignment/revisions/two teachers/publishing/archive; role scopes, report links, six businesses, board persistence, 5 widths, menu keyboard and error state.');
}finally{
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close();await rm(data,{recursive:true,force:true});
}
