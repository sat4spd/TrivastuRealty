'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const OtpContext = createContext(null);

export function OtpProvider({ children }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(300);
    const [resolvePromise, setResolvePromise] = useState(null);

    // Triggers the OTP Modal, requests an OTP from backend, and returns a Promise
    // resolving to the string OTP once the user enters it, OR rejecting if cancelled.
    const requestCmsOtp = async () => {
        if (!user) return Promise.reject('No authorized user');

        try {
            setLoading(true);
            await authAPI.requestCmsOtp(user.email);
            setOtpCode('');
            setError('');
            setTimeLeft(300);
            setIsOpen(true);

            return new Promise((resolve, reject) => {
                setResolvePromise(() => ({ resolve, reject }));
            });
        } catch (err) {
            console.error('Failed to trigger OTP', err);
            return Promise.reject('Failed to initialize OTP challenge');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (otpCode.length === 6 && resolvePromise) {
            resolvePromise.resolve(otpCode);
            setIsOpen(false);
            setResolvePromise(null);
        } else {
            setError('Please enter a valid 6-digit code');
        }
    };

    const handleCancel = () => {
        if (resolvePromise) resolvePromise.reject('OTP verification cancelled');
        setIsOpen(false);
        setResolvePromise(null);
    };

    // UI timer
    useEffect(() => {
        if (!isOpen) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isOpen]);

    return (
        <OtpContext.Provider value={{ requestCmsOtp }}>
            {children}
            {isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        background: 'var(--surface)', padding: '32px', borderRadius: '16px',
                        width: '90%', maxWidth: '400px', border: '1px solid var(--border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(255,165,0,0.1)', color: 'orange',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                            }}>
                                🛡️
                            </div>
                            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Admin Verification</h3>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
                            You are requesting to modify Trivastu Website content. Please enter the verification code sent to your registered WhatsApp/Email.
                        </p>

                        {error && <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '16px', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>}

                        <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            maxLength={6}
                            placeholder="6-Digit OTP"
                            style={{
                                width: '100%', padding: '16px', marginBottom: '24px',
                                background: 'var(--bg)', border: '1px solid var(--border)',
                                borderRadius: '12px', color: 'var(--text-primary)',
                                fontSize: '24px', textAlign: 'center', letterSpacing: '8px'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', fontSize: '13px' }}>
                            <span style={{ color: timeLeft === 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                {timeLeft > 0 ? `Expires in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Code Expired'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleCancel} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleConfirm} disabled={otpCode.length !== 6 || timeLeft === 0} style={{ flex: 1, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: (otpCode.length !== 6 || timeLeft === 0) ? 'not-allowed' : 'pointer', opacity: (otpCode.length !== 6 || timeLeft === 0) ? 0.5 : 1 }}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OtpContext.Provider>
    );
}

export const useOtp = () => {
    const context = useContext(OtpContext);
    if (!context) throw new Error('useOtp must be used within an OtpProvider');
    return context;
};
