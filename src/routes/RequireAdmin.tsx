import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const [state, setState] = useState<'loading'|'ok'|'forbidden'>('loading');

  useEffect(() => {
  (async ()=>{
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setState('forbidden'); return; }
    try {
      const { data, error } = await supabase.rpc('is_admin', { uid: user.id as any });
      if (error) { setState('forbidden'); return; }
      setState(data ? 'ok' : 'forbidden');
    } catch {
      setState('forbidden');
    }
  })();
}, []);

