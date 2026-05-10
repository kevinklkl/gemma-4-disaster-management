import { useState, useEffect, useRef } from "react";
import { TopNav } from "../components/TopNav";
import { MobileNav } from "../components/MobileNav";
import { Search, Bell, HelpCircle, Inbox as InboxIcon, MoreVertical, MessageSquare, Mic, Smartphone, UserCircle, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from "lucide-react";

const INITIAL_MESSAGES = [
  {
    id: "m1",
    type: "sms",
    source: "SMS Auto-Intake",
    time: "Just now",
    content: '"Tabang diri dapita sa may sapa kay nitaas na ang tubig. Mga 10 ka tawo mi diri, paspas ang baha."',
    status: "needs_processing",
    extractedData: null,
  },
  {
    id: "m2",
    type: "voice",
    source: "Radio / Voice",
    time: "6 mins ago",
    content: '[Transcript]: "12 households roof blew off in Sitio Bukid, no reported casualties but they need shelter ASAP."',
    status: "processed",
    extractedData: {
      location: "Sitio Bukid",
      urgency: "high",
      families: 12,
      items: [{ name: "Shelter / Tarpaulins", qty: 12 }]
    }
  },
  {
    id: "m3",
    type: "walkin",
    source: "Walk-in Log",
    time: "11 mins ago",
    content: '"need food packs about 30 family" — reported by kagawad in Purok Mahogany',
    status: "processed",
    extractedData: {
      location: "Purok Mahogany",
      urgency: "medium",
      families: 30,
      items: [{ name: "Food Packs", qty: 30 }]
    }
  },
  {
    id: "m4",
    type: "viber",
    source: "Viber Relay",
    time: "14 mins ago",
    content: '"walay tubig 5 ka pamilya, naa baby" — Sitio Riverside',
    status: "processed",
    extractedData: {
      location: "Sitio Riverside",
      urgency: "high",
      families: 5,
      items: [{ name: "Drinking Water", qty: 5 }, { name: "Baby Needs", qty: 1 }]
    }
  }
];

export function Inbox() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const processingRefs = useRef<Set<string>>(new Set());

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.status === 'needs_processing' && !processingRefs.current.has(msg.id)) {
        processingRefs.current.add(msg.id);

        const processMessage = async () => {
          try {
            const response = await fetch('/api/process_message', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ content: msg.content }),
            });

            if (!response.ok) {
              throw new Error(`Error processing message: ${response.statusText}`);
            }

            const data = await response.json();
            
            setMessages(prev => prev.map(m => 
              m.id === msg.id ? { ...m, status: "processed", extractedData: data } : m
            ));
          } catch (error) {
            console.error("Failed to extract data:", error);
          } finally {
            processingRefs.current.delete(msg.id);
          }
        };

        processMessage();
      }
    });
  }, [messages]);

  const handleUpdateField = (id: string, field: string, value: any) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData) {
        return {
          ...m,
          extractedData: { ...m.extractedData, [field]: value }
        };
      }
      return m;
    }));
  };

  const handleUpdateItem = (id: string, index: number, field: string, value: any) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData && m.extractedData.items) {
        const newItems = [...m.extractedData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return {
          ...m,
          extractedData: { ...m.extractedData, items: newItems }
        };
      }
      return m;
    }));
  };

  const handleRemoveItem = (id: string, index: number) => {
     setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData && m.extractedData.items) {
        const newItems = m.extractedData.items.filter((_: any, i: number) => i !== index);
        return {
          ...m,
          extractedData: { ...m.extractedData, items: newItems }
        };
      }
      return m;
    }));
  };

  const handleAddItem = (id: string) => {
     setMessages(prev => prev.map(m => {
      if (m.id === id && m.extractedData) {
        return {
          ...m,
          extractedData: {
            ...m.extractedData,
            items: [...(m.extractedData.items || []), { name: "", qty: 1 }]
          }
        };
      }
      return m;
    }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'sms': return <Smartphone className="w-3.5 h-3.5" />;
      case 'voice': return <Mic className="w-3.5 h-3.5" />;
      case 'walkin': return <UserCircle className="w-3.5 h-3.5" />;
      case 'viber': return <MessageSquare className="w-3.5 h-3.5" />;
      default: return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'sms': return 'bg-secondary-container text-secondary';
      case 'voice': return 'bg-tertiary-container text-tertiary';
      case 'walkin': return 'bg-primary-container text-primary';
      case 'viber': return 'bg-secondary-container text-secondary';
      default: return 'bg-surface-container text-on-surface-variant';
    }
  };

  return (
    <div className="h-screen bg-surface-container-low font-body text-on-surface flex flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">

        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-headline font-bold text-on-surface">Recent Messages</h2>
              <p className="text-sm text-on-surface-variant mt-1">All incoming raw communications waiting to be processed.</p>
            </div>
            <div className="flex gap-2 pb-2 overflow-x-auto">
              <button className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20 whitespace-nowrap">All Sources</button>
              <button className="px-4 py-1.5 bg-surface-container rounded-lg text-xs font-bold border border-outline-variant/20 whitespace-nowrap text-on-surface-variant">SMS</button>
              <button className="px-4 py-1.5 bg-surface-container rounded-lg text-xs font-bold border border-outline-variant/20 whitespace-nowrap text-on-surface-variant">Voice</button>
              <button className="px-4 py-1.5 bg-surface-container rounded-lg text-xs font-bold border border-outline-variant/20 whitespace-nowrap text-on-surface-variant">Manual</button>
            </div>
          </div>

          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`rounded-xl custom-shadow flex flex-col lg:flex-row transition-all ${
                  message.status === 'needs_processing' 
                    ? 'bg-surface-bright border border-outline-variant/20 hover:border-primary/40' 
                    : 'bg-surface-container-lowest border border-outline-variant/10 opacity-80'
                }`}
              >
                <div className="p-6 flex-1 max-w-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full ${getIconColor(message.type)}`}>
                        {getIcon(message.type)}
                      </span>
                      <span className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">{message.source}</span>
                      <span className="text-on-surface-variant/50 text-xs">• {message.time}</span>
                    </div>
                    <MoreVertical className="text-on-surface-variant cursor-pointer hover:text-primary w-5 h-5" />
                  </div>
                  <div className={`mb-4 ${message.type === 'voice' ? 'bg-surface-container p-3 rounded-lg border border-outline-variant/20 text-on-surface-variant text-sm italic' : 'text-lg font-headline text-on-surface'}`}>
                    {message.content}
                  </div>
                  
                  {message.status === 'needs_processing' ? (
                    <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                      <div className="flex items-center gap-2 text-error text-sm font-bold">
                        <AlertCircle className="w-4 h-4" />
                        Needs processing
                      </div>
                      <div className="px-4 py-2 bg-surface-container text-on-surface-variant rounded-lg text-sm font-bold shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing AI...
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mt-4 border-t border-outline-variant/10 pt-4">
                      <div className="flex items-center gap-2 text-primary text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        Processed
                      </div>
                      <div className="text-xs text-on-surface-variant flex items-center gap-1 font-bold">
                        AI Extracted <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Extracted Data Panel (shows when processed) */}
                {message.status === 'processed' && message.extractedData && (
                    <div className="flex-1 bg-surface border-t lg:border-t-0 lg:border-l border-outline-variant/20 p-6 flex flex-col justify-center transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-on-surface-variant flex items-center gap-1">Extracted Info</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70 mb-1">Extracted Location</label>
                          <input 
                            type="text" 
                            value={message.extractedData.location || ''} 
                            onChange={(e) => handleUpdateField(message.id, 'location', e.target.value)}
                            className="w-full bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70 mb-1">Affected Families</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={message.extractedData.families || 0} 
                              onChange={(e) => handleUpdateField(message.id, 'families', Number(e.target.value))}
                              className="w-full bg-surface-container hover:bg-surface-container-high rounded-md pl-2 pr-8 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                            />
                            <span className="absolute right-2 top-1.5 text-xs text-on-surface-variant pointer-events-none">est.</span>
                          </div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70 mb-2">Required Needs (Item / Qty)</label>
                        <div className="flex flex-col gap-2">
                          {message.extractedData.items?.map((item: any, i: number) => (
                            <div key={i} className="flex gap-2 items-center group">
                              <input 
                                type="text" 
                                value={item.name} 
                                onChange={(e) => handleUpdateItem(message.id, i, 'name', e.target.value)}
                                className="flex-1 bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-sm border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors"
                              />
                              <input 
                                type="number" 
                                value={item.qty} 
                                onChange={(e) => handleUpdateItem(message.id, i, 'qty', Number(e.target.value))}
                                className="w-16 bg-surface-container hover:bg-surface-container-high rounded-md px-2 py-1.5 text-xs border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none text-on-surface font-bold transition-colors text-center"
                              />
                              <button onClick={() => handleRemoveItem(message.id, i)} className="text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 p-1 rounded transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => handleAddItem(message.id)}
                            className="text-xs text-primary font-bold hover:bg-primary/5 px-2 py-1 rounded transition-colors self-start mt-1"
                          >
                             + Add Item
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant opacity-70">Urgency:</label>
                          <select 
                            value={message.extractedData.urgency || 'low'}
                            onChange={(e) => handleUpdateField(message.id, 'urgency', e.target.value)}
                            className={`bg-surface-container rounded-md px-2 py-0.5 text-xs font-bold border-none ring-1 ring-outline-variant/30 focus:ring-primary outline-none uppercase tracking-wider ${
                                message.extractedData.urgency === 'critical' ? 'text-error' :
                                message.extractedData.urgency === 'high' ? 'text-[#EA580C]' :
                                'text-[#D97706]'
                            }`}
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <button className="text-xs font-bold text-primary hover:underline hover:brightness-110">
                          Add to Live Feed
                        </button>
                      </div>
                    </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
             <button className="py-3 px-6 border-2 border-dashed border-outline-variant/30 text-on-surface-variant font-bold text-sm rounded-xl hover:bg-surface-container transition-colors">
                Load older messages
              </button>
          </div>
        </div>
      </main>
      </div>
      <MobileNav />
    </div>
  );
}
