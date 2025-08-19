import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import { Link } from 'react-router-dom';

// --- TIPOS Y FUNCIONES ---
type Patient = { full_name: string; phone: string | null };
type TherapistProfile = { color: string | null };
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
  profiles: TherapistProfile | null;
};
type Profile = { id: string; full_name: string; phone: string | null; role: 'admin' | 'therapist', color: string | null };

const colorStyles: { [key: string]: { bg: string; border: string; ring: string } } = {
  blue:   { bg: 'bg-blue-400',   border: 'border-blue-400',   ring: 'ring-blue-400' },
  green:  { bg: 'bg-green-400',  border: 'border-green-400',  ring: 'ring-green-400' },
  purple: { bg: 'bg-purple-400', border: 'border-purple-400', ring: 'ring-purple-400' },
  pink:   { bg: 'bg-pink-400',   border: 'border-pink-400',   ring: 'ring-pink-400' },
  yellow: { bg: 'bg-yellow-400', border: 'border-yellow-400', ring: 'ring-yellow-400' },
  indigo: { bg: 'bg-indigo-400', border: 'border-indigo-400', ring: 'ring-indigo-400' },
  gray:   { bg: 'bg-gray-400',   border: 'border-gray-400',   ring: 'ring-gray-400' },
};
const agendaColorStyles: { [key: string]: { bg: string; border: string } } = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-400' },
    green:  { bg: 'bg-green-50',  border: 'border-green-400' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400' },
    pink:   { bg: 'bg-pink-50',   border: 'border-pink-400' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-400' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-400' },
    gray:   { bg: 'bg-gray-100',  border: 'border-gray-200' },
};

function toISO(date: Date) { return date.toISOString(); }
function range30(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const slots: dayjs.Dayjs[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) { slots.push(cur); cur = cur.add(30, 'minute'); }
  return slots;
}

// --- COMPONENTE SCHEDULER DEL PANEL ---
function Scheduler({ userId }: { userId: string }) {
  const [date, setDate] = useState(() => dayjs().startOf('day'));
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [isBookingManually, setIsBookingManually] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dayStart = useMemo(() => date.hour(8).minute(0).second(0), [date]);
  const dayEnd = useMemo(() => date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(() => range30(dayStart, dayEnd), [dayStart, dayEnd]);

  const refreshAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromISO = toISO(dayStart.toDate());
      const toISOv = toISO(dayEnd.toDate());
      
      const { data, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*, patients (full_name, phone), profiles!appointments_therapist_id_fkey(color)')
        .gte('start_at', fromISO)
        .lt('start_at', toISOv)
        .eq('status', 'scheduled');

      if (appointmentsError) throw appointmentsError;

      setAllAppointments((data || []) as Appointment[]);
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      setError("No se pudo cargar la agenda. Revisa la consola para más detalles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAppointments();
  }, [date]);

  const occupiedSlots = useMemo(() => {
    const occupied = new Set<string>();
    allAppointments.forEach(appt => {
      const appointmentStart = dayjs(appt.start_at);
      occupied.add(appointmentStart.subtract(60, 'minutes').toISOString());
      occupied.add(appointmentStart.subtract(30, 'minutes').toISOString());
      occupied.add(appointmentStart.toISOString());
      occupied.add(appointmentStart.add(30, 'minutes').toISOString());
      occupied.add(appointmentStart.add(60, 'minutes').toISOString());
    });
    return occupied;
  }, [allAppointments]);

  // --- NUEVO: Función para cancelar una cita ---
  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      // Cerramos el modal y refrescamos la agenda
      setViewingAppointment(null);
      await refreshAppointments();
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      alert("No se pudo cancelar la cita.");
    }
  };

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
      
      {loading && <div className="text-center">Cargando agenda...</div>}
      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-2">
          {slots.map((s, idx) => {
            const startISO = toISO(s.toDate());
            const label = s.format('HH:mm');
            const isOccupied = occupiedSlots.has(startISO);
            
            const appointmentDetails = allAppointments.find(a => dayjs(a.start_at).toISOString() === startISO);
            const isOwnAppointment = appointmentDetails?.therapist_id === userId;
            
            let buttonStyle = 'bg-white hover:bg-gray-50 cursor-pointer border-gray-200';
            if (appointmentDetails) {
              const colorName = appointmentDetails.profiles?.color || 'gray';
              const style = agendaColorStyles[colorName] || agendaColorStyles.gray;
              buttonStyle = `${style.bg} ${style.border} border-2 ${isOwnAppointment ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'}`;
            } else if (isOccupied) {
              buttonStyle = 'bg-gray-100 border-gray-200 cursor-not-allowed';
            }

            return (
              <button 
                key={idx} 
                disabled={isOccupied && !isOwnAppointment}
                onClick={() => {
                  if (isOwnAppointment && appointmentDetails) setViewingAppointment(appointmentDetails);
                  if (!isOccupied) setIsBookingManually(startISO);
                }}
                className={`flex items-center justify-between rounded-2xl border px-3 py-3 transition ${buttonStyle}`}
              >
                <span className="font-medium">{label}</span>
                {isOwnAppointment && appointmentDetails ? (
                  <span className="text-left text-sm">
                    <b>{appointmentDetails.patients?.full_name || 'Cita'}</b>
                    <span className="block text-gray-600">{appointmentDetails.service || 'Servicio'}</span>
                  </span>
                ) : isOccupied ? (
                  <span className="text-gray-500">Ocupado</span>
                ) : (
                  <span className="text-green-600">Agendar</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      
      {viewingAppointment && (
        <AppointmentDetailsModal 
          appointment={viewingAppointment} 
          onClose={() => setViewingAppointment(null)}
          onCancelAppointment={handleCancelAppointment} // <-- Pasamos la función
        />
      )}
      {isBookingManually && (
        <ManualBookingModal
          startISO={isBookingManually}
          therapistId={userId}
          onClose={() => setIsBookingManually(null)}
          onSuccess={refreshAppointments}
        />
      )}
    </div>
  );
}

// --- MODALES ---
function AppointmentDetailsModal({ appointment, onClose, onCancelAppointment }: { appointment: Appointment, onClose: () => void, onCancelAppointment: (id: string) => void }) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const handleCancelClick = () => {
    if (confirmingCancel) {
      onCancelAppointment(appointment.id);
    } else {
      setConfirmingCancel(true);
    }
  };

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
        <div className="flex justify-between items-center pt-2">
          <button 
            onClick={handleCancelClick} 
            className={`px-4 py-2 rounded-xl text-sm text-white transition-colors ${confirmingCancel ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {confirmingCancel ? '¿Confirmar cancelación?' : 'Cancelar Cita'}
          </button>
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
  const [color, setColor] = useState(profile.color || 'blue');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone, color: color })
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
      <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Editar Mi Perfil</h2>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Nombre completo" value={fullName} onChange={e => setFullName(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mi Color en la Agenda</label>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(colorStyles).filter(c => c !== 'gray').map(c => (
              <button 
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? `border-black ring-2 ring-offset-1 ring-black` : 'border-gray-300'} ${colorStyles[c].bg}`}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
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
    return (
      <>
        <Header />
        <div className="p-6 text-center">Cargando panel...</div>
      </>
    );
  }

  if (!userProfile) {
    return (
      <>
        <Header />
        <div className="p-6">Error: No se pudo cargar el perfil. <a href="/" className="underline">Volver</a></div>
      </>
    );
  }

  return (
    <div>
      <Header />
      <div className="max-w-md mx-auto p-4 flex justify-end gap-2">
        <Link to="/panel/patients" className="px-4 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50">
          Mis Pacientes
        </Link>
        <button onClick={() => setIsEditingProfile(true)} className="px-4 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50">
          Mi Perfil
        </button>
      </div>
      <Scheduler userId={userProfile.id} />
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
