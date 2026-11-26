import React, {useState} from 'react';
import {Archive, ArrowLeft, Bell, Check, FileText, Paperclip, Plus} from 'lucide-react';
import {ManuscriptFields} from './ArticlePreview.jsx';
import {ActionForm, Badge, Btn, Dialog, Empty, Feedback, FileList, Heading, LinkBtn,
 api, cnTime, dateInput, formatHours, href, sendFiles, setBody, useRemote} from './App.jsx';

export const kinds={
 publication:'公众号排版',web_article:'采编挂网',photo:'摄制预约',
 request:'部门需求',design:'美编设计',work_entry:'工作登记'
};
const complexityNames={basic:'基础设计',complex:'复杂设计',large:'大型设计'};
const isInternal=u=>['member','minister','admin'].includes(u.role);
const manages=(u,d)=>u.role==='admin'||u.role==='minister'&&u.departmentId===d;
export const workflowChoices=u=>Object.keys(kinds).filter(kind=>{
 if(kind==='publication')return u.role==='external'||manages(u,'operations');
 if(kind==='web_article')return u.role==='admin'||u.departmentId==='editorial';
 if(kind==='photo')return isInternal(u)||u.role==='external';
 if(kind==='request')return ['admin','external'].includes(u.role)||manages(u,'original');
 return kind==='design'||isInternal(u);
});
const toISO=value=>value?new Date(value).toISOString():undefined;
const optionalNumber=value=>value===''||value===null?undefined:Number(value);
const personOptions=people=>people.map(p=><option key={p.id} value={p.id}>{p.name}</option>);
const deptOptions=departments=>departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>);
const ruleOptions=rules=>rules.map(r=><option key={r.id} value={r.id}>{r.name} · {formatHours(r.units/10000)} h/{r.unit}</option>);

export function CreateWorkflow({user,onClose,onCreated,parent,initialKind}){
 const options=useRemote('/workflow/options');
 const choices=workflowChoices(user);
 const [kind,setKind]=useState(parent?.kind==='manual'?'work_entry':parent?'publication':choices.includes(initialKind)?initialKind:choices[0]);
 const [department,setDepartment]=useState(manages(user,'original')&&user.role!=='admin'?'original':'office');
 const [person,setPerson]=useState(parent?.assignee_id||user.id);
 const [rule,setRule]=useState('');
 const [lines,setLines]=useState([{key:0,original:true}]);
 const {departments=[],people=[],rules=[],sites=[]}=options.data||{};
 const writers=people.filter(x=>x.department_id==='editorial');
 const teachers=people.filter(x=>x.role==='teacher');
 const eligible=people.filter(x=>x.role!=='teacher'&&(x.id===user.id||manages(user,x.department_id))&&(!parent?.id||parent.kind!=='manual'||x.department_id===parent.department_id));
 const entryDepartment=eligible.find(x=>x.id===person)?.department_id;
 const currentRule=rules.find(x=>x.id===Number(rule));
 const requestDepts=manages(user,'original')&&!['admin','external'].includes(user.role)?departments.filter(d=>d.id==='original'):departments;
 async function create(data){
  const input={kind,title:data.get('title'),notes:data.get('notes'),deadline:toISO(data.get('deadline')),reminderHours:optionalNumber(data.get('reminder'))};
  if(kind==='publication')Object.assign(input,{layoutType:data.get('type'),openRegistration:data.has('open'),linkedTaskId:parent?.id});
  if(kind==='web_article')Object.assign(input,{
   reviewerIds:data.getAll('reviewers'),teacherId:data.get('teacher')||undefined,
   lines:lines.map(({key,original})=>({title:data.get('article-'+key),site:data.get('site-'+key)||undefined,
    original,authorId:original?data.get('author-'+key):undefined}))
  });
  if(kind==='photo')Object.assign(input,{location:data.get('location'),contact:data.get('contact'),urgentReason:data.get('urgentReason')});
  if(kind==='request')Object.assign(input,{departmentId:department,ruleId:optionalNumber(rule)});
  if(kind==='design')input.complexity=data.get('complexity');
  if(kind==='work_entry')Object.assign(input,{personId:person,week:Number(data.get('week')),linkedTaskId:parent?.id,ruleId:optionalNumber(rule),hours:rule?undefined:optionalNumber(data.get('hours'))});
  const task=await api('/tasks',setBody('POST',input));
  try{
   const fileIds=await sendFiles(task.id,data.getAll('files'));
   if(kind==='publication'&&user.role==='external'&&(data.get('body')?.trim()||data.get('previewHtml')||fileIds.length)){
    await api('/tasks/'+task.id+'/source',setBody('POST',{body:data.get('body'),previewHtml:data.get('previewHtml'),fileIds}));
   }
   onCreated(task.id,kind==='work_entry'?'已登记，等待核定':undefined);
  }catch(error){onCreated(task.id,'已创建任务，请在详情补交材料。'+error.message);}
 }

 return <Dialog title={parent?.kind==='manual'?'补登任务工时':parent?'创建关联推文':'新建需求或登记'} onClose={onClose}>
  <Feedback {...options}/>
  {options.data&&<ActionForm label={kind==='work_entry'?'登记工时':'提交需求'} onSubmit={create}>
   {!parent&&<label>业务类型<select value={kind} onChange={e=>{setKind(e.target.value);setRule('');}}>{choices.map(k=><option key={k} value={k}>{kinds[k]}</option>)}</select></label>}
   {parent&&<p className="subtle">关联任务 · {parent.number}</p>}
   <label>{kind==='work_entry'?'工作内容':'任务标题'}<input name="title" required minLength={2} maxLength={180} defaultValue={parent?.title}/></label>
   {kind==='publication'&&<><label>排版类型<select name="type"><option value="basic">基础排版</option><option value="photo">影像志排版</option><option value="repost">内容转载</option></select></label>
    {manages(user,'operations')&&<label className="check"><input type="checkbox" name="open"/>开放兄弟组织报名</label>}</>}
   {kind==='web_article'&&<>
    {lines.map((line,index)=><fieldset className="workflow-fieldset" key={line.key}>
     <legend>稿件 {index+1}</legend>
     <label>稿件名称<input required name={'article-'+line.key}/></label>
     <div className="form-grid"><label>投稿网站<input name={'site-'+line.key} list="article-sites" placeholder="留空使用三个默认网站"/></label>
      <label>稿件类型<select value={line.original?'original':'repost'} onChange={e=>setLines(rows=>rows.map(r=>r.key===line.key?{...r,original:e.target.value==='original'}:r))}><option value="original">原创</option><option value="repost">转载</option></select></label></div>
     {line.original&&<label>写稿人<select required name={'author-'+line.key} defaultValue={user.departmentId==='editorial'?user.id:''}><option value="">请选择采编成员</option>{personOptions(writers)}</select></label>}
     {lines.length>1&&<Btn type="button" kind="quiet" onClick={()=>setLines(rows=>rows.filter(r=>r.key!==line.key))}>移除此稿件</Btn>}
    </fieldset>)}
    <datalist id="article-sites">{sites.map(s=><option key={s} value={s}/>)}</datalist>
    <Btn type="button" icon={Plus} disabled={lines.length>=50} onClick={()=>setLines(rows=>[...rows,{key:rows.at(-1).key+1,original:true}])}>添加稿件</Btn>
    <fieldset className="workflow-fieldset"><legend>审校人员</legend>
     {[...writers.filter(p=>p.role==='minister'),...teachers].map(p=><label className="check" key={p.id}><input type="checkbox" name="reviewers" value={p.id}/>{p.name}</label>)}
    </fieldset>
    <label>老师内容审校<select name="teacher"><option value="">本单不设老师内容审校</option>{personOptions(teachers)}</select></label>
   </>}
   {kind==='photo'&&<><div className="form-grid"><label>拍摄地点<input name="location" required/></label><label>联系人及联系方式<input name="contact" required/></label></div><label>加急说明<input name="urgentReason" placeholder="选填"/></label><p className="subtle">离预约不足 {options.data?.policy.photo_window??48} 小时，按加急计。</p></>}
   {kind==='request'&&<><label>承接部门<select value={department} onChange={e=>{setDepartment(e.target.value);setRule('');}}>{deptOptions(requestDepts)}</select></label>
    {department==='original'?<p className="subtle">原创部暂无自动价目，交付后可补登工时。</p>:<label>工作类型<select required value={rule} onChange={e=>setRule(e.target.value)}><option value="">请选择</option>{ruleOptions(rules.filter(r=>r.department_id===department&&!r.review))}</select></label>}</>}
   {kind==='design'&&<label>设计规模<select name="complexity">{Object.entries(complexityNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
   {kind==='work_entry'&&<>
    <div className="form-grid"><label>登记对象<select required value={person} onChange={e=>{setPerson(e.target.value);setRule('');}}><option value="">请选择成员</option>{personOptions(eligible)}</select></label>
     <label>教学周次<input name="week" required type="number" min="1" max="53"/></label></div>
    <div className="form-grid"><label>工作类型<select value={rule} onChange={e=>setRule(e.target.value)}><option value="">其他 · 人工填报</option>{parent?.kind!=='manual'&&ruleOptions(rules.filter(r=>r.department_id===entryDepartment))}</select></label>
     <label>工时（小时）{currentRule?<input readOnly value={formatHours(currentRule.units/10000)}/>:<input required name="hours" type="number" min="0.0001" max="1000" step="0.0001"/>}</label></div>
   </>}
   {kind!=='work_entry'&&<div className="form-grid" key={kind}><label>{kind==='photo'?'预约时间':'截止时间'}<input name="deadline" type="datetime-local" required={['publication','photo'].includes(kind)} defaultValue={kind==='publication'?dateInput():undefined}/></label><label>提前提醒（小时）<input name="reminder" type="number" min="0" max="720" step="0.01" placeholder="选填"/></label></div>}
   <label>{kind==='work_entry'?'备注':'需求说明'}<textarea name="notes" rows="3"/></label>
   {kind==='publication'&&user.role==='external'?<ManuscriptFields source/>:<label>{kind==='publication'?'供稿与素材':'附件'}<input name="files" type="file" multiple/></label>}
  </ActionForm>}
 </Dialog>;
}

export function ForceArchive({task,onClose,onDone}){
 return <Dialog title="强制归档" onClose={onClose}>
  <ActionForm label="确认强制归档" onSubmit={async d=>{
   await api('/tasks/'+task.id+'/actions/force-archive',setBody('POST',{reason:d.get('reason')}));onDone();
  }}>
   <p>这项操作会关闭任务，并标记为工时未自动核算。</p><label>归档理由<textarea name="reason" required rows="4"/></label>
  </ActionForm>
 </Dialog>;
}

export function JobDetail({detail,user,refresh,onLinked}){
 const {task:t,versions,files,events,reviews,contributions,booking,lines,entry,linked=[],linkedFiles=[]}=detail;
 const [mode,setMode]=useState('');
 const [notice,setNotice]=useState('');
 const [selected,setSelected]=useState('');
 const manager=manages(user,t.department_id);
 const options=useRemote(mode==='assign'?'/workflow/options':null);
 const current=versions.find(v=>v.id===selected)||versions[0];
 const mayAssign=manager&&(t.state==='awaiting_assignment'||t.automatic&&t.state==='awaiting_submission'&&!t.version);
 const mayClaim=t.kind==='photo'&&t.state==='awaiting_assignment'&&user.role==='member'&&user.departmentId==='photography'&&new Date(t.deadline)>new Date();
 const maySubmit=(manager||t.assignee_id===user.id)&&['awaiting_submission','returned'].includes(t.state);
 const mayReview=t.state==='content'&&t.teacher_id===user.id||t.state==='acceptance'&&(manager||t.kind==='web_article'&&manages(user,'editorial'));
 const mayForce=manager&&!['archived','recorded'].includes(t.state);
 const mayLink=t.kind==='web_article'&&t.state==='archived'&&!t.archive_reason&&!linked.some(l=>l.kind==='publication')&&(user.role==='admin'||isInternal(user)&&['office','editorial','operations'].includes(user.departmentId));
 const supplementReviewer=(t.kind==='design'&&t.complexity==='complex'||t.kind==='request'&&t.source_department==='original')
  ?reviews.find(r=>r.stage==='acceptance'&&r.decision==='approve')?.actor_id:undefined;
 const mayLog=t.state==='archived'&&(manager||t.assignee_id===user.id)&&(
  t.archive_reason||t.kind==='request'&&t.department_id==='original'||t.kind==='design'&&supplementReviewer&&manager
 );
 const needsContent=t.review_mode&&(!t.version||t.version.phase==='content'&&t.state==='returned');
 const submitLabel=needsContent?'提交待审稿件':'提交成果';
 const mayUpload=t.state!=='archived'&&(manager||t.creator_id===user.id||t.assignee_id===user.id||user.role==='external');
 const finish=message=>{setMode('');setNotice(message);refresh();};
 const action=async(action,body,message)=>{
  await api('/tasks/'+t.id+'/actions/'+action,setBody('POST',body));finish(message);
 };

 return <>
  <LinkBtn to={href('tasks')} kind="quiet" icon={ArrowLeft}>任务中心</LinkBtn>
  <Heading title={t.title} desc={t.number+' · '+kinds[t.kind]}>
   <Badge task={t}/>
   {mayAssign&&<Btn kind="primary" icon={Plus} onClick={()=>setMode('assign')}>{t.automatic?'更换承接人':'安排承接'}</Btn>}
   {mayClaim&&<Btn kind="primary" onClick={()=>setMode('claim')}>抢单</Btn>}
   {maySubmit&&<Btn kind="primary" icon={FileText} onClick={()=>setMode('submit')}>{submitLabel}</Btn>}
   {mayReview&&<Btn kind="primary" icon={Check} onClick={()=>setMode('review')}>{t.state==='content'?'内容审校':'处理验收'}</Btn>}
   {mayLink&&<Btn icon={Plus} onClick={()=>setMode('link')}>创建关联推文</Btn>}
   {mayLog&&<Btn onClick={()=>setMode('log')}>补登任务工时</Btn>}
   {mayForce&&<Btn kind="quiet" icon={Archive} onClick={()=>setMode('force')}>强制归档</Btn>}
  </Heading>
  {notice&&<div className="success" role="status">{notice}</div>}
  {t.archive_reason&&<div className="inline-msg">强制归档 · 工时未自动核算。{t.archive_reason}</div>}
  <div className="detail-columns"><div>
   <section className="panel"><h2>{entry?'登记信息':'任务信息'}</h2><dl className="facts">
    <div><dt>部门</dt><dd>{t.department_name}</dd></div>
    {entry?<><div><dt>登记对象</dt><dd>{entry.name}</dd></div><div><dt>教学周次</dt><dd>第 {entry.week} 周</dd></div></>:<>
    <div><dt>承接人</dt><dd>{t.assignee_name||'—'}</dd></div>
    <div><dt>{booking?'预约时间':'截止时间'}</dt><dd>{cnTime(t.deadline)}</dd></div>
    {booking&&<><div><dt>拍摄地点</dt><dd>{booking.location}</dd></div><div><dt>联系方式</dt><dd>{booking.contact}</dd></div><div><dt>加急</dt><dd>{t.urgent?'是':'否'}{t.urgent_reason?' · '+t.urgent_reason:''}</dd></div></>}
    {t.complexity&&<div><dt>设计规模</dt><dd>{complexityNames[t.complexity]}</dd></div>}
    {lines&&<div><dt>审校人员</dt><dd>{t.reviewers.map(r=>r.name).join('、')}</dd></div>}
    </>}
   </dl>{t.notes&&<p className="prose">{t.notes}</p>}<TaskReportNote task={t} user={user} refresh={refresh}/>
   {lines&&<div className="table-scroll"><table className="data-table"><thead><tr><th>稿件</th><th>网站</th><th>类型 / 写稿人</th></tr></thead>
   <tbody>{lines.map(line=><tr key={line.position}><td>{line.title}</td><td>{line.site}</td><td>{line.original?'原创 · '+line.author_name:'转载'}</td></tr>)}</tbody></table></div>}
   {linked.map(item=><p key={item.id}><a className="row-link" href={href('task/'+item.id)}>{item.title} · {item.number}</a></p>)}
   </section>
   {!entry&&user.role!=='external'&&<section className="panel">
    <div className="panel-head"><h2>{t.state==='archived'?'归档成果':'交付成果'}</h2>
     {!!versions.length&&<select aria-label="成果版本" value={current.id} onChange={e=>setSelected(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>第 {v.number} 版</option>)}</select>}</div>
    {current?<><span className="subtle">{current.author_name} · {cnTime(current.created_at)}</span><p className="prose">{current.body}</p><FileList files={current.files}/></>:<p className="subtle">尚未提交成果</p>}
   </section>}
   <section className="panel"><div className="panel-head"><h2>任务材料</h2>{mayUpload&&<Btn icon={Paperclip} onClick={()=>setMode('files')}>补材料</Btn>}</div><FileList empty files={files}/>{linkedFiles.length>0&&<FileList files={linkedFiles}/>}</section>
   {contributions.length>0&&<section className="panel"><h2>工时明细</h2><ul className="plain-list">{contributions.map(c=><li key={c.id}><span>{c.name} · {c.rule_name}{c.source_key&&<small>{c.source_key}</small>}</span><strong>{formatHours(c.effective_units/10000)} h</strong></li>)}</ul></section>}
  </div><div>
   <section className="panel"><h2>处理时间线</h2>{events.length?<ol className="timeline">{[...events].reverse().map(e=><li key={e.id}><strong>{e.action}</strong><small>{e.actor_name} · {cnTime(e.created_at)}</small>{e.detail&&<p>{e.detail}</p>}</li>)}</ol>:<p className="subtle">{t.stateLabel}</p>}</section>
   {!!reviews.length&&<section className="panel"><h2>审核记录</h2><ul className="plain-list review-list">{[...reviews].reverse().map(r=><li key={r.id}><span>{r.stage==='content'?'内容审校':'成果验收'} · {r.actor_name}<small>{r.reason||'无补充意见'}</small></span><strong>{r.decision==='approve'?'通过':'退回'}</strong></li>)}</ul></section>}
  </div></div>
  {mode==='assign'&&<Dialog title="安排承接" onClose={()=>setMode('')}><Feedback {...options}/><ActionForm label="确认派发" busy={!options.data} onSubmit={d=>action('assign',{assigneeId:d.get('person'),remember:d.has('remember')},'已派发')}>
   <label>承接人<select name="person" required defaultValue={t.assignee_id||''}><option value="">请选择成员</option>{personOptions(options.data?.people.filter(p=>p.department_id===t.department_id)||[])}</select></label>
   <label className="check"><input type="checkbox" name="remember"/>设为此流程默认承接人</label>
  </ActionForm></Dialog>}
  {mode==='claim'&&<Dialog title="抢单" onClose={()=>setMode('')}><ActionForm label="确认承接" onSubmit={()=>action('claim',{},'抢单成功')}><p>承接后，请按预约时间完成拍摄并提交成果。</p></ActionForm></Dialog>}
  {mode==='submit'&&<Dialog title={submitLabel} onClose={()=>setMode('')}><ActionForm label={submitLabel} onSubmit={async d=>{
   const fileIds=await sendFiles(t.id,d.getAll('files'));await action('submit',{body:d.get('body'),fileIds},'成果已提交');setSelected('');
  }}><label>{needsContent?'待审稿件说明':'结果说明'}<textarea name="body" rows="5" defaultValue={current?.body}/></label><label>成果文件或截图<input name="files" type="file" multiple/></label><p className="subtle">结果说明与成果附件至少填写或上传一项。</p></ActionForm></Dialog>}
  {mode==='review'&&<Dialog title={t.state==='content'?'内容审校':'成果验收'} onClose={()=>setMode('')}><ActionForm label="确认意见" onSubmit={d=>action(t.state,{versionId:t.version.id,decision:d.get('decision'),reason:d.get('reason')},d.get('decision')==='reject'?'已退回原承接人':t.state==='acceptance'?'已验收并自动归档':'内容审校已通过')}>
   <label>审核结果<select name="decision"><option value="approve">通过</option><option value="reject">退回修改</option></select></label><label>审核意见<textarea name="reason" rows="4" placeholder="退回时必填"/></label>
  </ActionForm></Dialog>}
  {mode==='force'&&<ForceArchive task={t} onClose={()=>setMode('')} onDone={()=>finish('已强制归档')}/>}
  {mode==='log'&&<CreateWorkflow parent={{...t,kind:'manual',assignee_id:t.kind==='design'?supplementReviewer:t.assignee_id}} user={user} onClose={()=>setMode('')} onCreated={(id,message)=>{finish(message||'已登记');onLinked(id);}}/>}
  {mode==='link'&&<CreateWorkflow parent={t} user={user} onClose={()=>setMode('')} onCreated={(id,message)=>{finish(message||'已创建关联推文');onLinked(id);}}/>}
  {mode==='files'&&<Dialog title="补充任务材料" onClose={()=>setMode('')}><ActionForm label="上传附件" onSubmit={async d=>{await sendFiles(t.id,d.getAll('files'));finish('附件已上传');}}><label>附件<input type="file" name="files" required multiple/></label></ActionForm></Dialog>}
 </>;
}

export function InboxView({version}){
 const remote=useRemote('/inbox',version);
 return <><Heading title="我的通知"/><Feedback {...remote}/>{remote.data?.length?<ul className="seal-list">{remote.data.map(n=><li key={n.id}><Bell size={18}/><div><a className="row-link" href={href('task/'+n.task_id)}>{n.payload.title}</a><small>{n.payload.message} · {cnTime(n.created_at)}</small></div></li>)}</ul>:remote.data&&<Empty title="暂无通知"/>}</>;
}

export function TeacherFields({teachers,ids=[],lockFirst=false}){
 return <div className="form-grid">{[0,1].map(i=><label key={i}>{i===0?'一审指导老师':'二审指导老师'}
  {i===0&&lockFirst&&<input type="hidden" name="teacher1" value={ids[0]||''}/>}
  <select required name={'teacher'+(i+1)} defaultValue={ids[i]||''} disabled={i===0&&lockFirst}>
   <option value="">请选择老师</option>{personOptions(teachers)}
  </select></label>)}</div>;
}

function PublicationSettings({options,version,refresh,setNotice}){
 const config=useRemote('/workflow/publication',version);
 const data=config.data;
 const ministers=options?.people.filter(p=>p.department_id==='operations'&&p.role==='minister')||[];
 return <section className="panel"><h2>公众号审校与微信提醒</h2><Feedback {...config}/>
  {data&&<ActionForm key={JSON.stringify(data.teacherIds)+JSON.stringify(data.reviewerIds)} label="保存审校默认值" onSubmit={async d=>{
   const pair=(a,b)=>d.get(a)||d.get(b)?[d.get(a),d.get(b)]:null;
   await api('/workflow/publication',setBody('PUT',{teacherIds:pair('teacher1','teacher2'),reviewerIds:pair('review1','review2')}));
   setNotice('审校默认值已保存');refresh();
  }}>
   <div className="form-grid">{[0,1].map(i=><label key={i}>{i?'默认二审老师':'默认一审老师'}
    <select name={'teacher'+(i+1)} defaultValue={data.teacherIds[i]||''}><option value="">逐单选择</option>{personOptions(data.teachers)}</select></label>)}</div>
   <div className="form-grid">{[0,1].map(i=><label key={i}>默认内审部长 {i+1}
    <select name={'review'+(i+1)} defaultValue={data.reviewerIds[i]||''}><option value="">逐单选择</option>{personOptions(ministers)}</select></label>)}</div>
  </ActionForm>}
  <p className="subtle">群路由和 @ 标识使用微信机器人中继配置中的值。</p>
  {data?.teachers.map(teacher=><fieldset className="workflow-fieldset" key={teacher.id}>
   <legend>{teacher.name}</legend>
   <ActionForm key={teacher.channel+teacher.mention} label="保存微信提醒" onSubmit={async d=>{
    await api('/workflow/publication/teachers/'+teacher.id,setBody('PUT',{channel:d.get('channel'),mention:d.get('mention')}));
    setNotice('老师的微信提醒配置已保存');refresh();
   }}>
    <div className="form-grid"><label>群路由<input name="channel" defaultValue={teacher.channel} placeholder="例如：公众号一审群"/></label>
    <label>@ 标识<input name="mention" defaultValue={teacher.mention} placeholder="例如：中继识别的老师账号"/></label></div>
   </ActionForm>
  </fieldset>)}
 </section>;
}

export function TaskReportNote({task,user,refresh}){
 const [editing,setEditing]=useState(false);
 const editable=task.canEditReportNote||manages(user,task.department_id)||[task.creator_id,task.assignee_id].includes(user.id);
 return <div className="task-note"><h3>任务备注</h3>
 {editing?<ActionForm label="保存任务备注" secondary={<Btn type="button" onClick={()=>setEditing(false)}>取消</Btn>} onSubmit={async form=>{
  await api('/tasks/'+task.id+'/report-note',setBody('PATCH',{reportNote:form.get('reportNote')}));
  setEditing(false);refresh();
 }}><textarea aria-label="任务备注" name="reportNote" maxLength={2000} rows={3} defaultValue={task.report_note}/></ActionForm>:<>
  {task.report_note?<p className="prose">{task.report_note}</p>:<p className="subtle">暂无备注</p>}
  {editable&&<Btn kind="quiet tiny" onClick={()=>setEditing(true)}>编辑任务备注</Btn>}
 </>}</div>;
}

function RotationEditor({department,people,rotation,onSaved}){
 const [roster,setRoster]=useState(rotation.members.map(person=>person.id));
 const [candidate,setCandidate]=useState('');
 const names=new Map([...rotation.members,...people].map(p=>[p.id,p.name]));
 const eligible=new Set(people.map(person=>person.id));
 const move=(index,offset)=>setRoster(list=>{
  const result=[...list];const target=index+offset;
  [result[index],result[target]]=[result[target],result[index]];
  return result;
 });
 return <ActionForm label="保存轮值名单" onSubmit={async()=>{
  await api('/workflow/duty',setBody('PUT',{departmentId:department,personIds:roster}));
  onSaved();
 }}>
  {rotation.nextId&&<p className="subtle">当前下一位 · {names.get(rotation.nextId)}</p>}
  {roster.length>0?<ol className="plain-list rotation-list">{roster.map((id,index)=><li key={id}><span>{index+1}. {names.get(id)}{!eligible.has(id)&&'（已失效）'}</span>
   <div className="toolbar">
    <button type="button" className="btn quiet tiny" disabled={!index} onClick={()=>move(index,-1)} aria-label={'上移'+names.get(id)}>上移</button>
    <button type="button" className="btn quiet tiny" disabled={index===roster.length-1} onClick={()=>move(index,1)} aria-label={'下移'+names.get(id)}>下移</button>
    <Btn type="button" kind="quiet tiny" onClick={()=>setRoster(list=>list.filter(value=>value!==id))}>移除</Btn>
   </div>
  </li>)}</ol>:<p className="subtle">名单为空，新任务会等待手动派发。</p>}
  <div className="toolbar"><label>添加轮值成员<select value={candidate} onChange={e=>setCandidate(e.target.value)}>
   <option value="">请选择</option>{personOptions(people.filter(person=>!roster.includes(person.id)))}
  </select></label><button type="button" className="btn" disabled={!candidate} onClick={()=>{setRoster(list=>[...list,candidate]);setCandidate('');}}>添加成员</button></div>
 </ActionForm>;
}

export function WorkflowSettings({user,version,refresh}){
 const options=useRemote('/workflow/options',version);
 const [department,setDepartment]=useState(user.departmentId||'operations');
 const [notice,setNotice]=useState('');
 const duty=useRemote('/workflow/duty?department='+department,version);
 const defaults=useRemote('/workflow/defaults?department='+department,version);
 const {policy,rules=[],departments=[],people=[]}=options.data||{};
 return <><Heading title="流程设置"/>{notice&&<div className="success" role="status">{notice}</div>}
 <Feedback {...options}/>
 {user.role==='admin'&&<label className="date-field">设置部门<select value={department} onChange={e=>setDepartment(e.target.value)}>{deptOptions(departments)}</select></label>}
 <section className="panel"><h2>默认承接人</h2><p className="subtle">派发时可勾选「设为此流程默认承接人」。此后新任务会自动派发。</p>
 <Feedback {...defaults}/>
 {defaults.data?.length>0?<ul className="plain-list">{defaults.data.map(item=><li key={item.kind}><span>{kinds[item.kind]} · {item.name}{!item.available&&'（已失效）'}</span>
 <ActionForm label="取消默认" onSubmit={async()=>{await api('/workflow/defaults/'+department+'/'+item.kind,{method:'DELETE'});setNotice('已取消默认承接');refresh();}}/></li>)}</ul>:defaults.data&&<p className="subtle">本部门未设置默认承接人。</p>}
 </section>
 {manages(user,'operations')&&<PublicationSettings options={options.data} version={version} refresh={refresh} setNotice={setNotice}/>}
 <section className="panel"><h2>轮值名单</h2><p className="subtle">任务进入待派发时，按名单顺序轮流接单。已有默认承接人的流程优先派给默认成员。</p>
 <Feedback {...duty}/>{duty.url==='/workflow/duty?department='+department&&duty.data&&options.data&&<RotationEditor key={department+':'+duty.data.members.map(person=>person.id).join(',')} department={department} people={people.filter(p=>p.department_id===department)}
 rotation={duty.data} onSaved={()=>{setNotice('轮值名单已保存');refresh();}}/>}</section>
 {policy&&<section className="panel"><h2>工时规则</h2><p className="subtle">第 {policy.version} 版 · {policy.rate_cents/100} 元/小时 · 加急 ×{policy.urgent_factor/10000}</p>
 {user.role==='admin'&&<ActionForm key={policy.version} label="保存为新版本" onSubmit={async d=>{
  const ruleId=optionalNumber(d.get('rule'));
  await api('/workflow/policy',setBody('PATCH',{expectedVersion:policy.version,rateCents:Math.round(Number(d.get('rate'))*100),urgentFactor:Math.round(Number(d.get('factor'))*10000),photoWindow:Number(d.get('photo')),publicationWindow:Number(d.get('publication')),reason:d.get('reason'),rules:ruleId?[{id:ruleId,hours:Number(d.get('hours'))}]:[]}));
  setNotice('新规则版本已生效');refresh();
 }}>
  <div className="form-grid"><label>时薪（元）<input required name="rate" type="number" step="0.01" min="0.01" defaultValue={policy.rate_cents/100}/></label><label>加急倍数<input required name="factor" type="number" step="0.0001" min="1" defaultValue={policy.urgent_factor/10000}/></label></div>
  <div className="form-grid"><label>摄制加急阈值（小时）<input required name="photo" type="number" min="1" max="720" defaultValue={policy.photo_window}/></label><label>排版报名加急阈值（小时）<input required name="publication" type="number" min="1" max="720" defaultValue={policy.publication_window}/></label></div>
  <div className="form-grid"><label>调整一条创作或执行规则<select name="rule"><option value="">不调整</option>{ruleOptions(rules.filter(r=>!r.review))}</select></label><label>新工时<input name="hours" type="number" min="0.0001" step="0.0001"/></label></div>
  <label>变更原因<input name="reason" required/></label>
 </ActionForm>}
 <div className="table-scroll"><table className="data-table"><thead><tr><th>编号</th><th>部门</th><th>工作类型</th><th>单位</th><th>工时</th></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td>{r.id}</td><td>{departments.find(d=>d.id===r.department_id)?.name}</td><td>{r.name}</td><td>{r.unit}</td><td>{formatHours(r.units/10000)} h</td></tr>)}</tbody></table></div>
 <p className="subtle">来源 · BIZ-RULES-FULL.md 第四部分。基础审校工时按 2 小时执行。</p>
 </section>}</>;
}
