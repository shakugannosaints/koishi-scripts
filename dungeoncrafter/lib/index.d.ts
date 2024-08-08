import { Context, Schema } from 'koishi';
export interface Config {
    wallColor: string;
    pathColor: string;
    RoomMin: number;
    RoomMax: number;
}
export declare const Config: Schema<Config>;
export declare const inject: string[];
export declare const name = "dungeon-crafter";
export declare function apply(ctx: Context, config: Config): Promise<void>;
