import React from "react";
import { ShoppingItem } from "../../types";
import { M3Button } from "../UI";

export const DeleteModal: React.FC<{
    itemToDelete: ShoppingItem | null;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ itemToDelete, onConfirm, onCancel }) => {
    if (!itemToDelete) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm m-4">
                <h3 className="text-lg font-semibold text-slate-800">Confirmar Exclusão</h3>
                <p className="text-slate-600 mt-2">
                    Tem certeza que deseja remover <span className="font-bold">{itemToDelete.name}</span> da sua lista?
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <M3Button variant="text" onClick={onCancel}>Cancelar</M3Button>
                    <M3Button variant="filled" onClick={onConfirm} className="!bg-red-600 hover:!bg-red-700">
                        Remover
                    </M3Button>
                </div>
            </div>
        </div>
    );
};
