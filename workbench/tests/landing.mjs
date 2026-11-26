import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
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
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#home');await page.locator('.landing').waitFor();
 await page.locator('.landing-hero-screen img').evaluate(img=>img.decode());
 const login=await page.locator('.landing-login-card').boundingBox();
 const hero=await page.locator('.landing-hero').boundingBox();
 assert.ok(login.width/hero.width>.23&&login.width/hero.width<.30,'Login is about a quarter of hero width');
 const submit=await page.getByRole('button',{name:'登录',exact:true}).boundingBox();
 assert.ok(submit.y+submit.height<1000,'Sign-in is within first viewport');
 await mkdir('artifacts/landing',{recursive:true});
 await page.screenshot({path:'artifacts/landing/desktop.png',fullPage:true,animations:'disabled'});
 await page.screenshot({path:'artifacts/landing/hero.png',animations:'disabled'});
 for(let i=0;i<3;i++){
  const button=page.locator('.landing-feature-tabs button').nth(i);await button.click();
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  const img=page.locator('.landing-feature-figure img');await img.evaluate(img=>img.decode());
  assert.ok(await img.getAttribute('alt'));
 }
 await page.getByRole('button',{name:'放大工时与报表示例',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 await page.keyboard.press('Tab');
 assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)),'Modal traps keyboard focus');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'放大工时与报表示例',exact:true}).evaluate(b=>b===document.activeElement),true,'Modal returns focus');
 for(let i=0;i<5;i++){
  await page.locator('.landing-role-list button').nth(i).click();
  assert.equal(await page.locator('.landing-role-content li').count(),3);
 }
 await page.getByText('可以用小程序或微信群处理吗？',{exact:true}).click();
 assert.ok(await page.getByText(/微信机器人尚未接通/).isVisible());
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);
  if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'artifacts/landing/mobile.png',fullPage:true,animations:'disabled'});}
 }
 const {id}= (await db.query("SELECT id FROM tasks WHERE title='校运会｜商学院赛场纪实'")).rows[0];
 await page.goto(origin+'/#task/'+id);await page.locator('.landing').waitFor();
 await page.getByRole('button',{name:'使用指南',exact:true}).first().click();
 assert.equal(new URL(page.url()).hash,'#task/'+id);
 await page.getByRole('button',{name:'进入工作台',exact:true}).click();
 assert.equal(await page.getByLabel('账号',{exact:true}).evaluate(e=>e===document.activeElement),true);
 await page.getByLabel('账号',{exact:true}).fill('minister');await page.getByLabel('密码',{exact:true}).fill('wrong-password');
 await page.getByRole('button',{name:'显示密码',exact:true}).click();
 assert.equal(await page.getByLabel('密码',{exact:true}).getAttribute('type'),'text');
 await page.getByRole('button',{name:'隐藏密码',exact:true}).click();
 await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.equal(await page.getByLabel('账号',{exact:true}).inputValue(),'minister');
 await page.getByLabel('密码',{exact:true}).fill(process.env.DEMO_PASSWORD||'Youth2026!');
 await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.locator('nav[aria-label="主导航"]').waitFor();
 await page.getByRole('heading',{name:'校运会｜商学院赛场纪实',exact:true}).waitFor();
 assert.equal(new URL(page.url()).hash,'#task/'+id);
 await page.reload();await page.locator('nav[aria-label="主导航"]').waitFor();
 assert.equal(await page.locator('.landing').count(),0,'Existing session skips landing');
 await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.locator('.landing').waitFor();
 await page.getByText('本地演示 · 选择身份',{exact:true}).click();
 await page.getByRole('button',{name:'运营部长',exact:true}).click();await page.locator('nav[aria-label="主导航"]').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Landing passed: public page, 5 viewport sizes, 3 showcases, 5 guides, modal keyboard focus, login error/retry, deep link, session, logout and local demo.');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await db.close();}
