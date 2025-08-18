import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
// Importaremos Scheduler desde App.tsx en el siguiente paso
import { Scheduler } from '../App'; 

// Este es el verdadero panel de terapeuta, es su propia página.
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

  // Mientras carga, mostramos un mensaje
  if (loading) {
    return <div>Cargando panel...</div>;
  }

  // Si por alguna razón no hay usuario, no mostramos el panel
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
