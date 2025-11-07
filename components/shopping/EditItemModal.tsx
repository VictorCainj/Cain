import React, { useState, useEffect } from "react";
import { ShoppingItem } from "../../types";
import { M3Button } from "../UI";

interface EditItemModalProps {
    item: ShoppingItem | null;
    onSave: (item: ShoppingItem) => void;
    onCancel: () => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({ item, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        if (item) {
            setName(item.name);
            setQuantity(item.quantity);
            setPrice(item.price?.toString() || '');
            setCategory(item.category || '');
        }
    }, [item]);

    if (!item) return null;

    const handleSave = () => {
        onSave({
            ...item,
            name,
            quantity: Number(quantity) || 1,
            price: Number(price) || undefined,
            category: category.trim() || 'Outros',
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm m-4">
                <h3 className="text-lg font-semibold text-slate-800">Editar Item</h3>
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="text-sm font-medium text-slate-600 ml-1 mb-1 block">Nome do Item</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none input-focus-ring" />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-slate-600 ml-1 mb-1 block">Categoria</label>
                        <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Frutas, Laticínios" className="w-full px-4 py-2 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none input-focus-ring" />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-medium text-slate-600 ml-1 mb-1 block">Quantidade</label>
                            <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" className="w-full px-4 py-2 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none input-focus-ring" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-slate-600 ml-1 mb-1 block">Preço (un.)</label>
                            <input type="text" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex: 4.99" className="w-full px-4 py-2 bg-slate-50 rounded-lg border border-slate-300 focus:outline-none input-focus-ring" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <M3Button variant="text" onClick={onCancel}>Cancelar</M3Button>
                    <M3Button variant="filled" onClick={handleSave}>Salvar</M3Button>
                </div>
            </div>
        </div>
    );
};