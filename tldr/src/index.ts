const { Context, Schema } = require('koishi')
const axios = require('axios')

// 插件配置项
exports.name = 'tldr'
exports.description = '太长不看 - AI总结群聊消息的功能'
exports.usage = '使用 .tldr 命令启动消息总结流程'

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
  Textlimit: Schema.number()
    .description('命令文本限制，超过该长度将被截断')
    .default(60000)
})

// 插件主体
exports.apply = (ctx, config) => {
  // 创建消息存储
  const messageStore = {}
  // 创建命令会话存储
  const sessionStore = {}
  
  // 监听并存储消息
  ctx.middleware(async (session, next) => {
    if (!session.guildId) return next()
    
    // 初始化群组消息存储
    if (!messageStore[session.guildId]) {
      messageStore[session.guildId] = []
    }
    
    // 存储消息，确保包含消息ID
    messageStore[session.guildId].push({
      id: session.messageId, // 存储真实的消息ID
      userId: session.userId,
      username: session.username || session.userId,
      content: session.content,
      timestamp: Date.now(),
    })
    
    // 如果设置了最大消息数量且不为0，则删除超出部分
    if (config.maxMessages > 0 && messageStore[session.guildId].length > config.maxMessages) {
      messageStore[session.guildId] = messageStore[session.guildId].slice(-config.maxMessages)
    }
    
    return next()
  })

  //处理tldr
  ctx.command('tldr [count:number] [...names:string]', '太长不看 - AI总结群聊消息')
  .action(async ({ session }, count, ...names) => {
    if (!session.guildId) {
      return '该命令只能在群组中使用'
    }

    // 如果提供了数字参数，直接总结最近的n条消息
    if (count && Number.isInteger(count)) {
      // 获取群组消息
      const messages = messageStore[session.guildId] || []
      if (messages.length === 0) {
        return '没有找到可总结的消息'
      }

      // 获取最近的n条消息，但不超过现有消息数量
      const messageCount = Math.min(count, messages.length)
      const messagesToSummarize = messages.slice(-messageCount)

      // 如果提供了特定用户名，过滤消息
      const filteredMessages = names.length > 0
        ? messagesToSummarize.filter(msg => names.includes(msg.username))
        : messagesToSummarize

      if (filteredMessages.length === 0) {
        return `没有找到${names.join('、')}的相关消息`
      }

      // 格式化消息，计算字符数
      const formattedMessages = filteredMessages.map(msg => {
        const content = msg.content.replace(/\[CQ:image[^\]]*\]/g, '[图片]')
        return `${msg.username}: ${content}`
      }).join('\n')

      // 检查字符数是否超过限制
      if (formattedMessages.length > config.Textlimit) {
        return `总结失败：选择的消息内容超过60000字符(当前${formattedMessages.length}字符)，请减少消息数量`
      }

      // 调整提示词
      const prompt = names.length > 0
        ? `以下是一段群组内的聊天记录，请你整理其中每个人各自的观点或者叙述，然后总结。只需要总结以下用户的发言：${names.join('、')}。`
        : '以下是一段群组内的聊天记录，请你整理其中每个人各自的观点或者叙述，然后总结。'

      // 调用OpenAI API
      try {
        await session.send(`正在总结最近的${messageCount}条消息，请稍候...`)

        const response = await axios.post(
          config.openaiEndpoint,
          {
            model: config.openaiModel,
            messages: [
              {
                role: 'system',
                content: prompt
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
        return `【太长不看】最近${messageCount}条消息总结：\n${summary}`
      } catch (error) {
        console.error('OpenAI API调用失败:', error)
        return `总结失败: ${error.message}`
      }
    }

    return '请提供消息数量，例如 .tldr 100'
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
    // 获取群组消息
    const messages = messageStore[session.guildId] || []
    if (messages.length === 0) {
      return '没有找到可总结的消息'
    }
    
    // 使用消息ID查找消息索引
    const firstIndex = messages.findIndex(msg => msg.id === firstMsgId)
    const secondIndex = messages.findIndex(msg => msg.id === secondMsgId)
    
    // 如果找不到消息，返回错误
    if (firstIndex < 0 || secondIndex < 0) {
      return '无法找到引用的消息，请确保引用的是最近的消息'
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
    try {
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
      console.error('OpenAI API调用失败:', error)
      return `总结失败: ${error.message}`
    }
  }
}
