import React, { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Trash2, Copy, Inbox, InboxIcon, Settings, Shield, Cpu, RefreshCcw, LogOut, CheckCircle2, MoreVertical, Menu } from 'lucide-react';
import { Message } from './types';
import { v4 as uuidv4 } from 'uuid';
import { formatDistanceToNow, format } from 'date-fns';

function generateRandomAddress(domains: string[]) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let prefix = '';
  for (let i = 0; i < 10; i++) {
    prefix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const domain = domains[Math.floor(Math.random() * domains.length)] || 'temporalmail.local';
  return `${prefix}@${domain}`;
}

const WS_URL = window.location.protocol === 'https:' 
  ? `wss://${window.location.host}/api/ws` 
  : `ws://${window.location.host}/api/ws`;

export default function App() {
  const [address, setAddress] = useState<string>('');
  const [domains, setDomains] = useState<string[]>(['temporalmail.local']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch('/api/domains')
      .then(res => res.json())
      .then(data => setDomains(data.domains || ['temporalmail.local']))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('temp_address');
    let currentAddress = saved;
    if (!currentAddress && domains.length > 0) {
      currentAddress = generateRandomAddress(domains);
      localStorage.setItem('temp_address', currentAddress);
    }
    if (currentAddress) {
      setAddress(currentAddress);
      registerMailbox(currentAddress);
      fetchMessages(currentAddress);
      connectWebSocket(currentAddress);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [domains]);

  const connectWebSocket = (addr: string) => {
    if (wsRef.current) wsRef.current.close();
    
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', address: addr }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_MAIL' && data.address === addr) {
          setMessages(prev => [data.payload, ...prev]);
        }
      } catch(e) {}
    };
    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(() => connectWebSocket(addr), 3000);
    };
    wsRef.current = ws;
  };

  const registerMailbox = async (addr: string) => {
    try {
      await fetch('/api/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr })
      });
    } catch (e) {
      console.error('Failed to create mailbox', e);
    }
  };

  const fetchMessages = async (addr: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/mailbox/${addr}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerateNew = () => {
    const newAddress = generateRandomAddress(domains);
    localStorage.setItem('temp_address', newAddress);
    setAddress(newAddress);
    setMessages([]);
    setSelectedMessage(null);
    registerMailbox(newAddress);
    fetchMessages(newAddress);
    connectWebSocket(newAddress);
  };

  const handleSelectMessage = async (msg: Message) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      try {
        await fetch(`/api/messages/${msg.id}`);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteMessage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden selection:bg-indigo-500/30">
      
      {/* Sidebar - Preserved but styled with zinc */}
      <div className="w-16 md:w-64 border-r border-zinc-800 bg-zinc-950/50 flex flex-col justify-between hidden sm:flex">
        <div>
          <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-zinc-800 font-bold text-white tracking-tight">
            <Shield className="w-6 h-6 text-indigo-500 md:mr-3" />
            <span className="hidden md:block text-lg">Temporal</span>
          </div>
          
          <div className="p-4 space-y-2">
            <button className="flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg text-white bg-indigo-500/10 border border-indigo-500/20 transition-colors">
              <InboxIcon className="w-5 h-5 md:mr-3 text-indigo-400" />
              <span className="hidden md:block">Inbox</span>
              {messages.filter(m => !m.read).length > 0 && (
                <span className="hidden md:block ml-auto bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {messages.filter(m => !m.read).length}
                </span>
              )}
            </button>
            <button className="flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-not-allowed opacity-50 flex-row">
              <Settings className="w-5 h-5 md:mr-3" />
              <span className="hidden md:block">Settings</span>
            </button>
            <button className="flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-not-allowed opacity-50 flex-row">
              <Cpu className="w-5 h-5 md:mr-3" />
              <span className="hidden md:block">API</span>
            </button>
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 flex flex-col space-y-2">
          <span className="hidden md:block">© 2026 Temporal Mail</span>
          <span className="hidden md:block text-[10px] text-zinc-600">SMTP Secure • Encrypted</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md flex items-center px-4 sm:px-8 shrink-0 relative z-10 sticky top-0 justify-between">
          <div className="flex items-center gap-3 sm:hidden">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">Temporal</span>
          </div>
          
          <div className="hidden sm:flex items-center gap-3">
             <div className="w-8 h-8 lg:hidden bg-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
             </div>
             <span className="text-xl font-bold tracking-tight text-white lg:hidden">Temporal<span className="text-indigo-500">.sh</span></span>
          </div>

          <nav className="hidden lg:flex gap-6 items-center text-sm font-medium absolute left-8">
             {/* Replace standard top header with bento logic navigation */}
             <a href="#" className="text-indigo-400 border-b-2 border-indigo-400 pb-1">Inbox</a>
             <a href="#" className="text-zinc-400 hover:text-white transition-colors">Domain Manager</a>
             <a href="#" className="text-zinc-400 hover:text-white transition-colors">API Documentation</a>
             <a href="#" className="text-zinc-400 hover:text-white transition-colors">Settings</a>
             <div className="h-8 w-[1px] bg-zinc-800 mx-2"></div>
          </nav>

          <div className="flex items-center space-x-3 ml-auto lg:ml-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
              <span className="text-xs text-zinc-300 uppercase tracking-widest hidden sm:block">SMTP Live</span>
            </div>
          </div>
        </header>

        {/* Dashboard Bento Grid Area */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)] gap-4 content-start">
          
          {/* Hero: Primary Email Address Box (Span 8 Cols, 2 Rows) */}
          <section className="col-span-1 lg:col-span-8 lg:row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 lg:p-8 flex flex-col justify-center relative overflow-hidden hidden sm:flex">
            <div className="absolute top-0 right-0 p-4">
              <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Active Session</div>
            </div>
            <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-4">Your Temporary Email Address</h3>
            
            <div className="flex flex-col xl:flex-row items-center gap-4">
              <div className="flex-1 w-full text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-mono font-bold text-white tracking-tight break-all">
                {address || '...'}
              </div>
              <div className="flex gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">
                <button 
                  onClick={handleCopy}
                  className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl border border-zinc-700 transition-all flex items-center justify-center flex-1 xl:flex-none active:scale-95"
                  title="Copy to clipboard"
                >
                  {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
                <button 
                  onClick={handleGenerateNew}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex-[2] xl:flex-none whitespace-nowrap active:scale-[0.98]"
                >
                  Generate New
                </button>
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap items-center gap-6 lg:gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-bold text-left">Auto-Expiry</span>
                <span className="text-sm text-zinc-300 font-mono text-left">Until deleted</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-800 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-bold text-left">Domain Pool</span>
                <span className="text-sm text-zinc-300 italic text-left">{address ? address.split('@')[1] : 'temporalmail.local'}</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-800 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-bold text-left">Connection</span>
                <span className="text-sm text-emerald-400 italic text-left font-mono">wss://local:2525</span>
              </div>
            </div>
          </section>

          {/* Fallback layout for very small screens (keeps existing simplified card style) */}
          <section className="col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm shadow-black/50 sm:hidden flex flex-col relative">
              <div className="absolute top-0 right-0 p-4">
                <div className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-bold uppercase tracking-wider">Active</div>
              </div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                <span>Your Email Session</span>
              </p>
              
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg flex items-center mb-4 overflow-hidden relative group">
                <input 
                  type="text" 
                  readOnly 
                  value={address}
                  className="w-full bg-transparent text-white font-mono text-base px-4 py-3 outline-none"
                />
                
                <button 
                  onClick={handleCopy}
                  className="absolute right-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-all flex items-center justify-center font-medium shadow-sm active:scale-95"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" /> : <Copy className="w-4 h-4 mr-2 text-zinc-300" />}
                  <span className="text-xs pr-1">{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleGenerateNew}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-900/20 active:scale-95"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Generate New
                </button>
              </div>
          </section>

          {/* Stats: System Health (Span 4 Cols, 2 Rows) */}
          <section className="col-span-1 lg:col-span-4 lg:row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between hidden md:flex">
            <div className="flex justify-between items-start">
              <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-widest flex items-center"><Cpu className="w-3.5 h-3.5 mr-2 text-zinc-600" /> Real-time Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 lg:mt-0">
              <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                <div className="text-2xl font-bold text-white">{messages.length}</div>
                <div className="text-[10px] text-zinc-500 uppercase mt-1">Processed Today</div>
              </div>
              <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                <div className="text-2xl font-bold text-emerald-400">0.4s</div>
                <div className="text-[10px] text-zinc-500 uppercase mt-1">SMTP Latency</div>
              </div>
            </div>
            <div className="pt-4 lg:pt-2">
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span>MAILBOX STORAGE (POSTGRES)</span>
                <span>42%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[42%]"></div>
              </div>
            </div>
          </section>

          {/* Inbox: List View (Span 5 Cols, 4 Rows) */}
          <section className="col-span-1 lg:col-span-5 lg:row-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <h3 className="text-sm font-bold text-white">Inbox</h3>
              </div>
              <button onClick={() => fetchMessages(address)} className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-tighter transition-colors">
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
                Refresh Manual
              </button>
            </div>
            
            <div className="flex-1 overflow-x-hidden overflow-y-auto relative">
              <div className="divide-y divide-zinc-800/50 bg-zinc-900">
                {messages.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-8 text-center pointer-events-none">
                    <Mail className="w-12 h-12 mb-4 text-zinc-700" />
                    <p className="text-sm font-medium text-zinc-300">Awaiting emails...</p>
                    <p className="text-xs mt-1 max-w-[200px]">Send email to your generated address to see it here.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div 
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-4 cursor-pointer transition-colors group relative ${selectedMessage?.id === msg.id ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500' : 'hover:bg-zinc-800/50 border-l-4 border-l-transparent'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 pr-8 truncate">
                           {!msg.read && <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block shrink-0"></span>}
                           <span className={`text-xs font-bold truncate ${!msg.read ? 'text-white' : 'text-zinc-300'}`}>
                             {msg.fromText}
                           </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0">{formatDistanceToNow(new Date(msg.createdAt))}</span>
                      </div>
                      <div className={`text-xs font-medium truncate pr-8 ${!msg.read ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {msg.subject || '(No Subject)'}
                      </div>

                      <button 
                        onClick={(e) => handleDeleteMessage(e, msg.id)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100 transition-all bg-zinc-900"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Detail View: Message Content (Span 7 Cols, 4 Rows) */}
          <section className="col-span-1 lg:col-span-7 lg:row-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden min-h-[500px]">
              {selectedMessage ? (
                <>
                  <div className="p-6 border-b border-zinc-800">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold shrink-0">
                          {selectedMessage.fromText.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-sm font-bold text-white truncate">{selectedMessage.fromText}</h2>
                          <p className="text-[10px] text-zinc-500 truncate">To: {address} &bull; {selectedMessage.fromEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={(e) => handleDeleteMessage(e, selectedMessage.id)} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 flex items-center gap-2 hover:bg-red-900/30 hover:text-red-400 transition-colors">
                           <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>
                    <h1 className="text-lg font-bold text-white leading-snug break-words">
                       {selectedMessage.subject || '[No Subject]'}
                    </h1>
                  </div>
                  
                  <div className="flex-1 bg-white p-0 overflow-y-auto overflow-x-hidden rounded-b-2xl relative">
                    {selectedMessage.htmlBody ? (
                      <iframe 
                        srcDoc={selectedMessage.htmlBody} 
                        className="absolute inset-0 w-full h-full border-none bg-white min-h-[400px]"
                        sandbox="allow-popups allow-same-origin"
                        title="Email Content"
                      />
                    ) : (
                      <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6 w-full text-zinc-800 whitespace-pre-wrap font-sans text-sm">
                        {selectedMessage.textBody || 'This message has no content.'}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 m-6 border-2 border-dashed border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/20">
                  <Mail className="w-16 h-16 mb-4 text-zinc-700/50" />
                  <p className="text-lg font-medium text-zinc-400">Message Viewer</p>
                  <p className="text-sm mt-2 text-zinc-600">Select a message from your inbox to view it here.</p>
                </div>
              )}
          </section>

        </main>
      </div>
    </div>
  );
}
