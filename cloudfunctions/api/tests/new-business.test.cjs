// The behavior suite and export replay share the existing isolated API fixture.
const test = require('node:test')
const assert = require('node:assert/strict')
const { MemoryDB, loadAPI, layoutFixture } = require('./fixtures.cjs')
const documents = require('../business-documents')
function assigned(db, ids) {
  const task = db.rows.get('handoffs/layout1')
  db.seed('handoffs', 'layout1', { ...task, reviewAssignments: ids.map(member_id => ({ member_id, department: '运营部', name: db.rows.get('members/' + member_id).name })) })
}

test('旧审核来源别名跨周去重，成员改名后不重复计入，不追补伪造明细', async () => {
  const { db, api, reviewer, event } = layoutFixture()
  db.seed('weekly_records', 'old-review', { memberId: 'm2', memberName: '旧姓名', department: '运营部',
    week: '2026-第40周', workload: 1.5, sourceHandoffIds: ['layout1:review'] })
  await api.handleManageHandoffs(event, reviewer, '')
  assert.equal(db.rows.get('weekly_records/old-review').workload, 1.5)
  assert.equal(db.list('contribution_basis').filter(row => row.type_id === 'operations_layout_review').length, 0)
  assert.equal(db.list('weekly_records').filter(row => row.memberId === 'm2').length, 1)
})

test('兄弟部门并发报名保留各自材料引用，重复报名不新增，也不提前计量', async () => {
  const { db, api } = layoutFixture()
  db.seed('handoffs', 'layout1', { ...db.rows.get('handoffs/layout1'), status: 'assigned', deadline: '2026-12-31' })
  const event = { action: 'joinOperationsLayout', handoffId: 'layout1' }
  const first = { _id: 'brother1', name: '协作甲', department: '兄弟部门', role: 'member' }
  const second = { _id: 'brother2', name: '协作乙', department: '兄弟部门', role: 'member' }
  await Promise.all([api.handleManageHandoffs(event, first, ''), api.handleManageHandoffs(event, second, '')])
  assert.equal(db.rows.get('handoffs/layout1').joinList.length, 2)
  await assert.rejects(api.handleManageHandoffs(event, first, ''), /已报名/)
  assert.equal(db.list('contribution_basis').length, 0)
})
test('指定一审二审后部长一次归档，贡献各1小时，记录只记实际部长操作', async () => {
  const { db, api, reviewer, event } = layoutFixture()
  db.seed('members', 'm3', { name: '另一审核人', department: '运营部' })
  assigned(db, ['m2', 'm3'])
  await api.handleManageHandoffs({ ...event, reviewComment: undefined, reviewerUserId: 'forged' }, reviewer, '')
  assert.equal(db.list('contribution_measurement').filter(m => m.base_hours_u === 10000).length, 2)
  assert.equal(db.list('contribution_policy').find(p => p.reviewer_count).total_hours_u, 20000)
  const task = db.rows.get('handoffs/layout1')
  assert.equal(task.approval_records.length, 1)
  assert.equal(task.reviewerUserId, reviewer._id)
  assert.equal(task.reviewDecision, 'PASS')
  assert.equal(task.reviewComment, '审核通过')
  assert(Number.isFinite(new Date(task.reviewedTime).getTime()))
  assert.equal(task.approval_records[0].reviewer_id, 'm2')
  assert.equal(task.approval_records[0].reviewer_user_id, reviewer._id)
  assert.equal(db.list('contribution_basis').length, 3)
})
test('三个审核者平分在整数精度下总数严格2小时；同成员兼任两个岗位只计一次', async () => {
  for (const ids of [['m2', 'm2'], ['m2', 'm3', 'm4']]) {
    const { db, api, reviewer, event } = layoutFixture()
    for (const id of ['m3', 'm4']) db.seed('members', id, { name: id, department: '运营部' })
    assigned(db, ids)
    await api.handleManageHandoffs(event, reviewer, '')
    const bases = db.list('contribution_basis').filter(b => b.type_id === 'operations_layout_review')
    assert.equal(bases.length, new Set(ids).size)
    assert.equal(bases.reduce((sum, b) => sum + db.rows.get('contribution_measurement/' + b._id).base_hours_u, 0), 20000)
  }
})
test('审核分摊成员失效时所有写入回滚；退回和重新提交保留真实审核历史', async () => {
  const { db, api, reviewer, event } = layoutFixture()
  assigned(db, ['m2'])
  const task = db.rows.get('handoffs/layout1')
  db.seed('handoffs', 'layout1', { ...task, reviewAssignments: task.reviewAssignments.concat({ member_id: 'missing', department: '运营部' }) })
  await assert.rejects(api.handleManageHandoffs(event, reviewer, ''), /成员缺失/)
  assert.equal(db.list('weekly_records').length, 0)
  assigned(db, ['m2'])
  await api.handleManageHandoffs({ ...event, approved: false, returnToName: '排版干事' }, reviewer, '')
  await api.handleManageHandoffs({ action: 'completeHandoff', handoffId: 'layout1', syncResult: '已修改' }, reviewer, '')
  await api.handleManageHandoffs(event, reviewer, '')
  assert.deepEqual(Array.from(db.rows.get('handoffs/layout1').approval_records, r => r.decision), ['RETURN', 'PASS'])
})
test('审核权限与结论类型校验保持有效，普通成员不能审核', async () => {
  const { db, api, reviewer, event } = layoutFixture()
  assert.notEqual((await api.handleManageHandoffs(event, { ...reviewer, role: 'member' }, '')).code, 0)
  assert.notEqual((await api.handleManageHandoffs({ ...event, approved: 'false' }, reviewer, '')).code, 0)
  assert.equal(db.list('weekly_records').length, 0)
})
test('新排版必须布置时指定一审二审，旧排版仍可部长一次归档', async () => {
  const { db, api, reviewer, event } = layoutFixture({ legacy: true })
  const result = await api.handleManageHandoffs({ action: 'createOperationsLayout', title: '缺审核岗位', deadline: '2026-12-31', assigneeName: '排版干事' }, reviewer, '')
  assert.notEqual(result.code, 0)
  await api.handleManageHandoffs(event, reviewer, '')
  assert.equal(db.rows.get('handoffs/layout1').status, 'archived')
})
test('维护管理员处理无审核成员的旧任务，不虚构成员或审核工时，不阻断归档', async () => {
  const { db, api, event } = layoutFixture({ legacy: true })
  await api.handleManageHandoffs(event, { _id: 'maintenance', name: '维护管理员', role: 'admin', department: '' }, '')
  assert.equal(db.rows.get('handoffs/layout1').status, 'archived')
  assert.equal(db.list('contribution_basis').length, 1)
  assert(db.rows.get('handoffs/layout1').settledRecords.some(r => r.pending))
})
async function upload(db, api, user, name = '材料.pdf') {
  const ticket = (await api.handleManageFiles({ action: 'prepareBusinessDocument', name, size: 100 }, user, 'openid')).data
  const result = await api.handleManageFiles({ action: 'registerBusinessDocument', fileId: ticket._id, fileID: 'cloud://fixture.bucket/' + ticket.cloudPath }, user, 'openid')
  return result.data
}
test('业务附件从预登记到云上传确认，服务端保存上传人；禁止引用他人附件和本地路径', async () => {
  const { db, api, reviewer } = layoutFixture()
  const file = await upload(db, api, reviewer)
  const canonical = await documents.resolve(db, reviewer, [{ ...file, uploaded_by: 'forged', name: 'forged.docx' }])
  assert.equal(canonical[0].name, '材料.pdf')
  assert.equal(canonical[0].uploaded_by, reviewer._id)
  await assert.rejects(documents.resolve(db, { _id: 'other' }, [file]), /无权/)
  const preserved = await documents.resolve(db, { _id: 'other' }, [file], canonical)
  assert.equal(preserved.length, 1)
  await assert.rejects(documents.resolve(db, reviewer, [{ _id: 'tmp/local.pdf' }]), /已上传/)
  const publicFiles = (await api.handleManageFiles({ action: 'getFiles' }, reviewer, '')).data
  assert.equal(publicFiles.length, 0)
  assert.notEqual((await api.handleManageFiles({ action: 'deleteFile', fileId: file._id }, reviewer, 'openid')).code, 0)
})
test('附件格式、大小、未上传文件、伪造云路径和重复登记受约束', async () => {
  const { db, api, reviewer } = layoutFixture()
  for (const [name, size] of [['a.exe', 1], ['../a.pdf', 1], ['a.pdf', 0], ['a.pdf', 60 * 1024 * 1024]]) assert.throws(() => documents.validate(name, size))
  const ticket = (await api.handleManageFiles({ action: 'prepareBusinessDocument', name: 'a.pdf', size: 10 }, reviewer, '')).data
  await assert.rejects(documents.resolve(db, reviewer, [ticket]), /无权|不存在/)
  await assert.rejects(api.handleManageFiles({ action: 'registerBusinessDocument', fileId: ticket._id, fileID: 'cloud://bucket/not-authorized.pdf' }, reviewer, ''), /不匹配/)
  const unuploaded = { getTempFileURL: async () => ({ fileList: [{ status: 1 }] }) }
  await assert.rejects(documents.register(db, unuploaded, reviewer, { fileId: ticket._id, fileID: 'cloud://bucket/' + ticket.cloudPath }), /尚未上传/)
  const file = await upload(db, api, reviewer)
  await api.handleManageFiles({ action: 'registerBusinessDocument', fileId: file._id, fileID: file.fileID }, reviewer, '')
  await assert.rejects(api.handleManageFiles({ action: 'registerBusinessDocument', fileId: file._id, fileID: file.fileID.replace('fixture.bucket', 'other.bucket') }, reviewer, ''), /不能更换/)
})
test('仅附件成果可以提交，归档计量保留附件依据；上传数据不能伪造审核人', async () => {
  const { db, api, reviewer, event } = layoutFixture()
  const file = await upload(db, api, reviewer)
  db.seed('handoffs', 'layout1', { ...db.rows.get('handoffs/layout1'), status: 'assigned' })
  await api.handleManageHandoffs({ action: 'completeHandoff', handoffId: 'layout1', syncResult: '', resultAttachments: [file] }, reviewer, '')
  await api.handleManageHandoffs(event, reviewer, '')
  assert(db.list('contribution_basis').every(b => b.evidence_attachments[0]._id === file._id))
})
test('活动建议一键通过不创建虚构投票；另行建票并发只创建一次', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing, user = { _id: 'admin', role: 'admin', name: '管理员' }
  db.seed('suggestions', 's1', { title: '活动', status: 'pending' })
  await api.handleManageSuggestions({ action: 'approveSuggestion', suggestionId: 's1' }, user)
  assert.equal(db.list('votes').length, 0)
  assert.equal(db.rows.get('suggestions/s1').approval_records.length, 1)
  await assert.rejects(api.handleManageSuggestions({ action: 'approveSuggestion', suggestionId: 's1' }, user), /已经审核/)
  const event = { action: 'createSuggestionVote', suggestionId: 's1', voteOptions: ['实际选项A', '实际选项B'] }
  const results = await Promise.allSettled([api.handleManageSuggestions(event, user), api.handleManageSuggestions(event, user)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(db.list('votes').length, 1)
})
test('项目同时完成两个部门保留各自附件和历史，进入下一阶段；旧阶段提交不会误入新阶段', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  const users = ['采编部', '运营部'].map((department, index) => ({ _id: 'u' + index, name: '测试' + index, department, role: 'member' }))
  const files = await Promise.all(users.map(user => upload(db, api, user)))
  db.seed('project_tasks', 'p1', { status: 'active', currentPhaseIndex: 0, phases: [{ name: '一' }, { name: '二' }],
    deptTasks: users.map(u => ({ department: u.department, phaseIndex: 0, status: 'pending' })) })
  await Promise.all(users.map((user, index) => api.handleManageProjectTasks({ action: 'completeDeptTask', projectId: 'p1', department: user.department, phaseIndex: 0, resultAttachments: [files[index]] }, user, '')))
  const project = db.rows.get('project_tasks/p1')
  assert.equal(project.currentPhaseIndex, 1)
  assert.equal(project.phaseResults.length, 2)
  assert.equal(new Set(project.phaseResults.map(r => r.attachments[0]._id)).size, 2)
  await assert.rejects(api.handleManageProjectTasks({ action: 'completeDeptTask', projectId: 'p1', department: users[0].department, phaseIndex: 0 }, users[0], ''), /阶段已更新/)
})
