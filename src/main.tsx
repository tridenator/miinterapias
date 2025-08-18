import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
