/**
 * Wallet Detection Utilities
 * Checks if wallet browser extensions are installed
 */
export interface WalletDetectionResult {
    isInstalled: boolean;
    walletName: string;
}
/**
 * Check if MetaMask is installed
 */
export declare const isMetaMaskInstalled: () => boolean;
/**
 * Check if Phantom is installed
 */
export declare const isPhantomInstalled: () => boolean;
/**
 * Check if Rabby is installed
 */
export declare const isRabbyInstalled: () => boolean;
/**
 * Check if TronLink is installed
 */
export declare const isTronLinkInstalled: () => boolean;
/**
 * Check if Bitget is installed
 */
export declare const isBitgetInstalled: () => boolean;
/**
 * Check if Coinbase Wallet is installed
 */
export declare const isCoinbaseWalletInstalled: () => boolean;
/**
 * Check if Solflare is installed
 */
export declare const isSolflareInstalled: () => boolean;
/**
 * Check if OKX Wallet is installed
 */
export declare const isOKXInstalled: () => boolean;
/**
 * Check if a specific wallet is installed
 */
export declare const checkWalletInstalled: (wallet: string) => WalletDetectionResult;
//# sourceMappingURL=walletDetection.d.ts.map