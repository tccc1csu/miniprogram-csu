import ExcelJS from 'exceljs';
import {z} from 'zod';
import {canReportAll} from './auth.js';
import {id,requireThat,HttpError} from './domain.js';
export function assertReporting(u){requireThat(['member','minister','admin'].includes(u.role),403,'工时报表仅供内部计发成员与管理人员使用');}
export async function worklogs(db,u,filters={}){
 assertReporting(u);const params=[];const clauses=[];const add=(sql,value)=>{params.push(value);clauses.push(sql.replace('?', '$'+params.length));};
 if(!canReportAll(u)){if(u.role==='minister')add('w.department_id=?',u.department_id);else add('w.user_id=?',u.id);}
 if(filters.member)add('w.user_id=?',filters.member);
 if(filters.department)add('w.department_id=?',filters.department);
 if(filters.week)add('we.week=?',z.coerce.number().int().min(1).max(53).parse(filters.week));
 if(filters.status==='confirmed')clauses.push('w.confirmed=true');if(filters.status==='pending')clauses.push('w.confirmed=false');
 if(filters.search)add("(t.title ILIKE ? OR u.name ILIKE ? OR w.rule_name ILIKE ?)",'%'+filters.search+'%'); // expanded below
 if(filters.search){const i=params.length;clauses[clauses.length-1]=`(t.title ILIKE $${i} OR u.name ILIKE $${i} OR w.rule_name ILIKE $${i} OR w.source_key ILIKE $${i})`;}
 const date=z.iso.date();if(filters.from)add("(w.created_at AT TIME ZONE 'Asia/Shanghai')::date>=?::date",date.parse(filters.from));if(filters.to)add("(w.created_at AT TIME ZONE 'Asia/Shanghai')::date<=?::date",date.parse(filters.to));
 const rows=(await db.query(`SELECT w.*,u.name,d.name department,t.title,t.number,t.kind AS task_kind,we.week,
    t.notes AS task_description,t.report_note,latest.reason AS audit_reason
   FROM worklogs w JOIN users u ON u.id=w.user_id JOIN departments d ON d.id=w.department_id
   JOIN tasks t ON t.id=w.task_id LEFT JOIN work_entries we ON we.task_id=t.id
   LEFT JOIN LATERAL (
    SELECT reason FROM adjustments a WHERE a.log_id=w.id
    ORDER BY (a.old_units<>a.new_units) DESC,a.created_at DESC,a.id DESC LIMIT 1
   ) latest ON true`+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY w.created_at DESC,w.id',params)).rows;
 return rows.map(({task_description,report_note,audit_reason,...r})=>({
  ...r,hours:r.effective_units/10000,baseHours:r.base_units/10000,amountCents:Math.round(r.effective_units*r.rate_cents/10000),
  taskNote:[task_description,report_note].filter(Boolean).join('\n'),
  adjustmentNote:[r.multiplier!==10000?'系统加急 ×'+r.multiplier/10000:'',audit_reason].filter(Boolean).join('；')
 }));
}
export async function adjust(db,u,logId,input){
 const data=z.object({hours:z.number().positive().max(10000).refine(n=>Math.abs(n*10000-Math.round(n*10000))<0.00001,'最多四位小数'),reason:z.string().trim().min(1).max(2000)}).parse(input);
 return db.transaction(async tx=>{
 const log=(await tx.query('SELECT * FROM worklogs WHERE id=$1 FOR UPDATE',[logId])).rows[0];requireThat(log,404,'工时条目不存在');
 requireThat(u.role==='admin'||(u.role==='minister'&&u.department_id===log.department_id),403,'只能核定本部门成员的工时');
 const units=Math.round(data.hours*10000);
 await tx.query('INSERT INTO adjustments(id,log_id,old_units,new_units,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6)',[id(),logId,log.effective_units,units,data.reason,u.id]);
 await tx.query('UPDATE worklogs SET effective_units=$1,confirmed=true WHERE id=$2',[units,logId]);return {ok:true};
 });
}
export const viewSchema=z.object({name:z.string().trim().min(1).max(80),config:z.object({member:z.string().default(''),department:z.string().default(''),week:z.string().regex(/^(?:[1-9]|[1-4][0-9]|5[0-3])?$/).default(''),status:z.enum(['','pending','confirmed']).default(''),search:z.string().max(200).default(''),from:z.union([z.iso.date(),z.literal('')]).default(''),to:z.union([z.iso.date(),z.literal('')]).default(''),group:z.enum(['','name','department']).default(''),sort:z.enum(['date','hours','name']).default('date'),columns:z.array(z.enum(['name','department','title','rule','date','base','hours','amount','status','source','week','taskNote','adjustmentNote'])).min(1).max(13).default(['name','title','hours','amount','status'])})});
export async function saveView(db,u,input){assertReporting(u);const data=viewSchema.parse(input);const result=await db.query('INSERT INTO saved_views(id,user_id,name,config) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,name) DO UPDATE SET config=$4 RETURNING *',[id(),u.id,data.name,JSON.stringify(data.config)]);return result.rows[0];}
export async function seal(db,u,input){
 requireThat(canReportAll(u),403,'仅办公部部长或管理员可封存中心报表');
 const data=z.object({name:z.string().trim().min(1).max(100),from:z.iso.date(),to:z.iso.date()}).parse(input);
 requireThat(data.to>=data.from,422,'结束日期不能早于开始');
 return db.transaction(async tx=>{
 const rows=await worklogs(tx,u,data);requireThat(rows.length,422,'此区间尚无工时明细');
 const sid=id();await tx.query('INSERT INTO report_seals(id,name,created_by,start_date,end_date) VALUES($1,$2,$3,$4,$5)',[sid,data.name,u.id,data.from,data.to]);
 for(const row of rows)await tx.query('INSERT INTO seal_rows(seal_id,source_id,data) VALUES($1,$2,$3)',[sid,row.id,JSON.stringify(row)]);return {id:sid,count:rows.length};
 });
}
export async function workbook(rows,name='工时明细'){
 const wb=new ExcelJS.Workbook();wb.creator='青年传媒中心';const sheet=wb.addWorksheet(name.slice(0,31));
 sheet.columns=[{header:'姓名',key:'name',width:14},{header:'部门',key:'department',width:14},{header:'任务编号',key:'number',width:23},{header:'工作内容',key:'title',width:45},{header:'工作类型',key:'rule_name',width:30},{header:'日期',key:'date',width:14},{header:'规则工时',key:'baseHours',width:12},{header:'核定工时',key:'hours',width:12},{header:'金额（元）',key:'amount',width:15},{header:'核定状态',key:'status',width:14},{header:'周次',key:'week',width:10},{header:'明细来源',key:'source',width:35},{header:'任务备注',key:'taskNote',width:42,style:{alignment:{wrapText:true,vertical:'top'}}},{header:'工时核定备注',key:'adjustmentNote',width:48,style:{alignment:{wrapText:true,vertical:'top'}}}];
 const dateFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'});
 for(const r of rows)sheet.addRow({...r,date:dateFormatter.format(new Date(r.created_at)),source:r.source_key||r.rule_name,amount:r.amountCents/100,status:r.confirmed?'已核定':'待核定'});
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF334C49'}};sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:'A1',to:'N1'};
 sheet.addRow({rule_name:'合计',hours:rows.reduce((n,r)=>n+r.hours,0),amount:rows.reduce((n,r)=>n+r.amountCents,0)/100}).font={bold:true};
 const summary=wb.addWorksheet('按人汇总');summary.columns=[{header:'姓名',key:'name',width:16},{header:'部门',key:'department',width:16},{header:'工时',key:'hours',width:14},{header:'金额（元）',key:'amount',width:16}];const grouped=new Map();
 for(const row of rows){const r=grouped.get(row.user_id)||{name:row.name,department:row.department,hours:0,amountCents:0};r.hours+=row.hours;r.amountCents+=row.amountCents;grouped.set(row.user_id,r);}
 for(const r of grouped.values())summary.addRow({...r,amount:r.amountCents/100});
 return wb.xlsx.writeBuffer();
}
