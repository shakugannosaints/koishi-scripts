import { Context, Schema } from 'koishi'
import { h } from 'koishi'
import { } from 'koishi-plugin-markdown-to-image-service'


// 定义配置项接口
export interface Config {
  wallColor: "🟩" | "🟪" | "🟧" | "🟨" | "🟦" | "🟫" | "🟥" | "⬛" | "⬜"
  pathColor: "🟩" | "🟪" | "🟧" | "🟨" | "🟦" | "🟫" | "🟥" | "⬛" | "⬜"
}

// 使用 schemastery 定义配置项
export const Config: Schema<Config> = Schema.object({
  wallColor: Schema.union(['🟩', '🟪', '🟧', '🟨', '🟦', '🟫', '🟥','⬛','⬜']).default('⬛'),
  pathColor: Schema.union(['🟩', '🟪', '🟧', '🟨', '🟦', '🟫', '🟥','⬛','⬜']).default('⬜'),
})

export const inject = ['markdownToImage']
export const name = 'dungeon-crafter'

export async function apply(ctx: Context, config: Config) {
  let width: number
  let height: number
  let property: number = 0.1 // Default value

  ctx.command('生成地城 <arg1> <arg2> <arg3>')
    .action(async (_, arg1, arg2, arg3) => {
      width = arg1 ? parseInt(arg1) : 25;
      height = arg2 ? parseInt(arg2) : 25;
      property = arg3 ? parseFloat(arg3) : 0.1;

      if (isNaN(width) || isNaN(height)) {
        return 'Invalid dimensions provided.'
      }

      let dungeonMap = generateMaze(width, height, property, config)
      let imageBuffer = await writeToFile(dungeonMap, ctx, config)
      return h.image(imageBuffer, 'image/png')
    })

  // 生成迷宫并应用颜色
  function generateMaze(width: number, height: number, property: number, config: Config): string[][] {
    const WALL = config.wallColor
    const PATH = config.pathColor
    let maze = Array.from({ length: height }, () => Array(width).fill(WALL))

    function carve(x: number, y: number) {
      const directions = [
        [0, 2],
        [2, 0],
        [0, -2],
        [-2, 0],
      ];
      shuffle(directions);

      // Randomly decide whether to create a room
      if (Math.random() < property) {
        createRoom(x, y);
      } else {
        directions.forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          const mx = x + dx / 2;
          const my = y + dy / 2;

          if (nx > 0 && nx < width && ny > 0 && ny < height && maze[ny][nx] === WALL) {
            maze[ny][nx] = PATH;
            maze[my][mx] = PATH;
            carve(nx, ny);
          }
        });
      }
    }

    function createRoom(x: number, y: number) {
      const roomWidth = Math.floor(Math.random() * 3) + 3;
      const roomHeight = Math.floor(Math.random() * 3) + 3;
      const startX = x - Math.floor(roomWidth / 2);
      const startY = y - Math.floor(roomHeight / 2);

      for (let i = startY; i < startY + roomHeight; i++) {
        for (let j = startX; j < startX + roomWidth; j++) {
          if (i >= 0 && i < height && j >= 0 && j < width) {
            maze[i][j] = PATH;
          }
        }
      }
    }

    function shuffle(array: any[]) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    maze[1][1] = PATH;
    carve(1, 1);

    return maze;
  }

  // 写入文件的函数也需要更新以处理颜色
  async function writeToFile(map: string[][], ctx: Context, config: Config) {
    const markdownMap = map.map(row => row.join('')).join('\n')
    const imageBuffer = await ctx.markdownToImage.convertToImage(markdownMap)
    return imageBuffer
  }
}