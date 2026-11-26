import {z} from 'zod';
import sanitizeHtml from 'sanitize-html';
import {parseDocument,DomUtils} from 'htmlparser2';
import {canManage} from './auth.js';
import {id,loadTask,requireThat} from './domain.js';

const tags=['article','section','div','p','h1','h2','h3','h4','h5','h6','span','strong','b','em','i',
 'u','s','sup','sub','ul','ol','li','blockquote','br','hr','img','a','figure','figcaption','pre','code'];
const color=/^(?:#[\da-f]{3,8}|rgba?\([\d ,.]+\)|[a-z]{1,20})$/i;
const validImage=src=>{
 try{const url=new URL(src);return url.protocol==='https:'&&
  (url.hostname==='mmbiz.qpic.cn'||url.hostname==='mmbiz.qlogo.cn');}catch{return false;}
};
export function cleanPreview(html){
 return sanitizeHtml(html.replace(/\r\n?/g,'\n').replace(/\0/g,''),{
  allowedTags:tags,
  allowedAttributes:{'*':['style'],img:['src','alt','loading','referrerpolicy'],a:['href','rel','target']},
  allowedStyles:{'*':{'text-align':[/^(left|right|center|justify)$/],color:[color],'background-color':[color],
   'font-weight':[/^(bold|normal|[1-9]00)$/],'font-style':[/^(italic|normal)$/]}},
  allowedSchemes:['https','http'],
  allowProtocolRelative:false,
  transformTags:{
   a:(_tag,attributes)=>({tagName:'a',attribs:{...attributes,rel:'noopener noreferrer',target:'_blank'}}),
   img:(_tag,attributes)=>({tagName:'img',attribs:{src:attributes['data-src']||attributes.src||'',
    alt:attributes.alt||'',loading:'lazy',referrerpolicy:'no-referrer'}})
  },
  exclusiveFilter:frame=>frame.tag==='img'&&!validImage(frame.attribs.src)
 });
}
export function articleText(version){
 return version.preview_html?DomUtils.textContent(parseDocument(version.preview_html)):version.body;
}

export function mayReviewPublication(user,task,stage){
 if(stage==='editorial')return canManage(user,'editorial');
 if(stage==='internal')return user.role==='admin'||task.reviewers.some(reviewer=>reviewer.id===user.id);
 if(stage==='teacher1'||stage==='teacher2')return user.role==='teacher'&&task[stage+'_id']===user.id;
 return false;
}

export async function addAnnotation(db,user,taskId,input){
 const data=z.object({versionId:z.string().min(1),start:z.number().int().nonnegative(),
  end:z.number().int().nonnegative(),quote:z.string().min(1).max(3000),
  body:z.string().trim().min(1).max(3000)}).parse(input);
 return db.transaction(async tx=>{
  const task=await loadTask(tx,taskId,true);
  const stage=task.state;
  requireThat(task.kind==='publication'&&mayReviewPublication(user,task,stage),403,'当前环节不允许此账号添加批注');
  const version=stage==='editorial'?task.source:task.version;
  requireThat(version?.id===data.versionId,409,'稿件已更新，请重新选择文字');
  const body=articleText(version);
  requireThat(data.end>data.start&&data.end<=body.length&&body.slice(data.start,data.end)===data.quote&&data.quote.trim(),
   422,'批注原文与选区不符，请重新选择文字');
  const annotationId=id();
  await tx.query(`INSERT INTO version_annotations(id,task_id,version_id,stage,actor_id,start_offset,end_offset,quote,body)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [annotationId,task.id,version.id,stage,user.id,data.start,data.end,data.quote,data.body]);
  return {id:annotationId};
 });
}

export async function listAnnotations(db,taskId,{sourceOnly=false}={}){
 return (await db.query(`SELECT a.*,u.name AS actor_name FROM version_annotations a
  JOIN users u ON u.id=a.actor_id WHERE a.task_id=$1`+
  (sourceOnly?" AND a.stage='editorial'":"")+" ORDER BY a.created_at,a.id",[taskId])).rows;
}
