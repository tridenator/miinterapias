import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import type { Session } from '@supabase/supabase-js';

// --- TIPOS Y FUNCIONES ---
type Profile = { id: string; full_name: string; role: 'admin' | 'therapist' };
type Appointment = { id: string; therapist_id: string; patient_id: string | null; start_at: string; end_at: string; status: 'scheduled' | 'cancelled' | 'no_show' | 'blocked'; service: string | null; note: string | null; };
type BusySlot = { start_at: string; end_at: string; status: string };

function toISO(date: Date) { return date.toISOString(); }
function range30(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const slots: dayjs.Dayjs[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) { slots.push(cur); cur = cur.add(30, 'minute'); }
  return slots;
}

// --- COMPONENTES DE LA PÁGINA ---

// Array de colores para los terapeutas. Cada par es [borde, fondo].
const therapistColors = [
  'border-blue-300', 'bg-blue-50',
  'border-green-300', 'bg-green-50',
  'border-purple-300', 'bg-purple-50',
  'border-yellow-300', 'bg-yellow-50',
  'border-pink-300', 'bg-pink-50',
];

function Scheduler({ userId }: { userId: string | null }) {
  const [therapists, setTherapists] = useState<Profile[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [date, setDate] = useState(() => dayjs().startOf('day'));
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [ownAppointments, setOwnAppointments] = useState<Appointment[]>([]);
  const [creating, setCreating] = useState<{ start: string } | null>(null);

  const dayStart = useMemo(() => date.hour(8).minute(0).second(0), [date]);
  const dayEnd = useMemo(() => date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(() => range30(dayStart, dayEnd), [dayStart, dayEnd]);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role').then(({ data, error }) => {
      if (!error && data) {
        setTherapists(data as Profile[]);
        // Si hay un usuario logueado, lo seleccionamos por defecto. Si no, el primero de la lista.
        if (userId) {
          setSelectedTherapist(userId);
        } else if (data.length > 0) {
          setSelectedTherapist(data[0].id);
        }
      }
    });
  }, [userId]);

  useEffect(() => {
    if (!selectedTherapist) return;
    (async () => {
      const { data: busyData } = await supabase.rpc('get_busy_slots', { t_id: selectedTherapist, day: date.format('YYYY-MM-DD') });
      setBusy((busyData || []) as BusySlot[]);
      if (selectedTherapist === userId) {
        const fromISO = toISO(dayStart.toDate());
        const toISOv = toISO(dayEnd.toDate());
        const { data } = await supabase.from('appointments').select('*').gte('start_at', fromISO).lt('start_at', toISOv).order('start_at');
        setOwnAppointments((data || []) as Appointment[]);
      } else {
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
  function ownDetails(iso: string): Appointment | null {
    const s = dayjs(iso);
    return ownAppointments.find(a => dayjs(a.start_at).isSame(s)) || null;
  }

  const isOwnAgenda = selectedTherapist === userId;

  // --- NUEVO: Lógica para asignar colores a los terapeutas ---
  const therapistColorClasses = useMemo(() => {
    const index = therapists.findIndex(t => t.id === selectedTherapist);
    if (index === -1) return 'border-gray-200 bg-white'; // Color por defecto

    // Usamos el módulo para ciclar a través de los colores si hay más terapeutas que colores
    const colorIndex = index % (therapistColors.length / 2);
    return `${therapistColors[colorIndex * 2]} ${therapistColors[colorIndex * 2 + 1]}`;
  }, [therapists, selectedTherapist]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={() => setDate(d => d.add(-1, 'day'))}>◀︎</button>
        <div className="text-center">
          <div className="text-sm text-gray-500">{date.format('dddd')}</div>
          <div className="text-lg font-semibold">{date.format('DD/MM/YYYY')}</div>
        </div>
        <button className="px-3 py-2 rounded-xl border" onClick={() => setDate(d => d.add(1, 'day'))}>▶︎</button>
      </div>
      <select className="w-full border rounded-xl px-3 py-2" value={selectedTherapist ?? ''} onChange={e => setSelectedTherapist(e.target.value)}>
        {therapists.map(t => (<option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>))}
      </select>
      <div className="grid grid-cols-1 gap-2">
        {slots.map((s, idx) => {
          const startISO = toISO(s.toDate());
          const label = s.format('HH:mm');
          const occupied = isOccupied(startISO);
          const details = isOwnAgenda ? ownDetails(startISO) : null;

          // --- MODIFICADO: Ocultar slots ocupados si no es la agenda propia ---
          if (occupied && !isOwnAgenda) {
            return null; // No renderiza nada
          }

          return (
            <button
              key={idx}
              disabled={occupied && !details}
              onClick={() => { if (!occupied && isOwnAgenda) setCreating({ start: startISO }); }}
              // --- MODIFICADO: Aplicar colores y estilos dinámicos ---
              className={`flex items-center justify-between rounded-2xl border px-3 py-3 
                ${occupied 
                  ? 'bg-gray-100 cursor-not-allowed' 
                  : `${therapistColorClasses} hover:shadow-md`
                } 
                ${(!occupied && isOwnAgenda) ? 'active:scale-[.99] transition' : ''}`}
            >
              <span className="font-medium">{label}</span>
              {occupied ? (
                details ? (
                  <span className="text-left text-sm">
                    <b>{details.service || 'Turno'}</b>
                    <span className="block text-gray-600">Paciente asignado</span>
                  </span>
                ) : (
                  <span className="text-gray-500">Ocupado</span>
                )
              ) : (
                isOwnAgenda ? <span className="text-green-600">Libre</span> : <span className="text-blue-600 font-semibold">Disponible</span>
              )}
            </button>
          );
        })}
      </div>
      {creating && (<CreateDialog startISO={creating.start} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); setDate(d => d.clone()); }} therapistId={userId!} />)}
    </div>
  );
}

function CreateDialog({ startISO, onClose, onCreated, therapistId }: { startISO: string; onClose: () => void; onCreated: () => void; therapistId: string; }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('Reiki');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const start = dayjs(startISO);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('book_appointment', {
        t_id: therapistId,
        start_at: startISO,
        patient_name: name.trim(),
        phone: phone.trim(),
        service: service.trim(),
        note: note.trim(),
      });
      if (error) throw error;
      onCreated();
    } catch (e) {
      alert('Error guardando turno.');
      console.error(e);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Nuevo turno — {start.format('DD/MM HH:mm')}</div>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Nombre del paciente" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono (opcional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Servicio (p.ej. Reiki)" value={service} onChange={e => setService(e.target.value)} />
        <textarea className="w-full border rounded-xl px-3 py-2" placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL DE LA PÁGINA ---
export default function PublicBooking() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  if (loading) {
    return (
      <>
        <Header />
        <div className="p-6 text-center">Cargando agenda…</div>
      </>
    );
  }

  return (
    <div>
      <Header />
      <Scheduler userId={session?.user?.id ?? null} />
    </div>
  );
}
