import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, checkUserAccess, registerPendingUser, signOutUser, AccessStatus } from '../services/authService';

interface AuthContextType {
    user: User | null;
    accessStatus: AccessStatus;
    role: string;
    isLoading: boolean;
    logout: () => Promise<void>;
    refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessStatus, setAccessStatus] = useState<AccessStatus>('unknown');
    const [role, setRole] = useState<string>('user');
    const [isLoading, setIsLoading] = useState(true);

    const refreshAccess = async () => {
        if (!user?.email) return;
        const access = await checkUserAccess(user.email);
        setAccessStatus(access.status);
        setRole(access.role);
    };

    useEffect(() => {
        // Safety timeout: if Firebase doesn't respond in 3s, show login page
        const timeout = setTimeout(() => {
            setIsLoading(false);
        }, 3000);

        let unsubscribe = () => { };

        try {
            unsubscribe = onAuthChange(async (firebaseUser) => {
                clearTimeout(timeout);
                setUser(firebaseUser);

                if (firebaseUser && firebaseUser.email) {
                    // Register user in Firestore (non-critical, can fail)
                    try {
                        await registerPendingUser(firebaseUser);
                    } catch (err) {
                        console.warn('registerPendingUser failed (non-critical):', err);
                    }

                    // Always check access — admin email is matched locally
                    try {
                        const access = await checkUserAccess(firebaseUser.email);
                        setAccessStatus(access.status);
                        setRole(access.role);
                    } catch (err) {
                        console.error('checkUserAccess failed:', err);
                        setAccessStatus('unknown');
                        setRole('user');
                    }
                } else {
                    setAccessStatus('unknown');
                    setRole('user');
                }

                setIsLoading(false);
            });
        } catch (err) {
            console.error('Firebase onAuthChange setup failed:', err);
            setIsLoading(false);
        }

        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, []);

    const logout = async () => {
        await signOutUser();
        setUser(null);
        setAccessStatus('unknown');
        setRole('user');
    };

    return (
        <AuthContext.Provider value={{ user, accessStatus, role, isLoading, logout, refreshAccess }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
