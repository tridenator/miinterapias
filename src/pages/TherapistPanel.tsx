import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

// --- TIPOS Y FUNCIONES ---
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
  patients: Patient | null;
};
type Profile = { id: string; full_name: string; phone: string | null; role: 'admin' | 'therapist' };
type BusySlot = { start_at: string; end_at: string; status: string };

function toISO(date: Date) { return date.toISOString(); }
function range30(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const slots: dayjs.Dayjs[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) { slots.push(cur); cur = cur.add(30, 'minute'); }
  return slots;
}

// --- COMPONENTE SCHEDULER DEL PANEL ---
function Scheduler({ userId, userProfile }: { userId: string, userProfile: Profile }) {
  const [date, setDate] = useState(() => dayjs().startOf('day'));
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [isBookingManually, setIsBookingManually] = useState<string | null>(null); // Contendrá el ISO del slot a agendar

  const dayStart = useMemo(() => date.hour(8).minute(0).second(0), [date]);
  const dayEnd = useMemo(() => date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(() => range30(dayStart, dayEnd), [dayStart, dayEnd]);

  // Función para recargar las citas del día
  const refreshAppointments = async () => {
    const { data: busyData } = await supabase.rpc('get_all_busy_slots', { day: date.format('YYYY-MM-DD') });
    setBusy((busyData || []) as BusySlot[]);

    const fromISO = toISO(dayStart.toDate());
    const toISOv = toISO(dayEnd.toDate());
    const { data } = await supabase
      .from('appointments')
      .select('*, patients (full_name, phone)')
      .gte('start_at', fromISO)
      .lt('start_at', toISOv)
      .order('start_at');
    setAllAppointments((data || []) as Appointment[]);
  };

  useEffect(() => {
    refreshAppointments();
  }, [date, dayStart, dayEnd]);

  function isOccupied(iso: string) {
    const s = dayjs(iso);
    return busy.some(b => {
      const a = dayjs(b.start_at), e = dayjs(b.end_at);
      return (s.isSame(a) || (s.isAfter(a) && s.isBefore(e)));
    });
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
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
          
          const appointmentDetails = occupied ? allAppointments.find(a => dayjs(a.start_at).isSame(s)) : null;
          const isOwnAppointment = appointmentDetails?.therapist_id === userId;

          return (
            <button 
              key={idx} 
              disabled={occupied && !isOwnAppointment}
              onClick={() => {
                if (isOwnAppointment) setViewingAppointment(appointmentDetails);
                if (!occupied) setIsBookingManually(startISO);
              }}
              className={`flex items-center justify-between rounded-2xl border px-3 py-3 transition ${
                isOwnAppointment ? 'bg-blue-50 border-blue-300 hover:shadow-md cursor-pointer' : 
                occupied ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : 
                'bg-white hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <span className="font-medium">{label}</span>
              {isOwnAppointment ? (
                <span className="text-left text-sm">
                  <b>{appointmentDetails.patients?.full_name || 'Cita'}</b>
                  <span className="block text-gray-600">{appointmentDetails.service || 'Servicio'}</span>
                </span>
              ) : occupied ? (
                <span className="text-gray-500">Ocupado</span>
              ) : (
                <span className="text-green-600">Agendar</span>
              )}
            </button>
          );
        })}
      </div>
      
      {viewingAppointment && (
        <AppointmentDetailsModal 
          appointment={viewingAppointment} 
          onClose={() => setViewingAppointment(null)} 
        />
      )}
      {isBookingManually && (
        <ManualBookingModal
          startISO={isBookingManually}
          therapistId={userId}
          onClose={() => setIsBookingManually(null)}
          onSuccess={() => {
            setIsBookingManually(null);
            refreshAppointments(); // Recargamos la agenda
          }}
        />
      )}
    </div>
  );
}

// --- MODALES ---
function AppointmentDetailsModal({ appointment, onClose }: { appointment: Appointment, onClose: () => void }) {
  // ... (sin cambios)
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

function ManualBookingModal({ startISO, therapistId, onClose, onSuccess }: { startISO: string; therapistId: string; onClose: () => void; onSuccess: () => void; }) {
  const [form, setForm] = useState({ name: '', phone: '', service: 'Reiki', note: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('book_appointment', {
        t_id: therapistId,
        start_at: startISO,
        patient_name: form.name.trim(),
        phone: form.phone.trim(),
        service: form.service.trim(),
        note: form.note.trim(),
      });
      if (error) throw error;
      onSuccess();
    } catch (e) {
      alert('Error al agendar la cita.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">Agendar Paciente</h2>
        <p className="text-sm text-gray-500">
          {dayjs(startISO).format('dddd D [de] MMMM, HH:mm')} hs
        </p>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Nombre del paciente" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Servicio" value={form.service} onChange={e=>setForm({...form, service: e.target.value})} />
        <textarea className="w-full border rounded-xl px-3 py-2" placeholder="Nota (opcional)" value={form.note} onChange={e=>setForm({...form, note: e.target.value})} />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditModal({ profile, onClose, onSuccess }: { profile: Profile; onClose: () => void; onSuccess: (updatedProfile: Profile) => void; }) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone })
      .eq('id', profile.id)
      .select()
      .single();
    if (error) {
      alert('Error al actualizar el perfil.');
      console.error(error);
    } else if (data) {
      onSuccess(data as Profile);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">Editar Mi Perfil</h2>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Nombre completo" value={fullName} onChange={e => setFullName(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}


// --- COMPONENTE PRINCIPAL DEL PANEL ---
export default function TherapistPanel() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>Cargando panel...</div>;
  }

  if (!userProfile) {
    return <div className="p-6">Error: No se pudo cargar el perfil. <a href="/" className="underline">Volver</a></div>;
  }

  return (
    <div>
      <Header />
      <div className="max-w-md mx-auto p-4 flex justify-end gap-2">
        <button onClick={() => setIsEditingProfile(true)} className="px-4 py-2 text-sm rounded-xl border bg-white">Mi Perfil</button>
      </div>
      <Scheduler userId={userProfile.id} userProfile={userProfile} />
      {isEditingProfile && (
        <ProfileEditModal
          profile={userProfile}
          onClose={() => setIsEditingProfile(false)}
          onSuccess={(updatedProfile) => {
            setUserProfile(updatedProfile);
            setIsEditingProfile(false);
          }}
        />
      )}
    </div>
  );
}
