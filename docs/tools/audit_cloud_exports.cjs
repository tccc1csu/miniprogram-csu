// node docs/tools/audit_cloud_exports.cjs <私有备份目录> [报告路径]
// 目录只读取 <集合名>.json / .jsonl；不会修改备份或连接云环境。
const fs = require('fs')
const path = require('path')
const { analyze } = require('../../cloudfunctions/api/schema-audit')
const folder = process.argv[2]
if (!folder || !fs.statSync(folder).isDirectory()) throw new Error('请提供私有数据库导出目录')
const collections = {}
for (const file of fs.readdirSync(folder)) {
  if (!/^[a-z][a-z0-9_]*\.(json|jsonl)$/.test(file)) continue
  const source = fs.readFileSync(path.join(folder, file), 'utf8').replace(/^\uFEFF/, '')
  const value = file.endsWith('.jsonl') ? source.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)) : JSON.parse(source)
  const rows = Array.isArray(value) ? value : value.data
  if (!Array.isArray(rows)) throw new Error(file + ' 须为数组或 { data: [...] } 或 JSONL')
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error(file + ' 包含非法文档')
  collections[file.replace(/\.(json|jsonl)$/, '')] = rows
}
const output = JSON.stringify(analyze(collections), null, 2) + '\n'
if (process.argv[3]) fs.writeFileSync(process.argv[3], output)
else process.stdout.write(output)
