import { useEffect } from "react";

const RefreshHandler = ({ setIsAuthenticated }) => {
    useEffect(() => {
        const token = localStorage.getItem("token");
        setIsAuthenticated(!!token);
    }, []);

    return null;
};

export default RefreshHandler;