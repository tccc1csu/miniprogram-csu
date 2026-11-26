import {randomUUID} from 'node:crypto';
import {hashPassword} from './auth.js';

const departments=[
 ['office','办公部'],['editorial','采编部'],['operations','运营部'],
 ['photography','摄制部'],['art','美编部'],['original','原创部']
];

export async function initializeProduction(db,env){
 const username=env.BOOTSTRAP_ADMIN_USERNAME?.trim();
 const password=env.BOOTSTRAP_ADMIN_PASSWORD;
 await db.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(78246954)');
  const existing=(await tx.query('SELECT id FROM users LIMIT 1')).rows.length;
  if(!existing){
   if(!username||username.length>100||!password||password.length<16||password.length>200){
    throw new Error('First startup requires BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD (16–200 characters)');
   }
   await tx.query("INSERT INTO users(id,username,name,password_hash,role,payable) VALUES($1,$2,$3,$4,'admin',false)",
    [randomUUID(),username,'工作台管理员',hashPassword(password)]);
  }
  for(const [id,name] of departments){
   await tx.query('INSERT INTO departments(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,name]);
  }
 });
}
