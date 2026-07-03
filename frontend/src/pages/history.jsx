import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../App.css';

export default function History() {
    const { getHistoryOfUser, addToUserHistory } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        getHistoryOfUser().then(setMeetings).catch(() => {});
    }, []);

    const handleRejoin = async (code) => {
        await addToUserHistory(code);
        navigate(`/${code}`);
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