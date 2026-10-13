const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ledger = require('../workload-ledger')
const audit = require('../schema-audit')

// 乐观并发模拟：事务读版本被修改则重试；写故障时全部丢弃。
// 这是本地行为测试，不能代替 CloudBase 实际事务／权限／索引验证。
class MemoryDB {
  constructor() { this.rows = new Map(); this.versions = new Map(); this.writes = 0; this.failCollection = ''; this.created = 0 }
  seed(collection, id, row) {
    const k = collection + '/' + id
    this.rows.set(k, { ...row, _id: id }); this.versions.set(k, (this.versions.get(k) || 0) + 1)
  }
  list(collection) { return Array.from(this.rows.entries()).filter(([k]) => k.startsWith(collection + '/')).map(([, v]) => v) }
  async createCollection() { this.created++ }
  collection(name) {
    const db = this
    const makeQuery = (filter = {}, offset = 0, limit = Infinity) => ({
      where(where) { return makeQuery(where, offset, limit) },
      orderBy() { return this }, skip(n) { return makeQuery(filter, n, limit) }, limit(n) { return makeQuery(filter, offset, n) },
      async get() { return { data: db.list(name).filter(r => Object.keys(filter).every(k => r[k] === filter[k])).slice(offset, offset + limit) } },
      async count() { return { total: (await this.get()).data.length } },
      async add({ data }) { const id = 'new-' + db.rows.size; db.seed(name, id, data); db.writes++; return { _id: id } },
      doc(id) { return { async get() { return { data: db.rows.get(name + '/' + id) || null } } } }
    })
    return makeQuery()
  }
  async runTransaction(callback) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const reads = new Map(), writes = new Map()
      const transaction = { collection: name => ({ doc: id => {
        const k = name + '/' + id
        return {
          get: async () => { reads.set(k, this.versions.get(k) || 0); return { data: (writes.has(k) ? writes.get(k) : this.rows.get(k)) || null } },
          set: async ({ data }) => { if (name === this.failCollection) throw new Error('injected write failure'); writes.set(k, { ...data, _id: id }) },
          update: async ({ data }) => { if (name === this.failCollection) throw new Error('injected write failure'); writes.set(k, { ...(writes.has(k) ? writes.get(k) : this.rows.get(k)), ...data, _id: id }) },
          remove: async () => { writes.set(k, null) }
        }
      } }) }
      const result = await callback(transaction)
      if (Array.from(reads).some(([k, version]) => (this.versions.get(k) || 0) !== version)) continue
      for (const [k, row] of writes) {
        if (row) this.rows.set(k, row); else this.rows.delete(k)
        this.versions.set(k, (this.versions.get(k) || 0) + 1); this.writes++
      }
      return result
    }
    throw new Error('transaction conflict')
  }
}

function input(extra = {}) {
  return { member: { _id: 'm1', name: '测试成员', department: '摄制部' },
    department: '摄制部', departmentId: 'd1', week: '2026-第42周',
    sourceId: 'h1', handoffId: 'h1', legacySourceId: 'h1', typeId: 'production_video_member',
    baseHours: 4, factor: 1.5, hourlyRate: 12, content: '摄制任务', workType: '视频制作',
    now: new Date('2026-10-13T04:00:00Z'), rule: { key: 'production_video_member', name: '摄制任务完成', hours: 4, unit: '次' }, ...extra }
}

function loadAPI(db) {
  const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8')
  const cloud = { DYNAMIC_CURRENT_ENV: '', init() {}, database: () => db, getWXContext: () => ({ OPENID: 'fixture-openid' }) }
  const exports = {}
  const context = vm.createContext({ exports, console: { ...console, error() {} }, Date, Set, Promise,
    require: name => name === 'wx-server-sdk' ? cloud : name.startsWith('./') ? require(path.join(__dirname, '..', name)) : require(name) })
  vm.runInContext(source + '\nexports.testing = { handleGetStatistics, handleManageHandoffs, handleAddRecord, findMember, getAll, findWeeklyRecord, upsertWorkflowWorkloadRecord, formatRecord };', context)
  return exports
}

test('同一任务并发归档只计一次，倍率只应用一次', async () => {
  const db = new MemoryDB()
  const results = await Promise.all([ledger.settle(db, input()), ledger.settle(db, input())])
  assert.equal(results.filter(r => !r.skipped).length, 1)
  assert.equal(db.list('weekly_records')[0].workload, 6)
  assert.equal(db.list('contribution_basis').length, 1)
  assert.equal(db.list('contribution_measurement')[0].base_hours_u, 40000)
  assert.equal(db.list('contribution_policy')[0].factor_u, 15000)
})

test('两项不同任务并发更新同一周汇总不丢工时', async () => {
  const db = new MemoryDB()
  await Promise.all([ledger.settle(db, input()), ledger.settle(db, input({ sourceId: 'h2', handoffId: 'h2', legacySourceId: 'h2' }))])
  assert.equal(db.list('weekly_records').length, 1)
  assert.equal(db.list('weekly_records')[0].workload, 12)
  assert.equal(db.list('contribution_basis').length, 2)
})

test('计量写入故障回滚依据、规则及汇总', async () => {
  const db = new MemoryDB(); db.failCollection = 'contribution_measurement'
  await assert.rejects(ledger.settle(db, input()), /injected/)
  assert.equal(db.writes, 0)
  assert.equal(db.rows.size, 0)
})

test('新规则创建快照，旧规则不被覆盖；改名不重复计量', async () => {
  const db = new MemoryDB()
  await ledger.settle(db, input())
  await ledger.settle(db, input({ sourceId: 'h2', legacySourceId: 'h2', hourlyRate: 15 }))
  const retry = await ledger.settle(db, input({ member: { _id: 'm1', name: '改名后', department: '摄制部' } }))
  assert.equal(retry.skipped, true)
  assert.deepEqual(db.list('allowance_standard').map(s => s.hourly_rate_cents).sort(), [1200, 1500])
  assert.equal(db.list('weekly_records')[0].workload, 12)
})

test('跨周重试同一贡献仍不新增计量', async () => {
  const db = new MemoryDB()
  await ledger.settle(db, input())
  const result = await ledger.settle(db, input({ week: '2026-第43周' }))
  assert.equal(result.skipped, true)
  assert.equal(db.list('weekly_records').length, 1)
})

test('摄制归档第二位贡献失败时整笔归档回滚，重试可以完整完成', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  db.seed('departments', 'd1', { name: '摄制部' })
  db.seed('departments', 'd2', { name: '办公部' })
  db.seed('members', 'm1', { name: '摄制成员', department: '摄制部' })
  db.seed('members', 'm2', { name: '办公成员', department: '办公部' })
  db.seed('handoffs', 'h1', { workflowType: 'productionReservation', status: 'archive_assigned',
    assigneeMemberId: 'm1', assigneeName: '摄制成员', archiveMemberId: 'missing', archiveMemberName: '办公成员', urgentMultiplier: 1.5 })
  await assert.rejects(api.handleManageHandoffs({ action: 'archiveProductionTask', handoffId: 'h1' }, { role: 'admin', name: '测试审核' }, ''), /成员缺失/)
  assert.equal(db.rows.get('handoffs/h1').status, 'archive_assigned')
  assert.equal(db.list('contribution_basis').length, 0)
  assert.equal(db.list('weekly_records').length, 0)
  // 下一次正常重试只替换错误的成员引用。
  const handoff = db.rows.get('handoffs/h1')
  db.seed('handoffs', 'h1', { ...handoff, archiveMemberId: 'm2' })
  const result = await api.handleManageHandoffs({ action: 'archiveProductionTask', handoffId: 'h1' }, { role: 'admin', name: '测试审核' }, '')
  assert.equal(result.code, 0)
  assert.equal(db.rows.get('handoffs/h1').status, 'archived')
  assert.equal(db.list('contribution_basis').length, 2)
  assert.deepEqual(db.list('weekly_records').map(r => r.workload).sort(), [3, 6])
})

test('旧周记录兼容：保留原 ID、旧内容、手工总量和来源', async () => {
  const db = new MemoryDB()
  db.seed('weekly_records', 'legacy', { memberId: 'm1', department: '摄制部', memberName: '测试成员', week: '2026-第42周', workload: 10,
    workContent: '历史工作', sourceHandoffIds: ['old'] })
  await ledger.settle(db, input({ existingRecordId: 'legacy' }))
  assert.equal(db.list('weekly_records')[0].workload, 16)
  assert.equal(db.list('weekly_records')[0].workContent, '历史工作\n摄制任务')
  const before = db.writes
  const skipped = await ledger.settle(db, input({ existingRecordId: 'legacy', sourceId: 'old', legacySourceId: 'old' }))
  assert.equal(skipped.legacy, true)
  assert.equal(db.writes, before)
})

test('不同贡献类型属于独立明细，零工时依据保持待核对', async () => {
  const db = new MemoryDB()
  await ledger.settle(db, input())
  await ledger.settle(db, input({ typeId: 'review', legacySourceId: 'h1:review', baseHours: 0 }))
  assert.equal(db.list('contribution_basis').length, 2)
  assert.equal(db.list('contribution_measurement').length, 1)
  assert.equal(db.list('weekly_records')[0].workload, 6)
})

test('不匹配成员部门及非法计量失败，不写入', async () => {
  for (const extra of [{ department: '办公部' }, { baseHours: -1 }, { baseHours: NaN }, { factor: 0 }, { hourlyRate: -12 }]) {
    const db = new MemoryDB()
    await assert.rejects(ledger.settle(db, input(extra)))
    assert.equal(db.writes, 0)
  }
})

test('办公部长生成全中心周报；其它部长和成员不能越权', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  db.seed('weekly_records', 'a', { department: '办公部', memberName: '甲', workload: 2 })
  db.seed('weekly_records', 'b', { department: '摄制部', memberName: '乙', workload: 4 })
  const report = await api.handleGetStatistics({ type: 'weeklyTable', scope: 'center' }, { role: 'minister', department: '办公部' }, '')
  assert.equal(report.code, 0); assert.equal(report.data.groups.length, 2)
  for (const role of ['minister', 'member']) {
    const blocked = await api.handleGetStatistics({ type: 'weeklyTable', scope: 'center' }, { role, department: '采编部' }, '')
    assert.notEqual(blocked.code, 0)
  }
  const own = await api.handleGetStatistics({ type: 'weeklyTable' }, { role: 'minister', department: '摄制部' }, '')
  assert.equal(own.data.groups.length, 1); assert.equal(own.data.groups[0].department, '摄制部')
})

test('统计查询超过 1000 条不截断，带 limit 的查询仍遵守 limit', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  for (let i = 0; i < 1005; i++) db.seed('weekly_records', String(i), { department: '办公部' })
  assert.equal((await api.getAll('weekly_records', {})).length, 1005)
  assert.equal((await api.getAll('weekly_records', {}, { skip: 1000, limit: 3 })).length, 3)
})

test('成员 ID 不能与其它部门或姓名拼接；同名关联不猜选', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  db.seed('members', 'm1', { name: '甲', department: '摄制部' })
  assert.equal(await api.findMember('m1', '甲', '办公部'), null)
  assert.equal(await api.findMember('missing', '甲', '摄制部'), null)
  db.seed('members', 'm2', { name: '甲', department: '摄制部' })
  assert.equal(await api.findMember('', '甲', '摄制部'), null)
})

test('手工周上报与自动归档使用同一汇总身份，非法工时拒绝', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  db.seed('members', 'm1', { name: '测试成员', department: '摄制部' })
  const user = { role: 'minister', name: '测试部长', department: '摄制部' }
  const event = { memberId: 'm1', memberName: '测试成员', week: '2026-第42周', workload: 2, workContent: '日常工作' }
  const result = await api.handleAddRecord(event, user, '')
  assert.equal(result.code, 0)
  await ledger.settle(db, input({ existingRecordId: result.data._id }))
  assert.equal(db.list('weekly_records').length, 1)
  assert.equal(db.list('weekly_records')[0].workload, 8)
  for (const workload of [-1, 'abc', Infinity]) {
    const invalid = await api.handleAddRecord({ ...event, workload }, user, '')
    assert.notEqual(invalid.code, 0)
  }
  const deletion = await api.handleAddRecord({ action: 'deleteRecord', recordId: result.data._id }, user, '')
  assert.notEqual(deletion.code, 0)
  assert.equal(db.list('weekly_records').length, 1)
})

test('旧周汇总重复必须核对，不自动选择第一条覆盖', async () => {
  const db = new MemoryDB(), api = loadAPI(db).testing
  db.seed('weekly_records', 'a', { memberId: 'm1', memberName: '测试成员', department: '摄制部', week: 'x' })
  db.seed('weekly_records', 'b', { memberId: 'm1', memberName: '测试成员', department: '摄制部', week: 'x' })
  await assert.rejects(api.findWeeklyRecord({ _id: 'm1' }, '测试成员', '摄制部', 'x'), /重复汇总/)
  db.seed('weekly_records', 'b', { memberName: '测试成员', department: '摄制部', week: 'x' })
  await assert.rejects(api.findWeeklyRecord({ _id: 'm1' }, '测试成员', '摄制部', 'x'), /重复汇总/)
})

test('审计路由只读，不建集合、不注入默认数据，拒绝非管理员', async () => {
  const db = new MemoryDB(), api = loadAPI(db)
  db.seed('users', 'u1', { role: 'admin', token: 'fixture-token', openid: 'fixture-openid', tokenExpireAt: new Date(Date.now() + 60000) })
  const response = await api.main({ functionName: 'auditSchema', collection: 'users', token: 'fixture-token' })
  assert.equal(response.code, 0)
  assert.equal(response.data.inspected, 1)
  assert.equal(response.data.indexStatus, 'not-inspected')
  assert.equal(JSON.stringify(response).includes('fixture-token'), false)
  assert.equal(db.created, 0); assert.equal(db.writes, 0)
  db.seed('users', 'u1', { role: 'member', token: 'fixture-token', openid: 'fixture-openid', tokenExpireAt: new Date(Date.now() + 60000) })
  const blocked = await api.main({ functionName: 'auditSchema', collection: 'users', token: 'fixture-token' })
  assert.notEqual(blocked.code, 0); assert.equal(db.created, 0)
})

test('导出审计报告只含数量和字段类型，识别重复及悬空引用', () => {
  const report = audit.analyze({ members: [{ _id: 'm', name: '私密姓名', department: '办公部' }],
    weekly_records: [{ _id: 'r1', memberId: 'missing', department: '办公部', week: 'x', workload: 1 },
      { _id: 'r2', memberId: 'missing', department: '办公部', week: 'x', workload: -1 }] })
  assert.equal(report.issues.duplicate_weekly_summaries, 1)
  assert.equal(report.issues.weekly_dangling_member_id, 2)
  assert.equal(report.issues.invalid_workload, 1)
  assert.equal(JSON.stringify(report).includes('私密姓名'), false)
})
