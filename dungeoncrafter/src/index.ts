import { Context } from 'koishi'
import { h } from 'koishi'
import { } from 'koishi-plugin-markdown-to-image-service'
export const inject = ['markdownToImage']
export const name = 'dungeon-crafter'
export async function apply(ctx: Context) {
  let width: number;
  let height: number;

  ctx.command('生成地城 <arg1> <arg2>')
    .action(async (_, arg1, arg2) => {
      width = parseInt(arg1);
      height = parseInt(arg2);

      if (isNaN(width) || isNaN(height)) {
        return ('Invalid dimensions provided.');
      }
      let dungeonMap = generateMaze(width, height);
      let crx = await writeToFile(dungeonMap, ctx);
      return h.image(crx,'image/png');
    });
//generate maze to dungeon
    function generateMaze(width: number, height: number): string[][] {
      const WALL = '⬛';
      const PATH = '⬜';
      let maze = Array.from({ length: height }, () => Array(width).fill(WALL));
    
      function carve(x: number, y: number) {
        const directions = [
          [0, 2],
          [2, 0],
          [0, -2],
          [-2, 0],
        ];
        shuffle(directions);
        
        // Randomly decide whether to create a room
        if (Math.random() < 0.1) { // 10% chance of creating a room
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
        // Create a room around the current position
        const roomWidth = Math.floor(Math.random() * 3) + 3; // 3-5 cells wide
        const roomHeight = Math.floor(Math.random() * 3) + 3; // 3-5 cells high
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

  // Write the map to a file
  async function writeToFile(map: string[][], ctx: Context) {
    const markdownMap = map.map(row => row.join('')).join('\n');
    const imageBuffer = await ctx.markdownToImage.convertToImage(markdownMap);
    return imageBuffer;
  }
}
