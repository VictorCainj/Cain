import React, { useState } from "react";
import { M3Button, M3TextField } from "./UI";
import { User } from "../types";

const AuthFormContainer: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                 <h1 className="text-3xl font-bold text-slate-800">
                    Shopping Pro
                </h1>
                <p className="text-slate-500 mt-2">{subtitle}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 fade-in">
                <h2 className="text-xl text-left font-semibold text-slate-900 mb-6">
                    {title}
                </h2>
                {children}
            </div>
        </div>
    </div>
);

export const LoginPage: React.FC<{ onLoginSuccess: (user: User) => void; onSwitchToRegister: () => void; }> = ({ onLoginSuccess, onSwitchToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Preencha todos os campos.');
            return;
        }
        const users = JSON.parse(localStorage.getItem('shoppingAppUsers') || '[]') as User[];
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            onLoginSuccess(user);
        } else {
            setError('E-mail ou senha inválidos.');
        }
    };

    return (
        <AuthFormContainer title="Login" subtitle="Bem-vindo de volta!">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center">{error}</p>}
                <M3TextField type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
                <M3TextField type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
                <M3Button type="submit" variant="filled" className="w-full !mt-6 py-3">
                    Entrar
                </M3Button>
            </form>
            <p className="text-center text-sm mt-6 text-slate-600">
                Não tem uma conta? <button onClick={onSwitchToRegister} className="font-semibold text-slate-800 hover:underline">Cadastre-se</button>
            </p>
        </AuthFormContainer>
    );
};

export const RegisterPage: React.FC<{ onRegisterSuccess: (user: User) => void; onSwitchToLogin: () => void; }> = ({ onRegisterSuccess, onSwitchToLogin }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username || !email || !password || !confirmPassword) {
            setError('Preencha todos os campos.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não correspondem.');
            return;
        }
        
        const users = JSON.parse(localStorage.getItem('shoppingAppUsers') || '[]') as User[];
        if (users.some(u => u.email === email)) {
            setError('Este e-mail já está cadastrado.');
            return;
        }

        const newUser: User = { username, email, password };
        users.push(newUser);
        localStorage.setItem('shoppingAppUsers', JSON.stringify(users));
        onRegisterSuccess(newUser);
    };

    return (
        <AuthFormContainer title="Criar Conta" subtitle="Gerencie suas compras de forma inteligente.">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center">{error}</p>}
                <M3TextField type="text" placeholder="Nome de usuário" value={username} onChange={e => setUsername(e.target.value)} />
                <M3TextField type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
                <M3TextField type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
                <M3TextField type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <M3Button type="submit" variant="filled" className="w-full !mt-6 py-3">
                    Cadastre-se
                </M3Button>
            </form>
            <p className="text-center text-sm mt-6 text-slate-600">
                Já tem uma conta? <button onClick={onSwitchToLogin} className="font-semibold text-slate-800 hover:underline">Faça login</button>
            </p>
        </AuthFormContainer>
    );
};