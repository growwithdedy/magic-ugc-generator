import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebaseConfig';

export type AccessStatus = 'approved' | 'pending' | 'rejected' | 'unknown';

export interface UserAccessData {
    email: string;
    displayName: string;
    photoURL: string;
    status: AccessStatus;
    role: 'user' | 'admin';
    createdAt: any;
    updatedAt: any;
}

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'growwithdedy@gmail.com').toLowerCase();

const isAdminEmail = (email: string) => email.toLowerCase() === ADMIN_EMAIL;

export const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
};

export const signOutUser = async () => {
    await signOut(auth);
};

export const checkUserAccess = async (email: string): Promise<{ status: AccessStatus; role: string }> => {
    // Admin email is always approved — checked first, no Firestore needed
    if (isAdminEmail(email)) {
        return { status: 'approved', role: 'admin' };
    }

    try {
        const userDocRef = doc(db, 'allowed_users', email.toLowerCase());
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const data = userDoc.data();
            return {
                status: data.status || 'pending',
                role: data.role || 'user',
            };
        }

        return { status: 'unknown', role: 'user' };
    } catch (error) {
        console.error('Error checking user access:', error);
        // If Firestore fails but email is admin, still approve
        if (isAdminEmail(email)) {
            return { status: 'approved', role: 'admin' };
        }
        return { status: 'unknown', role: 'user' };
    }
};

export const registerPendingUser = async (user: User): Promise<void> => {
    const email = user.email?.toLowerCase();
    if (!email) return;

    // Auto-approve admin
    if (email === ADMIN_EMAIL.toLowerCase()) {
        const userDocRef = doc(db, 'allowed_users', email);
        await setDoc(userDocRef, {
            email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            status: 'approved',
            role: 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });
        return;
    }

    const userDocRef = doc(db, 'allowed_users', email);
    const existingDoc = await getDoc(userDocRef);

    if (!existingDoc.exists()) {
        await setDoc(userDocRef, {
            email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            status: 'pending',
            role: 'user',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    } else {
        // Update display info but don't change status
        await setDoc(userDocRef, {
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};
