import React,{useState} from 'react';
import {Archive,ArrowRight,ArrowUpRight,Bell,Camera,CheckCheck,ChevronRight,Clock3,FileCheck2,FileText,Inbox,KanbanSquare,LayoutDashboard,List,ListTodo,Newspaper,Palette,Plus,Search,Send,ShieldCheck,SlidersHorizontal,Table2,Users} from 'lucide-react';
import {Badge,Btn,Empty,Feedback,Heading,LinkBtn,cnTime,formatHours,href,useRemote} from './App.jsx';
import {kinds,workflowChoices} from './Workflows.jsx';
import './workspace.css';

const manages=u=>['minister','admin'].includes(u.role);
const fullReports=u=>u.role==='admin'||u.role==='minister'&&u.departmentId==='office';
const internal=u=>['member','minister','admin'].includes(u.role);
const done=t=>['archived','recorded'].includes(t.state);
const mine=t=>!!t.viewer?.action;
const review=t=>t.viewer?.action==='review';
const isTeam=(t,u)=>u.role==='admin'||[t.department_id,t.source_department].includes(u.departmentId);
const kindOf=t=>t.kind||'publication';
const time=t=>t.deadline?new Date(t.deadline).getTime():Infinity;
const ordered=tasks=>[...tasks].sort((a,b)=>time(a)-time(b));
const withinTwoDays=t=>!done(t)&&Number.isFinite(time(t))&&time(t)<=Date.now()+2*86400000;
const overdue=t=>!done(t)&&time(t)<Date.now();
const routeTo=(route,values={})=>{const q=new URLSearchParams(Object.entries(values).filter(([,v])=>v));return route+(q.size?'?'+q:'');};

export function workspaceNavigation(user){
 const groups=[{label:'个人工作',items:[['home','工作概览',LayoutDashboard],['mine','我的待办',ListTodo],['created','我发起的',Send],['inbox','消息中心',Bell]]},
  {label:'任务协作',items:[['tasks','任务中心',KanbanSquare],...(manages(user)?[['team',user.role==='admin'?'中心任务':'部门任务',Users]]:[]),...(['minister','admin','teacher'].includes(user.role)?[['review',user.role==='teacher'?'审校工作台':'审核工作台',FileCheck2]]:[])]},
  {label:'成果与统计',items:[['archives','成果档案',Archive],...(internal(user)?[['reports',user.role==='member'?'我的工时':'工时与报表',Table2]]:[])]}];
 if(manages(user))groups.push({label:'部门管理',items:[['settings','流程与轮值',SlidersHorizontal],['notifications','发送记录',Inbox]]});
 return groups;
}

function Deadline({task}){
 return <span className={'workspace-deadline '+(overdue(task)?'overdue':withinTwoDays(task)?'soon':'')}><Clock3 size={13}/>{task.deadline?cnTime(task.deadline):'未设截止'}{overdue(task)?' · 已逾期':withinTwoDays(task)?' · 即将到期':''}</span>;
}

function WorkFeed({tasks,empty='当前没有待处理任务',detail='新的任务到来后，会显示在这里。'}){
 return tasks.length?<ul className="work-feed">{tasks.map(t=><li key={t.id}><a className="work-feed-main" href={href('task/'+t.id)}><span className="work-feed-kind">{kinds[kindOf(t)]}{t.urgent?' · 加急':''}</span><strong>{t.title}</strong><Deadline task={t}/></a><div className="work-feed-action"><Badge task={t}/><a className={'work-next '+(mine(t)?'is-mine':'')} href={href('task/'+t.id)}>{t.publicOnly?'查看报名':t.viewer?.nextLabel||'查看进度'}<ArrowRight size={14}/></a></div></li>)}</ul>:<Empty title={empty} detail={detail} icon={CheckCheck}/>;
}

const businessIcons={publication:Newspaper,web_article:FileText,photo:Camera,request:Users,design:Palette,work_entry:Clock3};
const businessNotes={publication:'供稿 · 排版 · 两审 · 发布',web_article:'稿件对接与挂网',photo:'拍摄预约与成果交付',request:'六部门需求协作',design:'绘画、配图与设计',work_entry:'日常工作逐项登记'};

export function WorkspaceHome({tasks,user,newTask,remote,version,refresh}){
 const logs=useRemote(internal(user)?'/worklogs':null,version);
 const seals=useRemote(fullReports(user)?'/reports/seals':null,version);
 const personal=tasks.filter(mine),pendingReview=personal.filter(review),created=tasks.filter(t=>t.viewer?.createdByMe),team=tasks.filter(t=>isTeam(t,user)&&!t.publicOnly);
 const reviewed=tasks.filter(t=>t.viewer?.reviewedByMe);
 const logRows=logs.data||[],pendingLogs=logRows.filter(r=>!r.confirmed&&(fullReports(user)||r.department_id===user.departmentId));
 const hours=logRows.filter(r=>r.user_id===user.id).reduce((sum,r)=>sum+r.effective_units,0)/10000;
 const date=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'}).format(new Date());
 const myPending=href('mine'),myReview=href('review'),deptPending=href(routeTo('reports',{status:'pending',department:fullReports(user)?'':user.departmentId}));
 const count=(n,r=remote)=>r.pending?'—':r.error?'暂不可用':n;
 let title='今天，从我的待办开始',desc='交付成果、跟进修改，让每一份工作都有记录。',label='个人工作台',metrics=[['我的待办',count(personal.length),myPending,ListTodo],['两日内到期 / 逾期',count(personal.filter(withinTwoDays).length),href('mine?due=soon'),Clock3],['我的累计工时',count(formatHours(hours),logs),href('reports'),Table2,'h'],['我发起的',count(created.length),href('created'),Send]];
 let actions=[['查看我的待办',myPending],['查看我的工时',href('reports')]];
 if(user.role==='teacher'){
  title='把每一篇稿件，审得更清楚';desc='待审稿件、版本与修改意见，集中在你的审校工作台。';label='教师审校工作台';
  metrics=[['等待我审校',count(pendingReview.length),myReview,FileCheck2],['临近截止 / 逾期',count(pendingReview.filter(withinTwoDays).length),href('review?due=soon'),Clock3],['我已审过的',count(reviewed.length),href('review?tab=reviewed'),CheckCheck],['已审且归档',count(reviewed.filter(t=>t.state==='archived').length),href('review?tab=reviewed&status=archived'),Archive]];
  actions=[['开始审校',myReview],['查看已审记录',href('review?tab=reviewed')]];
 }else if(user.role==='external'){
  title='你的需求，进度一目了然';desc='补齐材料、跟进协作、查看成果，所有进展都在任务里。';label='需求协作工作台';
  metrics=[['我的进行中',count(created.filter(t=>!done(t)).length),href('created'),Clock3],['待补交材料',count(personal.length),myPending,FileText],['已完成需求',count(created.filter(t=>t.state==='archived').length),href('created?tab=archived'),Archive],['我发起的',count(created.length),href('created?tab=all'),Send]];
  actions=[['查看需求进度',href('created')],['补交供稿材料',myPending]];
 }else if(fullReports(user)){
  title=user.role==='admin'?'让中心协作，有序推进':'把每一份贡献，核对清楚';desc='关注任务流转、工时核定与学期结算，保留可追溯的工作记录。';label=user.role==='admin'?'中心管理工作台':'办公部工作台';
  metrics=[['待核定记录',count(pendingLogs.length,logs),deptPending,Table2],['全中心已登记工时',count(formatHours(logRows.reduce((s,r)=>s+r.effective_units,0)/10000),logs),href('reports'),Clock3,'h'],['我的待办',count(personal.length),myPending,ListTodo],['已封存报表',count(seals.data?.length||0,seals),href('reports'),Archive]];
  actions=[['核对工时台账',deptPending],['查看'+(user.role==='admin'?'中心':'部门')+'任务',href('team')]];
 }else if(user.role==='minister'){
  title='先安排承接，再推进交付';desc='分配、审核、核定集中处理，让部门的协作有条不紊。';label=(user.department||'部门')+'工作台';
  metrics=[['等待分配',count(personal.filter(t=>t.viewer.action==='assign').length),href('mine?status=awaiting_assignment'),Users],['等待我审核',count(pendingReview.length),myReview,FileCheck2],['待核定工时',count(pendingLogs.length,logs),deptPending,Table2],['部门进行中',count(team.filter(t=>!done(t)).length),href('team'),Clock3]];
  actions=[['安排任务承接',href('mine?status=awaiting_assignment')],['处理待审任务',myReview],['核定部门工时',deptPending]];
 }
 const recent=(user.role==='teacher'?reviewed:user.role==='external'?created:manages(user)?team:tasks.filter(t=>t.assignee_id===user.id||t.viewer?.createdByMe)).filter(t=>!personal.some(m=>m.id===t.id)).slice(0,4);
 const choices=workflowChoices(user);
 const visibleKinds=Object.keys(kinds).filter(k=>user.role!=='teacher'||['publication','web_article','design'].includes(k));
 return <div className="workspace-home"><Heading title="工作概览" desc={date+' · '+user.name}>{choices.length>0&&<Btn icon={Plus} kind="primary" onClick={()=>newTask()}>新建需求</Btn>}</Heading>
  <section className="workspace-welcome"><div><span className="workspace-eyebrow"><span/>{label}</span><h2>{title}</h2><p>{desc}</p><div className="workspace-shortcuts">{actions.map(([text,to])=><a key={text} href={to}>{text}<ArrowUpRight size={15}/></a>)}</div></div><div className="welcome-symbol" aria-hidden="true"><ShieldCheck size={42}/><span>任务有序流转<br/>成果自动归档</span></div></section>
  <div className="workspace-metrics">{metrics.map(([text,value,to,Icon,unit])=><a className="workspace-metric" key={text} href={to}><span className="workspace-metric-label"><Icon size={16}/>{text}<ChevronRight size={14}/></span><strong>{value}<small>{unit||'项'}</small></strong></a>)}</div>
  {(logs.error||seals.error)&&<div className="error" role="alert">{logs.error?'工时摘要加载失败：'+logs.error:'封存摘要加载失败：'+seals.error}<Btn kind="quiet" onClick={refresh}>重新加载</Btn></div>}
  <div className="workspace-columns"><section className="workspace-section workspace-priority"><div className="workspace-section-head"><div><span className="workspace-kicker">先处理这些</span><h2>{user.role==='teacher'?'等待我审校':user.role==='external'?'需要我补充':'我的优先待办'}<span>{remote.pending?'…':remote.error?'—':personal.length}</span></h2></div><a className="text-link" href={myPending}>全部待办<ArrowRight size={14}/></a></div><Feedback {...remote}/>{remote.error&&<Btn onClick={refresh}>重新加载</Btn>}{!remote.pending&&!remote.error&&<WorkFeed tasks={ordered(personal).slice(0,5)} empty={user.role==='external'?'材料已齐，等待协作推进':'当前待办已处理完'} detail="可以查看任务进度，或从业务入口开始新的协作。"/>}</section>
   <section className="workspace-section workspace-business"><div className="workspace-section-head"><div><span className="workspace-kicker">快速进入</span><h2>业务入口</h2></div></div><div className="workspace-business-grid">{visibleKinds.map(k=>{const Icon=businessIcons[k];return <a key={k} href={href(routeTo('tasks',{kind:k}))}><Icon size={19}/><strong>{kinds[k]}</strong><span>{businessNotes[k]}</span><small>{remote.pending?'加载中':remote.error?'查看任务':k==='work_entry'?tasks.filter(t=>kindOf(t)===k).length+' 条登记':tasks.filter(t=>kindOf(t)===k&&!done(t)).length+' 项进行中'}<ArrowUpRight size={13}/></small></a>;})}</div></section></div>
  <section className="workspace-section workspace-progress"><div className="workspace-section-head"><div><span className="workspace-kicker">持续跟进</span><h2>{user.role==='teacher'?'最近审过的稿件':user.role==='external'?'我的需求进度':manages(user)?'部门协作进度':'我参与的任务'}</h2></div><a className="text-link" href={href(user.role==='teacher'?'review?tab=reviewed':user.role==='external'?'created':manages(user)?'team':'tasks')}>查看全部<ArrowRight size={14}/></a></div>{!remote.pending&&!remote.error?<WorkFeed tasks={recent} empty="暂无其他进度" detail="已参与或发起的任务会在这里持续更新。"/>:<Feedback {...remote}/>}</section>
  <p className="workspace-scope">任务摘要基于当前有权查看的最近 500 项记录。{internal(user)?'工时按现有台账范围汇总。':' '}</p>
 </div>;
}

const viewNames={tasks:['任务中心','按业务与环节跟进协作进度'],mine:['我的待办','当前需要由你处理的任务'],created:['我发起的','跟进需求、补充材料、查看成果'],team:['部门任务','本部门承接与发起的协作任务'],review:['审核工作台','集中处理待审任务，回看已审记录'],archives:['成果档案','各部门已归档的任务与成果']};
function archiveTerm(date){if(!date)return '';const [y,m]=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(date)).split('-').map(Number);return m>=9?y+' 秋季学期':m<=2?(y-1)+' 秋季学期':y+' 春季学期';}
export function WorkspaceTasks({tasks,user,mode='tasks',query='',newTask,remote,refresh}){
 const params=new URLSearchParams(query),[search,setSearch]=useState('');
 const kind=Object.hasOwn(kinds,params.get('kind'))?params.get('kind'):'',view=params.get('view')==='board'?'board':'list';
 const status=params.get('status')||'',tab=params.get('tab')||'pending',archive=mode==='archives';
 const update=values=>{const next=new URLSearchParams(query);for(const [k,v]of Object.entries(values)){if(v)next.set(k,v);else next.delete(k);}location.hash=mode+(next.size?'?'+next:'');};
 const base=tasks.filter(t=>mode==='mine'?mine(t):mode==='created'?t.viewer?.createdByMe:mode==='team'?isTeam(t,user)&&!t.publicOnly:mode==='review'?(tab==='reviewed'?t.viewer?.reviewedByMe:review(t)):archive?t.state==='archived':true);
 const filtered=base.filter(t=>(!kind||kindOf(t)===kind)&&(!status||t.state===status)&&(params.get('due')!=='soon'||withinTwoDays(t))&&(!params.get('department')||t.department_id===params.get('department'))&&(!params.get('term')||archiveTerm(t.archived_at)===params.get('term'))&&(!['created','team'].includes(mode)||tab==='all'||(tab==='archived'?done(t):!done(t)))&&(!search.trim()||[t.title,t.number].some(v=>v?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
 const rows=['mine','review'].includes(mode)?ordered(filtered):filtered;
 const states=[...new Map(base.map(t=>[t.state,t.stateLabel]))];
 const title=mode==='review'&&user.role==='teacher'?'审校工作台':mode==='team'&&user.role==='admin'?'中心任务':viewNames[mode][0];
 const choices=workflowChoices(user),canCreate=choices.length>0&&(!kind||choices.includes(kind))&&!['mine','review','archives'].includes(mode);
 const tabs=mode==='review'?[['pending','待我审核'],['reviewed','我已审过']]:['created','team'].includes(mode)?[['pending','进行中'],['archived','已完成'],['all','全部']]:null;
 return <><Heading title={title} desc={viewNames[mode][1]}>{canCreate&&<Btn icon={Plus} kind="primary" onClick={()=>newTask(kind||undefined)}>新建需求</Btn>}</Heading>
 {tabs&&<div className="workspace-tabs" aria-label={title+'范围'}>{tabs.map(([value,label])=><button key={value} type="button" aria-pressed={tab===value} onClick={()=>update({tab:value,status:''})}>{label}</button>)}</div>}
 <div className="workspace-task-tools"><div className="toolbar"><label className="search"><Search size={17}/><input aria-label="搜索标题或编号" placeholder="搜索标题或编号" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="业务类型筛选" value={kind} onChange={e=>update({kind:e.target.value})}><option value="">全部业务</option>{Object.entries(kinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
 {archive?<><select aria-label="按部门筛选档案" value={params.get('department')||''} onChange={e=>update({department:e.target.value})}><option value="">全部部门</option>{[...new Map(base.map(t=>[t.department_id,t.department_name]))].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><select aria-label="按学期筛选档案" value={params.get('term')||''} onChange={e=>update({term:e.target.value})}><option value="">全部学期</option>{[...new Set(base.map(t=>archiveTerm(t.archived_at)).filter(Boolean))].sort().reverse().map(t=><option key={t}>{t}</option>)}</select></>:<select aria-label="任务状态" value={status} onChange={e=>update({status:e.target.value})}><option value="">全部环节</option>{states.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>}
 {params.get('due')==='soon'&&<Btn kind="quiet" onClick={()=>update({due:''})}>临近截止 / 逾期 ×</Btn>}
 </div><div className="workspace-view-switch" aria-label="任务展示方式"><button type="button" aria-pressed={view==='list'} onClick={()=>update({view:'list'})}><List size={16}/>列表</button><button type="button" aria-pressed={view==='board'} onClick={()=>update({view:'board'})}><KanbanSquare size={16}/>看板</button></div></div>
 <p className="workspace-result-count" role="status">{remote.pending?'正在加载任务…':remote.error?'任务暂不可用':rows.length+' 项'+(kind?' · '+kinds[kind]:'')}<span>当前有权查看的最近 500 项记录</span></p><Feedback error={remote.error}/>{remote.error&&<Btn onClick={refresh}>重新加载</Btn>}
 {!remote.pending&&!remote.error&&(rows.length?(view==='board'?<TaskBoard tasks={rows}/>:<TaskTable tasks={rows} archive={archive}/>):<Empty title={mode==='review'?(tab==='reviewed'?'暂无已审记录':'当前没有待审任务'):mode==='mine'?'当前没有待办':'没有符合条件的任务'} detail="可以调整筛选条件，或返回工作概览。" icon={ListTodo}/>)}
 </>;
}

function TaskTable({tasks,archive}){
 return <div className="table-scroll"><table className="data-table workspace-task-table"><thead><tr><th>任务 / 编号</th><th>当前环节</th><th>{archive?'成果 / 记录':'当前处理人'}</th><th>截止时间</th><th>下一步</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td><a className="row-link" href={href('task/'+t.id)}>{t.title}</a><small>{t.number} · {kinds[kindOf(t)]}{t.urgent?' · 加急':''}{t.publicOnly?' · 开放报名':''}</small></td><td><Badge task={t}/></td><td>{archive&&t.publication_url?<a className="text-link" href={t.publication_url} target="_blank" rel="noreferrer">正式链接<ArrowUpRight size={13}/></a>:t.viewer?.ownerLabel||(t.publicOnly?'开放报名':'查看详情')}</td><td><Deadline task={t}/></td><td><a href={href('task/'+t.id)} className={'work-next '+(mine(t)?'is-mine':'')}>{t.publicOnly?'查看报名':t.viewer?.nextLabel||'查看详情'}<ArrowRight size={14}/></a></td></tr>)}</tbody></table></div>;
}
function TaskBoard({tasks}){
 const groups=new Map();for(const t of tasks){if(!groups.has(t.state))groups.set(t.state,{label:t.stateLabel,rows:[]});groups.get(t.state).rows.push(t);}
 return <div className="workspace-board">{[...groups].map(([key,{label,rows}])=><section className="workspace-board-lane" key={key}><h2>{label}<span>{rows.length}</span></h2>{rows.map(t=><a className="workspace-task-card" href={href('task/'+t.id)} key={t.id}><span>{kinds[kindOf(t)]}{t.urgent?' · 加急':''}</span><strong>{t.title}</strong><Deadline task={t}/><small>{t.viewer?.ownerLabel||'查看详情'}</small><div>{t.publicOnly?'查看报名':t.viewer?.nextLabel||'查看进度'}<ArrowRight size={14}/></div></a>)}</section>)}</div>;
}
