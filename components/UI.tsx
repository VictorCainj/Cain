import React from "react";

export const M3Button: React.FC<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; type?: 'button' | 'submit'; variant?: 'filled' | 'text' | 'outlined'; className?: string; }> = ({ onClick, children, type = 'button', variant = 'filled', className = '' }) => {
    const baseClasses = 'ripple font-semibold rounded-lg px-5 py-2.5 text-sm transition-all duration-200 focus:outline-none flex items-center justify-center gap-2 tracking-wide';
    const variantClasses = {
        filled: 'bg-slate-800 text-white shadow-sm hover:bg-slate-700',
        text: 'text-slate-700 hover:bg-slate-100',
        outlined: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    };
    return <button type={type} onClick={onClick} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</button>;
};

export const M3Fab: React.FC<{ onClick: () => void; isListening: boolean; }> = ({ onClick, isListening }) => (
    <div className="fixed bottom-6 right-6 z-10">
        <button onClick={onClick} className={`ripple w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-600 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`} aria-label={isListening ? 'Parar de ouvir' : 'Adicionar com Voz'}>
            <span className="material-symbols-outlined text-white text-2xl">{isListening ? 'mic_off' : 'mic'}</span>
        </button>
    </div>
);


export const M3TextField: React.FC<{ type: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ type, placeholder, value, onChange }) => (
    <div>
        <label className="text-sm font-medium text-slate-600 ml-1 mb-1 block">{placeholder}</label>
        <input type={type} placeholder={`Digite seu ${placeholder.toLowerCase()}`} value={value} onChange={onChange} className="w-full px-4 py-3 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none input-focus-ring transition-shadow text-slate-900 placeholder-slate-400" />
    </div>
);