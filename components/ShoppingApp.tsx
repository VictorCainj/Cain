import { GoogleGenAI, FunctionDeclaration, Type, Modality, LiveServerMessage } from "@google/genai";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { ShoppingItem, User, Tab } from "../types";
import { encode, decode, decodeAudioData, playSuccessSound } from "../utils";

import { Header } from "./shopping/Header";
import { TabNavigation } from "./shopping/TabNavigation";
import { ShoppingList } from "./shopping/ShoppingList";
import { HistoryList } from "./shopping/HistoryList";
import { ComparisonView } from "./shopping/ComparisonView";
import { DeleteModal } from "./shopping/DeleteModal";
import { Notification } from "./shopping/Notification";
import { ClearAllModal } from "./shopping/ClearAllModal";
import { EditItemModal } from "./shopping/EditItemModal";
import { ItemDetailsModal } from "./shopping/ItemDetailsModal";

export const ShoppingApp: React.FC<{ currentUser: User; onLogout: () => void }> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<Record<string, ShoppingItem[]>>({});
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<ShoppingItem | null>(null);
  const [isClearAllModalVisible, setIsClearAllModalVisible] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const liveSession = useRef<any>(null);

  const outputAudioContext = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sources = useRef(new Set<AudioBufferSourceNode>());

  const getUserStorageKey = useCallback((key: string) => `${key}_${currentUser.email}`, [currentUser.email]);

  useEffect(() => {
    const savedHistory = localStorage.getItem(getUserStorageKey('shoppingHistory'));
    const savedCache = localStorage.getItem(getUserStorageKey('imageCache'));
    if (savedHistory) setHistory(JSON.parse(savedHistory) as Record<string, ShoppingItem[]>);
    if (savedCache) setImageCache(JSON.parse(savedCache) as Record<string, string>);
  }, [getUserStorageKey]);

  useEffect(() => {
    localStorage.setItem(getUserStorageKey('shoppingHistory'), JSON.stringify(history));
  }, [history, getUserStorageKey]);

  useEffect(() => {
    localStorage.setItem(getUserStorageKey('imageCache'), JSON.stringify(imageCache));
  }, [imageCache, getUserStorageKey]);

  useEffect(() => {
    if (!outputAudioContext.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            outputAudioContext.current = new AudioContext({ sampleRate: 24000 });
        }
    }
    return () => {
        sources.current.forEach(source => source.stop());
        sources.current.clear();
        outputAudioContext.current?.close();
    };
  }, []);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const addItem = useCallback(async (name: string, quantity: number, price?: number) => {
    const normalizedName = name.toLowerCase().trim();
    const existingItem = shoppingList.find(item => item.name.toLowerCase().trim() === normalizedName);

    if (existingItem) {
        setShoppingList(prev => prev.map(item => item.id === existingItem.id ? {...item, quantity: item.quantity + quantity} : item));
        return;
    }

    let category = 'Outros';
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Qual é a categoria de supermercado para "${name}"? Responda apenas com a categoria. Ex: Laticínios, Frutas, Higiene.`,
        });
        const generatedCategory = response.text.trim();
        if (generatedCategory) {
            category = generatedCategory.charAt(0).toUpperCase() + generatedCategory.slice(1);
        }
    } catch (e) {
        console.error("Erro ao buscar categoria:", e);
    }
    
    const newItem: ShoppingItem = {
      id: Date.now(),
      name,
      quantity,
      price,
      category,
      imageUrl: imageCache[normalizedName] || null,
      imageLoading: !imageCache[normalizedName],
    };
    setShoppingList(prev => [...prev, newItem]);
    playSuccessSound();

    if (imageCache[normalizedName]) return;

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Foto profissional e limpa do produto ${name} em um fundo branco simples, alta qualidade.`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
      });
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
      
      setShoppingList(prev =>
        prev.map(item =>
          item.id === newItem.id ? { ...item, imageUrl, imageLoading: false } : item
        )
      );
      setImageCache(prev => ({...prev, [normalizedName]: imageUrl}));
    } catch (error) {
      console.error("Erro na geração de imagem:", error);
      setShoppingList(prev =>
        prev.map(item =>
          item.id === newItem.id ? { ...item, imageLoading: false } : item
        )
      );
    }
  }, [ai.models, imageCache, shoppingList]);

  const handleConfirmRemove = () => {
    if (itemToDelete) {
        setShoppingList(prev => prev.filter(item => item.id !== itemToDelete.id));
        setItemToDelete(null);
    }
  };
  
  const handleUpdateItem = (updatedItem: ShoppingItem) => {
    setShoppingList(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    setEditingItem(null);
    showNotification("Item atualizado com sucesso.");
  };

  const handleUpdateItemQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setShoppingList(prev => prev.filter(item => item.id !== itemId));
    } else {
      setShoppingList(prev => 
        prev.map(item => 
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const handleClearAll = () => {
    setShoppingList([]);
    setIsClearAllModalVisible(false);
    showNotification("Lista de compras limpa.");
  };
  
  const saveList = () => {
    if(shoppingList.length === 0) {
        showNotification('Sua lista de compras está vazia.');
        return;
    }
    const date = new Date();
    const key = date.toISOString();
    setHistory(prev => ({...prev, [key]: shoppingList}));
    setShoppingList([]);
    showNotification('Lista salva com sucesso!');
  };
  
  const startListening = async () => {
      setIsListening(true);
      try {
          const stream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          
          const addItemToListFunctionDeclaration: FunctionDeclaration = {
              name: 'addItemToList',
              parameters: {
                  type: Type.OBJECT,
                  description: 'Adiciona um item à lista de compras do usuário.',
                  properties: {
                      itemName: { type: Type.STRING, description: 'O nome do item. Ex: "maçãs" ou "leite".' },
                      quantity: { type: Type.INTEGER, description: 'A quantidade do item. O padrão é 1.' },
                      price: { type: Type.NUMBER, description: 'O preço por item. Opcional.' },
                  },
                  required: ['itemName'],
              },
          };
          
          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              callbacks: {
                  onopen: () => console.log('Sessão de áudio aberta.'),
                  onmessage: async (message: LiveServerMessage) => {
                      if (message.toolCall?.functionCalls) {
                          for (const fc of message.toolCall.functionCalls) {
                              if (fc.name === 'addItemToList') {
                                  const { itemName, quantity = 1, price } = fc.args;
                                  addItem(itemName as string, quantity as number, price as number | undefined);
                                  sessionPromise.then(session => {
                                      session.sendToolResponse({
                                          functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                                      });
                                  });
                              }
                          }
                      }

                      const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                      if (base64EncodedAudioString && outputAudioContext.current) {
                        const ctx = outputAudioContext.current;
                        nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), ctx, 24000, 1);
                        const audioSource = ctx.createBufferSource();
                        audioSource.buffer = audioBuffer;
                        audioSource.connect(ctx.destination);
                        audioSource.addEventListener('ended', () => { sources.current.delete(audioSource); });
                        audioSource.start(nextStartTime.current);
                        nextStartTime.current += audioBuffer.duration;
                        sources.current.add(audioSource);
                      }

                      if (message.serverContent?.interrupted) {
                        sources.current.forEach(s => s.stop());
                        sources.current.clear();
                        nextStartTime.current = 0;
                      }
                  },
                  onerror: (e: ErrorEvent) => console.error('Erro na sessão de áudio:', e),
                  onclose: () => {
                      console.log('Sessão de áudio fechada.');
                      setIsListening(false);
                      scriptProcessor.disconnect();
                      source.disconnect();
                      inputAudioContext.close();
                      stream.getTracks().forEach(track => track.stop());
                      sources.current.forEach(s => s.stop());
                      sources.current.clear();
                      nextStartTime.current = 0;
                  },
              },
              config: {
                  responseModalities: [Modality.AUDIO],
                  tools: [{ functionDeclarations: [addItemToListFunctionDeclaration] }],
              },
          });

          liveSession.current = await sessionPromise;

          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);

      } catch (error) {
          console.error("Erro de acesso ao microfone:", error);
          setIsListening(false);
      }
  };

  const stopListening = () => {
      if (liveSession.current) {
          liveSession.current.close();
          liveSession.current = null;
      }
      setIsListening(false);
  };

  const handleToggleListening = () => {
    isListening ? stopListening() : startListening();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'list':
        return <ShoppingList
          shoppingList={shoppingList}
          onSaveList={saveList}
          onDeleteItem={setItemToDelete}
          onEditItem={setEditingItem}
          onViewItemDetails={setSelectedItemForDetails}
          onClearAllRequest={() => setIsClearAllModalVisible(true)}
          isListening={isListening}
          onToggleListening={handleToggleListening}
          onUpdateItemQuantity={handleUpdateItemQuantity}
        />;
      case 'history':
        return <HistoryList history={history} />;
      case 'compare':
        return <ComparisonView history={history} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Notification message={notification} />
      <DeleteModal
        itemToDelete={itemToDelete}
        onConfirm={handleConfirmRemove}
        onCancel={() => setItemToDelete(null)}
      />
      <ClearAllModal
        isOpen={isClearAllModalVisible}
        onConfirm={handleClearAll}
        onCancel={() => setIsClearAllModalVisible(false)}
      />
      <EditItemModal
        item={editingItem}
        onSave={handleUpdateItem}
        onCancel={() => setEditingItem(null)}
      />
      <ItemDetailsModal 
        item={selectedItemForDetails}
        onClose={() => setSelectedItemForDetails(null)}
      />
      <Header currentUser={currentUser} onLogout={onLogout} />
      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
          <div className="p-4 md:p-6 min-h-[70vh]">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};