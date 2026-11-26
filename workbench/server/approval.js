import {z} from 'zod';
import {canManage} from './auth.js';
import {requireThat,notify} from './domain.js';

const key=z.string().trim().min(1).max(180);
export const teacherPair=z.array(key).length(2);
export const reviewerPair=z.array(key).length(2);

export async function publicationDefaults(tx){
 const config=(await tx.query('SELECT * FROM publication_defaults WHERE singleton')).rows[0];
 return {teacherIds:[config.teacher1_id,config.teacher2_id],reviewerIds:[config.reviewer1_id,config.reviewer2_id]};
}

export async function validPair(tx,ids,role,department){
 if(!ids?.every(Boolean)||new Set(ids).size!==2)return false;
 return (await tx.query(`SELECT id FROM users WHERE id=ANY($1::text[]) AND active AND role=$2
  AND ($3::text IS NULL OR (department_id=$3 AND payable))`,[ids,role,department??null])).rows.length===2;
}

export async function configurePublication(db,user,input){
 requireThat(canManage(user,'operations'),403,'仅运营部长或管理员可设置推文审校');
 const data=z.object({teacherIds:teacherPair.nullable(),reviewerIds:reviewerPair.nullable()}).parse(input);
 return db.transaction(async tx=>{
  if(data.teacherIds)requireThat(await validPair(tx,data.teacherIds,'teacher'),422,'请选两位不同的指导老师');
  if(data.reviewerIds)requireThat(await validPair(tx,data.reviewerIds,'minister','operations'),422,'请选两位不同的运营部长');
  await tx.query('UPDATE publication_defaults SET teacher1_id=$1,teacher2_id=$2,reviewer1_id=$3,reviewer2_id=$4,initialized=true WHERE singleton',[
   ...(data.teacherIds??[null,null]),...(data.reviewerIds??[null,null])
  ]);
  return publicationDefaults(tx);
 });
}

export async function publicationSettings(db,user){
 requireThat(canManage(user,'operations'),403,'仅运营部长或管理员可查看推文设置');
 const defaults=await publicationDefaults(db);
 const teachers=(await db.query(`SELECT u.id,u.name,
  coalesce(d.channel,'') AS channel,coalesce(d.mention,'') AS mention FROM users u
  LEFT JOIN teacher_delivery d ON d.teacher_id=u.id WHERE u.role='teacher' AND u.active ORDER BY u.name,u.id`)).rows;
 return {...defaults,teachers};
}

export async function setTeacherDelivery(db,user,teacherId,input){
 requireThat(canManage(user,'operations'),403,'仅运营部长或管理员可配置老师提醒');
 const data=z.object({channel:z.string().trim().max(200),mention:z.string().trim().max(200)}).parse(input);
 requireThat(Boolean(data.channel)===Boolean(data.mention),422,'请同时填写群路由和 @ 标识，或同时清空');
 requireThat((await db.query("SELECT id FROM users WHERE id=$1 AND role='teacher' AND active",[teacherId])).rows.length,422,'请选择有效老师');
 if(!data.channel)await db.query('DELETE FROM teacher_delivery WHERE teacher_id=$1',[teacherId]);
 else await db.query(`INSERT INTO teacher_delivery(teacher_id,channel,mention) VALUES($1,$2,$3)
 ON CONFLICT(teacher_id) DO UPDATE SET channel=EXCLUDED.channel,mention=EXCLUDED.mention`,[teacherId,data.channel,data.mention]);
}

export async function publicationRouting(tx,task){
 const saved=(await tx.query('SELECT * FROM publication_routing WHERE task_id=$1',[task.id])).rows[0];
 const defaults=await publicationDefaults(tx);
 const ids=[saved?.teacher1_id??defaults.teacherIds[0],saved?.teacher2_id??defaults.teacherIds[1]];
 // Historic reviews remain authoritative about who performed a finished stage.
 for(let index=0;index<2;index++){
  const stage=index===0?'teacher1':'teacher2';
  const review=task.reviews.find(r=>r.stage===stage&&r.decision==='approve');
  if(review)ids[index]=review.actor_id;
 }
 const concluded=task.reviews.some(review=>review.stage==='teacher1'&&review.decision==='approve')
  &&task.reviews.some(review=>review.stage==='teacher2'&&review.decision==='approve');
 if(!concluded&&ids[0]&&ids[0]===ids[1]){
  if(task.reviews.some(r=>r.stage==='teacher1'&&r.decision==='approve'))
   ids[1]=defaults.teacherIds.find(id=>id&&id!==ids[0])??null;
  else ids[0]=defaults.teacherIds.find(id=>id&&id!==ids[1])??null;
 }
 return {source_required:!!saved?.source_required,teacher1_id:ids[0],teacher2_id:ids[1]};
}

export async function saveTeacherPair(tx,taskId,teacherIds){
 requireThat(await validPair(tx,teacherIds,'teacher'),422,'必须选择两位不同的有效指导老师');
 await tx.query(`INSERT INTO publication_routing(task_id,teacher1_id,teacher2_id) VALUES($1,$2,$3)
  ON CONFLICT(task_id) DO UPDATE SET teacher1_id=EXCLUDED.teacher1_id,teacher2_id=EXCLUDED.teacher2_id`,
  [taskId,...teacherIds]);
}

export async function notifyReview(tx,task,eventKey,recipients,message){
 const stage=task.state;
 const base={title:task.title,message,stage,taskPath:'/#task/'+task.id};
 for(const recipient of new Set(recipients.filter(Boolean))){
  const route=['teacher1','teacher2'].includes(stage)
   ?(await tx.query('SELECT channel,mention FROM teacher_delivery WHERE teacher_id=$1',[recipient])).rows[0]
   :null;
  await notify(tx,task.id,eventKey,[recipient],{...base,...(route?{group:route.channel,mention:route.mention}:{})});
 }
}
