"use client";
import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
}

export function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: 'Hola! En que puedo ayudarte hoy?',
      sender: 'agent',
      timestamp: new Date(),
    },
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen || isConnected) return;

    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
          path: '/socket.io',
          auth: {
            token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
          },
        });

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        socket.on('chat:message', (data: { text: string; timestamp: string }) => {
          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).slice(2),
              text: data.text,
              sender: 'agent',
              timestamp: new Date(data.timestamp),
            },
          ]);
        });

        socketRef.current = socket;
      } catch {
        // Socket connection failed, fall back to offline mode
      }
    };

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isOpen]);

  const sendMessage = () => {
    if (!message.trim()) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      text: message.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);

    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', { text: message.trim() });
    } else {
      // Offline fallback - show auto reply
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            text: 'Gracias por tu mensaje. Un agente te respondera pronto.',
            sender: 'agent',
            timestamp: new Date(),
          },
        ]);
      }, 1000);
    }

    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className={cn(
            'w-80 rounded-2xl bg-white shadow-lg border border-neutral-200 overflow-hidden transition-all',
            isMinimized ? 'h-14' : 'h-[420px] flex flex-col'
          )}
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 bg-brand-600 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Soporte</p>
              <p className="text-xs text-brand-200">
                {isConnected ? 'En linea' : 'Conectando...'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-brand-200 hover:text-white transition-colors"
              >
                <MinusCircle className="h-5 w-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-brand-200 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                        msg.sender === 'user'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-neutral-100 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-all hover:scale-105 focus:outline-none focus:ring-4 focus:ring-brand-500/30"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
