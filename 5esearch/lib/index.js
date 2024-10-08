var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var name = "5esearch";
var Config = import_koishi.Schema.object({});
function apply(ctx) {
  const simpleGit = require("simple-git");
  const git = simpleGit();
  const repoUrl = "https://github.com/DND5eChm/5echm_web";
  const localPath = "./data/5echm_web";
  function checkLocalRepoExists() {
    return fs.existsSync(localPath);
  }
  __name(checkLocalRepoExists, "checkLocalRepoExists");
  async function cloneRepo() {
    try {
      if (!checkLocalRepoExists()) {
        console.log("仓库不存在，开始克隆，请等待。这需要一段时间。如果出现未知错误，请看readme。");
        await git.clone(repoUrl, localPath);
      } else {
        console.log("仓库已经存在于本地。");
      }
    } catch (error) {
      console.error("克隆仓库时发生错误:", error.message);
      console.error("错误堆栈:", error.stack);
    }
  }
  __name(cloneRepo, "cloneRepo");
  let match;
  let results = [];
  let resultsf = [];
  let allfinds = [];
  function searchWordInFiles(dir, word, session) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        searchWordInFiles(filePath, word, session);
      } else if (stat.isFile() && (filePath.endsWith(".html") || filePath.endsWith(".htm"))) {
        const fileNameWithoutExt = path.basename(file, path.extname(file));
        const content = fs.readFileSync(filePath, "utf8");
        const regex = new RegExp(`<H. id="[^"]*">${word}[^<]*</H.>(.*?)<P>(.*?)</P>`, "gs");
        if (fileNameWithoutExt === word) {
          const bodyf = content.replace(/.*true;};/gs, "").replace(/<[^>]+>/gs, "").replace(/\s+/gs, "").replace(/\\n/gs, "").replace(/&nbsp;/gs, "").replace(/}/gs, "").trim();
          if (resultsf.length == 0) {
            resultsf.push(`以下为文件名完全匹配${word}的文件`);
          }
          resultsf.push(bodyf);
        }
        while ((match = regex.exec(content)) !== null) {
          const body = match[0].replace(/.*true;};/gs, "").replace(/<[^>]+>/gs, "").replace(/\s+/gs, "").replace(/\\n/gs, "").replace(/&nbsp;/gs, "").replace(/}/gs, "").trim();
          results.push(body);
        }
        if (content.includes(word)) {
          if (allfinds.length == 0) {
            allfinds.push(`以下为包含${word}的文件。如果没有找到想要的内容，你可以直接搜索文件名（不包含后缀）`);
          }
          allfinds.push(`${filePath}`);
        }
      }
    });
  }
  __name(searchWordInFiles, "searchWordInFiles");
  ctx.command("search <word>", "在仓库中搜索单词").action(async ({ session }, word) => {
    await cloneRepo();
    searchWordInFiles(localPath, word, session);
    const sendMessage = /* @__PURE__ */ __name((message) => {
      const maxLength = 1500;
      const msg = [];
      for (let i = 0; i < message.length; i += maxLength) {
        msg.push((0, import_koishi.h)("message", message.substring(i, i + maxLength)));
        if (msg.length > 5) {
          session.send("搜索内容过长，已截断");
          break;
        }
      }
      return (0, import_koishi.h)("message", { forward: true }, ...msg);
    }, "sendMessage");
    if (resultsf.length > 0) {
      session.send(sendMessage(resultsf.join("\n")));
    }
    ;
    if (results.length > 0 && !(resultsf.length > 0)) {
      session.send(sendMessage(results.join("\n")));
    }
    ;
    if (allfinds.length > 0 && (!(results.length > 0) && !(resultsf.length > 0))) {
      session.send(sendMessage(allfinds.join("\n")));
    }
    ;
    if (!(results.length > 0) && !(resultsf.length > 0) && !(allfinds.length > 0)) {
      session.send("没有找到相关内容。");
    }
    match = null;
    results = [];
    resultsf = [];
    allfinds = [];
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
