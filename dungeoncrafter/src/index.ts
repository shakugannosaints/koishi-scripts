import { Context, Schema } from 'koishi'
import { } from '@koishijs/canvas'

// Define the configuration interface
export interface Config {
  wallColor: string
  pathColor: string
  RoomMin: number
  RoomMax: number
  mazeMax: number
  mazeMin: number
}

// Define the configuration schema using schemastery
export const Config: Schema<Config> = Schema.object({
  
  wallColor: Schema.string().role('color'),
  pathColor: Schema.string().role('color'),
  RoomMin: Schema.number().min(1).max(500).default(3),
  RoomMax: Schema.number().min(1).max(500).default(5),
  mazeMax: Schema.number().min(2).max(850).default(500),
  mazeMin: Schema.number().min(2).max(850).default(3)
})

export const inject = ['canvas']
export const name = 'dungeon-crafter'

export async function apply(ctx: Context, config: Config) {
  let width: number
  let height: number
  let property: number

  ctx.command('生成地城 <arg1> <arg2> <arg3>')
    .action(async ({session}, arg1, arg2, arg3) => {
      const memin = config.mazeMin;
      const memax = config.mazeMax;
      width = arg1 ? parseInt(arg1) : 25;
      height = arg2 ? parseInt(arg2) : 25;
      property = arg3 ? parseFloat(arg3) : 0.1;
      if (isNaN(width) || isNaN(height)) {
        return 'Invalid dimensions provided.'
      }
      if ((width < memin) || (width > memax)){
        width = 25;
        session.send('输入无效，已重设宽度为25');
      }
      if ((height < memin) || (height > memax)){
        height = 25;
        session.send('输入无效，已重设高度为25');
      }
      if ((property < 0) || (property >= 1)){
        property = 0.1;
        session.send('输入无效，已重设房间生成概率为0.1');
      }
      let dungeonMap = generateMaze(width, height, property, config)
      let imageBuffer = await writeToFile(dungeonMap, config)
      return imageBuffer
    })

  function generateMaze(width: number, height: number, property: number, config: Config): string[][] {
    const WALL = config.wallColor
    const PATH = config.pathColor
    let maze = Array.from({ length: height }, () => Array(width).fill(WALL))

    function carve(startX: number, startY: number) {
      const stack: [number, number][] = [[startX, startY]];
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const directions = [
          [0, 2],
          [2, 0],
          [0, -2],
          [-2, 0],
        ];
        shuffle(directions);
    
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
              stack.push([nx, ny]);
            }
          });
        }
      }
    }
    function createRoom(x: number, y: number) {
      const min = config.RoomMin;
      const max = config.RoomMax;
      const roomWidth = Math.floor(Math.random() * (max-min)) + min;
      const roomHeight = Math.floor(Math.random() * (max-min)) + min;
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

  async function writeToFile(map: string[][], config: Config) {
    const cellSize = 20; // Define the size of each cell
    const width = map[0].length * cellSize;
    const height = map.length * cellSize;
  
    // Helper function to get the opposite color in RGBA format
    function getOppositeColor(color: string): string {
      const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
      return `rgba(${255 - r}, ${255 - g}, ${255 - b}, 1)`;
    }
  
    return ctx.canvas.render(width, height, (ctx) => {
      const WALL_COLOR = config.wallColor;
      const PATH_COLOR = config.pathColor;
      const WALL_GRID_COLOR = getOppositeColor(WALL_COLOR);
      const PATH_GRID_COLOR = getOppositeColor(PATH_COLOR);
  
      // Draw the actual cells
      map.forEach((row, y) => {
        row.forEach((cell, x) => {
          ctx.fillStyle = cell === WALL_COLOR ? WALL_COLOR : PATH_COLOR;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          
          // Draw grid lines for walls
          if (cell === WALL_COLOR) {
            ctx.strokeStyle = WALL_GRID_COLOR;
            ctx.beginPath();
            ctx.moveTo(x * cellSize, y * cellSize);
            ctx.lineTo((x + 1) * cellSize, y * cellSize);
            ctx.moveTo(x * cellSize, y * cellSize);
            ctx.lineTo(x * cellSize, (y + 1) * cellSize);
            ctx.stroke();
          }
  
          // Draw grid lines for paths
          if (cell === PATH_COLOR) {
            ctx.strokeStyle = PATH_GRID_COLOR;
            ctx.beginPath();
            ctx.moveTo(x * cellSize, y * cellSize);
            ctx.lineTo((x + 1) * cellSize, y * cellSize);
            ctx.moveTo(x * cellSize, y * cellSize);
            ctx.lineTo(x * cellSize, (y + 1) * cellSize);
            ctx.stroke();
          }
        });
      });

    });
  }
}
