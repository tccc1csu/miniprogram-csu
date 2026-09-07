const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const COLLECTIONS = {
  USERS: 'users',
  DEPARTMENTS: 'departments',
  MEMBERS: 'members',
  RECORDS: 'weekly_records',
  CONTACTS: 'contacts',
  SUGGESTIONS: 'suggestions',
  VOTES: 'votes',
  VOTE_RECORDS: 'vote_records',
  NOTIFICATIONS: 'notifications',
  HANDOFFS: 'handoffs'
}

const DEFAULT_DEPARTMENTS = [
  '办公部',
  '采编部',
  '美编部',
  '摄制部',
  '运营部',
  '原创部'
]

const ROLE_ORDER = {
  admin: 0,
  minister: 1,
  member: 2
}

const SESSION_TTL_DAYS = 14
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
const TEST_ACCOUNT_PASSWORD = '123456'
const ENABLE_TEST_ACCOUNTS = true
const ENABLE_DEMO_DATA = true
const DEMO_SEED_TAG = 'demo-2026-07-27'
const WORK_TYPES = ['稿件写作', '视频制作', '美编设计', '日常办公']
const DEFAULT_WORK_TYPE = '日常办公'
const DEPARTMENT_DEFAULT_WORK_TYPE = {
  '采编部': '稿件写作',
  '原创部': '稿件写作',
  '摄制部': '视频制作',
  '美编部': '美编设计',
  '办公部': '日常办公',
  '运营部': '日常办公'
}

const TEST_ACCOUNTS = [
  { name: '测试管理员', role: 'admin', department: '' },
  { name: '管理员老师', role: 'admin', department: '' },
  { name: '采编部长', role: 'minister', department: '采编部' },
  { name: '采编干事', role: 'member', department: '采编部' },
  { name: '办公部长', role: 'minister', department: '办公部' },
  { name: '美编部长', role: 'minister', department: '美编部' },
  { name: '赵六', role: 'member', department: '办公部' },
  { name: '钱七', role: 'member', department: '办公部' },
  { name: '张三', role: 'member', department: '采编部' },
  { name: '李四', role: 'member', department: '美编部' },
  { name: '王五', role: 'member', department: '摄制部' }
]

const HANDOFF_STATUS_LABELS = {
  submitted: '待办公部派发',
  assigned: '待干事同步',
  completed: '待管理员审核',
  rejected: '审核退回',
  archived: '已归档'
}

let collectionStructureReady = false
let collectionStructurePromise = null
let seedDataReady = false
let seedDataPromise = null

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const functionName = event.functionName || event.name || event.type

  try {
    // 定时器触发器：检查截止日期并发送提醒。
    const triggerName = event.TriggerName || event.triggerName || ''
    const isTimerTrigger = event.Trigger || event.Type === 'Timer' || event.type === 'timer' || triggerName.indexOf('deadline') >= 0
    if (isTimerTrigger) {
      await ensureCollectionStructure()
      return await checkDeadlinesInternal()
    }

    await ensureCollections({ seed: shouldSeedForFunction(functionName) })

    if (functionName === 'wechatLogin') {
      return await handleWechatLogin(event, openid)
    }
    if (functionName === 'accountLogin' || functionName === 'login') {
      return await handleAccountLogin(event, openid)
    }
    if (functionName === 'bindWechat') {
      return await handleBindWechat(event, openid)
    }
    if (functionName === 'checkSession') {
      return await handleCheckSession(event, openid)
    }
    if (functionName === 'register') {
      return await handleRegister(event, openid)
    }
    if (functionName === 'initCloud') {
      return success({ initialized: true, collections: COLLECTIONS })
    }
    if (functionName === 'seedTestAccounts') {
      return success({
        enabled: ENABLE_TEST_ACCOUNTS,
        demoEnabled: ENABLE_DEMO_DATA,
        demoSeedTag: DEMO_SEED_TAG,
        password: ENABLE_TEST_ACCOUNTS ? TEST_ACCOUNT_PASSWORD : '',
        accounts: ENABLE_TEST_ACCOUNTS ? TEST_ACCOUNTS.map(item => ({
          name: item.name,
          role: item.role,
          department: item.department
        })) : []
      })
    }

    const user = await requireAuth(event, openid)

    if (functionName === 'addRecord') {
      return await handleAddRecord(event, user, openid)
    }
    if (functionName === 'getRecords') {
      return await handleGetRecords(event, user, openid)
    }
    if (functionName === 'getStatistics') {
      return await handleGetStatistics(event, user, openid)
    }
    if (functionName === 'manageData') {
      return await handleManageData(event, user, openid)
    }
    if (functionName === 'manageContacts') {
      return await handleManageContacts(event, user)
    }
    if (functionName === 'manageSuggestions') {
      return await handleManageSuggestions(event, user)
    }
    if (functionName === 'manageVotes') {
      return await handleManageVotes(event, user)
    }
    if (functionName === 'manageNotifications') {
      return await handleManageNotifications(event, user)
    }
    if (functionName === 'manageHandoffs') {
      return await handleManageHandoffs(event, user, openid)
    }
    return fail('未知云函数操作：' + functionName)
  } catch (err) {
    console.error('api error', functionName, err)
    return fail(err.message || '云函数执行失败')
  }
}

function shouldSeedForFunction(functionName) {
  return ['initCloud', 'seedTestAccounts', 'accountLogin', 'login'].includes(functionName)
}

async function ensureCollections(options) {
  await ensureCollectionStructure()
  if (options && options.seed) {
    await ensureSeedData()
  }
}

async function ensureCollectionStructure() {
  if (collectionStructureReady) {
    return
  }
  if (collectionStructurePromise) {
    await collectionStructurePromise
    return
  }

  collectionStructurePromise = doEnsureCollectionStructure()
  try {
    await collectionStructurePromise
    collectionStructureReady = true
  } finally {
    collectionStructurePromise = null
  }
}

async function doEnsureCollectionStructure() {
  const collectionNames = Object.keys(COLLECTIONS).map(key => COLLECTIONS[key])
  for (let i = 0; i < collectionNames.length; i++) {
    try {
      await db.createCollection(collectionNames[i])
    } catch (err) {
      // 集合已存在时会进入 catch，这种情况可以忽略。
    }
  }

  const existingDepartments = await getAll(COLLECTIONS.DEPARTMENTS, {})
  const existingNames = {}
  existingDepartments.forEach(item => {
    if (item.name) existingNames[item.name] = true
  })
  const now = new Date()
  for (let i = 0; i < DEFAULT_DEPARTMENTS.length; i++) {
    if (existingNames[DEFAULT_DEPARTMENTS[i]]) continue
    await db.collection(COLLECTIONS.DEPARTMENTS).add({
      data: {
        name: DEFAULT_DEPARTMENTS[i],
        createTime: now,
        updateTime: now
      }
    })
  }
}

async function ensureSeedData() {
  if (seedDataReady) {
    return
  }
  if (seedDataPromise) {
    await seedDataPromise
    return
  }

  seedDataPromise = doEnsureSeedData()
  try {
    await seedDataPromise
    seedDataReady = true
  } finally {
    seedDataPromise = null
  }
}

async function doEnsureSeedData() {
  await ensureTestAccounts()
  await ensureDemoData()
}

async function handleLogin(event, openid) {
  return await handleAccountLogin(event, openid)
}

async function handleWechatLogin(event, openid) {
  const boundUser = await getWechatBoundUser(openid)
  if (!boundUser) {
    return success({
      needBind: true,
      message: '当前微信未绑定账号，请绑定已有账号或注册新账号'
    })
  }

  const userInfo = await issueSession(boundUser, openid, event.wxProfile)
  return success(userInfo)
}

async function handleAccountLogin(event, openid) {
  const account = await verifyPasswordLogin(event)
  if (!account.ok) {
    return fail(account.message)
  }

  const exist = account.user
  if (isTestLoginUser(exist, event.password)) {
    const userInfo = await issueSession(exist, openid, event.wxProfile, { temporary: true })
    return success(userInfo)
  }

  return await handleBindWechat(event, openid)
}

async function handleBindWechat(event, openid) {
  const account = await verifyPasswordLogin(event)
  if (!account.ok) {
    return fail(account.message)
  }
  const exist = account.user

  const currentBind = await getWechatBoundUser(openid)
  if (currentBind && currentBind._id !== exist._id) {
    if (!exist.isTestAccount) {
      return fail('当前微信已绑定账号「' + currentBind.name + '」，请直接微信授权登录')
    }
  }

  if (!exist.isTestAccount && exist.openid && exist.openid !== openid) {
    return fail('该账号已绑定其他微信，请联系管理员处理')
  }

  const userInfo = await issueSession(exist, openid, event.wxProfile)
  return success(userInfo)
}

async function verifyPasswordLogin(event) {
  const name = trim(event.name)
  const password = trim(event.password)

  if (!name || !password) {
    return { ok: false, message: '姓名和密码不能为空' }
  }

  const users = db.collection(COLLECTIONS.USERS)
  const existRes = await users.where({ name }).limit(1).get()
  const exist = first(existRes)

  if (!exist) {
    return { ok: false, message: '用户不存在，请先注册' }
  }

  const passwordHash = hashPassword(password)
  if (!passwordMatches(exist, password, passwordHash)) {
    return { ok: false, message: '密码错误' }
  }

  return { ok: true, user: exist }
}

function isTestLoginUser(user, password) {
  if (!ENABLE_TEST_ACCOUNTS || !user) {
    return false
  }
  if (user.isTestAccount) {
    return true
  }
  return TEST_ACCOUNTS.some(item => item.name === user.name) && trim(password) === TEST_ACCOUNT_PASSWORD
}

async function handleCheckSession(event, openid) {
  const auth = await getCurrentUser(openid, event.token)
  if (!auth.user) {
    return fail('请先登录')
  }
  if (auth.expired) {
    return fail('登录已过期，请重新登录')
  }
  return success(buildUserInfo(auth.user, trim(event.token), auth.user.tokenExpireAt))
}

async function handleRegister(event, openid) {
  const name = trim(event.name)
  const password = trim(event.password)
  const confirmPassword = trim(event.confirmPassword)
  const role = trim(event.role) || 'member'
  const department = role === 'admin' ? '' : trim(event.department)
  const wxProfile = sanitizeWxProfile(event.wxProfile)

  if (!name || !password || !confirmPassword) {
    return fail('姓名、密码和确认密码不能为空')
  }
  if (password !== confirmPassword) {
    return fail('两次输入的密码不一致')
  }
  if (password.length < 4) {
    return fail('密码长度至少4位')
  }
  if (!['admin', 'minister', 'member'].includes(role)) {
    return fail('请选择角色')
  }
  if (role !== 'admin' && !department) {
    return fail('请选择所属部门')
  }

  const users = db.collection(COLLECTIONS.USERS)
  const currentBind = await getWechatBoundUser(openid)
  if (currentBind) {
    if (currentBind.isTestAccount) {
      await clearUserWechatBinding(currentBind._id)
    } else {
      return fail('当前微信已绑定账号「' + currentBind.name + '」，请直接微信授权登录')
    }
  }

  const existRes = await users.where({ name }).limit(1).get()
  if (first(existRes)) {
    return fail('该姓名已被注册，请绑定已有账号')
  }

  if (role === 'admin') {
    const admins = await getAll(COLLECTIONS.USERS, { role: 'admin' })
    if (admins.some(item => !item.isTestAccount)) {
      return fail('管理员账号已存在，请联系管理员分配角色')
    }
  }

  const now = new Date()
  const token = generateToken()
  const tokenExpireAt = new Date(now.getTime() + SESSION_TTL_MS)
  const passwordHash = hashPassword(password)
  const addRes = await users.add({
    data: {
      openid,
      name,
      passwordHash,
      password: null,
      role,
      department,
      token,
      tokenExpireAt,
      wechatBound: true,
      wxProfile,
      isTestAccount: false,
      lastLoginTime: now,
      createTime: now,
      updateTime: now
    }
  })

  const userInfo = buildUserInfo({
    _id: addRes._id,
    openid,
    name,
    role,
    department,
    token,
    tokenExpireAt,
    wechatBound: true,
    isTestAccount: false
  }, token, tokenExpireAt)

  if (role !== 'admin') {
    await upsertMemberForUser(userInfo)
  }

  return success(userInfo)
}

async function ensureTestAccounts() {
  if (!ENABLE_TEST_ACCOUNTS) {
    return
  }

  const users = db.collection(COLLECTIONS.USERS)
  const passwordHash = hashPassword(TEST_ACCOUNT_PASSWORD)
  const now = new Date()

  for (let i = 0; i < TEST_ACCOUNTS.length; i++) {
    const account = TEST_ACCOUNTS[i]
    const existRes = await users.where({ name: account.name }).limit(1).get()
    const exist = first(existRes)
    if (exist && !exist.isTestAccount) {
      continue
    }

    if (exist) {
      await users.doc(exist._id).update({
        data: {
          role: account.role,
          department: account.department,
          passwordHash,
          password: null,
          isTestAccount: true,
          wechatBound: false,
          seedUpdateTime: now
        }
      })
      if (account.role !== 'admin') {
        await upsertMemberForUser({
          _id: exist._id,
          openid: exist.openid || '',
          name: account.name,
          role: account.role,
          department: account.department,
          isTestAccount: true
        })
      }
      continue
    }

    const addRes = await users.add({
      data: {
        openid: '',
        sessionOpenid: '',
        name: account.name,
        passwordHash,
        password: null,
        role: account.role,
        department: account.department,
        token: '',
        tokenExpireAt: null,
        wechatBound: false,
        wxProfile: null,
        isTestAccount: true,
        createTime: now,
        updateTime: now
      }
    })

    if (account.role !== 'admin') {
      await upsertMemberForUser({
        _id: addRes._id,
        openid: '',
        name: account.name,
        role: account.role,
        department: account.department,
        isTestAccount: true
      })
    }
  }
}

async function ensureDemoData() {
  if (!ENABLE_DEMO_DATA) {
    return
  }

  await ensureDemoWorkRecords()
  await ensureDemoHandoffs()
}

async function ensureDemoWorkRecords() {
  const existing = await getAll(COLLECTIONS.RECORDS, { seedTag: DEMO_SEED_TAG })
  if (existing.length > 0) {
    return
  }

  const now = new Date()
  const week = getCurrentWeekLabel(now)
  const rows = [
    {
      memberName: '张三',
      department: '采编部',
      week,
      workType: '稿件写作',
      workContent: '完成求职经验分享新闻稿初稿、采访整理与二次校对',
      workload: 5,
      allowance: 60,
      allowanceStatus: 'set',
      uploadedBy: '采编部长'
    },
    {
      memberName: '采编部长',
      department: '采编部',
      week,
      workType: '稿件写作',
      workContent: '统筹民族文化交融专题采写，协调图片素材与终稿审核',
      workload: 4,
      allowance: 80,
      allowanceStatus: 'set',
      uploadedBy: '采编部长'
    },
    {
      memberName: '赵六',
      department: '办公部',
      week,
      workType: '日常办公',
      workContent: '同步求职经验分享稿件至院网，整理反馈截图',
      workload: 2,
      allowance: 0,
      allowanceStatus: 'pending',
      uploadedBy: '赵六'
    },
    {
      memberName: '钱七',
      department: '办公部',
      week,
      workType: '日常办公',
      workContent: '整理升华网投稿格式并完成后台提交',
      workload: 1.5,
      allowance: 30,
      allowanceStatus: 'set',
      uploadedBy: '办公部长'
    },
    {
      memberName: '李四',
      department: '美编部',
      week,
      workType: '美编设计',
      workContent: '制作活动推文头图和新闻配图两套',
      workload: 3,
      allowance: 45,
      allowanceStatus: 'set',
      uploadedBy: '美编部长'
    }
  ]

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const workType = normalizeWorkType(row.workType)
    const member = await findMember('', row.memberName, row.department)
    await db.collection(COLLECTIONS.RECORDS).add({
      data: Object.assign({}, row, {
        memberId: member ? member._id : '',
        memberOpenid: member ? (member.openid || '') : '',
        workType,
        workTypes: [workType],
        uploaderOpenid: '',
        remark: row.allowanceStatus === 'pending' ? '成员已上报，等待部长填写津贴' : '演示数据',
        seedTag: DEMO_SEED_TAG,
        createTime: new Date(now.getTime() - i * 3600 * 1000),
        updateTime: now
      })
    })
  }
}

async function ensureDemoHandoffs() {
  const now = new Date()
  const rows = [
    {
      demoKey: 'handoff-submitted-editorial-report',
      title: '采编报备演示：迎新季专题稿同步',
      articleNames: '迎新季专题新闻稿\n优秀新生采访稿',
      targetSites: '院网、升华网、学工网',
      articleType: 'original',
      note: '这条用于测试采编部完成稿件后的报备动作，办公部部长登录后可以直接派发。',
      sourceDepartment: '采编部',
      targetDepartment: '办公部',
      submitterName: '采编干事',
      submitterOpenid: '',
      assigneeName: '',
      assigneeOpenid: '',
      assignedBy: '',
      status: 'submitted',
      statusLabel: HANDOFF_STATUS_LABELS.submitted,
      syncResult: '',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 2 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 2 * 3600 * 1000)
    },
    {
      demoKey: 'handoff-completed-admin-review',
      title: '管理员审核演示：求职经验分享挂网反馈',
      articleNames: '求职经验分享新闻稿',
      targetSites: '院网、升华网',
      articleType: 'original',
      note: '办公部已完成同步，等待管理员老师敲定通过或退回。',
      sourceDepartment: '采编部',
      targetDepartment: '办公部',
      submitterName: '采编部长',
      submitterOpenid: '',
      assigneeName: '赵六',
      assigneeOpenid: '',
      assignedBy: '办公部长',
      status: 'completed',
      statusLabel: HANDOFF_STATUS_LABELS.completed,
      syncResult: '院网已挂网，升华网已投稿，反馈截图已留存。',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 12 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 1 * 3600 * 1000),
      assignedTime: new Date(now.getTime() - 10 * 3600 * 1000),
      completedTime: new Date(now.getTime() - 1 * 3600 * 1000)
    },
    {
      demoKey: 'handoff-assigned-office-sync',
      title: '求职经验分享、民族文化交融新闻稿同步',
      articleNames: '求职经验分享新闻稿\n民族文化交融新闻稿',
      targetSites: '院网、升华网、学工网',
      articleType: 'original',
      note: '采编部已完成两篇稿件，辛苦办公部协助同步投稿。',
      sourceDepartment: '采编部',
      targetDepartment: '办公部',
      submitterName: '采编部长',
      submitterOpenid: '',
      assigneeName: '赵六',
      assigneeOpenid: '',
      assignedBy: '办公部长',
      status: 'assigned',
      statusLabel: HANDOFF_STATUS_LABELS.assigned,
      syncResult: '',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 6 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 4 * 3600 * 1000),
      assignedTime: new Date(now.getTime() - 4 * 3600 * 1000)
    },
    {
      demoKey: 'handoff-completed-campus-open-day',
      title: '校园开放日采访稿挂网反馈',
      articleNames: '校园开放日采访稿',
      targetSites: '院网',
      articleType: 'reprint',
      note: '已按老师要求补齐图片说明。',
      sourceDepartment: '采编部',
      targetDepartment: '办公部',
      submitterName: '张三',
      submitterOpenid: '',
      assigneeName: '钱七',
      assigneeOpenid: '',
      assignedBy: '办公部长',
      status: 'completed',
      statusLabel: HANDOFF_STATUS_LABELS.completed,
      syncResult: '院网已提交，等待管理员老师确认。',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 30 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 20 * 3600 * 1000),
      assignedTime: new Date(now.getTime() - 28 * 3600 * 1000),
      completedTime: new Date(now.getTime() - 20 * 3600 * 1000)
    },
    {
      demoKey: 'handoff-archived-graduation-topic',
      title: '毕业季专题稿同步归档',
      articleNames: '毕业季专题稿',
      targetSites: '升华网、学工网',
      articleType: 'original',
      note: '演示已归档流程。',
      sourceDepartment: '采编部',
      targetDepartment: '办公部',
      submitterName: '采编部长',
      submitterOpenid: '',
      assigneeName: '赵六',
      assigneeOpenid: '',
      assignedBy: '办公部长',
      status: 'archived',
      statusLabel: HANDOFF_STATUS_LABELS.archived,
      syncResult: '升华网、学工网均已同步。',
      reviewComment: '审核通过，已归档。',
      reviewerName: '测试管理员',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 80 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 72 * 3600 * 1000),
      assignedTime: new Date(now.getTime() - 78 * 3600 * 1000),
      completedTime: new Date(now.getTime() - 74 * 3600 * 1000),
      archivedTime: new Date(now.getTime() - 72 * 3600 * 1000)
    }
  ]

  for (let i = 0; i < rows.length; i++) {
    await ensureDemoHandoffRow(rows[i])
  }
}

async function ensureDemoHandoffRow(row) {
  const keyed = await getAll(COLLECTIONS.HANDOFFS, {
    seedTag: DEMO_SEED_TAG,
    demoKey: row.demoKey
  })
  if (keyed.length > 0) {
    return
  }

  const sameTitle = await getAll(COLLECTIONS.HANDOFFS, {
    seedTag: DEMO_SEED_TAG,
    title: row.title
  })
  if (sameTitle.length > 0) {
    return
  }

  await db.collection(COLLECTIONS.HANDOFFS).add({ data: row })
}

async function getWechatBoundUser(openid) {
  if (!openid) {
    return null
  }
  const list = await getAll(COLLECTIONS.USERS, { openid })
  const realBoundList = list.filter(item => !item.isTestAccount)
  realBoundList.sort((a, b) => getTime(b.updateTime) - getTime(a.updateTime))
  return realBoundList[0] || null
}

async function clearUserWechatBinding(userId) {
  if (!userId) {
    return
  }
  const user = await getDoc(COLLECTIONS.USERS, userId)
  const now = new Date()
  await db.collection(COLLECTIONS.USERS).doc(userId).update({
    data: {
      openid: '',
      sessionOpenid: '',
      token: '',
      tokenExpireAt: null,
      wechatBound: false,
      updateTime: now
    }
  })

  if (!user || !user.department) {
    return
  }

  const clearData = {
    openid: '',
    userId: '',
    updateTime: now
  }

  await db.collection(COLLECTIONS.MEMBERS).where({ userId }).update({ data: clearData })
  await db.collection(COLLECTIONS.MEMBERS).where({
    name: user.name,
    department: user.department
  }).update({ data: clearData })
}

async function issueSession(user, openid, wxProfileRaw, options) {
  const opts = options || {}
  const now = new Date()
  const token = generateToken()
  const tokenExpireAt = new Date(now.getTime() + SESSION_TTL_MS)
  const department = user.role === 'admin' ? '' : (user.department || '')
  const isTemporary = !!opts.temporary || !!user.isTestAccount
  const updateData = {
    openid: isTemporary ? (user.openid || '') : openid,
    sessionOpenid: isTemporary ? openid : '',
    password: null,
    token,
    tokenExpireAt,
    wechatBound: !isTemporary,
    lastLoginTime: now,
    updateTime: now
  }
  if (user.passwordHash) {
    updateData.passwordHash = user.passwordHash
  } else if (user.password) {
    updateData.passwordHash = hashPassword(user.password)
  }

  await db.collection(COLLECTIONS.USERS).doc(user._id).update({ data: updateData })

  const userInfo = buildUserInfo(Object.assign({}, user, updateData, {
    department,
    temporarySession: isTemporary
  }), token, tokenExpireAt)
  if (userInfo.role !== 'admin') {
    await upsertMemberForUser(userInfo)
  }

  return userInfo
}

async function handleAddRecord(event, user, openid) {
  const action = event.action || 'addRecord'
  const records = db.collection(COLLECTIONS.RECORDS)

  if (action === 'deleteRecord') {
    const record = await getDoc(COLLECTIONS.RECORDS, event.recordId)
    if (!record) {
      return fail('记录不存在')
    }
    if (!canOperateRecord(user, openid, record)) {
      return fail('无权删除该记录')
    }
    const res = await records.doc(event.recordId).remove()
    return success({ removed: getRemovedCount(res) })
  }

  if (action === 'updateRecord') {
    const record = await getDoc(COLLECTIONS.RECORDS, event.recordId)
    if (!record) {
      return fail('记录不存在')
    }
    if (!canEditRecord(user, openid, record)) {
      return fail('无权编辑该记录')
    }

    const updateData = buildRecordUpdateData(event, user, openid, record)

    const res = await records.doc(event.recordId).update({ data: updateData })
    return success({ updated: getUpdatedCount(res) })
  }

  const isMemberReport = user.role === 'member'
  const memberName = isMemberReport ? user.name : trim(event.memberName)
  const week = trim(event.week)
  const workContent = trim(event.workContent)
  const department = isMemberReport
    ? (user.department || '')
    : (user.role === 'minister' ? user.department : trim(event.department))

  if (!memberName || !week || !workContent) {
    return fail('缺少必要参数')
  }
  if (event.workload === undefined || event.workload === null || trim(event.workload) === '') {
    return fail('请填写工时')
  }
  if (user.role === 'minister' && department !== user.department) {
    return fail('只能上传本部门成员记录')
  }
  if (user.role === 'admin' && !department) {
    return fail('请选择成员所属部门')
  }

  const member = await findMember(event.memberId, memberName, department)
  const now = new Date()
  const workType = normalizeWorkType(event.workType, department)
  const baseData = {
    memberId: member ? member._id : (event.memberId || ''),
    memberName,
    memberOpenid: isMemberReport ? (user.isTestAccount ? '' : openid) : (member ? (member.openid || '') : (event.memberOpenid || '')),
    department,
    week,
    workType,
    workTypes: [workType],
    workContent,
    workload: toNumber(event.workload),
    remark: trim(event.remark),
    uploadedBy: user.name,
    uploaderOpenid: openid,
    updateTime: now
  }

  const existRes = await records.where({ memberName, department, week }).limit(1).get()
  const exist = first(existRes)

  const data = isMemberReport
    ? Object.assign({}, baseData, {
      allowance: exist ? toNumber(exist.allowance) : 0,
      allowanceStatus: 'pending',
      submittedByRole: 'member'
    })
    : Object.assign({}, baseData, {
      allowance: toNumber(event.allowance),
      allowanceStatus: 'set',
      submittedByRole: user.role
    })

  if (exist) {
    if (!canEditRecord(user, openid, exist)) {
      return fail('无权编辑该记录')
    }
    if (isMemberReport) {
      data.memberOpenid = exist.memberOpenid || (user.isTestAccount ? '' : openid)
    }
    await records.doc(exist._id).update({ data })
    return success({ _id: exist._id, updated: true })
  }

  data.createTime = now
  const addRes = await records.add({ data })
  return success({ _id: addRes._id, updated: false })
}

async function handleGetRecords(event, user, openid) {
  if (event.recordId) {
    const record = await getDoc(COLLECTIONS.RECORDS, event.recordId)
    if (!record) {
      return success(null)
    }
    if (!canViewRecord(user, openid, record)) {
      return fail('无权查看该记录')
    }
    return success(formatRecord(record))
  }

  const records = await getRecordsByRole(event, user, openid)
  records.sort(sortByCreateTimeDesc)
  return success(records.map(formatRecord))
}

async function handleGetStatistics(event, user, openid) {
  const type = event.type
  const week = event.week

  if (type === 'adminOverview') {
    if (user.role !== 'admin') {
      return fail('需要管理员权限')
    }

    const membersCount = await db.collection(COLLECTIONS.MEMBERS).count()
    const departmentsCount = await db.collection(COLLECTIONS.DEPARTMENTS).count()
    const weekRows = await getAll(COLLECTIONS.RECORDS, week ? { week } : {})
    const recent = await getAll(COLLECTIONS.RECORDS, {}, { field: 'createTime', direction: 'desc', limit: 5 })

    return success({
      overview: {
        totalMembers: membersCount.total || 0,
        totalDepartments: departmentsCount.total || 0,
        thisWeekRecords: weekRows.length,
        thisWeekAllowance: sum(weekRows, 'allowance').toFixed(0)
      },
      recentRecords: recent.map(formatRecord)
    })
  }

  if (type === 'ministerOverview') {
    if (user.role === 'member') {
      const ownRows = await getMemberRecords(user, openid, week)
      ownRows.sort(sortByCreateTimeDesc)
      return success({
        overview: {
          memberCount: 1,
          uploadedCount: ownRows.length > 0 ? 1 : 0,
          pendingCount: ownRows.length > 0 ? 0 : 1,
          thisWeekAllowance: sum(ownRows, 'allowance').toFixed(0)
        },
        recentRecords: ownRows.slice(0, 5).map(formatRecord)
      })
    }

    const department = user.role === 'minister' ? user.department : trim(event.department)
    const members = await getAll(COLLECTIONS.MEMBERS, department ? { department } : {})
    const weekRows = await getAll(COLLECTIONS.RECORDS, { week, department })
    const recent = await getAll(COLLECTIONS.RECORDS, { department }, { field: 'createTime', direction: 'desc', limit: 5 })
    const uploadedNames = unique(weekRows.map(item => item.memberName))

    return success({
      overview: {
        memberCount: members.length,
        uploadedCount: uploadedNames.length,
        pendingCount: Math.max(0, members.length - uploadedNames.length),
        thisWeekAllowance: sum(weekRows, 'allowance').toFixed(0)
      },
      recentRecords: recent.map(formatRecord)
    })
  }

  if (type === 'statistics') {
    const rows = await getRecordsForStats(event, user, openid)
    return success(buildStatistics(rows))
  }

  if (type === 'weeklyTable') {
    const rows = await getRecordsForStats(event, user, openid)
    return success(buildWeeklyTable(rows))
  }

  return fail('未知的统计类型')
}

async function handleManageData(event, user, openid) {
  const action = event.action

  if (action === 'getMembers') {
    const where = {}
    if (user.role === 'admin' && event.department) {
      where.department = event.department
    }
    if (user.role !== 'admin') {
      where.department = user.department
    }
    const members = await getAll(COLLECTIONS.MEMBERS, where)
    members.sort(sortByDepartmentAndName)
    return success(members.map(formatMember))
  }

  if (action === 'addMember') {
    if (!['admin', 'minister'].includes(user.role)) {
      return fail('无权添加成员')
    }
    const name = trim(event.name)
    const department = user.role === 'minister' ? user.department : trim(event.department)
    const role = event.role || 'member'
    if (!name || !department) {
      return fail('姓名和部门不能为空')
    }
    const existRes = await db.collection(COLLECTIONS.MEMBERS).where({ name, department }).limit(1).get()
    if (first(existRes)) {
      return fail('该部门下已存在此成员')
    }
    const now = new Date()
    const res = await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        name,
        department,
        role,
        openid: '',
        userId: '',
        createTime: now,
        updateTime: now
      }
    })
    return success({ _id: res._id })
  }

  if (action === 'updateMember') {
    if (!['admin', 'minister'].includes(user.role)) {
      return fail('无权更新成员')
    }
    const member = await getDoc(COLLECTIONS.MEMBERS, event.memberId)
    if (!member) {
      return fail('成员不存在')
    }
    if (user.role === 'minister' && member.department !== user.department) {
      return fail('只能管理本部门成员')
    }
    const department = user.role === 'minister' ? user.department : trim(event.department)
    await db.collection(COLLECTIONS.MEMBERS).doc(event.memberId).update({
      data: {
        name: trim(event.name),
        department,
        role: event.role || 'member',
        updateTime: new Date()
      }
    })
    return success({ updated: 1 })
  }

  if (action === 'deleteMember') {
    if (!['admin', 'minister'].includes(user.role)) {
      return fail('无权删除成员')
    }
    const member = await getDoc(COLLECTIONS.MEMBERS, event.memberId)
    if (!member) {
      return success({ removed: 0 })
    }
    if (user.role === 'minister' && member.department !== user.department) {
      return fail('只能删除本部门成员')
    }
    const res = await db.collection(COLLECTIONS.MEMBERS).doc(event.memberId).remove()
    return success({ removed: getRemovedCount(res) })
  }

  if (action === 'getDepartments') {
    if (user.role !== 'admin') {
      return success([{ _id: user.department || 'mine', name: user.department || '' }].filter(item => item.name))
    }
    const departments = await getAll(COLLECTIONS.DEPARTMENTS, {})
    departments.sort((a, b) => String(a.name).localeCompare(String(b.name)))
    return success(departments.map(item => ({ _id: item._id, name: item.name })))
  }

  if (action === 'addDepartment') {
    requireAdmin(user)
    const name = trim(event.name)
    if (!name) {
      return fail('部门名称不能为空')
    }
    const existRes = await db.collection(COLLECTIONS.DEPARTMENTS).where({ name }).limit(1).get()
    if (first(existRes)) {
      return fail('部门已存在')
    }
    const now = new Date()
    const res = await db.collection(COLLECTIONS.DEPARTMENTS).add({
      data: { name, createTime: now, updateTime: now }
    })
    return success({ _id: res._id })
  }

  if (action === 'deleteDepartment') {
    requireAdmin(user)
    const res = await db.collection(COLLECTIONS.DEPARTMENTS).doc(event.departmentId).remove()
    return success({ removed: getRemovedCount(res) })
  }

  if (action === 'getUsers') {
    requireAdmin(user)
    const users = await getAll(COLLECTIONS.USERS, {})
    users.sort(sortUsers)
    return success(users.map(formatUserForManage))
  }

  if (action === 'deleteUser') {
    requireAdmin(user)
    if (event.userId === user._id) {
      return fail('不能删除当前登录账号')
    }
    const res = await db.collection(COLLECTIONS.USERS).doc(event.userId).remove()
    return success({ removed: getRemovedCount(res) })
  }

  if (action === 'updateUserRole') {
    requireAdmin(user)
    const target = await getDoc(COLLECTIONS.USERS, event.userId)
    if (!target) {
      return fail('用户不存在')
    }

    const role = event.role || 'member'
    const department = role === 'admin' ? '' : trim(event.department)
    await db.collection(COLLECTIONS.USERS).doc(event.userId).update({
      data: {
        role,
        department,
        updateTime: new Date()
      }
    })

    if (role !== 'admin') {
      await upsertMemberForUser({
        _id: target._id,
        openid: target.openid || '',
        name: target.name,
        role,
        department,
        isTestAccount: !!target.isTestAccount
      })
    }

    return success({ updated: 1 })
  }

  if (['query', 'queryAll', 'count', 'add', 'update', 'remove'].includes(action)) {
    requireAdmin(user)
    return await handleGenericDataAction(event)
  }

  return fail('未知操作：' + action)
}

async function handleManageContacts(event, user) {
  const action = event.action
  const contacts = db.collection(COLLECTIONS.CONTACTS)

  if (action === 'getContacts') {
    const list = await getAll(COLLECTIONS.CONTACTS, {})
    list.sort(sortByDepartmentAndName)
    return success(list.map(formatContact))
  }

  if (action === 'addContact') {
    const name = trim(event.name)
    if (!name) {
      return fail('姓名不能为空')
    }
    const now = new Date()
    const res = await contacts.add({
      data: {
        name,
        department: trim(event.department),
        phone: trim(event.phone),
        email: trim(event.email),
        wechatId: trim(event.wechatId),
        qq: trim(event.qq),
        createdBy: user.name,
        createTime: now,
        updateTime: now
      }
    })
    return success({ _id: res._id })
  }

  if (action === 'updateContact') {
    const contact = await getDoc(COLLECTIONS.CONTACTS, event.contactId)
    if (!contact) {
      return fail('联系方式不存在')
    }
    await contacts.doc(event.contactId).update({
      data: {
        name: trim(event.name),
        department: trim(event.department),
        phone: trim(event.phone),
        email: trim(event.email),
        wechatId: trim(event.wechatId),
        qq: trim(event.qq),
        updateTime: new Date()
      }
    })
    return success({ updated: 1 })
  }

  if (action === 'deleteContact') {
    const res = await contacts.doc(event.contactId).remove()
    return success({ removed: getRemovedCount(res) })
  }

  return fail('未知操作：' + action)
}

async function handleManageSuggestions(event, user) {
  const action = event.action
  const suggestions = db.collection(COLLECTIONS.SUGGESTIONS)

  if (action === 'getSuggestions') {
    const where = {}
    if (event.status) {
      where.status = event.status
    }
    const list = await getAll(COLLECTIONS.SUGGESTIONS, where, { field: 'createTime', direction: 'desc' })
    return success(list.map(formatSuggestion))
  }

  if (action === 'addSuggestion') {
    const title = trim(event.title)
    if (!title) {
      return fail('活动标题不能为空')
    }
    const now = new Date()
    const res = await suggestions.add({
      data: {
        title,
        description: trim(event.description),
        submitterName: user.name,
        submitterOpenid: user.openid || '',
        status: 'pending',
        voteId: '',
        createTime: now,
        updateTime: now
      }
    })
    return success({ _id: res._id })
  }

  if (action === 'approveSuggestion') {
    requireAdmin(user)
    const suggestion = await getDoc(COLLECTIONS.SUGGESTIONS, event.suggestionId)
    if (!suggestion) {
      return fail('活动建议不存在')
    }

    const options = Array.isArray(event.voteOptions)
      ? event.voteOptions.map(item => trim(item)).filter(Boolean)
      : String(event.voteOptions || '').split('\n').map(item => trim(item)).filter(Boolean)
    if (options.length < 2) {
      return fail('至少需要两个投票选项')
    }

    const now = new Date()
    const voteRes = await db.collection(COLLECTIONS.VOTES).add({
      data: {
        suggestionId: event.suggestionId,
        title: trim(event.voteTitle) || '活动时间投票',
        options,
        deadline: trim(event.deadline),
        status: 'active',
        createTime: now,
        updateTime: now
      }
    })

    await suggestions.doc(event.suggestionId).update({
      data: {
        status: 'approved',
        voteId: voteRes._id,
        updateTime: now
      }
    })

    await db.collection(COLLECTIONS.NOTIFICATIONS).add({
      data: {
        title: '新活动：' + suggestion.title,
        content: (suggestion.description || '') + ' 管理员已审核通过，请参与时间投票。',
        type: 'activity',
        targetDept: '',
        createTime: now
      }
    })

    return success({ approved: 1, voteId: voteRes._id })
  }

  if (action === 'rejectSuggestion') {
    requireAdmin(user)
    await suggestions.doc(event.suggestionId).update({
      data: {
        status: 'rejected',
        updateTime: new Date()
      }
    })
    return success({ rejected: 1 })
  }

  return fail('未知操作：' + action)
}

async function handleManageVotes(event, user) {
  const action = event.action
  const votes = db.collection(COLLECTIONS.VOTES)

  if (action === 'getVotes') {
    const list = await getAll(COLLECTIONS.VOTES, {}, { field: 'createTime', direction: 'desc' })
    const result = []
    for (let i = 0; i < list.length; i++) {
      const vote = list[i]
      const options = getVoteOptions(vote)
      const records = await getAll(COLLECTIONS.VOTE_RECORDS, { voteId: vote._id })
      const voteCounts = options.map((_, index) => {
        return records.filter(record => Number(record.optionIndex) === index).length
      })
      const myVoteRecord = records.find(record => record.voterOpenid === user.openid)
      const formatted = formatVote(vote)
      formatted.voteCounts = voteCounts
      formatted.totalVotes = records.length
      formatted.options = options.map((text, index) => ({
        text,
        count: voteCounts[index] || 0,
        percent: records.length > 0 ? Math.round(((voteCounts[index] || 0) / records.length) * 100) : 0
      }))
      formatted.myVote = myVoteRecord ? Number(myVoteRecord.optionIndex) : -1
      result.push(formatted)
    }
    return success(result)
  }

  if (action === 'castVote') {
    const vote = await getDoc(COLLECTIONS.VOTES, event.voteId)
    if (!vote) {
      return fail('投票不存在')
    }
    if (vote.status !== 'active') {
      return fail('投票已结束')
    }

    const options = getVoteOptions(vote)
    const optionIndex = Number(event.optionIndex)
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
      return fail('投票选项无效')
    }

    const existRes = await db.collection(COLLECTIONS.VOTE_RECORDS)
      .where({ voteId: event.voteId, voterOpenid: user.openid || '' })
      .limit(1)
      .get()
    const exist = first(existRes)

    if (exist) {
      await db.collection(COLLECTIONS.VOTE_RECORDS).doc(exist._id).update({
        data: {
          optionIndex,
          voterName: user.name,
          updateTime: new Date()
        }
      })
    } else {
      const now = new Date()
      await db.collection(COLLECTIONS.VOTE_RECORDS).add({
        data: {
          voteId: event.voteId,
          optionIndex,
          voterName: user.name,
          voterOpenid: user.openid || '',
          createTime: now,
          updateTime: now
        }
      })
    }

    return success({ voted: 1 })
  }

  if (action === 'closeVote') {
    requireAdmin(user)
    await votes.doc(event.voteId).update({
      data: {
        status: 'closed',
        updateTime: new Date()
      }
    })
    return success({ closed: 1 })
  }

  return fail('未知操作：' + action)
}

async function handleManageNotifications(event, user) {
  const action = event.action

  if (action === 'getNotifications') {
    const limit = Math.min(toNumber(event.limit) || 20, 100)
    const list = await getAll(COLLECTIONS.NOTIFICATIONS, {}, {
      field: 'createTime',
      direction: 'desc',
      limit
    })
    return success(list.map(formatNotification))
  }

  if (action === 'addNotification') {
    requireAdmin(user)
    const title = trim(event.title)
    if (!title) {
      return fail('通知标题不能为空')
    }
    const res = await db.collection(COLLECTIONS.NOTIFICATIONS).add({
      data: {
        title,
        content: trim(event.content),
        type: 'general',
        targetDept: trim(event.targetDept),
        createTime: new Date()
      }
    })
    return success({ _id: res._id })
  }

  return fail('未知操作：' + action)
}

async function handleManageHandoffs(event, user, openid) {
  const action = event.action
  const handoffs = db.collection(COLLECTIONS.HANDOFFS)

  if (action === 'getHandoffs') {
    const scope = event.scope || 'active'
    const rows = await getVisibleHandoffs(user, openid, scope)
    rows.sort(sortByUpdateTimeDesc)
    return success(rows.map(item => formatHandoff(item, user, openid)))
  }

  if (action === 'createHandoff') {
    if (user.role !== 'admin' && user.department !== '采编部') {
      return fail('当前仅采编部可发起该协同流程')
    }

    const title = trim(event.title)
    const articleNames = trim(event.articleNames)
    const targetSites = trim(event.targetSites) || '院网、升华网、学工网'
    const articleType = normalizeArticleType(event.articleType)
    if (!title || !articleNames) {
      return fail('请填写标题和稿件名称')
    }

    const now = new Date()
    const addRes = await handoffs.add({
      data: {
        title,
        articleNames,
        targetSites,
        articleType,
        note: trim(event.note),
        deadline: trim(event.deadline) || '',
        sourceDepartment: '采编部',
        targetDepartment: '办公部',
        submitterName: user.name,
        submitterOpenid: openid,
        assigneeName: '',
        assigneeOpenid: '',
        assignedBy: '',
        status: 'submitted',
        statusLabel: HANDOFF_STATUS_LABELS.submitted,
        syncResult: '',
        reviewComment: '',
        createTime: now,
        updateTime: now
      }
    })

    await addWorkflowNotification({
      title: '新的采编对接需求',
      content: title + ' 已提交给办公部，请办公部部长派发。',
      targetDept: '办公部'
    })
    return success({ _id: addRes._id })
  }

  if (action === 'assignHandoff') {
    const handoff = await getDoc(COLLECTIONS.HANDOFFS, event.handoffId)
    if (!handoff) {
      return fail('协同需求不存在')
    }
    if (!canAssignHandoff(user, handoff)) {
      return fail('只有办公部部长或管理员可以派发该任务')
    }
    if (!['submitted', 'rejected'].includes(handoff.status)) {
      return fail('当前状态不能派发')
    }

    const assigneeName = trim(event.assigneeName)
    if (!assigneeName) {
      return fail('请选择承接干事')
    }
    const assignee = await findMember('', assigneeName, '办公部')
    const now = new Date()
    await handoffs.doc(event.handoffId).update({
      data: {
        assigneeName,
        assigneeOpenid: assignee ? (assignee.openid || '') : '',
        assignedBy: user.name,
        status: 'assigned',
        statusLabel: HANDOFF_STATUS_LABELS.assigned,
        assignedTime: now,
        updateTime: now
      }
    })
    await addWorkflowNotification({
      title: '办公部任务已派发',
      content: handoff.title + ' 已派发给 ' + assigneeName + '。',
      targetDept: '办公部'
    })
    return success({ updated: 1 })
  }

  if (action === 'completeHandoff') {
    const handoff = await getDoc(COLLECTIONS.HANDOFFS, event.handoffId)
    if (!handoff) {
      return fail('协同需求不存在')
    }
    if (!canCompleteHandoff(user, openid, handoff)) {
      return fail('只有承接干事、办公部部长或管理员可以提交同步结果')
    }
    if (!['assigned', 'rejected'].includes(handoff.status)) {
      return fail('当前状态不能提交完成')
    }

    const syncResult = trim(event.syncResult)
    if (!syncResult) {
      return fail('请填写同步结果或反馈说明')
    }
    const now = new Date()
    await handoffs.doc(event.handoffId).update({
      data: {
        syncResult,
        completedBy: user.name,
        status: 'completed',
        statusLabel: HANDOFF_STATUS_LABELS.completed,
        completedTime: now,
        updateTime: now
      }
    })
    await addWorkflowNotification({
      title: '协同需求待审核',
      content: handoff.title + ' 已完成同步，等待管理员老师审核。',
      targetDept: ''
    })
    return success({ updated: 1 })
  }

  if (action === 'reviewHandoff') {
    requireAdmin(user)
    const handoff = await getDoc(COLLECTIONS.HANDOFFS, event.handoffId)
    if (!handoff) {
      return fail('协同需求不存在')
    }
    if (handoff.status !== 'completed') {
      return fail('只有待审核需求可以审核')
    }

    const approved = !!event.approved
    const now = new Date()
    const settledRecords = approved
      ? await settleHandoffWorkload(event.handoffId, handoff, now, user, openid)
      : []
    await handoffs.doc(event.handoffId).update({
      data: {
        status: approved ? 'archived' : 'rejected',
        statusLabel: approved ? HANDOFF_STATUS_LABELS.archived : HANDOFF_STATUS_LABELS.rejected,
        reviewComment: trim(event.reviewComment),
        reviewerName: user.name,
        reviewedTime: now,
        archivedTime: approved ? now : null,
        workloadSettled: approved,
        settledRecords,
        updateTime: now
      }
    })
    await addWorkflowNotification({
      title: approved ? '协同需求已归档' : '协同需求审核退回',
      content: handoff.title + (approved ? ' 已审核通过并归档。' : ' 未通过审核，请办公部修改后重新提交。'),
      targetDept: approved ? '采编部' : '办公部'
    })
    return success({ updated: 1, archived: approved })
  }

  if (action === 'checkDeadlines') {
    requireAdmin(user)
    const allHandoffs = await getAll(COLLECTIONS.HANDOFFS, {})
    const now = new Date()
    const reminders = []

    for (const item of allHandoffs) {
      if (!item.deadline || ['archived', 'rejected'].includes(item.status)) continue

      const dueDate = new Date(item.deadline)
      if (isNaN(dueDate.getTime())) continue

      const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

      // 24小时内到期且未发过提醒。
      if (diffHours > 0 && diffHours <= 24 && !item.deadlineReminderSent) {
        const dept = item.status === 'submitted' ? '办公部' : (item.assigneeName ? '办公部' : '采编部')
        await addWorkflowNotification({
          title: '任务即将到期提醒',
          content: '「' + item.title + '」将在 ' + Math.ceil(diffHours) + ' 小时后到期，请尽快处理。',
          targetDept: dept
        })
        await handoffs.doc(item._id).update({
          data: { deadlineReminderSent: true, updateTime: now }
        })
        reminders.push(item._id)
      }

      // 已过期。
      if (diffHours <= 0 && !item.deadlineExpiredSent) {
        const dept = item.status === 'submitted' ? '办公部' : (item.assigneeName ? '办公部' : '采编部')
        await addWorkflowNotification({
          title: '任务已过期提醒',
          content: '「' + item.title + '」已超过截止日期，请尽快处理。',
          targetDept: dept
        })
        await handoffs.doc(item._id).update({
          data: { deadlineExpiredSent: true, updateTime: now }
        })
        reminders.push(item._id)
      }
    }

    return success({ checked: allHandoffs.length, reminders: reminders.length, reminderIds: reminders })
  }

  return fail('未知操作：' + action)
}

// 定时器触发的截止日期检查（无需用户认证）。
async function checkDeadlinesInternal() {
  const handoffs = db.collection(COLLECTIONS.HANDOFFS)
  const allHandoffs = await getAll(COLLECTIONS.HANDOFFS, {})
  const now = new Date()
  const reminders = []

  for (const item of allHandoffs) {
    if (!item.deadline || ['archived', 'rejected'].includes(item.status)) continue

    const dueDate = new Date(item.deadline)
    if (isNaN(dueDate.getTime())) continue

    const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    // 24小时内到期且未发过提醒。
    if (diffHours > 0 && diffHours <= 24 && !item.deadlineReminderSent) {
      await addWorkflowNotification({
        title: '任务即将到期提醒',
        content: '「' + item.title + '」将在 ' + Math.ceil(diffHours) + ' 小时后到期，请尽快处理。',
        targetDept: '办公部'
      })
      await handoffs.doc(item._id).update({
        data: { deadlineReminderSent: true, updateTime: now }
      })
      reminders.push(item._id)
    }

    // 已过期。
    if (diffHours <= 0 && !item.deadlineExpiredSent) {
      await addWorkflowNotification({
        title: '任务已过期提醒',
        content: '「' + item.title + '」已超过截止日期，请尽快处理。',
        targetDept: '办公部'
      })
      await handoffs.doc(item._id).update({
        data: { deadlineExpiredSent: true, updateTime: now }
      })
      reminders.push(item._id)
    }
  }

  return success({ checked: allHandoffs.length, reminders: reminders.length, reminderIds: reminders })
}

async function settleHandoffWorkload(handoffId, handoff, now, reviewer, reviewerOpenid) {
  const articleType = normalizeArticleType(handoff.articleType)
  const articleNames = trim(handoff.articleNames || handoff.title)
  const settled = []

  if (articleType === 'original' && trim(handoff.submitterName)) {
    const editorialRecord = await upsertWorkflowWorkloadRecord({
      sourceHandoffId: handoffId,
      memberName: trim(handoff.submitterName),
      memberOpenid: trim(handoff.submitterOpenid),
      department: '采编部',
      workType: '稿件写作',
      workload: 4,
      content: '稿件写作：' + articleNames,
      remark: '采编办公协同归档自动核算，可由部长调整',
      now,
      reviewer,
      reviewerOpenid
    })
    settled.push(editorialRecord)
  }

  if (trim(handoff.assigneeName)) {
    const officeRecord = await upsertWorkflowWorkloadRecord({
      sourceHandoffId: handoffId,
      memberName: trim(handoff.assigneeName),
      memberOpenid: trim(handoff.assigneeOpenid),
      department: '办公部',
      workType: '日常办公',
      workload: 1,
      content: '稿件同步：' + articleNames + (handoff.targetSites ? '（' + handoff.targetSites + '）' : ''),
      remark: '采编办公协同归档自动核算，可由部长调整',
      now,
      reviewer,
      reviewerOpenid
    })
    settled.push(officeRecord)
  }

  return settled
}

async function upsertWorkflowWorkloadRecord(options) {
  const sourceHandoffId = trim(options.sourceHandoffId)
  const memberName = trim(options.memberName)
  const department = trim(options.department)
  const workType = normalizeWorkType(options.workType)
  const week = getCurrentWeekLabel(options.now)
  const workload = toNumber(options.workload)
  const content = trim(options.content)
  const member = await findMember('', memberName, department)
  const memberOpenid = member ? (member.openid || '') : trim(options.memberOpenid)
  const records = db.collection(COLLECTIONS.RECORDS)
  const existRes = await records.where({ memberName, department, week }).limit(1).get()
  const exist = first(existRes)

  if (exist) {
    const sourceIds = normalizeIdList(exist.sourceHandoffIds)
    if (sourceIds.includes(sourceHandoffId)) {
      return {
        recordId: exist._id,
        memberName,
        department,
        workType,
        workload: 0,
        skipped: true
      }
    }

    const nextSourceIds = sourceIds.concat(sourceHandoffId)
    const workTypes = mergeUnique(getWorkTypesFromRecord(exist), [workType])
    await records.doc(exist._id).update({
      data: {
        memberId: exist.memberId || (member ? member._id : ''),
        memberOpenid: exist.memberOpenid || memberOpenid,
        workType: exist.workType || workType,
        workTypes,
        workContent: appendUniqueLine(exist.workContent, content),
        workload: toNumber(exist.workload) + workload,
        allowance: toNumber(exist.allowance),
        allowanceStatus: 'pending',
        remark: appendUniqueLine(exist.remark, trim(options.remark)),
        uploadedBy: exist.uploadedBy || (options.reviewer && options.reviewer.name ? options.reviewer.name : '协作归档'),
        uploaderOpenid: exist.uploaderOpenid || options.reviewerOpenid || '',
        submittedByRole: exist.submittedByRole || 'workflow',
        autoGeneratedWorkload: true,
        sourceType: exist.sourceType || 'handoff',
        sourceHandoffIds: nextSourceIds,
        updateTime: options.now
      }
    })
    return {
      recordId: exist._id,
      memberName,
      department,
      workType,
      workload,
      skipped: false
    }
  }

  const addRes = await records.add({
    data: {
      memberId: member ? member._id : '',
      memberName,
      memberOpenid,
      department,
      week,
      workType,
      workTypes: [workType],
      workContent: content,
      workload,
      allowance: 0,
      allowanceStatus: 'pending',
      remark: trim(options.remark),
      uploadedBy: options.reviewer && options.reviewer.name ? options.reviewer.name : '协作归档',
      uploaderOpenid: options.reviewerOpenid || '',
      submittedByRole: 'workflow',
      autoGeneratedWorkload: true,
      sourceType: 'handoff',
      sourceHandoffIds: [sourceHandoffId],
      createTime: options.now,
      updateTime: options.now
    }
  })

  return {
    recordId: addRes._id,
    memberName,
    department,
    workType,
    workload,
    skipped: false
  }
}

async function handleGenericDataAction(event) {
  const collection = event.collection
  if (!Object.values(COLLECTIONS).includes(collection)) {
    return fail('不允许访问该集合')
  }

  if (event.action === 'query' || event.action === 'queryAll') {
    const list = await getAll(collection, event.where || {})
    return success(list)
  }
  if (event.action === 'count') {
    const res = await db.collection(collection).where(event.where || {}).count()
    return success(res.total || 0)
  }
  if (event.action === 'add') {
    const now = new Date()
    const res = await db.collection(collection).add({
      data: Object.assign({}, event.data || {}, { createTime: now, updateTime: now })
    })
    return success({ _id: res._id })
  }
  if (event.action === 'update') {
    const res = await db.collection(collection).doc(event.id).update({
      data: Object.assign({}, event.data || {}, { updateTime: new Date() })
    })
    return success({ updated: getUpdatedCount(res) })
  }
  if (event.action === 'remove') {
    const res = await db.collection(collection).doc(event.id).remove()
    return success({ removed: getRemovedCount(res) })
  }

  return fail('未知通用操作')
}

async function getVisibleHandoffs(user, openid, scope) {
  const rows = await getAll(COLLECTIONS.HANDOFFS, {})
  return rows.filter(item => {
    if (scope === 'archive' && item.status !== 'archived') {
      return false
    }
    if (scope !== 'archive' && item.status === 'archived') {
      return false
    }
    if (user.role === 'admin') {
      return true
    }
    if (scope === 'mine') {
      return item.submitterOpenid === openid ||
        item.assigneeOpenid === openid ||
        item.submitterName === user.name ||
        item.assigneeName === user.name
    }
    if (user.department === item.sourceDepartment || user.department === item.targetDepartment) {
      return true
    }
    return item.submitterOpenid === openid || item.assigneeOpenid === openid
  })
}

function canAssignHandoff(user, handoff) {
  if (user.role === 'admin') {
    return true
  }
  return user.role === 'minister' && user.department === handoff.targetDepartment
}

function canCompleteHandoff(user, openid, handoff) {
  if (user.role === 'admin') {
    return true
  }
  if (user.role === 'minister' && user.department === handoff.targetDepartment) {
    return true
  }
  return user.department === handoff.targetDepartment && (
    handoff.assigneeOpenid === openid || handoff.assigneeName === user.name
  )
}

async function addWorkflowNotification(data) {
  await db.collection(COLLECTIONS.NOTIFICATIONS).add({
    data: {
      title: data.title,
      content: data.content,
      type: 'handoff',
      targetDept: data.targetDept || '',
      createTime: new Date()
    }
  })
}

async function requireAuth(event, openid) {
  const auth = await getCurrentUser(openid, event.token)
  if (!auth.user) {
    throw new Error('请先登录')
  }
  if (auth.expired) {
    throw new Error('登录已过期，请重新登录')
  }
  return auth.user
}

async function getCurrentUser(openid, token) {
  const cleanToken = trim(token)
  if (!cleanToken) {
    return { user: null, expired: false }
  }

  const byToken = await db.collection(COLLECTIONS.USERS)
    .where({ token: cleanToken })
    .limit(1)
    .get()
  const user = first(byToken)
  const openidMatches = user && (user.openid === openid || user.sessionOpenid === openid)
  if (!openidMatches) {
    return { user: null, expired: false }
  }

  if (isSessionExpired(user)) {
    return { user, expired: true }
  }

  return { user, expired: false }
}

async function upsertMemberForUser(userInfo) {
  const department = userInfo.department || ''
  if (!department) {
    return
  }

  const members = db.collection(COLLECTIONS.MEMBERS)
  const existRes = await members.where({ name: userInfo.name, department }).limit(1).get()
  const exist = first(existRes)
  const data = {
    name: userInfo.name,
    department,
    role: userInfo.role || 'member',
    openid: (userInfo.isTestAccount || userInfo.temporarySession) ? '' : (userInfo.openid || ''),
    userId: userInfo._id || '',
    updateTime: new Date()
  }

  if (exist) {
    await members.doc(exist._id).update({ data })
    return
  }

  data.createTime = new Date()
  await members.add({ data })
}

async function getDoc(collection, id) {
  if (!id) {
    return null
  }

  try {
    const res = await db.collection(collection).doc(id).get()
    return res && res.data ? res.data : null
  } catch (err) {
    return null
  }
}

async function findMember(memberId, name, department) {
  const byId = await getDoc(COLLECTIONS.MEMBERS, memberId)
  if (byId) {
    return byId
  }
  const res = await db.collection(COLLECTIONS.MEMBERS).where({ name, department }).limit(1).get()
  return first(res)
}

async function getRecordsByRole(event, user, openid) {
  if (user.role === 'member') {
    return await getMemberRecords(user, openid, event.week)
  }

  const where = {}
  if (event.week) where.week = event.week
  if (event.department) where.department = event.department
  if (event.memberOpenid) where.memberOpenid = event.memberOpenid
  if (event.memberName) where.memberName = event.memberName
  if (event.uploaderOpenid) where.uploaderOpenid = event.uploaderOpenid

  if (user.role === 'minister') {
    where.department = user.department
  }

  return await getAll(COLLECTIONS.RECORDS, where)
}

async function getRecordsForStats(event, user, openid) {
  if (user.role === 'member') {
    return await getMemberRecords(user, openid, event.week)
  }

  const where = {}
  if (event.week) where.week = event.week
  if (event.department) where.department = event.department
  if (user.role === 'minister') where.department = user.department

  return await getAll(COLLECTIONS.RECORDS, where)
}

async function getMemberRecords(user, openid, week) {
  let byOpenid = []
  if (!user.isTestAccount) {
    const byOpenidWhere = { memberOpenid: openid }
    if (week) byOpenidWhere.week = week
    byOpenid = await getAll(COLLECTIONS.RECORDS, byOpenidWhere)
  }

  const byNameWhere = { memberName: user.name, department: user.department || '' }
  if (week) byNameWhere.week = week
  const byName = await getAll(COLLECTIONS.RECORDS, byNameWhere)

  const map = {}
  byOpenid.concat(byName).forEach(item => {
    map[item._id] = item
  })
  return Object.keys(map).map(id => map[id])
}

async function getAll(collection, where, options) {
  const opts = options || {}
  let query = db.collection(collection)
  if (where && Object.keys(where).length > 0) {
    query = query.where(where)
  }
  if (opts.field) {
    query = query.orderBy(opts.field, opts.direction || 'asc')
  }
  if (opts.skip) {
    query = query.skip(opts.skip)
  }
  query = query.limit(opts.limit || 1000)
  const res = await query.get()
  return res.data || []
}

function buildStatistics(rows) {
  const deptMap = {}
  const memberMap = {}
  let totalWorkload = 0
  let totalAllowance = 0
  const memberSet = {}

  rows.forEach(record => {
    const department = record.department || '未分组'
    if (!deptMap[department]) {
      deptMap[department] = {
        department,
        totalWorkload: 0,
        totalAllowance: 0,
        members: {}
      }
    }
    deptMap[department].totalWorkload += toNumber(record.workload)
    deptMap[department].totalAllowance += toNumber(record.allowance)
    deptMap[department].members[record.memberName] = true

    const key = record.memberName + '|' + department
    if (!memberMap[key]) {
      memberMap[key] = {
        key,
        memberName: record.memberName,
        department,
        workload: 0,
        allowance: 0
      }
    }
    memberMap[key].workload += toNumber(record.workload)
    memberMap[key].allowance += toNumber(record.allowance)

    totalWorkload += toNumber(record.workload)
    totalAllowance += toNumber(record.allowance)
    memberSet[key] = true
  })

  const deptStats = Object.keys(deptMap).map(key => {
    const item = deptMap[key]
    return {
      department: item.department,
      totalWorkload: item.totalWorkload.toFixed(1),
      totalAllowance: item.totalAllowance.toFixed(0),
      memberCount: Object.keys(item.members).length
    }
  }).sort((a, b) => Number(b.totalAllowance) - Number(a.totalAllowance))

  const maxWorkload = Math.max.apply(null, deptStats.map(item => Number(item.totalWorkload)).concat([1]))
  deptStats.forEach(item => {
    item.workloadPercent = Math.round((Number(item.totalWorkload) / maxWorkload) * 100)
  })

  const memberStats = Object.keys(memberMap).map(key => {
    const item = memberMap[key]
    return {
      key: item.key,
      memberName: item.memberName,
      department: item.department,
      workload: item.workload.toFixed(1),
      allowance: item.allowance.toFixed(0)
    }
  }).sort((a, b) => Number(b.allowance) - Number(a.allowance))

  return {
    deptStats,
    memberStats,
    totalStats: {
      totalWorkload: totalWorkload.toFixed(1),
      totalAllowance: totalAllowance.toFixed(0),
      memberCount: Object.keys(memberSet).length,
      recordCount: rows.length
    }
  }
}

function buildWeeklyTable(rows) {
  const deptMap = {}
  rows.forEach(record => {
    const department = record.department || '未分组'
    if (!deptMap[department]) {
      deptMap[department] = {
        department,
        records: [],
        totalWorkload: 0,
        totalAllowance: 0,
        members: {}
      }
    }
    deptMap[department].records.push(formatRecord(record))
    deptMap[department].totalWorkload += toNumber(record.workload)
    deptMap[department].totalAllowance += toNumber(record.allowance)
    deptMap[department].members[record.memberName] = true
  })

  const groups = Object.keys(deptMap).map(key => {
    const group = deptMap[key]
    group.records.sort((a, b) => String(a.memberName).localeCompare(String(b.memberName)))
    return {
      department: group.department,
      records: group.records,
      totalWorkload: group.totalWorkload.toFixed(1),
      totalAllowance: group.totalAllowance.toFixed(0),
      memberCount: Object.keys(group.members).length
    }
  }).sort((a, b) => String(a.department).localeCompare(String(b.department)))

  return { groups }
}

function canViewRecord(user, openid, record) {
  if (user.role === 'admin') {
    return true
  }
  if (user.role === 'minister') {
    return record.department === user.department
  }
  return record.memberOpenid === openid || (
    record.memberName === user.name && record.department === user.department
  )
}

function canOperateRecord(user, openid, record) {
  if (user.role === 'admin') {
    return true
  }
  if (user.role === 'minister') {
    return record.department === user.department
  }
  return false
}

function canEditRecord(user, openid, record) {
  if (canOperateRecord(user, openid, record)) {
    return true
  }
  return user.role === 'member' && canViewRecord(user, openid, record)
}

function buildRecordUpdateData(event, user, openid, record) {
  const now = new Date()
  const workType = normalizeWorkType(event.workType || record.workType, record.department)
  const baseData = {
    workType,
    workTypes: [workType],
    workContent: trim(event.workContent),
    workload: toNumber(event.workload),
    remark: trim(event.remark),
    updateTime: now
  }

  if (user.role === 'member') {
    return Object.assign({}, baseData, {
      memberOpenid: record.memberOpenid || openid,
      uploadedBy: user.name,
      uploaderOpenid: openid,
      submittedByRole: 'member',
      allowance: toNumber(record.allowance),
      allowanceStatus: 'pending'
    })
  }

  return Object.assign({}, baseData, {
    allowance: toNumber(event.allowance),
    allowanceStatus: 'set',
    uploadedBy: user.name,
    uploaderOpenid: openid,
    submittedByRole: user.role
  })
}

function requireAdmin(user) {
  if (!user || user.role !== 'admin') {
    throw new Error('需要管理员权限')
  }
}

function buildUserInfo(user, token, tokenExpireAt) {
  const department = user.role === 'admin' ? '' : (user.department || '')
  return {
    _id: user._id,
    openid: user.sessionOpenid || user.openid || '',
    name: user.name || '',
    role: user.role || 'member',
    department,
    token: token || user.token || '',
    tokenExpireAt: getTime(tokenExpireAt || user.tokenExpireAt) || 0,
    wechatBound: !user.temporarySession && !user.isTestAccount && !!(user.openid || user.wechatBound),
    temporarySession: !!user.temporarySession,
    isTestAccount: !!user.isTestAccount
  }
}

function sanitizeWxProfile(profile) {
  if (!profile) {
    return null
  }
  const userInfo = profile.userInfo || profile
  if (!userInfo || typeof userInfo !== 'object') {
    return null
  }
  return {
    nickName: trim(userInfo.nickName),
    avatarUrl: trim(userInfo.avatarUrl),
    gender: toNumber(userInfo.gender),
    country: trim(userInfo.country),
    province: trim(userInfo.province),
    city: trim(userInfo.city),
    language: trim(userInfo.language)
  }
}

function isSessionExpired(user) {
  const expireAt = getTime(user && user.tokenExpireAt)
  return !expireAt || expireAt <= Date.now()
}

function formatRecord(record) {
  const workTypes = getWorkTypesFromRecord(record)
  return {
    _id: record._id,
    memberId: record.memberId || '',
    memberName: record.memberName || '',
    memberOpenid: record.memberOpenid || '',
    department: record.department || '',
    week: record.week || '',
    workType: normalizeWorkType(record.workType, record.department),
    workTypeLabel: workTypes.join('、'),
    workTypes,
    workContent: record.workContent || '',
    workload: toNumber(record.workload),
    allowance: toNumber(record.allowance),
    allowanceStatus: record.allowanceStatus || (toNumber(record.allowance) > 0 ? 'set' : 'pending'),
    allowanceStatusLabel: (record.allowanceStatus || (toNumber(record.allowance) > 0 ? 'set' : 'pending')) === 'set' ? '已填写津贴' : '待部长填写',
    remark: record.remark || '',
    uploadedBy: record.uploadedBy || '',
    uploaderOpenid: record.uploaderOpenid || '',
    _createTime: record.createTime || '',
    _updateTime: record.updateTime || ''
  }
}

function formatMember(member) {
  return {
    _id: member._id,
    name: member.name || '',
    department: member.department || '',
    role: member.role || 'member',
    openid: member.openid || ''
  }
}

function formatUserForManage(user) {
  return {
    _id: user._id,
    openid: user.openid || '',
    name: user.name || '',
    role: user.role || 'member',
    department: user.department || '',
    hasPassword: !!(user.passwordHash || user.password),
    wechatBound: !user.isTestAccount && !!user.openid,
    tokenExpireAt: getTime(user.tokenExpireAt) || 0,
    lastLoginTime: formatDateTime(user.lastLoginTime),
    isTestAccount: !!user.isTestAccount
  }
}

function formatContact(contact) {
  return {
    _id: contact._id,
    name: contact.name || '',
    department: contact.department || '',
    phone: contact.phone || '',
    email: contact.email || '',
    wechatId: contact.wechatId || '',
    qq: contact.qq || '',
    createdBy: contact.createdBy || '',
    createTime: formatDateTime(contact.createTime),
    updateTime: formatDateTime(contact.updateTime)
  }
}

function formatSuggestion(suggestion) {
  return {
    _id: suggestion._id,
    title: suggestion.title || '',
    description: suggestion.description || '',
    submitterName: suggestion.submitterName || '',
    submitterOpenid: suggestion.submitterOpenid || '',
    status: suggestion.status || 'pending',
    voteId: suggestion.voteId || '',
    createTime: formatDateTime(suggestion.createTime),
    updateTime: formatDateTime(suggestion.updateTime)
  }
}

function formatVote(vote) {
  return {
    _id: vote._id,
    suggestionId: vote.suggestionId || '',
    title: vote.title || '',
    options: getVoteOptions(vote),
    deadline: vote.deadline || '',
    status: vote.status || 'active',
    createTime: formatDateTime(vote.createTime),
    updateTime: formatDateTime(vote.updateTime)
  }
}

function formatHandoff(handoff, user, openid) {
  const status = handoff.status || 'submitted'
  return {
    _id: handoff._id,
    title: handoff.title || '',
    articleNames: handoff.articleNames || '',
    targetSites: handoff.targetSites || '',
    articleType: normalizeArticleType(handoff.articleType),
    articleTypeLabel: getArticleTypeLabel(handoff.articleType),
    note: handoff.note || '',
    sourceDepartment: handoff.sourceDepartment || '采编部',
    targetDepartment: handoff.targetDepartment || '办公部',
    submitterName: handoff.submitterName || '',
    assigneeName: handoff.assigneeName || '',
    assignedBy: handoff.assignedBy || '',
    syncResult: handoff.syncResult || '',
    reviewComment: handoff.reviewComment || '',
    reviewerName: handoff.reviewerName || '',
    workloadSettled: !!handoff.workloadSettled,
    settledRecords: handoff.settledRecords || [],
    status,
    statusLabel: HANDOFF_STATUS_LABELS[status] || handoff.statusLabel || '',
    canAssign: ['submitted', 'rejected'].includes(status) && canAssignHandoff(user, handoff),
    canComplete: ['assigned', 'rejected'].includes(status) && canCompleteHandoff(user, openid, handoff),
    canReview: status === 'completed' && user.role === 'admin',
    createTime: formatDateTime(handoff.createTime),
    updateTime: formatDateTime(handoff.updateTime),
    assignedTime: formatDateTime(handoff.assignedTime),
    completedTime: formatDateTime(handoff.completedTime),
    reviewedTime: formatDateTime(handoff.reviewedTime),
    archivedTime: formatDateTime(handoff.archivedTime),
    deadline: handoff.deadline || '',
    deadlineReminderSent: !!handoff.deadlineReminderSent,
    deadlineExpiredSent: !!handoff.deadlineExpiredSent
  }
}

function formatNotification(notification) {
  return {
    _id: notification._id,
    title: notification.title || '',
    content: notification.content || '',
    type: notification.type || 'general',
    targetDept: notification.targetDept || '',
    createTime: formatDateTime(notification.createTime)
  }
}

function sortByCreateTimeDesc(a, b) {
  return getTime(b.createTime) - getTime(a.createTime)
}

function sortByUpdateTimeDesc(a, b) {
  return getTime(b.updateTime || b.createTime) - getTime(a.updateTime || a.createTime)
}

function sortByDepartmentAndName(a, b) {
  const byDept = String(a.department || '').localeCompare(String(b.department || ''))
  if (byDept !== 0) return byDept
  return String(a.name || '').localeCompare(String(b.name || ''))
}

function sortUsers(a, b) {
  const leftRole = Object.prototype.hasOwnProperty.call(ROLE_ORDER, a.role) ? ROLE_ORDER[a.role] : 9
  const rightRole = Object.prototype.hasOwnProperty.call(ROLE_ORDER, b.role) ? ROLE_ORDER[b.role] : 9
  const roleDiff = leftRole - rightRole
  if (roleDiff !== 0) return roleDiff
  return String(a.name || '').localeCompare(String(b.name || ''))
}

function getTime(value) {
  if (!value) return 0
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function getCurrentWeekLabel(date) {
  date = date || new Date()
  const year = date.getFullYear()
  const startDate = new Date(year, 0, 1)
  const firstDayWeek = startDate.getDay() === 0 ? 7 : startDate.getDay()
  const diffDays = Math.floor((date - startDate) / (1000 * 60 * 60 * 24))
  const week = Math.ceil((diffDays + firstDayWeek) / 7)
  return `${year}-第${String(week).padStart(2, '0')}周`
}

function getVoteOptions(vote) {
  if (Array.isArray(vote.options)) {
    return vote.options
  }
  return String(vote.options || '').split('|').map(item => trim(item)).filter(Boolean)
}

function first(res) {
  return res && res.data && res.data.length > 0 ? res.data[0] : null
}

function trim(value) {
  return value === undefined || value === null ? '' : String(value).trim()
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sum(list, field) {
  return list.reduce((total, item) => total + toNumber(item[field]), 0)
}

function unique(list) {
  const map = {}
  list.forEach(item => {
    if (item) map[item] = true
  })
  return Object.keys(map)
}

function mergeUnique() {
  const merged = []
  for (let i = 0; i < arguments.length; i++) {
    const list = arguments[i] || []
    list.forEach(item => {
      const value = trim(item)
      if (value && !merged.includes(value)) {
        merged.push(value)
      }
    })
  }
  return merged
}

function normalizeWorkType(value, department) {
  const type = trim(value)
  if (WORK_TYPES.includes(type)) {
    return type
  }
  return DEPARTMENT_DEFAULT_WORK_TYPE[department] || DEFAULT_WORK_TYPE
}

function normalizeArticleType(value) {
  return trim(value) === 'reprint' ? 'reprint' : 'original'
}

function getArticleTypeLabel(value) {
  return normalizeArticleType(value) === 'reprint' ? '转载稿件' : '原创稿件'
}

function getWorkTypesFromRecord(record) {
  if (Array.isArray(record.workTypes) && record.workTypes.length > 0) {
    return record.workTypes.map(type => normalizeWorkType(type, record.department))
  }
  return [normalizeWorkType(record.workType, record.department)]
}

function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return mergeUnique(value)
  }
  const single = trim(value)
  return single ? [single] : []
}

function appendUniqueLine(current, addition) {
  const base = trim(current)
  const line = trim(addition)
  if (!line) {
    return base
  }
  if (!base) {
    return line
  }
  const parts = base.split('\n').map(item => trim(item)).filter(Boolean)
  if (parts.includes(line)) {
    return base
  }
  return base + '\n' + line
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex') + Date.now().toString(36)
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex')
}

function passwordMatches(user, password, passwordHash) {
  if (user.passwordHash) {
    return user.passwordHash === passwordHash
  }
  return user.password === password
}

function getUpdatedCount(res) {
  return res && res.stats ? res.stats.updated || 0 : 0
}

function getRemovedCount(res) {
  return res && res.stats ? res.stats.removed || 0 : 0
}

function success(data) {
  return { code: 0, data }
}

function fail(message) {
  return { code: -1, message }
}
