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
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var inject = ["markdownToImage"];
var name = "dungeon-crafter";
async function apply(ctx) {
  let width;
  let height;
  ctx.command("生成地城 <arg1> <arg2>").action(async (_, arg1, arg2) => {
    width = parseInt(arg1);
    height = parseInt(arg2);
    if (isNaN(width) || isNaN(height)) {
      return "Invalid dimensions provided.";
    }
    let dungeonMap = generateMaze(width, height);
    let crx = await writeToFile(dungeonMap, ctx);
    return import_koishi.h.image(crx, "image/png");
  });
  function generateMaze(width2, height2) {
    const WALL = "⬛";
    const PATH = "⬜";
    let maze = Array.from({ length: height2 }, () => Array(width2).fill(WALL));
    function carve(x, y) {
      const directions = [
        [0, 2],
        [2, 0],
        [0, -2],
        [-2, 0]
      ];
      shuffle(directions);
      if (Math.random() < 0.1) {
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
            carve(nx, ny);
          }
        });
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
  async function writeToFile(map, ctx2) {
    const markdownMap = map.map((row) => row.join("")).join("\n");
    const imageBuffer = await ctx2.markdownToImage.convertToImage(markdownMap);
    return imageBuffer;
  }
  __name(writeToFile, "writeToFile");
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  apply,
  inject,
  name
});
