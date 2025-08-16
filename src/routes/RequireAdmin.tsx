import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const [state, setState] = useState<'loading'|'ok'|'forbidden'>('loading');

  useEffect(() => {
    (async ()=>{
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState('forbidden'); return; }
      const { data } = await supabase.rpc('is_admin', { uid: user.id as any }).catch(()=>({data:false}));
      setState(data ? 'ok' : 'forbidden');
    })();
  }, []);

  if (state === 'loading')   return <div className="p-6">Cargando…</div>;
  if (state === 'forbidden') return <div className="p-6">Solo administradores. <a className="underline" href="/">Volver</a></div>;
  return children;
}
