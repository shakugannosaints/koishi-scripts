import { Context, h, Schema, Time } from 'koishi';
import { PNG } from 'pngjs';
import {} from 'koishi-plugin-puppeteer';

declare module 'koishi' {
  interface Events {
    'weather-screenshot/validate'(url: string): string | undefined;
  }
}

export const name = 'weather-screenshot';
export const inject = ['puppeteer'];

export interface Config {
  loadTimeout?: number;
  idleTimeout?: number;
  maxSize?: number;
  protocols?: string[];
}

export const Config: Schema<Config> = Schema.object({
  protocols: Schema
    .array(String)
    .description('允许的协议列表。')
    .default(['http', 'https']),
  maxSize: Schema
    .natural()
    .role('byte')
    .description('单张图片的最大尺寸，单位为字节。')
    .default(1920 * 4320),
  loadTimeout: Schema
    .natural()
    .role('ms')
    .description('加载页面的最长时间。')
    .default(Time.second * 5),
  idleTimeout: Schema
    .natural()
    .role('ms')
    .description('等待页面空闲的最长时间。')
    .default(Time.second * 30),
}).description('天气截图设置');

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('weather-screenshot');
  const { protocols, maxSize, loadTimeout, idleTimeout } = config;

  ctx.command('weather shot <city>', '天气预报截图')
    .alias('weather-screenshot')
    .option('full', '-f 对整个可滚动区域截图')
    .option('viewport', '-v <viewport:string> 指定视口')
    .action(async ({ session, options }, city) => {
      if (!city) return '请输入城市名。';
      options.full = true;
      const url = `https://weathernew.pae.baidu.com/weathernew/pc?query=${city}天气&srcid=4982&forecast=long_day_forecast`;
      const scheme = /^(\w+):\/\//.exec(url);
      if (!scheme || !protocols.includes(scheme[1])) {
        return '请输入正确的URL。';
      }

      const result = ctx.bail('weather-screenshot/validate', url);
      if (typeof result === 'string') return result;

      let loaded = false;
      const page = await ctx.puppeteer.page();
      page.on('load', () => loaded = true);

      try {
        if (options.viewport) {
          const viewport = options.viewport.split('x');
          const width = +viewport[0];
          const height = +viewport[1];
          await page.setViewport({ width, height });
        }

        await new Promise<void>((resolve, reject) => {
          logger.debug(`navigating to ${url}`);
          const _resolve = () => {
            clearTimeout(timer);
            resolve();
          };

          page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: idleTimeout,
          }).then(_resolve, () => {
            return loaded ? _resolve() : reject(new Error('navigation timeout'));
          });

          const timer = setTimeout(() => {
            return loaded
              ? session.send('正在加载中，请稍等片刻~')
              : reject(new Error('navigation timeout'));
          }, loadTimeout);
        });
      } catch (error) {
        page.close();
        logger.debug(error);
        return '无法打开页面。';
      }

      return page.screenshot({
        fullPage: options.full,
      }).then(async (buffer) => {
        if (buffer.byteLength > maxSize) {
          await new Promise<PNG>((resolve, reject) => {
            const png = new PNG();
            png.parse(buffer, (error, data) => {
              error ? reject(error) : resolve(data);
            });
          }).then((data) => {
            const width = data.width;
            const height = Math.floor(data.height * maxSize / buffer.byteLength);
            const png = new PNG({ width, height });
            data.bitblt(png, 0, 0, width, height, 0, 0);
            buffer = PNG.sync.write(png);
          }).catch(() => {});
        }
        return h.image(buffer, 'image/png');
      }, (error) => {
        logger.debug(error);
        return '截图失败。';
      }).finally(() => page.close());
    });
}