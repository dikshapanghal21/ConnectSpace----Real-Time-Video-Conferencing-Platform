import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import withAuth from '../utils/withAuth';
import '../App.css';

function HomeComponent() {
    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState('');
    const [copied, setCopied] = useState(false);
    const { addToUserHistory } = useContext(AuthContext);

    const handleJoin = async () => {
        if (!meetingCode.trim()) return;
        await addToUserHistory(meetingCode.trim());
        navigate(`/${meetingCode.trim()}`);
    };

    const handleNewMeeting = () => {
        const code = Math.random().toString(36).substring(2, 9);
        setMeetingCode(code);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(`${window.location.origin}/${meetingCode}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const inp = {
        flex: 1,
        padding: '8px 12px',
        background: '#18181b',
        border: '1px solid #2a2a2f',
        borderRadius: '6px',
        color: '#f0f0f2',
        fontSize: '0.88rem',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.15s',
    };

    return (
        <>
            <div className="navBar">
                <span className="navBarBrand" style={{ cursor: 'pointer' }} onClick={() => navigate('/home')}>ConnectSpace</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => navigate('/history')}
                        style={{ background: 'transparent', border: '1px solid #2a2a2f', color: '#8b8b99', fontSize: '0.8rem', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.target.style.color = '#f0f0f2'; e.target.style.borderColor = '#35353c'; }}
                        onMouseLeave={e => { e.target.style.color = '#8b8b99'; e.target.style.borderColor = '#2a2a2f'; }}>
                        History
                    </button>
                    <button onClick={() => { localStorage.removeItem('token'); navigate('/auth'); }}
                        style={{ background: 'transparent', border: '1px solid #2a2a2f', color: '#8b8b99', fontSize: '0.8rem', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.target.style.color = '#f0f0f2'; e.target.style.borderColor = '#35353c'; }}
                        onMouseLeave={e => { e.target.style.color = '#8b8b99'; e.target.style.borderColor = '#2a2a2f'; }}>
                        Sign out
                    </button>
                </div>
            </div>

            <div className="meetContainer">
                <div className="leftPanel">
                    <h2>Start or join<br />a meeting</h2>
                    <p>Enter a code to join an existing call, or create a new one instantly.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
                        <div className="joinInputRow">
                            <input
                                style={inp}
                                value={meetingCode}
                                onChange={e => setMeetingCode(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                placeholder="Meeting code"
                                onFocus={e => e.target.style.borderColor = '#5b5fc7'}
                                onBlur={e => e.target.style.borderColor = '#2a2a2f'}
                            />
                            <button onClick={handleJoin} disabled={!meetingCode.trim()}
                                style={{ padding: '8px 18px', background: meetingCode.trim() ? '#5b5fc7' : '#1f1f23', border: '1px solid #2a2a2f', borderRadius: 6, color: meetingCode.trim() ? '#fff' : '#55555f', fontSize: '0.85rem', fontWeight: 500, cursor: meetingCode.trim() ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                                Join
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#35353c', fontSize: '0.78rem' }}>
                            <div style={{ flex: 1, height: 1, background: '#2a2a2f' }} />
                            or
                            <div style={{ flex: 1, height: 1, background: '#2a2a2f' }} />
                        </div>

                        <button className="newMeetBtn" onClick={handleNewMeeting}>
                            + New instant meeting
                        </button>
                    </div>

                    {meetingCode && (
                        <div style={{ background: '#18181b', border: '1px solid #2a2a2f', borderRadius: 6, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: '#55555f', marginBottom: 3 }}>Invite link</div>
                                <div style={{ fontSize: '0.8rem', color: '#8b8b99', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                    {window.location.origin}/{meetingCode}
                                </div>
                            </div>
                            <button onClick={handleCopy}
                                style={{ background: 'transparent', border: '1px solid #2a2a2f', color: copied ? '#4ade80' : '#8b8b99', fontSize: '0.75rem', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="rightPanel">
                    <img src="/logo3.png" alt="" />
                </div>
            </div>
        </>
    );
}

export default withAuth(HomeComponent);