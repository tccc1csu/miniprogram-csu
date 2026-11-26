// Public product assets: generated exclusively from a disposable demo database.
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {openDatabase} from '../server/db.js';
import {seed,seedExamples} from '../server/seed.js';
import {createApp} from '../server/app.js';

const db=await openDatabase({memory:true,url:null,schema:null});
let server,browser;
try{
 await seed(db);await seedExamples(db);
 server=await new Promise(resolve=>{const s=createApp(db,{quiet:true}).listen(0,'127.0.0.1',()=>resolve(s));});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await context.request.post(origin+'/api/v1/auth/login',{data:{username:'minister',password:process.env.DEMO_PASSWORD||'Youth2026!'}});
 const page=await context.newPage();await mkdir('src/assets/landing',{recursive:true});
 const task=(await db.query("SELECT id FROM tasks WHERE title='校运会｜商学院赛场纪实'")).rows[0];
 for(const [name,route,ready] of [['tasks','tasks','任务中心'],['review','task/'+task.id,'归档稿件'],['reports','reports','工时与报表']]){
  await page.goto(origin+'/#'+route);await page.locator('nav[aria-label="主导航"]').waitFor();
  if(name==='review'){
   await page.locator('.article-copy').waitFor();
   await page.locator('.article-copy').evaluate(element=>{
    const range=document.createRange();range.setStart(element.firstChild,0);range.setEnd(element.firstChild,3);
    const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
   });
   await page.getByRole('button',{name:'添加批注',exact:true}).click();
   await page.getByLabel('批注意见').fill('请核对获奖信息，并补充照片说明。');
   await page.getByRole('button',{name:'保存批注',exact:true}).click();
   await page.getByRole('button',{name:/请核对获奖信息/}).waitFor();
   await page.locator('.article-review').evaluate(element=>scrollTo(0,element.getBoundingClientRect().top+scrollY-150));
  }
  else await page.getByRole('heading',{name:ready,exact:true}).waitFor();
  await page.locator('.inline-msg').filter({hasText:'正在加载'}).waitFor({state:'hidden'});
  await page.screenshot({path:'src/assets/landing/'+name+'.png',animations:'disabled'});
  console.log('Demo screenshot:',name);
 }
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await db.close();}
