import { Context, Schema, Random, Session } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import {} from 'koishi-plugin-w-message-db'

export const name = 'triangle-agency'

// 配置项定义
export interface Config {
  maxExecTimes: number
  checkPrefix: string
  successMsg: string
  failureMsg: string
  bigSuccessMsg: string
  successShortMsg: string
  failureShortMsg: string
  bigSuccessShortMsg: string
  excessiveMsg: string
}

export const Config: Schema<Config> = Schema.object({
  maxExecTimes: Schema.number().default(5).description('多次检定上限值'),
  checkPrefix: Schema.string()
    .default('{player}的“{attrText}”能力使用已批准……\n')
    .description('检定回复前缀，支持变量：{player}、{attrText}'),
  successMsg: Schema.string().default('这一瞬间，现实为你而扭曲。').description('成功时的提示语'),
  failureMsg: Schema.string().default('它冰冷而不可撼动，仿若一座黑色的方尖碑。').description('失败时的提示语'),
  bigSuccessMsg: Schema.string().default('三尖冠——天命昭昭。').description('大成功时的提示语'),
  successShortMsg: Schema.string().default('成功').description('成功时的简短提示语'),
  failureShortMsg: Schema.string().default('失败').description('失败时的简短提示语'),
  bigSuccessShortMsg: Schema.string().default('大成功').description('大成功时的简短提示语'),
  excessiveMsg: Schema.string().default('检定轮数过多，机构不予支持。').description('多次检定超过上限时的提示语'),
}).description('三角机构（Triangle Agency）规则配置')

// 数据表：按群（platform + guildId）维度存储混沌与改写失败
interface TAState {
  platform: string
  guildId: string
  chaos: number
  raFail: number
}

declare module 'koishi' {
  interface Tables {
    'ta-state': TAState
    'ta-attrs': TAUserAttrs
  }
}

export function apply(ctx: Context, config: Config) {
  // 后台面板入口（保留）
  ctx.inject(['console'], (ctx) => {
    ctx.console?.addEntry?.({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  })

  // 建表
  ctx.model.extend(
    'ta-state',
    {
      platform: 'string',
      guildId: 'string',
      chaos: 'integer',
      raFail: 'integer',
    },
    { primary: ['platform', 'guildId'] },
  )

  // 用户属性表（每群每用户持久化属性）
  ctx.model.extend(
    'ta-attrs',
    {
      platform: 'string',
      guildId: 'string',
      userId: 'string',
      attrs: 'json',
    },
    { primary: ['platform', 'guildId', 'userId'] },
  )

  // 指令：ta / tr
  ctx.command('ta <attr:string>', '三角机构：技能检定（.ta <属性名/质保数量>）')
    .option('c', '-c 不修改混沌值')
    .option('x', '-x <times:number> 重复次数，默认1')
    .example('.ta 2 -x 3')
    .action(async ({ session, options }, attr) => runCheck(ctx, config, session!, attr, false, options))

  ctx.command('tr <attr:string>', '三角机构：现实改写检定（.tr <属性名/质保数量>）')
    .option('c', '-c 不修改混沌值')
    .option('f', '-f 不占用改写失败次数')
    .option('x', '-x <times:number> 重复次数，默认1')
    .example('.tr -1 -x 2')
    .action(async ({ session, options }, attr) => runCheck(ctx, config, session!, attr, true, options))

  // 指令：tcs / tcst （混沌值管理）
  ctx.command('tcs [delta:number]', '三角机构：混沌值管理（省略参数显示当前值；正数为消除，负数为增加）')
    .action(async ({ session }, delta) => {
      const state = await getOrCreateState(ctx, session!)
      if (delta === undefined || delta === null || Number.isNaN(Number(delta))) {
        return `当前群内混沌指数: ${state.chaos}`
      }
      const old = state.chaos
      const newValue = old - Number(delta) // 正数消除（减少），负数增加
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { chaos: newValue })
      return `当前混沌值: ${old} → ${newValue}`
    })

  ctx.command('tcst <value:number>', '三角机构：设置混沌值为指定数值')
    .action(async ({ session }, value) => {
      const state = await getOrCreateState(ctx, session!)
      const old = state.chaos
      const newValue = Number(value)
      if (Number.isNaN(newValue)) return '解析出错：请输入数字'
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { chaos: newValue })
      return `当前混沌值: ${old} → ${newValue}`
    })

  // 指令：tfs / tfst （现实改写失败管理）
  ctx.command('tfs [delta:number]', '三角机构：现实改写失败管理（省略参数显示；正数为消除，负数为增加）')
    .action(async ({ session }, delta) => {
      const state = await getOrCreateState(ctx, session!)
      if (delta === undefined || delta === null || Number.isNaN(Number(delta))) {
        return `当前地点现实改写失败次数: ${state.raFail}`
      }
      const old = state.raFail
      const newValue = old - Number(delta) // 正数消除（减少），负数增加
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { raFail: newValue })
      return `当前地点现实改写失败次数: ${old} → ${newValue}`
    })

  ctx.command('tfst <value:number>', '三角机构：设置现实改写失败次数为指定数值')
    .action(async ({ session }, value) => {
      const state = await getOrCreateState(ctx, session!)
      const old = state.raFail
      const newValue = Number(value)
      if (Number.isNaN(newValue)) return '解析出错：请输入数字'
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { raFail: newValue })
      return `当前地点现实改写失败次数: ${old} → ${newValue}`
    })

  // 指令：st 设置属性
  ctx.command('st <raw:text>', '三角机构：设置角色属性，例：.st 专注3共情3仪态-1')
    .action(async ({ session }, raw) => {
      if (!session?.guildId) return '请在群聊中使用该命令'
      if (!raw) return '请输入属性设置，如：.st 专注3共情3仪态0'

      const pairs = parseAttrPairs(String(raw))
      if (pairs.length === 0) return '未解析到“属性=数值”对，格式示例：专注3共情-1'

      const ua = await getOrCreateUserAttrs(ctx, session)
      const attrs = { ...(ua.attrs || {}) }
      const changes: string[] = []

      for (const [nameRaw, val] of pairs) {
        const canon = resolveAttrName(nameRaw) || nameRaw
        attrs[canon] = val
        changes.push(`${canon}=${val}`)
      }

      await ctx.database.set('ta-attrs', { platform: session.platform, guildId: session.guildId!, userId: session.userId }, { attrs })
      return `已设置属性：${changes.join('，')}`
    })
}

// 运行一次检定/改写
async function runCheck(ctx: Context, config: Config, session: Session, attrInput: string, isTR: boolean, options: any) {
  if (!session.guildId) return '请在群聊中使用该命令'

  const times = clampInt(options?.x ?? 1, 1, config.maxExecTimes)
  if ((options?.x ?? 1) > config.maxExecTimes) {
    return config.excessiveMsg
  }

  if (!attrInput && attrInput !== '0') {
    return '请提供属性名或质保数量（整数，可为负）'
  }

  // 支持数字或属性名
  let attributeValue: number | null = null
  let attrText = String(attrInput)
  if (/^[+-]?\d+$/.test(attrInput)) {
    attributeValue = Number(attrInput)
  } else {
    // 解析属性名：先用别名映射到规范名，再读取用户属性
    const canon = resolveAttrName(attrInput) || attrInput
    const ua = await getOrCreateUserAttrs(ctx, session)
    const stored = (ua.attrs || {})[canon]
    if (typeof stored === 'number') {
      attributeValue = stored
    } else {
      return `解析出错或属性不存在：${attrInput}`
    }
  }
  const attributeValueNum = Number(attributeValue)
  const state = await getOrCreateState(ctx, session)

  const failureBurnout = isTR ? state.raFail : 0
  const abilityBurnout = attributeValueNum > 0 ? 0 : Math.abs(attributeValueNum) + 1
  const totalBurnout = abilityBurnout + failureBurnout

  let chaosGeneratedTotal = 0
  let failuresGeneratedTotal = 0
  const results: string[] = []

  for (let i = 0; i < times; i++) {
    const intermediate = roll6d4()
    const threeCountOriginal = intermediate.filter((v) => v === 3).length
    const threeCountBurned = threeCountOriginal - totalBurnout
    const markedIntermediate = markResults([...intermediate], totalBurnout)

    const useShort = times > 1
    if (threeCountBurned === 3) {
  const msg = useShort ? config.bigSuccessShortMsg : config.bigSuccessMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      // chaos stays unchanged
    } else if (threeCountBurned > 0) {
  const msg = useShort ? config.successShortMsg : config.successMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      chaosGeneratedTotal += 6 - threeCountBurned
    } else {
  const msg = useShort ? config.failureShortMsg : config.failureMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      chaosGeneratedTotal += 6 - threeCountBurned
      if (isTR) failuresGeneratedTotal += 1
    }
  }

  // 选项开关
  if (options?.c) chaosGeneratedTotal = 0
  if (options?.f) failuresGeneratedTotal = 0

  // 状态回写
  let newChaos = state.chaos
  let newRaFail = state.raFail
  if (chaosGeneratedTotal !== 0) newChaos += chaosGeneratedTotal
  if (failuresGeneratedTotal !== 0) newRaFail = failureBurnout + failuresGeneratedTotal
  if (newChaos !== state.chaos || newRaFail !== state.raFail) {
    await ctx.database.set('ta-state', { platform: session.platform, guildId: session.guildId! }, {
      chaos: newChaos,
      raFail: newRaFail,
    })
  }

  const prefix = formatWith(ctx, session, config.checkPrefix, {
    attrText,
  })
  const suffix = !isTR
    ? `（本次检定拥有${totalBurnout}点燃尽，产生${chaosGeneratedTotal}点混沌，${attributeValueNum < 0 ? 0 : attributeValueNum}次质保可用）`
    : `（本次现实改写拥有${totalBurnout}点燃尽，其中${failureBurnout}点来自前置失败；产生${failuresGeneratedTotal}次改写失败和${chaosGeneratedTotal}点混沌，${attributeValueNum < 0 ? 0 : attributeValueNum}次质保可用）`

  return `${prefix}${results.join('\n')}\n${suffix}`
}

// 辅助：读取或创建群状态
async function getOrCreateState(ctx: Context, session: Session): Promise<TAState> {
  if (!session.guildId) throw new Error('需要在群聊中使用')
  const { platform, guildId } = session
  const rows = await ctx.database.get('ta-state', { platform, guildId })
  if (rows.length) return rows[0]
  const init: TAState = { platform, guildId, chaos: 0, raFail: 0 }
  await ctx.database.create('ta-state', init)
  return init
}

// 掷骰：6D4
function roll6d4(): number[] {
  const r: number[] = []
  for (let i = 0; i < 6; i++) r.push(Math.floor(Math.random() * 4) + 1)
  return r
}

// 结果标注：3 => 3 / 被燃尽的 3 => 3x / 其他 => nx；若燃尽剩余，附加空位 x 的计数
function markResults(intermediate: number[], burnout: number): string {
  const out: string[] = []
  for (const n of intermediate) {
    if (n === 3) {
      if (burnout > 0) {
        out.push('3x')
        burnout--
      } else {
        out.push('3')
      }
    } else {
      out.push(`${n}x`)
    }
  }
  return burnout === 0 ? `[${out.join(',')}]` : `[${out.join(',')}] ${'x'.repeat(burnout)}`
}

// 前缀与消息中的变量替换
function formatWith(ctx: Context, session: Session, text: string, extra: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    player: session.username || session.userId,
    attrText: '',
    ...extra,
  }
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''))
}

function clampInt(v: any, min: number, max: number) {
  const n = Math.floor(Number(v) || 0)
  return Math.max(min, Math.min(max, n))
}

// ====== 属性解析与存储 ======

// 三角机构的默认属性与别名（来自原插件）
const TA_BASE_ATTRS = ['专注', '共情', '仪态', '顽固', '双面', '先机', '敬业', '外向', '精微'] as const
type CanonAttr = typeof TA_BASE_ATTRS[number]

const TA_ALIAS: Record<CanonAttr, string[]> = {
  专注: ['ATT'],
  共情: ['EMP'],
  仪态: ['存在', 'PRE'],
  顽固: ['PER'],
  双面: ['DUP'],
  先机: ['INI'],
  敬业: ['专业', 'PRO'],
  外向: ['外放', 'DYN'],
  精微: ['SUB'],
}

// 建立别名映射（小写匹配；包含规范名自身）
const aliasMap = new Map<string, CanonAttr>()
for (const canon of TA_BASE_ATTRS) {
  aliasMap.set(canon.toLowerCase(), canon)
  for (const a of TA_ALIAS[canon] || []) aliasMap.set(a.toLowerCase(), canon)
}

function resolveAttrName(name: string): CanonAttr | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return (aliasMap.get(key) as CanonAttr) || null
}

// 解析输入字符串中的“名称+整数”对，如：专注3共情-1 仪态0
function parseAttrPairs(raw: string): Array<[string, number]> {
  const s = String(raw).replace(/\s+/g, '')
  const reg = /([^\d+-]+)([+-]?\d+)/g
  const out: Array<[string, number]> = []
  let m: RegExpExecArray | null
  while ((m = reg.exec(s))) {
    const name = m[1].trim()
    const val = parseInt(m[2], 10)
    if (!name) continue
    if (!Number.isNaN(val)) out.push([name, val])
  }
  return out
}

// 用户属性表类型与读写
interface TAUserAttrs {
  platform: string
  guildId: string
  userId: string
  attrs: Record<string, number>
}

async function getOrCreateUserAttrs(ctx: Context, session: Session): Promise<TAUserAttrs> {
  const { platform, guildId, userId } = session
  const rows = await ctx.database.get('ta-attrs', { platform, guildId, userId })
  if (rows.length) return rows[0]
  const init: TAUserAttrs = { platform, guildId: guildId!, userId, attrs: {} }
  await ctx.database.create('ta-attrs', init)
  return init
}
