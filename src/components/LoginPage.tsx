import React from 'react';
import { signInWithGoogle } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_WHATSAPP = '6285123514560';

export function LoginPage() {
    const { user, accessStatus, logout } = useAuth();
    const [isSigningIn, setIsSigningIn] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleGoogleLogin = async () => {
        setIsSigningIn(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err: any) {
            console.error('Login failed:', err);
            setError('Gagal login. Silakan coba lagi.');
        } finally {
            setIsSigningIn(false);
        }
    };

    // Pending approval state
    if (user && (accessStatus === 'pending' || accessStatus === 'unknown')) {
        const waMessage = encodeURIComponent(
            `Halo Admin, saya ingin mengajukan akses ke Magic UGC Generator.\n\nNama: ${user.displayName || '-'}\nEmail: ${user.email}\n\nMohon approve akun saya. Terima kasih! 🙏`
        );
        const waLink = `https://wa.me/${ADMIN_WHATSAPP}?text=${waMessage}`;

        return (
            <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#FFE600] text-black border-[12px] border-black box-border">
                <div className="text-center max-w-lg mx-auto p-8">
                    <div className="neo-card bg-white p-8 animate-fade-in-up">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden border-4 border-black neo-shadow-sm">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-[#FF90E8] flex items-center justify-center text-3xl font-black">
                                    {user.displayName?.[0] || '?'}
                                </div>
                            )}
                        </div>

                        <div className="inline-block bg-[#FFDE59] border-4 border-black px-4 py-2 neo-shadow-sm mb-6 transform -rotate-2">
                            <h2 className="text-xl font-black uppercase tracking-tight">⏳ Menunggu Approval</h2>
                        </div>

                        <p className="text-black font-bold mb-2">
                            Hai, <strong>{user.displayName || 'User'}</strong>!
                        </p>
                        <p className="text-black font-bold mb-6 text-sm bg-gray-100 border-2 border-black p-3">
                            Email <span className="bg-[#00E5FF] px-1 border border-black">{user.email}</span> kamu belum di-approve oleh admin.
                        </p>

                        <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="neo-btn inline-block bg-[#25D366] text-white font-black uppercase px-8 py-4 border-4 border-black neo-shadow text-lg mb-4 no-underline"
                        >
                            💬 Hubungi Admin via WA
                        </a>

                        <p className="text-xs font-bold text-gray-600 mt-4">
                            Atau hubungi admin di: <strong>growwithdedy@gmail.com</strong>
                        </p>

                        <button
                            onClick={logout}
                            className="neo-btn mt-6 bg-[#FF5252] text-white font-black uppercase px-6 py-2 border-2 border-black text-sm"
                        >
                            LOGOUT
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Rejected state
    if (user && accessStatus === 'rejected') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#FF5252] text-white border-[12px] border-black box-border">
                <div className="text-center max-w-lg mx-auto p-8">
                    <div className="neo-card bg-white text-black p-8 animate-fade-in-up">
                        <div className="inline-block bg-[#FF5252] border-4 border-black px-4 py-2 neo-shadow-sm mb-6">
                            <h2 className="text-xl font-black uppercase tracking-tight text-white">❌ Akses Ditolak</h2>
                        </div>
                        <p className="font-bold mb-4">
                            Maaf, akun <strong>{user.email}</strong> tidak diizinkan mengakses aplikasi ini.
                        </p>
                        <p className="text-sm font-bold text-gray-600 mb-6">
                            Hubungi admin di <strong>growwithdedy@gmail.com</strong> untuk info lebih lanjut.
                        </p>
                        <button
                            onClick={logout}
                            className="neo-btn bg-black text-white font-black uppercase px-6 py-3 border-4 border-black neo-shadow"
                        >
                            LOGOUT
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Login page (not logged in)
    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#FFE600] text-black border-[12px] border-black box-border">
            <div className="text-center space-y-8 p-10 max-w-lg animate-scale-in">
                <div className="inline-block bg-white border-4 border-black px-6 py-2 transform rotate-2 neo-shadow mb-4">
                    <h2 className="text-lg font-black uppercase tracking-widest">growwithdedy presents</h2>
                </div>

                <h1
                    className="text-6xl md:text-8xl font-black tracking-tighter uppercase"
                    style={{ textShadow: '5px 5px 0px #fff, 7px 7px 0px #000' }}
                >
                    MAGIC<br />UGC
                </h1>

                <div className="neo-card bg-white p-8 mt-8">
                    <h3 className="text-xl font-black uppercase mb-6 border-b-4 border-black pb-3">
                        🔐 LOGIN UNTUK MASUK
                    </h3>

                    {error && (
                        <p className="text-white bg-[#FF5252] border-2 border-black font-bold text-sm p-3 mb-4">
                            {error}
                        </p>
                    )}

                    <button
                        onClick={handleGoogleLogin}
                        disabled={isSigningIn}
                        className="neo-btn w-full bg-white text-black font-black uppercase px-6 py-4 border-4 border-black neo-shadow flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {isSigningIn ? 'SEDANG LOGIN...' : 'LOGIN DENGAN GOOGLE'}
                    </button>

                    <p className="text-xs text-gray-600 font-bold mt-4">
                        Hanya user yang di-approve admin yang bisa mengakses
                    </p>
                </div>
            </div>
        </div>
    );
}
