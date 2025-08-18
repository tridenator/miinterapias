import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Solo importamos el componente de la página principal por ahora
import PublicBooking from './pages/PublicBooking';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Solo activamos esta ruta */}
        <Route path="/" element={<PublicBooking />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
