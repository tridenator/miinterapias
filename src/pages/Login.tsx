import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

// Este es ahora el componente dedicado para el inicio de sesión
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('¡Cuenta creada! Revisa tu email para confirmar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Si el login es exitoso, redirigimos al panel
        navigate('/panel');
      }
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-md space-y-4">
          <h1 className="text-2xl font-semibold text-center">Agenda Reiki</h1>
          <input className="w-full border rounded-xl px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full border rounded-xl px-3 py-2" placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button className="w-full rounded-xl bg-black text-white py-2 font-semibold">{mode === 'signin' ? 'Ingresar' : 'Crear cuenta'}</button>
          <p className="text-sm text-center text-gray-600">
            {mode === 'signin' ? (
              <>¿No tenés cuenta? <button type="button" className="underline font-medium" onClick={() => setMode('signup')}>Crear cuenta</button></>
            ) : (
              <>¿Ya tenés cuenta? <button type="button" className="underline font-medium" onClick={() => setMode('signin')}>Ingresar</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
