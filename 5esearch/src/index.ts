import { Context, Schema,h} from 'koishi'
import * as fs from 'fs'
import * as path from 'path'

export const name = '5esearch'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  const simpleGit = require('simple-git');
  const git = simpleGit();
  const repoUrl = 'https://github.com/DND5eChm/5echm_web';
  const localPath = './data/5echm_web';

  // 检查本地目录是否存在
  function checkLocalRepoExists() {
    return fs.existsSync(localPath);
  }

  // 克隆 GitHub 仓库
  async function cloneRepo() {
    try {
      if (!checkLocalRepoExists()) {
        console.log('仓库不存在，开始克隆，请等待。这需要一段时间。如果出现未知错误，请看readme。');
        await git.clone(repoUrl, localPath);
      } else {
        console.log('仓库已经存在于本地。');
      }
    } catch (error) {
      console.error('克隆仓库时发生错误:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
  let match;
  let results = [];
  let resultsf = [];
  let allfinds = [];
  // 遍历文件系统并搜索单词
  function searchWordInFiles(dir, word, session) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        searchWordInFiles(filePath, word, session);
      } else if (stat.isFile() && (filePath.endsWith('.html') || filePath.endsWith('.htm'))) {
        const fileNameWithoutExt = path.basename(file, path.extname(file));
        const content = fs.readFileSync(filePath, 'utf8');
        const regex = new RegExp(`<H. id="[^"]*">${word}[^<]*</H.>(.*?)<P>(.*?)</P>`, 'gs');//这里其实是对法术格式专用的匹配

        // 检查文件名是否与输入的单词完全匹配
        if (fileNameWithoutExt === word) {
          const bodyf = content
            .replace(/.*true;};/gs,'')
            .replace(/<[^>]+>/gs, '')  // 去除所有 HTML 标签
            .replace(/\s+/gs, '')     // 去除多余的空格、换行符和制表符
            .replace(/\\n/gs, '')     // 去除 JSON 字符串中的 \n
            .replace(/&nbsp;/gs,'')  // &nbsp;
            .replace(/}/gs,'')        //段首}
            .trim();                  // 去除字符串两端的空格
            if (resultsf.length == 0){
              resultsf.push(`以下为文件名完全匹配${word}的文件`)
            }
            resultsf.push(bodyf);
        }
        
        while ((match = regex.exec(content)) !== null) {
          const body = match[0]
            .replace(/.*true;};/gs,'')
            .replace(/<[^>]+>/gs, '')  // 去除所有 HTML 标签
            .replace(/\s+/gs, '')     // 去除多余的空格、换行符和制表符
            .replace(/\\n/gs, '')     // 去除 JSON 字符串中的 \n
            .replace(/&nbsp;/gs,'')  // &nbsp;
            .replace(/}/gs,'')        //段首}
            .trim();                  // 去除字符串两端的空格
          results.push(body);
        }
        if (content.includes(word) ) {
          if (allfinds.length == 0){
            allfinds.push(`以下为包含${word}的文件。如果没有找到想要的内容，你可以直接搜索文件名（不包含后缀）`)
          }
          allfinds.push(`${filePath}` );
         }

      }
    });
  }
 // 在 Koishi 上下文中集成这些功能
 ctx.command('search <word>', '在仓库中搜索单词')
 .action(async ({ session }, word) => {
   await cloneRepo();
   searchWordInFiles(localPath, word, session);
    //打包过长的消息。注意，这里的长度是以字节为单位的，而不是字符数。另外，如果打包消息过长也会发不出去。请确保设置合理。
   const sendMessage = (message: string) => {
     const maxLength = 1500;
     const msg = [];
     for (let i = 0; i < message.length; i += maxLength) {
       msg.push(h('message', message.substring(i, i + maxLength)));
       if (msg.length > 5) {
        session.send('搜索内容过长，已截断')
        break;
      }
     }
    return h('message', { forward: true }, ...msg);
    };
    //避免重复发送。这样写是为了修改判断逻辑的时候以及拓展逻辑时方便
    if (resultsf.length > 0) {
      session.send(sendMessage(resultsf.join('\n')));
    }; 
   if ((results.length > 0)&&(!(resultsf.length > 0))) {
    session.send(sendMessage(results.join('\n')));
    };
    if ((allfinds.length > 0)&&((!(results.length > 0))&&(!(resultsf.length > 0)))) {
      session.send(sendMessage(allfinds.join('\n')));
    };
    if ((!(results.length > 0))&&(!(resultsf.length > 0))&&(!(allfinds.length > 0))) {
      session.send('没有找到相关内容。');
    }
    //重置全局变量，避免影响下次搜索
   match = null;
   results = [];
   resultsf = [];
   allfinds = [];
 });
}