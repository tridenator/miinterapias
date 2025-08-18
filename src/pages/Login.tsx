import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false); // Estado para deshabilitar el formulario mientras carga
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('¡Cuenta creada! Revisa tu email para confirmar.');
      } else {
        // 1. Iniciar sesión
        const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!user) throw new Error("No se pudo iniciar sesión, intenta de nuevo.");

        // 2. Buscar el perfil del usuario para obtener su rol
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        // 3. Redirigir según el rol
        if (profile?.role === 'admin' || profile?.role === 'therapist') {
          // Si es admin o terapeuta, va al panel
          navigate('/panel');
        } else {
          // Si es un usuario normal, va a la página principal
          navigate('/');
        }
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false); // Se detiene la carga, ya sea con éxito o error
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-md space-y-4">
          <h1 className="text-2xl font-semibold text-center">Agenda Reiki</h1>
          <input disabled={loading} className="w-full border rounded-xl px-3 py-2 disabled:bg-gray-100" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input disabled={loading} className="w-full border rounded-xl px-3 py-2 disabled:bg-gray-100" placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-black text-white py-2 font-semibold disabled:bg-gray-400">
            {loading ? 'Cargando...' : (mode === 'signin' ? 'Ingresar' : 'Crear cuenta')}
          </button>
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
