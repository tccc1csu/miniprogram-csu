import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Archive,ArrowDown,ArrowLeft,ArrowRight,ArrowUp,ArrowUpRight, Bell,BookOpen,Check,ChevronRight,Clock3,Download,Eye,EyeOff,FileText,Inbox,LayoutDashboard,ListTodo,LogOut,Menu,Paperclip,Plus,RefreshCw,Save,Search,ShieldCheck,SlidersHorizontal,Table2,X} from 'lucide-react';
import LandingPage from './LandingPage.jsx';
import {WorkspaceHome,WorkspaceTasks,workspaceNavigation} from './Workspace.jsx';

import {CreateWorkflow, ForceArchive, InboxView, JobDetail, TaskReportNote, TeacherFields, WorkflowSettings, kinds} from './Workflows.jsx';

import {ArticlePreview, ManuscriptFields, reviewLabels} from './ArticlePreview.jsx';

const root='/api/v1';
const roles={member:'干事',minister:'部长',teacher:'指导老师',admin:'管理员',external:'兄弟组织'};
const types={basic:'基础排版',photo:'影像志排版',repost:'内容转载'};
const stages=reviewLabels;
const statusTone={source_pending:'amber',source_returned:'red',editorial:'violet',awaiting_assignment:'amber',awaiting_submission:'blue',internal:'violet',teacher1:'violet',teacher2:'violet',awaiting_publish:'blue',archived:'green',returned:'red',content:'violet',acceptance:'violet',recorded:'green'};
const steps=[['awaiting_assignment','接单'],['awaiting_submission','排版'],['internal','内审'],['teacher1','一审'],['teacher2','二审'],['awaiting_publish','发布'],['archived','归档']];
const cnDate=d=>d?new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}).format(new Date(d)):'—';
const cnTime=d=>d?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(d)):'—';
const currency=c=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(c/100);
const formatHours=h=>Number(Number(h).toFixed(4)).toString();
function archiveTerm(date){
 if(!date)return '';
 const [year,month]=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(date)).split('-').map(Number);
 return month>=9?year+' 秋季学期':month<=2?(year-1)+' 秋季学期':year+' 春季学期';
}
const isOps=u=>u.role==='admin'||(u.role==='minister'&&u.departmentId==='operations');
const canReport=u=>['admin','minister','member'].includes(u.role);
const allReport=u=>u.role==='admin'||(u.role==='minister'&&u.departmentId==='office');
const navigate=path=>{location.hash=path;};
const getRoute=()=>location.hash.replace(/^#\/?/,'')||'home';
const href=path=>'#'+path;

async function api(path,options={}){
 const {body,method='GET',...rest}=options;
 const headers={'X-Requested-With':'workbench',...rest.headers};
 if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
 const res=await fetch(root+path,{...rest,method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
 const payload=await res.json().catch(()=>null);
 if(!res.ok)throw Object.assign(new Error(payload?.error||'请求未完成，请重试'),{status:res.status});
 return payload;
}
const setBody=(method,body)=>({method,body});
function useRemote(url,version=0){
 const [value,set]=useState({data:null,pending:true,error:''});
 useEffect(()=>{let live=true;set(previous=>previous.url===url?{...previous,pending:true,error:''}:{data:null,pending:!!url,error:'',url});if(url)api(url).then(data=>{if(live)set({data,pending:false,error:'',url});}).catch(e=>{if(live)set({data:null,pending:false,error:e.message,url});});return()=>{live=false;};},[url,version]);
 return value;
}
function Btn({icon:Icon,children,kind='',...props}){return <button className={'btn '+kind} {...props}>{Icon&&<Icon size={16} aria-hidden="true"/>}{children}</button>;}
function LinkBtn({icon:Icon,children,to,kind='',...props}){return <a className={'btn '+kind} href={to} {...props}>{Icon&&<Icon size={16} aria-hidden="true"/>}{children}</a>;}
function Badge({task}){return <span className={'badge '+(statusTone[task.state]||'')}>{task.stateLabel}</span>;}
function Brand(){return <div className="brand"><div className="brand-mark"><BookOpen size={23}/></div><div><strong>青年传媒中心</strong><span>协作工作台</span></div></div>;}
function Empty({title='暂无记录',detail,icon:Icon=Inbox}){return <div className="empty"><Icon size={25}/><strong>{title}</strong>{detail&&<span>{detail}</span>}</div>;}
function Feedback({pending,error}){return pending?<div className="inline-msg">正在加载…</div>:error?<div className="error" role="alert">{error}</div>:null;}
function Heading({title,desc,children}){return <div className="heading"><div><h1>{title}</h1>{desc&&<p>{desc}</p>}</div>{children&&<div className="heading-actions">{children}</div>}</div>;}
function Dialog({title,onClose,children}){
 useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 return <div className="overlay" onClick={e=>{if(e.currentTarget===e.target)onClose();}}><section className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-head"><h2>{title}</h2><button type="button" className="icon" aria-label="关闭" onClick={onClose}><X size={20}/></button></div>{children}</section></div>;
}
function Login({onLogin,local}){
 const [username,setUser]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false),[showPassword,setShowPassword]=useState(false);
 async function enter(credentials){setError('');setPending(true);try{const result=await api('/auth/login',setBody('POST',credentials));onLogin(result.user);}catch(e){setError(e.message);}finally{setPending(false);}}
 return <LandingPage><form aria-label="登录工作台" onSubmit={e=>{e.preventDefault();if(!pending)enter({username,password});}}><label htmlFor="welcome-username">账号</label><input id="welcome-username" name="username" placeholder="请输入你的账号" required value={username} autoComplete="username" spellCheck={false} onChange={e=>setUser(e.target.value)}/><label htmlFor="welcome-password">密码</label><div className="landing-password-wrap"><input id="welcome-password" name="password" placeholder="请输入密码" type={showPassword?'text':'password'} required value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={showPassword?'隐藏密码':'显示密码'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><Feedback error={error}/><button className="landing-login-submit" disabled={pending}>{pending?'登录中…':'登录'}<ArrowRight size={16}/></button></form><p className="landing-account-help"><ShieldCheck size={13}/>账号由中心统一提供。还没有账号？请联系管理员。</p>{local&&<details className="landing-demo"><summary>本地演示 · 选择身份<ChevronRight size={13}/></summary><div className="demo-actions">{[['minister','运营部长'],['member','排版干事'],['teacher','一审老师'],['teacher2','二审老师'],['office','办公部'],['external','需求方'],['editor','采编部长'],['office2','办公干事'],['photo','摄制部长'],['photo2','摄制干事'],['art','美编部长'],['art2','美编干事'],['original','原创部长'],['admin','管理员']].map(([name,label])=><Btn key={name} type="button" disabled={pending} onClick={()=>enter({username:name,password:'Youth2026!'})}>{label}</Btn>)}</div></details>}</LandingPage>;
}
function ActionForm({onSubmit,children,label='保存',secondary,busy=false}){
 const [error,setError]=useState(''),[pending,setPending]=useState(false);
 return <form className="form" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setPending(true);setError('');try{await onSubmit(data,e.nativeEvent.submitter?.value);}catch(e){setError(e.message);}finally{setPending(false);}}}>{children}<Feedback error={error}/><div className="form-actions">{secondary}<Btn kind="primary" disabled={pending||busy}>{pending?'提交中…':label}</Btn></div></form>;
}
const dateInput=()=>{const d=new Date(Date.now()+3*86400000);return new Date(d-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);};
async function sendFiles(taskId,files){const ids=[];for(const file of files){if(!file?.size)continue;const fd=new FormData();fd.append('file',file);ids.push((await api('/tasks/'+taskId+'/files',setBody('POST',fd))).id);}return ids;}
function taskOwner(t){
 if(t.state==='archived')return t.archive_reason?'强制归档':'已完成';
 if(t.state==='recorded')return '已登记';
 if(['awaiting_assignment','acceptance'].includes(t.state))return (t.department_name||'运营部')+'部长';
 if(t.state==='internal')return '运营部审校部长';
 if(t.state==='editorial')return '采编部部长';
 if(['source_pending','source_returned'].includes(t.state))return '需求方';
 if(['teacher1','teacher2'].includes(t.state))return t[t.state+'_name']||'待指定老师';
 if(t.state==='content')return '指导老师';
 return t.assignee_name||'承接人';
}
function TaskDetail({taskId,user,version,refresh,publicTask}){
 const remote=useRemote(publicTask?null:'/tasks/'+taskId,version);
 const [mode,setMode]=useState('');const [notice,setNotice]=useState('');const [selected,setSelected]=useState(null);
 const people=useRemote(['assign','teachers'].includes(mode)?'/workflow/options':null);
 if(publicTask)return <><LinkBtn to={href('tasks')} kind="quiet" icon={ArrowLeft}>任务中心</LinkBtn><Heading title={publicTask.title} desc={publicTask.number+' · 截止 '+cnTime(publicTask.deadline)}/><section className="panel"><h2>组织报名</h2><ActionForm label="确认报名" onSubmit={async d=>{const fileIds=await sendFiles(taskId,d.getAll('files'));await api('/tasks/'+taskId+'/register',setBody('POST',{notes:d.get('notes'),fileIds}));setNotice('报名已登记');refresh();}}><label>报名说明<textarea rows="4" name="notes"/></label><label>报名材料<input type="file" name="files" multiple/></label></ActionForm>{notice&&<div className="success" role="status">{notice}</div>}</section></>;
 if(!remote.data)return <Feedback pending={remote.pending} error={remote.error}/>;
 if(remote.data.task.kind&&remote.data.task.kind!=='publication')return <JobDetail detail={remote.data} user={user} refresh={refresh} onLinked={id=>navigate('task/'+id)}/>;
 const {task:t,versions,reviews,files,events,contributions,registrations,linked=[],linkedFiles=[],annotations=[]}=remote.data;
 const reviewVersion=t.state==='editorial'?t.source:t.version;
 const current=versions.find(x=>x.id===selected)||reviewVersion||versions[0];
 const manager=isOps(user),executor=t.assignee_id===user.id||manager;
 const mayReview=t.state==='editorial'&&(user.role==='admin'||user.role==='minister'&&user.departmentId==='editorial')
  ||t.state==='internal'&&(user.role==='admin'||t.reviewers?.some(x=>x.id===user.id))
  ||['teacher1','teacher2'].includes(t.state)&&t[t.state+'_id']===user.id;
 const maySource=t.source_required&&['source_pending','source_returned'].includes(t.state)&&(user.role==='external'||user.role==='admin');
 const maySubmit=executor&&['awaiting_submission','returned','internal'].includes(t.state),mayAssign=manager&&['awaiting_assignment','awaiting_submission'].includes(t.state),mayPublish=executor&&t.state==='awaiting_publish';
 const mayChangeTeachers=manager&&['internal','teacher1','teacher2','returned'].includes(t.state);
 const choices=people.data?.people||[];
 const ops=choices.filter(p=>p.department_id==='operations');
 const teachers=choices.filter(p=>p.role==='teacher');
 const teacherIds=[t.teacher1_id,t.teacher2_id];
 const done=async(path,body,message)=>{await api('/tasks/'+taskId+'/'+path,setBody('POST',body));setMode('');setNotice(message);refresh();};
 const articleSteps=t.source_required?[['source_pending','交供稿'],['editorial','采编审核'],...steps]:steps;
 const index=articleSteps.findIndex(([s])=>s===(t.state==='source_returned'?'source_pending':t.state));
 return <><div className="crumb"><a href={href('tasks')}><ArrowLeft size={16}/>任务中心</a><ChevronRight size={13}/><span>{t.number}</span></div><Heading title={t.title} desc={t.number+' · '+(types[t.layout_type]||'公众号排版')}><Badge task={t}/>{maySource&&<Btn kind="primary" icon={FileText} onClick={()=>setMode('source')}>{t.state==='source_returned'?'修改并重交供稿':'提交供稿'}</Btn>}{mayAssign&&<Btn icon={Plus} kind="primary" onClick={()=>setMode('assign')}>安排排版</Btn>}{maySubmit&&<Btn icon={FileText} kind={mayReview?'':'primary'} onClick={()=>setMode('submit')}>提交稿件</Btn>}{mayReview&&<Btn icon={Check} kind="primary" onClick={()=>setMode('review')}>{t.state==='editorial'?'处理采编审核':'处理审核'}</Btn>}{mayChangeTeachers&&<Btn kind="quiet" onClick={()=>setMode('teachers')}>调整两审老师</Btn>}{mayPublish&&<Btn icon={Archive} kind="primary" onClick={()=>setMode('publish')}>确认发布</Btn>}{manager&&t.state!=='archived'&&<Btn kind="quiet" onClick={()=>setMode('force')}>强制归档</Btn>}</Heading>
 {t.archive_reason&&<div className="inline-msg">强制归档 · 工时未自动核算。{t.archive_reason}</div>}
 {notice&&<div className="success" role="status">{notice}</div>}
 <div className="steps" aria-label="任务进度">{articleSteps.map(([k,label],i)=><div key={k} className={(i<index?'done':'')+(i===index?' active':'')}><span>{i<index?<Check size={13}/>:i+1}</span>{label}</div>)}</div>
 <div className="detail-columns"><div><section className="panel"><h2>任务信息</h2><dl className="facts"><div><dt>承接部门</dt><dd>运营部</dd></div><div><dt>承接人</dt><dd>{t.assignee_name||'—'}</dd></div><div><dt>截止时间</dt><dd>{cnTime(t.deadline)}</dd></div><div><dt>当前处理</dt><dd>{taskOwner(t)}</dd></div><div><dt>审校人员</dt><dd>{t.reviewers?.map(x=>x.name).join('、')||'—'}</dd></div>{user.role!=='external'&&<><div><dt>一审老师</dt><dd>{t.teacher1_name||'—'}</dd></div><div><dt>二审老师</dt><dd>{t.teacher2_name||'—'}</dd></div></>}<div><dt>优先级</dt><dd>{t.urgent?'加急':'普通'}</dd></div></dl>{t.notes&&<p className="prose">{t.notes}</p>}<TaskReportNote task={t} user={user} refresh={refresh}/>{t.sourceFeedback&&<p className="prose">采编意见：{t.sourceFeedback}</p>}{t.publication_url&&<a className="text-link" href={t.publication_url} target="_blank" rel="noreferrer">正式发布成果 <ArrowUpRight size={16}/></a>}</section>
 <section className="panel"><div className="panel-head"><h2>{t.state==='archived'?'归档稿件':'稿件与版本'}</h2>{versions.length>0&&<select aria-label="稿件版本" value={current?.id} onChange={e=>setSelected(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>{v.phase==='source'?'供稿 · ':t.source_required?'排版 · ':''}第 {v.number} 版</option>)}</select>}</div>{current?<><div className="subtle">{current.author_name} · {cnTime(current.created_at)}</div>{current.preview_url&&<a className="text-link" href={current.preview_url} target="_blank" rel="noreferrer">打开公众号原预览 <ArrowUpRight size={15}/></a>}<ArticlePreview key={current.id} version={current} annotations={annotations} canAnnotate={mayReview&&current.id===reviewVersion?.id} taskId={taskId} onSaved={refresh}/><FileList files={current.files}/></>:<div className="subtle">尚未提交稿件</div>}</section>
 <section className="panel"><div className="panel-head"><h2>任务材料</h2>{user.role==='external'&&t.state!=='archived'&&<Btn icon={Paperclip} onClick={()=>setMode('files')}>补材料</Btn>}</div><FileList files={files} empty/>{linked.map(item=><p key={item.id}><a className="row-link" href={href('task/'+item.id)}>关联挂网 · {item.title}</a></p>)}<FileList files={linkedFiles}/><div className="subtle">{registrations.length?registrations.length+' 条报名记录':''}</div></section>
 {contributions.length>0&&<section className="panel"><h2>工时明细</h2><ul className="plain-list">{contributions.map(c=><li key={c.id}><span>{c.name} · {c.kind==='creator'?'排版':'审校'}</span><strong>{formatHours(c.effective_units/10000)} h</strong></li>)}</ul></section>}</div>
 <div><section className="panel"><h2>处理时间线</h2>{events.length?<ol className="timeline">{[...events].reverse().map(e=><li key={e.id}><strong>{e.action}</strong><small>{e.actor_name} · {cnTime(e.created_at)}</small>{e.detail&&<p>{e.detail}</p>}</li>)}</ol>:<div className="subtle">{t.stateLabel}</div>}</section>{reviews.length>0&&<section className="panel"><h2>审校记录</h2><ul className="plain-list review-list">{[...reviews].reverse().map(r=><li key={r.id}><span>{stages[r.stage]} · {r.actor_name}<small>{versions.find(v=>v.id===r.version_id)?.number||'—'} 版 · {r.reason||'无补充意见'}</small></span><strong className={r.decision==='approve'?'good':'bad'}>{r.decision==='approve'?'通过':'退回'}</strong></li>)}</ul></section>}</div></div>
 {mode==='source'&&<Dialog title="提交采编审核" onClose={()=>setMode('')}><ActionForm label="提交采编审核" onSubmit={async d=>{
 const uploaded=await sendFiles(taskId,d.getAll('files'));
 const fileIds=uploaded.length?uploaded:(!d.get('body')?.trim()&&!d.get('previewHtml')?(versions.find(v=>v.phase==='source')?.files||[]).map(f=>f.id):[]);
 await done('source',{body:d.get('body'),previewHtml:d.get('previewHtml'),fileIds},'供稿已提交采编审核');setSelected(null);
 }}><ManuscriptFields source initialBody={versions.find(v=>v.phase==='source')?.body} initialHtml={versions.find(v=>v.phase==='source')?.preview_html}/></ActionForm></Dialog>}
 {mode==='teachers'&&<Dialog title="调整两审老师" onClose={()=>setMode('')}><Feedback pending={people.pending} error={people.error}/>{people.data&&<ActionForm label="保存两审老师" onSubmit={async d=>{
 await api('/tasks/'+taskId+'/teachers',setBody('PUT',{teacherIds:[d.get('teacher1'),d.get('teacher2')]}));setMode('');setNotice('两审老师已更新');refresh();
 }}><TeacherFields teachers={teachers} ids={teacherIds} lockFirst={t.state==='teacher2'}/></ActionForm>}</Dialog>}
 {mode==='assign'&&<Dialog title="安排排版" onClose={()=>setMode('')}><Feedback pending={people.pending} error={people.error}/>{people.data&&<ActionForm label="确认派发" onSubmit={d=>done('assign',{assigneeId:d.get('member'),reviewerIds:[d.get('reviewer1'),d.get('reviewer2')],teacherIds:[d.get('teacher1'),d.get('teacher2')],remember:d.has('remember'),rememberReviewers:d.has('rememberReviewers')},'已安排排版')}><label>承接人<select required name="member" defaultValue={t.assignee_id||''}><option value="">请选择成员</option>{ops.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="form-grid">{[1,2].map(i=><label key={i}>审校部长 {i}<select required name={'reviewer'+i} defaultValue={t.reviewers?.[i-1]?.id||''}><option value="">请选择部长</option>{ops.filter(p=>p.role==='minister').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div>
 <TeacherFields teachers={teachers} ids={teacherIds}/>
 <label className="check"><input name="rememberReviewers" type="checkbox"/>设为默认内审部长组合</label>
 <label className="check"><input name="remember" type="checkbox"/>设为此流程默认承接人</label>
 </ActionForm>}</Dialog>}
 {mode==='submit'&&<Dialog title="提交稿件版本" onClose={()=>setMode('')}><ActionForm label="提交内审" onSubmit={async d=>{const fileIds=await sendFiles(taskId,d.getAll('files'));await done('versions',{body:d.get('body'),previewUrl:d.get('preview'),previewHtml:d.get('previewHtml'),fileIds},'新版本已提交内审');setSelected(null);}}><ManuscriptFields initialBody={t.version?.body||t.source?.body||''} initialPreview={t.version?.preview_url} initialHtml={t.version?.preview_html||t.source?.preview_html}/></ActionForm></Dialog>}
 {mode==='review'&&<Dialog title={stages[t.state]} onClose={()=>setMode('')}><ActionForm label="确认意见" onSubmit={d=>done('reviews',{stage:t.state,versionId:reviewVersion.id,decision:d.get('decision'),reason:d.get('reason')},d.get('decision')==='approve'?'审核已通过':'稿件已退回')}><div className="subtle">当前稿件：第 {reviewVersion.number} 版</div><label>审校结果<select name="decision"><option value="approve">通过</option><option value="reject">退回修改</option></select></label><label>审校意见<textarea name="reason" rows="4" placeholder="退回时填写修改原因，或先添加文中批注"/></label></ActionForm></Dialog>}
 {mode==='publish'&&<Dialog title="确认发布" onClose={()=>setMode('')}><ActionForm label="确认并自动归档" onSubmit={d=>done('publish',{url:d.get('url'),versionId:t.version.id},'已自动归档，内部工时已生成')}><label>正式发布链接<input required type="url" name="url" placeholder="https://mp.weixin.qq.com/…"/></label></ActionForm></Dialog>}
 {mode==='force'&&<ForceArchive task={t} onClose={()=>setMode('')} onDone={()=>{setMode('');setNotice('已强制归档');refresh();}}/>}
 {mode==='files'&&<Dialog title="补充任务材料" onClose={()=>setMode('')}><ActionForm label="上传材料" onSubmit={async d=>{await sendFiles(taskId,d.getAll('files'));setMode('');setNotice('材料已上传');refresh();}}><label>附件<input type="file" name="files" required multiple/></label></ActionForm></Dialog>}</>;
}
function FileList({files=[],empty=false}){return files.length?<ul className="file-list">{files.map(f=><li key={f.id}><a href={root+'/files/'+f.id}><Paperclip size={15}/><span>{f.name}</span><small>{Math.max(1,Math.round(f.size/1024))} KB</small><Download size={15}/></a></li>)}</ul>:empty?<div className="subtle">暂无材料</div>:null;}

const columns={taskNote:['任务备注',r=><span className="report-note">{r.taskNote||'—'}</span>],adjustmentNote:['工时核定备注',r=><span className="report-note">{r.adjustmentNote||'—'}</span>],source:['明细来源',r=>r.source_key||r.rule_name],week:['教学周次',r=>r.week??'—'],name:['姓名',r=>r.name],department:['部门',r=>r.department],title:['工作内容',r=><a className="row-link" href={href('task/'+r.task_id)}>{r.title}</a>],rule:['工时类型',r=>r.rule_name],date:['日期',r=>cnDate(r.created_at)],base:['规则工时',r=>formatHours(r.baseHours)+' h'],hours:['核定工时',r=>formatHours(r.hours)+' h'],amount:['金额',r=>currency(r.amountCents)],status:['状态',r=><span className={'badge '+(r.confirmed?'green':'amber')}>{r.confirmed?'已核定':'待核定'}</span>]};
const defaultView={member:'',department:'',week:'',status:'',search:'',from:'',to:'',group:'',sort:'date',columns:['name','department','title','rule','base','hours','adjustmentNote','amount','status']};
function queryString(conf){return new URLSearchParams(Object.fromEntries(['member','department','week','status','search','from','to'].filter(k=>conf[k]).map(k=>[k,conf[k]]))).toString();}
const dateInChina=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(d);
function thisWeek(){const now=new Date(),day=new Date(dateInChina(now)+'T12:00:00Z');const start=new Date(day);start.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);return {from:start.toISOString().slice(0,10),to:dateInChina(now)};}
function Reports({user,version,refresh,query=''}){
 const [conf,setConf]=useState(()=>({...defaultView,...Object.fromEntries([...new URLSearchParams(query)].filter(([k])=>['member','department','week','status','search','from','to'].includes(k)))})),[mode,setMode]=useState(''),[record,setRecord]=useState(null),[notice,setNotice]=useState('');
 const filterQuery=queryString(conf);
 const ledger=useRemote('/worklogs?'+filterQuery,version),all=useRemote('/worklogs',version),views=useRemote('/views',version),seals=useRemote(allReport(user)?'/reports/seals':null,version);
 const audit=useRemote(record?'/worklogs/'+record.id+'/adjustments':null,version);
 const rows=useMemo(()=>{const arr=[...(ledger.data||[])];if(conf.sort==='hours')arr.sort((a,b)=>b.effective_units-a.effective_units);if(conf.sort==='name')arr.sort((a,b)=>a.name.localeCompare(b.name,'zh'));return arr;},[ledger.data,conf.sort]);
 const members=[...new Map((all.data||[]).map(r=>[r.user_id,r.name]))];
 const reportDepartments=[...new Map((all.data||[]).map(r=>[r.department_id,r.department]))];
 const groups=new Map();for(const row of rows){const k=conf.group?row[conf.group]:'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
 const setup=(k,v)=>setConf(c=>({...c,[k]:v}));
 const changeOrder=(i,offset)=>setConf(c=>{const a=[...c.columns];const j=i+offset;if(j<0||j>=a.length)return c;[a[i],a[j]]=[a[j],a[i]];return {...c,columns:a};});
 const totals=rows.reduce((a,r)=>({hours:a.hours+r.effective_units,amount:a.amount+r.amountCents,confirmed:a.confirmed+(r.confirmed?r.effective_units:0)}),{hours:0,amount:0,confirmed:0});
 const canAdjust=r=>user.role==='admin'||(user.role==='minister'&&user.departmentId===r.department_id);
 return <><Heading title="工时与报表" desc={allReport(user)?'全中心工时台账':'内部成员工时台账'}><LinkBtn icon={Download} to={root+'/reports/export?'+filterQuery}>导出 Excel</LinkBtn>{allReport(user)&&<Btn icon={Archive} kind="primary" onClick={()=>setMode('seal')}>封存报表</Btn>}</Heading>{notice&&<div className="success" role="status">{notice}</div>}
 <div className="ledger-summary"><div><span>当前记录</span><strong>{rows.length} <small>条</small></strong></div><div><span>登记工时</span><strong>{formatHours(totals.hours/10000)} <small>h</small></strong></div><div><span>已核定工时</span><strong>{formatHours(totals.confirmed/10000)} <small>h</small></strong></div><div><span>当前金额</span><strong>{currency(totals.amount)}</strong></div></div>
 <div className="toolbar ledger-tools"><label className="search"><Search size={17}/><input aria-label="搜索工时" placeholder="搜索任务、姓名、类型" value={conf.search} onChange={e=>setup('search',e.target.value)}/></label><select aria-label="按成员" value={conf.member} onChange={e=>setup('member',e.target.value)}><option value="">全部成员</option>{members.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><select aria-label="按核定状态" value={conf.status} onChange={e=>setup('status',e.target.value)}><option value="">全部状态</option><option value="pending">待核定</option><option value="confirmed">已核定</option></select><select aria-label="分组" value={conf.group} onChange={e=>setup('group',e.target.value)}><option value="">不分组</option><option value="name">按人分组</option><option value="department">按部门分组</option></select><select aria-label="排序" value={conf.sort} onChange={e=>setup('sort',e.target.value)}><option value="date">按日期排序</option><option value="hours">按工时排序</option><option value="name">按姓名排序</option></select></div>
 <div className="toolbar ledger-tools secondary-tools"><select aria-label="筛选部门" value={conf.department} onChange={e=>setup('department',e.target.value)}><option value="">全部部门</option>{reportDepartments.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select aria-label="教学周次" value={conf.week} onChange={e=>setup('week',e.target.value)}><option value="">全部周次</option>{Array.from({length:53},(_,i)=><option key={i} value={i+1}>第 {i+1} 周</option>)}</select><label className="date-field">开始<input aria-label="开始日期" type="date" value={conf.from} onChange={e=>setup('from',e.target.value)}/></label><label className="date-field">结束<input aria-label="结束日期" type="date" value={conf.to} onChange={e=>setup('to',e.target.value)}/></label><Btn onClick={()=>setConf(c=>({...c,...thisWeek()}))}>本周</Btn><Btn icon={SlidersHorizontal} onClick={()=>setMode('columns')}>列设置</Btn><Btn icon={Save} onClick={()=>setMode('view')}>保存视图</Btn><select aria-label="已保存视图" value="" onChange={e=>{const v=views.data?.find(x=>x.id===e.target.value);if(v)setConf({...defaultView,...v.config});}}><option value="">已保存视图</option>{(views.data||[]).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><Btn kind="quiet" onClick={()=>setConf(defaultView)}>重置</Btn></div>
 <Feedback pending={ledger.pending} error={ledger.error}/>{!ledger.pending&&!ledger.error&&(rows.length?<div className="table-scroll"><table className="data-table"><thead><tr>{conf.columns.map(k=><th key={k}>{columns[k][0]}</th>)}<th>操作</th></tr></thead><tbody>{[...groups].map(([key,rs])=><React.Fragment key={key}>{key&&<tr className="group-row"><th colSpan={conf.columns.length+1}>{key} · {rs.length} 条</th></tr>}{rs.map(r=><tr key={r.id}>{conf.columns.map(k=><td key={k}>{columns[k][1](r)}</td>)}<td><Btn kind="quiet tiny" onClick={()=>{setRecord(r);setMode(canAdjust(r)?'adjust':'audit');}}>{canAdjust(r)?'核定':'记录'}</Btn></td></tr>)}</React.Fragment>)}</tbody></table></div>:<Empty title="暂无工时明细" icon={Table2}/>)}
 {allReport(user)&&<><div className="section-bar"><div><h2>封存快照</h2><span>{seals.data?.length||0} 份</span></div></div><Feedback pending={seals.pending} error={seals.error}/>{seals.data?.length?<ul className="seal-list">{seals.data.map(s=><li key={s.id}><Archive size={18}/><div><strong>{s.name}</strong><small>{String(s.start_date).slice(0,10)} 至 {String(s.end_date).slice(0,10)} · {s.row_count} 条</small></div><LinkBtn icon={Download} to={root+'/reports/seals/'+s.id+'/export'}>下载</LinkBtn></li>)}</ul>:<Empty title="暂无封存报表" icon={Archive}/>}</>}
 {mode==='columns'&&<Dialog title="显示列与顺序" onClose={()=>setMode('')}><div className="column-list">{conf.columns.map((k,i)=><div key={k}><span>{columns[k][0]}</span><button className="icon" aria-label={'上移'+columns[k][0]} disabled={i===0} onClick={()=>changeOrder(i,-1)}><ArrowUp size={16}/></button><button className="icon" aria-label={'下移'+columns[k][0]} disabled={i===conf.columns.length-1} onClick={()=>changeOrder(i,1)}><ArrowDown size={16}/></button><button className="icon" aria-label={'隐藏'+columns[k][0]} disabled={conf.columns.length===1} onClick={()=>setup('columns',conf.columns.filter(x=>x!==k))}><X size={16}/></button></div>)}</div><div className="toolbar add-columns">{Object.keys(columns).filter(k=>!conf.columns.includes(k)).map(k=><Btn key={k} icon={Plus} onClick={()=>setup('columns',[...conf.columns,k])}>{columns[k][0]}</Btn>)}</div></Dialog>}
 {mode==='view'&&<Dialog title="保存视图" onClose={()=>setMode('')}><ActionForm onSubmit={async d=>{await api('/views',setBody('POST',{name:d.get('name'),config:conf}));setMode('');setNotice('视图已保存');refresh();}}><label>视图名称<input required name="name" maxLength={80}/></label></ActionForm></Dialog>}
 {mode==='seal'&&<Dialog title="封存报表" onClose={()=>setMode('')}><ActionForm label="确认封存" onSubmit={async d=>{await api('/reports/seals',setBody('POST',Object.fromEntries(d)));setMode('');setNotice('报表快照已封存');refresh();}}><label>报表名称<input required name="name" placeholder="例如：秋季学期工时"/></label><div className="form-grid"><label>开始日期<input required name="from" type="date" defaultValue={conf.from||thisWeek().from}/></label><label>结束日期<input required name="to" type="date" defaultValue={conf.to||thisWeek().to}/></label></div></ActionForm></Dialog>}
 {['adjust','audit'].includes(mode)&&record&&<Dialog title={mode==='adjust'?'核定工时':'工时记录'} onClose={()=>{setMode('');setRecord(null);}}><div className="subtle">{record.name} · {record.title} · 规则工时 {formatHours(record.baseHours)}h</div>{mode==='adjust'&&<ActionForm label="确认核定" onSubmit={async d=>{await api('/worklogs/'+record.id,setBody('PATCH',{hours:Number(d.get('hours')),reason:d.get('reason')}));setMode('');setRecord(null);setNotice('工时已核定');refresh();}}><label>核定工时<input type="number" name="hours" min="0.0001" max="10000" step="0.0001" required defaultValue={record.hours}/></label><label>核定或调整原因<textarea name="reason" rows="3" required/></label></ActionForm>}{record.adjustmentNote&&<p className="prose">{record.adjustmentNote}</p>}<h3>核定历史</h3><Feedback pending={audit.pending} error={audit.error}/>{audit.data?.length?<ul className="plain-list review-list">{audit.data.map(a=><li key={a.id}><span>{formatHours(a.old_units/10000)}h → {formatHours(a.new_units/10000)}h<small>{a.actor_name} · {a.reason}</small></span></li>)}</ul>:!audit.pending&&<div className="subtle">尚无核定记录</div>}</Dialog>}</>;
}
function Notifications({version}){
 const remote=useRemote('/outbox',version);
 return <><Heading title="通知记录" desc="外部通知发送状态"/><Feedback {...remote}/>{remote.data?.length?<ul className="seal-list">{remote.data.map(n=><li key={n.id}><Bell size={18}/><div><a className="row-link" href={href('task/'+n.task_id)}>{n.payload.title}</a><small>{n.payload.message} · {cnTime(n.created_at)}</small></div><span className={'badge '+(n.status==='sent'?'green':'amber')}>{({sent:'已发送',failed:'等待重试',pending:'待发送',unconfigured:'渠道未配置',superseded:'已过环节'})[n.status]||n.status}</span></li>)}</ul>:!remote.pending&&!remote.error&&<Empty title="暂无通知记录" icon={Bell}/>}</>;
}
export {ActionForm, Badge, Btn, Dialog, Empty, Feedback, FileList, Heading, LinkBtn,
 api, cnTime, dateInput, formatHours, href, sendFiles, setBody, useRemote};

export default function App(){
 const [route,setRoute]=useState(getRoute),[user,setUser]=useState(undefined),[revision,setRevision]=useState(0),[showCreate,setCreate]=useState(false),[createKind,setCreateKind]=useState(undefined),[mobileNav,setMobileNav]=useState(false),[toast,setToast]=useState('');
 const menuRef=useRef(null),navRef=useRef(null);
 const local=['127.0.0.1','localhost','::1','[::1]'].includes(location.hostname)&&import.meta.env.VITE_HIDE_DEMO!=='true';
 useEffect(()=>{const update=()=>{setRoute(getRoute());setMobileNav(false);window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
 useEffect(()=>{api('/auth/me').then(setUser).catch(()=>setUser(null));},[]);
 useEffect(()=>{if(!mobileNav)return;const key=e=>{if(e.key==='Escape'){setMobileNav(false);menuRef.current?.focus();}if(e.key==='Tab'){const els=[...navRef.current.querySelectorAll('a,button')].filter(el=>el.getClientRects().length);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};const previous=document.body.style.overflow;document.body.style.overflow='hidden';navRef.current?.querySelector('a')?.focus();window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=previous;};},[mobileNav]);
 const remote=useRemote(user?'/tasks':null,revision);const tasks=remote.data||[];
 const refresh=()=>setRevision(r=>r+1);
 if(user===undefined)return <main className="loading-screen">正在加载工作台…</main>;
 if(!user)return <Login local={local} onLogin={u=>{setUser(u);refresh();window.scrollTo({top:0,behavior:'instant'});}}/>;
 const [path,query='']=route.split('?'),slug=path.split('/')[0],taskId=path.split('/')[1];
 const groups=workspaceNavigation(user),allowed=groups.flatMap(g=>g.items),pageAllowed=allowed.some(([key])=>key===slug);
 const newTask=kind=>{setCreateKind(kind);setCreate(true);};
 const name=slug==='task'?'任务详情':allowed.find(([k])=>k===slug)?.[1]||'工作区';
 const pending=tasks.filter(t=>t.viewer?.action).length,reviews=tasks.filter(t=>t.viewer?.action==='review').length;
 return <div className="app-shell"><aside ref={navRef} id="workspace-navigation" className={'sidebar '+(mobileNav?'mobile-open':'')}><Brand/><div className="sidebar-nav-scroll"><nav aria-label="主导航">{groups.map(group=><div className="sidebar-group" key={group.label}><h2 className="sidebar-group-title">{group.label}</h2>{group.items.map(([key,label,Icon])=><a key={key} href={href(key)} aria-current={key===slug||(key==='tasks'&&slug==='task')?'page':undefined}><Icon size={17}/><span>{label}</span>{!remote.pending&&!remote.error&&['mine','review'].includes(key)&&(key==='mine'?pending:reviews)>0&&<small className="nav-count" aria-label={(key==='mine'?pending:reviews)+' 项待处理'}>{key==='mine'?pending:reviews}</small>}</a>)}</div>)}</nav></div><div className="sidebar-foot"><div className="identity"><span className="avatar">{user.name.slice(0,1)}</span><span><strong>{user.name}</strong><small>{user.department||roles[user.role]}</small></span></div><button className="icon" aria-label="退出登录" onClick={async()=>{try{await api('/auth/logout',setBody('POST',{}));}finally{setUser(null);navigate('home');}}}><LogOut size={18}/></button></div></aside>{mobileNav&&<button className="mobile-backdrop" aria-label="关闭导航" onClick={()=>{setMobileNav(false);menuRef.current?.focus();}}/>}
 <div className="main"><header className="topbar"><button ref={menuRef} className="icon menu-toggle" aria-label="打开导航" aria-controls="workspace-navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}><Menu size={22}/></button><span>青年传媒中心</span><ChevronRight size={13}/><strong>{name}</strong><span className="top-role">{roles[user.role]}</span><button className="icon topbar-refresh" aria-label="刷新工作区" onClick={refresh}><RefreshCw size={16}/></button></header><main className="page">{toast&&<div className="success" role="status">{toast}<button className="icon" aria-label="关闭提示" onClick={()=>setToast('')}><X size={16}/></button></div>}
 {slug==='task'&&taskId?(user.role==='external'&&remote.pending?<Feedback pending/>:<TaskDetail key={taskId} taskId={taskId} version={revision} user={user} refresh={refresh} publicTask={tasks.find(t=>t.id===taskId&&t.publicOnly)}/>):!pageAllowed?<><Heading title="暂时无法访问" desc="当前身份没有这个页面的访问权限，或页面不存在。"/><LinkBtn to={href('home')} icon={ArrowLeft}>返回工作概览</LinkBtn></>:['tasks','mine','created','team','review','archives'].includes(slug)?<WorkspaceTasks key={slug} mode={slug} query={query} tasks={tasks} user={user} newTask={newTask} remote={remote} refresh={refresh}/>:slug==='reports'?<Reports key={query} query={query} user={user} version={revision} refresh={refresh}/>:slug==='notifications'?<Notifications version={revision}/>:slug==='settings'?<WorkflowSettings user={user} version={revision} refresh={refresh}/>:slug==='inbox'?<InboxView version={revision}/>:<WorkspaceHome tasks={tasks} user={user} newTask={newTask} remote={remote} version={revision} refresh={refresh}/>}
 </main></div>{showCreate&&<CreateWorkflow user={user} initialKind={createKind} onClose={()=>setCreate(false)} onCreated={(id,message)=>{setCreate(false);setToast(message||'需求已提交');refresh();navigate('task/'+id);}}/>}</div>;
}
