import React, { useState } from "react";
import { ShoppingItem } from "../../types";

export const ComparisonView: React.FC<{ history: Record<string, ShoppingItem[]> }> = ({ history }) => {
    const [comparisonItem, setComparisonItem] = useState<string | null>(null);

    const getComparisonData = () => {
        if (!comparisonItem) return [];
        const data: { date: string; quantity: number; price?: number }[] = [];
        // Fix: Explicitly type the destructured arguments in forEach to resolve the 'unknown' type for 'list'.
        Object.entries(history).forEach(([date, list]: [string, ShoppingItem[]]) => {
            list.forEach(item => {
                if (item.name.toLowerCase() === comparisonItem.toLowerCase()) {
                    data.push({ date, quantity: item.quantity, price: item.price });
                }
            });
        });
        return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    // Fix: Explicitly type 'item' in the map function to resolve the 'unknown' type error.
    const uniqueItemsInHistory = [...new Set(Object.values(history).flat().map((item: ShoppingItem) => item.name))];

    return (
        <div className="animate-tab-pane">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Comparação de Preços</h2>
            <div className="mb-6">
                <label htmlFor="item-select" className="block mb-2 text-sm font-medium text-slate-700">Selecione um item para comparar o histórico:</label>
                <select id="item-select" onChange={e => setComparisonItem(e.target.value)} className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                    <option value="">Escolha um item</option>
                    {uniqueItemsInHistory.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
            </div>
            {comparisonItem && (
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    {getComparisonData().length > 0 ? getComparisonData().map(({ date, quantity, price }) => (
                        <div key={date} className="bg-slate-50 p-3 rounded-lg flex justify-between items-center border border-slate-200 text-sm">
                            <span className="font-medium text-slate-700">{new Date(date).toLocaleDateString('pt-BR')}</span>
                            <span className="text-slate-600">Quantidade: {quantity}</span>
                            <span className="text-slate-800 font-semibold">
                                {price ? `R$${price.toFixed(2)} /un.` : 'Sem preço'}
                            </span>
                        </div>
                    )) : (
                        <p className="text-center text-slate-500 py-10">Nenhum dado de preço encontrado para este item.</p>
                    )}
                </div>
            )}
        </div>
    );
};