import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Header() {
  const [name, setName] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles')
        .select('full_name').eq('id', user.id).single();
      setName(data?.full_name || '');
    })();
  }, []);

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Agenda de Terapias Reiki</h1>
        <div className="text-sm text-gray-600">
          {name ? <>Terapeuta: <b>{name}</b></> : <a href="/panel" className="underline">Ingresar</a>}
        </div>
      </div>
    </header>
  );
}
