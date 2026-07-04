import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../App.css';

export default function History() {
    const { getHistoryOfUser, addToUserHistory, clearUserHistory } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const [clearing, setClearing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        getHistoryOfUser().then(setMeetings).catch(() => {});
    }, [getHistoryOfUser]);

    const handleRejoin = async (code) => {
        await addToUserHistory(code);
        // autoRejoin: skip the "type your name" screen — VideoMeet.jsx
        // uses the logged-in account's name and joins immediately. If the
        // meeting has since ended, it shows "Meeting ended" right away
        // instead of asking for a name first.
        navigate(`/${code}`, { state: { autoRejoin: true } });
    };

    const handleClearHistory = async () => {
        if (meetings.length === 0) return;
        if (!window.confirm('Clear all meeting history? This can\'t be undone.')) return;
        setClearing(true);
        try {
            await clearUserHistory();
            setMeetings([]);
        } catch {
            alert('Could not clear history — please try again.');
        } finally {
            setClearing(false);
        }
    };

    const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <>
            <div className="navBar">
                <span className="navBarBrand" style={{ cursor: 'pointer' }} onClick={() => navigate('/home')}>ConnectSpace</span>
                <button onClick={() => navigate('/home')}
                    style={{ background: 'transparent', border: '1px solid #2a2a2f', color: '#8b8b99', fontSize: '0.8rem', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ← Back
                </button>
            </div>

            <div className="historyContainer">
                <div className="historyHeader">
                    <h2>Meeting history</h2>
                    <span style={{ fontSize: '0.78rem', color: '#55555f', marginLeft: 'auto' }}>{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</span>
                    {meetings.length > 0 && (
                        <button onClick={handleClearHistory} disabled={clearing}
                            style={{ background: 'transparent', border: '1px solid rgba(220,64,64,0.3)', color: '#dc4040', fontSize: '0.76rem', padding: '5px 12px', borderRadius: 5, cursor: clearing ? 'default' : 'pointer', fontFamily: 'inherit', marginLeft: 10, opacity: clearing ? 0.6 : 1 }}>
                            {clearing ? 'Clearing…' : 'Clear history'}
                        </button>
                    )}
                </div>

                {meetings.length === 0 ? (
                    <div className="emptyHistory">
                        <p>No meetings yet</p>
                        <span>Your past meetings will appear here</span>
                    </div>
                ) : meetings.map((m, i) => (
                    <div className="historyCard" key={i}>
                        <div>
                            <div className="historyCardCode">{m.meetingCode}</div>
                            <div className="historyCardDate">{fmt(m.date)}</div>
                        </div>
                        <button className="rejoinBtn" onClick={() => handleRejoin(m.meetingCode)}>Rejoin</button>
                    </div>
                ))}
            </div>
        </>
    );
}