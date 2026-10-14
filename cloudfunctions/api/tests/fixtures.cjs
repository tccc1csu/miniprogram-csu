const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

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
      doc(id) { return {
        async get() { return { data: db.rows.get(name + '/' + id) || null } },
        async set({ data }) { db.seed(name, id, data); db.writes++; return {} },
        async update({ data }) { db.seed(name, id, { ...db.rows.get(name + '/' + id), ...data }); db.writes++; return {} }
      } }
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
  const cloud = { DYNAMIC_CURRENT_ENV: '', init() {}, database: () => db, getWXContext: () => ({ OPENID: 'fixture-openid' }),
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(fileID => ({ fileID, status: 0, tempFileURL: 'https://fixture.invalid/file' })) }) }
  const exports = {}
  const context = vm.createContext({ exports, console: { ...console, error() {} }, Date, Set, Promise,
    require: name => name === 'wx-server-sdk' ? cloud : name.startsWith('./') ? require(path.join(__dirname, '..', name)) : require(name) })
  vm.runInContext(source + '\nexports.testing = { handleGetStatistics, handleManageHandoffs, handleManageSuggestions, handleManageProjectTasks, handleManageFiles, handleAddRecord, findMember, getAll, findWeeklyRecord, upsertWorkflowWorkloadRecord, formatRecord, formatHandoff };', context)
  return exports
}

function layoutFixture({ layoutType = 'basic', urgent = false, legacy = false, sameMember = false } = {}) {
  const db = new MemoryDB(), api = loadAPI(db).testing
  const reviewer = { _id: 'u2', role: 'minister', name: '排版部长', department: '运营部' }
  db.seed('departments', 'ops', { name: '运营部' })
  for (const [key, hours, name] of [
    ['operations_basic_layout', 4, '基础排版'], ['operations_photo_layout', 2, '影像志排版'],
    ['operations_reprint_layout', 1, '内容转载排版'], ['operations_layout_review', 1.5, '排版审核']
  ]) db.seed('allowance_rules', key, { key, hours, name, recordType: 'rule', department: '运营部', workType: '日常办公', unit: '篇' })
  db.seed('members', 'm1', { name: sameMember ? reviewer.name : '排版干事', department: '运营部', userId: sameMember ? reviewer._id : 'u1' })
  if (!sameMember) db.seed('members', 'm2', { name: reviewer.name, department: '运营部', userId: reviewer._id })
  db.seed('handoffs', 'layout1', { title: '测试公众号文章', workflowType: 'operationsLayout', status: 'completed',
    sourceDepartment: '运营部', targetDepartment: '运营部',
    layoutType, urgent, assigneeName: sameMember ? reviewer.name : '排版干事', ...(legacy ? {} : { assigneeMemberId: 'm1' }) })
  const event = { action: 'reviewHandoff', handoffId: 'layout1', approved: true, reviewComment: '通过' }
  return { db, api, reviewer, event }
}

module.exports = { MemoryDB, input, loadAPI, layoutFixture }
