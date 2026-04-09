import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Signup() {

    const [SignupInfo, setSignupInfo] = useState({
        name: '',
        email: '',
        password: ''
    });

    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSignupInfo({ ...SignupInfo, [name]: value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch("http://localhost:8080/auth/signup", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(SignupInfo)
            });

            const data = await response.json();

            if (data.success) {
                alert("Signup successful");
                navigate('/login');
            } else {
                alert(data.message);
            }

        } catch (err) {
            alert("Error");
        }
    };

    return (
        <div className='container'>
            <h1>Signup</h1>

            <form onSubmit={handleSignup}>
                <input name="name" onChange={handleChange} placeholder="Name" />
                <input name="email" onChange={handleChange} placeholder="Email" />
                <input type="password" name="password" onChange={handleChange} placeholder="Password" />

                <button>Signup</button>

                <span>Already have account? <Link to="/login">Login</Link></span>
            </form>
        </div>
    );
}

export default Signup;