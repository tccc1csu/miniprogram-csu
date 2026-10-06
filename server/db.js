// server/db.js - SQLite 数据库初始化（使用 sql.js 纯 JS 实现，无需编译）
// sql.js 是 SQLite 的 WebAssembly 移植版，数据持久化到本地文件
const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

// 数据库文件路径
const dataDir = path.join(__dirname, 'data')
const dbPath = path.join(dataDir, 'app.db')

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

let db = null      // 原始 sql.js Database 实例
let ready = false   // 是否已初始化

// ====== 异步初始化 ======
async function initDatabase() {
  const SQL = await initSqlJs()
  let buffer = null
  if (fs.existsSync(dbPath)) {
    buffer = fs.readFileSync(dbPath)
  }
  db = buffer ? new SQL.Database(buffer) : new SQL.Database()

  // 开启外键
  db.run('PRAGMA foreign_keys = ON;')

  // 建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      department TEXT DEFAULT '',
      token TEXT,
      create_time TEXT DEFAULT (datetime('now','localtime')),
      update_time TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      openid TEXT DEFAULT '',
      user_id INTEGER,
      create_time TEXT DEFAULT (datetime('now','localtime')),
      update_time TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      create_time TEXT DEFAULT (datetime('now','localtime')),
      update_time TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS weekly_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT DEFAULT '',
      member_name TEXT NOT NULL,
      member_openid TEXT DEFAULT '',
      department TEXT DEFAULT '',
      week TEXT NOT NULL,
      work_content TEXT DEFAULT '',
      workload REAL DEFAULT 0,
      allowance REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      uploaded_by TEXT DEFAULT '',
      uploader_openid TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now','localtime')),
      update_time TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_week ON weekly_records(week);
    CREATE INDEX IF NOT EXISTS idx_records_dept ON weekly_records(department);
    CREATE INDEX IF NOT EXISTS idx_records_member ON weekly_records(member_name);
    CREATE INDEX IF NOT EXISTS idx_members_dept ON members(department);
  `)

  persist()
  ready = true
  return getWrapper()
}

// ====== 持久化到文件 ======
function persist() {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

// ====== 封装一个类似 better-sqlite3 的 API ======
// 提供 prepare(sql).run/get/all，让 server.js 的写法简洁
function prepare(sql) {
  return {
    run: function (...params) {
      // 处理 undefined/null 参数，sql.js 需要 null 而非 undefined
      const safeParams = params.map(p => (p === undefined ? null : p))
      db.run(sql, safeParams)
      const result = db.getRowsModified()
      const row = db.exec('SELECT last_insert_rowid() as id')
      const lastInsertRowid = (row.length > 0) ? row[0].values[0][0] : 0
      // 每次写操作后持久化
      persist()
      return { changes: result, lastInsertRowid: lastInsertRowid }
    },
    get: function (...params) {
      const safeParams = params.map(p => (p === undefined ? null : p))
      const stmt = db.prepare(sql)
      stmt.bind(safeParams)
      let result = null
      if (stmt.step()) {
        result = stmt.getAsObject()
      }
      stmt.free()
      return result
    },
    all: function (...params) {
      const safeParams = params.map(p => (p === undefined ? null : p))
      const stmt = db.prepare(sql)
      stmt.bind(safeParams)
      const results = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()
      return results
    }
  }
}

// 包装对象，对外暴露 prepare
function getWrapper() {
  return { prepare, persist }
}

module.exports = {
  initDatabase,
  prepare,
  persist,
  get isReady() { return ready },
  get db() { return db }
}
