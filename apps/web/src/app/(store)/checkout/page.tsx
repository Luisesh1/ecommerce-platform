"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle, CreditCard, Package } from 'lucide-react';
import Image from 'next/image';

import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/utils';

import { Stepper, Step } from '@/components/ui/Stepper';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InfoFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: number;
}

type PaymentGateway = 'stripe' | 'mercadopago' | 'paypal';

interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  estimatedDelivery: string;
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const infoSchema = z.object({
  firstName: z.string().min(2, 'Nombre requerido'),
  lastName: z.string().min(2, 'Apellido requerido'),
  email: z.string().email('Email invalido'),
  phone: z.string().min(8, 'Telefono invalido'),
  address: z.string().min(5, 'Direccion requerida'),
  city: z.string().min(2, 'Ciudad requerida'),
  postalCode: z.string().min(4, 'Codigo postal invalido'),
  country: z.string().min(2, 'Pais requerido'),
});

// ─── Step components ──────────────────────────────────────────────────────────

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      {children}
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors';

function Step1Info({
  onNext,
  defaultValues,
}: {
  onNext: (data: InfoFormData) => void;
  defaultValues?: Partial<InfoFormData>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InfoFormData>({
    resolver: zodResolver(infoSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Informacion de contacto y envio</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nombre" error={errors.firstName?.message}>
            <input {...register('firstName')} placeholder="Juan" className={inputClass} />
          </FormField>
          <FormField label="Apellido" error={errors.lastName?.message}>
            <input {...register('lastName')} placeholder="Perez" className={inputClass} />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" placeholder="juan@ejemplo.com" className={inputClass} />
          </FormField>
          <FormField label="Telefono" error={errors.phone?.message}>
            <input {...register('phone')} type="tel" placeholder="+52 55 0000 0000" className={inputClass} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Direccion" error={errors.address?.message}>
              <input {...register('address')} placeholder="Calle, numero, colonia" className={inputClass} />
            </FormField>
          </div>
          <FormField label="Ciudad" error={errors.city?.message}>
            <input {...register('city')} placeholder="Ciudad de Mexico" className={inputClass} />
          </FormField>
          <FormField label="Codigo postal" error={errors.postalCode?.message}>
            <input {...register('postalCode')} placeholder="06600" className={inputClass} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Pais" error={errors.country?.message}>
              <select {...register('country')} className={inputClass}>
                <option value="">Selecciona un pais</option>
                <option value="MX">Mexico</option>
                <option value="US">Estados Unidos</option>
                <option value="CA">Canada</option>
                <option value="ES">Espana</option>
                <option value="AR">Argentina</option>
                <option value="CO">Colombia</option>
                <option value="CL">Chile</option>
              </select>
            </FormField>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Continuar al envio
        </Button>
      </div>
    </form>
  );
}

function Step2Shipping({
  postalCode,
  selectedMethod,
  onSelect,
  onNext,
  onBack,
}: {
  postalCode: string;
  selectedMethod: ShippingMethod | null;
  onSelect: (method: ShippingMethod) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['shipping-methods', postalCode],
    queryFn: () => api.get<{ data: ShippingMethod[] }>('/shipping/methods', { cp: postalCode }),
  });

  const methods = data?.data || [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Metodo de envio</h2>
      <p className="text-sm text-neutral-500">Opciones disponibles para el CP: <strong>{postalCode}</strong></p>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          No se pudieron cargar las opciones de envio. Verifica tu codigo postal.
        </div>
      )}

      {!isLoading && methods.length === 0 && !isError && (
        <div className="rounded-lg border border-neutral-200 p-6 text-center text-sm text-neutral-500">
          No hay metodos de envio disponibles para este codigo postal.
        </div>
      )}

      <div className="space-y-3">
        {methods.map((method) => (
          <label
            key={method.id}
            className={`flex items-center justify-between rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedMethod?.id === method.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-neutral-200 hover:border-brand-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="shipping"
                value={method.id}
                checked={selectedMethod?.id === method.id}
                onChange={() => onSelect(method)}
                className="text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="font-medium text-neutral-900 text-sm">{method.name}</p>
                <p className="text-xs text-neutral-500">{method.description} — {method.estimatedDays} dias habiles</p>
              </div>
            </div>
            <span className="font-semibold text-neutral-900 text-sm">
              {method.price === 0 ? (
                <span className="text-success-600">Gratis</span>
              ) : (
                formatPrice(method.price)
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Volver</Button>
        <Button onClick={onNext} disabled={!selectedMethod}>
          Continuar al pago
        </Button>
      </div>
    </div>
  );
}

function StripeFields({
  cardNumber,
  setCardNumber,
  expiry,
  setExpiry,
  cvc,
  setCvc,
}: {
  cardNumber: string;
  setCardNumber: (v: string) => void;
  expiry: string;
  setExpiry: (v: string) => void;
  cvc: string;
  setCvc: (v: string) => void;
}) {
  const formatCard = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };
  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  return (
    <div className="space-y-4 mt-4 p-4 rounded-lg border border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-4 w-4 text-brand-600" />
        <span className="text-sm font-medium text-neutral-700">Datos de tarjeta</span>
      </div>
      <FormField label="Numero de tarjeta">
        <input
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCard(e.target.value))}
          placeholder="1234 5678 9012 3456"
          maxLength={19}
          className={inputClass}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Fecha de vencimiento">
          <input
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/AA"
            maxLength={5}
            className={inputClass}
          />
        </FormField>
        <FormField label="CVC">
          <input
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            maxLength={4}
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}

function Step3Payment({
  selectedGateway,
  onSelectGateway,
  cardNumber,
  setCardNumber,
  expiry,
  setExpiry,
  cvc,
  setCvc,
  onNext,
  onBack,
}: {
  selectedGateway: PaymentGateway | null;
  onSelectGateway: (g: PaymentGateway) => void;
  cardNumber: string;
  setCardNumber: (v: string) => void;
  expiry: string;
  setExpiry: (v: string) => void;
  cvc: string;
  setCvc: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const gateways: { id: PaymentGateway; label: string; description: string }[] = [
    { id: 'stripe', label: 'Tarjeta de credito/debito', description: 'Visa, Mastercard, Amex' },
    { id: 'mercadopago', label: 'Mercado Pago', description: 'Efectivo, tarjeta, transferencia' },
    { id: 'paypal', label: 'PayPal', description: 'Paga con tu cuenta PayPal' },
  ];

  const canProceed =
    selectedGateway === 'stripe'
      ? selectedGateway && cardNumber.replace(/\s/g, '').length === 16 && expiry.length === 5 && cvc.length >= 3
      : !!selectedGateway;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Metodo de pago</h2>

      <div className="space-y-3">
        {gateways.map((gw) => (
          <label
            key={gw.id}
            className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedGateway === gw.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-neutral-200 hover:border-brand-300'
            }`}
          >
            <input
              type="radio"
              name="gateway"
              value={gw.id}
              checked={selectedGateway === gw.id}
              onChange={() => onSelectGateway(gw.id)}
              className="text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="font-medium text-neutral-900 text-sm">{gw.label}</p>
              <p className="text-xs text-neutral-500">{gw.description}</p>
            </div>
          </label>
        ))}
      </div>

      {selectedGateway === 'stripe' && (
        <StripeFields
          cardNumber={cardNumber}
          setCardNumber={setCardNumber}
          expiry={expiry}
          setExpiry={setExpiry}
          cvc={cvc}
          setCvc={setCvc}
        />
      )}

      {selectedGateway === 'mercadopago' && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          Al continuar, seras redirigido a Mercado Pago para completar tu pago de forma segura.
        </div>
      )}

      {selectedGateway === 'paypal' && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          Al continuar, seras redirigido a PayPal para completar tu pago de forma segura.
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Volver</Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Revisar pedido
        </Button>
      </div>
    </div>
  );
}

function Step4Review({
  info,
  shippingMethod,
  gateway,
  cardNumber,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  info: InfoFormData;
  shippingMethod: ShippingMethod | null;
  gateway: PaymentGateway | null;
  cardNumber: string;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const { cart } = useCart();

  const gatewayLabels: Record<PaymentGateway, string> = {
    stripe: 'Tarjeta de credito/debito',
    mercadopago: 'Mercado Pago',
    paypal: 'PayPal',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Revision del pedido</h2>

      {/* Items */}
      {cart && (
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200">
            <p className="text-sm font-semibold text-neutral-800">
              Productos ({cart.items.reduce((s, i) => s + i.quantity, 0)})
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="relative h-12 w-12 rounded-md overflow-hidden bg-neutral-50 border border-neutral-100 shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-4 w-4 text-neutral-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{item.name}</p>
                  <p className="text-xs text-neutral-500">Cant: {item.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-neutral-900 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-neutral-200 px-4 py-3 space-y-1.5 bg-neutral-50">
            <div className="flex justify-between text-sm text-neutral-600">
              <span>Subtotal</span>
              <span>{formatPrice(cart.subtotal)}</span>
            </div>
            {shippingMethod && (
              <div className="flex justify-between text-sm text-neutral-600">
                <span>Envio ({shippingMethod.name})</span>
                <span>
                  {shippingMethod.price === 0 ? (
                    <span className="text-success-600">Gratis</span>
                  ) : (
                    formatPrice(shippingMethod.price)
                  )}
                </span>
              </div>
            )}
            {cart.discount > 0 && (
              <div className="flex justify-between text-sm text-success-700">
                <span>Descuento</span>
                <span>-{formatPrice(cart.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-neutral-600">
              <span>Impuestos</span>
              <span>{formatPrice(cart.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-neutral-900 pt-1 border-t border-neutral-200">
              <span>Total</span>
              <span>{formatPrice(cart.total + (shippingMethod?.price || 0))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping address */}
      <div className="rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-semibold text-neutral-800 mb-2">Direccion de envio</p>
        <div className="text-sm text-neutral-600 space-y-0.5">
          <p>{info.firstName} {info.lastName}</p>
          <p>{info.address}</p>
          <p>{info.city}, CP {info.postalCode}</p>
          <p>{info.country}</p>
          <p className="mt-1">{info.email}</p>
          <p>{info.phone}</p>
        </div>
      </div>

      {/* Shipping method */}
      {shippingMethod && (
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-1">Metodo de envio</p>
          <p className="text-sm text-neutral-600">
            {shippingMethod.name} — {shippingMethod.estimatedDays} dias habiles
          </p>
        </div>
      )}

      {/* Payment method */}
      {gateway && (
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-1">Metodo de pago</p>
          <p className="text-sm text-neutral-600">{gatewayLabels[gateway]}</p>
          {gateway === 'stripe' && cardNumber && (
            <p className="text-sm text-neutral-500 mt-0.5">
              **** **** **** {cardNumber.replace(/\s/g, '').slice(-4)}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>Volver</Button>
        <Button onClick={onSubmit} loading={isSubmitting} size="lg">
          Confirmar pedido
        </Button>
      </div>
    </div>
  );
}

function Step5Confirmation({ result }: { result: CheckoutResult }) {
  const router = useRouter();
  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="rounded-full bg-success-100 p-5">
          <CheckCircle className="h-16 w-16 text-success-600" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-neutral-900">Pedido confirmado!</h2>
        <p className="text-neutral-600">
          Gracias por tu compra. Hemos recibido tu pedido y lo estamos procesando.
        </p>
      </div>
      <div className="inline-block rounded-xl bg-neutral-50 border border-neutral-200 px-8 py-4 text-center">
        <p className="text-xs text-neutral-500 mb-1">Numero de pedido</p>
        <p className="text-2xl font-bold text-brand-700 tracking-wider">{result.orderNumber}</p>
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600 max-w-sm mx-auto">
        <p className="font-medium text-neutral-800 mb-1">Entrega estimada</p>
        <p>{new Date(result.estimatedDelivery).toLocaleDateString('es-MX', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}</p>
      </div>
      <p className="text-sm text-neutral-500">
        Recibirás un email de confirmación con los detalles de tu pedido.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          variant="outline"
          onClick={() => router.push(`/cuenta/pedidos/${result.orderId}`)}
        >
          Ver mi pedido
        </Button>
        <Button onClick={() => router.push('/productos')}>
          Seguir comprando
        </Button>
      </div>
    </div>
  );
}

// ─── Main checkout page ───────────────────────────────────────────────────────

const STEPS: Step[] = [
  { label: 'Información' },
  { label: 'Envío' },
  { label: 'Pago' },
  { label: 'Revisión' },
  { label: 'Confirmación' },
];

export default function CheckoutPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [info, setInfo] = useState<InfoFormData | null>(null);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod | null>(null);
  const [gateway, setGateway] = useState<PaymentGateway | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [orderResult, setOrderResult] = useState<CheckoutResult | null>(null);

  const { cart, clearCart } = useCart();
  const submittedRef = useRef(false);

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post<CheckoutResult>('/checkout/complete', {
        shippingAddress: info,
        shippingMethodId: shippingMethod?.id,
        paymentGateway: gateway,
        ...(gateway === 'stripe' && {
          cardData: { number: cardNumber.replace(/\s/g, ''), expiry, cvc },
        }),
      }),
    onSuccess: async (data) => {
      setOrderResult(data);
      setCurrentStep(4);
      await clearCart();
    },
  });

  const handleInfoSubmit = (data: InfoFormData) => {
    setInfo(data);
    setCurrentStep(1);
  };

  const handleShippingNext = () => {
    if (!shippingMethod) return;
    setCurrentStep(2);
  };

  const handlePaymentNext = () => {
    setCurrentStep(3);
  };

  const handleFinalSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    completeMutation.mutate();
  };

  return (
    <div className="container-page py-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-neutral-900 mb-8">Checkout</h1>

      {/* Stepper */}
      {currentStep < 4 && (
        <div className="mb-10">
          <Stepper steps={STEPS} currentStep={currentStep} />
        </div>
      )}

      {/* Error state */}
      {completeMutation.isError && (
        <div className="mb-6 rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700">
          Hubo un error al procesar tu pedido. Por favor intenta de nuevo.
        </div>
      )}

      {/* Step content */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 lg:p-8">
        {currentStep === 0 && (
          <Step1Info onNext={handleInfoSubmit} defaultValues={info || undefined} />
        )}
        {currentStep === 1 && info && (
          <Step2Shipping
            postalCode={info.postalCode}
            selectedMethod={shippingMethod}
            onSelect={setShippingMethod}
            onNext={handleShippingNext}
            onBack={() => setCurrentStep(0)}
          />
        )}
        {currentStep === 2 && (
          <Step3Payment
            selectedGateway={gateway}
            onSelectGateway={setGateway}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            expiry={expiry}
            setExpiry={setExpiry}
            cvc={cvc}
            setCvc={setCvc}
            onNext={handlePaymentNext}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && info && (
          <Step4Review
            info={info}
            shippingMethod={shippingMethod}
            gateway={gateway}
            cardNumber={cardNumber}
            onSubmit={handleFinalSubmit}
            onBack={() => {
              submittedRef.current = false;
              setCurrentStep(2);
            }}
            isSubmitting={completeMutation.isPending}
          />
        )}
        {currentStep === 4 && orderResult && (
          <Step5Confirmation result={orderResult} />
        )}
      </div>
    </div>
  );
}
