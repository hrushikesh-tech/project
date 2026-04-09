import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Login() {

    const [loginInfo, setLoginInfo] = useState({
        email: '',
        password: ''
    });

    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLoginInfo({ ...loginInfo, [name]: value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch("http://localhost:8080/auth/login", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginInfo)
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("loggedInUser", data.name);

                alert("Login successful");
                navigate('/home');
            } else {
                alert(data.message);
            }

        } catch (err) {
            alert("Error");
        }
    };

    return (
        <div className='container'>
            <h1>Login</h1>

            <form onSubmit={handleLogin}>
                <input name="email" onChange={handleChange} placeholder="Email" />
                <input type="password" name="password" onChange={handleChange} placeholder="Password" />

                <button>Login</button>

                <span>Don't have account? <Link to="/signup">Signup</Link></span>
            </form>
        </div>
    );
}

export default Login;