import { useNavigate } from 'react-router-dom';
import { useEffect }   from 'react';

// ── Decode JWT payload without verifying signature (client-side only check) ──
// Real verification happens on the backend on every protected API call.
const isTokenExpired = (token) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // exp is in seconds, Date.now() is in ms
        return payload.exp * 1000 < Date.now();
    } catch {
        return true; // malformed token → treat as expired
    }
};

const withAuth = (WrappedComponent) => {
    return function AuthenticatedComponent(props) {
        const navigate = useNavigate();

        useEffect(() => {
            const token = localStorage.getItem('token');
            if (!token || isTokenExpired(token)) {
                localStorage.removeItem('token'); // clear stale token
                navigate('/auth');
            }
        }, [navigate]);

        return <WrappedComponent {...props} />;
    };
};

export default withAuth;