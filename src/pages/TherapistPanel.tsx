// Por ahora, vamos a usar el mismo Scheduler de la página principal.
// Más adelante, puedes crear un panel específico para el terapeuta aquí.
import App from '../App';

export default function TherapistPanel() {
  // NOTA: La forma correcta sería tener un componente de Panel aquí.
  // Pero como tu App.tsx ya contiene el Scheduler, podemos reutilizarlo
  // para que funcione inmediatamente.
  return <App />;
}
```
**Corrección importante:** Viendo que tu `App.tsx` es en realidad el `Scheduler`, mi explicación anterior era un poco confusa. El problema no es un bucle, sino que `TherapistPanel` estaba renderizando `App`, que a su vez renderizaba el componente de `Login` si la sesión no estaba lista, causando un conflicto. Al llamar a `App` desde el panel, estás creando una estructura confusa.

La solución más limpia es que `TherapistPanel` muestre su propio contenido. Vamos a hacer que muestre el mismo `Scheduler` que ya tienes. Reemplaza el contenido de `src/pages/TherapistPanel.tsx` con esto:


```tsx
// Importamos directamente los componentes que necesitamos, no App.tsx entero.
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
```
*Nota: Para que esto funcione, tendrás que exportar el componente `Scheduler` desde tu `App.tsx`. Simplemente cambia `function Scheduler...` por `export function Scheduler...`.*

#### Paso 2: Crea la Función `is_therapist` en Supabase

1.  Ve a tu proyecto en el **Dashboard de Supabase**.
2.  Ve al **SQL Editor**.
3.  Pega y **RUN** el siguiente código:


```sql
CREATE OR REPLACE FUNCTION is_therapist()
RETURNS boolean AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Selecciona el rol del usuario autenticado desde la tabla 'profiles'
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  
  -- Devuelve TRUE si el rol es 'therapist', de lo contrario FALSE
  RETURN user_role = 'therapist';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
