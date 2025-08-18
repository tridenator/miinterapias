import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

// --- TIPOS Y FUNCIONES ---
// Extendemos el tipo Appointment para incluir la información del paciente
type Patient = { full_name: string; phone: string | null };
type Appointment = { 
  id: string; 
  therapist_id: string; 
  patient_id: string | null; 
  start_at: string; 
  end_at: string; 
  status: 'scheduled' | 'cancelled' | 'no_show' | 'blocked'; 
  service: string | null; 
  note: string | null;
  patients: Patient | null; // Relación para obtener el nombre y teléfono
};
type Profile = { id: string; full_name: string; role: 'admin' | 'therapist' };
type BusySlot = { start_at: string; end_at: string; status: string };

function toISO(date: Date) { return date.toISOString(); }
function range30(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const slots: dayjs.Dayjs[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) { slots.push(cur); cur = cur.add(30, 'minute'); }
  return slots;
}

// --- COMPONENTE SCHEDULER DEL PANEL ---
function Scheduler({ userId }: { userId: string }) {
  const [therapists, setTherapists] = useState<Profile[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>(userId);
  const [date, setDate] = useState(() => dayjs().startOf('day'));
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [ownAppointments, setOwnAppointments] = useState<Appointment[]>([]);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null); // <-- NUEVO: Para el modal de detalles

  const dayStart = useMemo(() => date.hour(8).minute(0).second(0), [date]);
  const dayEnd = useMemo(() => date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(() => range30(dayStart, dayEnd), [dayStart, dayEnd]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) setTherapists(data as Profile[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedTherapist) return;
    (async () => {
      // Siempre obtenemos los slots ocupados para saber qué está bloqueado
      const { data: busyData } = await supabase.rpc('get_busy_slots', { t_id: selectedTherapist, day: date.format('YYYY-MM-DD') });
      setBusy((busyData || []) as BusySlot[]);

      // Si es la agenda del propio terapeuta, cargamos todos los detalles
      if (selectedTherapist === userId) {
        const fromISO = toISO(dayStart.toDate());
        const toISOv = toISO(dayEnd.toDate());
        // Hacemos un join para traer también el nombre y teléfono del paciente
        const { data } = await supabase
          .from('appointments')
          .select('*, patients (full_name, phone)')
          .eq('therapist_id', userId)
          .gte('start_at', fromISO)
          .lt('start_at', toISOv)
          .order('start_at');
        setOwnAppointments((data || []) as Appointment[]);
      } else {
        // Si vemos la agenda de otro, limpiamos los detalles
        setOwnAppointments([]);
      }
    })();
  }, [selectedTherapist, date, userId, dayStart, dayEnd]);

  function isOccupied(iso: string) {
    const s = dayjs(iso);
    return busy.some(b => {
      const a = dayjs(b.start_at), e = dayjs(b.end_at);
      return (s.isSame(a) || (s.isAfter(a) && s.isBefore(e)));
    });
  }

  const isOwnAgenda = selectedTherapist === userId;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <select className="w-full border rounded-xl px-3 py-2" value={selectedTherapist} onChange={e => setSelectedTherapist(e.target.value)}>
        {therapists.map(t => (<option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>))}
      </select>
      
      <div className="flex items-center justify-between gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={() => setDate(d => d.add(-1, 'day'))}>◀︎</button>
        <div className="text-center">
          <div className="text-sm text-gray-500 capitalize">{date.format('dddd')}</div>
          <div className="text-lg font-semibold">{date.format('DD/MM/YYYY')}</div>
        </div>
        <button className="px-3 py-2 rounded-xl border" onClick={() => setDate(d => d.add(1, 'day'))}>▶︎</button>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {slots.map((s, idx) => {
          const startISO = toISO(s.toDate());
          const label = s.format('HH:mm');
          const occupied = isOccupied(startISO);
          
          // Buscamos los detalles completos solo si es la agenda propia
          const details = isOwnAgenda ? ownAppointments.find(a => dayjs(a.start_at).isSame(s)) : null;

          return (
            <button 
              key={idx} 
              disabled={!details && occupied} // Se deshabilita si está ocupado y no tenemos detalles (agenda ajena)
              onClick={() => {
                if (details) setViewingAppointment(details); // <-- NUEVO: Abrir modal al hacer clic
              }}
              className={`flex items-center justify-between rounded-2xl border px-3 py-3 transition ${
                details ? 'bg-blue-50 border-blue-300 hover:shadow-md cursor-pointer' : 
                occupied ? 'bg-gray-100 cursor-not-allowed' : 
                'bg-white hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{label}</span>
              {details ? (
                <span className="text-left text-sm">
                  <b>{details.patients?.full_name || 'Cita'}</b>
                  <span className="block text-gray-600">{details.service || 'Servicio'}</span>
                </span>
              ) : occupied ? (
                <span className="text-gray-500">Ocupado</span>
              ) : (
                <span className="text-green-600">Libre</span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* --- NUEVO: Renderizar el modal si hay una cita seleccionada --- */}
      {viewingAppointment && (
        <AppointmentDetailsModal 
          appointment={viewingAppointment} 
          onClose={() => setViewingAppointment(null)} 
        />
      )}
    </div>
  );
}

// --- NUEVO: Modal para mostrar los detalles de la cita ---
function AppointmentDetailsModal({ appointment, onClose }: { appointment: Appointment, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">Detalles de la Cita</h2>
            <p className="text-sm text-gray-500">
              {dayjs(appointment.start_at).format('dddd D [de] MMMM, HH:mm')} hs
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-800">&times;</button>
        </div>
        <div className="space-y-2 text-sm">
          <p><b>Paciente:</b> {appointment.patients?.full_name || 'No especificado'}</p>
          <p><b>Teléfono:</b> {appointment.patients?.phone || 'No especificado'}</p>
          <p><b>Servicio:</b> {appointment.service || 'No especificado'}</p>
          {appointment.note && <p><b>Nota:</b> {appointment.note}</p>}
        </div>
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL DEL PANEL ---
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

  return (
    <div>
      <Header />
      <Scheduler userId={userId} />
    </div>
  );
}
