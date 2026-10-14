// node docs/tools/replay_cloud_exports.cjs <私有备份目录> [聚合报告路径]
// 只读导出，在隔离内存数据库内运行；不调用 CloudBase，不保存个人记录。
const fs = require('node:fs')
const path = require('node:path')
const { MemoryDB, loadAPI } = require('../../cloudfunctions/api/tests/fixtures.cjs')
async function main() {
  const folder = process.argv[2], db = new MemoryDB()
  if (!folder || !fs.statSync(folder).isDirectory()) throw new Error('请提供私有数据库导出目录')
  for (const file of fs.readdirSync(folder)) {
    if (!/^[a-z][a-z0-9_]*\.(json|jsonl)$/.test(file)) continue
    const source = fs.readFileSync(path.join(folder, file), 'utf8').replace(/^\uFEFF/, '')
    const value = file.endsWith('.jsonl') ? source.split(/\r?\n/).filter(line => line.trim()).map(JSON.parse) : JSON.parse(source)
    const rows = Array.isArray(value) ? value : value.data
    if (!Array.isArray(rows) || rows.some(row => !row || !row._id)) throw new Error('导出缺少有效文档 ID')
    for (const row of rows) db.seed(file.replace(/\.(json|jsonl)$/, ''), row._id, row)
  }
  const api = loadAPI(db).testing
  const admin = db.list('users').find(user => user.role === 'admin')
  if (!admin) throw new Error('导出缺少管理员账号，不能重放授权操作')
  const report = { scope: 'isolated-memory-only', liveCloudAccess: false, taskCounts: {}, eligible: 0, passed: 0,
    failed: 0, failureCategories: {}, archivedRetryChecks: 0, archivedRetryWrites: 0 }
  for (const task of db.list('handoffs')) {
    const workflow = task.workflowType || 'editorialOfficeHandoff'
    const countKey = workflow + ':' + task.status
    report.taskCounts[countKey] = (report.taskCounts[countKey] || 0) + 1
    const production = workflow === 'productionReservation'
    const event = { action: production ? 'archiveProductionTask' : 'reviewHandoff', handoffId: task._id, approved: true }
    if (task.status === 'archived') {
      const before = db.writes
      const result = await api.handleManageHandoffs(event, admin, admin.openid || '')
      if (result.code === 0) throw new Error('已归档任务被重复通过')
      report.archivedRetryChecks++
      report.archivedRetryWrites += db.writes - before
      continue
    }
    if (!['editorialOfficeHandoff', 'operationsLayout', 'productionReservation'].includes(workflow) ||
        task.status !== (production ? 'archive_assigned' : 'completed')) continue
    report.eligible++
    try {
      const result = await api.handleManageHandoffs(event, admin, admin.openid || '')
      if (result.code !== 0) throw new Error(result.message || '业务操作未通过')
      report.passed++
    } catch (error) {
      report.failed++
      // 仅固定分类；原始异常可能含姓名或其他导出值，禁止写入报告。
      const category = /成员/.test(error.message) ? 'member-reference'
        : /部门/.test(error.message) ? 'department-reference'
        : /周记录/.test(error.message) ? 'weekly-summary'
        : /状态/.test(error.message) ? 'task-state' : 'other-business-error'
      report.failureCategories[category] = (report.failureCategories[category] || 0) + 1
    }
  }
  const output = JSON.stringify(report, null, 2) + '\n'
  if (process.argv[3]) fs.writeFileSync(process.argv[3], output)
  process.stdout.write(output)
  if (report.failed || report.archivedRetryWrites) process.exitCode = 1
}
main().catch(() => { process.stderr.write('重放未完成，请核对导出格式和管理员账号（为保护隐私不输出原始记录）。\n'); process.exitCode = 1 })
