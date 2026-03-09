import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';

interface UserRecord {
    email: string;
    displayName: string;
    photoURL: string;
    status: string;
    role: string;
    createdAt: any;
    updatedAt: any;
}

export function AdminPanel() {
    const { role } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    useEffect(() => {
        if (role !== 'admin') return;

        const unsubscribe = onSnapshot(collection(db, 'allowed_users'), (snapshot) => {
            const userData: UserRecord[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                userData.push({
                    ...data,
                    email: data.email || doc.id,
                } as UserRecord);
            });
            // Sort: pending first, then by name
            userData.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return (a.displayName || '').localeCompare(b.displayName || '');
            });
            setUsers(userData);
        }, (error) => {
            console.error("Error fetching users snapshot:", error);
        });

        return () => unsubscribe();
    }, [role]);

    const handleUpdateStatus = async (email: string, newStatus: string) => {
        try {
            const userDocRef = doc(db, 'allowed_users', email);
            await updateDoc(userDocRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error('Error updating user status:', error);
            alert('Gagal update status user.');
        }
    };

    if (role !== 'admin') return null;

    const pendingCount = users.filter(u => u.status === 'pending').length;
    const filteredUsers = filter === 'all' ? users : users.filter(u => u.status === filter);

    return (
        <>
            {/* Floating admin button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 neo-btn bg-[#FF90E8] text-black font-black uppercase px-4 py-3 border-4 border-black neo-shadow flex items-center gap-2"
            >
                👑 ADMIN
                {pendingCount > 0 && (
                    <span className="bg-[#FF5252] text-white text-xs font-black px-2 py-1 border-2 border-black">
                        {pendingCount}
                    </span>
                )}
            </button>

            {/* Admin panel overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div
                        className="relative neo-card bg-white w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="bg-[#FF90E8] border-4 border-black px-4 py-2 neo-shadow-sm transform -rotate-2">
                                <h2 className="text-xl font-black uppercase">👑 Admin Panel</h2>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="neo-btn bg-black text-white font-black px-3 py-1 border-2 border-black"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Filter buttons */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`neo-btn font-black uppercase px-3 py-1 border-2 border-black text-sm ${filter === f
                                        ? 'bg-black text-white'
                                        : 'bg-white text-black'
                                        }`}
                                >
                                    {f === 'all' ? `SEMUA (${users.length})` :
                                        f === 'pending' ? `PENDING (${users.filter(u => u.status === 'pending').length})` :
                                            f === 'approved' ? `APPROVED (${users.filter(u => u.status === 'approved').length})` :
                                                `REJECTED (${users.filter(u => u.status === 'rejected').length})`}
                                </button>
                            ))}
                        </div>

                        {/* Users list */}
                        <div className="space-y-3">
                            {filteredUsers.length === 0 ? (
                                <div className="text-center py-8 font-bold text-gray-400 uppercase">
                                    Tidak ada user
                                </div>
                            ) : (
                                filteredUsers.map((u) => (
                                    <div
                                        key={u.email}
                                        className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-4 border-black neo-shadow-sm ${u.status === 'pending' ? 'bg-[#FFDE59]' :
                                            u.status === 'approved' ? 'bg-[#A3E635]' :
                                                u.status === 'rejected' ? 'bg-[#FF5252]/20' : 'bg-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 flex-grow min-w-0">
                                            <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border-2 border-black bg-white">
                                                {u.photoURL ? (
                                                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center font-black text-sm">
                                                        {u.displayName?.[0] || '?'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-sm truncate">{u.displayName || 'No Name'}</p>
                                                <p className="text-xs font-bold text-gray-700 truncate">{u.email}</p>
                                                <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black mt-1 ${u.status === 'pending' ? 'bg-[#FFDE59]' :
                                                    u.status === 'approved' ? 'bg-[#00E676] text-white' :
                                                        'bg-[#FF5252] text-white'
                                                    }`}>
                                                    {u.role === 'admin' ? '👑 ADMIN' : u.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>

                                        {u.role !== 'admin' && (
                                            <div className="flex gap-2 shrink-0">
                                                {u.status !== 'approved' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(u.email, 'approved')}
                                                        className="neo-btn bg-[#00E676] text-black font-black uppercase px-3 py-1 border-2 border-black text-xs"
                                                    >
                                                        ✅ APPROVE
                                                    </button>
                                                )}
                                                {u.status !== 'rejected' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(u.email, 'rejected')}
                                                        className="neo-btn bg-[#FF5252] text-white font-black uppercase px-3 py-1 border-2 border-black text-xs"
                                                    >
                                                        ❌ REJECT
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
