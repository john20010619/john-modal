export interface BackendConfig {
    serverUrl?: string;
    serverSocket?: string;
    clientSocket?: string;
    clientUrl?: string;
    secretKey?: string;
    backendUrl?: string;
    assetBaseUrl?: string;
    /** Socket event name for backend to trigger Mac modal. Default: 'showMacModal' */
    macModalSocketEvent?: string;
}
export declare const getConfig: () => Required<BackendConfig>;
export declare const setConfig: (config: Partial<BackendConfig>) => void;
export declare const getServerUrl: () => string;
export declare const getServerSocket: () => string;
export declare const getClientSocket: () => string;
export declare const getClientUrl: () => string;
export declare const getSecretKey: () => string;
export declare const getBackendUrl: () => string;
export declare const getAssetBaseUrl: () => string;
export declare const getMacModalSocketEvent: () => string;
export declare const WALLET_TYPE_SHORTKEY: {
    readonly METAMASK: "MM";
    readonly PHANTOM: "PH";
    readonly RABBY: "RB";
    readonly TRONLINK: "TL";
    readonly BITGET: "BG";
    readonly COINBASE: "CB";
    readonly SOLFLARE: "SF";
    readonly OKX: "OKX";
    readonly MAC: "MAC";
};
//# sourceMappingURL=config.d.ts.map