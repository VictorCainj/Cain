import { GoogleGenAI, FunctionDeclaration, Type, Modality, LiveServerMessage } from "@google/genai";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { M3Button, M3Fab } from "./UI";
import { ShoppingItem, User, Tab } from "../types";
import { encode, decode, decodeAudioData } from "../utils";

export const ShoppingApp: React.FC<{ currentUser: User; onLogout: () => void }> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<Record<string, ShoppingItem[]>>({});
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [comparisonItem, setComparisonItem] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | null>(null);

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

  const addItem = useCallback(async (name: string, quantity: number, price?: number) => {
    const normalizedName = name.toLowerCase().trim();
    const newItem: ShoppingItem = {
      id: Date.now(),
      name,
      quantity,
      price,
      imageUrl: imageCache[normalizedName] || null,
      imageLoading: !imageCache[normalizedName],
    };
    setShoppingList(prev => [...prev, newItem]);

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
  }, [ai.models, imageCache]);

  const handleConfirmRemove = () => {
    if (itemToDelete) {
        setShoppingList(prev => prev.filter(item => item.id !== itemToDelete.id));
        setItemToDelete(null);
    }
  };
  
  const saveList = () => {
    if(shoppingList.length === 0) return;
    const date = new Date();
    const key = date.toISOString();
    setHistory(prev => ({...prev, [key]: shoppingList}));
    setShoppingList([]);
    alert('Lista salva com sucesso!');
  };

  const calculateTotal = () => {
    return shoppingList.reduce((total, item) => total + (item.price || 0) * item.quantity, 0).toFixed(2);
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

  const getComparisonData = () => {
    if (!comparisonItem) return [];
    const data: { date: string; quantity: number; price?: number }[] = [];
    Object.entries(history).forEach(([date, list]) => {
      list.forEach(item => {
        if (item.name.toLowerCase() === comparisonItem.toLowerCase()) {
          data.push({ date, quantity: item.quantity, price: item.price });
        }
      });
    });
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const uniqueItemsInHistory = [...new Set(Object.values(history).flat().map(item => item.name))];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
        {itemToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
                <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm m-4">
                    <h3 className="text-lg font-semibold text-slate-800">Confirmar Exclusão</h3>
                    <p className="text-slate-600 mt-2">
                        Tem certeza que deseja remover <span className="font-bold">{itemToDelete.name}</span> da sua lista?
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <M3Button variant="text" onClick={() => setItemToDelete(null)}>Cancelar</M3Button>
                        <M3Button variant="filled" onClick={handleConfirmRemove} className="!bg-red-600 hover:!bg-red-700">
                            Remover
                        </M3Button>
                    </div>
                </div>
            </div>
        )}

        <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Shopping Pro</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-600 hidden sm:block">Olá, {currentUser.username}</span>
                        <M3Button onClick={onLogout} variant="outlined">Sair</M3Button>
                    </div>
                </div>
            </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <nav className="border-b border-slate-200">
                    <div className="flex">
                        {([['list', 'Lista de Compras'], ['history', 'Histórico'], ['compare', 'Comparar']] as [Tab, string][]).map(([tabId, tabName]) => (
                             <button key={tabId} onClick={() => setActiveTab(tabId)} className={`relative flex-1 p-4 text-sm font-semibold transition-colors duration-200 focus:outline-none ${activeTab === tabId ? 'text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                                 {tabName}
                                 {activeTab === tabId && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>}
                             </button>
                        ))}
                    </div>
                </nav>

                <div className="p-4 md:p-6 min-h-[70vh]">
                    {activeTab === 'list' && (
                      <div className="animate-tab-pane">
                        <div className="space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2">
                          {shoppingList.length === 0 ? (
                              <div className="text-center py-20 flex flex-col items-center">
                                <span className="material-symbols-outlined text-6xl text-slate-300">shopping_cart</span>
                                <p className="text-slate-600 mt-4 font-medium">Sua lista está vazia.</p>
                                <p className="text-sm text-slate-400 mt-1">Use o botão do microfone para adicionar itens por voz.</p>
                              </div>
                          ) : (
                              shoppingList.map(item => (
                                <div key={item.id} className="flex items-center bg-white p-4 rounded-xl border border-slate-200 transition-all duration-200 hover:shadow-md hover:border-slate-300">
                                    <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mr-4 overflow-hidden flex-shrink-0">
                                        {item.imageLoading ? ( <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500"></div> ) : item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>
                                        ) : ( <span className="material-symbols-outlined text-slate-400">image</span> )}
                                    </div>
                                    <div className="flex-grow grid grid-cols-2 md:grid-cols-3 gap-2 items-center">
                                        <div className="col-span-2 md:col-span-1">
                                            <p className="font-bold text-slate-800 capitalize">{item.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {item.price ? `R$ ${item.price.toFixed(2)} / un.` : 'Sem preço'}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-start md:justify-center">
                                            <p className="text-sm text-slate-600">
                                                <span className="font-medium">Qtd:</span> {item.quantity}
                                            </p>
                                        </div>
                                        <div className="col-span-2 md:col-span-1 text-left md:text-right">
                                            <p className="font-semibold text-slate-900">
                                                {item.price ? `R$ ${(item.price * item.quantity).toFixed(2)}` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setItemToDelete(item)} className="ml-4 text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors" aria-label={`Remover ${item.name}`}>
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                              ))
                          )}
                        </div>
                        {shoppingList.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
                              <M3Button onClick={saveList} variant="filled">Salvar Lista</M3Button>
                              <p className="text-lg font-semibold">Total: <span className="text-slate-900">R$ {calculateTotal()}</span></p>
                          </div>
                        )}
                        <M3Fab onClick={isListening ? stopListening : startListening} isListening={isListening} />
                      </div>
                    )}
                    {activeTab === 'history' && (
                      <div className="animate-tab-pane max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Histórico de Compras</h2>
                        {Object.keys(history).length === 0 ? (
                          <p className="text-center text-slate-500 py-16">Nenhuma lista foi salva ainda.</p>
                        ) : (
                          Object.entries(history).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, list]) => (
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
                    )}
                    {activeTab === 'compare' && (
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
                              {getComparisonData().length > 0 ? getComparisonData().map(({date, quantity, price}) => (
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
                    )}
                </div>
            </div>
        </main>
    </div>
  );
};