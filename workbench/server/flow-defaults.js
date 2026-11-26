import {z} from 'zod';
import {canManage} from './auth.js';
import {event, notify, requireThat} from './domain.js';
import {activePerson} from './policy.js';

const kinds=z.enum(['publication','web_article','photo','request','design']);

export async function defaultAssignee(tx,department,kind){
 return (await tx.query(`SELECT u.id,u.name,f.updated_by FROM flow_defaults f JOIN users u ON u.id=f.assignee_id
  WHERE f.department_id=$1 AND f.kind=$2 AND u.department_id=f.department_id AND u.active AND u.payable`,
  [department,kind])).rows[0];
}

export async function saveFlowDefault(tx,user,department,kind,personId){
 requireThat(canManage(user,department),403,'仅本部部长或管理员可设置默认承接');
 kinds.parse(kind);
 await activePerson(tx,personId,department);
 await tx.query(`INSERT INTO flow_defaults(department_id,kind,assignee_id,updated_by)
  VALUES($1,$2,$3,$4) ON CONFLICT(department_id,kind) DO UPDATE
  SET assignee_id=EXCLUDED.assignee_id,updated_by=EXCLUDED.updated_by,updated_at=now()`,
  [department,kind,personId,user.id]);
}

export async function listFlowDefaults(db,user,department){
 requireThat(canManage(user,department),403,'仅本部部长或管理员可查看默认承接');
 return (await db.query(`SELECT f.kind,u.id,u.name,
  (u.active AND u.payable AND u.department_id=f.department_id) AS available
  FROM flow_defaults f JOIN users u ON u.id=f.assignee_id WHERE f.department_id=$1 ORDER BY f.kind`,
  [department])).rows;
}

export async function clearFlowDefault(db,user,department,kind){
 requireThat(canManage(user,department),403,'仅本部部长或管理员可取消默认承接');
 await db.query('DELETE FROM flow_defaults WHERE department_id=$1 AND kind=$2',[department,kinds.parse(kind)]);
}

export async function automaticallyAssign(tx,task,person){
 await tx.query('INSERT INTO assignments(task_id,assignee_id,actor_id,automatic) VALUES($1,$2,$3,true)',
  [task.id,person.id,person.updated_by]);
 await event(tx,task.id,{id:person.updated_by},person.rotation?'按轮值顺序派发':'按默认承接人派发',person.name);
 await notify(tx,task.id,person.rotation?'rotation-assigned':'default-assigned',[person.id],{title:task.title,message:'你有一项任务待处理'});
}
