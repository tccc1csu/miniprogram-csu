const roles = { admin: '管理员', minister: '部长', member: '干事', teacher: '指导老师', external: '兄弟组织' };
const departments = { office: '办公部', editorial: '采编部', operations: '运营部', photography: '摄制部', art: '美编部', original: '原创部' };
const labels = { publication: '推文排版', web_article: '采编办公协同', photo: '摄制预约协作', design: '设计需求', request: '部门需求', work_entry: '工作登记' };
const modules = [
  { id: 'publication', title: '推文排版', icon: '推', color: 'purple', meta: '供稿 · 排版 · 两审 · 发布', department: 'operations' },
  { id: 'web_article', title: '采编办公协同', icon: '协', color: 'blue', meta: '采编部 × 办公部 · 挂网与审校', department: 'office' },
  { id: 'photo', title: '摄制预约协作', icon: '摄', color: 'orange', meta: '预约 · 轮转承接 · 交付归档', department: 'photography' },
  { id: 'design', title: '设计需求', icon: '绘', color: 'red', meta: '设计委托 · 成果验收', department: 'art' },
  { id: 'request', title: '部门需求', icon: '外', color: 'green', meta: '组织需求 · 部门承接 · 附件', department: '' },
  { id: 'work_entry', title: '工作登记', icon: '记', color: 'blue', meta: '补充工作 · 周次记录 · 工时核对', department: '' }
];
const internal = u => ['admin', 'minister', 'member'].includes(u?.role);
const manage = (u, d) => u?.role === 'admin' || u?.role === 'minister' && u.departmentId === d;
function canCreate(u, kind, linked = false) {
  if (!u) return false;
  if (kind === 'publication') return u.role === 'external' || manage(u, 'operations') || linked && internal(u) && ['office', 'editorial'].includes(u.departmentId);
  if (kind === 'web_article') return u.role === 'admin' || internal(u) && u.departmentId === 'editorial';
  if (kind === 'photo') return internal(u) || u.role === 'external';
  if (kind === 'design') return internal(u) || ['external', 'teacher'].includes(u.role);
  if (kind === 'request') return ['external', 'admin'].includes(u.role) || manage(u, 'original');
  return kind === 'work_entry' && internal(u);
}
const finished = t => ['archived', 'recorded'].includes(t.state);
function date(value) { if (!value) return '未设置'; const n=new Date(value).getTime(); if(!Number.isFinite(n))return String(value); return new Date(n+8*3600000).toISOString().replace('T',' ').slice(0,16)+' 北京时间'; }
function task(t) { return { ...t, kindLabel: labels[t.kind] || '组织报名', timeLabel: date(t.deadline || t.archived_at), tone: finished(t) ? 'green' : /returned/.test(t.state) ? 'red' : ['internal', 'editorial', 'teacher1', 'teacher2', 'content', 'acceptance'].includes(t.state) ? 'purple' : 'orange', next: t.viewer?.nextLabel || t.stateLabel, owner: t.viewer?.ownerLabel || t.assignee_name || t.department_name || '承接部门' }; }
function capabilities(u, t) {
  const manager = manage(u, t.department_id), executor = manager || u.id === t.assignee_id, active = !finished(t), publication = t.kind === 'publication';
  const review = publication ? t.state === 'editorial' && manage(u, 'editorial') || t.state === 'internal' && (u.role === 'admin' || (t.reviewers || []).some(r => r.id === u.id)) || ['teacher1', 'teacher2'].includes(t.state) && u.role === 'teacher' && t[t.state + '_id'] === u.id : t.state === 'content' && u.role === 'teacher' && t.teacher_id === u.id || t.state === 'acceptance' && (manager || t.kind === 'web_article' && manage(u, 'editorial'));
  return {
    source: publication && ['source_pending', 'source_returned'].includes(t.state) && (t.canEditReportNote || u.id === t.creator_id || u.role === 'admin'),
    assign: manager && (t.state === 'awaiting_assignment' || t.state === 'awaiting_submission' && (publication || t.automatic && !t.version)),
    submit: executor && ['awaiting_submission', 'returned', ...(publication ? ['internal'] : [])].includes(t.state),
    review: !!review, publish: publication && executor && t.state === 'awaiting_publish',
    teachers: publication && manager && active && t.state !== 'awaiting_publish',
    upload: active && (u.role === 'external' ? !!t.canEditReportNote : manager || u.id === t.assignee_id || !publication && u.id === t.creator_id),
    note: manager || u.id === t.assignee_id || u.id === t.creator_id || !!t.canEditReportNote,
    force: manager && active && t.kind !== 'work_entry',
    claim: t.kind === 'photo' && t.state === 'awaiting_assignment' && u.role === 'member' && u.departmentId === 'photography',
    link: t.kind === 'web_article' && t.state === 'archived' && !t.archive_reason && canCreate(u, 'publication', true)
  };
}
function filterTasks(tasks, u, filter, query, kind) {
  const q = (query || '').trim().toLowerCase();
  return tasks.filter(t => (!kind || t.kind === kind) && (!q || (t.title + ' ' + t.number).toLowerCase().includes(q)) && (filter === 'todo' ? !!t.viewer?.action : filter === 'created' ? t.viewer?.createdByMe : filter === 'archived' ? finished(t) : filter === 'active' ? !finished(t) : true));
}
module.exports = { roles, departments, labels, modules, internal, manage, canCreate, capabilities, finished, task, date, filterTasks };
