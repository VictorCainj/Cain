import { GoogleGenAI, FunctionDeclaration, Type, Modality, LiveServerMessage, Chat } from "@google/genai";
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";

// --- TYPES & INTERFACES ---
interface ShoppingItem {
  id: number;
  name: string;
  quantity: number;
  price?: number;
  imageUrl: string | null;
  imageLoading: boolean;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

interface User {
  username: string;
  email: string;
  password: string; // In a real app, this would be a hash
}

type Tab = 'list' | 'chat' | 'history' | 'compare';
type Route = 'login' | 'register' | 'app';

// --- AUDIO UTILITY FUNCTIONS ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- M3 UI COMPONENTS ---
const M3Button: React.FC<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; type?: 'button' | 'submit'; variant?: 'filled' | 'text' | 'outlined'; className?: string; }> = ({ onClick, children, type = 'button', variant = 'filled', className = '' }) => {
    const baseClasses = 'ripple font-medium rounded-full px-6 py-2.5 text-sm transition-all duration-200 focus:outline-none flex items-center justify-center gap-2';
    const variantClasses = {
        filled: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md',
        text: 'text-blue-600 hover:bg-blue-50',
        outlined: 'border border-gray-300 text-blue-600 hover:bg-blue-50',
    };
    return <button type={type} onClick={onClick} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</button>;
};

const M3Fab: React.FC<{ onClick: () => void; isListening: boolean; }> = ({ onClick, isListening }) => (
    <div className="fixed bottom-6 right-6 z-10">
        <button onClick={onClick} className={`ripple w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`} aria-label={isListening ? 'Parar de ouvir' : 'Adicionar com Voz'}>
            <span className="material-symbols-outlined text-white text-3xl">{isListening ? 'mic_off' : 'mic'}</span>
        </button>
    </div>
);


const M3TextField: React.FC<{ type: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ type, placeholder, value, onChange }) => (
    <div>
        <label className="text-xs text-gray-600 ml-1">{placeholder}</label>
        <input type={type} placeholder={placeholder} value={value} onChange={onChange} className="w-full p-3 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none input-focus-ring transition-shadow" />
    </div>
);

// --- MAIN SHOPPING APP COMPONENT ---
const ShoppingApp: React.FC<{ currentUser: User; onLogout: () => void }> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<Record<string, ShoppingItem[]>>({});
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [comparisonItem, setComparisonItem] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const chatInstance = useRef<Chat | null>(null);
  const liveSession = useRef<any>(null);

  const outputAudioContext = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sources = useRef(new Set<AudioBufferSourceNode>());

  const getUserStorageKey = useCallback((key: string) => `${key}_${currentUser.email}`, [currentUser.email]);

  useEffect(() => {
    const savedHistory = localStorage.getItem(getUserStorageKey('shoppingHistory'));
    const savedCache = localStorage.getItem(getUserStorageKey('imageCache'));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedCache) setImageCache(JSON.parse(savedCache));
  }, [getUserStorageKey]);

  useEffect(() => {
    localStorage.setItem(getUserStorageKey('shoppingHistory'), JSON.stringify(history));
  }, [history, getUserStorageKey]);

  useEffect(() => {
    localStorage.setItem(getUserStorageKey('imageCache'), JSON.stringify(imageCache));
  }, [imageCache, getUserStorageKey]);

  useEffect(() => {
    if (activeTab === 'chat' && !chatInstance.current) {
      chatInstance.current = ai.chats.create({ model: 'gemini-2.5-flash' });
      setChatMessages([{ sender: 'bot', text: 'Olá! Como posso ajudar?' }]);
    }
  }, [activeTab, ai.chats]);

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
        prompt: `Professional, clean product photo of ${name} on a simple white background, high quality.`,
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
      console.error("Image generation error:", error);
      setShoppingList(prev =>
        prev.map(item =>
          item.id === newItem.id ? { ...item, imageLoading: false } : item
        )
      );
    }
  }, [ai.models, imageCache]);

  const removeItem = (id: number) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
  };
  
  const saveList = () => {
    if(shoppingList.length === 0) return;
    const date = new Date();
    const key = date.toISOString();
    setHistory(prev => ({...prev, [key]: shoppingList}));
    setShoppingList([]);
    alert('List saved successfully!');
  };

  const calculateTotal = () => {
    return shoppingList.reduce((total, item) => total + (item.price || 0) * item.quantity, 0).toFixed(2);
  };
  
  const startListening = async () => {
      setIsListening(true);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          
          const addItemToListFunctionDeclaration: FunctionDeclaration = {
              name: 'addItemToList',
              parameters: {
                  type: Type.OBJECT,
                  description: 'Adds an item to the user\'s shopping list.',
                  properties: {
                      itemName: { type: Type.STRING, description: 'The name of the item. E.g., "apples" or "milk".' },
                      quantity: { type: Type.INTEGER, description: 'The quantity of the item. Defaults to 1.' },
                      price: { type: Type.NUMBER, description: 'The price per item. Optional.' },
                  },
                  required: ['itemName'],
              },
          };
          
          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              callbacks: {
                  onopen: () => console.log('Audio session opened.'),
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
                  onerror: (e: ErrorEvent) => console.error('Audio session error:', e),
                  onclose: () => {
                      console.log('Audio session closed.');
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
              const pcmBlob = { data: encode(new Uint8Array(new Int16Array(inputData.map(v => v * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);

      } catch (error) {
          console.error("Microphone access error:", error);
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
  
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !chatInstance.current) return;
    setChatMessages(prev => [...prev, { sender: 'user', text: message }]);
    try {
        const response = await chatInstance.current.sendMessage({ message });
        setChatMessages(prev => [...prev, { sender: 'bot', text: response.text }]);
    } catch (error) {
        console.error("Chat error:", error);
        setChatMessages(prev => [...prev, { sender: 'bot', text: 'Sorry, an error occurred.' }]);
    }
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
    <div className="min-h-screen bg-gray-50 text-gray-800">
        <header className="bg-white shadow-sm sticky top-0 z-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-3">
                    <h1 className="text-xl font-medium text-gray-900">Shopping Pro</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">Olá, {currentUser.username}</span>
                        <M3Button onClick={onLogout} variant="text">Sair</M3Button>
                    </div>
                </div>
            </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="bg-white rounded-2xl shadow-md border border-gray-200">
                <nav className="border-b border-gray-200">
                    <div className="flex justify-around">
                        {([['list', 'Shopping List'], ['chat', 'Assistant'], ['history', 'History'], ['compare', 'Compare']] as [Tab, string][]).map(([tabId, tabName]) => (
                             <button key={tabId} onClick={() => setActiveTab(tabId)} className={`relative flex-1 p-4 text-sm font-medium transition-colors duration-200 ${activeTab === tabId ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                                 {tabName}
                                 {activeTab === tabId && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
                             </button>
                        ))}
                    </div>
                </nav>

                <div className="p-4 md:p-6 min-h-[70vh]">
                    {activeTab === 'list' && (
                      <div className="fade-in">
                        <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2">
                          {shoppingList.length === 0 ? (
                              <div className="text-center py-16">
                                <span className="material-symbols-outlined text-6xl text-gray-300">shopping_cart</span>
                                <p className="text-center text-gray-500 mt-4">Your list is empty.</p>
                                <p className="text-sm text-gray-400 mt-1">Use the microphone button to add items.</p>
                              </div>
                          ) : (
                              shoppingList.map(item => (
                                  <div key={item.id} className="flex items-center bg-white p-3 rounded-xl border border-gray-200">
                                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mr-4 overflow-hidden">
                                          {item.imageLoading ? ( <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div> ) : item.imageUrl ? (
                                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>
                                          ) : ( <span className="material-symbols-outlined text-gray-400">image</span> )}
                                      </div>
                                      <div className="flex-grow">
                                          <p className="font-medium text-gray-800">{item.name}</p>
                                          <p className="text-sm text-gray-500">
                                              Quantity: {item.quantity}
                                              {item.price && ` - $${item.price.toFixed(2)}/each`}
                                          </p>
                                      </div>
                                      <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 hover:bg-gray-100 p-2 rounded-full transition-colors" aria-label={`Remove ${item.name}`}>
                                          <span className="material-symbols-outlined">delete</span>
                                      </button>
                                  </div>
                              ))
                          )}
                        </div>
                        {shoppingList.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                              <M3Button onClick={saveList} variant="filled">Save List</M3Button>
                              <p className="text-lg font-medium">Total: <span className="text-blue-600">$ {calculateTotal()}</span></p>
                          </div>
                        )}
                        <M3Fab onClick={isListening ? stopListening : startListening} isListening={isListening} />
                      </div>
                    )}
                    {activeTab === 'chat' && (
                        <div className="flex flex-col h-[65vh] fade-in">
                          <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
                              {chatMessages.map((msg, index) => (
                                  <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                      {msg.sender === 'bot' && <span className="material-symbols-outlined text-gray-500 text-3xl">smart_toy</span>}
                                      <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2.5 rounded-2xl shadow-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                                          <p className="text-sm">{msg.text}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(e.currentTarget.message.value); e.currentTarget.reset(); }} className="flex p-2 mt-2 border-t border-gray-200 items-center">
                              <input type="text" name="message" placeholder="Ask the assistant..." className="flex-grow p-3 bg-gray-100 rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-gray-800"/>
                              <button type="submit" className="ml-3 p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all ripple" aria-label="Send message">
                                <span className="material-symbols-outlined">send</span>
                              </button>
                          </form>
                      </div>
                    )}
                    {activeTab === 'history' && (
                      <div className="fade-in max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
                        <h2 className="text-lg font-medium text-gray-800 mb-4">Purchase History</h2>
                        {Object.keys(history).length === 0 ? (
                          <p className="text-center text-gray-500 py-16">No saved lists yet.</p>
                        ) : (
                          Object.entries(history).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, list]) => (
                            <div key={date} className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <h3 className="font-medium text-gray-700 border-b border-gray-200 pb-2 mb-2">
                                Purchase from {new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </h3>
                              <ul className="space-y-2 text-sm">
                                {list.map(item => (
                                  <li key={item.id} className="flex justify-between items-center text-gray-600">
                                    <span>{item.name} (x{item.quantity})</span>
                                    {item.price && <span>$ {(item.price * item.quantity).toFixed(2)}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {activeTab === 'compare' && (
                      <div className="fade-in">
                        <h2 className="text-lg font-medium text-gray-800 mb-4">Price Comparison</h2>
                        <div className="mb-6">
                            <label htmlFor="item-select" className="block mb-2 text-sm font-medium text-gray-700">Select an item to compare:</label>
                            <select id="item-select" onChange={e => setComparisonItem(e.target.value)} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                <option value="">Choose an item</option>
                                {uniqueItemsInHistory.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </div>
                        {comparisonItem && (
                          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                              {getComparisonData().map(({date, quantity, price}) => (
                                <div key={date} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border border-gray-200 text-sm">
                                  <span className="font-medium text-gray-700">{new Date(date).toLocaleDateString('en-US')}</span>
                                  <span className="text-gray-600">Quantity: {quantity}</span>
                                  <span className="text-blue-600 font-medium">
                                      {price ? `$${price.toFixed(2)} /each` : 'No price info'}
                                  </span>
                                </div>
                              ))}
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

// --- AUTHENTICATION COMPONENTS (M3 Styled) ---
const AuthFormContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 fade-in">
                <h1 className="text-2xl text-center font-medium text-gray-900 mb-6">
                    {title}
                </h1>
                {children}
            </div>
        </div>
    </div>
);

const LoginPage: React.FC<{ onLoginSuccess: (user: User) => void; onSwitchToRegister: () => void; }> = ({ onLoginSuccess, onSwitchToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please fill in all fields.');
            return;
        }
        const users = JSON.parse(localStorage.getItem('shoppingAppUsers') || '[]') as User[];
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            onLoginSuccess(user);
        } else {
            setError('Invalid email or password.');
        }
    };

    return (
        <AuthFormContainer title="Welcome Back">
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center">{error}</p>}
                <M3TextField type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <M3TextField type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <M3Button type="submit" variant="filled" className="w-full">
                    Log In
                </M3Button>
            </form>
            <p className="text-center text-sm mt-6 text-gray-600">
                Don't have an account? <button onClick={onSwitchToRegister} className="font-medium text-blue-600 hover:underline">Sign up</button>
            </p>
        </AuthFormContainer>
    );
};

const RegisterPage: React.FC<{ onRegisterSuccess: (user: User) => void; onSwitchToLogin: () => void; }> = ({ onRegisterSuccess, onSwitchToLogin }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username || !email || !password || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        
        const users = JSON.parse(localStorage.getItem('shoppingAppUsers') || '[]') as User[];
        if (users.some(u => u.email === email)) {
            setError('This email is already registered.');
            return;
        }

        const newUser: User = { username, email, password };
        users.push(newUser);
        localStorage.setItem('shoppingAppUsers', JSON.stringify(users));
        onRegisterSuccess(newUser);
    };

    return (
        <AuthFormContainer title="Create Account">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center">{error}</p>}
                <M3TextField type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                <M3TextField type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <M3TextField type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <M3TextField type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <M3Button type="submit" variant="filled" className="w-full !mt-6">
                    Sign Up
                </M3Button>
            </form>
            <p className="text-center text-sm mt-6 text-gray-600">
                Already have an account? <button onClick={onSwitchToLogin} className="font-medium text-blue-600 hover:underline">Log in</button>
            </p>
        </AuthFormContainer>
    );
};

// --- APP ROUTER ---
const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [route, setRoute] = useState<Route>('login');

    useEffect(() => {
        const loggedInUser = localStorage.getItem('currentUser');
        if (loggedInUser) {
            setCurrentUser(JSON.parse(loggedInUser));
            setRoute('app');
        }
    }, []);

    const handleLoginSuccess = (user: User) => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        setCurrentUser(user);
        setRoute('app');
    };

    const handleRegisterSuccess = (user: User) => {
        localStorage.setItem('currentUser', JSON.stringify(user));
        setCurrentUser(user);
        setRoute('app');
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        setRoute('login');
    };

    if (route === 'app' && currentUser) {
        return <ShoppingApp currentUser={currentUser} onLogout={handleLogout} />;
    }
    if (route === 'register') {
        return <RegisterPage onRegisterSuccess={handleRegisterSuccess} onSwitchToLogin={() => setRoute('login')} />;
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} onSwitchToRegister={() => setRoute('register')} />;
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);
