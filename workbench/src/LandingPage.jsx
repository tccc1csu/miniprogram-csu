import React,{useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,ArrowUpRight,Archive,BookOpen,Check,CheckCheck,ChevronRight,LayoutDashboard,Maximize2,MessageSquare,MoveUpRight,PenLine,Plus,ShieldCheck,Sparkles,Table2,Users,X} from 'lucide-react';
import tasksImage from './assets/landing/tasks.png';
import reviewImage from './assets/landing/review.png';
import reportsImage from './assets/landing/reports.png';
import './landing.css';

const showcases=[
 {key:'tasks',label:'任务协作',icon:LayoutDashboard,title:'告别消息翻找，\n让进度一目了然。',description:'每一项需求，都有清晰的去向。谁来承接、进行到哪一步、何时交付，打开任务就能找到答案。',points:['集中提交需求与素材','按顺序轮值，或设置默认承接人','任务进度、文件与处理记录放在一起'],image:tasksImage,alt:'任务中心示例：查看稿件标题、当前环节、处理人与截止时间',caption:'任务中心 · 从需求开始，把协作理清楚'},
 {key:'review',label:'稿件审校',icon:MessageSquare,title:'意见落在文中，\n修改更有方向。',description:'选中预览中的文字，直接留下批注。供稿、排版与审校围绕同一份任务展开，每一版修改都有迹可循。',points:['兄弟组织来稿先经采编内容审核','运营内审后，由不同老师完成两审','稿件版本与对应审校意见一起保留'],image:reviewImage,alt:'稿件审校示例：任务进度、文章预览、文中批注与审核记录',caption:'稿件审校 · 对着内容提意见，跟着版本看修改'},
 {key:'reports',label:'工时与报表',icon:Table2,title:'每一份付出，\n都有清楚的记录。',description:'从任务成果到工时核定，数据自然衔接。平时查得清楚，期末就能少一点反复核对。',points:['规则工时与核定工时分别记录','特殊调整保留原因，备注随表导出','自由筛选、保存视图、导出 Excel 与封存'],image:reportsImage,alt:'工时与报表示例：规则工时、核定工时、津贴、筛选及 Excel 导出',caption:'工时与报表 · 留下依据，让结算有据可查'}
];
const guides=[
 {role:'需求方',label:'我想提出需求',title:'把需求说清楚，剩下的有迹可循。',description:'适合学生组织对接人，以及需要发布、摄制或设计支持的同学。',steps:[['新建需求','选择业务类型，填写标题、说明与截止时间。'],['交齐材料','上传供稿与素材；如需补充，在原任务中继续提交。'],['跟进进度','查看承接与审核状态，按退回意见补充内容。']]},
 {role:'部门干事',label:'我是部门干事',title:'从「我的待办」，开始今天的创作。',description:'接到任务、提交成果、查看修改要求，围绕一条任务完成协作。',steps:[['找到待办','在工作首页查看分配给自己的任务与截止时间。'],['提交成果','打开任务上传材料；有修改时，按意见提交新版本。'],['查看记录','任务正常完成后查看归档成果，并在工时报表核对个人记录。']]},
 {role:'部门部长',label:'我是部门部长',title:'分配有章法，部门协作更从容。',description:'把精力留给内容和团队，承接安排与审核进度交给工作台记录。',steps:[['安排承接','手动派发任务，或配置部门轮值、常用默认承接人。'],['完成审核','在待办中查看成果、留下意见并按流程提交审核结果。'],['核定工时','核对部门贡献，特殊情况填写调整原因，保留核定记录。']]},
 {role:'指导老师',label:'我是指导老师',title:'在对应的审校环节，给出清晰意见。',description:'公众号一审和二审由不同老师负责，当前稿件和历史意见均可查看。',steps:[['查看待审','登录后，从「我的待办」进入分配给自己的稿件。'],['阅读与批注','查看工作台文章预览，选中文字留下具体修改建议。'],['提交结果','通过或退回稿件；退回时说明需要修改的内容。']]},
 {role:'办公部',label:'我负责统计结算',title:'从一条记录，到一份完整的学期报表。',description:'让日常协作留下的数据，成为期末核对与结算的依据。',steps:[['筛选记录','按部门、成员、日期等条件查看工时明细。'],['核对依据','检查任务备注、规则工时、核定值与调整原因。'],['导出与封存','保存常用视图，导出 Excel；确认后封存报表快照。']]}
];
const flow=[
 {number:'01',icon:Plus,title:'说清需求',text:'选业务、写要求、交材料，让协作有一个明确起点。'},
 {number:'02',icon:Users,title:'安排承接',text:'按部门轮值或默认安排派发，明确负责人和截止时间。'},
 {number:'03',icon:PenLine,title:'交付与审核',text:'提交成果、批注修改、完成对应审核，保留每一步记录。'},
 {number:'04',icon:Archive,title:'归档与核算',text:'任务正常完成后自动归档，按业务规则生成内部成员工时。'}
];
const faqs=[
 ['第一次使用，账号从哪里来？','请联系中心管理员获取账号。登录后，工作台会根据你的身份和所属部门展示可处理的任务，不需要自己选择权限。'],
 ['不同部门都可以在这里协作吗？','可以。工作台覆盖办公、采编、运营、摄制、美编、原创六部门的业务。公众号排版、新闻稿、摄影摄像、设计等需求，可在同一个工作台中跟进。'],
 ['任务完成后，还需要手动整理档案吗？','正常完成的任务会自动归档，保留成果、文件和审核记录。强制关闭会保留关闭原因，但不会自动生成工时。'],
 ['实际工时和规则不同，怎么说明？','部长可根据实际情况核定工时，并记录调整原因。任务备注、规则工时、核定工时和调整说明会一起出现在导出的 Excel 中。老师和外部人员保留参与记录，不计工时。'],
 ['可以用小程序或微信群处理吗？','当前网页可用于日常协作。小程序正在联调中，正式服务入口尚未启用；微信机器人尚未接通。现阶段请以网页中的任务状态与站内通知为准。']
];

function Brand(){return <span className="landing-brand"><span className="landing-brand-symbol"><BookOpen size={23} strokeWidth={1.7}/></span><span><strong>青年传媒中心</strong><small>YOUTH MEDIA WORKSPACE</small></span></span>;}
function goTo(id){
 const element=document.getElementById(id);if(!element)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 element.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
 const focus=id==='welcome-login'?element.querySelector('input'):element.querySelector('h2');
 focus?.focus({preventScroll:true});
}
function ScreenshotDialog({item,onClose}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();return()=>{dialog.close();document.body.style.overflow=overflow;};},[]);
 const close=()=>{ref.current.close();onClose();};
 return <dialog className="landing-preview-dialog" ref={ref} aria-label={item.label+'界面预览'} onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{if(event.key==='Tab'){event.preventDefault();ref.current.querySelector('button').focus();}}} onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="landing-preview-head"><span>{item.label}<small>独立演示数据 · 实际工作台截图</small></span><button type="button" onClick={close} aria-label="关闭界面预览" autoFocus><X size={22}/></button></div><img src={item.image} alt={item.alt}/></dialog>;
}

export default function LandingPage({children}){
 const [active,setActive]=useState(0),[role,setRole]=useState(0),[preview,setPreview]=useState(null);
 const previewTrigger=useRef(null);
 const showPreview=entry=>{previewTrigger.current=document.activeElement;setPreview(entry);};
 const closePreview=()=>{setPreview(null);previewTrigger.current?.focus({preventScroll:true});};
 const item=showcases[active],guide=guides[role];
 return <div className="landing">
  <a className="landing-skip" href="#welcome-main" onClick={e=>{e.preventDefault();document.getElementById('welcome-main').focus();}}>跳到主要内容</a>
  <header className="landing-header"><div className="landing-container landing-header-inner"><button type="button" className="landing-brand-button" aria-label="回到顶部" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><Brand/></button><nav aria-label="产品介绍导航"><button onClick={()=>goTo('welcome-features')}>功能一览</button><button onClick={()=>goTo('welcome-flow')}>协作流程</button><button onClick={()=>goTo('welcome-guide')}>使用指南</button></nav><button className="landing-nav-login" onClick={()=>goTo('welcome-login')}>进入工作台 <ArrowUpRight size={16}/></button></div></header>
  <main id="welcome-main" tabIndex={-1}>
   <section className="landing-hero landing-container" aria-labelledby="welcome-title">
    <div className="landing-login-column"><section id="welcome-login" className="landing-login-card" aria-labelledby="welcome-login-title"><div className="landing-login-top"><span className="landing-live-dot"/>你的创作，从这里继续<span className="landing-mini-star" aria-hidden="true">✳</span></div><h2 id="welcome-login-title">欢迎回到工作台<span>很高兴，与你一起记录校园。</span></h2>{children}</section><div className="landing-side-note"><span className="landing-side-line"/><p>让热爱被看见，<br/>也让每一份付出被记得。</p><span>为青年传媒中心的日常协作而设计</span></div><div className="landing-side-label"><span>一起创造，一起成长</span><ArrowDown size={17}/></div></div>
    <div className="landing-hero-story"><div className="landing-eyebrow"><span/>更有序的协作，更专注的创作</div><h1 id="welcome-title">把热爱聚在一起，<br/>让好内容<span className="landing-highlight">顺利发生。<svg viewBox="0 0 350 17" preserveAspectRatio="none" aria-hidden="true"><path d="M3 12 Q164 -4 345 8"/></svg></span></h1><p className="landing-hero-description">从一个需求，到一份作品，再到一份被记录的付出。<br className="landing-desktop-break"/>属于青年传媒中心的协作工作台，让每一步都有回应。</p><div className="landing-hero-actions"><button className="landing-action landing-action-dark" onClick={()=>goTo('welcome-features')}>看看能做什么 <ArrowDown size={16}/></button><button className="landing-action-text" onClick={()=>goTo('welcome-guide')}>第一次使用？从这里开始 <ArrowUpRight size={16}/></button></div>
     <div className="landing-hero-product"><span className="landing-orbit-star" aria-hidden="true">✳</span><div className="landing-window"><div className="landing-window-bar"><span className="landing-window-dots"><i/><i/><i/></span><span>你的校园协作空间</span><span className="landing-window-demo">示例界面</span></div><button className="landing-hero-screen" onClick={()=>showPreview(showcases[0])} aria-label="放大任务中心示例"><img src={tasksImage} width="1440" height="900" alt={showcases[0].alt} fetchPriority="high"/><span className="landing-screen-zoom"><Maximize2 size={16}/>查看实际界面</span></button></div><div className="landing-archive-float"><span><CheckCheck size={21}/></span><div><strong>好作品，值得好好留存。</strong><small>正常完成任务 · 自动归档成果</small></div><Archive size={18}/></div></div>
    </div>
   </section>
   <section className="landing-departments landing-container" aria-label="六部门协作"><div><span>各有所长，同频协作</span><strong>一个工作台，连接六个部门。</strong></div><ul>{['办公部','采编部','运营部','摄制部','美编部','原创部'].map((name,i)=><li key={name}><span>0{i+1}</span>{name}</li>)}</ul></section>
   <section id="welcome-features" className="landing-features landing-section" aria-labelledby="features-title"><div className="landing-container"><div className="landing-section-heading"><div><span className="landing-eyebrow">DESIGNED FOR YOUR EVERYDAY</span><h2 id="features-title" tabIndex={-1}>少一点来回，多一点<span>默契。</span></h2></div><p>把散落的任务、意见与记录，<br/>放进一个清晰的协作空间。</p></div><div className="landing-feature-tabs" aria-label="功能展示">{showcases.map((entry,i)=><button key={entry.key} aria-pressed={active===i} onClick={()=>setActive(i)}><entry.icon size={19}/>{entry.label}<span>0{i+1}</span></button>)}</div><div className="landing-feature-content"><div className="landing-feature-copy" aria-live="polite"><span className="landing-index">0{active+1} / 03</span><h3>{item.title.split('\n').map((line,i)=><React.Fragment key={line}>{i>0&&<br/>}{line}</React.Fragment>)}</h3><p>{item.description}</p><ul>{item.points.map(point=><li key={point}><Check size={15}/>{point}</li>)}</ul><button className="landing-action-text" onClick={()=>showPreview(item)}>展开界面，看看细节 <ArrowUpRight size={17}/></button></div><figure className={'landing-feature-figure feature-'+item.key}><button onClick={()=>showPreview(item)} aria-label={'放大'+item.label+'示例'}><img src={item.image} width="1440" height="900" alt={item.alt} loading="lazy"/><span className="landing-screen-zoom"><Maximize2 size={16}/>放大预览</span></button><figcaption><span>{item.caption}</span><small>示例数据</small></figcaption></figure></div></div></section>
   <section id="welcome-flow" className="landing-workflow landing-section" aria-labelledby="workflow-title"><div className="landing-container"><div className="landing-section-heading"><div><span className="landing-eyebrow">FROM AN IDEA TO AN IMPACT</span><h2 id="workflow-title" tabIndex={-1}>从「有个想法」，<br/>到「完成得很漂亮」。</h2></div><p>每一步衔接，都有清楚的记录。<br/>让作品走完流程，也让付出留下回响。</p></div><ol className="landing-flow-list">{flow.map(step=><li key={step.number}><div className="landing-flow-top"><span>{step.number}</span><step.icon size={24} strokeWidth={1.5}/><ArrowRight size={20} className="landing-flow-arrow"/></div><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol><div className="landing-flow-note"><ShieldCheck size={17}/><span>不同业务有各自的审核要求；你的待办会告诉你，下一步该做什么。</span></div></div></section>
   <section id="welcome-guide" className="landing-guide landing-section" aria-labelledby="guide-title"><div className="landing-container"><div className="landing-section-heading"><div><span className="landing-eyebrow">A GOOD START, FOR EVERYONE</span><h2 id="guide-title" tabIndex={-1}>第一次来？<span>找到你的开始。</span></h2></div><p>不必一下学会所有功能，<br/>先从与你有关的三步开始。</p></div><div className="landing-guide-layout"><div className="landing-role-list" aria-label="选择使用身份">{guides.map((entry,i)=><button key={entry.role} aria-pressed={role===i} onClick={()=>setRole(i)}><span>0{i+1}</span>{entry.label}<ChevronRight size={18}/></button>)}</div><div className="landing-role-content" aria-live="polite"><span className="landing-role-kicker">FOR {guide.role}</span><h3>{guide.title}</h3><p>{guide.description}</p><ol>{guide.steps.map(([title,text],i)=><li key={title}><span>{i+1}</span><div><h4>{title}</h4><p>{text}</p></div></li>)}</ol><button className="landing-action-text" onClick={()=>goTo('welcome-login')}>了解了，去登录 <ArrowUpRight size={17}/></button></div></div></div></section>
   <section className="landing-faq landing-container" aria-labelledby="faq-title"><div><span className="landing-eyebrow">A LITTLE MORE TO KNOW</span><h2 id="faq-title">你可能还想了解</h2><p>几个小问题，提前为你解答。</p><span className="landing-faq-flower" aria-hidden="true">✳</span></div><div className="landing-faq-list">{faqs.map(([question,answer])=><details key={question}><summary>{question}<Plus size={19}/></summary><p>{answer}</p></details>)}</div></section>
   <section className="landing-bottom-cta landing-container"><div><span className="landing-eyebrow">GOOD WORK STARTS TOGETHER</span><h2>下一份好作品，<br className="landing-mobile-break"/>我们一起完成。</h2><p>把协作理顺，把时间留给创作。</p></div><button className="landing-action landing-action-dark" onClick={()=>goTo('welcome-login')}>登录，开始今天的协作 <ArrowUpRight size={18}/></button><Sparkles className="landing-cta-spark" size={70} strokeWidth={1} aria-hidden="true"/></section>
  </main>
  <footer className="landing-footer landing-container"><Brand/><span>记录校园，也记录每一份热爱。</span><button onClick={()=>goTo('welcome-guide')}>使用指南 <MoveUpRight size={14}/></button><small>© {new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Shanghai'}).format(new Date())} 青年传媒中心</small></footer>
  {preview&&<ScreenshotDialog item={preview} onClose={closePreview}/>}
 </div>;
}
