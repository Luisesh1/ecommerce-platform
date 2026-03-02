"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    setError('');
    try {
      await login(data.email, data.password);
      router.push('/cuenta');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">Iniciar sesión</h1>
          <p className="text-neutral-500 text-sm mt-1">Bienvenido de vuelta</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                {...register('email')}
                type="email"
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-neutral-300 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full rounded-lg border border-neutral-300 pl-10 pr-10 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </form>


        {/* Demo credentials */}
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">👤 Usuarios de prueba</p>
          <div className="space-y-2">
            {[
              { label: '🔴 Admin', email: 'admin@example.com', password: 'Admin123!' },
              { label: '🟢 Carlos López', email: 'carlos.lopez@demo.com', password: 'Demo1234!' },
              { label: '🟢 Ana Martínez', email: 'ana.martinez@demo.com', password: 'Demo1234!' },
              { label: '🟢 Jorge García', email: 'jorge.garcia@demo.com', password: 'Demo1234!' },
              { label: '🟢 Sofía Rodríguez', email: 'sofia.rodriguez@demo.com', password: 'Demo1234!' },
            ].map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => {
                  (document.querySelector('input[type="email"]') as HTMLInputElement).value = u.email;
                  (document.querySelector('input[type="password"], input[name="password"]') as HTMLInputElement).value = u.password;
                  // Trigger react-hook-form
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                  const emailEl = document.querySelector('input[type="email"]') as HTMLInputElement;
                  const passEl = document.querySelector('input[name="password"]') as HTMLInputElement;
                  nativeInputValueSetter.call(emailEl, u.email);
                  emailEl.dispatchEvent(new Event('input', { bubbles: true }));
                  nativeInputValueSetter.call(passEl, u.password);
                  passEl.dispatchEvent(new Event('input', { bubbles: true }));
                }}
                className="w-full flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left hover:border-brand-400 hover:bg-brand-50 transition-colors group"
              >
                <span className="text-sm font-medium text-neutral-700 group-hover:text-brand-700">{u.label}</span>
                <span className="text-xs text-neutral-400 font-mono group-hover:text-brand-500">{u.email}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-2 text-center">Click para autocompletar · Contraseña: <span className="font-mono font-semibold">Demo1234!</span> (clientes) / <span className="font-mono font-semibold">Admin123!</span> (admin)</p>
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-brand-600 font-medium hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
