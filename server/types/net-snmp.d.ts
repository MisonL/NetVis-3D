declare module 'net-snmp' {
    export const Version1: number;
    export const Version2c: number;
    export const Version3: number;
    export function createSession(target: string, community: string, options?: any): any;
    export function isVarbindError(varbind: any): boolean;
    export function varbindError(varbind: any): string;
}
