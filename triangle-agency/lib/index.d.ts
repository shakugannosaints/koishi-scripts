import { Context, Schema } from 'koishi';
export declare const name = "triangle-agency";
export interface Config {
    maxExecTimes: number;
    checkPrefix: string;
    successMsg: string;
    failureMsg: string;
    bigSuccessMsg: string;
    successShortMsg: string;
    failureShortMsg: string;
    bigSuccessShortMsg: string;
    excessiveMsg: string;
}
export declare const Config: Schema<Config>;
interface TAState {
    platform: string;
    guildId: string;
    chaos: number;
    raFail: number;
}
declare module 'koishi' {
    interface Tables {
        'ta-state': TAState;
        'ta-attrs': TAUserAttrs;
    }
}
export declare function apply(ctx: Context, config: Config): void;
interface TAUserAttrs {
    platform: string;
    guildId: string;
    userId: string;
    attrs: Record<string, number>;
}
export {};
