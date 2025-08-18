import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="p-10">
      <h1 className="text-2xl font-bold">Prueba de main.tsx</h1>
      <p className="mt-4">
        Si puedes ver este mensaje, el problema está en tu configuración de rutas
        o en uno de tus componentes de página (PublicBooking, TherapistPanel, etc.).
      </p>
    </div>
  </React.StrictMode>
);
