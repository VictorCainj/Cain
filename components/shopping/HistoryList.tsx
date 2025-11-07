import React from "react";
import { ShoppingItem } from "../../types";

export const HistoryList: React.FC<{ history: Record<string, ShoppingItem[]> }> = ({ history }) => (
    <div className="animate-tab-pane max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Histórico de Compras</h2>
        {Object.keys(history).length === 0 ? (
            <p className="text-center text-slate-500 py-16">Nenhuma lista foi salva ainda.</p>
        ) : (
            // Fix: Explicitly type the destructured arguments in map to resolve the 'unknown' type for 'list'.
            Object.entries(history).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, list]: [string, ShoppingItem[]]) => (
                <div key={date} className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="font-medium text-slate-800 border-b border-slate-200 pb-2 mb-3">
                        Compra de {new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {list.map(item => (
                            <li key={item.id} className="flex justify-between items-center text-slate-600">
                                <span>{item.name} (x{item.quantity})</span>
                                {item.price && <span>R$ {(item.price * item.quantity).toFixed(2)}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            ))
        )}
    </div>
);