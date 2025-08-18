import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { supabase } from './lib/supabase';               // ⬅️ importa el cliente
const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
if ((import.meta as any).env?.DEV || qs?.has('debug')) { // ⬅️ solo dev o ?debug=1
  // @ts-ignore
  (window as any).supabase = supabase;
  console.log('[debug] supabase expuesto', supabase);   // ⬅️ verás esto en Console
}

import PublicBooking from './pages/PublicBooking';
import TherapistPanel from './pages/TherapistPanel';
import RequireTherapist from './routes/RequireTherapist';
import RequireAdmin from './routes/RequireAdmin';
import AdminPanel from './pages/AdminPanel';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicBooking />} />
        <Route
          path="/panel"
          element={
            <RequireTherapist>
              <TherapistPanel />
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
