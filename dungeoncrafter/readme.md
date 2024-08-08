# koishi-plugin-dungeoncrafter

[![npm](https://img.shields.io/npm/v/koishi-plugin-dungeoncrafter?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-dungeoncrafter)

create dungeons by random  

usage: `生成地城 <int> <int> <float>`  

example: `.生成地城 25 25 0.1`  

explane: 生成一个25*25的随机地城。0.1控制生成房间概率。该参数为0时不会生成任何房间，也即会输出一个纯粹的，每条path只有1宽度的迷宫。不要试图生成四位数级别边长的地城。never

config: 你可以在设置里配置墙体和地面的颜色，控制房间最小边长和最大边长
