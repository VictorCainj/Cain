import React from "react";
import { User } from "../../types";
import { M3Button } from "../UI";

export const Header: React.FC<{ currentUser: User; onLogout: () => void }> = ({ currentUser, onLogout }) => (
    <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Shopping Pro</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 hidden sm:block">Olá, {currentUser.username}</span>
                    <M3Button onClick={onLogout} variant="outlined">Sair</M3Button>
                </div>
            </div>
        </div>
    </header>
);
