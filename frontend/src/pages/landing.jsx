import React from 'react';
import '../App.css';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    const features = [
        { icon: '🎥', title: 'HD video calling',       desc: 'Peer-to-peer WebRTC — no relay, no lag' },
        { icon: '💬', title: 'In-call chat',            desc: 'Send messages without unmuting' },
        { icon: '🖥️', title: 'Screen share',            desc: 'Spotlight view — shared screen takes the main stage' },
        { icon: '😀', title: 'Reactions & recording',   desc: 'Live emoji reactions, plus one-click call recording' },
    ];

    return (
        <div className="landingPageContainer">
            <nav>
                <h2 style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>ConnectSpace</h2>
                <div className="navlist">
                    <p onClick={() => navigate('/auth?tab=login')}>Sign in</p>
                    {/* Feature 2: dedicated Sign up button */}
                    <p onClick={() => navigate('/auth?tab=register')}>Sign up</p>
                    <div role="button" onClick={() => navigate('/auth?tab=register')}>Get started</div>
                </div>
            </nav>

            <div className="landingMainContainer">
                <div>
                    <div className="heroLabel">Open source · WebRTC · MERN</div>
                    <h1 className="heroTitle">
                        Video calls that<br />
                        actually <span className="accent">work</span>
                    </h1>
                    <p className="heroSubtitle">
                        No downloads. No accounts for guests. Just share a link and meet.
                        Built on WebRTC so the stream goes directly between browsers.
                    </p>
                    <div className="heroActions">
                        <span className="heroCTA" onClick={() => navigate('/auth?tab=register')}>Start a meeting</span>
                        <span className="heroSecondary" onClick={() => navigate('/auth?tab=login')}>Sign in</span>
                    </div>
                    <div className="heroStats">
                        <div className="heroStat"><span>P2P</span><span>No relay</span></div>
                        <div className="heroStat"><span>&lt;80ms</span><span>Typical latency</span></div>
                        <div className="heroStat"><span>E2E</span><span>Encrypted</span></div>
                    </div>
                </div>

                <div>
                    <div className="heroVisual">
                        <div className="heroVideoGrid">
                            {[
                                { initials: 'AK', bg: '#2a2a3e', color: '#818cf8', name: 'Arjun K.', speaking: true },
                                { initials: 'PM', bg: '#2a1e3e', color: '#a78bfa', name: 'Priya M.' },
                                { initials: 'RS', bg: '#1e2a3e', color: '#60a5fa', name: 'Rahul S.' },
                                { initials: 'NJ', bg: '#1e3a2a', color: '#4ade80', name: 'Neha J.' },
                            ].map((p, i) => (
                                <div key={i} className={`heroVideoTile${p.speaking ? ' speaking' : ''}`}>
                                    <div className="heroAvatar" style={{ background: p.bg, color: p.color }}>{p.initials}</div>
                                    <span>{p.name}</span>
                                    {p.speaking && (
                                        <span style={{ position: 'absolute', bottom: 6, left: 7, fontSize: '0.58rem', color: '#818cf8', fontWeight: 500 }}>● speaking</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="featuresSection">
                <h3>What's included</h3>
                <div className="featuresGrid">
                    {features.map((f, i) => (
                        <div className="featureItem" key={i}>
                            <div className="featureIcon">{f.icon}</div>
                            <h4>{f.title}</h4>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}