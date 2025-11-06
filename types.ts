export interface ShoppingItem {
    id: number;
    name: string;
    quantity: number;
    price?: number;
    imageUrl: string | null;
    imageLoading: boolean;
}

export interface User {
    username: string;
    email: string;
    password: string; // Em uma aplicação real, isso seria um hash
}

export type Tab = 'list' | 'history' | 'compare';

export type Route = 'login' | 'register' | 'app';