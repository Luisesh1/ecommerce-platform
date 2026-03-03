"use client";

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessageSquare, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';

interface Conversation {
  id: string;
  clientName: string;
  lastMessage: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  updatedAt: string;
  assignedTo: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderName: string;
  senderRole: 'CLIENT' | 'AGENT' | 'SYSTEM';
  body: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'OPEN', label: 'Abierto' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'RESOLVED', label: 'Resuelto' },
];

const priorityOptions = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'LOW', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const statusSelectOptions = [
  { value: 'OPEN', label: 'Abierto' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'RESOLVED', label: 'Resuelto' },
];

const statusVariant: Record<Conversation['status'], 'info' | 'warning' | 'success'> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
};

const priorityVariant: Record<Conversation['priority'], 'neutral' | 'info' | 'warning' | 'error'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('es');
}

export default function SoportePage() {
  const queryClient = useQueryClient();
  const { error: toastError } = useToast();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ['admin-conversations', statusFilter, priorityFilter],
    queryFn: () =>
      api.get<Conversation[]>('/admin/chat/conversations', {
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
      }),
    refetchInterval: 10_000,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ['admin-messages', selected?.id],
    queryFn: () => api.get<Message[]>(`/admin/chat/${selected!.id}/messages`),
    enabled: !!selected,
    refetchInterval: 5_000,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['admin-agents'],
    queryFn: () => api.get<Agent[]>('/users?role=AGENT'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: () =>
      api.post(`/admin/chat/${selected!.id}/messages`, { body: newMessage }),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['admin-messages', selected?.id] });
    },
    onError: () => toastError('Error al enviar mensaje'),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/admin/chat/${selected!.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
      if (selected) setSelected((s) => s ? { ...s, status: arguments[0] as Conversation['status'] } : s);
    },
  });

  const assignAgent = useMutation({
    mutationFn: (agentId: string) =>
      api.patch(`/admin/chat/${selected!.id}`, { assignedTo: agentId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-conversations'] }),
  });

  const agentOptions = [
    { value: '', label: 'Sin asignar' },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage.mutate();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-neutral-200">
      {/* Left: Conversation list */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-neutral-200">
        <div className="p-3 border-b border-neutral-200 bg-neutral-50">
          <h2 className="font-semibold text-neutral-900 mb-2">Soporte</h2>
          <div className="space-y-2">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Estado..."
            />
            <Select
              options={priorityOptions}
              value={priorityFilter}
              onChange={setPriorityFilter}
              placeholder="Prioridad..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Sin conversaciones"
              className="py-10"
            />
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={`w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
                  selected?.id === conv.id ? 'bg-brand-50 border-l-4 border-brand-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {conv.clientName}
                  </p>
                  <span className="text-xs text-neutral-400 whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(conv.updatedAt)}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 truncate mt-0.5">{conv.lastMessage}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={statusVariant[conv.status]} size="sm">
                    {conv.status}
                  </Badge>
                  <Badge variant={priorityVariant[conv.priority]} size="sm">
                    {conv.priority}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Chat panel */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="Selecciona una conversación"
            description="Haz clic en una conversación para ver los mensajes"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center">
                <User className="h-4 w-4 text-neutral-500" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900 text-sm">{selected.clientName}</p>
                <p className="text-xs text-neutral-400">#{selected.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                options={agentOptions}
                value={selected.assignedTo ?? ''}
                onChange={(v) => assignAgent.mutate(v)}
                placeholder="Asignar a..."
              />
              <Select
                options={statusSelectOptions}
                value={selected.status}
                onChange={(v) => updateStatus.mutate(v)}
              />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
            {msgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Sin mensajes"
                className="py-10"
              />
            ) : (
              messages.map((msg) => {
                const isAgent = msg.senderRole === 'AGENT';
                const isSystem = msg.senderRole === 'SYSTEM';
                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="text-xs text-neutral-400 bg-neutral-200 rounded-full px-3 py-1">
                        {msg.body}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 ${
                        isAgent
                          ? 'bg-brand-600 text-white rounded-tr-sm'
                          : 'bg-white border border-neutral-200 text-neutral-900 rounded-tl-sm'
                      }`}
                    >
                      <p className="text-sm">{msg.body}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isAgent ? 'text-brand-200' : 'text-neutral-400'
                        }`}
                      >
                        {msg.senderName} · {new Date(msg.createdAt).toLocaleTimeString('es')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex items-center gap-3 px-4 py-3 border-t border-neutral-200 bg-white">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              containerClassName="flex-1 mb-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim()) sendMessage.mutate();
                }
              }}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim()}
              loading={sendMessage.isPending}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Enviar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
