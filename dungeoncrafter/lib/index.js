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
  wallColor: import_koishi.Schema.union(["green", "purple", "orange", "yellow", "blue", "brown", "red", "black", "white"]).default("black"),
  pathColor: import_koishi.Schema.union(["green", "purple", "orange", "yellow", "blue", "brown", "red", "black", "white"]).default("white")
});
var inject = ["canvas"];
var name = "dungeon-crafter";
async function apply(ctx, config) {
  let width;
  let height;
  let property = 0.1;
  ctx.command("生成地城 <arg1> <arg2> <arg3>").action(async (_, arg1, arg2, arg3) => {
    width = arg1 ? parseInt(arg1) : 25;
    height = arg2 ? parseInt(arg2) : 25;
    property = arg3 ? parseFloat(arg3) : 0.1;
    if (isNaN(width) || isNaN(height)) {
      return "Invalid dimensions provided.";
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
      const roomWidth = Math.floor(Math.random() * 3) + 3;
      const roomHeight = Math.floor(Math.random() * 3) + 3;
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
    return ctx.canvas.render(width2, height2, (ctx2) => {
      const WALL_COLOR = config2.wallColor;
      const PATH_COLOR = config2.pathColor;
      map.forEach((row, y) => {
        row.forEach((cell, x) => {
          ctx2.fillStyle = cell === WALL_COLOR ? WALL_COLOR : PATH_COLOR;
          ctx2.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
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
