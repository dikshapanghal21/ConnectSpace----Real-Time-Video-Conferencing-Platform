import React, { useContext, useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Authentication() {
    const [searchParams] = useSearchParams();
    // Feature 2: read ?tab=register from URL so Sign up nav link opens correct tab
    const [tab, setTab]           = useState(searchParams.get('tab') === 'register' ? 1 : 0);
    const [name, setName]         = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [open, setOpen]         = useState(false);
    const { handleRegister, handleLogin } = useContext(AuthContext);
    const navigate = useNavigate();

    // Update tab if URL param changes (e.g. back/forward)
    useEffect(() => {
        setTab(searchParams.get('tab') === 'register' ? 1 : 0);
        setError('');
    }, [searchParams]);

    const handleAuth = async () => {
        setError('');
        if (!username.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
        if (tab === 1 && !name.trim()) { setError('Please enter your full name.'); return; }
        try {
            if (tab === 0) {
                await handleLogin(username.trim(), password);
            } else {
                await handleRegister(name.trim(), username.trim(), password);
                setOpen(true);
                // After register, switch to sign in tab
                setTab(0);
                setName(''); setUsername(''); setPassword('');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong. Check your credentials.');
        }
    };

    const inp = (extra = {}) => ({
        width: '100%',
        padding: '9px 12px',
        background: '#18181b',
        border: '1px solid #2a2a2f',
        borderRadius: '6px',
        color: '#f0f0f2',
        fontSize: '0.88rem',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.15s',
        boxSizing: 'border-box',
        ...extra,
    });

    return (
        <div style={{ minHeight: '100vh', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <div style={{ width: '100%', maxWidth: 360 }}>

                {/* Logo */}
                <div style={{ marginBottom: '2rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f0f2', letterSpacing: '-0.01em', marginBottom: 3 }}>ConnectSpace</div>
                    <div style={{ fontSize: '0.75rem', color: '#35353c' }}>← Back to home</div>
                </div>

                <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f0f0f2', letterSpacing: '-0.02em', margin: '0 0 0.3rem' }}>
                    {tab === 0 ? 'Sign in' : 'Create account'}
                </h1>
                <p style={{ fontSize: '0.82rem', color: '#55555f', margin: '0 0 1.5rem' }}>
                    {tab === 0
                        ? 'Enter your credentials to continue'
                        : 'Fill in your details to get started'}
                </p>

                {/* Tabs — Feature 2: both Sign in and Sign up clearly visible */}
                <div style={{ display: 'flex', gap: 2, background: '#18181b', border: '1px solid #2a2a2f', borderRadius: 7, padding: 3, marginBottom: '1.5rem' }}>
                    {['Sign in', 'Sign up'].map((label, i) => (
                        <button key={i} onClick={() => { setTab(i); setError(''); setName(''); setUsername(''); setPassword(''); }}
                            style={{
                                flex: 1, padding: '0.45rem', border: 'none', borderRadius: 5,
                                background: tab === i ? '#1f1f23' : 'transparent',
                                color: tab === i ? '#f0f0f2' : '#55555f',
                                fontWeight: tab === i ? 500 : 400,
                                fontSize: '0.85rem', cursor: 'pointer',
                                fontFamily: 'inherit', transition: 'all 0.15s',
                                boxShadow: tab === i ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                            }}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div style={{ background: 'rgba(220,64,64,0.07)', border: '1px solid rgba(220,64,64,0.18)', borderRadius: 6, padding: '8px 12px', fontSize: '0.8rem', color: '#f87171', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                {/* Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {tab === 1 && (
                        <div>
                            <label style={{ fontSize: '0.75rem', color: '#55555f', display: 'block', marginBottom: 5 }}>Full name</label>
                            <input style={inp()} value={name} onChange={e => setName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                                placeholder="Your name" autoFocus
                                onFocus={e => e.target.style.borderColor = '#5b5fc7'}
                                onBlur={e => e.target.style.borderColor = '#2a2a2f'} />
                        </div>
                    )}
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#55555f', display: 'block', marginBottom: 5 }}>Username</label>
                        <input style={inp()} value={username} onChange={e => setUsername(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAuth()}
                            placeholder="username" autoFocus={tab === 0}
                            onFocus={e => e.target.style.borderColor = '#5b5fc7'}
                            onBlur={e => e.target.style.borderColor = '#2a2a2f'} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#55555f', display: 'block', marginBottom: 5 }}>Password</label>
                        <input style={inp()} type="password" value={password} onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAuth()}
                            placeholder="••••••••"
                            onFocus={e => e.target.style.borderColor = '#5b5fc7'}
                            onBlur={e => e.target.style.borderColor = '#2a2a2f'} />
                    </div>
                </div>

                <button onClick={handleAuth}
                    style={{ width: '100%', padding: '9px', background: '#5b5fc7', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.target.style.background = '#4a4db0'}
                    onMouseLeave={e => e.target.style.background = '#5b5fc7'}>
                    {tab === 0 ? 'Sign in' : 'Create account'}
                </button>

                {/* Switch tab link */}
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#35353c' }}>
                    {tab === 0 ? (
                        <>Don't have an account?{' '}
                            <span onClick={() => { setTab(1); setError(''); }} style={{ color: '#818cf8', cursor: 'pointer' }}>Sign up</span>
                        </>
                    ) : (
                        <>Already have an account?{' '}
                            <span onClick={() => { setTab(0); setError(''); }} style={{ color: '#818cf8', cursor: 'pointer' }}>Sign in</span>
                        </>
                    )}
                </div>

                <div style={{ marginTop: '1.5rem', padding: '10px 12px', background: '#18181b', border: '1px solid #2a2a2f', borderRadius: 6, fontSize: '0.75rem', color: '#35353c', lineHeight: 1.6 }}>
                    Video calls use WebRTC peer-to-peer — no video data passes through our servers.
                </div>
            </div>

            <Snackbar open={open} autoHideDuration={4000} onClose={() => setOpen(false)}>
                <Alert severity="success" onClose={() => setOpen(false)}>Account created — sign in to continue.</Alert>
            </Snackbar>
        </div>
    );
}