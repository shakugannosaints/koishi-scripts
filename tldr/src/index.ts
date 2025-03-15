const { Context, Schema } = require('koishi')
const axios = require('axios')

// 插件配置项
exports.name = 'tldr'
exports.description = '太长不看 - AI总结群聊消息的功能'
exports.usage = '使用 .tldr 命令启动消息总结流程'

// 声明服务依赖
exports.using = ['database']

exports.Config = Schema.object({
  maxMessages: Schema.number()
    .description('记录的最大消息数量，设置为0表示无限')
    .default(100),
  openaiEndpoint: Schema.string()
    .description('OpenAI API端点')
    .default('https://api.openai.com/v1/chat/completions'),
  openaiApiKey: Schema.string()
    .description('OpenAI API密钥')
    .required(),
  openaiModel: Schema.string()
    .description('使用的OpenAI模型')
    .default('gpt-3.5-turbo'),
  commandTimeout: Schema.number()
    .description('命令超时时间（秒），超过该时间未完成操作将自动取消，设置为0表示永不超时')
    .default(300),
  //这个内容是错的，还不会写
  fetchHistoryMessages: Schema.boolean()
    .description('是否从adapter-onebot获取历史消息')
    .default(false),
  historyMessageCount: Schema.number()
    .description('从adapter-onebot获取的历史消息数量')
    .default(100)
})

// 插件主体
exports.apply = (ctx, config) => {
  // 创建命令会话存储
  const sessionStore = {}
  
  // 创建数据表
  ctx.model.extend('tldr_messages', {
    id: 'string',         // 消息ID
    guildId: 'string',    // 群组ID
    userId: 'string',     // 用户ID
    username: 'string',   // 用户名
    content: 'text',      // 消息内容
    timestamp: 'integer', // 时间戳
    source: 'string',     // 消息来源：'realtime' 或 'history'
  }, {
    primary: 'id',
    unique: [['id', 'guildId']]
  })
  
  // 初始化时尝试从adapter-onebot获取历史消息
  ctx.on('ready', async () => {
    if (config.fetchHistoryMessages) {
      try {
        ctx.logger.info('开始从adapter-onebot获取历史消息...')
        await fetchHistoryFromOnebot(ctx)
        ctx.logger.info('历史消息获取完成')
      } catch (error) {
        ctx.logger.error('获取历史消息失败:', error)
      }
    }
  })
  
  // 从adapter-onebot获取历史消息
  async function fetchHistoryFromOnebot(ctx) {
    // 获取所有onebot适配器
    const onebotBots = ctx.bots.filter(bot => bot.platform === 'onebot')
    if (onebotBots.length === 0) {
      ctx.logger.info('未找到onebot适配器，跳过历史消息获取')
      return
    }
    
    for (const bot of onebotBots) {
      try {
        // 获取所有群组
        const groups = await bot.getGroupList()
        ctx.logger.info(`从机器人 ${bot.selfId} 获取到 ${groups.length} 个群组`)
        
        for (const group of groups) {
          const guildId = group.group_id.toString()
          
          try {
            // 尝试不同的API获取历史消息
            let historyMsgs = []
            
            // 方法1: 使用 getChatHistory API (go-cqhttp 支持)
            try {
              historyMsgs = await bot.internal.getChatHistory({
                message_type: 'group',
                group_id: group.group_id,
                count: config.historyMessageCount
              })
            } catch (e) {
              ctx.logger.debug(`使用getChatHistory获取群 ${guildId} 的历史消息失败: ${e.message}`)
            }
            
            // 方法2: 使用 getGroupMsgHistory API (部分实现支持)
            if (!historyMsgs || historyMsgs.length === 0) {
              try {
                historyMsgs = await bot.internal.getGroupMsgHistory({
                  group_id: group.group_id,
                  count: config.historyMessageCount
                })
              } catch (e) {
                ctx.logger.debug(`使用getGroupMsgHistory获取群 ${guildId} 的历史消息失败: ${e.message}`)
              }
            }
            
            // 方法3: 使用 get_group_msg_history API (直接调用)
            if (!historyMsgs || historyMsgs.length === 0) {
              try {
                const response = await bot.http.post('get_group_msg_history', {
                  group_id: group.group_id,
                  count: config.historyMessageCount
                })
                historyMsgs = response.data?.data || []
              } catch (e) {
                ctx.logger.debug(`直接调用get_group_msg_history获取群 ${guildId} 的历史消息失败: ${e.message}`)
              }
            }
            
            if (Array.isArray(historyMsgs) && historyMsgs.length > 0) {
              ctx.logger.info(`成功获取群 ${guildId} 的 ${historyMsgs.length} 条历史消息`)
              
              // 处理并存储历史消息
              for (const msg of historyMsgs) {
                // 提取消息内容
                let content = ''
                if (typeof msg.message === 'string') {
                  content = msg.message
                } else if (Array.isArray(msg.message)) {
                  content = msg.message.map(segment => {
                    if (segment.type === 'text') return segment.data.text
                    if (segment.type === 'image') return '[图片]'
                    return `[${segment.type}]`
                  }).join('')
                } else if (msg.raw_message) {
                  content = msg.raw_message
                }
                
                // 存储消息
                await storeMessage({
                  id: msg.message_id?.toString() || `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  guildId,
                  userId: (msg.sender?.user_id || msg.user_id)?.toString() || 'unknown',
                  username: msg.sender?.nickname || msg.sender?.card || msg.nickname || 'unknown',
                  content,
                  timestamp: (msg.time || Math.floor(Date.now() / 1000)) * 1000,
                  source: 'history'
                })
              }
            } else {
              ctx.logger.info(`未能获取到群 ${guildId} 的历史消息`)
            }
          } catch (error) {
            ctx.logger.error(`处理群 ${guildId} 的历史消息时出错:`, error)
          }
        }
      } catch (error) {
        ctx.logger.error(`从机器人 ${bot.selfId} 获取群列表失败:`, error)
      }
    }
  }
  
  // 存储消息到数据库
  async function storeMessage(message) {
    try {
      // 检查消息是否已存在
      const existing = await ctx.database.get('tldr_messages', {
        id: message.id,
        guildId: message.guildId
      })
      
      if (existing && existing.length > 0) {
        // 消息已存在，不重复存储
        return
      }
      
      // 存储新消息
      await ctx.database.create('tldr_messages', {
        ...message,
        source: message.source || 'realtime'
      })
      
      // 如果设置了最大消息数量且不为0，则删除超出部分
      if (config.maxMessages > 0) {
        // 获取当前群组的消息总数
        const count = await ctx.database.count('tldr_messages', { guildId: message.guildId })
        
        if (count > config.maxMessages) {
          // 获取需要删除的消息
          const toDelete = await ctx.database.get('tldr_messages', { guildId: message.guildId }, {
            sort: { timestamp: 1 },
            limit: count - config.maxMessages
          })
          
          // 删除旧消息
          if (toDelete.length > 0) {
            await ctx.database.remove('tldr_messages', {
              id: { $in: toDelete.map(msg => msg.id) },
              guildId: message.guildId
            })
          }
        }
      }
    } catch (error) {
      ctx.logger.error('存储消息失败:', error)
    }
  }
  
  // 监听并存储消息
  ctx.middleware(async (session, next) => {
    if (!session.guildId) return next()
    
    // 存储消息到数据库
    await storeMessage({
      id: session.messageId,
      guildId: session.guildId,
      userId: session.userId,
      username: session.username || session.userId,
      content: session.content,
      timestamp: Date.now(),
      source: 'realtime'
    })
    
    return next()
  })
  
  // 处理 .tldr 命令
  ctx.command('tldr', '太长不看 - AI总结群聊消息')
    .action(async ({ session }) => {
      if (!session.guildId) {
        return '该命令只能在群组中使用'
      }
      
      // 创建会话状态
      const sessionId = `${session.guildId}-${session.userId}`
      sessionStore[sessionId] = {
        userId: session.userId,
        guildId: session.guildId,
        stage: 'start',
        firstMessageId: null,
        secondMessageId: null,
        startTime: Date.now(),
      }
      
      // 设置超时
      if (config.commandTimeout > 0) {
        setTimeout(() => {
          // 检查会话是否仍在进行中
          if (sessionStore[sessionId] && sessionStore[sessionId].stage !== 'completed') {
            // 通知用户命令已超时
            session.send('太长不看命令已超时，请重新开始。')
            // 删除会话
            delete sessionStore[sessionId]
          }
        }, config.commandTimeout * 1000)
      }
      
      return '请回复（引用）第一条消息，并且输入1'
    })
  
  // 监听回复消息
  ctx.middleware(async (session, next) => {
    // 检查是否有引用消息
    if (!session.quote || !session.guildId) return next()
    
    const sessionId = `${session.guildId}-${session.userId}`
    const collectSession = sessionStore[sessionId]
    
    // 检查是否存在有效的会话
    if (!collectSession || collectSession.userId !== session.userId) return next()
    
    // 获取引用的消息ID
    const quotedMessageId = session.quote.id
    
    // 处理第一条消息的回复
    if (collectSession.stage === 'start' && session.content === '1') {
      collectSession.firstMessageId = quotedMessageId
      collectSession.stage = 'waitForSecond'
      return '请回复（引用）第二条消息，并且输入2'
    }
    
    // 处理第二条消息的回复
    if (collectSession.stage === 'waitForSecond' && session.content === '2') {
      collectSession.secondMessageId = quotedMessageId
      collectSession.stage = 'processing'
      
      // 处理消息
      const result = await processMessages(session, collectSession.firstMessageId, collectSession.secondMessageId)
      
      // 标记会话为已完成
      collectSession.stage = 'completed'
      
      return result
    }
    
    return next()
  })
  
  // 处理消息并调用OpenAI API
  async function processMessages(session, firstMsgId, secondMsgId) {
    try {
      // 从数据库获取群组消息
      const messages = await ctx.database.get('tldr_messages', { guildId: session.guildId }, {
        sort: { timestamp: 1 }
      })
      
      if (messages.length === 0) {
        return '没有找到可总结的消息'
      }
      
      // 使用消息ID查找消息索引
      const firstIndex = messages.findIndex(msg => msg.id === firstMsgId)
      const secondIndex = messages.findIndex(msg => msg.id === secondMsgId)
      
      // 如果找不到消息，返回错误
      if (firstIndex < 0 || secondIndex < 0) {
        return '无法找到引用的消息，请确保引用的是已记录的消息'
      }
      
      // 确保开始索引小于结束索引
      let startIndex = firstIndex
      let endIndex = secondIndex
      if (startIndex > endIndex) {
        [startIndex, endIndex] = [endIndex, startIndex]
      }
      
      // 提取需要总结的消息
      const messagesToSummarize = messages.slice(startIndex, endIndex + 1)
      if (messagesToSummarize.length === 0) {
        return '选定的范围内没有消息'
      }
      
      // 格式化消息，替换图片
      const formattedMessages = messagesToSummarize.map(msg => {
        // 替换图片链接为[图片]标记
        const content = msg.content.replace(/\[CQ:image[^\]]*\]/g, '[图片]')
        return `${msg.username}: ${content}`
      }).join('\n')
      
      // 调用OpenAI API
      await session.send('正在总结消息，请稍候...')
      
      const response = await axios.post(
        config.openaiEndpoint,
        {
          model: config.openaiModel,
          messages: [
            {
              role: 'system',
              content: '以下是一段群组内的聊天记录，请你整理其中每个人各自的观点或者叙述，然后总结。'
            },
            {
              role: 'user',
              content: formattedMessages
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openaiApiKey}`
          }
        }
      )
      
      // 返回AI总结结果
      const summary = response.data.choices[0].message.content
      return `【太长不看】总结：\n${summary}`
    } catch (error) {
      ctx.logger.error('处理消息失败:', error)
      return `总结失败: ${error.message}`
    }
  }
  
  // 添加命令查看消息存储状态
  ctx.command('tldr.status', '查看消息存储状态')
    .action(async ({ session }) => {
      if (!session.guildId) {
        return '该命令只能在群组中使用'
      }
      
      try {
        // 获取当前群组的消息数量
        const count = await ctx.database.count('tldr_messages', { guildId: session.guildId })
        
        // 获取实时消息和历史消息的数量
        const realtimeCount = await ctx.database.count('tldr_messages', { 
          guildId: session.guildId,
          source: 'realtime'
        })
        
        const historyCount = await ctx.database.count('tldr_messages', { 
          guildId: session.guildId,
          source: 'history'
        })
        
        // 获取最早和最新的消息时间
        const earliest = await ctx.database.get('tldr_messages', { guildId: session.guildId }, {
          sort: { timestamp: 1 },
          limit: 1
        })
        
        const latest = await ctx.database.get('tldr_messages', { guildId: session.guildId }, {
          sort: { timestamp: -1 },
          limit: 1
        })
        
        const earliestTime = earliest.length > 0 
          ? new Date(earliest[0].timestamp).toLocaleString() 
          : '无'
        
        const latestTime = latest.length > 0 
          ? new Date(latest[0].timestamp).toLocaleString() 
          : '无'
        
        return `当前群组消息存储状态：
总消息数：${count}
实时消息：${realtimeCount}
历史消息：${historyCount}
最早消息时间：${earliestTime}
最新消息时间：${latestTime}
最大存储限制：${config.maxMessages === 0 ? '无限' : config.maxMessages}`
      } catch (error) {
        ctx.logger.error('获取消息存储状态失败:', error)
        return `获取状态失败: ${error.message}`
      }
    })
}
