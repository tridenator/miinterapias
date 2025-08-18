import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { supabase } from './lib/supabase';
const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
if ((import.meta as any).env?.DEV || qs?.has('debug')) {
  (window as any).supabase = supabase;
  console.log('[debug] supabase expuesto', supabase);
}

// Componentes de página
import PublicBooking from './pages/PublicBooking';
import TherapistPanel from './pages/TherapistPanel';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';
import PatientsPage from './pages/PatientsPage';

// Protectores de ruta
import RequireTherapist from './routes/RequireTherapist';
import RequireAdmin from './routes/RequireAdmin';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<PublicBooking />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas Protegidas */}
        <Route
          path="/panel"
          element={
            <RequireTherapist>
              <TherapistPanel />
            </RequireTherapist>
          }
        />
        <Route
          path="/panel/patients"
          element={
            <RequireTherapist>
              <PatientsPage />
            </RequireTherapist>
          }
        />
        <Route
          path="/panel/admin"
          element={
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
