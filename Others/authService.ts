/**
 * Authentication Service - Real Google Sign-In with expo-auth-session
 * 
 * Features:
 * - Real Google OAuth via expo-auth-session
 * - Secure token storage via expo-secure-store
 * - Guest mode (skip login)
 * - Data sync preparation
 */

import { useState, useEffect, useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// Complete auth session for web
WebBrowser.maybeCompleteAuthSession();

// =============================================================================
// TYPES
// =============================================================================

export interface UserProfile {
    id: string;
    email: string | null;
    displayName: string | null;
    photoUrl: string | null;
    provider: 'google' | 'guest';
    createdAt: string;
    lastLoginAt: string;
}

export interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: UserProfile | null;
    accessToken: string | null;
}

// =============================================================================
// SECURE STORAGE KEYS
// =============================================================================

const STORAGE_KEYS = {
    USER: 'zenone_user',
    ACCESS_TOKEN: 'zenone_access_token',
    REFRESH_TOKEN: 'zenone_refresh_token',
};

// =============================================================================
// GOOGLE CONFIG
// =============================================================================

// Replace with your actual client IDs from Google Cloud Console
// https://console.cloud.google.com/apis/credentials
const GOOGLE_CONFIG = {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
};

// =============================================================================
// SECURE STORAGE HELPERS
// =============================================================================

async function secureStore(key: string, value: string): Promise<void> {
    try {
        if (Platform.OS === 'web') {
            // Fallback to localStorage on web
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    } catch (error) {
        logger.error('SecureStore error:', error);
    }
}

async function secureRetrieve(key: string): Promise<string | null> {
    try {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        }
        return await SecureStore.getItemAsync(key);
    } catch (error) {
        logger.error('SecureRetrieve error:', error);
        return null;
    }
}

async function secureDelete(key: string): Promise<void> {
    try {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    } catch (error) {
        logger.error('SecureDelete error:', error);
    }
}

// =============================================================================
// AUTH SERVICE CLASS
// =============================================================================

class AuthService {
    private currentUser: UserProfile | null = null;
    private accessToken: string | null = null;
    private listeners: Set<(state: AuthState) => void> = new Set();

    /**
     * Initialize - restore session from secure storage
     */
    async initialize(): Promise<boolean> {
        try {
            const userJson = await secureRetrieve(STORAGE_KEYS.USER);
            const token = await secureRetrieve(STORAGE_KEYS.ACCESS_TOKEN);

            if (userJson) {
                this.currentUser = JSON.parse(userJson);
                this.accessToken = token;
                this.notifyListeners();
                return true;
            }
        } catch (error) {
            logger.error('Auth init error:', error);
        }
        return false;
    }

    /**
     * Process Google auth response
     */
    async handleGoogleResponse(response: { type: string; authentication?: { accessToken: string } | null }): Promise<UserProfile | null> {
        if (response.type !== 'success' || !response.authentication) {
            return null;
        }

        try {
            const { accessToken } = response.authentication;

            // Fetch user info from Google
            const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            const googleUser = await userInfoResponse.json();

            const user: UserProfile = {
                id: `google_${googleUser.id}`,
                email: googleUser.email,
                displayName: googleUser.name,
                photoUrl: googleUser.picture,
                provider: 'google',
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
            };

            // Store securely
            await secureStore(STORAGE_KEYS.USER, JSON.stringify(user));
            await secureStore(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

            this.currentUser = user;
            this.accessToken = accessToken;
            this.notifyListeners();

            logger.info('✅ Google Sign-In successful');
            return user;
        } catch (error) {
            logger.error('Google auth error:', error);
            return null;
        }
    }

    /**
     * Continue as guest (skip login)
     */
    async continueAsGuest(): Promise<UserProfile> {
        const guestUser: UserProfile = {
            id: 'guest_' + Math.random().toString(36).substr(2, 9),
            email: null,
            displayName: 'Guest',
            photoUrl: null,
            provider: 'guest',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
        };

        await secureStore(STORAGE_KEYS.USER, JSON.stringify(guestUser));

        this.currentUser = guestUser;
        this.accessToken = null;
        this.notifyListeners();

        return guestUser;
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<void> {
        await secureDelete(STORAGE_KEYS.USER);
        await secureDelete(STORAGE_KEYS.ACCESS_TOKEN);
        await secureDelete(STORAGE_KEYS.REFRESH_TOKEN);

        this.currentUser = null;
        this.accessToken = null;
        this.notifyListeners();
    }

    getCurrentUser(): UserProfile | null {
        return this.currentUser;
    }

    getAccessToken(): string | null {
        return this.accessToken;
    }

    isAuthenticated(): boolean {
        return this.currentUser !== null;
    }

    hasFullAccount(): boolean {
        return this.currentUser?.provider === 'google';
    }

    subscribe(listener: (state: AuthState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        const state = this.getState();
        this.listeners.forEach(listener => listener(state));
    }

    getState(): AuthState {
        return {
            isLoading: false,
            isAuthenticated: this.currentUser !== null,
            user: this.currentUser,
            accessToken: this.accessToken,
        };
    }
}

// Singleton
export const authService = new AuthService();

// =============================================================================
// REACT HOOK WITH REAL GOOGLE AUTH
// =============================================================================

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        accessToken: null,
    });

    // Real Google auth request
    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: GOOGLE_CONFIG.webClientId,
        iosClientId: GOOGLE_CONFIG.iosClientId,
        androidClientId: GOOGLE_CONFIG.androidClientId,
    });

    // Initialize on mount
    useEffect(() => {
        authService.initialize().then(() => {
            setState(authService.getState());
        });

        return authService.subscribe(setState);
    }, []);

    // Handle Google response
    useEffect(() => {
        if (response) {
            authService.handleGoogleResponse(response as { type: string; authentication?: { accessToken: string } | null });
        }
    }, [response]);

    const signInWithGoogle = useCallback(async () => {
        if (request) {
            const result = await promptAsync();
            return result;
        }
        return null;
    }, [request, promptAsync]);

    const continueAsGuest = useCallback(async () => {
        return await authService.continueAsGuest();
    }, []);

    const signOut = useCallback(async () => {
        await authService.signOut();
    }, []);

    return {
        ...state,
        signInWithGoogle,
        continueAsGuest,
        signOut,
        isGuest: state.user?.provider === 'guest',
        googleAuthReady: !!request,
    };
}

// =============================================================================
// DATA SYNC
// =============================================================================

export interface SessionSyncData {
    userId: string;
    sessions: {
        id: string;
        date: string;
        patternId: string;
        durationSec: number;
        cyclesCompleted: number;
        avgHeartRate: number | null;
    }[];
}

export async function syncUserData(data: SessionSyncData): Promise<boolean> {
    if (!authService.hasFullAccount()) {
        logger.warn('⚠️ Data sync requires Google account');
        return false;
    }

    // In production: POST to your backend
    logger.info('📤 Would sync data:', data);
    return true;
}
