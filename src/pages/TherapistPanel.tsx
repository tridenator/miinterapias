import App from '../App';

export default function TherapistPanel() {
   return <App />;
}

import Scheduler from '../App'; // Asumiendo que el Scheduler está exportado desde App.tsx
import Header from '../components/Header';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

// Este es el verdadero panel de terapeuta
export default function TherapistPanel() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  // Mientras carga el ID del usuario, no mostramos nada
  if (!userId) {
    return <div>Cargando panel...</div>;
  }

  // Ahora sí, renderizamos el Header y el Scheduler con el ID del usuario
  return (
    <div>
      <Header />
      {/* Aquí usamos el componente que antes estaba en App.tsx */}
      <Scheduler userId={userId} /> 
    </div>
  );
}


