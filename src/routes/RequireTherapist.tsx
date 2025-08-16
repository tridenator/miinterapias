import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RequireTherapist({ children }: { children: JSX.Element }) {
  const [state, setState] = useState<'loading'|'ok'|'forbidden'>('loading');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState('forbidden'); return; }
      const { data, error } = await supabase
        .from('profiles').select('role').eq('id', user.id).single();
      if (error) { console.error(error); setState('forbidden'); return; }
      const role = (data?.role as string) || '';
      setState(role === 'therapist' || role === 'admin' ? 'ok' : 'forbidden');
    })();
  }, []);

  if (state === 'loading')   return <div className="p-6">Cargando…</div>;
  if (state === 'forbidden') return <div className="p-6">No tenés permisos. <a className="underline" href="/">Volver</a></div>;
  return children;
}
