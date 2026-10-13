// 新贡献使用课程字段名；旧周汇总仍由原 API 读取，不重写历史数据。
const crypto = require('crypto')

const LEDGER_COLLECTIONS = {
  CONTRIBUTIONS: 'contribution_basis',
  MEASUREMENTS: 'contribution_measurement',
  POLICIES: 'contribution_policy',
  STANDARDS: 'allowance_standard'
}

function key(prefix, parts) {
  return prefix + crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40)
}

async function optionalDoc(transaction, collection, id) {
  try {
    const result = await transaction.collection(collection).doc(id).get()
    return Array.isArray(result.data) ? (result.data[0] || null) : (result.data || null)
  } catch (error) {
    // 通信、权限、缺集合错误必须失败，不能当作“记录不存在”继续写。
    const code = String(error.errCode || error.code || '')
    if (code === 'DATABASE_DOCUMENT_NOT_EXIST') return null
    throw error
  }
}

function append(current, value) {
  const lines = String(current || '').split('\n').filter(Boolean)
  if (value && !lines.includes(value)) lines.push(value)
  return lines.join('\n')
}

async function settle(db, input) {
  const { member, department, week, sourceId, typeId, legacySourceId, now } = input
  if (!member || !member._id || member.department !== department) {
    throw new Error('计量成员与所属部门不匹配，需先核对成员资料')
  }
  if (!sourceId || !typeId) throw new Error('工作贡献缺少来源或类型')
  if (!input.departmentId || !input.legacySourceId || !input.content) throw new Error('工作贡献缺少部门或依据')
  const baseHours = Number(input.baseHours)
  const factor = Number(input.factor)
  if (!Number.isFinite(baseHours) || baseHours < 0 || !Number.isFinite(factor) || factor <= 0) {
    throw new Error('工时或倍率无效')
  }
  const baseHoursU = Math.round(baseHours * 10000)
  const factorU = Math.round(factor * 10000)
  const effectiveHours = Math.round(baseHoursU * factorU / 10000) / 10000
  const hourlyRateCents = Math.round(Number(input.hourlyRate) * 100)
  if (!Number.isSafeInteger(baseHoursU) || baseHoursU > 1000000000 || !Number.isSafeInteger(factorU) || factorU > 1000000 ||
      !Number.isSafeInteger(hourlyRateCents) || hourlyRateCents <= 0 || hourlyRateCents > 10000000) {
    throw new Error('计量值超出有效范围')
  }
  const basisId = key('cb_', [sourceId, typeId, member._id])
  // 新汇总采用稳定 ID；已有旧周汇总由调用方选出，保持原有 _id。
  const recordId = input.existingRecordId || key('wr_', [member._id, department, week])
  const standardId = key('as_', [input.departmentId, department, hourlyRateCents])
  const rule = input.rule || {}
  const policyFacts = {
    standard_id: standardId, type_id: typeId,
    basis_rule: rule.name || input.content,
    rule_key: rule.key || typeId, unit: rule.unit || '次',
    hours_u: Math.round(Number(rule.hours === undefined ? baseHours : rule.hours) * 10000),
    factor_u: factorU
  }
  const policyId = key('cp_', policyFacts)
  let outcome
  const write = async transaction => {
    const existingBasis = await optionalDoc(transaction, LEDGER_COLLECTIONS.CONTRIBUTIONS, basisId)
    if (existingBasis) {
      outcome = { recordId: existingBasis.summary_record_id, basisId, workload: 0, skipped: true }
      return
    }
    const record = await optionalDoc(transaction, 'weekly_records', recordId)
    if (input.existingRecordId && !record) throw new Error('周记录已改变，请刷新后重试')
    const sources = record && Array.isArray(record.sourceHandoffIds) ? record.sourceHandoffIds : []
    // 已计入旧记录的工作不反推明细，不再次累加工时。
    if (sources.includes(legacySourceId)) {
      outcome = { recordId, workload: 0, skipped: true, legacy: true }
      return
    }
    const standard = await optionalDoc(transaction, LEDGER_COLLECTIONS.STANDARDS, standardId)
    const policy = await optionalDoc(transaction, LEDGER_COLLECTIONS.POLICIES, policyId)
    if (!standard) await transaction.collection(LEDGER_COLLECTIONS.STANDARDS).doc(standardId).set({ data: {
      standard_id: standardId, department_id: input.departmentId,
      hourly_rate_cents: hourlyRateCents, captured_at: now
    } })
    if (!policy) await transaction.collection(LEDGER_COLLECTIONS.POLICIES).doc(policyId).set({ data:
      Object.assign({ policy_id: policyId, captured_at: now }, policyFacts)
    })
    await transaction.collection(LEDGER_COLLECTIONS.CONTRIBUTIONS).doc(basisId).set({ data: {
      basis_id: basisId, source_id: sourceId, type_id: typeId,
      member_id: member._id, department_id: input.departmentId,
      occurred_at: now, evidence: input.content,
      handoff_id: input.handoffId, legacy_source_id: legacySourceId,
      summary_record_id: recordId, week,
      schema_version: 1
    } })
    // 零工时规则只能产生待核对依据，不能冒充已核实计量。
    if (baseHoursU > 0) await transaction.collection(LEDGER_COLLECTIONS.MEASUREMENTS).doc(basisId).set({ data: {
      basis_id: basisId, policy_id: policyId,
      base_hours_u: baseHoursU, assessed_at: now,
      assessed_by: input.reviewerId || ''
    } })
    const workTypes = Array.from(new Set((record && record.workTypes || [record && record.workType])
      .filter(Boolean).concat(input.workType)))
    const data = {
      memberId: member._id, memberName: member.name,
      memberOpenid: (record && record.memberOpenid) || member.openid || input.memberOpenid || '',
      department, week,
      workType: (record && record.workType) || input.workType, workTypes,
      workContent: append(record && record.workContent, input.content),
      workload: Math.round((Number(record && record.workload || 0) + effectiveHours) * 10000) / 10000,
      remark: append(record && record.remark, input.remark),
      uploadedBy: (record && record.uploadedBy) || input.reviewerName || '协作归档',
      uploaderOpenid: (record && record.uploaderOpenid) || input.reviewerOpenid || '',
      submittedByRole: (record && record.submittedByRole) || 'workflow',
      autoGeneratedWorkload: true, sourceType: (record && record.sourceType) || 'handoff',
      sourceHandoffIds: sources.concat(legacySourceId), updateTime: now
    }
    if (record) await transaction.collection('weekly_records').doc(recordId).update({ data })
    else await transaction.collection('weekly_records').doc(recordId).set({ data: Object.assign({ createTime: now }, data) })
    outcome = { recordId, basisId, workload: effectiveHours, skipped: false }
  }
  if (input.transaction) await write(input.transaction)
  else await db.runTransaction(write)
  return outcome
}

module.exports = { LEDGER_COLLECTIONS, key, settle, optionalDoc }
