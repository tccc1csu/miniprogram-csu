// 业务附件只接受服务器登记的云文件，上传人和时间不信任客户端。
const crypto = require('crypto')
const EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar', 'jpg', 'jpeg', 'png', 'mp4']
const MAX_SIZE = 50 * 1024 * 1024
function validate(name, size) {
  if (typeof name !== 'string' || !name.trim() || name.length > 180 || /[\\/\x00-\x1f]/.test(name)) throw new Error('文件名无效')
  const ext = name.split('.').pop().toLowerCase()
  if (!EXTENSIONS.includes(ext)) throw new Error('不支持该附件格式')
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SIZE) throw new Error('每个附件须在 50 MB 以内')
  return ext
}
async function prepare(db, user, openid, event) {
  const name = String(event.name || '').trim(), size = Number(event.size)
  const ext = validate(name, size), id = 'bd_' + crypto.randomBytes(16).toString('hex')
  const cloudPath = 'business-documents/' + id + '.' + ext, now = new Date()
  await db.collection('files').doc(id).set({ data: {
    name, size, cloudPath, fileID: '', businessDocument: true, uploadStatus: 'pending',
    uploaderUserId: user._id, uploaderOpenid: openid, uploaderName: user.name,
    department: user.department || '', createTime: now, updateTime: now
  } })
  return { _id: id, cloudPath }
}
async function register(db, cloud, user, event) {
  const id = String(event.fileId || ''), fileID = String(event.fileID || '')
  const result = await db.collection('files').doc(id).get()
  const doc = Array.isArray(result.data) ? result.data[0] : result.data
  if (!doc || !doc.businessDocument || doc.uploaderUserId !== user._id) throw new Error('没有该附件的上传权限')
  if (!/^cloud:\/\/[^/]+\//.test(fileID) || !fileID.endsWith('/' + doc.cloudPath)) throw new Error('附件存储路径不匹配')
  if (doc.uploadStatus === 'ready') {
    if (doc.fileID !== fileID) throw new Error('已登记附件不能更换存储引用')
    return { _id: id, name: doc.name, size: doc.size, fileID: doc.fileID }
  }
  const checked = await cloud.getTempFileURL({ fileList: [fileID] })
  if (!checked.fileList || !checked.fileList[0] || checked.fileList[0].status !== 0 || !checked.fileList[0].tempFileURL) throw new Error('云附件尚未上传成功')
  await db.collection('files').doc(id).update({ data: { fileID, uploadStatus: 'ready', updateTime: new Date() } })
  return { _id: id, name: doc.name, size: doc.size, fileID }
}
async function resolve(db, user, input, previous = []) {
  if (input === undefined) return previous
  if (!Array.isArray(input) || input.length > 10) throw new Error('每次最多提交 10 个附件')
  const allowed = new Set(previous.map(file => file._id)), seen = new Set(), result = []
  for (const item of input) {
    const id = item && item._id
    if (typeof id !== 'string' || !/^bd_[a-f0-9]{32}$/.test(id)) throw new Error('请选择已上传的业务附件')
    if (seen.has(id)) continue
    seen.add(id)
    const response = await db.collection('files').doc(id).get()
    const file = Array.isArray(response.data) ? response.data[0] : response.data
    if (!file || !file.businessDocument || file.uploadStatus !== 'ready' || (!allowed.has(id) && file.uploaderUserId !== user._id)) throw new Error('附件不存在或无权使用')
    result.push({ _id: id, name: file.name, size: file.size, fileID: file.fileID,
      uploaded_by: file.uploaderUserId, uploaded_at: file.createTime })
  }
  return result
}
module.exports = { prepare, register, resolve, validate }
