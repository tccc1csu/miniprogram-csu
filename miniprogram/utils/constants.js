// utils/constants.js - 常量定义

// 用户角色
const ROLES = {
  ADMIN: 'admin',       // 管理员
  MINISTER: 'minister', // 部长
  MEMBER: 'member'      // 普通成员
}

const ROLE_LABELS = {
  admin: '管理员',
  minister: '部长',
  member: '成员'
}

// 青年传媒中心部门列表
const DEFAULT_DEPARTMENTS = [
  '办公部',
  '采编部',
  '美编部',
  '摄制部',
  '运营部',
  '原创部',
  '兄弟部门'
]

// 工作量单位说明
const WORKLOAD_HINT = '工作量按小时数填写，如：8（表示8小时）'

// 工作量类型
const WORK_TYPES = ['稿件写作', '视频制作', '美编设计', '日常办公']

const DEPARTMENT_DEFAULT_WORK_TYPE = {
  '采编部': '稿件写作',
  '原创部': '稿件写作',
  '摄制部': '视频制作',
  '美编部': '美编设计',
  '办公部': '日常办公',
  '运营部': '日常办公',
  '兄弟部门': '日常办公'
}

// 津贴单位
const ALLOWANCE_UNIT = '元'

// 数据库集合名称
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
  WORKFLOW_RESPONSIBILITIES: 'workflow_responsibilities'
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  DEFAULT_DEPARTMENTS,
  WORK_TYPES,
  DEPARTMENT_DEFAULT_WORK_TYPE,
  WORKLOAD_HINT,
  ALLOWANCE_UNIT,
  COLLECTIONS
}
