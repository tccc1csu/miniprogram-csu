// 现实业务场景回放：素材取自 2026-06/10 的真实工作群聊截图。
// 目的不是覆盖率，而是验证「真实的一单活」能不能在小程序里完整走完。
const test = require('node:test')
const assert = require('node:assert/strict')
const { MemoryDB, loadAPI } = require('./fixtures.cjs')

const DEPARTMENTS = [
  ['d-office', '办公部'], ['d-edit', '采编部'], ['d-design', '美编部'],
  ['d-prod', '摄制部'], ['d-ops', '运营部'], ['d-brother', '兄弟部门']
]

const MEMBERS = [
  ['m-edit-ge', '葛雨桐程', '采编部', 'member', 'u-edit-ge'],
  ['m-edit-min', '采编部长', '采编部', 'minister', 'u-edit-min'],
  ['m-office-xue', '薛宇翔', '办公部', 'member', 'u-office-xue'],
  ['m-office-min', '办公部长', '办公部', 'minister', 'u-office-min'],
  ['m-office-zhao', '赵六', '办公部', 'member', 'u-office-zhao'],
  ['m-prod-gan', '摄制干事', '摄制部', 'member', 'u-prod-gan'],
  ['m-prod-min', '摄制部长', '摄制部', 'minister', 'u-prod-min'],
  ['m-ops-su', '苏绮雯', '运营部', 'member', 'u-ops-su'],
  ['m-ops-min', '运营部长', '运营部', 'minister', 'u-ops-min'],
  ['m-ops-min2', '运营副部长', '运营部', 'minister', 'u-ops-min2'],
  ['m-brother-liang', '梁肖瑶', '兄弟部门', 'member', 'u-brother-liang']
]

const USERS = {
  editGe: { _id: 'u-edit-ge', name: '葛雨桐程', department: '采编部', role: 'member' },
  officeXue: { _id: 'u-office-xue', name: '薛宇翔', department: '办公部', role: 'member' },
  officeMin: { _id: 'u-office-min', name: '办公部长', department: '办公部', role: 'minister' },
  officeZhao: { _id: 'u-office-zhao', name: '赵六', department: '办公部', role: 'member' },
  prodGan: { _id: 'u-prod-gan', name: '摄制干事', department: '摄制部', role: 'member' },
  prodMin: { _id: 'u-prod-min', name: '摄制部长', department: '摄制部', role: 'minister' },
  opsSu: { _id: 'u-ops-su', name: '苏绮雯', department: '运营部', role: 'member' },
  opsMin: { _id: 'u-ops-min', name: '运营部长', department: '运营部', role: 'minister' },
  opsMin2: { _id: 'u-ops-min2', name: '运营副部长', department: '运营部', role: 'minister' },
  brotherLiang: { _id: 'u-brother-liang', name: '梁肖瑶', department: '兄弟部门', role: 'member' }
}

function scenarioDB() {
  const db = new MemoryDB()
  const api = loadAPI(db).testing
  for (const [id, name] of DEPARTMENTS) db.seed('departments', id, { name })
  for (const [id, name, department, role, userId] of MEMBERS) {
    db.seed('members', id, { name, department, role, userId, openid: 'openid-' + userId })
  }
  return { db, api }
}

function tomorrowAt(hour) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour)}:00`
}

function workloadsOf(db, department) {
  return db.list('weekly_records')
    .filter(row => !department || row.department === department)
    .map(row => ({ name: row.memberName, department: row.department, workload: row.workload }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─────────────────────────────────────────────────────────────
// 场景 1｜图 1：采编办公对接群
// 「采编部这边已经完成：求职经验分享和民族文化交融新闻稿，这两篇辛苦帮忙同步一下
//  院网，升华网、学工网都投稿」「已投」+ 两条 bs.csu.edu.cn 链接
// ─────────────────────────────────────────────────────────────
test('场景1 采编办公协同：两篇稿件同步三网后归档计工时', async () => {
  const { db, api } = scenarioDB()

  const created = await api.handleManageHandoffs({
    action: 'createHandoff',
    title: '求职经验分享与民族文化交融新闻稿对接',
    articleNames: '求职经验分享会：求职路上的“她力量”\n商学院举行“民族焕彩石榴红，文化交融一家亲”民族文化交流活动',
    targetSites: '院网、升华网、学工网',
    articleType: 'original',
    reviewerNames: '办公部长',
    note: '两篇均已修改完成，辛苦同步三网并投稿',
    deadline: '2026-06-12'
  }, USERS.editGe, 'openid-u-edit-ge')
  assert.equal(created.code, 0, `发起失败：${created.message || JSON.stringify(created)}`)
  const id = created.data._id

  let handoff = db.rows.get('handoffs/' + id)
  assert.equal(handoff.status, 'submitted')
  assert.equal(handoff.articleNames.split('\n').length, 2, '应识别为两篇稿件')
  assert.equal(handoff.targetSites, '院网、升华网、学工网')

  const assigned = await api.handleManageHandoffs({
    action: 'assignHandoff', handoffId: id, assigneeName: '薛宇翔'
  }, USERS.officeMin, 'openid-u-office-min')
  assert.equal(assigned.code, 0, `派发失败：${assigned.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'assigned')

  const completed = await api.handleManageHandoffs({
    action: 'completeHandoff', handoffId: id,
    syncResult: '已投稿三网：\nhttps://bs.csu.edu.cn/info/1046/26838.htm\nhttps://bs.csu.edu.cn/info/1046/26837.htm'
  }, USERS.officeXue, 'openid-u-office-xue')
  assert.equal(completed.code, 0, `提交失败：${completed.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'completed')

  const reviewed = await api.handleManageHandoffs({
    action: 'reviewHandoff', handoffId: id, approved: true, reviewComment: '三网已发布，归档'
  }, USERS.officeMin, 'openid-u-office-min')
  assert.equal(reviewed.code, 0, `审核失败：${reviewed.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'archived')

  const rows = workloadsOf(db)
  assert.equal(rows.find(r => r.name === '葛雨桐程').workload, 10, '两篇原创稿应计 10 小时')
  assert.equal(rows.find(r => r.name === '薛宇翔').workload, 4, '办公对接按学期计 4 小时')
  assert.equal(rows.find(r => r.name === '办公部长').workload, 2, '审核合计 2 小时')
})

// ─────────────────────────────────────────────────────────────
// 场景 2｜图 2：迎新军训宣传联络群
// 「明天下午三点合唱比赛 青传需要过来拍摄一下吗」「预赛」
// ─────────────────────────────────────────────────────────────
test('场景2 摄制预约：次日任务自动加急并完成归档', async () => {
  const { db, api } = scenarioDB()
  const scheduledAt = tomorrowAt(15)

  const created = await api.handleManageHandoffs({
    action: 'createProductionReservation',
    taskName: '迎新军训合唱比赛（预赛）拍摄',
    scheduledAt,
    location: '合唱比赛现场',
    submitterContact: '迎新军训宣传联络群',
    note: '青传提出拍摄需求'
  }, USERS.brotherLiang, 'openid-u-brother-liang')
  assert.equal(created.code, 0, `预约失败：${created.message}`)
  const id = created.data._id

  const handoff = db.rows.get('handoffs/' + id)
  assert.equal(handoff.isUrgent, true, '次日任务应标记加急')
  assert.equal(handoff.urgentMultiplier, 1.5)
  assert.equal(handoff.status, 'submitted')

  const assigned = await api.handleManageHandoffs({
    action: 'assignHandoff', handoffId: id, assigneeName: '摄制干事'
  }, USERS.prodMin, 'openid-u-prod-min')
  assert.equal(assigned.code, 0, `派发失败：${assigned.message}`)

  const completed = await api.handleManageHandoffs({
    action: 'completeHandoff', handoffId: id,
    syncResult: '预赛现场已拍摄，素材已上传云盘',
    archiveMemberName: '赵六'
  }, USERS.prodGan, 'openid-u-prod-gan')
  assert.equal(completed.code, 0, `提交失败：${completed.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'archive_assigned')

  const archived = await api.handleManageHandoffs({
    action: 'archiveProductionTask', handoffId: id, archiveNote: '素材齐全，归档'
  }, USERS.officeZhao, 'openid-u-office-zhao')
  assert.equal(archived.code, 0, `归档失败：${archived.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'archived')

  const rows = workloadsOf(db)
  assert.equal(rows.find(r => r.name === '摄制干事').workload, 6, '加急 4h × 1.5 = 6 小时')
  assert.equal(rows.find(r => r.name === '赵六').workload, 2, '归档审核 2 小时')
})

// ─────────────────────────────────────────────────────────────
// 场景 3｜图 3：青传对接预约群
// 「【活动名称】商学院2026年学生代表大会暨研究生代表大会 / 【需要对接的部门】运营部 /
//  【任务ddl】10月18日 / 发出前将临时链接发给我，对接席添添老师审核」+ 学代会推文.zip
// ─────────────────────────────────────────────────────────────
test('场景3a 外部需求：团委办公室向运营部提需求并归档', async () => {
  const { db, api } = scenarioDB()

  const created = await api.handleManageHandoffs({
    action: 'createExternalRequest',
    title: '商学院2026年学生代表大会暨研究生代表大会推文',
    targetDepartment: '运营部',
    deadline: '2026-10-18',
    note: '活动昨天举办，推文本周发出；发出前需将临时链接发给席添添老师审核',
    attachments: [{ fileID: 'cloud://fixture/学代会推文.zip', name: '学代会推文.zip', size: 109471334 }]
  }, USERS.brotherLiang, 'openid-u-brother-liang')
  assert.equal(created.code, 0, `发布失败：${created.message}`)
  const id = created.data._id

  const handoff = db.rows.get('handoffs/' + id)
  assert.equal(handoff.status, 'submitted')
  assert.equal(handoff.targetDepartment, '运营部')
  assert.equal(handoff.attachments.length, 1, '应保留 104.4MB 附件记录')

  const assigned = await api.handleManageHandoffs({
    action: 'assignHandoff', handoffId: id, assigneeName: '苏绮雯'
  }, USERS.opsMin, 'openid-u-ops-min')
  assert.equal(assigned.code, 0, `派发失败：${assigned.message}`)

  const completed = await api.handleManageHandoffs({
    action: 'completeHandoff', handoffId: id,
    syncResult: '推文已排版，临时链接：https://mp.weixin.qq.com/s/fixture'
  }, USERS.opsSu, 'openid-u-ops-su')
  assert.equal(completed.code, 0, `提交失败：${completed.message}`)

  const reviewed = await api.handleManageHandoffs({
    action: 'reviewHandoff', handoffId: id, approved: true, reviewComment: '老师已确认'
  }, USERS.opsMin, 'openid-u-ops-min')
  assert.equal(reviewed.code, 0, `归档失败：${reviewed.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'archived')

  // 外部需求计费（规则来自搭档提交 d8c48d4）：承接干事按运营部基础排版 4h，审核部长固定 2h，
  // 外部发起人梁肖瑶不计创作者稿费。
  const rows = workloadsOf(db)
  assert.equal(rows.find(r => r.name === '苏绮雯').workload, 4, '承接干事按基础排版计 4 小时')
  assert.equal(rows.find(r => r.name === '运营部长').workload, 2, '审核部长固定计 2 小时')
  assert.equal(rows.find(r => r.name === '梁肖瑶'), undefined, '外部发起人不计创作者稿费')
})

test('场景3b 排版需求：兄弟部门发布 → 接单派发 → 一审 → 二审 → 归档', async () => {
  const { db, api } = scenarioDB()

  const created = await api.handleManageHandoffs({
    action: 'createOperationsLayout',
    title: '学代会推文',
    layoutType: 'basic',
    deadline: '2026-10-18',
    note: '团委办公室需求，需对接席添添老师审核'
  }, USERS.brotherLiang, 'openid-u-brother-liang')
  assert.equal(created.code, 0, `发布需求失败：${created.message}`)
  const id = created.data._id
  assert.equal(db.rows.get('handoffs/' + id).status, 'submitted', '兄弟部门发布后应待运营部接单')

  const assigned = await api.handleManageHandoffs({
    action: 'assignOperationsLayout', handoffId: id,
    assigneeName: '苏绮雯', firstReviewerName: '运营部长', secondReviewerName: '运营副部长'
  }, USERS.opsMin, 'openid-u-ops-min')
  assert.equal(assigned.code, 0, `接单失败：${assigned.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'assigned')

  const completed = await api.handleManageHandoffs({
    action: 'completeHandoff', handoffId: id,
    syncResult: '排版完成，成品链接：https://mp.weixin.qq.com/s/fixture'
  }, USERS.opsSu, 'openid-u-ops-su')
  assert.equal(completed.code, 0, `提交失败：${completed.message}`)

  const first = await api.handleManageHandoffs({
    action: 'reviewHandoff', handoffId: id, approved: true, reviewComment: '一审通过'
  }, USERS.opsMin, 'openid-u-ops-min')
  assert.equal(first.code, 0, `一审失败：${first.message}`)
  assert.equal(first.data.firstReviewed, true)
  assert.equal(db.rows.get('handoffs/' + id).status, 'firstReviewed')

  const second = await api.handleManageHandoffs({
    action: 'reviewHandoff', handoffId: id, approved: true, reviewComment: '二审通过'
  }, USERS.opsMin2, 'openid-u-ops-min2')
  assert.equal(second.code, 0, `二审失败：${second.message}`)
  assert.equal(db.rows.get('handoffs/' + id).status, 'archived')

  const rows = workloadsOf(db)
  assert.equal(rows.find(r => r.name === '苏绮雯').workload, 4, '基础排版 4 小时')
  assert.equal(rows.find(r => r.name === '运营部长').workload, 1, '审核 2 小时两人平分')
  assert.equal(rows.find(r => r.name === '运营副部长').workload, 1)
})

// ─────────────────────────────────────────────────────────────
// 场景 4｜图 4：运营部 17–23 号推文排期
// ─────────────────────────────────────────────────────────────
test('场景4 排版排班：一周七条推文可建可查', async () => {
  const { db, api } = scenarioDB()
  const schedule = [
    ['心晴周刊', '2026-10-17'], ['商学院学生会团委办公室部帮推文案', '2026-10-18'],
    ['影像志（热火朝天建设忙）', '2026-10-19'], ['班导慰问', '2026-10-20'],
    ['排长采访', '2026-10-21'], ['请假推文', '2026-10-22'], ['岳麓山下的星光与热望', '2026-10-23']
  ]

  for (const [title, deadline] of schedule) {
    const res = await api.handleManageHandoffs({
      action: 'createOperationsLayout', title, layoutType: 'basic', deadline,
      assigneeName: '苏绮雯', firstReviewerName: '运营部长', secondReviewerName: '运营副部长'
    }, USERS.opsMin, 'openid-u-ops-min')
    assert.equal(res.code, 0, `创建「${title}」失败：${res.message}`)
  }

  const list = await api.handleManageHandoffs({
    action: 'getHandoffs', scope: 'active', workflowType: 'operationsLayout'
  }, USERS.opsMin, 'openid-u-ops-min')
  assert.equal(list.code, 0)
  assert.equal(list.data.length, 7, '七条排期都应出现在列表中')
  assert.equal(
    list.data.map(item => item.deadline).sort().join('|'),
    schedule.map(([, d]) => d).sort().join('|'),
    '七条截止日期应与排期一致'
  )
  assert(list.data.every(item => item.status === 'assigned'))
})

// ─────────────────────────────────────────────────────────────
// 边界：真实工作里高频出现、但容易被忽略的情况
// ─────────────────────────────────────────────────────────────
test('边界1 采编对接改为按单计费：第二单继续累加', async () => {
  const { db, api } = scenarioDB()

  async function runOne(title, deadline) {
    const created = await api.handleManageHandoffs({
      action: 'createHandoff', title, articleNames: title + '稿件', targetSites: '院网、升华网、学工网',
      articleType: 'original', reviewerNames: '办公部长'
    }, USERS.editGe, 'openid-u-edit-ge')
    const id = created.data._id
    await api.handleManageHandoffs({ action: 'assignHandoff', handoffId: id, assigneeName: '薛宇翔' }, USERS.officeMin, 'openid-u-office-min')
    await api.handleManageHandoffs({ action: 'completeHandoff', handoffId: id, syncResult: '已投' }, USERS.officeXue, 'openid-u-office-xue')
    return api.handleManageHandoffs({ action: 'reviewHandoff', handoffId: id, approved: true }, USERS.officeMin, 'openid-u-office-min')
  }

  await runOne('第一次对接', '2026-06-12')
  const firstRound = workloadsOf(db).find(r => r.name === '薛宇翔').workload
  assert.equal(firstRound, 4, '首单办公对接计 4 小时')

  await runOne('第二次对接', '2026-06-20')
  const secondRound = workloadsOf(db).find(r => r.name === '薛宇翔').workload
  assert.equal(secondRound, 8, '按单计费后第二单继续累加，同一周内合计 8 小时')
  // 规则变更（2026-10 搭档提交 d8c48d4）：对接干事由「每学期一次」改为「每单一次」，
  // 避免做 1 单和做 10 单拿同样工时。
})

test('边界2 外部需求附件超过 9 个时只保留前 9 个', async () => {
  const { db, api } = scenarioDB()
  const attachments = Array.from({ length: 12 }, (_, i) => ({
    fileID: `cloud://fixture/file-${i}.zip`, name: `素材-${i}.zip`, size: 1024
  }))
  const created = await api.handleManageHandoffs({
    action: 'createExternalRequest', title: '多附件需求', targetDepartment: '美编部',
    deadline: '2026-10-20', attachments
  }, USERS.brotherLiang, 'openid-u-brother-liang')
  assert.equal(created.code, 0)
  const handoff = db.rows.get('handoffs/' + created.data._id)
  assert.equal(handoff.attachments.length, 9, '超出部分应被截断，避免文档过大')
})

test('边界3 摄制预约时间早于当前时间应被拒绝', async () => {
  const { api } = scenarioDB()
  const res = await api.handleManageHandoffs({
    action: 'createProductionReservation',
    taskName: '昨天的活动补拍', scheduledAt: '2020-01-01 09:00',
    location: '教学楼', submitterContact: '测试'
  }, USERS.brotherLiang, 'openid-u-brother-liang')
  assert.notEqual(res.code, 0)
  assert.match(res.message || '', /晚于当前时间/)
})
