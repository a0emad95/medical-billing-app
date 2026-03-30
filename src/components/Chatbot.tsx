import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GoogleGenAI } from '@google/genai';
import { AuditReport } from '../services/geminiService';
import { translations } from '../translations';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

export function Chatbot({ report, lang, user, auditId }: { report: AuditReport | null, lang: 'en' | 'ar', user?: any | null, auditId?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (user && auditId) {
      const q = query(collection(db, `users/${user.uid}/invoices/${auditId}/chat`), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedMessages = snapshot.docs.map(doc => doc.data() as {role: 'user'|'model', text: string});
        if (loadedMessages.length > 0) {
          setMessages([{ role: 'model', text: t.chatEmpty }, ...loadedMessages]);
        } else {
          setMessages([{ role: 'model', text: t.chatEmpty }]);
        }
      });
      return () => unsubscribe();
    } else {
      setMessages([{ role: 'model', text: t.chatEmpty }]);
    }
  }, [user, auditId, t.chatEmpty]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    
    // Optimistic update if not saving to DB
    if (!user || !auditId) {
      setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    } else {
      await addDoc(collection(db, `users/${user.uid}/invoices/${auditId}/chat`), {
        role: 'user',
        text: userMsg,
        createdAt: serverTimestamp()
      });
    }

    setIsLoading(true);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are a helpful AI assistant for a Medical Billing Auditor app. 
        The user might ask you questions about the app or the currently analyzed invoice.
        Current Invoice Report Context: ${report ? JSON.stringify(report) : 'No invoice analyzed yet.'}
        Respond in ${lang === 'ar' ? 'Arabic' : 'English'}. Be concise, friendly, and helpful.`;

    const contents = messages
      .filter(m => m.text !== t.chatEmpty) // Don't send the greeting to the model
      .map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
      
    contents.push({ role: 'user', parts: [{ text: userMsg }] });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.5,
        }
      });
      
      if (!user || !auditId) {
        setMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
      } else {
        await addDoc(collection(db, `users/${user.uid}/invoices/${auditId}/chat`), {
          role: 'model',
          text: response.text || '',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error(error);
      if (!user || !auditId) {
        setMessages(prev => [...prev, { role: 'model', text: t.error }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {isOpen && (
        <Card className="w-80 sm:w-96 h-[500px] max-h-[80vh] flex flex-col shadow-2xl mb-4 border-slate-200 animate-in slide-in-from-bottom-5">
          <CardHeader className="p-4 border-b bg-blue-600 text-white rounded-t-xl flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {t.chatTitle}
            </CardTitle>
            <Button variant="ghost" size="icon" className="text-white hover:bg-blue-700 hover:text-white h-8 w-8" onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-3 rounded-lg rounded-bl-none">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-3 border-t bg-slate-50 rounded-b-xl">
            <form onSubmit={handleSend} className="flex w-full gap-2">
              <Input 
                placeholder={t.chatPlaceholder} 
                value={input} 
                onChange={e => setInput(e.target.value)}
                className="flex-1 bg-white"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
      
      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)} 
          className="w-14 h-14 rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 transition-transform hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}
