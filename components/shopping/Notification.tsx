import React from "react";

export const Notification: React.FC<{ message: string | null }> = ({ message }) => {
    if (!message) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white py-2.5 px-5 rounded-full text-sm shadow-lg z-50 fade-in">
            {message}
        </div>
    );
};
