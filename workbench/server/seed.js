import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './db.js';
import {hashPassword} from './auth.js';
import {createTask,assignTask,submitVersion,reviewTask,publishTask,submitSource} from './domain.js';
export async function seed(db){
 if(process.env.NODE_ENV==='production')throw new Error('Production demo seed is disabled');
 const depts=[['office','办公部'],['editorial','采编部'],['operations','运营部'],['photography','摄制部'],['art','美编部'],['original','原创部']];
 for(const [id,name]of depts)await db.query('INSERT INTO departments(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,name]);
 const rows=[['minister','林知夏','minister','operations'],['minister2','陈予安','minister','operations'],['member','许星禾','member','operations'],['member2','周时宁','member','operations'],['teacher','一审指导老师','teacher',null],['teacher2','二审指导老师','teacher',null],['office','办公部部长','minister','office'],['photo','摄制部部长','minister','photography'],['external','学生会对接人','external',null],['external2','青志部对接人','external',null],['admin','系统管理员','admin',null],
 ['editor','采编部部长','minister','editorial'],['editor2','采编部审校部长','minister','editorial'],
 ['writer','采编部干事','member','editorial'],['office2','办公部干事','member','office'],
 ['photo2','摄制部干事','member','photography'],['photo3','摄制部值班干事','member','photography'],
 ['art','美编部部长','minister','art'],['art2','美编部干事','member','art'],
 ['original','原创部部长','minister','original'],['original2','原创部干事','member','original']];
 const password=hashPassword(process.env.DEMO_PASSWORD||'Youth2026!');
 for(const [id,name,role,dept]of rows)await db.query('INSERT INTO users(id,username,name,password_hash,role,department_id,payable) VALUES($1,$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[id,name,password,role,dept,['member','minister'].includes(role)]);
 await db.query("UPDATE publication_defaults SET teacher1_id='teacher',teacher2_id='teacher2',reviewer1_id='minister',reviewer2_id='minister2',initialized=true WHERE singleton AND NOT initialized");
}
export async function seedExamples(db){
 const people=Object.fromEntries((await db.query('SELECT * FROM users')).rows.map(u=>[u.id,u]));
 const examples=[
  ['校园文化节开幕报道','basic',0,'活动主办方已交供稿。需要公众号首图、活动议程与现场照片。'],
  ['九院联合团支书培训会','basic',1,'从联合活动稿件整理出推文，保留组织单位与活动时间。'],
  ['校运会｜商学院赛场纪实','basic',2,'请复核获奖信息及照片说明后送审。'],
  ['逛一所校园｜秋日影像志','photo',3,'美编部已交插画，运营部按影像志形式排版。'],
  ['研途盲盒 · 毕业条件指南','basic',4,'供稿单位已确认内容，请按原稿校核标题与学院称呼。'],
  ['志愿服务月｜活动回顾','repost',5,'请整理来源信息，转载前核对内容。'],
  ['新生图鉴｜在中南遇见你','basic',6,'开学季专题报道，保留正式发布稿与审核记录。'],
 ];
 for(const [i,[title,layoutType,stage,notes]] of examples.entries()){
  if((await db.query('SELECT id FROM tasks WHERE title=$1',[title])).rows.length)continue;
  const {id}=await createTask(db,people.external,{title,layoutType,deadline:new Date(Date.now()+(i+1)*25*3600000).toISOString(),notes});
  const source=await submitSource(db,people.external,id,{body:notes});
  if(stage<1)continue;
  await reviewTask(db,people.editor,id,{stage:'editorial',decision:'approve',versionId:source.id,reason:'演示供稿已核对'});
  await assignTask(db,people.minister,id,{assigneeId:'member',reviewerIds:['minister','minister2']});
  if(stage<2)continue;
  const version=await submitVersion(db,people.member,id,{body:title+'\n\n这是一份用于工作台试用的示例稿件。活动团队已确认供稿，排版稿保留现场记录、活动背景和成果说明。'});
  for(const [n,step,actor] of [[3,'internal','minister'],[4,'teacher1','teacher'],[5,'teacher2','teacher2']]){
   if(stage>=n)await reviewTask(db,people[actor],id,{stage:step,decision:'approve',versionId:version.id,reason:'示例审校通过'});
  }
  if(stage>=6)await publishTask(db,people.member,id,{url:'https://example.org/',versionId:version.id});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const db=await openDatabase({url:null,schema:null});try{await seed(db);if(process.argv.includes('--examples'))await seedExamples(db);}finally{await db.close();}console.log('本地开发账号初始化完成；账号说明见 README。');}
