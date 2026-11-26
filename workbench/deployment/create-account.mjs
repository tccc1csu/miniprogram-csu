import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../server/db.js';
import {openCloudDatabase} from '../server/cloud-db.js';
import {readFile} from 'node:fs/promises';
import {hashPassword} from '../server/auth.js';

const [username,name,role,departmentId]=process.argv.slice(2);
const password=process.env.WORKBENCH_NEW_ACCOUNT_PASSWORD;
const internal=['member','minister'].includes(role);
if(!username||username.length>100||!name||!password||password.length<16||password.length>200||
 !['external','teacher','minister','member','admin'].includes(role)||internal!==Boolean(departmentId)){
 throw new Error('Supply username, name, role, department for a member/minister, and set WORKBENCH_NEW_ACCOUNT_PASSWORD (16–200 characters)');
}
const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
const db=await openCloudDatabase({envId:runtime.envId,key:runtime.key});
try{
 const result=await db.query(`INSERT INTO users(id,username,name,password_hash,role,department_id,payable)
  VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(username) DO NOTHING`,
 [randomUUID(),username,name,hashPassword(password),role,departmentId||null,internal]);
 if(!result.rowCount)throw new Error('Account already exists');
 console.log('Created account:',username);
}finally{await db.close();}
