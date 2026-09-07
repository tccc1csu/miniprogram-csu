// server/server.js - 本地后端服务入口
// 青年传媒中心 - 工作量与津贴统计系统
// 运行: node server.js  (默认端口 3000)
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

const db = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

// ============ 中间件 ============
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 简单鉴权中间件（通过 token 校验）
function auth(req, res, next) {
  const token = req.headers['x-token'] || (req.body && req.body.token)
  if (!token) {
    // 未登录也可访问的接口放行（如 login）
    req.user = null
  } else {
    const row = db.prepare('SELECT id, openid, name, role, department FROM users WHERE token = ?').get(token)
    if (row) {
      req.user = row
    } else {
      req.user = null
    }
  }
  next()
}
app.use(auth)

// 需要登录的接口校验
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.json({ code: -1, message: '请先登录' })
  }
  next()
}

// 需要管理员权限
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.json({ code: -1, message: '需要管理员权限' })
  }
  next()
}

// 生成 token
function generateToken() {
  return crypto.randomBytes(16).toString('hex') + Date.now().toString(36)
}

// 统一成功响应
function success(data) {
  return { code: 0, data: data }
}
// 统一失败响应
function fail(message) {
  return { code: -1, message: message }
}

// ============ 登录/注册 ============
// POST /api/login  { name, password, role, department }
app.post('/api/login', (req, res) => {
  const { name, password, role, department } = req.body
  if (!name || !password) {
    return res.json(fail('姓名和密码不能为空'))
  }

  try {
    // 1. 先按 token/openid 查（本地版用 name+role 唯一标识一个账号）
    // 2. 按 name + role 查找
    const exist = db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(name, role || 'member')

    if (exist) {
      // 已注册，校验密码
      if (exist.password !== password) {
        return res.json(fail('该姓名已注册，密码错误'))
      }
      // 生成新 token 并更新
      const token = generateToken()
      db.prepare('UPDATE users SET token = ?, update_time = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run(token, exist.id)

      // 如果是部长/成员且 members 表中还没有记录，补一条
      if (role !== 'admin') {
        const m = db.prepare('SELECT id FROM members WHERE name = ? AND department = ?').get(name, department || '')
        if (!m) {
          db.prepare('INSERT INTO members (name, department, role, openid, user_id) VALUES (?, ?, ?, ?, ?)')
            .run(name, department || '', role, exist.openid || '', exist.id)
        }
      }

      return res.json(success({
        _id: String(exist.id),
        openid: exist.openid || ('local_' + exist.id),
        name: exist.name,
        role: exist.role,
        department: exist.department || '',
        token: token
      }))
    }

    // 新用户注册
    const openid = 'local_' + Date.now()
    const token = generateToken()
    const info = db.prepare(
      'INSERT INTO users (openid, name, password, role, department, token) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(openid, name, password, role || 'member', role === 'admin' ? '' : (department || ''), token)

    // 部长/成员在 members 表中也建立记录
    if (role !== 'admin') {
      db.prepare('INSERT INTO members (name, department, role, openid, user_id) VALUES (?, ?, ?, ?, ?)')
        .run(name, department || '', role, openid, info.lastInsertRowid)
    }

    return res.json(success({
      _id: String(info.lastInsertRowid),
      openid: openid,
      name: name,
      role: role,
      department: department || '',
      token: token
    }))
  } catch (err) {
    console.error('login error', err)
    return res.json(fail('登录失败：' + err.message))
  }
})

// ============ 周工作量记录 ============
// POST /api/addRecord  (add / update / delete)
app.post('/api/addRecord', requireAuth, (req, res) => {
  const action = req.body.action || 'addRecord'

  try {
    // 删除记录
    if (action === 'deleteRecord') {
      const info = db.prepare('DELETE FROM weekly_records WHERE id = ?').run(Number(req.body.recordId))
      return res.json(success({ removed: info.changes }))
    }

    // 更新记录
    if (action === 'updateRecord') {
      const { recordId, workContent, workload, allowance, remark } = req.body
      db.prepare(
        `UPDATE weekly_records SET work_content=?, workload=?, allowance=?, remark=?, update_time=datetime('now','localtime') WHERE id=?`
      ).run(workContent, parseFloat(workload) || 0, parseFloat(allowance) || 0, remark || '', Number(recordId))
      return res.json(success({ updated: 1 }))
    }

    // 添加记录（同成员同周次覆盖）
    const {
      memberId, memberName, memberOpenid, department,
      week, workContent, workload, allowance, remark,
      uploadedBy, uploaderOpenid
    } = req.body

    if (!memberName || !week || workContent === undefined) {
      return res.json(fail('缺少必要参数'))
    }

    const exist = db.prepare('SELECT id FROM weekly_records WHERE member_name = ? AND week = ?').get(memberName, week)

    if (exist) {
      db.prepare(
        `UPDATE weekly_records SET member_id=?, member_openid=?, department=?, work_content=?, workload=?, allowance=?, remark=?, uploaded_by=?, uploader_openid=?, update_time=datetime('now','localtime') WHERE id=?`
      ).run(memberId || '', memberOpenid || '', department || '', workContent, parseFloat(workload) || 0,
        parseFloat(allowance) || 0, remark || '', uploadedBy || '', uploaderOpenid || req.user.openid, exist.id)
      return res.json(success({ _id: String(exist.id), updated: true }))
    } else {
      const info = db.prepare(
        `INSERT INTO weekly_records (member_id, member_name, member_openid, department, week, work_content, workload, allowance, remark, uploaded_by, uploader_openid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(memberId || '', memberName, memberOpenid || '', department || '', week, workContent,
        parseFloat(workload) || 0, parseFloat(allowance) || 0, remark || '', uploadedBy || '', uploaderOpenid || req.user.openid)
      return res.json(success({ _id: String(info.lastInsertRowid), updated: false }))
    }
  } catch (err) {
    console.error('addRecord error', err)
    return res.json(fail('操作失败：' + err.message))
  }
})

// ============ 查询记录 ============
// POST /api/getRecords
app.post('/api/getRecords', requireAuth, (req, res) => {
  try {
    // 查询单条
    if (req.body.recordId) {
      const row = db.prepare('SELECT * FROM weekly_records WHERE id = ?').get(Number(req.body.recordId))
      const data = row ? formatRecord(row) : null
      return res.json(success(data))
    }

    // 条件查询
    let sql = 'SELECT * FROM weekly_records WHERE 1=1'
    const params = []
    if (req.body.week) { sql += ' AND week = ?'; params.push(req.body.week) }
    if (req.body.department) { sql += ' AND department = ?'; params.push(req.body.department) }
    if (req.body.memberOpenid) { sql += ' AND member_openid = ?'; params.push(req.body.memberOpenid) }
    if (req.body.memberName) { sql += ' AND member_name = ?'; params.push(req.body.memberName) }
    if (req.body.uploaderOpenid) { sql += ' AND uploader_openid = ?'; params.push(req.body.uploaderOpenid) }
    sql += ' ORDER BY create_time DESC'

    const rows = db.prepare(sql).all(...params)
    const list = rows.map(formatRecord)
    return res.json(success(list))
  } catch (err) {
    console.error('getRecords error', err)
    return res.json(fail('查询失败：' + err.message))
  }
})

// ============ 统计 ============
// POST /api/getStatistics  { type, week, department }
app.post('/api/getStatistics', requireAuth, (req, res) => {
  const { type, week, department } = req.body
  try {
    if (type === 'adminOverview') {
      // 部门数、成员数
      const memberCount = db.prepare('SELECT COUNT(*) as c FROM members').get().c
      const deptRows = db.prepare('SELECT DISTINCT department FROM members WHERE department != \'\'').all()
      const departments = deptRows.map(r => r.department)

      // 本周记录
      const weekRows = db.prepare('SELECT * FROM weekly_records WHERE week = ?').all(week)
      let thisWeekAllowance = 0
      weekRows.forEach(r => { thisWeekAllowance += r.allowance || 0 })

      // 最近5条
      const recent = db.prepare('SELECT * FROM weekly_records ORDER BY create_time DESC LIMIT 5').all()

      return res.json(success({
        overview: {
          totalMembers: memberCount,
          totalDepartments: departments.length,
          thisWeekRecords: weekRows.length,
          thisWeekAllowance: thisWeekAllowance.toFixed(0)
        },
        recentRecords: recent.map(formatRecord)
      }))
    }

    if (type === 'ministerOverview') {
      const members = db.prepare('SELECT * FROM members WHERE department = ?').all(department)
      const weekRows = db.prepare('SELECT * FROM weekly_records WHERE week = ? AND department = ?').all(week, department)
      const uploadedNames = new Set(weekRows.map(r => r.member_name))
      let thisWeekAllowance = 0
      weekRows.forEach(r => { thisWeekAllowance += r.allowance || 0 })

      const recent = db.prepare('SELECT * FROM weekly_records WHERE department = ? ORDER BY create_time DESC LIMIT 5').all(department)

      return res.json(success({
        overview: {
          memberCount: members.length,
          uploadedCount: uploadedNames.size,
          pendingCount: Math.max(0, members.length - uploadedNames.size),
          thisWeekAllowance: thisWeekAllowance.toFixed(0)
        },
        recentRecords: recent.map(formatRecord)
      }))
    }

    if (type === 'statistics') {
      let rows
      if (department) {
        rows = db.prepare('SELECT * FROM weekly_records WHERE week = ? AND department = ?').all(week, department)
      } else {
        rows = db.prepare('SELECT * FROM weekly_records WHERE week = ?').all(week)
      }

      const deptMap = {}
      const memberMap = {}
      let totalWorkload = 0, totalAllowance = 0
      const memberSet = new Set()

      rows.forEach(r => {
        const dept = r.department || '未分组'
        if (!deptMap[dept]) deptMap[dept] = { department: dept, totalWorkload: 0, totalAllowance: 0, members: new Set() }
        deptMap[dept].totalWorkload += r.workload || 0
        deptMap[dept].totalAllowance += r.allowance || 0
        deptMap[dept].members.add(r.member_name)

        const key = r.member_name + '|' + (r.department || '')
        if (!memberMap[key]) memberMap[key] = { key, memberName: r.member_name, department: r.department || '', workload: 0, allowance: 0 }
        memberMap[key].workload += r.workload || 0
        memberMap[key].allowance += r.allowance || 0

        totalWorkload += r.workload || 0
        totalAllowance += r.allowance || 0
        memberSet.add(r.member_name)
      })

      const deptStats = Object.values(deptMap).map(d => ({
        department: d.department,
        totalWorkload: d.totalWorkload.toFixed(1),
        totalAllowance: d.totalAllowance.toFixed(0),
        memberCount: d.members.size
      })).sort((a, b) => parseFloat(b.totalAllowance) - parseFloat(a.totalAllowance))

      const maxWorkload = Math.max(...deptStats.map(d => parseFloat(d.totalWorkload)), 1)
      deptStats.forEach(d => { d.workloadPercent = Math.round((parseFloat(d.totalWorkload) / maxWorkload) * 100) })

      const memberStats = Object.values(memberMap).map(m => ({
        key: m.key,
        memberName: m.memberName,
        department: m.department,
        workload: m.workload.toFixed(1),
        allowance: m.allowance.toFixed(0)
      })).sort((a, b) => parseFloat(b.allowance) - parseFloat(a.allowance))

      return res.json(success({
        deptStats,
        memberStats,
        totalStats: {
          totalWorkload: totalWorkload.toFixed(1),
          totalAllowance: totalAllowance.toFixed(0),
          memberCount: memberSet.size,
          recordCount: rows.length
        }
      }))
    }

    if (type === 'weeklyTable') {
      let rows
      if (department) {
        rows = db.prepare('SELECT * FROM weekly_records WHERE week = ? AND department = ?').all(week, department)
      } else {
        rows = db.prepare('SELECT * FROM weekly_records WHERE week = ?').all(week)
      }

      const deptMap = {}
      rows.forEach(r => {
        const dept = r.department || '未分组'
        if (!deptMap[dept]) deptMap[dept] = { department: dept, records: [], totalWorkload: 0, totalAllowance: 0, members: new Set() }
        deptMap[dept].records.push(formatRecord(r))
        deptMap[dept].totalWorkload += r.workload || 0
        deptMap[dept].totalAllowance += r.allowance || 0
        deptMap[dept].members.add(r.member_name)
      })

      const groups = Object.values(deptMap).map(g => {
        g.records.sort((a, b) => a.memberName.localeCompare(b.memberName))
        g.memberCount = g.members.size
        g.totalWorkload = g.totalWorkload.toFixed(1)
        g.totalAllowance = g.totalAllowance.toFixed(0)
        delete g.members
        return g
      }).sort((a, b) => a.department.localeCompare(b.department))

      return res.json(success({ groups }))
    }

    return res.json(fail('未知的统计类型'))
  } catch (err) {
    console.error('getStatistics error', err)
    return res.json(fail('统计失败：' + err.message))
  }
})

// ============ 数据管理 ============
// POST /api/manageData  { action, ... }
app.post('/api/manageData', requireAuth, (req, res) => {
  const action = req.body.action
  try {
    // ---- 成员管理 ----
    if (action === 'getMembers') {
      let rows
      if (req.body.department) {
        rows = db.prepare('SELECT * FROM members WHERE department = ? ORDER BY department, name').all(req.body.department)
      } else {
        rows = db.prepare('SELECT * FROM members ORDER BY department, name').all()
      }
      return res.json(success(rows.map(formatMember)))
    }

    if (action === 'addMember') {
      const { name, department, role } = req.body
      if (!name || !department) return res.json(fail('姓名和部门不能为空'))
      const exist = db.prepare('SELECT id FROM members WHERE name = ? AND department = ?').get(name, department)
      if (exist) return res.json(fail('该部门下已存在此成员'))
      const info = db.prepare('INSERT INTO members (name, department, role, openid) VALUES (?, ?, ?, ?)').run(name, department, role || 'member', '')
      return res.json(success({ _id: String(info.lastInsertRowid) }))
    }

    if (action === 'updateMember') {
      const { memberId, name, department, role } = req.body
      db.prepare('UPDATE members SET name=?, department=?, role=?, update_time=datetime(\'now\',\'localtime\') WHERE id=?')
        .run(name, department, role || 'member', Number(memberId))
      return res.json(success({ updated: 1 }))
    }

    if (action === 'deleteMember') {
      const info = db.prepare('DELETE FROM members WHERE id = ?').run(Number(req.body.memberId))
      return res.json(success({ removed: info.changes }))
    }

    // ---- 部门管理 ----
    if (action === 'getDepartments') {
      const rows = db.prepare('SELECT * FROM departments ORDER BY name').all()
      const list = rows.map(r => ({ _id: String(r.id), name: r.name }))
      // 若 departments 表为空，从 members 聚合
      if (list.length === 0) {
        const depts = db.prepare('SELECT DISTINCT department FROM members WHERE department != \'\' ORDER BY department').all()
        return res.json(success(depts.map(d => ({ _id: d.department, name: d.department }))))
      }
      return res.json(success(list))
    }

    if (action === 'addDepartment') {
      const { name } = req.body
      if (!name) return res.json(fail('部门名称不能为空'))
      const exist = db.prepare('SELECT id FROM departments WHERE name = ?').get(name)
      if (exist) return res.json(fail('部门已存在'))
      const info = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name)
      return res.json(success({ _id: String(info.lastInsertRowid) }))
    }

    if (action === 'deleteDepartment') {
      const info = db.prepare('DELETE FROM departments WHERE id = ?').run(Number(req.body.departmentId))
      return res.json(success({ removed: info.changes }))
    }

    // ---- 用户管理（仅管理员） ----
    if (action === 'getUsers') {
      if (req.user.role !== 'admin') return res.json(fail('需要管理员权限'))
      const rows = db.prepare('SELECT * FROM users ORDER BY role, name').all()
      const order = { admin: 0, minister: 1, member: 2 }
      rows.sort((a, b) => (order[a.role] || 3) - (order[b.role] || 3) || a.name.localeCompare(b.name))
      const list = rows.map(u => ({
        _id: String(u.id),
        openid: u.openid,
        name: u.name,
        role: u.role,
        department: u.department || '',
        hasPassword: !!u.password
      }))
      return res.json(success(list))
    }

    if (action === 'deleteUser') {
      if (req.user.role !== 'admin') return res.json(fail('需要管理员权限'))
      const info = db.prepare('DELETE FROM users WHERE id = ?').run(Number(req.body.userId))
      return res.json(success({ removed: info.changes }))
    }

    if (action === 'updateUserRole') {
      if (req.user.role !== 'admin') return res.json(fail('需要管理员权限'))
      const { userId, role, department } = req.body
      db.prepare('UPDATE users SET role=?, department=?, update_time=datetime(\'now\',\'localtime\') WHERE id=?')
        .run(role, role === 'admin' ? '' : (department || ''), Number(userId))
      return res.json(success({ updated: 1 }))
    }

    return res.json(fail('未知操作：' + action))
  } catch (err) {
    console.error('manageData error', err)
    return res.json(fail('操作失败：' + err.message))
  }
})

// ============ 格式化函数 ============
// 将数据库行(下划线命名)转为前端期望的格式(驼峰命名)
function formatRecord(r) {
  return {
    _id: String(r.id),
    memberId: r.member_id || '',
    memberName: r.member_name,
    memberOpenid: r.member_openid || '',
    department: r.department || '',
    week: r.week,
    workContent: r.work_content || '',
    workload: r.workload,
    allowance: r.allowance,
    remark: r.remark || '',
    uploadedBy: r.uploaded_by || '',
    uploaderOpenid: r.uploader_openid || '',
    _createTime: r.create_time,
    _updateTime: r.update_time
  }
}

function formatMember(m) {
  return {
    _id: String(m.id),
    name: m.name,
    department: m.department,
    role: m.role,
    openid: m.openid || ''
  }
}

// ============ 启动服务（先初始化数据库，再启动 Express） ============
const dbModule = require('./db')

dbModule.initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================')
    console.log('  青年传媒中心 - 本地后端服务已启动')
    console.log('  服务地址: http://localhost:' + PORT)
    console.log('  局域网地址: http://<本机IP>:' + PORT)
    console.log('  数据库文件: server/data/app.db')
    console.log('========================================')
    console.log('  小程序请在 "不校验合法域名" 模式下调试')
    console.log('  (微信开发者工具 -> 详情 -> 本地设置)')
  })
}).catch(err => {
  console.error('数据库初始化失败:', err)
  process.exit(1)
})
