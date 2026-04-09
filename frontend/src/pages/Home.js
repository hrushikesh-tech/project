import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {

    const [user, setUser] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const loggedUser = localStorage.getItem('loggedInUser');

        if (!loggedUser) {
            navigate('/login');
        } else {
            setUser(loggedUser);
        }
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div>
            <h1>Welcome {user}</h1>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}

export default Home;