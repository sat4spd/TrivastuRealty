'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { authAPI } from '@/lib/api';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isSetup, setIsSetup] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const [otpStep, setOtpStep] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [timeLeft, setTimeLeft] = useState(300);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSetup) {
                const response = await authAPI.setup(email, password, name);
                login(response.data.token, response.data.user);
                router.push('/dashboard');
            } else {
                const response = await authAPI.login(email, password);
                if (response.data.requiresOtp) {
                    setOtpStep(true);
                    setTimeLeft(300); // 5 mins

                    // Simple interval timer for UI
                    const timer = setInterval(() => {
                        setTimeLeft((prev) => {
                            if (prev <= 1) {
                                clearInterval(timer);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                } else {
                    login(response.data.token, response.data.user);
                    router.push('/dashboard');
                }
            }
        } catch (err) {
            const msg = err.response?.data?.error || 'Login failed';
            if (msg === 'Invalid credentials' && !isSetup) {
                setError('Invalid credentials. First time? Click "Setup Admin" below.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.verifyLogin(email, otpCode);
            login(response.data.token, response.data.user);
            router.push('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        try {
            await authAPI.resendOtp(email);
            setTimeLeft(300);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resend OTP');
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="logo-section">
                    <div className="logo-icon">🏠</div>
                    <h2>Trivastu Realty</h2>
                    <p className="subtitle">{isSetup ? 'Initial Admin Setup' : 'Admin Dashboard'}</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={otpStep ? handleVerifyOtp : handleSubmit}>
                    {!otpStep ? (
                        <>
                            {isSetup && (
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input type="text" className="form-input" placeholder="Admin Name"
                                        value={name} onChange={(e) => setName(e.target.value)} required />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" placeholder="admin@trivastu.com"
                                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input type="password" className="form-input" placeholder="••••••••"
                                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading}
                                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                                {loading ? 'Please wait...' : isSetup ? '🚀 Setup Admin Account' : '🔑 Sign In'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label">Security Verification</label>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    Enter the 6-digit OTP sent to your registered WhatsApp/Email.
                                </p>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter 6-digit Code"
                                    maxLength={6}
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    required
                                    style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px' }}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading || otpCode.length !== 6 || timeLeft === 0}
                                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                                {loading ? 'Verifying...' : 'Unlock Dashboard'}
                            </button>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px' }}>
                                <span style={{ color: timeLeft === 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                    {timeLeft > 0 ? `Expires in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Code Expired'}
                                </span>
                                <button type="button" onClick={handleResendOtp} disabled={timeLeft > 0}
                                    style={{ background: 'none', border: 'none', color: timeLeft === 0 ? 'var(--accent)' : 'var(--border)', cursor: timeLeft === 0 ? 'pointer' : 'default', padding: 0 }}>
                                    Resend Code
                                </button>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                <button type="button" onClick={() => setOtpStep(false)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>
                                    ← Back to login
                                </button>
                            </div>
                        </>
                    )}
                </form>

                {!otpStep && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button onClick={() => { setIsSetup(!isSetup); setError(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                            {isSetup ? '← Back to Login' : 'First time? Setup Admin →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
