import React, { useState, useMemo } from "react";
import { ShoppingItem } from "../../types";
import { M3Button, M3Fab } from "../UI";
import { ShoppingListItem } from "./ShoppingListItem";

export const ShoppingList: React.FC<{
    shoppingList: ShoppingItem[];
    onSaveList: () => void;
    onDeleteItem: (item: ShoppingItem) => void;
    onEditItem: (item: ShoppingItem) => void;
    onViewItemDetails: (item: ShoppingItem) => void;
    onClearAllRequest: () => void;
    isListening: boolean;
    onToggleListening: () => void;
    onUpdateItemQuantity: (itemId: number, newQuantity: number) => void;
}> = ({ shoppingList, onSaveList, onDeleteItem, onEditItem, onViewItemDetails, onClearAllRequest, isListening, onToggleListening, onUpdateItemQuantity }) => {
    
    const [categoryFilter, setCategoryFilter] = useState('all');

    const categories = useMemo(() => {
        const uniqueCategories = new Set(shoppingList.map(item => item.category || 'Outros'));
        return ['all', ...Array.from(uniqueCategories)];
    }, [shoppingList]);

    const filteredList = useMemo(() => {
        if (categoryFilter === 'all') {
            return shoppingList;
        }
        return shoppingList.filter(item => (item.category || 'Outros') === categoryFilter);
    }, [shoppingList, categoryFilter]);

    const calculateTotal = () => {
        return shoppingList.reduce((total, item) => total + (item.price || 0) * item.quantity, 0).toFixed(2);
    };

    return (
        <div className="animate-tab-pane">
            {shoppingList.length > 0 && categories.length > 2 && (
                <div className="mb-4 pb-4 border-b border-slate-200">
                    <h3 className="text-sm font-medium text-slate-600 mb-2">Filtrar por Categoria</h3>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setCategoryFilter(category)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                                    categoryFilter === category
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {category === 'all' ? 'Todas' : category}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                {shoppingList.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                        <span className="material-symbols-outlined text-6xl text-slate-300">shopping_cart</span>
                        <p className="text-slate-600 mt-4 font-medium">Sua lista está vazia.</p>
                        <p className="text-sm text-slate-400 mt-1">Use o botão do microfone para adicionar itens por voz.</p>
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                        <span className="material-symbols-outlined text-6xl text-slate-300">filter_alt_off</span>
                        <p className="text-slate-600 mt-4 font-medium">Nenhum item encontrado.</p>
                        <p className="text-sm text-slate-400 mt-1">Não há itens nesta categoria.</p>
                    </div>
                ) : (
                    filteredList.map(item => (
                        <ShoppingListItem
                          key={item.id}
                          item={item}
                          onDeleteItem={onDeleteItem}
                          onEditItem={onEditItem}
                          onViewItemDetails={onViewItemDetails}
                          onUpdateItemQuantity={onUpdateItemQuantity}
                        />
                    ))
                )}
            </div>
            {shoppingList.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <p className="text-lg font-semibold text-center sm:text-left w-full sm:w-auto order-2 sm:order-1">Total: <span className="text-slate-900">R$ {calculateTotal()}</span></p>
                    <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                        <M3Button onClick={onSaveList} variant="filled" className="flex-1">Salvar Lista</M3Button>
                        <M3Button onClick={onClearAllRequest} variant="outlined" className="!border-red-200 !text-red-600 hover:!bg-red-50 flex-1">
                           <span className="material-symbols-outlined text-base">delete_sweep</span>
                           Limpar
                        </M3Button>
                    </div>
                </div>
            )}
            <M3Fab onClick={onToggleListening} isListening={isListening} />
        </div>
    );
};