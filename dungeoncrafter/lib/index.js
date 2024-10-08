var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var Config = import_koishi.Schema.object({
  wallColor: import_koishi.Schema.string().role("color"),
  pathColor: import_koishi.Schema.string().role("color"),
  RoomMin: import_koishi.Schema.number().min(1).max(500).default(3),
  RoomMax: import_koishi.Schema.number().min(1).max(500).default(5),
  mazeMax: import_koishi.Schema.number().min(2).max(850).default(500),
  mazeMin: import_koishi.Schema.number().min(2).max(850).default(3)
});
var inject = ["canvas"];
var name = "dungeon-crafter";
async function apply(ctx, config) {
  let width;
  let height;
  let property;
  ctx.command("生成地城 <width:number> <height:number> <property:number>").action(async ({
    session
    /*, args, options*/
  }, arg1, arg2, arg3) => {
    const memin = config.mazeMin;
    const memax = config.mazeMax;
    width = arg1 ?? memin;
    height = arg2 ?? memin;
    property = arg3 ?? 0.1;
    if (isNaN(width) || isNaN(height)) {
      return "Invalid dimensions provided.";
    }
    if (width < memin || width > memax) {
      width = 25;
      session.send("输入无效，已重设宽度为25");
    }
    if (height < memin || height > memax) {
      height = 25;
      session.send("输入无效，已重设高度为25");
    }
    if (property < 0 || property >= 1) {
      property = 0.1;
      session.send("输入无效，已重设房间生成概率为0.1");
    }
    let dungeonMap = generateMaze(width, height, property, config);
    let imageBuffer = await writeToFile(dungeonMap, config);
    return imageBuffer;
  });
  function generateMaze(width2, height2, property2, config2) {
    const WALL = config2.wallColor;
    const PATH = config2.pathColor;
    let maze = Array.from({ length: height2 }, () => Array(width2).fill(WALL));
    function carve(startX, startY) {
      const stack = [[startX, startY]];
      while (stack.length > 0) {
        const [x, y] = stack.pop();
        const directions = [
          [0, 2],
          [2, 0],
          [0, -2],
          [-2, 0]
        ];
        shuffle(directions);
        if (Math.random() < property2) {
          createRoom(x, y);
        } else {
          directions.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            const mx = x + dx / 2;
            const my = y + dy / 2;
            if (nx > 0 && nx < width2 && ny > 0 && ny < height2 && maze[ny][nx] === WALL) {
              maze[ny][nx] = PATH;
              maze[my][mx] = PATH;
              stack.push([nx, ny]);
            }
          });
        }
      }
    }
    __name(carve, "carve");
    function createRoom(x, y) {
      const min = config2.RoomMin;
      const max = config2.RoomMax;
      const roomWidth = Math.floor(Math.random() * (max - min)) + min;
      const roomHeight = Math.floor(Math.random() * (max - min)) + min;
      const startX = x - Math.floor(roomWidth / 2);
      const startY = y - Math.floor(roomHeight / 2);
      for (let i = startY; i < startY + roomHeight; i++) {
        for (let j = startX; j < startX + roomWidth; j++) {
          if (i >= 0 && i < height2 && j >= 0 && j < width2) {
            maze[i][j] = PATH;
          }
        }
      }
    }
    __name(createRoom, "createRoom");
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
    __name(shuffle, "shuffle");
    maze[1][1] = PATH;
    carve(1, 1);
    return maze;
  }
  __name(generateMaze, "generateMaze");
  async function writeToFile(map, config2) {
    const cellSize = 20;
    const width2 = map[0].length * cellSize;
    const height2 = map.length * cellSize;
    function getOppositeColor(color) {
      const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
      return `rgba(${255 - r}, ${255 - g}, ${255 - b}, 1)`;
    }
    __name(getOppositeColor, "getOppositeColor");
    return ctx.canvas.render(width2, height2, (ctx2) => {
      const WALL_COLOR = config2.wallColor;
      const PATH_COLOR = config2.pathColor;
      const WALL_GRID_COLOR = getOppositeColor(WALL_COLOR);
      const PATH_GRID_COLOR = getOppositeColor(PATH_COLOR);
      map.forEach((row, y) => {
        row.forEach((cell, x) => {
          ctx2.fillStyle = cell === WALL_COLOR ? WALL_COLOR : PATH_COLOR;
          ctx2.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          if (cell === WALL_COLOR) {
            ctx2.strokeStyle = WALL_GRID_COLOR;
            ctx2.beginPath();
            ctx2.moveTo(x * cellSize, y * cellSize);
            ctx2.lineTo((x + 1) * cellSize, y * cellSize);
            ctx2.moveTo(x * cellSize, y * cellSize);
            ctx2.lineTo(x * cellSize, (y + 1) * cellSize);
            ctx2.stroke();
          }
          if (cell === PATH_COLOR) {
            ctx2.strokeStyle = PATH_GRID_COLOR;
            ctx2.beginPath();
            ctx2.moveTo(x * cellSize, y * cellSize);
            ctx2.lineTo((x + 1) * cellSize, y * cellSize);
            ctx2.moveTo(x * cellSize, y * cellSize);
            ctx2.lineTo(x * cellSize, (y + 1) * cellSize);
            ctx2.stroke();
          }
        });
      });
    });
  }
  __name(writeToFile, "writeToFile");
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});
