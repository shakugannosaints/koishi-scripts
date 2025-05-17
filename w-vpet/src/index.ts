import { Context, Service, Session, h, z } from 'koishi'
import {} from 'koishi-plugin-w-message-db'

import { Pet, PetCategory, PetType, UserQuery } from './types'
import { petTypes } from './pet-types'

export const name = 'w-vpet'
export const inject = ['messageDb', 'database']

export interface Config {
  healthDecreasePerDay: number
  healthIncreasePerMessage: number
  maxHealth: number
}

export const Config: z<Config> = z.object({
  healthDecreasePerDay: z.number().default(50).description('宠物每天健康值下降量'),
  healthIncreasePerMessage: z.number().default(10).description('每条消息增加的健康值'),
  maxHealth: z.number().default(100).description('宠物最大健康值'),
})

export class VPetService extends Service {
  static inject = {
    database: { required: true },
    messageDb: { required: true },
  }

  logger = this.ctx.logger('w-vpet')

  constructor(ctx: Context, public config: Config) {
    super(ctx, 'vpet')

    // 定义宠物数据表
    ctx.model.extend('w-vpet', {
      userId: 'string',
      platform: 'string',
      guildId: 'string',
      name: 'string',
      type: 'string',
      category: 'string',
      health: 'integer',
      growth: 'integer',
      adoptTime: 'integer',
      lastInteractTime: 'integer',
    }, {
      primary: ['userId', 'platform', 'guildId'],
    })

    // 注册指令
    ctx.command('vpet')
      .option('name', '-n <name:string>')
      .action(async ({ session, options }) => {
        if (!session.guildId) {
          return '请在群聊中使用此命令'
        }

        const { userId, platform, guildId } = session
        const pet = await this.getPet(userId, platform, guildId)

        // 如果宠物不存在，创建新宠物
        if (!pet) {
          const newPet = await this.adoptPet(userId, platform, guildId, options.name)
          return this.renderPetInfo(newPet, '恭喜你领养了一只新宠物！')
        }

        // 检查宠物是否死亡
        if (pet.health <= 0) {
          return `你的宠物 ${pet.name} 已经死亡，请重新领养一只新宠物。`
        }

        // 如果有 -n 参数，重命名宠物
        if (options.name) {
          const renamedPet = await this.renamePet(userId, platform, guildId, options.name)
          return this.renderPetInfo(renamedPet!, `你的宠物已重命名为 ${options.name}！`)
        }

        // 更新宠物状态
        const updatedPet = await this.interactWithPet(userId, platform, guildId)
        return this.renderPetInfo(updatedPet, '你的宠物很高兴见到你！')
      })
  }

  // 获取用户宠物
  async getPet(userId: string, platform: string, guildId: string): Promise<Pet | null> {
    const pets = await this.ctx.database.get('w-vpet', {
      userId,
      platform,
      guildId,
    })

    if (pets.length === 0) {
      return null
    }

    const pet = pets[0]
    
    // 更新宠物状态（健康值和成长值）
    return this.updatePetStatus(pet)
  }

  // 领养新宠物
  async adoptPet(userId: string, platform: string, guildId: string, customName?: string): Promise<Pet> {
    // 随机选择宠物类型
    const petType = this.getRandomPetType()
    const now = Date.now()
    
    const pet: Pet = {
      userId,
      platform,
      guildId,
      name: customName || petType.name,
      type: petType.name,
      category: petType.category,
      health: this.config.maxHealth,
      growth: 0,
      adoptTime: now,
      lastInteractTime: now,
    }

    await this.ctx.database.create('w-vpet', pet)
    return pet
  }

  // 与宠物互动（更新健康值）
  async interactWithPet(userId: string, platform: string, guildId: string): Promise<Pet> {
    const pet = await this.getPet(userId, platform, guildId)
    if (!pet) {
      throw new Error('宠物不存在')
    }

    if (pet.health <= 0) {
      return pet // 宠物已死亡，不更新状态
    }

    // 获取自上次互动以来的消息数量
    const messageCount = await this.getMessageCountSinceLastInteraction(userId, platform, guildId, pet.lastInteractTime)
    
    // 计算新的健康值
    let newHealth = pet.health + messageCount * this.config.healthIncreasePerMessage
    if (newHealth > this.config.maxHealth) {
      newHealth = this.config.maxHealth
    }

    // 计算成长值（每10条消息+1）
    const extraGrowth = Math.floor(messageCount / 10)
    const newGrowth = pet.growth + extraGrowth

    // 更新宠物信息
    const now = Date.now()
    const updatedPet: Pet = {
      ...pet,
      health: newHealth,
      growth: newGrowth,
      lastInteractTime: now,
    }

    await this.ctx.database.set('w-vpet', {
      userId,
      platform,
      guildId,
    }, {
      health: updatedPet.health,
      growth: updatedPet.growth,
      lastInteractTime: updatedPet.lastInteractTime,
    })

    return updatedPet
  }

  // 更新宠物状态（健康值和成长值）
  async updatePetStatus(pet: Pet): Promise<Pet> {
    const now = Date.now()
    const daysSinceLastInteraction = Math.floor((now - pet.lastInteractTime) / (24 * 60 * 60 * 1000))
    
    if (daysSinceLastInteraction <= 0) {
      return pet // 不到一天，不更新状态
    }

    // 计算新的健康值
    const healthDecrease = daysSinceLastInteraction * this.config.healthDecreasePerDay
    let newHealth = Math.max(0, pet.health - healthDecrease)

    // 计算额外成长值：每10条消息+1
    const messageCount = await this.getMessageCountSinceLastInteraction(pet.userId, pet.platform, pet.guildId, pet.lastInteractTime)
    const extraGrowth = Math.floor(messageCount / 10)
    const newGrowth = pet.growth + daysSinceLastInteraction + extraGrowth

    // 更新宠物信息
    const updatedPet: Pet = {
      ...pet,
      health: newHealth,
      growth: newGrowth,
    }

    await this.ctx.database.set('w-vpet', {
      userId: pet.userId,
      platform: pet.platform,
      guildId: pet.guildId,
    }, {
      health: updatedPet.health,
      growth: updatedPet.growth,
    })

    return updatedPet
  }

  // 重命名宠物
  async renamePet(userId: string, platform: string, guildId: string, newName: string): Promise<Pet | null> {
    const pet = await this.getPet(userId, platform, guildId)
    if (!pet) {
      return null
    }

    if (pet.health <= 0) {
      return pet // 宠物已死亡，不允许重命名
    }

    await this.ctx.database.set('w-vpet', {
      userId,
      platform,
      guildId,
    }, {
      name: newName,
    })

    return {
      ...pet,
      name: newName,
    }
  }

  // 获取自上次互动以来的消息数量
  async getMessageCountSinceLastInteraction(userId: string, platform: string, guildId: string, lastInteractTime: number): Promise<number> {
    const messages = await this.ctx.database
      .select('w-message')
      .where({
        platform,
        guildId,
        userId,
        timestamp: {
          $gt: lastInteractTime,
        },
      })
      .execute()

    return messages.length
  }

  // 随机选择宠物类型
  getRandomPetType(): PetType {
    const index = Math.floor(Math.random() * petTypes.length)
    return petTypes[index]
  }

  // 渲染宠物信息
  renderPetInfo(pet: Pet, message: string): string {
    const healthStatus = this.getHealthStatus(pet.health)
    const growthStage = this.getGrowthStage(pet.growth)
    
    return `${message}

【宠物信息】
名称：${pet.name}
类型：${pet.type}
健康值：${pet.health}/100 (${healthStatus})
成长值：${pet.growth} (${growthStage})
领养时间：${new Date(pet.adoptTime).toLocaleString()}
`
  }

  // 获取健康状态描述
  getHealthStatus(health: number): string {
    if (health <= 0) return '死亡'
    if (health < 20) return '奄奄一息'
    if (health < 40) return '状态不佳'
    if (health < 60) return '一般'
    if (health < 80) return '健康'
    return '非常健康'
  }

  // 获取成长阶段描述
  getGrowthStage(growth: number): string {
    if (growth < 7) return '幼年期'
    if (growth < 30) return '成长期'
    if (growth < 90) return '成熟期'
    if (growth < 365) return '壮年期'
    if (growth < 1000) return '蜕变期'
    if (growth < 5000) return '练气期'
    if (growth < 15000) return '筑基期'
    if (growth < 50000) return '金丹期'
    if (growth < 100000) return '元婴期'
    if (growth < 200000) return '化神期'
    if (growth < 500000) return '大乘期'
    if (growth < 1000000) return '渡劫期'
    if (growth < 2000000) return '飞升期'
    if (growth < 5000000) return '仙兽'
    return '永恒'
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.plugin(VPetService, config)
}
