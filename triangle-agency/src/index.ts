import { Context, Schema, Random, Session } from 'koishi'
import { resolve } from 'path'
import {} from '@koishijs/plugin-console'
import {} from 'koishi-plugin-w-message-db'

export const name = 'triangle-agency'
export const inject = ['database']

// 配置项定义
export interface Config {
  maxExecTimes: number
  checkPrefix: string
  successMsg: string
  failureMsg: string
  bigSuccessMsg: string
  adjustedBigSuccessMsg: string
  successShortMsg: string
  failureShortMsg: string
  bigSuccessShortMsg: string
  adjustedBigSuccessShortMsg: string
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
  adjustedBigSuccessMsg: Schema.string().default('现实在你的注视下驯服了。').description('调整后三个3（燃尽后恰好3个3）时的提示语'),
  successShortMsg: Schema.string().default('成功').description('成功时的简短提示语'),
  failureShortMsg: Schema.string().default('失败').description('失败时的简短提示语'),
  bigSuccessShortMsg: Schema.string().default('大成功').description('大成功时的简短提示语'),
  adjustedBigSuccessShortMsg: Schema.string().default('成功（不产生混沌）').description('调整后三个3时的简短提示语'),
  excessiveMsg: Schema.string().default('检定轮数过多，机构不予支持。').description('多次检定超过上限时的提示语'),
}).description('三角机构（Triangle Agency）规则配置')

// 数据表：按群（platform + guildId）维度存储混沌与改写失败
interface TAState {
  platform: string
  guildId: string
  chaos: number
  raFail: number
}

// 数据表：存储用户上次掷骰结果，供 qa 指令回溯修改
interface TALastRoll {
  platform: string
  guildId: string
  userId: string
  /** 原始 6D4 结果 */
  dice: number[]
  /** 总燃尽 */
  totalBurnout: number
  /** 是否为现实改写 (TR) */
  isTR: boolean
  /** 掷骰时使用的属性值 */
  attributeValue: number
  /** 掷骰时使用的属性文本 */
  attrText: string
  /** 该次掷骰产生的混沌 */
  chaosGenerated: number
  /** 该次掷骰产生的改写失败 */
  failGenerated: number
  /** 掷骰前的混沌值 */
  chaosBefore: number
  /** 掷骰前的改写失败值 */
  raFailBefore: number
  /** 已使用 qa 调整的 3 的数量变化（正=增加3，负=减少3） */
  qaAdjustment: number
}

declare module 'koishi' {
  interface Tables {
    'ta-state': TAState
    'ta-attrs': TAUserAttrs
    'ta-profile': TAProfile
    'ta-last-roll': TALastRoll
  }
}

export function apply(ctx: Context, config: Config) {
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

  // 用户档案表（每群每用户自定义显示名）
  ctx.model.extend(
    'ta-profile',
    {
      platform: 'string',
      guildId: 'string',
      userId: 'string',
      displayName: 'string',
    },
    { primary: ['platform', 'guildId', 'userId'] },
  )

  // 上次掷骰记录表（每群每用户，供 qa 指令回溯）
  ctx.model.extend(
    'ta-last-roll',
    {
      platform: 'string',
      guildId: 'string',
      userId: 'string',
      dice: 'json',
      totalBurnout: 'integer',
      isTR: 'boolean',
      attributeValue: 'integer',
      attrText: 'string',
      chaosGenerated: 'integer',
      failGenerated: 'integer',
      chaosBefore: 'integer',
      raFailBefore: 'integer',
      qaAdjustment: 'integer',
    },
    { primary: ['platform', 'guildId', 'userId'] },
  )

  // ========== 指令：全部迁移到 triangle.* 命名空间，并添加向后兼容 alias ==========
  // 说明：
  // - 为避免在 root 命令空间与其他插件撞名，所有指令统一注册在 `triangle.*` 下。
  // - 同时保留原有简写作为 alias：ta/tr/st/tcs/tcst/tfs/tfst。
  // - 示例：`.triangle check 2 -x 3` 等价于 `.ta 2 -x 3`。

  // 命名空间根：triangle（命令集合说明）
  ctx.command('triangle', '三角机构：命令集合（使用 .triangle <子命令>）')

  // triangle.check / 别名：ta
  ctx
    .command('triangle.check <attr:string>', '三角机构：技能检定（.triangle check <属性名/质保数量>）')
    .alias('ta')
    .option('c', '-c 不修改混沌值')
    .option('x', '-x <times:number> 重复次数，默认1')
    .example('.triangle check 2 -x 3')
    .example('.ta 2 -x 3')
    .action(async ({ session, options }, attr) => runCheck(ctx, config, session!, attr, false, options))

  // triangle.rewrite / 别名：tr
  ctx
    .command('triangle.rewrite <attr:string>', '三角机构：现实改写检定（.triangle rewrite <属性名/质保数量>）')
    .alias('tr')
    .option('c', '-c 不修改混沌值')
    .option('f', '-f 不占用改写失败次数')
    .option('x', '-x <times:number> 重复次数，默认1')
    .example('.triangle rewrite -1 -x 2')
    .example('.tr -1 -x 2')
    .action(async ({ session, options }, attr) => runCheck(ctx, config, session!, attr, true, options))

  // triangle.chaos / 别名：tcs
  ctx
    .command('triangle.chaos [delta:number]', '三角机构：混沌值管理（省略参数显示当前值；正数为消除，负数为增加）')
    .alias('tcs')
    .action(async ({ session }, delta) => {
      const state = await getOrCreateState(ctx, session!)
      if (delta === undefined || delta === null || Number.isNaN(Number(delta))) {
        return `当前群内混沌指数: ${state.chaos}`
      }
      const old = state.chaos
      // 正数消除（减少），负数增加；并限制最小为 0
      const newValue = Math.max(0, old - Number(delta))
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { chaos: newValue })
      return `当前混沌值: ${old} → ${newValue}`
    })

  // triangle.chaos.set / 别名：tcst
  ctx
    .command('triangle.chaos.set <value:number>', '三角机构：设置混沌值为指定数值')
    .alias('tcst')
    .action(async ({ session }, value) => {
      const state = await getOrCreateState(ctx, session!)
      const old = state.chaos
      const newValue = Number(value)
      if (Number.isNaN(newValue)) return '解析出错：请输入数字'
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { chaos: Math.max(0, newValue) })
      return `当前混沌值: ${old} → ${newValue}`
    })

  // triangle.fail / 别名：tfs
  ctx
    .command('triangle.fail [delta:number]', '三角机构：现实改写失败管理（省略参数显示；正数为消除，负数为增加）')
    .alias('tfs')
    .action(async ({ session }, delta) => {
      const state = await getOrCreateState(ctx, session!)
      if (delta === undefined || delta === null || Number.isNaN(Number(delta))) {
        return `当前地点现实改写失败次数: ${state.raFail}`
      }
      const old = state.raFail
      // 正数消除（减少），负数增加；并限制最小为 0
      const newValue = Math.max(0, old - Number(delta))
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { raFail: newValue })
      return `当前地点现实改写失败次数: ${old} → ${newValue}`
    })

  // triangle.fail.set / 别名：tfst
  ctx
    .command('triangle.fail.set <value:number>', '三角机构：设置现实改写失败次数为指定数值')
    .alias('tfst')
    .action(async ({ session }, value) => {
      const state = await getOrCreateState(ctx, session!)
      const old = state.raFail
      const newValue = Number(value)
      if (Number.isNaN(newValue)) return '解析出错：请输入数字'
      // 限制最小为 0
      await ctx.database.set('ta-state', { platform: session!.platform, guildId: session!.guildId! }, { raFail: Math.max(0, newValue) })
      return `当前地点现实改写失败次数: ${old} → ${newValue}`
    })

  // triangle.stat / 别名：st
  ctx
    .command('triangle.stat <raw:text>', '三角机构：设置角色属性，例：.triangle stat 专注3共情3仪态-1')
    .alias('st')
    .option('show', '--show 展示当前角色属性')
    .action(async ({ session, options }, raw) => {
      if (!session?.guildId) return '请在群聊中使用该命令'

      // 展示当前角色属性：.triangle stat --show
      if (options?.show) {
        const ua = await getOrCreateUserAttrs(ctx, session)
        const attrs = ua.attrs || {}
        const keys = Object.keys(attrs)
        if (keys.length === 0) return '当前未设置任何属性'
        const list = keys.sort().map(k => `${k}=${attrs[k]}`).join('，')
        return `当前角色属性：${list}`
      }

      if (!raw) return '请输入属性设置，如：.triangle stat 专注3共情3仪态0'

      // 变更：带 +/- 号表示“增量调整”，无符号表示“直接设定”
      const pairs = parseAttrPairsWithDelta(String(raw))
      if (pairs.length === 0) return '未解析到“属性=数值”对，格式示例：专注3共情-1'

      const ua = await getOrCreateUserAttrs(ctx, session)
      const attrs = { ...(ua.attrs || {}) }
      const changes: string[] = []

      for (const { name, value, isDelta } of pairs) {
        const canon = normalizeAttrName(name)
        const oldVal = Number(attrs[canon] ?? 0)
        const newVal = isDelta ? oldVal + value : value
        attrs[canon] = newVal
        changes.push(isDelta ? `${canon}${value >= 0 ? '+' : ''}${value}→${newVal}` : `${canon}=${newVal}`)
      }

      await ctx.database.set('ta-attrs', { platform: session.platform, guildId: session.guildId!, userId: session.userId }, { attrs })
      return `已设置属性：${changes.join('，')}`
    })

  // triangle.stat.show / 别名：st.show
  ctx
    .command('triangle.stat.show', '三角机构：展示当前角色属性')
    .alias('st.show')
    .action(async ({ session }) => {
      if (!session?.guildId) return '请在群聊中使用该命令'
      const ua = await getOrCreateUserAttrs(ctx, session)
      const attrs = ua.attrs || {}
      const keys = Object.keys(attrs)
      if (keys.length === 0) return '当前未设置任何属性'
      const list = keys.sort().map(k => `${k}=${attrs[k]}`).join('，')
      return `当前角色属性：${list}`
    })

  // triangle.stat.clear / 别名：st.clear
  ctx
    .command('triangle.stat.clear [name:string]', '三角机构：清理属性；省略名称则清理所有数值为 0 的属性')
    .alias('st.clear')
    .action(async ({ session }, name) => {
      if (!session?.guildId) return '请在群聊中使用该命令'
      const ua = await getOrCreateUserAttrs(ctx, session)
      const attrs = { ...(ua.attrs || {}) }

      const removed: string[] = []

      if (name) {
        const raw = String(name).trim()
        if (!raw) return '请输入要清理的属性名称，或省略名称以清理数值为 0 的属性'
        const rawLower = raw.toLowerCase()
        for (const key of Object.keys(attrs)) {
          if (key === raw || key.toLowerCase() === rawLower) {
            removed.push(key)
            delete attrs[key]
          }
        }
        if (removed.length === 0) return `未找到属性“${raw}”`
      } else {
        for (const [k, v] of Object.entries(attrs)) {
          if (v === 0) {
            removed.push(k)
            delete attrs[k]
          }
        }
        if (removed.length === 0) return '没有数值为 0 的属性可清理'
      }

      await ctx.database.set('ta-attrs', { platform: session.platform, guildId: session.guildId!, userId: session.userId }, { attrs })
      return `已清理属性：${removed.sort().join('，')}`
    })

  // triangle.qa / 别名：qa
  ctx
    .command('triangle.qa <raw:text>', '三角机构：质保调整——消耗属性修改上次掷骰中3的数量（.triangle qa <属性名> <变更数量>）')
    .alias('qa')
    .example('.triangle qa 专注2')
    .example('.qa 专注 2')
    .example('.qa 专注-2')
    .action(async ({ session }, raw) => {
      if (!session?.guildId) return '请在群聊中使用该命令'
      if (!raw) return '请输入属性名和变更数量，如：.qa 专注2 或 .qa 专注 -2'

      // 解析参数：支持 "属性名数字" 或 "属性名 数字"
      const parsed = parseQaInput(String(raw).trim())
      if (!parsed) return '无法解析参数，格式示例：.qa 专注2 或 .qa 专注 -2'
      const { attrName, delta } = parsed

      if (delta === 0) return '变更数量不能为 0'
      const absDelta = Math.abs(delta)
      if (absDelta > 6) return '单次调整数量不能超过 6（骰子总数为 6）'

      // 读取上次掷骰记录
      const { platform, guildId, userId } = session
      const rollRows = await ctx.database.get('ta-last-roll', { platform, guildId, userId })
      if (!rollRows.length) return '没有找到你的上次掷骰记录，请先进行一次检定'
      const lastRoll = rollRows[0]

      // 解析属性名并读取当前属性值
      const canon = normalizeAttrName(attrName)
      const ua = await getOrCreateUserAttrs(ctx, session)
      const attrs = { ...(ua.attrs || {}) }
      const currentAttrVal = Number(attrs[canon] ?? 0)

      if (currentAttrVal <= 0) return `属性"${canon}"当前值为 ${currentAttrVal}，不足以使用质保`
      if (absDelta > currentAttrVal) return `属性"${canon}"当前值为 ${currentAttrVal}，不足以消耗 ${absDelta} 点`

      // 计算原始骰子中 3 的数量
      const dice = lastRoll.dice
      const originalThrees = dice.filter(v => v === 3).length
      const prevQaAdj = lastRoll.qaAdjustment || 0
      // 当前经过之前 qa 调整后的等效 3 数量
      const effectiveThrees = originalThrees + prevQaAdj

      if (delta > 0) {
        // 增加 3：需要骰子中有足够的非 3 可以改为 3
        const nonThrees = 6 - effectiveThrees
        if (delta > nonThrees) return `当前骰子中仅有 ${nonThrees} 个非3结果可供修改，无法增加 ${delta} 个3`
      } else {
        // 减少 3：需要骰子中有足够的 3 可以改为非 3
        if (absDelta > effectiveThrees) return `当前骰子中仅有 ${effectiveThrees} 个3，无法减少 ${absDelta} 个3`
      }

      // 扣减属性
      const newAttrVal = currentAttrVal - absDelta
      attrs[canon] = newAttrVal
      await ctx.database.set('ta-attrs', { platform, guildId, userId }, { attrs })

      // 更新 qa 调整量
      const newQaAdj = prevQaAdj + delta
      const newEffectiveThrees = originalThrees + newQaAdj

      // 重新计算混沌和失败
      const totalBurnout = lastRoll.totalBurnout
      const isTR = lastRoll.isTR
      const threeCountBurned = newEffectiveThrees - totalBurnout

      let newChaos: number
      let newFail: number
      // 大成功：调整后恰好 3 个有效 3 且无燃尽影响，或燃尽后恰好 3 个
      if (newEffectiveThrees === 3 && totalBurnout === 0) {
        newChaos = 0
        newFail = 0
      } else if (threeCountBurned === 3) {
        newChaos = 0
        newFail = 0
      } else if (threeCountBurned > 0) {
        newChaos = Math.max(0, 6 - threeCountBurned)
        newFail = 0
      } else {
        newChaos = Math.max(0, 6 - threeCountBurned)
        newFail = isTR ? 1 : 0
      }

      // 计算与原先记录的差值并更新群状态
      const oldChaos = lastRoll.chaosGenerated
      const oldFail = lastRoll.failGenerated
      const chaosDiff = newChaos - oldChaos
      const failDiff = newFail - oldFail

      const state = await getOrCreateState(ctx, session)
      const updatedChaos = Math.max(0, state.chaos + chaosDiff)
      const updatedRaFail = Math.max(0, state.raFail + failDiff)
      await ctx.database.set('ta-state', { platform, guildId }, { chaos: updatedChaos, raFail: updatedRaFail })

      // 更新掷骰记录
      await ctx.database.set('ta-last-roll', { platform, guildId, userId }, {
        qaAdjustment: newQaAdj,
        chaosGenerated: newChaos,
        failGenerated: newFail,
      })

      // 构造回复
      const player = await getDisplayName(ctx, session)
      const effectiveDice = buildEffectiveDice(dice, newQaAdj)
      const markedResult = markResults([...effectiveDice], totalBurnout)

      let resultText: string
      if (newEffectiveThrees === 3 && totalBurnout === 0) {
        resultText = config.bigSuccessMsg
      } else if (threeCountBurned === 3) {
        resultText = config.adjustedBigSuccessMsg
      } else if (threeCountBurned > 0) {
        resultText = config.successMsg
      } else {
        resultText = config.failureMsg
      }

      const lines = [
        `${player}消耗了 ${absDelta} 点"${canon}"（${currentAttrVal}→${newAttrVal}），${delta > 0 ? '增加' : '减少'}了 ${absDelta} 个3。`,
        `调整后结果：6D4=${markedResult} ${resultText}`,
        `混沌变化：${oldChaos}→${newChaos}（群内混沌：${updatedChaos}）`,
      ]
      if (isTR) {
        lines.push(`改写失败变化：${oldFail}→${newFail}（群内改写失败：${updatedRaFail}）`)
      }
      return lines.join('\n')
    })

  // triangle.name / 别名：tpc.new
  ctx
    .command('triangle.name <name:text>', '三角机构：设置你的角色名（仅当前群内生效）')
    .alias('tpc.new')
    .option('show', '--show 展示当前角色名')
    .option('clear', '--clear 清除已设置的角色名')
    .action(async ({ session, options }, name) => {
      if (!session?.guildId) return '请在群聊中使用该命令'

      // 展示当前
      if (options?.show) {
        const prof = await getProfile(ctx, session)
        const cur = prof?.displayName || session.username || session.userId
        return `当前角色名：${cur}${prof?.displayName ? '' : '（默认）'}`
      }

      // 清除设置
      if (options?.clear) {
        await ctx.database.remove('ta-profile', { platform: session.platform, guildId: session.guildId!, userId: session.userId })
        const fallback = session.username || session.userId
        return `已清除自定义角色名，当前角色名：${fallback}`
      }

      const newName = String(name ?? '').trim()
      if (!newName) return '请输入角色名，例如：.tpc.new 阿格尼丝'

      const { platform, guildId, userId } = session
      const rows = await ctx.database.get('ta-profile', { platform, guildId: guildId!, userId })
      if (rows.length) {
        await ctx.database.set('ta-profile', { platform, guildId: guildId!, userId }, { displayName: newName })
      } else {
        await ctx.database.create('ta-profile', { platform, guildId: guildId!, userId, displayName: newName })
      }
      return `已更新角色名为：${newName}`
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
    return '请提供属性名或质保数量'
  }

  // 支持数字或属性名
  let attributeValue: number | null = null
  let attrText = String(attrInput)
  if (/^[+-]?\d+$/.test(attrInput)) {
    attributeValue = Number(attrInput)
  } else {
    // 解析属性名：不再做输入别名映射，按属性原名读取
    const canon = normalizeAttrName(attrInput)
    const ua = await getOrCreateUserAttrs(ctx, session)
    const stored = (ua.attrs || {})[canon]
    if (typeof stored === 'number') {
      attributeValue = stored
    } else {
      // 未存储则自动初始化为 0 并持久化
      const newAttrs = { ...(ua.attrs || {}), [canon]: 0 }
      await ctx.database.set('ta-attrs', { platform: session.platform, guildId: session.guildId!, userId: session.userId }, { attrs: newAttrs })
      attributeValue = 0
    }
  }
  const attributeValueNum = Number(attributeValue)
  const state = await getOrCreateState(ctx, session)

  // raFail 可能因管理命令被调成负数，运行期一律按 0 处理，避免出现负数燃尽
  const failureBurnout = isTR ? Math.max(0, state.raFail) : 0
  const abilityBurnout = attributeValueNum > 0 ? 0 : Math.abs(attributeValueNum) + 1
  const totalBurnout = abilityBurnout + failureBurnout

  let chaosGeneratedTotal = 0
  let failuresGeneratedTotal = 0
  const results: string[] = []
  // 仅单次掷骰时保存原始骰子供 qa 回溯
  let singleDice: number[] | null = null
  let singleChaos = 0
  let singleFail = 0

  for (let i = 0; i < times; i++) {
    const intermediate = roll6d4()
    const threeCountOriginal = intermediate.filter((v) => v === 3).length
    const threeCountBurned = threeCountOriginal - totalBurnout
    const markedIntermediate = markResults([...intermediate], totalBurnout)

    let thisChaos = 0
    let thisFail = 0

    const useShort = times > 1
    // 大成功：必须为原始掷骰恰好 3 个 3（不能由 4 个以上通过燃尽变为 3）
    if (threeCountOriginal === 3) {
  const msg = useShort ? config.bigSuccessShortMsg : config.bigSuccessMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      // chaos stays unchanged
    } else if (threeCountBurned === 3) {
      // 燃尽后恰好剩余 3 个 3：成功且不增加混沌（区别于原生大成功）
  const msg = useShort ? config.adjustedBigSuccessShortMsg : config.adjustedBigSuccessMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      // chaos stays unchanged
    } else if (threeCountBurned > 0) {
  const msg = useShort ? config.successShortMsg : config.successMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      thisChaos = 6 - threeCountBurned
    } else {
  const msg = useShort ? config.failureShortMsg : config.failureMsg
  results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`)
      thisChaos = 6 - threeCountBurned
      if (isTR) thisFail = 1
    }

    chaosGeneratedTotal += thisChaos
    failuresGeneratedTotal += thisFail

    // 记录单次掷骰（仅 times===1 时有效）
    if (times === 1) {
      singleDice = [...intermediate]
      singleChaos = thisChaos
      singleFail = thisFail
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

  // 单次掷骰时保存记录供 qa 指令回溯
  if (singleDice && times === 1) {
    const rollData = {
      dice: singleDice,
      totalBurnout,
      isTR,
      attributeValue: attributeValueNum,
      attrText,
      chaosGenerated: options?.c ? 0 : singleChaos,
      failGenerated: options?.f ? 0 : singleFail,
      chaosBefore: state.chaos,
      raFailBefore: state.raFail,
      qaAdjustment: 0,
    }
    const rollKey = { platform: session.platform, guildId: session.guildId!, userId: session.userId }
    const existingRoll = await ctx.database.get('ta-last-roll', rollKey)
    if (existingRoll.length) {
      await ctx.database.set('ta-last-roll', rollKey, rollData)
    } else {
      await ctx.database.create('ta-last-roll', { ...rollKey, ...rollData })
    }
  }

  const prefix = formatWith(ctx, session, config.checkPrefix, {
    player: await getDisplayName(ctx, session),
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
  // 保护：负数燃尽在展示上当作 0 处理，避免 String.repeat 抛出 RangeError
  let pending = Math.max(0, burnout)
  const out: string[] = []
  for (const n of intermediate) {
    if (n === 3) {
      if (pending > 0) {
        out.push('3x')
        pending--
      } else {
        out.push('3')
      }
    } else {
      out.push(`${n}x`)
    }
  }
  return pending === 0 ? `[${out.join(',')}]` : `[${out.join(',')}] ${'x'.repeat(pending)}`
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

// 属性名标准化：仅做首尾空白清理，不做任何同义词/别名映射
function normalizeAttrName(name: string): string {
  return String(name || '').trim()
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

// 新增：解析并标注是否为"增量调整"(首字符带 +/- 为增量)
// 支持两种格式：
//   1. 紧凑格式："专注3共情-1"（属性名与数值紧挨）
//   2. 空格分隔格式："专注 3 共情 -1"（属性名与数值间有空格）
function parseAttrPairsWithDelta(raw: string): Array<{ name: string; value: number; isDelta: boolean }> {
  const s = String(raw).trim()
  const out: Array<{ name: string; value: number; isDelta: boolean }> = []

  // 按空格拆分 token 进行解析
  const tokens = s.split(/\s+/)
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    // 情况 1：当前 token 本身是 "属性名数值" 的紧凑格式
    const compactMatch = tok.match(/^([^\d+-]+)([+-]?\d+)$/)
    if (compactMatch) {
      const name = compactMatch[1].trim()
      const token = compactMatch[2]
      const val = parseInt(token, 10)
      if (name && !Number.isNaN(val)) {
        out.push({ name, value: val, isDelta: /^[+-]/.test(token) })
      }
      i++
      continue
    }
    // 情况 2：当前 token 是纯属性名，下一个 token 是数值
    if (!/[\d+-]/.test(tok) && i + 1 < tokens.length) {
      const nextTok = tokens[i + 1]
      if (/^[+-]?\d+$/.test(nextTok)) {
        const name = tok.trim()
        const val = parseInt(nextTok, 10)
        if (name && !Number.isNaN(val)) {
          out.push({ name, value: val, isDelta: /^[+-]/.test(nextTok) })
        }
        i += 2
        continue
      }
    }
    // 情况 3：可能是连续的紧凑格式无空格（如 "专注3共情-1" 整体作为一个 token）
    // 对该 token 用正则提取多组
    const reg = /([^\d+-]+)([+-]?\d+)/g
    let m: RegExpExecArray | null
    while ((m = reg.exec(tok))) {
      const name = m[1].trim()
      const token = m[2]
      if (!name) continue
      const val = parseInt(token, 10)
      if (Number.isNaN(val)) continue
      out.push({ name, value: val, isDelta: /^[+-]/.test(token) })
    }
    i++
  }

  return out
}

// 解析 qa 指令输入：支持 "属性名数字" 或 "属性名 数字"
function parseQaInput(raw: string): { attrName: string; delta: number } | null {
  // 尝试紧凑格式："专注2" 或 "专注-2"
  const compact = raw.match(/^([^\d+-]+)([+-]?\d+)$/)
  if (compact) {
    const attrName = compact[1].trim()
    const delta = parseInt(compact[2], 10)
    if (attrName && !Number.isNaN(delta)) return { attrName, delta }
  }

  // 尝试空格分隔格式："专注 2" 或 "专注 -2"
  const tokens = raw.split(/\s+/)
  if (tokens.length === 2) {
    const attrName = tokens[0].trim()
    const delta = parseInt(tokens[1], 10)
    if (attrName && !Number.isNaN(delta)) return { attrName, delta }
  }

  return null
}

// 根据 qa 调整量构造等效骰子数组（用于展示）
// qaAdj > 0：将一些非 3 改为 3；qaAdj < 0：将一些 3 改为非 3
function buildEffectiveDice(originalDice: number[], qaAdj: number): number[] {
  const dice = [...originalDice]
  if (qaAdj > 0) {
    // 增加 3：把一些非 3 的结果改为 3
    let remaining = qaAdj
    for (let i = 0; i < dice.length && remaining > 0; i++) {
      if (dice[i] !== 3) {
        dice[i] = 3
        remaining--
      }
    }
  } else if (qaAdj < 0) {
    // 减少 3：把一些 3 改为非 3（标记为 1，仅用于计数展示）
    let remaining = Math.abs(qaAdj)
    for (let i = 0; i < dice.length && remaining > 0; i++) {
      if (dice[i] === 3) {
        dice[i] = 1  // 改为非 3 值
        remaining--
      }
    }
  }
  return dice
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

// 用户档案：自定义显示名
interface TAProfile {
  platform: string
  guildId: string
  userId: string
  displayName: string
}

async function getProfile(ctx: Context, session: Session): Promise<TAProfile | null> {
  const { platform, guildId, userId } = session
  if (!guildId) return null
  const rows = await ctx.database.get('ta-profile', { platform, guildId, userId })
  return rows[0] || null
}

async function getDisplayName(ctx: Context, session: Session): Promise<string> {
  const prof = await getProfile(ctx, session)
  return prof?.displayName || session.username || session.userId
}
