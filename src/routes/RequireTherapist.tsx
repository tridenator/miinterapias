import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RequireTherapist({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setOk(false);
      const { data, error } = await supabase.rpc('is_therapist'); // ✅ sin params
      setOk(Boolean(data && !error));
    })();
  }, []);

  if (ok === null) return null;
  if (!ok) return <div className="p-6">No tenés permisos. <a className="underline" href="/">Volver</a></div>;
  return <>{children}</>;
}
