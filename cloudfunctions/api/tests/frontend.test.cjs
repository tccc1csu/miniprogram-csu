const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '../../../miniprogram')
function load(page, backend) {
  let definition
  const calls = [], wx = { showModal() { throw Error('审核通过不能再弹窗') } }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pages', page, page + '.js'), 'utf8'), {
    Page(value) { definition = value }, getApp: () => ({ globalData: {} }), wx, console, setTimeout,
    require(name) {
      if (name.endsWith('/db')) return { callFunction: (fn, event) => { calls.push({ fn, event }); return backend ? backend(fn, event) : Promise.resolve({}) } }
      if (name.endsWith('/util')) return { showToast() {}, showLoading() {}, hideLoading() {} }
      if (name.endsWith('/constants')) return { DEFAULT_DEPARTMENTS: [], WORK_TYPES: [], DEPARTMENT_DEFAULT_WORK_TYPE: {} }
      return {}
    }
  })
  definition.setData = function (data) { Object.assign(this.data, data) }
  definition.loadTasks = definition.loadHandoffs = definition.loadSuggestions = () => {}
  return { page: definition, calls }
}
test('所有审核通过入口直接请求后端，不打开表单，不提交伪造审核字段；连点只请求一次', async () => {
  for (const name of ['handoffs', 'operationsLayout', 'production', 'suggestions']) {
    let finish
    const { page, calls } = load(name, () => new Promise(resolve => { finish = resolve }))
    page.data.detailTarget = { _id: 'task1', canReview: true }
    const event = { currentTarget: { dataset: { item: { _id: 'task1', canReview: true, canArchive: true }, id: 'suggestion1' } } }
    const action = name === 'production' ? 'approveArchive' : 'approveDirect'
    const first = page[action](event)
    page[action](event)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].event.reviewComment, undefined)
    assert.equal(calls[0].event.reviewerUserId, undefined)
    assert.equal(calls[0].event.archiveNote, undefined)
    finish({}); await first
    assert.equal(page._approving, false)
  }
})
test('请求与成果上传未完成时不能提前提交业务', () => {
  for (const name of ['handoffs', 'operationsLayout', 'production', 'projectTasks']) {
    const { page, calls } = load(name)
    page.data.attachmentUploading = true
    page.submitCreate()
    if (page.confirmComplete) page.confirmComplete()
    assert.equal(calls.length, 0)
  }
})

test('新建项目选择参与部门时不依赖尚未打开的项目详情', () => {
  const { page } = load('projectTasks')
  page.data.departmentOptions = [{ name: '办公部', checked: false }]
  page.data.detailProject = null
  page.toggleDept({ currentTarget: { dataset: { dept: '办公部' } } })
  assert.equal(page.data.departmentOptions[0].checked, true)
})
test('附件部分上传失败保留先前成功附件，并清除忙状态', async () => {
  let definition, counter = 0
  vm.runInNewContext(fs.readFileSync(path.join(root, 'components/documentAttachments/index.js'), 'utf8'), {
    Component(value) { definition = value },
    require(name) { return name.endsWith('/db') ? { callFunction: async (_, e) => e.action === 'prepareBusinessDocument'
      ? { _id: 'bd' + counter, cloudPath: 'path' } : { _id: 'bd' + counter, name: '附件.pdf', fileID: 'cloud://file' } } : { showToast() {} } },
    wx: { chooseMessageFile: async () => ({ tempFiles: [{ name: 'a.pdf', size: 1, path: 'a' }, { name: 'b.pdf', size: 1, path: 'b' }] }),
      cloud: { uploadFile: async () => { counter++; if (counter === 2) throw Error('断网'); return { fileID: 'cloud://file' } } } }
  })
  const events = [], instance = { properties: { value: [], readonly: false }, data: { uploading: false },
    setData(data) { Object.assign(this.data, data) }, triggerEvent(name, value) { events.push({ name, value }) } }
  await definition.methods.choose.call(instance)
  assert.equal(events.filter(e => e.name === 'change').length, 1)
  assert.equal(events.find(e => e.name === 'change').value.value.length, 1)
  assert.equal(events.at(-1).value.uploading, false)
  assert.equal(instance.data.uploading, false)
})
