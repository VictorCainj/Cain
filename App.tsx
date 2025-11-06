import React, { useState, useEffect } from "react";
import { LoginPage, RegisterPage } from "./components/Auth";
import { ShoppingApp } from "./components/ShoppingApp";
import { User, Route } from "./types";

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [route, setRoute] = useState<Route>('login');

    useEffect(() => {
        const loggedInUser = localStorage.getItem('currentUser');
        if (loggedInUser) {
            setCurrentUser(JSON.parse(loggedInUser));
            setRoute('app');
        }
    }, []);

    const handleLoginSuccess = (user: User) => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        setCurrentUser(user);
        setRoute('app');
    };

    const handleRegisterSuccess = (user: User) => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        setCurrentUser(user);
        setRoute('app');
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        setRoute('login');
    };

    if (route === 'app' && currentUser) {
        return <ShoppingApp currentUser={currentUser} onLogout={handleLogout} />;
    }
    if (route === 'register') {
        return <RegisterPage onRegisterSuccess={handleRegisterSuccess} onSwitchToLogin={() => setRoute('login')} />;
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} onSwitchToRegister={() => setRoute('register')} />;
};

export default App;
