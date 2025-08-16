import PublicBooking from './pages/PublicBooking'
import TherapistPanel from './pages/TherapistPanel'
import AdminPanel from './pages/AdminPanel'
import RequireTherapist from './routes/RequireTherapist'
import RequireAdmin from './routes/RequireAdmin'

const router = createBrowserRouter([
  { path: '/', element: <PublicBooking/> },
  {
    path: '/panel',
    element: (
      <RequireTherapist>
        <TherapistPanel/>
      </RequireTherapist>
    ),
  },
  {
    path: '/panel/admin',
    element: (
      <RequireAdmin>
        <AdminPanel/>
      </RequireAdmin>
    ),
  },
])
