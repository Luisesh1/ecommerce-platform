"use client";

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/useToast';

interface GeneralSettings {
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  timezone: string;
  language: string;
}

interface EmailSettings {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  footerText: string;
}

interface CurrencySettings {
  baseCurrency: string;
  symbol: string;
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

interface NotificationSettings {
  orderCreated: boolean;
  orderShipped: boolean;
  orderDelivered: boolean;
  lowStock: boolean;
  newReview: boolean;
}

interface IntegrationSettings {
  stripePublicKey: string;
  mercadopagoPublicKey: string;
  paypalClientId: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
}

interface AllSettings {
  general: GeneralSettings;
  email: EmailSettings;
  currency: CurrencySettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
}

const TIMEZONE_OPTIONS = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6)' },
  { value: 'America/Monterrey', label: 'Monterrey (UTC-6)' },
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-3/-4)' },
  { value: 'America/New_York', label: 'Nueva York (UTC-5)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

const CURRENCY_OPTIONS = [
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
  { value: 'EUR', label: 'EUR — Euro' },
];

function SaveBar({
  onSave,
  loading,
  success,
}: {
  onSave: () => void;
  loading: boolean;
  success: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-neutral-200 mt-6">
      {success ? (
        <span className="text-sm text-success-600 font-medium">Cambios guardados</span>
      ) : (
        <span />
      )}
      <Button onClick={onSave} loading={loading}>
        Guardar cambios
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: settings } = useQuery<AllSettings>({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<AllSettings>('/admin/settings'),
  });

  // Local state per section
  const [general, setGeneral] = useState<GeneralSettings>({
    storeName: '',
    storeDescription: '',
    logoUrl: '',
    timezone: 'America/Mexico_City',
    language: 'es',
  });

  const [email, setEmail] = useState<EmailSettings>({
    fromName: '',
    fromEmail: '',
    replyTo: '',
    footerText: '',
  });

  const [currency, setCurrency] = useState<CurrencySettings>({
    baseCurrency: 'MXN',
    symbol: '$',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    orderCreated: true,
    orderShipped: true,
    orderDelivered: true,
    lowStock: true,
    newReview: false,
  });

  const [integrations, setIntegrations] = useState<IntegrationSettings>({
    stripePublicKey: '',
    mercadopagoPublicKey: '',
    paypalClientId: '',
    googleAnalyticsId: '',
    facebookPixelId: '',
  });

  useEffect(() => {
    if (settings) {
      setGeneral(settings.general);
      setEmail(settings.email);
      setCurrency(settings.currency);
      setNotifications(settings.notifications);
      setIntegrations(settings.integrations);
    }
  }, [settings]);

  const makeSave = (section: string, data: unknown) =>
    useMutation({
      mutationFn: () => api.patch(`/admin/settings/${section}`, data),
      onSuccess: () => toast({ title: 'Guardado correctamente', variant: 'success' }),
      onError: () => toast({ title: 'Error al guardar', variant: 'error' }),
    });

  const saveGeneral = useMutation({
    mutationFn: () => api.patch('/admin/settings/general', general),
    onSuccess: () => toast({ title: 'Configuración general guardada', variant: 'success' }),
    onError: () => toast({ title: 'Error al guardar', variant: 'error' }),
  });

  const saveEmail = useMutation({
    mutationFn: () => api.patch('/admin/settings/email', email),
    onSuccess: () => toast({ title: 'Configuración de email guardada', variant: 'success' }),
    onError: () => toast({ title: 'Error al guardar', variant: 'error' }),
  });

  const saveCurrency = useMutation({
    mutationFn: () => api.patch('/admin/settings/currency', currency),
    onSuccess: () => toast({ title: 'Configuración de moneda guardada', variant: 'success' }),
    onError: () => toast({ title: 'Error al guardar', variant: 'error' }),
  });

  const saveNotifications = useMutation({
    mutationFn: () => api.patch('/admin/settings/notifications', notifications),
    onSuccess: () => toast({ title: 'Notificaciones guardadas', variant: 'success' }),
    onError: () => toast({ title: 'Error al guardar', variant: 'error' }),
  });

  const saveIntegrations = useMutation({
    mutationFn: () => api.patch('/admin/settings/integrations', integrations),
    onSuccess: () => toast({ title: 'Integraciones guardadas', variant: 'success' }),
    onError: () => toast({ title: 'Error al guardar', variant: 'error' }),
  });

  const tabs = [
    {
      value: 'general',
      label: 'General',
      content: (
        <div className="space-y-4 max-w-lg">
          <Input
            label="Nombre de la tienda"
            value={general.storeName}
            onChange={(e) => setGeneral((g) => ({ ...g, storeName: e.target.value }))}
            required
          />
          <Input
            label="Descripción"
            value={general.storeDescription}
            onChange={(e) => setGeneral((g) => ({ ...g, storeDescription: e.target.value }))}
          />
          <Input
            label="URL del logo"
            value={general.logoUrl}
            onChange={(e) => setGeneral((g) => ({ ...g, logoUrl: e.target.value }))}
            placeholder="https://..."
          />
          <Select
            label="Zona horaria"
            options={TIMEZONE_OPTIONS}
            value={general.timezone}
            onChange={(v) => setGeneral((g) => ({ ...g, timezone: v }))}
          />
          <Select
            label="Idioma"
            options={LANGUAGE_OPTIONS}
            value={general.language}
            onChange={(v) => setGeneral((g) => ({ ...g, language: v }))}
          />
          <SaveBar
            onSave={() => saveGeneral.mutate()}
            loading={saveGeneral.isPending}
            success={saveGeneral.isSuccess}
          />
        </div>
      ),
    },
    {
      value: 'email',
      label: 'Email',
      content: (
        <div className="space-y-4 max-w-lg">
          <Input
            label="Nombre remitente"
            value={email.fromName}
            onChange={(e) => setEmail((em) => ({ ...em, fromName: e.target.value }))}
            placeholder="Mi Tienda"
          />
          <Input
            label="Email remitente"
            type="email"
            value={email.fromEmail}
            onChange={(e) => setEmail((em) => ({ ...em, fromEmail: e.target.value }))}
            placeholder="noreply@mitienda.com"
          />
          <Input
            label="Reply-To"
            type="email"
            value={email.replyTo}
            onChange={(e) => setEmail((em) => ({ ...em, replyTo: e.target.value }))}
            placeholder="soporte@mitienda.com"
          />
          <Input
            label="Texto del pie de email"
            value={email.footerText}
            onChange={(e) => setEmail((em) => ({ ...em, footerText: e.target.value }))}
            placeholder="© 2025 Mi Tienda. Todos los derechos reservados."
          />
          <SaveBar
            onSave={() => saveEmail.mutate()}
            loading={saveEmail.isPending}
            success={saveEmail.isSuccess}
          />
        </div>
      ),
    },
    {
      value: 'notifications',
      label: 'Notificaciones',
      content: (
        <div className="space-y-4 max-w-lg">
          <p className="text-sm text-neutral-600">
            Configura qué eventos envían notificaciones por email al administrador.
          </p>
          {(
            [
              { key: 'orderCreated', label: 'Nuevo pedido' },
              { key: 'orderShipped', label: 'Pedido enviado' },
              { key: 'orderDelivered', label: 'Pedido entregado' },
              { key: 'lowStock', label: 'Stock bajo' },
              { key: 'newReview', label: 'Nueva reseña' },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                checked={notifications[key]}
                onChange={(e) =>
                  setNotifications((n) => ({ ...n, [key]: e.target.checked }))
                }
              />
              <span className="text-sm font-medium text-neutral-900">{label}</span>
            </label>
          ))}
          <SaveBar
            onSave={() => saveNotifications.mutate()}
            loading={saveNotifications.isPending}
            success={saveNotifications.isSuccess}
          />
        </div>
      ),
    },
    {
      value: 'currency',
      label: 'Moneda',
      content: (
        <div className="space-y-4 max-w-lg">
          <Select
            label="Moneda base"
            options={CURRENCY_OPTIONS}
            value={currency.baseCurrency}
            onChange={(v) => setCurrency((c) => ({ ...c, baseCurrency: v }))}
          />
          <Input
            label="Símbolo"
            value={currency.symbol}
            onChange={(e) => setCurrency((c) => ({ ...c, symbol: e.target.value }))}
            placeholder="$"
          />
          <Input
            label="Decimales"
            type="number"
            value={String(currency.decimals)}
            onChange={(e) => setCurrency((c) => ({ ...c, decimals: parseInt(e.target.value, 10) || 0 }))}
          />
          <Input
            label="Separador de miles"
            value={currency.thousandsSeparator}
            onChange={(e) => setCurrency((c) => ({ ...c, thousandsSeparator: e.target.value }))}
            placeholder=","
          />
          <Input
            label="Separador decimal"
            value={currency.decimalSeparator}
            onChange={(e) => setCurrency((c) => ({ ...c, decimalSeparator: e.target.value }))}
            placeholder="."
          />
          <SaveBar
            onSave={() => saveCurrency.mutate()}
            loading={saveCurrency.isPending}
            success={saveCurrency.isSuccess}
          />
        </div>
      ),
    },
    {
      value: 'integrations',
      label: 'Integraciones',
      content: (
        <div className="space-y-6 max-w-lg">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Pagos</h3>
            <div className="space-y-4">
              <Input
                label="Stripe Public Key"
                value={integrations.stripePublicKey}
                onChange={(e) => setIntegrations((i) => ({ ...i, stripePublicKey: e.target.value }))}
                placeholder="pk_..."
              />
              <Input
                label="MercadoPago Public Key"
                value={integrations.mercadopagoPublicKey}
                onChange={(e) => setIntegrations((i) => ({ ...i, mercadopagoPublicKey: e.target.value }))}
                placeholder="APP_USR-..."
              />
              <Input
                label="PayPal Client ID"
                value={integrations.paypalClientId}
                onChange={(e) => setIntegrations((i) => ({ ...i, paypalClientId: e.target.value }))}
                placeholder="AV..."
              />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Analytics</h3>
            <div className="space-y-4">
              <Input
                label="Google Analytics ID"
                value={integrations.googleAnalyticsId}
                onChange={(e) => setIntegrations((i) => ({ ...i, googleAnalyticsId: e.target.value }))}
                placeholder="G-XXXXXXXXXX"
              />
              <Input
                label="Facebook Pixel ID"
                value={integrations.facebookPixelId}
                onChange={(e) => setIntegrations((i) => ({ ...i, facebookPixelId: e.target.value }))}
                placeholder="XXXXXXXXXXXXXXXX"
              />
            </div>
          </div>
          <SaveBar
            onSave={() => saveIntegrations.mutate()}
            loading={saveIntegrations.isPending}
            success={saveIntegrations.isSuccess}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-500 mt-1">Ajustes generales de la tienda</p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <Tabs tabs={tabs} defaultValue="general" />
      </div>
    </div>
  );
}
