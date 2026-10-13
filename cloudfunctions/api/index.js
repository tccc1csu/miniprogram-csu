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
  HANDOFFS: 'handoffs',
  ALLOWANCE_RULES: 'allowance_rules',
  WORKFLOW_RESPONSIBILITIES: 'workflow_responsibilities',
  NOTIFICATION_SETTINGS: 'notification_settings',
  NOTIFICATION_SUBSCRIPTIONS: 'notification_subscriptions',
  PROJECT_TASKS: 'project_tasks',
  FILES: 'files'
}

const DEFAULT_DEPARTMENTS = [
  '办公部',
  '采编部',
  '美编部',
  '摄制部',
  '运营部',
  '原创部',
  '兄弟部门'
]
const BROTHER_DEPARTMENT = '兄弟部门'
// 管理员注册邀请码。请替换为你自己的邀请码，不要沿用示例值。
// 更安全的做法是通过云函数环境变量注入，详见 HANDOVER.md 的「可选加固建议」。
const ADMIN_INVITE_CODE = 'YOUR_ADMIN_INVITE_CODE' // 管理员注册邀请码

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
const DEMO_SEED_TAG = 'demo-2026-09-08'
const WORK_TYPES = ['稿件写作', '视频制作', '美编设计', '日常办公']
const DEFAULT_WORK_TYPE = '日常办公'
const DEPARTMENT_DEFAULT_WORK_TYPE = {
  '采编部': '稿件写作',
  '原创部': '稿件写作',
  '摄制部': '视频制作',
  '美编部': '美编设计',
  '办公部': '日常办公',
  '运营部': '日常办公',
  '兄弟部门': '日常办公'
}

const TEST_ACCOUNTS = [
  { name: '测试管理员', role: 'admin', department: '' },
  { name: '管理员老师', role: 'admin', department: '' },
  { name: '采编部长', role: 'minister', department: '采编部' },
  { name: '采编干事', role: 'member', department: '采编部' },
  { name: '办公部长', role: 'minister', department: '办公部' },
  { name: '摄制部长', role: 'minister', department: '摄制部' },
  { name: '摄制干事', role: 'member', department: '摄制部' },
  { name: '美编部长', role: 'minister', department: '美编部' },
  { name: '赵六', role: 'member', department: '办公部' },
  { name: '钱七', role: 'member', department: '办公部' },
  { name: '张三', role: 'member', department: '采编部' },
  { name: '李四', role: 'member', department: '美编部' },
  { name: '王五', role: 'member', department: '摄制部' },
  { name: '兄弟部门成员', role: 'member', department: BROTHER_DEPARTMENT }
]

const HANDOFF_STATUS_LABELS = {
  submitted: '待办公部派发',
  assigned: '待干事同步',
  completed: '待管理员审核',
  archive_assigned: '待办公部归档',
  rejected: '审核退回',
  archived: '已归档'
}

const ALLOWANCE_SETTINGS_KEY = '__settings__'
const COLLECTION_STRUCTURE_KEY = '__collection_structure_20260909__'

// 自动归档规则只定义工时；工资在导出时按部门时薪即时计算。
const DEFAULT_ALLOWANCE_RULES = [
  { key: 'editorial_news_creator', name: '新闻稿创作', department: '采编部', role: '创作者', workType: '稿件写作', unit: '篇', hours: 5 },
  { key: 'editorial_news_reviewer', name: '新闻稿审核', department: '采编部', role: '审核', workType: '稿件写作', unit: '篇', hours: 2 },
  { key: 'editorial_book_creator', name: '书推创作', department: '采编部', role: '创作者', workType: '稿件写作', unit: '篇', hours: 4 },
  { key: 'editorial_book_reviewer', name: '书推审核', department: '采编部', role: '审核', workType: '稿件写作', unit: '篇', hours: 3 },
  { key: 'editorial_interview_reviewer', name: '人物专访审核', department: '采编部', role: '审核', workType: '稿件写作', unit: '篇', hours: 2.5 },
  { key: 'editorial_video_creator', name: '视频制作', department: '采编部', role: '创作者', workType: '视频制作', unit: '篇', hours: 4 },
  { key: 'editorial_record_creator', name: '纪录时刻创作', department: '采编部', role: '创作者', workType: '稿件写作', unit: '篇', hours: 4 },
  { key: 'editorial_record_reviewer', name: '纪录时刻审核', department: '采编部', role: '审核', workType: '稿件写作', unit: '篇', hours: 3 },
  { key: 'design_basic', name: '美编基础设计', department: '美编部', role: '创作者', workType: '美编设计', unit: '篇', hours: 3 },
  { key: 'design_complex', name: '美编复杂设计', department: '美编部', role: '创作者', workType: '美编设计', unit: '篇', hours: 6 },
  { key: 'design_large', name: '美编大型设计', department: '美编部', role: '创作者', workType: '美编设计', unit: '篇', hours: 9 },
  { key: 'design_basic_reviewer', name: '美编基础审核', department: '美编部', role: '审核', workType: '美编设计', unit: '篇', hours: 1 },
  { key: 'design_large_reviewer', name: '美编大型审核', department: '美编部', role: '审核', workType: '美编设计', unit: '篇', hours: 2 },
  { key: 'office_activity_planner', name: '大型活动策划', department: '办公部', role: '策划负责人', workType: '日常办公', unit: '次', hours: 4 },
  { key: 'office_activity_organizer', name: '大型活动组织', department: '办公部', role: '组织者', workType: '日常办公', unit: '次', hours: 3.5 },
  { key: 'office_regular_review', name: '常规审核或归档', department: '办公部', role: '审核人员', workType: '日常办公', unit: '人次', hours: 2 },
  { key: 'office_handoff_sync', name: '采编办公对接', department: '办公部', role: '对接干事', workType: '日常办公', unit: '学期', hours: 4 },
  { key: 'production_video_member', name: '摄制任务完成', department: '摄制部', role: '摄制干事', workType: '视频制作', unit: '次', hours: 4 },
  { key: 'production_archive_review', name: '摄制任务归档', department: '办公部', role: '归档人员', workType: '日常办公', unit: '人次', hours: 2 },
  { key: 'operations_review', name: '运营稿件审核', department: '运营部', role: '审核', workType: '日常办公', unit: '次', hours: 2 }
]

const DEFAULT_WORKFLOW_RESPONSIBILITIES = [
  { key: 'editorialOfficeHandoff', name: '采编办公协同', description: '采编部报备，办公部派发与同步', departments: ['采编部', '办公部'] },
  { key: 'productionReservation', name: '摄制预约协作', description: '预约人发起，摄制部完成，办公部归档', departments: ['摄制部', '办公部', BROTHER_DEPARTMENT] },
  { key: 'activitySuggestions', name: '活动建议', description: '活动建议、投票和通知', departments: DEFAULT_DEPARTMENTS.filter(name => name !== BROTHER_DEPARTMENT) }
]

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

    // 登录必须尽快返回。演示账号和演示业务数据只能由显式初始化操作生成，
    // 不能跟随每一次账密登录执行，否则云函数冷启动时很容易超过小程序调用时限。
    if (!isLightweightAuthFunction(functionName)) {
      await ensureCollections({ seed: shouldSeedForFunction(functionName) })
    }

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

    if (functionName === 'repairCollections') {
      // 补齐缺失的集合（例如版本升级后新增的 project_tasks、files）。
      // 幂等操作，可重复调用；管理员已登录即可执行。
      return await handleRepairCollections(user)
    }
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
    if (functionName === 'manageAllowanceRules') {
      return await handleManageAllowanceRules(event, user)
    }
    if (functionName === 'manageResponsibilities') {
      return await handleManageResponsibilities(event, user)
    }
    if (functionName === 'manageTaskNotifications') {
      return await handleManageTaskNotifications(event, user, openid)
    }
    if (functionName === 'manageProjectTasks') {
      return await handleManageProjectTasks(event, user, openid)
    }
    if (functionName === 'manageFiles') {
      return await handleManageFiles(event, user, openid)
    }
    if (functionName === 'deleteMyAccount') {
      return await handleDeleteMyAccount(event, user)
    }
    if (functionName === 'resetDevelopmentData') {
      return await handleResetDevelopmentData(user)
    }
    return fail('未知云函数操作：' + functionName)
  } catch (err) {
    console.error('api error', functionName, err)
    return fail(err.message || '云函数执行失败')
  }
}

function shouldSeedForFunction(functionName) {
  return ['initCloud', 'seedTestAccounts'].includes(functionName)
}

function isLightweightAuthFunction(functionName) {
  return ['wechatLogin', 'accountLogin', 'login', 'bindWechat', 'checkSession'].includes(functionName)
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
  // 每次冷启动都要确保集合齐全：旧版本用一次性标记跳过，导致后续版本
  // 新增的集合（如 project_tasks、files）在老环境里永远不会被创建。
  // db.createCollection 对已存在的集合只会抛错，开销很小，可以安全重复执行。
  const collectionNames = Object.keys(COLLECTIONS).map(key => COLLECTIONS[key])
  await Promise.all(collectionNames.map(async name => {
    try {
      await db.createCollection(name)
    } catch (err) {
      // 集合已存在时会进入 catch，这种情况可以忽略。
    }
  }))

  // 默认数据只需初始化一次，用标记跳过。
  if (!(await hasCollectionStructureMarker())) {
    await ensureDefaultCollectionData()
  }
}

async function hasCollectionStructureMarker() {
  try {
    const marker = await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS)
      .where({ key: COLLECTION_STRUCTURE_KEY })
      .limit(1)
      .get()
    return !!first(marker)
  } catch (err) {
    return false
  }
}

async function ensureDefaultCollectionData() {
  const defaults = await Promise.all([
    getAll(COLLECTIONS.DEPARTMENTS, {}),
    getAll(COLLECTIONS.ALLOWANCE_RULES, {}),
    getAll(COLLECTIONS.WORKFLOW_RESPONSIBILITIES, {})
  ])
  await Promise.all([
    ensureDefaultDepartments(defaults[0]),
    ensureDefaultAllowanceRules(defaults[1]),
    ensureDefaultResponsibilities(defaults[2])
  ])
  await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS).add({
    data: {
      key: COLLECTION_STRUCTURE_KEY,
      recordType: 'system',
      createTime: new Date(),
      updateTime: new Date()
    }
  })
}

async function ensureDefaultDepartments(existingDepartments) {
  const existingNames = {}
  ;(existingDepartments || []).forEach(item => {
    if (item.name) existingNames[item.name] = true
  })
  const now = new Date()
  const missing = DEFAULT_DEPARTMENTS.filter(name => !existingNames[name])
  await Promise.all(missing.map(name => db.collection(COLLECTIONS.DEPARTMENTS).add({
    data: {
      name,
      createTime: now,
      updateTime: now
    }
  })))
}

async function ensureDefaultAllowanceRules(existingRows) {
  const collection = db.collection(COLLECTIONS.ALLOWANCE_RULES)
  const rows = existingRows || await getAll(COLLECTIONS.ALLOWANCE_RULES, {})
  const existingKeys = {}
  rows.forEach(item => {
    if (item.key) existingKeys[item.key] = true
  })
  const inserts = []
  if (!existingKeys[ALLOWANCE_SETTINGS_KEY]) {
    inserts.push(collection.add({
      data: {
        key: ALLOWANCE_SETTINGS_KEY,
        recordType: 'settings',
        name: '全局设置',
        urgentThresholdDays: 2,
        urgentMultiplier: 1.5,
        standardHourlyRate: 10,
        productionHourlyRate: 12,
        createTime: new Date(),
        updateTime: new Date()
      }
    }))
  }
  DEFAULT_ALLOWANCE_RULES.forEach(item => {
    if (existingKeys[item.key]) return
    inserts.push(collection.add({
      data: Object.assign({}, item, {
        recordType: 'rule',
        createTime: new Date(),
        updateTime: new Date()
      })
    }))
  })
  await Promise.all(inserts)
}

async function ensureDefaultResponsibilities(existingRows) {
  const collection = db.collection(COLLECTIONS.WORKFLOW_RESPONSIBILITIES)
  const rows = existingRows || await getAll(COLLECTIONS.WORKFLOW_RESPONSIBILITIES, {})
  const existingKeys = {}
  rows.forEach(item => {
    if (item.key) existingKeys[item.key] = true
  })
  const now = new Date()
  const inserts = DEFAULT_WORKFLOW_RESPONSIBILITIES
    .filter(item => !existingKeys[item.key])
    .map(item => collection.add({
      data: Object.assign({}, item, {
        createTime: now,
        updateTime: now
      })
    }))
  const updates = rows
    .filter(item => item.key === 'productionReservation' && Array.isArray(item.departments) && !item.departments.includes(BROTHER_DEPARTMENT))
    .map(item => collection.doc(item._id).update({
      data: {
        departments: mergeUnique(item.departments, [BROTHER_DEPARTMENT]),
        updateTime: now
      }
    }))
  await Promise.all(inserts.concat(updates))
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
  await Promise.all([
    ensureNotificationSettings(),
    ensureDemoData()
  ])
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

  // 账号密码登录只在当前设备建立会话，绝不改动已有微信绑定。
  // 这样同一台测试机可以在不同账号之间切换。
  const userInfo = await issueSession(account.user, openid, event.wxProfile, { temporary: true })
  return success(userInfo)
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

  let exist = await findUserByName(name)

  // 新环境尚未执行演示数据初始化时，允许用一个测试账号直接进入。
  // 这里只创建本次登录所需的账号及成员资料，不再同步构建整套演示数据。
  if (!exist && isDefaultTestCredential(name, password)) {
    exist = await ensureRequestedTestAccount(name)
  }

  if (!exist) {
    return { ok: false, message: '用户不存在，请先注册' }
  }

  const passwordHash = hashPassword(password)
  if (!passwordMatches(exist, password, passwordHash)) {
    return { ok: false, message: '密码错误' }
  }

  return { ok: true, user: exist }
}

async function findUserByName(name) {
  try {
    const result = await db.collection(COLLECTIONS.USERS).where({ name }).limit(1).get()
    return first(result)
  } catch (err) {
    return null
  }
}

function isDefaultTestCredential(name, password) {
  return ENABLE_TEST_ACCOUNTS && password === TEST_ACCOUNT_PASSWORD &&
    TEST_ACCOUNTS.some(account => account.name === name)
}

async function ensureRequestedTestAccount(name) {
  const account = TEST_ACCOUNTS.find(item => item.name === name)
  if (!account) return null

  try {
    await db.createCollection(COLLECTIONS.USERS)
  } catch (err) {
    // users 集合已存在时会进入 catch。
  }
  if (account.department) {
    try {
      await db.createCollection(COLLECTIONS.MEMBERS)
    } catch (err) {
      // members 集合已存在时会进入 catch。
    }
  }

  return await ensureTestAccount(account, hashPassword(TEST_ACCOUNT_PASSWORD), new Date())
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
  // 管理员注册需要邀请码
  if (role === 'admin') {
    const inviteCode = trim(event.inviteCode)
    if (!inviteCode) {
      return fail('请输入管理员邀请码')
    }
    if (inviteCode !== ADMIN_INVITE_CODE) {
      return fail('管理员邀请码错误')
    }
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

  await Promise.all(TEST_ACCOUNTS.map(account => ensureTestAccount(account, passwordHash, now, users)))
}

async function ensureTestAccount(account, passwordHash, now, usersCollection) {
  const users = usersCollection || db.collection(COLLECTIONS.USERS)
  const existRes = await users.where({ name: account.name }).limit(1).get()
  const exist = first(existRes)
  if (exist && !exist.isTestAccount) {
    return exist
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
    return Object.assign({}, exist, {
      role: account.role,
      department: account.department,
      passwordHash,
      isTestAccount: true
    })
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

  const user = {
    _id: addRes._id,
    openid: '',
    name: account.name,
    role: account.role,
    department: account.department,
    passwordHash,
    isTestAccount: true
  }
  if (account.role !== 'admin') {
    await upsertMemberForUser(user)
  }
  return user
}

async function ensureNotificationSettings() {
  const existing = await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS)
    .where({ key: '__settings__' })
    .limit(1)
    .get()
  if (first(existing)) {
    return
  }

  await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS).add({
    data: {
      key: '__settings__',
      enabled: false,
      templateId: '',
      page: 'pages/collaboration/collaboration',
      titleField: 'thing1',
      contentField: 'thing2',
      timeField: 'time3',
      createTime: new Date(),
      updateTime: new Date()
    }
  })
}

async function ensureDemoData() {
  if (!ENABLE_DEMO_DATA) {
    return
  }

  await Promise.all([
    ensureDemoWorkRecords(),
    ensureDemoHandoffs()
  ])
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
      uploadedBy: '采编部长'
    },
    {
      memberName: '采编部长',
      department: '采编部',
      week,
      workType: '稿件写作',
      workContent: '统筹民族文化交融专题采写，协调图片素材与终稿审核',
      workload: 4,
      uploadedBy: '采编部长'
    },
    {
      memberName: '赵六',
      department: '办公部',
      week,
      workType: '日常办公',
      workContent: '同步求职经验分享稿件至院网，整理反馈截图',
      workload: 2,
      uploadedBy: '赵六'
    },
    {
      memberName: '钱七',
      department: '办公部',
      week,
      workType: '日常办公',
      workContent: '整理升华网投稿格式并完成后台提交',
      workload: 1.5,
      uploadedBy: '办公部长'
    },
    {
      memberName: '李四',
      department: '美编部',
      week,
      workType: '美编设计',
      workContent: '制作活动推文头图和新闻配图两套',
      workload: 3,
      uploadedBy: '美编部长'
    }
  ]

  const members = await getAll(COLLECTIONS.MEMBERS, {})
  const memberByNameAndDepartment = {}
  members.forEach(member => {
    memberByNameAndDepartment[member.name + '|' + member.department] = member
  })

  await Promise.all(rows.map((row, index) => {
    const workType = normalizeWorkType(row.workType)
    const member = memberByNameAndDepartment[row.memberName + '|' + row.department]
    return db.collection(COLLECTIONS.RECORDS).add({
      data: Object.assign({}, row, {
        memberId: member ? member._id : '',
        memberOpenid: member ? (member.openid || '') : '',
        workType,
        workTypes: [workType],
        uploaderOpenid: '',
        remark: '演示数据',
        seedTag: DEMO_SEED_TAG,
        createTime: new Date(now.getTime() - index * 3600 * 1000),
        updateTime: now
      })
    })
  }))
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
    },
    {
      demoKey: 'production-submitted-event-photos',
      title: '迎新活动现场拍摄',
      taskName: '迎新活动现场拍摄',
      scheduledAt: formatDateTime(new Date(now.getTime() + 30 * 3600 * 1000)),
      location: '新校区风雨球场',
      submitterContact: '13800000001',
      note: '请优先拍摄开场、互动和集体合影。',
      workflowType: 'productionReservation',
      sourceDepartment: '摄制部',
      targetDepartment: '摄制部',
      submitterName: '采编干事',
      submitterOpenid: '',
      assigneeName: '',
      assigneeOpenid: '',
      assignedBy: '',
      archiveMemberName: '',
      archiveMemberOpenid: '',
      status: 'submitted',
      statusLabel: HANDOFF_STATUS_LABELS.submitted,
      isUrgent: true,
      urgentMultiplier: 1.5,
      reminderLeadHours: 6,
      syncResult: '',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 2 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 2 * 3600 * 1000)
    },
    {
      demoKey: 'production-assigned-interview-video',
      title: '优秀学生采访视频',
      taskName: '优秀学生采访视频',
      scheduledAt: formatDateTime(new Date(now.getTime() + 4 * 24 * 3600 * 1000)),
      location: '毓秀楼 A 座 302',
      submitterContact: '13800000002',
      note: '需要横版主片和三张采访现场照片。',
      workflowType: 'productionReservation',
      sourceDepartment: '摄制部',
      targetDepartment: '摄制部',
      submitterName: '采编部长',
      submitterOpenid: '',
      assigneeName: '摄制干事',
      assigneeOpenid: '',
      assignedBy: '摄制部长',
      archiveMemberName: '',
      archiveMemberOpenid: '',
      status: 'assigned',
      statusLabel: HANDOFF_STATUS_LABELS.assigned,
      isUrgent: false,
      urgentMultiplier: 1,
      reminderLeadHours: 24,
      syncResult: '',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 6 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 3 * 3600 * 1000),
      assignedTime: new Date(now.getTime() - 3 * 3600 * 1000)
    },
    {
      demoKey: 'production-archive-assigned-forum',
      title: '青年论坛活动摄制',
      taskName: '青年论坛活动摄制',
      scheduledAt: formatDateTime(new Date(now.getTime() + 2 * 24 * 3600 * 1000)),
      location: '毓秀楼报告厅',
      submitterContact: '13800000003',
      note: '成片和原始素材均已整理。',
      workflowType: 'productionReservation',
      sourceDepartment: '摄制部',
      targetDepartment: '摄制部',
      submitterName: '办公部长',
      submitterOpenid: '',
      assigneeName: '摄制干事',
      assigneeOpenid: '',
      assignedBy: '摄制部长',
      archiveMemberName: '赵六',
      archiveMemberOpenid: '',
      status: 'archive_assigned',
      statusLabel: HANDOFF_STATUS_LABELS.archive_assigned,
      isUrgent: false,
      urgentMultiplier: 1,
      reminderLeadHours: 24,
      syncResult: '4K 成片、横版短视频和素材包均已上传共享盘。',
      reviewComment: '',
      seedTag: DEMO_SEED_TAG,
      createTime: new Date(now.getTime() - 10 * 3600 * 1000),
      updateTime: new Date(now.getTime() - 30 * 60 * 1000),
      assignedTime: new Date(now.getTime() - 8 * 3600 * 1000),
      completedTime: new Date(now.getTime() - 30 * 60 * 1000)
    }
  ]

  const existing = await getAll(COLLECTIONS.HANDOFFS, { seedTag: DEMO_SEED_TAG })
  const existingKeys = {}
  const existingTitles = {}
  existing.forEach(item => {
    if (item.demoKey) existingKeys[item.demoKey] = true
    if (item.title) existingTitles[item.title] = true
  })
  const missing = rows.filter(row => !existingKeys[row.demoKey] && !existingTitles[row.title])
  await Promise.all(missing.map(row => db.collection(COLLECTIONS.HANDOFFS).add({
    data: Object.assign({
      workflowType: 'editorialOfficeHandoff',
      reminderLeadHours: 24
    }, row)
  })))
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
    // 临时账号密码会话不能把原有的微信绑定状态覆盖成未绑定。
    wechatBound: isTemporary ? !!(user.wechatBound || user.openid) : true,
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

  const data = Object.assign({}, baseData, {
    submittedByRole: isMemberReport ? 'member' : user.role
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
  const allowanceSettings = await getAllowanceSettings()
  if (event.recordId) {
    const record = await getDoc(COLLECTIONS.RECORDS, event.recordId)
    if (!record) {
      return success(null)
    }
    if (!canViewRecord(user, openid, record)) {
      return fail('无权查看该记录')
    }
    return success(formatRecord(record, allowanceSettings))
  }

  const records = await getRecordsByRole(event, user, openid)
  records.sort(sortByCreateTimeDesc)
  return success(records.map(item => formatRecord(item, allowanceSettings)))
}

async function handleGetStatistics(event, user, openid) {
  const type = event.type
  const week = event.week
  const allowanceSettings = await getAllowanceSettings()

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
        thisWeekWorkload: sum(weekRows, 'workload').toFixed(1)
      },
      recentRecords: recent.map(item => formatRecord(item, allowanceSettings))
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
          thisWeekWorkload: sum(ownRows, 'workload').toFixed(1)
        },
        recentRecords: ownRows.slice(0, 5).map(item => formatRecord(item, allowanceSettings))
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
        thisWeekWorkload: sum(weekRows, 'workload').toFixed(1)
      },
      recentRecords: recent.map(item => formatRecord(item, allowanceSettings))
    })
  }

  if (type === 'statistics') {
    const rows = await getRecordsForStats(event, user, openid)
    return success(buildStatistics(rows))
  }

  if (type === 'weeklyTable') {
    const rows = await getRecordsForStats(event, user, openid)
    return success(buildWeeklyTable(rows, allowanceSettings))
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

async function handleManageAllowanceRules(event, user) {
  const rules = db.collection(COLLECTIONS.ALLOWANCE_RULES)
  if (event.action === 'getRules') {
    const rows = await getAll(COLLECTIONS.ALLOWANCE_RULES, {})
    rows.sort((a, b) => String(a.department || '').localeCompare(String(b.department || '')) || String(a.name || '').localeCompare(String(b.name || '')))
    const settings = rows.find(item => item.key === ALLOWANCE_SETTINGS_KEY) || {
      urgentThresholdDays: 2,
      urgentMultiplier: 1.5,
      standardHourlyRate: 10,
      productionHourlyRate: 12
    }
    return success({
      settings: {
        urgentThresholdDays: toNumber(settings.urgentThresholdDays) || 2,
        urgentMultiplier: toNumber(settings.urgentMultiplier) || 1.5,
        standardHourlyRate: toNumber(settings.standardHourlyRate) || 10,
        productionHourlyRate: toNumber(settings.productionHourlyRate) || 12
      },
      rules: rows.filter(item => item.recordType === 'rule').map(formatAllowanceRule)
    })
  }

  requireAdmin(user)
  if (event.action === 'updateSettings') {
    const settingsRes = await rules.where({ key: ALLOWANCE_SETTINGS_KEY }).limit(1).get()
    const settings = first(settingsRes)
    const thresholdText = trim(event.urgentThresholdDays)
    const multiplierText = trim(event.urgentMultiplier)
    const standardRateText = trim(event.standardHourlyRate)
    const productionRateText = trim(event.productionHourlyRate)
    const urgentThresholdDays = Number(thresholdText)
    const urgentMultiplier = Number(multiplierText)
    const standardHourlyRate = Number(standardRateText)
    const productionHourlyRate = Number(productionRateText)
    if (!settings || !thresholdText || !multiplierText || !standardRateText || !productionRateText ||
      !Number.isFinite(urgentThresholdDays) || !Number.isFinite(urgentMultiplier) ||
      !Number.isFinite(standardHourlyRate) || !Number.isFinite(productionHourlyRate) ||
      urgentThresholdDays <= 0 || urgentMultiplier <= 0 || standardHourlyRate <= 0 || productionHourlyRate <= 0) {
      return fail('加急参数和时薪必须大于0')
    }
    await rules.doc(settings._id).update({
      data: { urgentThresholdDays, urgentMultiplier, standardHourlyRate, productionHourlyRate, updateTime: new Date() }
    })
    return success({ updated: 1 })
  }

  if (event.action === 'updateRule') {
    const rule = await getDoc(COLLECTIONS.ALLOWANCE_RULES, event.ruleId)
    if (!rule || rule.recordType !== 'rule') return fail('工时规则不存在')
    const department = trim(event.department) || rule.department
    const hoursText = trim(event.hours)
    const hours = Number(hoursText)
    if (!hoursText || !Number.isFinite(hours) || hours < 0) return fail('工时必须是大于等于0的数字')
    await rules.doc(event.ruleId).update({
      data: {
        name: trim(event.name) || rule.name,
        department,
        role: trim(event.role) || rule.role,
        workType: normalizeWorkType(event.workType, department),
        unit: trim(event.unit) || rule.unit,
        hours,
        updateTime: new Date()
      }
    })
    return success({ updated: 1 })
  }

  if (event.action === 'addRule') {
    const name = trim(event.name)
    const department = trim(event.department)
    if (!name || !department) return fail('规则名称和部门不能为空')
    const hoursText = trim(event.hours)
    const hours = Number(hoursText)
    if (!hoursText || !Number.isFinite(hours) || hours < 0) return fail('工时必须是大于等于0的数字')
    const now = new Date()
    const key = 'custom_' + Date.now().toString(36)
    const res = await rules.add({
      data: {
        key,
        recordType: 'rule',
        name,
        department,
        role: trim(event.role) || '参与人员',
        workType: normalizeWorkType(event.workType, department),
        unit: trim(event.unit) || '次',
        hours,
        createTime: now,
        updateTime: now
      }
    })
    return success({ _id: res._id })
  }

  if (event.action === 'deleteRule') {
    const rule = await getDoc(COLLECTIONS.ALLOWANCE_RULES, event.ruleId)
    if (!rule || rule.recordType !== 'rule') return fail('工时规则不存在')
    const res = await rules.doc(event.ruleId).remove()
    return success({ removed: getRemovedCount(res) })
  }

  return fail('未知操作：' + event.action)
}

async function handleManageResponsibilities(event, user) {
  const collection = db.collection(COLLECTIONS.WORKFLOW_RESPONSIBILITIES)
  if (event.action === 'getResponsibilities') {
    const rows = await getAll(COLLECTIONS.WORKFLOW_RESPONSIBILITIES, {})
    return success(rows.map(formatResponsibility))
  }
  requireAdmin(user)
  if (event.action !== 'updateResponsibility') return fail('未知操作：' + event.action)
  const item = await getDoc(COLLECTIONS.WORKFLOW_RESPONSIBILITIES, event.responsibilityId)
  if (!item) return fail('协作流程不存在')
  const departments = Array.isArray(event.departments)
    ? event.departments.map(item => trim(item)).filter(Boolean)
    : []
  if (departments.length === 0) return fail('至少选择一个相关部门')
  const existingDepartments = await getAll(COLLECTIONS.DEPARTMENTS, {})
  const validDepartments = existingDepartments.map(item => trim(item.name)).filter(Boolean)
  const invalidDepartments = unique(departments).filter(name => !validDepartments.includes(name))
  if (invalidDepartments.length > 0) return fail('存在无效部门：' + invalidDepartments.join('、'))
  await collection.doc(item._id).update({
    data: { departments: unique(departments), updateTime: new Date() }
  })
  return success({ updated: 1 })
}

async function handleManageTaskNotifications(event, user, openid) {
  const action = event.action || 'getSettings'
  if (action === 'getSettings') {
    const settings = await getTaskNotificationSettings()
    const subscriptions = await getAll(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS, { userId: user._id })
    const subscription = subscriptions[0]
    return success({
      settings: formatTaskNotificationSettings(settings),
      subscription: subscription ? {
        status: subscription.status || 'unknown',
        templateId: subscription.templateId || '',
        subscribedAt: formatDateTime(subscription.subscribedAt),
        consumedAt: formatDateTime(subscription.consumedAt)
      } : null
    })
  }

  if (action === 'saveSettings') {
    requireAdmin(user)
    const now = new Date()
    const settings = await getTaskNotificationSettings()
    const updateData = {
      enabled: !!event.enabled,
      templateId: trim(event.templateId),
      page: trim(event.page) || 'pages/collaboration/collaboration',
      titleField: trim(event.titleField) || 'thing1',
      contentField: trim(event.contentField) || 'thing2',
      timeField: trim(event.timeField) || 'time3',
      updateTime: now
    }
    if (updateData.enabled && !updateData.templateId) {
      return fail('启用微信服务通知前，请先填写订阅消息模板 ID')
    }
    await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS).doc(settings._id).update({ data: updateData })
    return success({ updated: 1 })
  }

  if (action === 'setSubscription') {
    // 账号密码登录的临时会话不对应账号永久绑定的微信，不能代替该微信授权订阅。
    if (user.isTestAccount || (user.sessionOpenid && user.sessionOpenid === openid)) {
      return fail('请使用该账号已绑定的微信授权登录后开启提醒')
    }
    const settings = await getTaskNotificationSettings()
    if (!settings.enabled || !settings.templateId) {
      return fail('管理员尚未配置微信服务通知模板')
    }
    if (trim(event.templateId) !== settings.templateId) {
      return fail('订阅消息模板已更新，请刷新后重试')
    }
    const now = new Date()
    const rows = await getAll(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS, { userId: user._id })
    const data = {
      userId: user._id,
      userOpenid: user.openid || '',
      templateId: settings.templateId,
      status: event.accepted ? 'accept' : 'reject',
      subscribedAt: event.accepted ? now : null,
      updateTime: now
    }
    if (rows[0]) {
      await db.collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS).doc(rows[0]._id).update({ data })
    } else {
      await db.collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS).add({ data: Object.assign({ createTime: now }, data) })
    }
    return success({ status: data.status })
  }

  return fail('未知操作：' + action)
}

async function getTaskNotificationSettings() {
  const rows = await getAll(COLLECTIONS.NOTIFICATION_SETTINGS, { key: '__settings__' })
  const settings = rows[0]
  if (settings) return settings
  await ensureNotificationSettings()
  const retry = await getAll(COLLECTIONS.NOTIFICATION_SETTINGS, { key: '__settings__' })
  return retry[0] || {
    enabled: false,
    templateId: '',
    page: 'pages/collaboration/collaboration',
    titleField: 'thing1',
    contentField: 'thing2',
    timeField: 'time3'
  }
}

function formatTaskNotificationSettings(settings) {
  return {
    enabled: !!settings.enabled,
    templateId: settings.templateId || '',
    page: settings.page || 'pages/collaboration/collaboration',
    titleField: settings.titleField || 'thing1',
    contentField: settings.contentField || 'thing2',
    timeField: settings.timeField || 'time3'
  }
}

async function handleDeleteMyAccount(event, user) {
  const password = trim(event.password)
  const current = await getDoc(COLLECTIONS.USERS, user._id)
  if (!current || !passwordMatches(current, password, hashPassword(password))) {
    return fail('密码错误，未注销账号')
  }
  if (current.isTestAccount) {
    return fail('测试账号由演示数据自动维护，请使用“重置测试数据”重新生成')
  }

  const now = new Date()
  const clearData = { userId: '', openid: '', updateTime: now }
  await db.collection(COLLECTIONS.MEMBERS).where({ userId: user._id }).update({ data: clearData })
  await db.collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS).where({ userId: user._id }).remove()
  await db.collection(COLLECTIONS.USERS).doc(user._id).remove()
  return success({ deleted: 1 })
}

async function handleResetDevelopmentData(user) {
  requireAdmin(user)
  const clearCollections = [
    COLLECTIONS.USERS,
    COLLECTIONS.DEPARTMENTS,
    COLLECTIONS.MEMBERS,
    COLLECTIONS.RECORDS,
    COLLECTIONS.CONTACTS,
    COLLECTIONS.SUGGESTIONS,
    COLLECTIONS.VOTES,
    COLLECTIONS.VOTE_RECORDS,
    COLLECTIONS.NOTIFICATIONS,
    COLLECTIONS.HANDOFFS,
    COLLECTIONS.ALLOWANCE_RULES,
    COLLECTIONS.WORKFLOW_RESPONSIBILITIES,
    COLLECTIONS.NOTIFICATION_SETTINGS,
    COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS
  ]
  const cleared = {}
  for (const collection of clearCollections) {
    cleared[collection] = await removeAllCollectionRows(collection)
  }

  seedDataReady = false
  seedDataPromise = null
  // 集合本身保留，但基础部门、规则和职责已清空，需要重新写入默认配置。
  await doEnsureCollectionStructure()
  await doEnsureSeedData()
  seedDataReady = true
  return success({ cleared, seededAccounts: TEST_ACCOUNTS.length, demoSeedTag: DEMO_SEED_TAG })
}

async function removeAllCollectionRows(collection) {
  let removed = 0
  while (true) {
    const rows = await getAll(collection, {}, { limit: 100 })
    if (!rows.length) break
    await Promise.all(rows.map(async row => {
      await db.collection(collection).doc(row._id).remove()
    }))
    removed += rows.length
    if (rows.length < 100) break
  }
  return removed
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
        rank: trim(event.rank),
        cohort: trim(event.cohort),
        dormitory: trim(event.dormitory),
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
        rank: trim(event.rank),
        cohort: trim(event.cohort),
        dormitory: trim(event.dormitory),
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

  if (action === 'getProductionOptions') {
    const members = await getAll(COLLECTIONS.MEMBERS, { department: '办公部' })
    const allowanceSettings = await getAllowanceSettings()
    let defaultArchiveMember = ''
    if (user.department === '摄制部') {
      const currentMember = await findMember('', user.name, '摄制部')
      defaultArchiveMember = currentMember && currentMember.defaultArchiveMemberName ? currentMember.defaultArchiveMemberName : ''
    }
    return success({
      officeMembers: members.sort(sortByDepartmentAndName).map(formatMember),
      defaultArchiveMember,
      urgentThresholdDays: allowanceSettings.urgentThresholdDays,
      urgentMultiplier: allowanceSettings.urgentMultiplier
    })
  }

  if (action === 'getCreateDefaults') {
    const workflowType = normalizeWorkflowType(event.workflowType)
    if (!['editorialOfficeHandoff', 'productionReservation'].includes(workflowType)) {
      return fail('不支持的协作流程')
    }
    const rows = await getAll(COLLECTIONS.HANDOFFS, {
      workflowType,
      submitterName: user.name
    }, { field: 'createTime', direction: 'desc', limit: 20 })
    const previous = rows.find(item => {
      if (item.submitterUserId) return item.submitterUserId === user._id
      return user.isTestAccount || item.submitterOpenid === openid || !item.submitterOpenid
    })
    return success(buildCreateDefaults(workflowType, previous))
  }

  if (action === 'getHandoffs') {
    const scope = event.scope || 'active'
    const workflowType = normalizeWorkflowType(event.workflowType)
    const rows = await getVisibleHandoffs(user, openid, scope, event.departmentFilter, workflowType)
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
    const reviewerNames = normalizeNameList(event.reviewerNames)
    const reminderLeadHours = normalizeReminderLeadHours(event.reminderLeadHours)
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
        workflowType: 'editorialOfficeHandoff',
        reviewerNames,
        note: trim(event.note),
        deadline: trim(event.deadline) || '',
        reminderLeadHours,
        sourceDepartment: '采编部',
        targetDepartment: '办公部',
        submitterUserId: user._id,
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
      targetDept: '办公部',
      page: getHandoffNotificationPage('editorialOfficeHandoff', addRes._id),
      recipientSpecs: [{ role: 'minister', department: '办公部' }]
    })
    return success({ _id: addRes._id, defaults: buildCreateDefaults('editorialOfficeHandoff', {
      title,
      articleNames,
      articleType,
      targetSites,
      reviewerNames,
      note: trim(event.note),
      deadline: trim(event.deadline),
      reminderLeadHours
    }) })
  }

  if (action === 'createProductionReservation') {
    const taskName = trim(event.taskName)
    const scheduledAt = trim(event.scheduledAt)
    const location = trim(event.location)
    const submitterContact = trim(event.submitterContact)
    const reminderLeadHours = normalizeReminderLeadHours(event.reminderLeadHours)
    if (!taskName || !scheduledAt || !location || !submitterContact) return fail('请填写任务名称、预约时间、地点和联系方式')
    const scheduledDate = parseProductionDateTime(scheduledAt)
    if (isNaN(scheduledDate.getTime())) return fail('预约时间格式无效')
    const now = new Date()
    if (scheduledDate.getTime() <= now.getTime()) return fail('预约时间必须晚于当前时间')
    const settings = await getAllowanceSettings()
    const urgent = scheduledDate.getTime() - now.getTime() < settings.urgentThresholdDays * 24 * 60 * 60 * 1000
    const addRes = await handoffs.add({
      data: {
        title: taskName,
        taskName,
        scheduledAt,
        location,
        submitterContact,
        note: trim(event.note),
        reminderLeadHours,
        workflowType: 'productionReservation',
        sourceDepartment: user.department || '摄制部',
        targetDepartment: '摄制部',
        submitterUserId: user._id,
        submitterName: user.name,
        submitterOpenid: openid,
        assigneeName: '',
        assigneeOpenid: '',
        assignedBy: '',
        archiveMemberName: '',
        archiveMemberOpenid: '',
        status: 'submitted',
        statusLabel: HANDOFF_STATUS_LABELS.submitted,
        isUrgent: urgent,
        urgentMultiplier: urgent ? settings.urgentMultiplier : 1,
        syncResult: '',
        reviewComment: '',
        createTime: now,
        updateTime: now
      }
    })
    await addWorkflowNotification({
      title: '新的摄制预约',
      content: taskName + ' 已提交给摄制部部长，请安排干事。',
      targetDept: '摄制部',
      page: getHandoffNotificationPage('productionReservation', addRes._id),
      recipientSpecs: [{ role: 'minister', department: '摄制部' }]
    })
    return success({ _id: addRes._id, isUrgent: urgent, defaults: buildCreateDefaults('productionReservation', {
      taskName,
      scheduledAt,
      location,
      submitterContact,
      reminderLeadHours,
      note: trim(event.note)
    }) })
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
    const targetDepartment = handoff.workflowType === 'productionReservation' ? '摄制部' : handoff.targetDepartment
    const assignee = await findMember('', assigneeName, targetDepartment)
    if (!assignee) return fail('请选择有效的本部门干事')
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
      title: handoff.workflowType === 'productionReservation' ? '摄制部任务已派发' : '办公部任务已派发',
      content: handoff.title + ' 已派发给 ' + assigneeName + '。',
      targetDept: targetDepartment,
      page: getHandoffNotificationPage(handoff.workflowType, handoff._id),
      recipientSpecs: [{ name: assigneeName, department: targetDepartment }]
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
    if (handoff.workflowType === 'productionReservation') {
      const archiveMemberName = trim(event.archiveMemberName)
      const archiveMember = await findMember('', archiveMemberName, '办公部')
      const productionMember = await findMember('', user.name, '摄制部')
      const selectedArchiveMember = archiveMember || (productionMember && productionMember.defaultArchiveMemberName
        ? await findMember('', productionMember.defaultArchiveMemberName, '办公部')
        : null)
      if (!selectedArchiveMember) return fail('请选择负责归档的办公部成员')
      if (productionMember && archiveMember) {
        await db.collection(COLLECTIONS.MEMBERS).doc(productionMember._id).update({
          data: {
            defaultArchiveMemberName: archiveMember.name,
            defaultArchiveMemberOpenid: archiveMember.openid || '',
            updateTime: now
          }
        })
      }
      await handoffs.doc(event.handoffId).update({
        data: {
          syncResult,
          completedBy: user.name,
          archiveMemberName: selectedArchiveMember.name,
          archiveMemberOpenid: selectedArchiveMember.openid || '',
          status: 'archive_assigned',
          statusLabel: HANDOFF_STATUS_LABELS.archive_assigned,
          completedTime: now,
          updateTime: now
        }
      })
      await addWorkflowNotification({
        title: '摄制任务待归档',
        content: handoff.title + ' 已完成，请 ' + selectedArchiveMember.name + ' 负责归档。',
        targetDept: '办公部',
        page: getHandoffNotificationPage(handoff.workflowType, handoff._id),
        recipientSpecs: [{ name: selectedArchiveMember.name, department: '办公部' }]
      })
      return success({ updated: 1, archiveMemberName: selectedArchiveMember.name })
    }
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
      targetDept: '',
      page: getHandoffNotificationPage(handoff.workflowType, handoff._id),
      recipientSpecs: [{ role: 'admin' }]
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
      targetDept: approved ? '采编部' : '办公部',
      page: getHandoffNotificationPage(handoff.workflowType, handoff._id),
      // 审核退回后，下一个需要处理任务的是办公部部长。
      recipientSpecs: approved ? [] : [{ role: 'minister', department: '办公部' }]
    })
    return success({ updated: 1, archived: approved })
  }

  if (action === 'archiveProductionTask') {
    const handoff = await getDoc(COLLECTIONS.HANDOFFS, event.handoffId)
    if (!handoff || handoff.workflowType !== 'productionReservation') return fail('摄制预约不存在')
    if (handoff.status !== 'archive_assigned') return fail('当前状态不能归档')
    if (user.role !== 'admin' && !(user.department === '办公部' && (handoff.archiveMemberName === user.name || handoff.archiveMemberOpenid === openid))) {
      return fail('只有指定办公部成员或管理员可以归档')
    }
    const archiveNote = trim(event.archiveNote)
    const now = new Date()
    const settledRecords = await settleProductionWorkload(event.handoffId, handoff, now, user, openid, archiveNote)
    await handoffs.doc(event.handoffId).update({
      data: {
        archiveNote,
        status: 'archived',
        statusLabel: HANDOFF_STATUS_LABELS.archived,
        reviewerName: user.name,
        reviewedTime: now,
        archivedTime: now,
        workloadSettled: true,
        settledRecords,
        updateTime: now
      }
    })
    await addWorkflowNotification({
      title: '摄制预约已归档',
      content: handoff.title + ' 已归档，相关工作量已自动写入统计。',
      targetDept: ''
    })
    return success({ updated: 1, archived: true })
  }

  if (action === 'checkDeadlines') {
    requireAdmin(user)
    return await checkDeadlinesInternal()
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
    if (['archived', 'rejected'].includes(item.status)) continue

    const dueDate = getHandoffDueDate(item)
    if (isNaN(dueDate.getTime())) continue
    const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    const reminderLeadHours = normalizeReminderLeadHours(item.reminderLeadHours)
    const recipient = getCurrentHandoffRecipient(item)

    if (reminderLeadHours > 0 && diffHours > 0 && diffHours <= reminderLeadHours && !item.deadlineReminderSent) {
      await addWorkflowNotification({
        title: '任务即将到期提醒',
        content: '「' + item.title + '」将在 ' + Math.ceil(diffHours) + ' 小时后到期，请尽快处理。',
        targetDept: recipient.department,
        page: getHandoffNotificationPage(item.workflowType, item._id),
        recipientSpecs: recipient.specs
      })
      await handoffs.doc(item._id).update({
        data: { deadlineReminderSent: true, updateTime: now }
      })
      reminders.push(item._id)
    }

    if (diffHours <= 0 && !item.deadlineExpiredSent) {
      await addWorkflowNotification({
        title: '任务已过期提醒',
        content: '「' + item.title + '」已超过截止日期，请尽快处理。',
        targetDept: recipient.department,
        page: getHandoffNotificationPage(item.workflowType, item._id),
        recipientSpecs: recipient.specs
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
  const quantity = countWorkUnits(articleNames)
  const rules = await getAllowanceRules()
  const settled = []

  if (articleType === 'original' && trim(handoff.submitterName)) {
    const creatorRule = findAllowanceRule(rules, 'editorial_news_creator', '采编部', '稿件写作')
    const creatorQuantity = getRuleQuantity(creatorRule, quantity)
    const editorialRecord = await upsertWorkflowWorkloadRecord({
      sourceHandoffId: handoffId,
      memberName: trim(handoff.submitterName),
      memberOpenid: trim(handoff.submitterOpenid),
      department: '采编部',
      workType: creatorRule ? creatorRule.workType : '稿件写作',
      workload: (creatorRule ? creatorRule.hours : 5) * creatorQuantity,
      content: '稿件写作：' + articleNames,
      remark: '采编办公协同归档自动核算，可由部长调整',
      now,
      reviewer,
      reviewerOpenid
    })
    settled.push(editorialRecord)
  }

  if (trim(handoff.assigneeName)) {
    const syncRule = findAllowanceRule(rules, 'office_handoff_sync', '办公部', '日常办公')
    const syncUnit = syncRule ? trim(syncRule.unit) : '学期'
    const syncSourceId = syncUnit === '学期'
      ? 'allowance:office_handoff_sync:' + getCurrentSemesterLabel(now)
      : handoffId
    const alreadySettled = syncUnit === '学期' && await hasWorkflowSource(
      trim(handoff.assigneeName),
      '办公部',
      syncSourceId
    )
    if (!alreadySettled) {
      const syncQuantity = getRuleQuantity(syncRule, quantity)
      const officeRecord = await upsertWorkflowWorkloadRecord({
        sourceHandoffId: syncSourceId,
        memberName: trim(handoff.assigneeName),
        memberOpenid: trim(handoff.assigneeOpenid),
        department: '办公部',
        workType: syncRule ? syncRule.workType : '日常办公',
        workload: (syncRule ? syncRule.hours : 4) * syncQuantity,
        content: '稿件同步：' + articleNames + (handoff.targetSites ? '（' + handoff.targetSites + '）' : ''),
        remark: syncUnit === '学期'
          ? '采编办公协同对接按学期自动核算，可由部长调整'
          : '采编办公协同归档自动核算，可由部长调整',
        now,
        reviewer,
        reviewerOpenid
      })
      settled.push(officeRecord)
    }
  }

  const reviewerNames = normalizeNameList(handoff.reviewerNames)
  const reviewerRule = findAllowanceRule(rules, 'office_regular_review', '办公部', '日常办公')
  for (let i = 0; i < reviewerNames.length; i++) {
    const member = await findMemberByName(reviewerNames[i])
    const department = member && member.department ? member.department : '采编部'
    const reviewRecord = await upsertWorkflowWorkloadRecord({
      sourceHandoffId: handoffId + ':review:' + i,
      memberName: reviewerNames[i],
      memberOpenid: member ? (member.openid || '') : '',
      department,
      workType: reviewerRule ? reviewerRule.workType : '日常办公',
      workload: reviewerRule ? reviewerRule.hours : 2,
      content: '稿件审核：' + articleNames,
      remark: '采编办公协同归档自动核算，可由部长调整',
      now,
      reviewer,
      reviewerOpenid
    })
    settled.push(reviewRecord)
  }

  return settled
}

async function settleProductionWorkload(handoffId, handoff, now, reviewer, reviewerOpenid, archiveNote) {
  const rules = await getAllowanceRules()
  const multiplier = toNumber(handoff.urgentMultiplier) || 1
  const productionRule = findAllowanceRule(rules, 'production_video_member', '摄制部', '视频制作')
  const archiveRule = findAllowanceRule(rules, 'production_archive_review', '办公部', '日常办公')
  const settled = []
  if (trim(handoff.assigneeName)) {
    settled.push(await upsertWorkflowWorkloadRecord({
      sourceHandoffId: handoffId,
      memberName: handoff.assigneeName,
      memberOpenid: handoff.assigneeOpenid,
      department: '摄制部',
      workType: productionRule ? productionRule.workType : '视频制作',
      workload: (productionRule ? productionRule.hours : 4) * multiplier,
      content: '摄制任务：' + (handoff.taskName || handoff.title),
      remark: (handoff.isUrgent ? '加急任务，工时按 ' + multiplier + ' 倍计算；' : '') + (archiveNote || '预约任务归档自动核算，可由部长调整'),
      now,
      reviewer,
      reviewerOpenid
    }))
  }
  if (trim(handoff.archiveMemberName)) {
    settled.push(await upsertWorkflowWorkloadRecord({
      sourceHandoffId: handoffId + ':archive',
      memberName: handoff.archiveMemberName,
      memberOpenid: handoff.archiveMemberOpenid,
      department: '办公部',
      workType: archiveRule ? archiveRule.workType : '日常办公',
      workload: (archiveRule ? archiveRule.hours : 2) * multiplier,
      content: '摄制任务归档：' + (handoff.taskName || handoff.title),
      remark: (handoff.isUrgent ? '加急任务，工时按 ' + multiplier + ' 倍计算；' : '') + '预约任务归档自动核算，可由部长调整',
      now,
      reviewer,
      reviewerOpenid
    }))
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
  if (!Object.values(COLLECTIONS).includes(collection) || [
    COLLECTIONS.NOTIFICATION_SETTINGS,
    COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS
  ].includes(collection)) {
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

async function getVisibleHandoffs(user, openid, scope, departmentFilter, workflowType) {
  const rows = await getAll(COLLECTIONS.HANDOFFS, {})
  const responsibilities = await getAll(COLLECTIONS.WORKFLOW_RESPONSIBILITIES, {})
  const responsibilityMap = {}
  responsibilities.forEach(item => { responsibilityMap[item.key] = item })
  return rows.filter(item => {
    const workflowKey = item.workflowType || 'editorialOfficeHandoff'
    if (workflowType && workflowKey !== workflowType) {
      return false
    }
    if (scope === 'archive' && item.status !== 'archived') {
      return false
    }
    if (scope !== 'archive' && item.status === 'archived') {
      return false
    }
    const responsibility = responsibilityMap[workflowKey]
    const departmentRelated = !responsibility || (responsibility.departments || []).includes(user.department)
    if (departmentFilter === 'mine' && user.role !== 'admin' && !departmentRelated) {
      return false
    }
    // 兄弟部门是外部协作方，只能查看自己发起的摄制预约及其后续流转。
    if (user.department === BROTHER_DEPARTMENT) {
      return workflowKey === 'productionReservation' && (
        item.submitterUserId === user._id ||
        item.submitterOpenid === openid ||
        item.submitterName === user.name
      )
    }
    if (scope === 'mine') {
      const needsAssignment = ['submitted', 'rejected'].includes(item.status) && canAssignHandoff(user, item)
      const needsCompletion = ['assigned', 'rejected'].includes(item.status) && canCompleteHandoff(user, openid, item)
      const needsArchive = item.status === 'archive_assigned' && item.workflowType === 'productionReservation' &&
        (user.role === 'admin' || (user.department === '办公部' &&
          (item.archiveMemberName === user.name || item.archiveMemberOpenid === openid)))
      const needsReview = item.status === 'completed' && user.role === 'admin'
      return needsAssignment || needsCompletion || needsArchive || needsReview ||
        item.submitterOpenid === openid ||
        item.assigneeOpenid === openid ||
        item.submitterName === user.name ||
        item.assigneeName === user.name ||
        item.archiveMemberName === user.name ||
        item.archiveMemberOpenid === openid
    }
    if (user.role === 'admin') {
      return true
    }
    if (departmentRelated && (user.department === item.sourceDepartment || user.department === item.targetDepartment ||
      (responsibility && (responsibility.departments || []).includes(user.department)))) {
      return true
    }
    return item.submitterOpenid === openid || item.assigneeOpenid === openid ||
      item.archiveMemberName === user.name || item.archiveMemberOpenid === openid
  })
}

function getHandoffDueDate(handoff) {
  if ((handoff.workflowType || 'editorialOfficeHandoff') === 'productionReservation') {
    return parseProductionDateTime(handoff.scheduledAt)
  }
  const deadline = trim(handoff.deadline)
  if (!deadline) return new Date(NaN)
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(deadline)) {
    return new Date(deadline + 'T23:59:59+08:00')
  }
  return new Date(deadline)
}

function getCurrentHandoffRecipient(handoff) {
  const workflowType = handoff.workflowType || 'editorialOfficeHandoff'
  if (handoff.status === 'submitted') {
    const department = workflowType === 'productionReservation' ? '摄制部' : '办公部'
    return { department, specs: [{ role: 'minister', department }] }
  }
  if (handoff.status === 'archive_assigned') {
    return {
      department: '办公部',
      specs: [{ name: handoff.archiveMemberName, department: '办公部' }]
    }
  }
  if (handoff.status === 'completed') {
    return { department: '', specs: [{ role: 'admin' }] }
  }
  const department = workflowType === 'productionReservation' ? '摄制部' : '办公部'
  return { department, specs: [{ name: handoff.assigneeName, department }] }
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
  if (handoff.workflowType === 'productionReservation') {
    return user.department === '摄制部' && (
      handoff.assigneeOpenid === openid || handoff.assigneeName === user.name
    )
  }
  if (user.role === 'minister' && user.department === handoff.targetDepartment) {
    return true
  }
  return user.department === handoff.targetDepartment && (
    handoff.assigneeOpenid === openid || handoff.assigneeName === user.name
  )
}

async function addWorkflowNotification(data) {
  const recipientIds = await resolveNotificationRecipientIds(data.recipientSpecs)
  const notification = {
    title: trim(data.title),
    content: trim(data.content),
    type: 'handoff',
    targetDept: data.targetDept || '',
    page: trim(data.page),
    recipientIds,
    createTime: new Date()
  }
  await db.collection(COLLECTIONS.NOTIFICATIONS).add({
    data: {
      title: notification.title,
      content: notification.content,
      type: notification.type,
      targetDept: notification.targetDept,
      page: notification.page,
      recipientIds,
      createTime: notification.createTime
    }
  })

  // 订阅消息授权和模板配置都可能缺失；站内提醒已写入，不让外部推送失败影响流转。
  try {
    await sendSubscribedTaskNotifications(notification, recipientIds)
  } catch (err) {
    console.error('subscribe message send failed', err)
  }
}

async function resolveNotificationRecipientIds(specs) {
  const result = {}
  const list = Array.isArray(specs) ? specs : []
  for (const spec of list) {
    if (!spec) continue
    let users = []
    if (spec.userId) {
      const user = await getDoc(COLLECTIONS.USERS, spec.userId)
      if (user) users = [user]
    } else if (spec.role) {
      const where = { role: spec.role }
      if (spec.department) where.department = spec.department
      users = await getAll(COLLECTIONS.USERS, where)
    } else if (trim(spec.name)) {
      users = await getAll(COLLECTIONS.USERS, { name: trim(spec.name) })
      if (spec.department) {
        users = users.filter(item => item.department === spec.department)
      }
    }
    users.forEach(user => {
      if (user && user._id) result[user._id] = true
    })
  }
  return Object.keys(result)
}

async function sendSubscribedTaskNotifications(notification, recipientIds) {
  if (!recipientIds || recipientIds.length === 0) return
  const settings = await getTaskNotificationSettings()
  if (!settings.enabled || !settings.templateId || !cloud.openapi || !cloud.openapi.subscribeMessage) return

  for (const userId of recipientIds) {
    const subscriptions = await getAll(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS, {
      userId,
      status: 'accept',
      templateId: settings.templateId
    })
    const subscription = subscriptions[0]
    const user = await getDoc(COLLECTIONS.USERS, userId)
    if (!subscription || !user || !user.openid || user.isTestAccount) continue

    const now = new Date()
    const data = {}
    data[settings.titleField] = { value: clipSubscribeText(notification.title, 20) }
    data[settings.contentField] = { value: clipSubscribeText(notification.content, 20) }
    data[settings.timeField] = { value: formatDateTime(now) }

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: user.openid,
        templateId: settings.templateId,
        page: notification.page || settings.page,
        data
      })
      // 一次性订阅在成功发送后不再重复消费，下一次任务提醒需要用户再次授权。
      await db.collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS).doc(subscription._id).update({
        data: { status: 'consumed', consumedAt: now, updateTime: now }
      })
    } catch (err) {
      console.error('subscribe message API error', userId, err)
    }
  }
}

function clipSubscribeText(value, length) {
  const text = trim(value)
  return text.length > length ? text.slice(0, length - 1) + '…' : (text || '任务提醒')
}

function getHandoffNotificationPage(workflowType, handoffId) {
  const page = workflowType === 'productionReservation'
    ? 'pages/production/production'
    : 'pages/handoffs/handoffs'
  return page + '?tab=mine&handoffId=' + encodeURIComponent(String(handoffId || ''))
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
    userId: userInfo._id || '',
    updateTime: new Date()
  }
  if (!userInfo.isTestAccount && !userInfo.temporarySession) {
    data.openid = userInfo.openid || ''
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

async function findMemberByName(name) {
  const cleanName = trim(name)
  if (!cleanName) return null
  const res = await db.collection(COLLECTIONS.MEMBERS).where({ name: cleanName }).limit(1).get()
  return first(res)
}

async function getAllowanceSettings() {
  const res = await db.collection(COLLECTIONS.ALLOWANCE_RULES).where({ key: ALLOWANCE_SETTINGS_KEY }).limit(1).get()
  const settings = first(res)
  return {
    urgentThresholdDays: toNumber(settings && settings.urgentThresholdDays) || 2,
    urgentMultiplier: toNumber(settings && settings.urgentMultiplier) || 1.5,
    standardHourlyRate: toNumber(settings && settings.standardHourlyRate) || 10,
    productionHourlyRate: toNumber(settings && settings.productionHourlyRate) || 12
  }
}

function buildCreateDefaults(workflowType, previous) {
  if (workflowType === 'productionReservation') {
    const scheduledAt = trim(previous && previous.scheduledAt)
    const scheduledDate = parseProductionDateTime(scheduledAt)
    const hasFutureSchedule = !isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()
    const fallbackDate = new Date(Date.now() + 60 * 60 * 1000)
    const date = hasFutureSchedule ? scheduledDate : fallbackDate
    return {
      taskName: trim(previous && (previous.taskName || previous.title)),
      date: formatChinaDate(date),
      time: hasFutureSchedule ? formatChinaTime(date) : formatChinaTime(fallbackDate),
      location: trim(previous && previous.location),
      submitterContact: trim(previous && previous.submitterContact),
      reminderLeadHours: String(normalizeReminderLeadHours(previous && previous.reminderLeadHours)),
      note: trim(previous && previous.note)
    }
  }

  const deadline = trim(previous && previous.deadline)
  return {
    title: trim(previous && previous.title),
    articleNames: trim(previous && previous.articleNames),
    articleType: normalizeArticleType(previous && previous.articleType),
    articleTypeIndex: normalizeArticleType(previous && previous.articleType) === 'reprint' ? 1 : 0,
    targetSites: trim(previous && previous.targetSites) || '院网、升华网、学工网',
    reviewerNames: normalizeNameList(previous && previous.reviewerNames).join('、'),
    note: trim(previous && previous.note),
    deadline: deadline && deadline >= formatChinaDate(new Date()) ? deadline : '',
    deadlineLabel: deadline && deadline >= formatChinaDate(new Date()) ? deadline : '',
    reminderLeadHours: String(normalizeReminderLeadHours(previous && previous.reminderLeadHours))
  }
}

function formatChinaDate(date) {
  const value = date instanceof Date ? date : new Date(date)
  const china = new Date(value.getTime() + 8 * 60 * 60 * 1000)
  return china.getUTCFullYear() + '-' + String(china.getUTCMonth() + 1).padStart(2, '0') + '-' + String(china.getUTCDate()).padStart(2, '0')
}

function formatChinaTime(date) {
  const value = date instanceof Date ? date : new Date(date)
  const china = new Date(value.getTime() + 8 * 60 * 60 * 1000)
  return String(china.getUTCHours()).padStart(2, '0') + ':' + String(china.getUTCMinutes()).padStart(2, '0')
}

async function getAllowanceRules() {
  const rows = await getAll(COLLECTIONS.ALLOWANCE_RULES, {})
  return rows.filter(item => item.recordType === 'rule')
}

function findAllowanceRule(rules, key, department, workType) {
  return rules.find(item => item.key === key) ||
    rules.find(item => item.department === department && item.workType === workType)
}

function getRuleQuantity(rule, fallbackQuantity) {
  const unit = trim(rule && rule.unit)
  return ['篇', '件'].includes(unit) ? fallbackQuantity : 1
}

function getCurrentSemesterLabel(date) {
  const value = date instanceof Date ? date : new Date(date)
  return value.getFullYear() + '-' + (value.getMonth() < 6 ? '上学期' : '下学期')
}

// 小程序 picker 传入的是本地时间，显式按中国标准时间解析，避免云函数运行时区不同造成偏差。
function parseProductionDateTime(value) {
  const text = trim(value)
  if (!text) return new Date(NaN)
  const normalized = text.replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!match) return new Date(text)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] || 0)
  const minute = Number(match[5] || 0)
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0))
}

async function hasWorkflowSource(memberName, department, sourceId) {
  const rows = await getAll(COLLECTIONS.RECORDS, { memberName, department })
  return rows.some(item => normalizeIdList(item.sourceHandoffIds).includes(sourceId))
}

function normalizeNameList(value) {
  if (Array.isArray(value)) {
    return unique(value.map(item => trim(item)).filter(Boolean))
  }
  return unique(String(value || '').split(/[,，\n、]/).map(item => trim(item)).filter(Boolean))
}

function countWorkUnits(value) {
  const items = String(value || '').split(/\n/).map(item => trim(item)).filter(Boolean)
  return Math.max(1, items.length)
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

function getHourlyRate(department, settings) {
  const configured = department === '摄制部'
    ? toNumber(settings && settings.productionHourlyRate)
    : toNumber(settings && settings.standardHourlyRate)
  return configured > 0 ? configured : (department === '摄制部' ? 12 : 10)
}

function buildStatistics(rows) {
  const deptMap = {}
  const memberMap = {}
  let totalWorkload = 0
  const memberSet = {}

  rows.forEach(record => {
    const department = record.department || '未分组'
    if (!deptMap[department]) {
      deptMap[department] = {
        department,
        totalWorkload: 0,
        members: {}
      }
    }
    deptMap[department].totalWorkload += toNumber(record.workload)
    deptMap[department].members[record.memberName] = true

    const key = record.memberName + '|' + department
    if (!memberMap[key]) {
      memberMap[key] = {
        key,
        memberName: record.memberName,
        department,
        workload: 0
      }
    }
    memberMap[key].workload += toNumber(record.workload)

    totalWorkload += toNumber(record.workload)
    memberSet[key] = true
  })

  const deptStats = Object.keys(deptMap).map(key => {
    const item = deptMap[key]
    return {
      department: item.department,
      totalWorkload: item.totalWorkload.toFixed(1),
      memberCount: Object.keys(item.members).length
    }
  }).sort((a, b) => Number(b.totalWorkload) - Number(a.totalWorkload))

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
      workload: item.workload.toFixed(1)
    }
  }).sort((a, b) => Number(b.workload) - Number(a.workload))

  return {
    deptStats,
    memberStats,
    totalStats: {
      totalWorkload: totalWorkload.toFixed(1),
      memberCount: Object.keys(memberSet).length,
      recordCount: rows.length
    }
  }
}

function buildWeeklyTable(rows, settings) {
  const deptMap = {}
  rows.forEach(record => {
    const department = record.department || '未分组'
    if (!deptMap[department]) {
      deptMap[department] = {
        department,
        records: [],
        totalWorkload: 0,
        members: {}
      }
    }
    deptMap[department].records.push(formatRecord(record, settings))
    deptMap[department].totalWorkload += toNumber(record.workload)
    deptMap[department].members[record.memberName] = true
  })

  const groups = Object.keys(deptMap).map(key => {
    const group = deptMap[key]
    group.records.sort((a, b) => String(a.memberName).localeCompare(String(b.memberName)))
    return {
      department: group.department,
      records: group.records,
      totalWorkload: group.totalWorkload.toFixed(1),
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
      submittedByRole: 'member'
    })
  }

  return Object.assign({}, baseData, {
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
    wechatBound: !user.isTestAccount && !!(user.openid || user.wechatBound),
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

function formatRecord(record, settings) {
  const workTypes = getWorkTypesFromRecord(record)
  const workload = toNumber(record.workload)
  const hourlyRate = getHourlyRate(record.department, settings)
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
    workload,
    hourlyRate,
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
    rank: contact.rank || '',
    cohort: contact.cohort || '',
    dormitory: contact.dormitory || '',
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

function formatAllowanceRule(item) {
  return {
    _id: item._id,
    key: item.key || '',
    name: item.name || '',
    department: item.department || '',
    role: item.role || '',
    workType: item.workType || DEFAULT_WORK_TYPE,
    unit: item.unit || '次',
    hours: toNumber(item.hours)
  }
}

function formatResponsibility(item) {
  return {
    _id: item._id,
    key: item.key || '',
    name: item.name || '',
    description: item.description || '',
    departments: Array.isArray(item.departments) ? item.departments : []
  }
}

function formatHandoff(handoff, user, openid) {
  const status = handoff.status || 'submitted'
  const workflowType = handoff.workflowType || 'editorialOfficeHandoff'
  const statusLabel = workflowType === 'productionReservation' && status === 'submitted'
    ? '待摄制部部长派发'
    : HANDOFF_STATUS_LABELS[status] || handoff.statusLabel || ''
  return {
    _id: handoff._id,
    title: handoff.title || '',
    articleNames: handoff.articleNames || '',
    targetSites: handoff.targetSites || '',
    workflowType,
    taskName: handoff.taskName || handoff.title || '',
    scheduledAt: handoff.scheduledAt || '',
    location: handoff.location || '',
    submitterContact: handoff.submitterContact || '',
    reminderLeadHours: normalizeReminderLeadHours(handoff.reminderLeadHours),
    reminderLeadLabel: normalizeReminderLeadHours(handoff.reminderLeadHours) > 0
      ? '提前 ' + normalizeReminderLeadHours(handoff.reminderLeadHours) + ' 小时'
      : '已关闭',
    isUrgent: !!handoff.isUrgent,
    urgentMultiplier: toNumber(handoff.urgentMultiplier) || 1,
    archiveMemberName: handoff.archiveMemberName || '',
    archiveNote: handoff.archiveNote || '',
    reviewerNames: normalizeNameList(handoff.reviewerNames),
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
    statusLabel,
    canAssign: ['submitted', 'rejected'].includes(status) && canAssignHandoff(user, handoff),
    canComplete: ['assigned', 'rejected'].includes(status) && canCompleteHandoff(user, openid, handoff),
    canArchive: status === 'archive_assigned' && workflowType === 'productionReservation' &&
      (user.role === 'admin' || (user.department === '办公部' &&
        (handoff.archiveMemberName === user.name || handoff.archiveMemberOpenid === openid))),
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

function normalizeWorkflowType(value) {
  const workflowType = trim(value)
  return ['editorialOfficeHandoff', 'productionReservation'].includes(workflowType) ? workflowType : ''
}

function normalizeReminderLeadHours(value) {
  if (value === undefined || value === null || trim(value) === '') {
    return 24
  }
  const hours = Number(value)
  if (!Number.isFinite(hours)) return 24
  return Math.max(0, Math.min(24 * 30, Math.floor(hours)))
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

async function handleRepairCollections(user) {
  if (!user || user.role !== 'admin') {
    return fail('仅管理员可以执行该操作')
  }

  const created = []
  const failed = []
  const collectionNames = Object.keys(COLLECTIONS).map(key => COLLECTIONS[key])
  for (const name of collectionNames) {
    const existed = await collectionExists(name)
    if (existed) continue
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (err) {
      // 并发创建时可能已被其他实例建好，再确认一次避免误报。
      if (!(await collectionExists(name))) {
        failed.push(name)
      }
    }
  }

  return success({ created, failed, total: collectionNames.length })
}

async function collectionExists(name) {
  try {
    await db.collection(name).limit(1).get()
    return true
  } catch (err) {
    return false
  }
}

// ===== 项目任务管理 =====
async function handleManageProjectTasks(event, user, openid) {
  const action = event.action
  const collection = db.collection(COLLECTIONS.PROJECT_TASKS)
  const userRole = user.role
  const userDept = user.department || ''
  const isAdmin = userRole === 'admin'

  // 获取项目列表
  if (action === 'getProjects') {
    const scope = event.scope || 'active' // active | completed
    let query = {}
    if (scope === 'completed') {
      query.status = 'completed'
    } else {
      query.status = 'active'
    }

    const allProjects = await getAll(COLLECTIONS.PROJECT_TASKS, {})
    let filtered = allProjects.filter(p => scope === 'completed' ? p.status === 'completed' : p.status === 'active')

    // 非管理员只看本部门参与的项目
    if (!isAdmin && userDept) {
      filtered = filtered.filter(p =>
        (p.deptTasks || []).some(dt => dt.department === userDept)
      )
    }

    // 按创建时间倒序
    filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    return success(filtered)
  }

  // 创建项目（管理员）
  if (action === 'createProject') {
    if (!isAdmin) return fail('无权限')
    const name = trim(event.name)
    const description = trim(event.description || '')
    const deadline = trim(event.deadline || '')
    const deptTasks = event.deptTasks || []
    const phaseNames = event.phases || []

    if (!name) return fail('请输入项目名称')
    if (!Array.isArray(deptTasks) || deptTasks.length === 0) return fail('请至少选择一个参与部门')
    if (!Array.isArray(phaseNames) || phaseNames.length < 2) return fail('至少设置2个阶段')

    const phases = phaseNames.map(n => ({ name: n }))
    // 初始化每个部门在第0阶段的任务状态
    const initialDeptTasks = deptTasks.map(dt => ({
      department: dt.department,
      taskContent: dt.taskContent || '',
      phaseIndex: 0,
      status: 'pending', // pending | in_progress | completed
      completeTime: ''
    }))

    const now = new Date()
    const addRes = await collection.add({
      data: {
        name,
        description,
        deadline,
        phases,
        currentPhaseIndex: 0,
        deptTasks: initialDeptTasks,
        status: 'active', // active | completed
        creatorOpenid: openid,
        creatorName: user.name,
        createTime: formatDateTime(now),
        updateTime: formatDateTime(now),
        completeTime: ''
      }
    })
    return success({ _id: addRes._id })
  }

  // 标记部门任务完成
  if (action === 'completeDeptTask') {
    const projectId = event.projectId
    const department = trim(event.department || '')
    if (!projectId || !department) return fail('参数错误')

    const doc = await getDoc(COLLECTIONS.PROJECT_TASKS, projectId)
    if (!doc) return fail('项目不存在')
    if (doc.status !== 'active') return fail('项目已结束')

    // 校验：必须是该部门成员或部长
    if (!isAdmin && userDept !== department) return fail('无权限操作其他部门任务')

    const deptTasks = doc.deptTasks || []
    const task = deptTasks.find(dt => dt.department === department)
    if (!task) return fail('该部门未参与此项目')
    if (task.phaseIndex !== doc.currentPhaseIndex) return fail('当前阶段不匹配')
    if (task.status === 'completed') return fail('任务已完成')

    // 标记完成
    task.status = 'completed'
    task.completeTime = formatDateTime(new Date())

    // 检查当前阶段的所有部门任务是否都完成了
    const currentPhaseTasks = deptTasks.filter(dt => dt.phaseIndex === doc.currentPhaseIndex)
    const allCompleted = currentPhaseTasks.length > 0 && currentPhaseTasks.every(dt => dt.status === 'completed')

    let advanced = false
    let completed = false

    if (allCompleted) {
      const nextPhaseIndex = doc.currentPhaseIndex + 1
      const totalPhases = (doc.phases || []).length
      if (nextPhaseIndex >= totalPhases) {
        // 所有阶段完成，项目结束
        doc.status = 'completed'
        doc.completeTime = formatDateTime(new Date())
        completed = true
      } else {
        // 推进到下一阶段
        doc.currentPhaseIndex = nextPhaseIndex
        // 所有部门的任务状态重置为进行中（下一阶段）
        deptTasks.forEach(dt => {
          dt.phaseIndex = nextPhaseIndex
          dt.status = 'in_progress'
          dt.completeTime = ''
        })
        advanced = true
      }
    }

    await collection.doc(projectId).update({
      data: {
        deptTasks,
        currentPhaseIndex: doc.currentPhaseIndex,
        status: doc.status,
        completeTime: doc.completeTime || '',
        updateTime: formatDateTime(new Date())
      }
    })

    return success({ advanced, completed })
  }

  // 管理员强制推进阶段
  if (action === 'advancePhase') {
    if (!isAdmin) return fail('无权限')
    const projectId = event.projectId
    const doc = await getDoc(COLLECTIONS.PROJECT_TASKS, projectId)
    if (!doc) return fail('项目不存在')
    if (doc.status !== 'active') return fail('项目已结束')

    const nextPhaseIndex = doc.currentPhaseIndex + 1
    const totalPhases = (doc.phases || []).length
    let completed = false

    if (nextPhaseIndex >= totalPhases) {
      doc.status = 'completed'
      doc.completeTime = formatDateTime(new Date())
      completed = true
    } else {
      doc.currentPhaseIndex = nextPhaseIndex
      const deptTasks = (doc.deptTasks || []).map(dt => ({
        ...dt,
        phaseIndex: nextPhaseIndex,
        status: 'in_progress',
        completeTime: ''
      }))
      doc.deptTasks = deptTasks
    }

    await collection.doc(projectId).update({
      data: {
        currentPhaseIndex: doc.currentPhaseIndex,
        deptTasks: doc.deptTasks,
        status: doc.status,
        completeTime: doc.completeTime || '',
        updateTime: formatDateTime(new Date())
      }
    })

    return success({ completed })
  }

  // 管理员结束项目
  if (action === 'endProject') {
    if (!isAdmin) return fail('无权限')
    const projectId = event.projectId
    const doc = await getDoc(COLLECTIONS.PROJECT_TASKS, projectId)
    if (!doc) return fail('项目不存在')

    await collection.doc(projectId).update({
      data: {
        status: 'completed',
        completeTime: formatDateTime(new Date()),
        updateTime: formatDateTime(new Date())
      }
    })
    return success({})
  }

  return fail('未知操作：' + action)
}

// ===== 文件管理 =====
async function handleManageFiles(event, user, openid) {
  const action = event.action
  const collection = db.collection(COLLECTIONS.FILES)
  const isAdmin = user.role === 'admin'
  const userDept = user.department || ''

  // 获取文件列表
  if (action === 'getFiles') {
    const allFiles = await getAll(COLLECTIONS.FILES, {})
    // 按时间倒序
    allFiles.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    return success(allFiles)
  }

  // 获取上传路径（预生成 cloudPath）
  if (action === 'getUploadUrl') {
    const fileName = trim(event.fileName || '')
    const fileSize = event.fileSize || 0
    if (!fileName) return fail('文件名不能为空')

    // 生成云存储路径：files/部门/时间戳_文件名
    const dept = userDept || 'common'
    const timestamp = Date.now()
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    const cloudPath = 'files/' + dept + '/' + timestamp + '_' + fileName

    return success({
      cloudPath,
      fileId: cloudPath
    })
  }

  // 添加文件记录
  if (action === 'addFile') {
    const name = trim(event.name || '')
    const size = event.size || 0
    const fileID = event.fileID || ''
    const cloudPath = event.cloudPath || ''

    if (!name) return fail('文件名不能为空')
    if (!fileID) return fail('文件ID不能为空')

    const now = new Date()
    const addRes = await collection.add({
      data: {
        name,
        size,
        fileID,
        cloudPath,
        department: userDept,
        uploaderOpenid: openid,
        uploaderName: user.name,
        downloadCount: 0,
        description: '',
        createTime: formatDateTime(now),
        updateTime: formatDateTime(now)
      }
    })
    return success({ _id: addRes._id })
  }

  // 记录下载次数
  if (action === 'recordDownload') {
    const fileId = event.fileId
    if (!fileId) return fail('参数错误')

    const doc = await getDoc(COLLECTIONS.FILES, fileId)
    if (!doc) return fail('文件不存在')

    await collection.doc(fileId).update({
      data: {
        downloadCount: (doc.downloadCount || 0) + 1,
        updateTime: formatDateTime(new Date())
      }
    })
    return success({})
  }

  // 删除文件
  if (action === 'deleteFile') {
    const fileId = event.fileId
    if (!fileId) return fail('参数错误')

    const doc = await getDoc(COLLECTIONS.FILES, fileId)
    if (!doc) return fail('文件不存在')

    // 权限校验：管理员或上传者本人
    if (!isAdmin && doc.uploaderOpenid !== openid) {
      return fail('无权限删除')
    }

    // 先删除云存储文件（可选，失败不影响记录删除）
    try {
      if (doc.fileID) {
        await cloud.deleteFile({
          fileList: [doc.fileID]
        })
      }
    } catch (e) {
      console.error('删除云存储文件失败:', e)
    }

    // 删除数据库记录
    await collection.doc(fileId).remove()
    return success({})
  }

  return fail('未知操作：' + action)
}
