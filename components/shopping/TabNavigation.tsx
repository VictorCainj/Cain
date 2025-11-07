import React from "react";
import { Tab } from "../../types";

const TABS: [Tab, string][] = [
    ['list', 'Lista de Compras'],
    ['history', 'Histórico'],
    ['compare', 'Comparar']
];

export const TabNavigation: React.FC<{
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
}> = ({ activeTab, setActiveTab }) => (
    <nav className="border-b border-slate-200">
        <div className="flex">
            {TABS.map(([tabId, tabName]) => (
                <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`relative flex-1 p-4 text-sm font-semibold transition-colors duration-200 focus:outline-none ${activeTab === tabId ? 'text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    {tabName}
                    {activeTab === tabId && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>}
                </button>
            ))}
        </div>
    </nav>
);
