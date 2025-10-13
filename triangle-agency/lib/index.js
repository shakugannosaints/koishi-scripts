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
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var import_path = require("path");
var name = "triangle-agency";
var Config = import_koishi.Schema.object({
  maxExecTimes: import_koishi.Schema.number().default(5).description("多次检定上限值"),
  checkPrefix: import_koishi.Schema.string().default("{player}的“{attrText}”能力使用已批准……\n").description("检定回复前缀，支持变量：{player}、{attrText}"),
  successMsg: import_koishi.Schema.string().default("这一瞬间，现实为你而扭曲。").description("成功时的提示语"),
  failureMsg: import_koishi.Schema.string().default("它冰冷而不可撼动，仿若一座黑色的方尖碑。").description("失败时的提示语"),
  bigSuccessMsg: import_koishi.Schema.string().default("三尖冠——天命昭昭。").description("大成功时的提示语"),
  successShortMsg: import_koishi.Schema.string().default("成功").description("成功时的简短提示语"),
  failureShortMsg: import_koishi.Schema.string().default("失败").description("失败时的简短提示语"),
  bigSuccessShortMsg: import_koishi.Schema.string().default("大成功").description("大成功时的简短提示语"),
  excessiveMsg: import_koishi.Schema.string().default("检定轮数过多，机构不予支持。").description("多次检定超过上限时的提示语")
}).description("三角机构（Triangle Agency）规则配置");
function apply(ctx, config) {
  ctx.inject(["console"], (ctx2) => {
    ctx2.console?.addEntry?.({
      dev: (0, import_path.resolve)(__dirname, "../client/index.ts"),
      prod: (0, import_path.resolve)(__dirname, "../dist")
    });
  });
  ctx.model.extend(
    "ta-state",
    {
      platform: "string",
      guildId: "string",
      chaos: "integer",
      raFail: "integer"
    },
    { primary: ["platform", "guildId"] }
  );
  ctx.model.extend(
    "ta-attrs",
    {
      platform: "string",
      guildId: "string",
      userId: "string",
      attrs: "json"
    },
    { primary: ["platform", "guildId", "userId"] }
  );
  ctx.command("ta <attr:string>", "三角机构：技能检定（.ta <属性名/质保数量>）").option("c", "-c 不修改混沌值").option("x", "-x <times:number> 重复次数，默认1").example(".ta 2 -x 3").action(async ({ session, options }, attr) => runCheck(ctx, config, session, attr, false, options));
  ctx.command("tr <attr:string>", "三角机构：现实改写检定（.tr <属性名/质保数量>）").option("c", "-c 不修改混沌值").option("f", "-f 不占用改写失败次数").option("x", "-x <times:number> 重复次数，默认1").example(".tr -1 -x 2").action(async ({ session, options }, attr) => runCheck(ctx, config, session, attr, true, options));
  ctx.command("tcs [delta:number]", "三角机构：混沌值管理（省略参数显示当前值；正数为消除，负数为增加）").action(async ({ session }, delta) => {
    const state = await getOrCreateState(ctx, session);
    if (delta === void 0 || delta === null || Number.isNaN(Number(delta))) {
      return `当前群内混沌指数: ${state.chaos}`;
    }
    const old = state.chaos;
    const newValue = old - Number(delta);
    await ctx.database.set("ta-state", { platform: session.platform, guildId: session.guildId }, { chaos: newValue });
    return `当前混沌值: ${old} → ${newValue}`;
  });
  ctx.command("tcst <value:number>", "三角机构：设置混沌值为指定数值").action(async ({ session }, value) => {
    const state = await getOrCreateState(ctx, session);
    const old = state.chaos;
    const newValue = Number(value);
    if (Number.isNaN(newValue)) return "解析出错：请输入数字";
    await ctx.database.set("ta-state", { platform: session.platform, guildId: session.guildId }, { chaos: newValue });
    return `当前混沌值: ${old} → ${newValue}`;
  });
  ctx.command("tfs [delta:number]", "三角机构：现实改写失败管理（省略参数显示；正数为消除，负数为增加）").action(async ({ session }, delta) => {
    const state = await getOrCreateState(ctx, session);
    if (delta === void 0 || delta === null || Number.isNaN(Number(delta))) {
      return `当前地点现实改写失败次数: ${state.raFail}`;
    }
    const old = state.raFail;
    const newValue = old - Number(delta);
    await ctx.database.set("ta-state", { platform: session.platform, guildId: session.guildId }, { raFail: newValue });
    return `当前地点现实改写失败次数: ${old} → ${newValue}`;
  });
  ctx.command("tfst <value:number>", "三角机构：设置现实改写失败次数为指定数值").action(async ({ session }, value) => {
    const state = await getOrCreateState(ctx, session);
    const old = state.raFail;
    const newValue = Number(value);
    if (Number.isNaN(newValue)) return "解析出错：请输入数字";
    await ctx.database.set("ta-state", { platform: session.platform, guildId: session.guildId }, { raFail: newValue });
    return `当前地点现实改写失败次数: ${old} → ${newValue}`;
  });
  ctx.command("st <raw:text>", "三角机构：设置角色属性，例：.st 专注3共情3仪态-1").action(async ({ session }, raw) => {
    if (!session?.guildId) return "请在群聊中使用该命令";
    if (!raw) return "请输入属性设置，如：.st 专注3共情3仪态0";
    const pairs = parseAttrPairs(String(raw));
    if (pairs.length === 0) return "未解析到“属性=数值”对，格式示例：专注3共情-1";
    const ua = await getOrCreateUserAttrs(ctx, session);
    const attrs = { ...ua.attrs || {} };
    const changes = [];
    for (const [nameRaw, val] of pairs) {
      const canon = resolveAttrName(nameRaw) || nameRaw;
      attrs[canon] = val;
      changes.push(`${canon}=${val}`);
    }
    await ctx.database.set("ta-attrs", { platform: session.platform, guildId: session.guildId, userId: session.userId }, { attrs });
    return `已设置属性：${changes.join("，")}`;
  });
}
__name(apply, "apply");
async function runCheck(ctx, config, session, attrInput, isTR, options) {
  if (!session.guildId) return "请在群聊中使用该命令";
  const times = clampInt(options?.x ?? 1, 1, config.maxExecTimes);
  if ((options?.x ?? 1) > config.maxExecTimes) {
    return config.excessiveMsg;
  }
  if (!attrInput && attrInput !== "0") {
    return "请提供属性名或质保数量（整数，可为负）";
  }
  let attributeValue = null;
  let attrText = String(attrInput);
  if (/^[+-]?\d+$/.test(attrInput)) {
    attributeValue = Number(attrInput);
  } else {
    const canon = resolveAttrName(attrInput) || attrInput;
    const ua = await getOrCreateUserAttrs(ctx, session);
    const stored = (ua.attrs || {})[canon];
    if (typeof stored === "number") {
      attributeValue = stored;
    } else {
      return `解析出错或属性不存在：${attrInput}`;
    }
  }
  const attributeValueNum = Number(attributeValue);
  const state = await getOrCreateState(ctx, session);
  const failureBurnout = isTR ? state.raFail : 0;
  const abilityBurnout = attributeValueNum > 0 ? 0 : Math.abs(attributeValueNum) + 1;
  const totalBurnout = abilityBurnout + failureBurnout;
  let chaosGeneratedTotal = 0;
  let failuresGeneratedTotal = 0;
  const results = [];
  for (let i = 0; i < times; i++) {
    const intermediate = roll6d4();
    const threeCountOriginal = intermediate.filter((v) => v === 3).length;
    const threeCountBurned = threeCountOriginal - totalBurnout;
    const markedIntermediate = markResults([...intermediate], totalBurnout);
    const useShort = times > 1;
    if (threeCountBurned === 3) {
      const msg = useShort ? config.bigSuccessShortMsg : config.bigSuccessMsg;
      results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`);
    } else if (threeCountBurned > 0) {
      const msg = useShort ? config.successShortMsg : config.successMsg;
      results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`);
      chaosGeneratedTotal += 6 - threeCountBurned;
    } else {
      const msg = useShort ? config.failureShortMsg : config.failureMsg;
      results.push(`6D4=${markedIntermediate} ${formatWith(ctx, session, msg)}`);
      chaosGeneratedTotal += 6 - threeCountBurned;
      if (isTR) failuresGeneratedTotal += 1;
    }
  }
  if (options?.c) chaosGeneratedTotal = 0;
  if (options?.f) failuresGeneratedTotal = 0;
  let newChaos = state.chaos;
  let newRaFail = state.raFail;
  if (chaosGeneratedTotal !== 0) newChaos += chaosGeneratedTotal;
  if (failuresGeneratedTotal !== 0) newRaFail = failureBurnout + failuresGeneratedTotal;
  if (newChaos !== state.chaos || newRaFail !== state.raFail) {
    await ctx.database.set("ta-state", { platform: session.platform, guildId: session.guildId }, {
      chaos: newChaos,
      raFail: newRaFail
    });
  }
  const prefix = formatWith(ctx, session, config.checkPrefix, {
    attrText
  });
  const suffix = !isTR ? `（本次检定拥有${totalBurnout}点燃尽，产生${chaosGeneratedTotal}点混沌，${attributeValueNum < 0 ? 0 : attributeValueNum}次质保可用）` : `（本次现实改写拥有${totalBurnout}点燃尽，其中${failureBurnout}点来自前置失败；产生${failuresGeneratedTotal}次改写失败和${chaosGeneratedTotal}点混沌，${attributeValueNum < 0 ? 0 : attributeValueNum}次质保可用）`;
  return `${prefix}${results.join("\n")}
${suffix}`;
}
__name(runCheck, "runCheck");
async function getOrCreateState(ctx, session) {
  if (!session.guildId) throw new Error("需要在群聊中使用");
  const { platform, guildId } = session;
  const rows = await ctx.database.get("ta-state", { platform, guildId });
  if (rows.length) return rows[0];
  const init = { platform, guildId, chaos: 0, raFail: 0 };
  await ctx.database.create("ta-state", init);
  return init;
}
__name(getOrCreateState, "getOrCreateState");
function roll6d4() {
  const r = [];
  for (let i = 0; i < 6; i++) r.push(Math.floor(Math.random() * 4) + 1);
  return r;
}
__name(roll6d4, "roll6d4");
function markResults(intermediate, burnout) {
  const out = [];
  for (const n of intermediate) {
    if (n === 3) {
      if (burnout > 0) {
        out.push("3x");
        burnout--;
      } else {
        out.push("3");
      }
    } else {
      out.push(`${n}x`);
    }
  }
  return burnout === 0 ? `[${out.join(",")}]` : `[${out.join(",")}] ${"x".repeat(burnout)}`;
}
__name(markResults, "markResults");
function formatWith(ctx, session, text, extra = {}) {
  const vars = {
    player: session.username || session.userId,
    attrText: "",
    ...extra
  };
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
__name(formatWith, "formatWith");
function clampInt(v, min, max) {
  const n = Math.floor(Number(v) || 0);
  return Math.max(min, Math.min(max, n));
}
__name(clampInt, "clampInt");
var TA_BASE_ATTRS = ["专注", "共情", "仪态", "顽固", "双面", "先机", "敬业", "外向", "精微"];
var TA_ALIAS = {
  专注: ["ATT"],
  共情: ["EMP"],
  仪态: ["存在", "PRE"],
  顽固: ["PER"],
  双面: ["DUP"],
  先机: ["INI"],
  敬业: ["专业", "PRO"],
  外向: ["外放", "DYN"],
  精微: ["SUB"]
};
var aliasMap = /* @__PURE__ */ new Map();
for (const canon of TA_BASE_ATTRS) {
  aliasMap.set(canon.toLowerCase(), canon);
  for (const a of TA_ALIAS[canon] || []) aliasMap.set(a.toLowerCase(), canon);
}
function resolveAttrName(name2) {
  if (!name2) return null;
  const key = name2.trim().toLowerCase();
  return aliasMap.get(key) || null;
}
__name(resolveAttrName, "resolveAttrName");
function parseAttrPairs(raw) {
  const s = String(raw).replace(/\s+/g, "");
  const reg = /([^\d+-]+)([+-]?\d+)/g;
  const out = [];
  let m;
  while (m = reg.exec(s)) {
    const name2 = m[1].trim();
    const val = parseInt(m[2], 10);
    if (!name2) continue;
    if (!Number.isNaN(val)) out.push([name2, val]);
  }
  return out;
}
__name(parseAttrPairs, "parseAttrPairs");
async function getOrCreateUserAttrs(ctx, session) {
  const { platform, guildId, userId } = session;
  const rows = await ctx.database.get("ta-attrs", { platform, guildId, userId });
  if (rows.length) return rows[0];
  const init = { platform, guildId, userId, attrs: {} };
  await ctx.database.create("ta-attrs", init);
  return init;
}
__name(getOrCreateUserAttrs, "getOrCreateUserAttrs");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
