const api=require('../../utils/api'),m=require('../../utils/model');
const optional={id:'',name:'不启用老师内容审校'},manual={id:'',name:'人工填报 / 不指定规则'};
Page({
 data:{kind:'',user:null,title:'',error:'',loading:true,busy:false,form:{title:'',notes:'',date:'',time:'18:00',location:'',contact:'',urgentReason:'',layoutType:'basic',complexity:'basic',week:'',hours:'',openRegistration:false},files:[],lines:[{title:'',site:'',original:false,authorId:''}],selectedReviewers:[],rules:[],people:[],teachers:[],authors:[],reviewers:[],departments:[],departmentIndex:0,personIndex:0,ruleIndex:0,teacherIndex:0,linkedTaskId:''},
 onLoad(q){this.setData({kind:q.kind||'request',linkedTaskId:q.linkedTaskId||''});this.refresh();},
 async refresh(){try{const user=await api.user();if(!m.canCreate(user,this.data.kind,!!this.data.linkedTaskId))throw new Error('此身份不能发起该业务');const o=await api.request('/workflow/options');const people=o.people||[],departments=(o.departments||[]).filter(d=>this.data.kind!=='request'||user.role!=='minister'||d.id==='original');const eligible=people.filter(p=>p.role!=='teacher'&&(p.id===user.id||m.manage(user,p.department_id)));const personIndex=Math.max(0,eligible.findIndex(p=>p.id===user.id));this.options=o;this.setData({user,title:m.labels[this.data.kind],people:eligible,personIndex,departments,authors:people.filter(p=>p.department_id==='editorial'&&p.role!=='teacher'),reviewers:people.filter(p=>p.role==='teacher'||p.role==='minister'&&p.department_id==='editorial').map(p=>({...p,checked:false})),teachers:[optional,...people.filter(p=>p.role==='teacher')]});this.rules();}catch(e){api.fail(this,e);}finally{this.setData({loading:false});}},
 rules(){const d=this.data.kind==='work_entry'?this.data.people[this.data.personIndex]?.department_id:this.data.departments[this.data.departmentIndex]?.id;this.setData({rules:[manual,...(this.options?.rules||[]).filter(r=>r.department_id===d&&(this.data.kind==='work_entry'||!r.review))],ruleIndex:0});},
 input(e){this.setData({['form.'+e.currentTarget.dataset.field]:e.detail.value});},
 pick(e){const field=e.currentTarget.dataset.field;this.setData({[field]:Number(e.detail.value)});if(['departmentIndex','personIndex'].includes(field))this.rules();},
 choose(e){this.setData({['form.'+e.currentTarget.dataset.field]:e.currentTarget.dataset.value});},
 registration(e){this.setData({'form.openRegistration':e.detail.value});},
 lineInput(e){const lines=this.data.lines.slice(),i=Number(e.currentTarget.dataset.index);lines[i]={...lines[i],[e.currentTarget.dataset.field]:e.detail.value};this.setData({lines});},
 lineOriginal(e){const lines=this.data.lines.slice();lines[Number(e.currentTarget.dataset.index)].original=e.detail.value;this.setData({lines});},
 lineAuthor(e){const lines=this.data.lines.slice(),i=Number(e.currentTarget.dataset.index),a=this.data.authors[Number(e.detail.value)];lines[i]={...lines[i],authorId:a?.id||'',authorName:a?.name||''};this.setData({lines});},
 addLine(){this.setData({lines:[...this.data.lines,{title:'',site:'',original:false,authorId:''}]});},
 removeLine(e){const lines=this.data.lines.filter((_,i)=>i!==Number(e.currentTarget.dataset.index));this.setData({lines});},
 reviewer(e){const id=e.currentTarget.dataset.id,selected=new Set(this.data.selectedReviewers);selected.has(id)?selected.delete(id):selected.add(id);this.setData({selectedReviewers:[...selected],reviewers:this.data.reviewers.map(r=>({...r,checked:selected.has(r.id)}))});},
 async files(){try{this.setData({files:await api.chooseFiles(),error:''});}catch(e){this.setData({error:api.errorText(e)});}},
 removeFile(e){this.setData({files:this.data.files.filter((_,i)=>i!==Number(e.currentTarget.dataset.index))});},
 payload(){const {kind,form:f}=this.data,b={kind,title:f.title.trim(),notes:f.notes.trim()};if(f.date)b.deadline=f.date+'T'+f.time+':00+08:00';
 if(kind==='publication')return {...b,layoutType:f.layoutType,openRegistration:f.openRegistration,...(this.data.linkedTaskId?{linkedTaskId:this.data.linkedTaskId}:{})};
 if(kind==='photo')return {...b,location:f.location.trim(),contact:f.contact.trim(),urgentReason:f.urgentReason.trim()};
 if(kind==='design')return {...b,complexity:f.complexity};
 if(kind==='web_article')return {...b,lines:this.data.lines.map(l=>({title:l.title.trim(),original:l.original,...(l.site.trim()?{site:l.site.trim()}:{}),...(l.original&&l.authorId?{authorId:l.authorId}:{})})),reviewerIds:this.data.selectedReviewers,...(this.data.teachers[this.data.teacherIndex]?.id?{teacherId:this.data.teachers[this.data.teacherIndex].id}:{})};
 const rule=this.data.rules[this.data.ruleIndex];if(rule?.id)b.ruleId=Number(rule.id);
 if(kind==='request')return {...b,departmentId:this.data.departments[this.data.departmentIndex]?.id};
 return {...b,personId:this.data.people[this.data.personIndex]?.id,week:Number(f.week),...(!b.ruleId?{hours:Number(f.hours)}:{}),...(this.data.linkedTaskId?{linkedTaskId:this.data.linkedTaskId}:{})};},
 async submit(){if(this.data.busy)return;const p=this.payload();if(p.title.length<2)return this.setData({error:'标题至少 2 个字'});if(['publication','photo'].includes(p.kind)&&!p.deadline)return this.setData({error:'请填写日期和时间'});if(p.kind==='web_article'&&(!p.lines.length||p.lines.some(l=>!l.title)||!p.reviewerIds.length))return this.setData({error:'请填写稿件并至少选择一位采编审校人员'});this.setData({busy:true,error:''});let id;try{id=(await api.request('/tasks','POST',p)).id;wx.redirectTo({url:'/pages/taskDetail/taskDetail?id='+id});}catch(e){api.fail(this,e);this.setData({error:api.errorText(e)+'。若超时，请先到任务记录核对，勿重复发起。'});}finally{this.setData({busy:false});}},
});
