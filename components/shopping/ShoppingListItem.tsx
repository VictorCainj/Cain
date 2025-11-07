import React from "react";
import { ShoppingItem } from "../../types";

export const ShoppingListItem: React.FC<{
    item: ShoppingItem;
    onDeleteItem: (item: ShoppingItem) => void;
    onEditItem: (item: ShoppingItem) => void;
    onViewItemDetails: (item: ShoppingItem) => void;
    onUpdateItemQuantity: (itemId: number, newQuantity: number) => void;
}> = ({ item, onDeleteItem, onEditItem, onViewItemDetails, onUpdateItemQuantity }) => (
    <div 
        className="flex items-start bg-white p-4 rounded-xl border border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300 animate-item-enter gap-4 cursor-pointer"
        onClick={() => onViewItemDetails(item)}
    >
        {/* Image container: Made larger for more prominence. */}
        <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            {item.imageLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500"></div>
            ) : item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>
            ) : (
                <span className="material-symbols-outlined text-slate-400 text-3xl">image</span>
            )}
        </div>

        {/* Content area: Refactored for better readability and structure. */}
        <div className="flex-grow flex flex-col justify-between h-24">
            {/* Top section: Item name and delete button. */}
            <div>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 capitalize leading-tight">{item.name}</h3>
                        {item.category && <p className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full inline-block mt-1">{item.category}</p>}
                    </div>
                    <div className="flex items-center -mt-1 -mr-1">
                         <button onClick={(e) => { e.stopPropagation(); onEditItem(item); }} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-colors" aria-label={`Editar ${item.name}`}>
                            <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteItem(item); }} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors" aria-label={`Remover ${item.name}`}>
                            <span className="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </div>
                 <p className="text-xs text-slate-500 mt-1">
                    {item.price ? `R$ ${item.price.toFixed(2)} / un.` : 'Sem preço'}
                </p>
            </div>

            {/* Bottom section: Quantity controls and subtotal. */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full p-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateItemQuantity(item.id, item.quantity - 1); }} 
                        className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-100 transition-colors shadow-sm"
                        aria-label={`Diminuir quantidade de ${item.name}`}
                    >
                        <span className="material-symbols-outlined text-lg">remove</span>
                    </button>
                    <span className="font-bold text-base w-8 text-center select-none">{item.quantity}</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateItemQuantity(item.id, item.quantity + 1); }} 
                        className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-full hover:bg-slate-100 transition-colors shadow-sm"
                        aria-label={`Aumentar quantidade de ${item.name}`}
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                    </button>
                </div>
                <p className="font-semibold text-lg text-slate-900">
                    {item.price ? `R$ ${(item.price * item.quantity).toFixed(2)}` : 'N/A'}
                </p>
            </div>
        </div>
    </div>
);