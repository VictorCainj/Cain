import React from "react";
import { ShoppingItem } from "../../types";

export const ItemDetailsModal: React.FC<{
    item: ShoppingItem | null;
    onClose: () => void;
}> = ({ item, onClose }) => {
    if (!item) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-lg w-full max-w-sm m-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-64 bg-slate-100 flex items-center justify-center relative">
                     {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>
                    ) : (
                        <span className="material-symbols-outlined text-slate-400 text-6xl">image</span>
                    )}
                     <button 
                        onClick={onClose} 
                        className="absolute top-2 right-2 bg-black bg-opacity-30 text-white rounded-full p-1.5 hover:bg-opacity-50 transition-colors"
                        aria-label="Fechar"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6">
                    {item.category && <p className="text-sm font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full inline-block mb-2">{item.category}</p>}
                    <h2 className="text-2xl font-bold text-slate-800 capitalize">{item.name}</h2>
                    
                    <div className="mt-4 space-y-3 text-slate-600">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="font-medium">Preço Unitário</span>
                            <span className="font-semibold text-slate-800">{item.price ? `R$ ${item.price.toFixed(2)}` : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                             <span className="font-medium">Quantidade</span>
                            <span className="font-semibold text-slate-800">x {item.quantity}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-lg">Subtotal</span>
                            <span className="font-extrabold text-lg text-slate-900">
                                {item.price ? `R$ ${(item.price * item.quantity).toFixed(2)}` : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
