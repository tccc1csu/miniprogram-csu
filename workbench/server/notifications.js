import {loadTask} from './domain.js';
import {notifyReview} from './approval.js';
import {currentRecipients} from './jobs.js';

export async function scheduleReminders(db,now=new Date()){
 const tasks=(await db.query(`SELECT t.id FROM tasks t
  LEFT JOIN archives a ON a.task_id=t.id
  WHERE a.id IS NULL AND t.kind!='work_entry' AND t.deadline IS NOT NULL AND
   ($1::timestamptz>=t.deadline OR (t.reminder_hours IS NOT NULL AND
    $1::timestamptz>=t.deadline-t.reminder_hours*interval '1 hour'))
  AND NOT EXISTS(SELECT 1 FROM reminders r WHERE r.task_id=t.id AND r.kind=
   CASE WHEN $1::timestamptz>=t.deadline THEN 'overdue' ELSE 'due' END)`,[now.toISOString()])).rows;
 for(const row of tasks)await db.transaction(async tx=>{
  const task=await loadTask(tx,row.id,true);
  if(task.archive_id)return;
  const overdue=now>=new Date(task.deadline);
  const kind=overdue?'overdue':'due';
  const recipients=await currentRecipients(tx,task);
  if(!recipients.some(Boolean))return;
  const inserted=await tx.query('INSERT INTO reminders(task_id,kind) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING kind',[task.id,kind]);
  if(inserted.rows.length)await notifyReview(tx,task,'reminder:'+kind,recipients,
   overdue?'任务已逾期，请处理':'任务即将到期，请处理');
 });
}

export async function deliverNotifications(db,endpoint,token,{send=fetch}={}){
 if(!endpoint)return;
 const rows=await db.transaction(async tx=>(await tx.query(`
  UPDATE outbox SET status='pending',attempts=attempts+1,next_attempt=now()+interval '2 minutes'
  WHERE id IN (
   SELECT id FROM outbox WHERE status IN('unconfigured','pending','failed') AND next_attempt<=now()
   ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED
  ) RETURNING id,task_id,event,recipient_id,payload,attempts`)).rows);
 for(const row of rows)try{
  if(['teacher1','teacher2'].includes(row.payload.stage)){
   const task=await loadTask(db,row.task_id);
   if(task.state!==row.payload.stage||task[task.state+'_id']!==row.recipient_id){
    await db.query("UPDATE outbox SET status='superseded',last_error=NULL WHERE id=$1 AND attempts=$2",[row.id,row.attempts]);
    continue;
   }
   const target=(await db.query('SELECT channel,mention FROM teacher_delivery WHERE teacher_id=$1',[row.recipient_id])).rows[0];
   if(!target){
    await db.query("UPDATE outbox SET status='unconfigured',next_attempt=now()+interval '5 minutes' WHERE id=$1 AND attempts=$2",[row.id,row.attempts]);
    continue;
   }
   Object.assign(row.payload,{group:target.channel,mention:target.mention});
  }
  const response=await send(endpoint,{method:'POST',signal:AbortSignal.timeout(8000),
   headers:{'Content-Type':'application/json','Idempotency-Key':row.id,...(token?{Authorization:'Bearer '+token}:{})},
   body:JSON.stringify(row)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  if((response.headers.get('content-type')||'').includes('application/json')){
   const receipt=await response.json();
   if((receipt.errcode!==undefined&&receipt.errcode!==0)||receipt.ok===false)throw new Error('通知服务未接受此消息');
  }
  await db.query("UPDATE outbox SET status='sent',last_error=NULL WHERE id=$1 AND attempts=$2",[row.id,row.attempts]);
 }catch(error){
  await db.query(`UPDATE outbox SET status='failed',last_error=$2,next_attempt=now()+$3::int*interval '1 minute'
   WHERE id=$1 AND attempts=$4`,[row.id,error.message.slice(0,300),Math.min(60,2**row.attempts),row.attempts]);
 }
}
