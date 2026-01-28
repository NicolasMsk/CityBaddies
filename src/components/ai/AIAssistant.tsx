'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight, X, User, Package } from 'lucide-react';
import Image from 'next/image';

interface Deal {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  merchant: {
    name: string;
    slug: string;
  };
  category: string | null;
  productUrl: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  type: 'message' | 'clarification' | 'deals';
  message: string;
  suggestions?: string[];
  deals?: Deal[];
  searchParams?: Record<string, unknown>;
}

const INITIAL_SUGGESTIONS = [
  "Idée cadeau parfum",
  "Maquillage < 30€",
  "Routine Skincare",
  "Top Deals & Best-sellers",
];

export default function AIAssistant() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState<ChatResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll interne uniquement dans le conteneur de chat
  const scrollChatToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [history.length]);

  const handleSubmit = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setInput('');
    setIsLoading(true);
    setSuggestions([]);

    // Ajouter le message utilisateur à l'historique
    const newHistory: Message[] = [...history, { role: 'user', content: userMessage }];
    setHistory(newHistory);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: history,
        }),
      });

      if (!res.ok) throw new Error('Erreur API');

      const data: ChatResponse = await res.json();
      setCurrentResponse(data);

      // Mettre à jour l'historique avec la réponse
      setHistory([...newHistory, { role: 'assistant', content: data.message }]);

      // Si des suggestions sont fournies
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setCurrentResponse({
        type: 'message',
        message: "Une erreur s'est produite. Réessaie dans un instant.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setHistory([]);
    setCurrentResponse(null);
    setSuggestions(INITIAL_SUGGESTIONS);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="w-full mx-auto relative group">
      {/* Decorative Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#9b1515] to-[#d4a855] opacity-10 blur-xl rounded-[2rem] group-hover:opacity-20 transition-opacity duration-700 pointer-events-none" />

      {/* Main Container - Card Glassmorphism */}
      <div className="relative overflow-hidden bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl" style={{ contain: 'layout' }}>
        
        {/* Header - Minimalist Editorial */}
        <div className="px-8 pt-8 pb-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#1a1a1a] flex items-center justify-center border border-[#d4a855]/30 overflow-hidden p-1.5">
              <Image src="/images/logo-white.png" alt="Logo" width={24} height={24} className="object-contain" />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-[0.2em] text-white uppercase">
                City Baddies <span className="text-[#d4a855]">AI</span>
              </h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                Personal Shopping Assistant
              </p>
            </div>
          </div>
          
          {history.length > 0 && (
            <button 
              onClick={handleReset}
              className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
              title="Nouvelle conversation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 h-[500px] flex flex-col">
          
          {/* Welcome State */}
          {history.length === 0 && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-28 h-28 md:w-36 md:h-36 mb-2 group-hover:scale-105 transition-transform duration-500 ease-out">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#9b1515] to-[#d4a855] opacity-20 blur-3xl rounded-full animate-pulse" />
                
                {/* Placeholder Image - À remplacer par ton image : /images/ai-avatar.png */}
                 <div className="relative w-full h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                    <Image 
                        src="/images/ai-avatar.png" 
                        alt="City Baddies AI" 
                        fill 
                        className="object-cover"
                        priority
                    />
                 </div>
                 
                 {/* Decorative elements around image */}
                 <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#d4a855] rounded-full blur-md opacity-40 animate-pulse" />
                 <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-[#9b1515] rounded-full blur-md opacity-40 animate-pulse delay-700" />
              </div>

              <div className="space-y-3 max-w-md">
                <h3 className="text-2xl md:text-3xl font-thin text-white tracking-wide">
                  Hello Baddie.<br/>
                  <span className="text-neutral-500 font-light italic text-lg md:text-xl">Que cherches-tu aujourd&apos;hui ?</span>
                </h3>
              </div>
            </div>
          )}

          {/* Chat History & Results */}
          {(history.length > 0 || isLoading) && (
            <div 
              ref={chatContainerRef}
              className="flex-1 space-y-6 mb-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 pr-2" 
              style={{ maxHeight: 'calc(100% - 120px)' }}
            >
              {history.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${
                    msg.role === 'user' ? 'bg-[#9b1515] text-white' : 'bg-[#1a1a1a] border border-[#d4a855]/30 p-1.5'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Image src="/images/logo-white.png" alt="AI" width={20} height={20} className="object-contain" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-[#1a1a1a] text-white border border-white/10' 
                        : 'text-neutral-300' // Assistant message is cleaner, no bubble for main text sometimes
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#d4a855]/30 flex items-center justify-center overflow-hidden p-1.5">
                    <Image src="/images/logo-white.png" alt="AI" width={20} height={20} className="object-contain animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 pt-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="tracking-widest text-[10px] uppercase">Analyse des deals...</span>
                  </div>
                </div>
              )}

              {/* Deals Showcase */}
              {currentResponse?.type === 'deals' && currentResponse.deals && currentResponse.deals.length > 0 && !isLoading && (
                <div className="pl-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                   <div 
                     className="flex gap-3 overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#d4a855]/20 snap-x snap-mandatory"
                     style={{ maskImage: 'linear-gradient(to right, black 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)' }}
                   >
                    {currentResponse.deals.map((deal) => (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}`}
                        className="group flex-shrink-0 w-[140px] snap-start"
                      >
                        <div className="bg-[#151515] rounded-lg overflow-hidden border border-white/5 hover:border-[#d4a855]/50 transition-all duration-300 shadow-lg group-hover:shadow-[#d4a855]/5">
                          {/* Image */}
                          <div className="relative aspect-square bg-white overflow-hidden p-2">
                            {deal.imageUrl ? (
                              <img
                                src={deal.imageUrl}
                                alt={deal.title}
                                className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500 ease-out"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                                <Package className="w-6 h-6 text-neutral-300" />
                              </div>
                            )}
                            {/* Discount Badge */}
                            <span className="absolute top-1.5 left-1.5 bg-[#9b1515] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              -{deal.discountPercent}%
                            </span>
                          </div>
                          
                          {/* Info */}
                          <div className="p-2.5 space-y-1.5">
                            <p className="text-[9px] text-[#d4a855] font-bold uppercase tracking-wider truncate">
                              {deal.brand}
                            </p>
                            <h4 className="text-white text-[11px] font-medium leading-tight line-clamp-2 min-h-[2.2em]">
                              {deal.title}
                            </h4>
                            <div className="flex items-baseline gap-1.5 pt-1">
                              <span className="text-sm font-semibold text-white">
                                {deal.dealPrice.toFixed(0)}€
                              </span>
                              <span className="text-[10px] text-neutral-500 line-through">
                                {deal.originalPrice.toFixed(0)}€
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {/* Action Link */}
                   {currentResponse.searchParams && (
                    <div className="mt-4">
                        <Link
                        href={`/deals?${new URLSearchParams(
                            Object.entries(currentResponse.searchParams)
                            .filter(([, v]) => v !== undefined && v !== null)
                            .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])
                        ).toString()}`}
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white hover:text-[#d4a855] transition-colors group/link"
                        >
                        Voir tout les résultats
                        <ArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* Interaction Area - Fixed at bottom */}
          <div className="space-y-4 mt-auto pt-4 border-t border-white/5">
            
            {/* Suggestions - Horizontal Scroll on mobile */}
            {suggestions.length > 0 && !currentResponse?.deals?.length && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pb-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(suggestion)}
                    disabled={isLoading}
                    className="group/suggest relative px-5 py-2.5 rounded-xl bg-[#151515] border border-white/5 hover:border-[#d4a855]/40 transition-all duration-300 overflow-hidden active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/suggest:translate-x-full transition-transform duration-700 ease-in-out" />
                    <span className="relative text-xs font-medium text-neutral-400 group-hover/suggest:text-[#d4a855] tracking-wide transition-colors">
                      {suggestion}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="relative group/input">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-[#9b1515] to-[#d4a855] opacity-0 group-focus-within/input:opacity-50 transition-opacity duration-500 blur rounded-full" />
               <div className="relative flex items-center bg-[#0a0a0a] border border-white/10 rounded-full p-2 pl-6 transition-colors group-focus-within/input:bg-[#151515] group-focus-within/input:border-transparent">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: Teint parfait Nars..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-white placeholder-neutral-600 focus:outline-none text-sm py-2"
                  />
                  <button
                    onClick={() => handleSubmit(input)}
                    disabled={!input.trim() || isLoading}
                    className="p-3 bg-white text-black rounded-full hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
