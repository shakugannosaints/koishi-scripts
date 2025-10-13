/**
 * 更新日志
 * 1.2.0:
 * - 现在 tcs 和 tfs 收到正值时为添加，收到负值时为减少
 * 1.1.1:
 * - 将 cs 和 fs 重命名为 tcs 和 tfs
 * 1.1.0:
 * - 新增 tr 检定用于现实改写请求
 * - 新增 fs 指令用于管理现实改写失败
 * 1.0.1:
 * - 修复了代骰时用户变量的读取问题
 * - 修复了使用自定义回复时，格式化不正确的问题
 */
declare const EXT_NAME = "triangle-agency";
declare const EXT_AUTHOR = "\u8D25\u96EA\u3001\u6A80\u8F76\u6B65\u68CB";
declare const EXT_VERSION = "1.2.0";
declare const TA_MAX_EXECTIME_STR = "TriangleAgency:MaxExecTime";
declare const TA_MAX_EXECTIME = 5;
declare const TA_EXCESMSG_NAMESPACE_STR = "TriangleAgency:ExcesMsgNamespace";
declare const TA_CHECKMSG_NAMESPACE_STR = "TriangleAgency:CheckMsgNamespace";
declare const TA_CHECKPREFIX_STR = "TriangleAgency:CheckPrefix";
declare const TA_CHECKPREFIX = "{$t\u73A9\u5BB6}\u7684\u201C{$t\u5C5E\u6027\u8868\u8FBE\u5F0F\u6587\u672C}\u201D\u80FD\u529B\u4F7F\u7528\u5DF2\u6279\u51C6\u2026\u2026\n";
declare const TA_SUCCESS_STR = "TriangleAgency:SuccessMsg";
declare const TA_BIGSUCCESS_STR = "TriangleAgency:BigSuccessMsg";
declare const TA_FAILURE_STR = "TriangleAgency:FailureMsg";
declare const TA_SUCCESS = "\u8FD9\u4E00\u77AC\u95F4\uFF0C\u73B0\u5B9E\u4E3A\u4F60\u800C\u626D\u66F2\u3002";
declare const TA_FAILURE = "\u5B83\u51B0\u51B7\u800C\u4E0D\u53EF\u64BC\u52A8\uFF0C\u4EFF\u82E5\u4E00\u5EA7\u9ED1\u8272\u7684\u65B9\u5C16\u7891\u3002";
declare const TA_BIGSUCCESS = "\u4E09\u5C16\u51A0\u2014\u2014\u5929\u547D\u662D\u662D\u3002";
declare const TA_SUCCESS_SHORT_STR = "TriangleAgency:SuccessShortMsg";
declare const TA_BIGSUCCESS_SHORT_STR = "TriangleAgency:BigSuccessShortMsg";
declare const TA_FAILURE_SHORT_STR = "TriangleAgency:FailureShortMsg";
declare const TA_SUCCESS_SHORT = "\u6210\u529F";
declare const TA_FAILURE_SHORT = "\u5931\u8D25";
declare const TA_BIGSUCCESS_SHORT = "\u5927\u6210\u529F";
declare const TA_NAMESPACE_COC = "COC";
declare const TA_NAMESPACE_DND = "DND";
declare const TA_NAMESPACE_TA = "TA";
declare const TA_CUSTOM_EXCESMSG_STR = "TriangleAgency:CustomExcesMsg";
declare const TA_CUSTOM_EXCESMSG = "\u68C0\u5B9A\u8F6E\u6570\u8FC7\u591A\uFF0C\u673A\u6784\u4E0D\u4E88\u652F\u6301\u3002";
declare const TA_CHAOS_VAR_STR = "TriangleAgency:ChaosVar";
declare const TA_CHAOS_VAR = "$g\u6DF7\u6C8C";
declare const TA_RAFAIL_VAR_STR = "TriangleAgency:RaFailVar";
declare const TA_RAFAIL_VAR = "$g\u6539\u5199\u5931\u8D25";
declare const GAME_TEMPLATE: {
    name: string;
    fullName: string;
    authors: string[];
    version: string;
    updatedTime: string;
    templateVer: string;
    nameTemplate: {
        ta: {
            template: string;
            helpText: string;
        };
    };
    attrSettings: {
        top: string[];
        sortBy: string;
        showAs: {};
    };
    setConfig: {
        diceSides: number;
        keys: string[];
        enableTip: string;
        relatedExt: string[];
    };
    default: {
        专注: number;
        共情: number;
        仪态: number;
        顽固: number;
        双面: number;
        先机: number;
        敬业: number;
        外向: number;
        精微: number;
    };
    alias: {
        专注: string[];
        共情: string[];
        仪态: string[];
        顽固: string[];
        双面: string[];
        先机: string[];
        敬业: string[];
        外向: string[];
        精微: string[];
    };
};
declare const Extension: seal.ExtInfo;
declare const CommandTa: any;
declare const CommandCs: any;
declare const CommandFs: any;
declare function markResults(intermediate: number[], burnout: number): string;
declare function getAttribute(context: seal.MsgContext, attribute: string): [number, boolean];
declare function getTargetUser(context: seal.MsgContext, commandArguments: seal.CmdArgs): seal.MsgContext;
declare function getExcessiveMessage(): string;
declare function getSuccessMessage(short: boolean): string;
declare function getBigSuccessMessage(short: boolean): string;
declare function getFailureMessage(short: boolean): string;
declare function chooseRandomOption<T>(options: T[]): T;
declare function getOrRegisterExtension(): seal.ExtInfo;
