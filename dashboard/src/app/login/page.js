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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let response;
            if (isSetup) {
                response = await authAPI.setup(email, password, name);
            } else {
                response = await authAPI.login(email, password);
            }

            login(response.data.token, response.data.user);
            router.push('/dashboard');
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

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="logo-section">
                    <div className="logo-icon">🏠</div>
                    <h2>Trivastu Realty</h2>
                    <p className="subtitle">{isSetup ? 'Initial Admin Setup' : 'Admin Dashboard'}</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
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
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button onClick={() => { setIsSetup(!isSetup); setError(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                        {isSetup ? '← Back to Login' : 'First time? Setup Admin →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
