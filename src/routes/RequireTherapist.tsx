import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RequireTherapist({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setOk(false);

      // Consulto las dos cosas en paralelo
      const [thera, admin] = await Promise.all([
        supabase.rpc('is_therapist'),
        supabase.rpc('is_admin'),
      ]);

      const isTherapist = !!thera.data && !thera.error;
      const isAdmin = !!admin.data && !admin.error;
      setOk(isTherapist || isAdmin);
    })();
  }, []);

  if (ok === null) return null;
  if (!ok) return <div className="p-6">No tenés permisos. <a className="underline" href="/">Volver</a></div>;
  return <>{children}</>;
}
