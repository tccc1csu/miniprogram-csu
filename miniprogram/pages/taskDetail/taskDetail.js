const api = require('../../utils/api');
const model = require('../../utils/model');

Page({
  data: {
    id: '', user: null, task: null, detail: null, versions: [], reviews: [], events: [], files: [],
    annotations: [], registrations: [], contributions: [], lines: [], linked: [],
    people: [], teachers: [], assignees: [], reviewers: [],
    assigneeIndex: 0, teacher1Index: 0, teacher2Index: 0,
    selectedReviewerIds: [], selectedFileIds: [], pendingFiles: [],
    form: { body: '', reason: '', url: '', reportNote: '', assigneeId: '', remember: false, rememberReviewers: false, teacherIds: [] },
    error: '', loading: true, busy: false, publicOnly: false
  },
  onLoad(query) { this.setData({ id: query.id || '' }); },
  onShow() { if (this.data.id) this.refresh(); },

  async refresh() {
    this.setData({ loading: true, error: '' });
    try {
      const user = await api.user();
      const tasks = await api.request('/tasks');
      const publicTask = (tasks || []).find(item => item.id === this.data.id && item.publicOnly);
      if (publicTask) {
        this.setData({ user, task: model.task(publicTask), detail: null, publicOnly: true, files: [], versions: [], reviews: [], events: [] });
        wx.setNavigationBarTitle({ title: publicTask.title || '组织报名' });
        return;
      }
      const detail = await api.request('/tasks/' + encodeURIComponent(this.data.id));
      const task = detail.task || detail;
      const options = await api.request('/workflow/options').catch(() => ({ people: [] }));
      const people = (options.people || []).filter(person => person.role !== 'teacher');
      const teachers = (options.people || []).filter(person => person.role === 'teacher');
      const assignees = people.filter(person => !task.department_id || person.department_id === task.department_id);
      const reviewerCandidates = people.filter(person => person.role === 'minister' && person.department_id === 'operations');
      const selectedReviewerIds = task.reviewers?.length === 2 ? task.reviewers.map(person => person.id) : reviewerCandidates.slice(0, 2).map(person => person.id);
      const teacher1Index = Math.max(0, teachers.findIndex(person => person.id === task.teacher1_id));
      const teacher2Index = Math.max(0, teachers.findIndex(person => person.id === task.teacher2_id));
      const reviewers = reviewerCandidates.map(person => ({ ...person, checked: selectedReviewerIds.includes(person.id) }));
      this.setData({
        user, detail, task: model.task(task), publicOnly: false,
        versions: detail.versions || [], reviews: detail.reviews || [], events: (detail.events || []).map(item=>({...item,created_at:model.date(item.created_at)})),
        files: (detail.files || []).map(file => ({ ...file, selected: false })), annotations: (detail.annotations || []).map(item=>({...item,created_at:model.date(item.created_at)})), registrations: (detail.registrations || []).map(item=>({...item,created_at:model.date(item.created_at)})),
        contributions: detail.contributions || [], lines: detail.lines || [], linked: detail.linked || [], linkedFiles: detail.linkedFiles || [], booking: detail.booking || null, entry: detail.entry ? {...detail.entry,hours:(detail.contributions || []).filter(c=>c.kind==='entry').reduce((sum,c)=>sum+c.effective_units/10000,0)} : null,
        people, teachers, assignees, reviewers, selectedReviewerIds,
        assigneeIndex: Math.max(0, assignees.findIndex(person => person.id === task.assignee_id)),
        teacher1Index, teacher2Index,
        capabilities: model.capabilities(user, task),
        'form.reportNote': task.report_note || '',
        'form.assigneeId': task.assignee_id || assignees[0]?.id || '',
        'form.teacherIds': [task.teacher1_id || '', task.teacher2_id || '']
      });
      wx.setNavigationBarTitle({ title: task.title || '任务详情' });
    } catch (error) { api.fail(this, error); }
    finally { this.setData({ loading: false }); }
  },

  input(event) { this.setData({ ['form.' + event.currentTarget.dataset.field]: event.detail.value }); },
  pickAssignee(event) {
    const index = Number(event.detail.value);
    this.setData({ assigneeIndex: index, 'form.assigneeId': this.data.assignees[index]?.id || '' });
  },
  pickTeacher1(event) { this.setData({ teacher1Index: Number(event.detail.value) }); },
  pickTeacher2(event) { this.setData({ teacher2Index: Number(event.detail.value) }); },
  toggleReviewer(event) {
    const id = event.currentTarget.dataset.id;
    const selected = new Set(this.data.selectedReviewerIds);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    const selectedReviewerIds = [...selected];
    this.setData({ selectedReviewerIds, reviewers: this.data.reviewers.map(person => ({ ...person, checked: selected.has(person.id) })) });
  },
  toggleRemember() { this.setData({ 'form.remember': !this.data.form.remember }); },
  toggleRememberReviewers() { this.setData({ 'form.rememberReviewers': !this.data.form.rememberReviewers }); },
  toggleFile(event) {
    const id = event.currentTarget.dataset.id;
    const selected = new Set(this.data.selectedFileIds);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    const selectedFileIds = [...selected];
    this.setData({ selectedFileIds, files: this.data.files.map(file => ({ ...file, selected: selected.has(file.id) })) });
  },
  async chooseFiles() {
    try {
      const files = await api.chooseFiles();
      this.setData({ pendingFiles: [...this.data.pendingFiles, ...files], error: '' });
    } catch (error) { this.setData({ error: api.errorText(error) }); }
  },
  async uploadPending() {
    const freshIds = this.data.pendingFiles.length ? await api.uploads(this.data.id, this.data.pendingFiles) : [];
    return [...new Set([...this.data.selectedFileIds, ...freshIds])];
  },
  async submitVersion() {
    if (!this.data.form.body.trim() && !this.data.pendingFiles.length && !this.data.selectedFileIds.length) return this.setData({ error: '请填写成果说明或选择附件' });
    await this.run(async () => {
      const fileIds = await this.uploadPending();
      if (this.data.task.kind === 'publication') await api.request('/tasks/' + this.data.id + '/versions', 'POST', { body: this.data.form.body.trim(), fileIds });
      else await api.request('/tasks/' + this.data.id + '/actions/submit', 'POST', { body: this.data.form.body.trim(), fileIds });
      this.setData({ 'form.body': '', pendingFiles: [], selectedFileIds: [] });
    });
  },
  async submitSource() {
    if (!this.data.form.body.trim() && !this.data.pendingFiles.length && !this.data.selectedFileIds.length) return this.setData({ error: '请填写供稿内容或选择附件' });
    await this.run(async () => {
      const fileIds = await this.uploadPending();
      await api.request('/tasks/' + this.data.id + '/source', 'POST', { body: this.data.form.body.trim(), fileIds });
      this.setData({ 'form.body': '', pendingFiles: [], selectedFileIds: [] });
    });
  },
  async register() {
    if (!this.data.form.body.trim() && !this.data.pendingFiles.length) return this.setData({ error: '请填写报名说明或选择附件' });
    await this.run(async () => {
      const fileIds = await this.uploadPending();
      await api.request('/tasks/' + this.data.id + '/register', 'POST', { notes: this.data.form.body.trim(), fileIds });
      this.setData({ 'form.body': '', pendingFiles: [], selectedFileIds: [] });
    });
  },
  async assign() {
    const assigneeId = this.data.form.assigneeId;
    if (!assigneeId) return this.setData({ error: '请选择承接人' });
    const payload = { assigneeId, remember: !!this.data.form.remember };
    if (this.data.task.kind === 'publication') {
      if (this.data.selectedReviewerIds.length !== 2) return this.setData({ error: '请选择两位运营部部长完成内审' });
      const teacherIds = [this.data.teachers[this.data.teacher1Index]?.id, this.data.teachers[this.data.teacher2Index]?.id];
      if (!teacherIds[0] || !teacherIds[1] || teacherIds[0] === teacherIds[1]) return this.setData({ error: '请选择两位不同的指导老师' });
      payload.reviewerIds = this.data.selectedReviewerIds;
      payload.teacherIds = teacherIds;
      payload.rememberReviewers = !!this.data.form.rememberReviewers;
    }
    await this.run(() => api.request('/tasks/' + this.data.id + (this.data.task.kind === 'publication' ? '/assign' : '/actions/assign'), 'POST', payload));
  },
  async claim() { await this.run(() => api.request('/tasks/' + this.data.id + '/actions/claim', 'POST', {})); },
  async setTeachers() {
    const teacherIds = [this.data.teachers[this.data.teacher1Index]?.id, this.data.teachers[this.data.teacher2Index]?.id];
    if (!teacherIds[0] || !teacherIds[1] || teacherIds[0] === teacherIds[1]) return this.setData({ error: '请选择两位不同的指导老师' });
    await this.run(() => api.request('/tasks/' + this.data.id + '/teachers', 'PUT', { teacherIds }));
  },
  async review(stage, decision) {
    const version = stage === 'editorial' ? this.data.task.source : this.data.task.version;
    if (!version?.id) return this.setData({ error: '当前没有可审核版本，请刷新任务' });
    if (decision === 'reject' && !this.data.form.reason.trim()) return this.setData({ error: '退回时必须填写理由' });
    const body = { stage, versionId: version.id, decision, reason: this.data.form.reason.trim() };
    if (this.data.task.kind === 'publication') await this.run(() => api.request('/tasks/' + this.data.id + '/reviews', 'POST', body));
    else await this.run(() => api.request('/tasks/' + this.data.id + '/actions/' + stage, 'POST', body));
  },
  reviewApprove(event) { return this.review(event.currentTarget.dataset.stage, 'approve'); },
  reviewReject(event) { return this.review(event.currentTarget.dataset.stage, 'reject'); },
  async publish() {
    if (!this.data.form.url.trim()) return this.setData({ error: '请填写发布链接' });
    const versionId = this.data.task.version?.id;
    if (!versionId) return this.setData({ error: '当前没有可发布版本，请刷新任务' });
    await this.run(() => api.request('/tasks/' + this.data.id + '/publish', 'POST', { url: this.data.form.url.trim(), versionId }));
  },
  async saveNote() { await this.run(() => api.request('/tasks/' + this.data.id + '/report-note', 'PATCH', { reportNote: this.data.form.reportNote.trim() })); },
  async action(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'force-archive' && !this.data.form.reason.trim()) return this.setData({ error: '强制归档必须填写原因' });
    await this.run(() => api.request('/tasks/' + this.data.id + '/actions/' + action, 'POST', { reason: this.data.form.reason.trim() }));
  },
  async supplement() {
    if (!this.data.pendingFiles.length) return this.setData({ error: '请选择要补交的附件' });
    await this.run(async () => {
      await api.uploads(this.data.id, this.data.pendingFiles);
      this.setData({ pendingFiles: [], selectedFileIds: [] });
    });
  },
  openFile(event) {
    const file = [...this.data.files,...(this.data.linkedFiles||[])].find(item => item.id === event.currentTarget.dataset.id);
    if (file) api.download(file).catch(error => this.setData({ error: api.errorText(error) }));
  },
  openLinked(event) { wx.navigateTo({ url: '/pages/taskDetail/taskDetail?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  openWeb() { api.web('#task/' + encodeURIComponent(this.data.id)); },
  createLinked() { wx.navigateTo({url:'/pages/create/create?kind=publication&linkedTaskId='+encodeURIComponent(this.data.id)}); },
  async run(action) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { await action(); wx.showToast({ title: '已更新', icon: 'success' }); await this.refresh(); }
    catch (error) { this.setData({ error: api.errorText(error) }); }
    finally { this.setData({ busy: false }); }
  }
});
