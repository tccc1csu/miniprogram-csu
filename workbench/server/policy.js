import {z} from 'zod';
import {id, requireThat} from './domain.js';

export const hoursValue=z.number().positive().max(1000)
 .refine(n=>Math.abs(n*10000-Math.round(n*10000))<0.00001,'工时最多四位小数');

export async function policy(db,version){
 return (await db.query(version
  ? 'SELECT * FROM workflow_policy WHERE version=$1'
  : 'SELECT * FROM workflow_policy ORDER BY version DESC LIMIT 1',version?[version]:[])).rows[0];
}

export async function rulesFor(db,version){
 return (await db.query(`SELECT r.*,coalesce(v.units,r.units) AS units
  FROM labor_rules r LEFT JOIN rule_revisions v ON v.rule_id=r.id AND v.policy_version=$1 ORDER BY r.id`,[version])).rows;
}

export async function updatePolicy(db,user,input){
 requireThat(user.role==='admin',403,'只有管理员可维护规则');
 const data=z.object({
  expectedVersion:z.number().int().positive(),rateCents:z.number().int().min(1).max(1000000),
  urgentFactor:z.number().int().min(10000).max(100000),
  photoWindow:z.number().int().min(1).max(720),publicationWindow:z.number().int().min(1).max(720),
  reason:z.string().trim().min(1).max(2000),rules:z.array(z.object({id:z.number().int(),hours:hoursValue})).max(24).default([])
 }).parse(input);
 return db.transaction(async tx=>{
  await tx.query('LOCK TABLE workflow_policy IN SHARE ROW EXCLUSIVE MODE');
  const previous=await policy(tx);
  requireThat(previous.version===data.expectedVersion,409,'规则已更新，请刷新后再保存');
  const oldRules=await rulesFor(tx,previous.version);
  for(const edit of data.rules){
   requireThat(oldRules.some(rule=>rule.id===edit.id&&!rule.review),422,'审核基础规则固定为 2 小时');
  }
  const next=(await tx.query(`INSERT INTO workflow_policy(rate_cents,urgent_factor,photo_window,publication_window,updated_by,reason)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[data.rateCents,data.urgentFactor,data.photoWindow,data.publicationWindow,user.id,data.reason])).rows[0];
  const edits=new Map(data.rules.map(rule=>[rule.id,Math.round(rule.hours*10000)]));
  for(const rule of oldRules){
   await tx.query('INSERT INTO rule_revisions(policy_version,rule_id,units) VALUES($1,$2,$3)',
    [next.version,rule.id,edits.get(rule.id)??rule.units]);
  }
  return next;
 });
}

export async function addContribution(tx,task,settings,{person,kind,rule,units,name,source='',multiplier=10000}){
 requireThat(person?.payable&&person.active&&['minister','member'].includes(person.role),409,'计发成员资料失效，请核对或强制归档');
 const base=units??rule.units;
 await tx.query(`INSERT INTO worklogs(id,task_id,user_id,department_id,kind,rule_name,base_units,effective_units,rate_cents,source_key,rule_id,rule_version,multiplier)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[
  id(),task.id,person.id,person.department_id,kind,name??rule.name,base,Math.round(base*multiplier/10000),
  settings.rate_cents,source,rule?.id??null,settings.version,multiplier
 ]);
}

export async function activePerson(tx,personId,department){
 const row=(await tx.query('SELECT * FROM users WHERE id=$1 AND active AND payable FOR SHARE',[personId])).rows[0];
 requireThat(row&&(!department||row.department_id===department),422,'请选择所属部门的有效内部成员');
 return row;
}
