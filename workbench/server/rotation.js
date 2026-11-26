import {z} from 'zod';
import {canManage} from './auth.js';
import {requireThat} from './domain.js';

async function members(db,department){
 return (await db.query(`SELECT u.id,u.name,m.position,
   (u.active AND u.payable AND u.department_id=m.department_id) AS available
   FROM duty_rotation_members m JOIN users u ON u.id=m.user_id
   WHERE m.department_id=$1 ORDER BY m.position`,[department])).rows;
}

function nextMember(roster,lastId){
 const lastPosition=roster.find(person=>person.id===lastId)?.position??0;
 return roster.find(person=>person.available&&person.position>lastPosition)
  ??roster.find(person=>person.available);
}

export async function rotationSettings(db,user,department){
 requireThat(canManage(user,department),403,'只可管理本部门轮值');
 return db.transaction(async tx=>{
  const rotation=(await tx.query('SELECT last_user_id FROM duty_rotation WHERE department_id=$1 FOR SHARE',[department])).rows[0];
  const roster=await members(tx,department);
  return {members:roster,nextId:nextMember(roster,rotation?.last_user_id)?.id??null};
 });
}

export async function saveRotation(db,user,input){
 const data=z.object({
  departmentId:z.enum(['office','editorial','operations','photography','art','original']),
  personIds:z.array(z.string().trim().min(1).max(180)).max(200)
 }).parse(input);
 const {departmentId,personIds}=data;
 requireThat(canManage(user,departmentId),403,'只可管理本部门轮值');
 requireThat(new Set(personIds).size===personIds.length,422,'轮值成员不能重复');
 return db.transaction(async tx=>{
  const rotation=(await tx.query(`INSERT INTO duty_rotation(department_id,updated_by) VALUES($1,$2)
   ON CONFLICT(department_id) DO UPDATE SET updated_by=EXCLUDED.updated_by RETURNING last_user_id`,
   [departmentId,user.id])).rows[0];
  const valid=(await tx.query(`SELECT id FROM users
   WHERE id=ANY($1::text[]) AND department_id=$2 AND active AND payable FOR SHARE`,
   [personIds,departmentId])).rows;
  requireThat(valid.length===personIds.length,422,'请选择本部门的有效轮值成员');
  await tx.query('DELETE FROM duty_rotation_members WHERE department_id=$1',[departmentId]);
  for(const [index,personId] of personIds.entries()){
   await tx.query('INSERT INTO duty_rotation_members(department_id,user_id,position) VALUES($1,$2,$3)',[departmentId,personId,index+1]);
  }
  if(rotation.last_user_id&&!personIds.includes(rotation.last_user_id)){
   await tx.query('UPDATE duty_rotation SET last_user_id=NULL WHERE department_id=$1',[departmentId]);
  }
  const roster=await members(tx,departmentId);
  return {members:roster,nextId:nextMember(roster,rotation.last_user_id)?.id??null};
 });
}

export async function takeRotationTurn(tx,department){
 const rotation=(await tx.query('SELECT * FROM duty_rotation WHERE department_id=$1 FOR UPDATE',[department])).rows[0];
 if(!rotation)return;
 const person=nextMember(await members(tx,department),rotation.last_user_id);
 if(!person)return;
 await tx.query('UPDATE duty_rotation SET last_user_id=$2 WHERE department_id=$1',[department,person.id]);
 return {...person,updated_by:rotation.updated_by,rotation:true};
}
