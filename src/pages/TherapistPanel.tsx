import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import { Scheduler } from '../App'; 
export default function TherapistPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
      setLoading(false);
    });
  }, []);

   if (loading) {
    return <div>Cargando panel...</div>;
  }

 if (!userId) {
    return <div className="p-6">Error: No se pudo cargar el usuario. <a href="/" className="underline">Volver</a></div>;
  }

  // Ahora sí, renderizamos el Header y el Scheduler con el ID del usuario
  return (
    <div>
      <Header />
      <Scheduler userId={userId} />
    </div>
  );
}
