import { useEffect, useMemo, useState } from 'react';
import dayjs from './lib/dayjs';
import { supabase } from './lib/supabase';
import './index.css';

type Profile = { id: string; full_name: string; role: 'admin' | 'therapist' };
type Appointment = {
  id: string;
  therapist_id: string;
  patient_id: string | null;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'cancelled' | 'no_show' | 'blocked';
  service: string | null;
  note: string | null;
};
type BusySlot = { start_at: string; end_at: string; status: string };

function toISO(date: Date) { return date.toISOString(); }
function range30(start: dayjs.Dayjs, end: dayjs.Dayjs) {
  const slots: dayjs.Dayjs[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) { slots.push(cur); cur = cur.add(30, 'minute'); }
  return slots;
}

function useSession() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);
  return { userId, loading };
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">Agenda Reiki</h1>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full rounded-xl bg-black text-white py-2">{mode==='signin'?'Ingresar':'Crear cuenta'}</button>
        <p className="text-sm text-center">
          {mode==='signin'? (
            <>¿No tenés cuenta? <button type="button" className="underline" onClick={()=>setMode('signup')}>Crear cuenta</button></>
          ) : (
            <>¿Ya tenés cuenta? <button type="button" className="underline" onClick={()=>setMode('signin')}>Ingresar</button></>
          )}
        </p>
      </form>
    </div>
  );
}

export default function App() {
  const { userId, loading } = useSession();
  if (loading) return <div className="p-6">Cargando…</div>;
  if (!userId) return <Login/>;
  return <Scheduler userId={userId}/>;
}

function Scheduler({ userId }: { userId: string }) {
  const [therapists, setTherapists] = useState<Profile[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);
  const [date, setDate] = useState(() => dayjs().startOf('day'));
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [ownAppointments, setOwnAppointments] = useState<Appointment[]>([]);
  const [creating, setCreating] = useState<{ start: string } | null>(null);

  const dayStart = useMemo(()=>date.hour(8).minute(0).second(0), [date]);
  const dayEnd   = useMemo(()=>date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(()=>range30(dayStart, dayEnd), [dayStart, dayEnd]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role');
      if (!error && data) {
        setTherapists(data as Profile[]);
        if (!selectedTherapist) setSelectedTherapist(userId);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!selectedTherapist) return;
    (async () => {
      // Slots ocupados (visible para cualquiera autenticado)
      const { data: busyData } = await supabase.rpc('get_busy_slots', {
        t_id: selectedTherapist,
        day: date.format('YYYY-MM-DD'),
      });
      setBusy((busyData || []) as BusySlot[]);

      // Si es tu agenda, cargar detalles (paciente/servicio)
      if (selectedTherapist === userId) {
        const fromISO = toISO(dayStart.toDate());
        const toISOv  = toISO(dayEnd.toDate());
        const { data } = await supabase
          .from('appointments')
          .select('*')
          .gte('start_at', fromISO)
          .lt('start_at', toISOv)
          .order('start_at');
        setOwnAppointments((data || []) as Appointment[]);
      } else {
        setOwnAppointments([]);
      }
    })();
  }, [selectedTherapist, date]);

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

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={()=>setDate(d=>d.add(-1,'day'))}>◀︎</button>
        <div className="text-center">
          <div className="text-sm text-gray-500">{date.format('dddd')}</div>
          <div className="text-lg font-semibold">{date.format('DD/MM/YYYY')}</div>
        </div>
        <button className="px-3 py-2 rounded-xl border" onClick={()=>setDate(d=>d.add(1,'day'))}>▶︎</button>
      </header>

      <select
        className="w-full border rounded-xl px-3 py-2"
        value={selectedTherapist ?? ''}
        onChange={e=>setSelectedTherapist(e.target.value)}
      >
        {therapists.map(t => (
          <option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>
        ))}
      </select>

      <div className="grid grid-cols-1 gap-2">
        {slots.map((s, idx) => {
          const startISO = toISO(s.toDate());
          const label = s.format('HH:mm');
          const occupied = isOccupied(startISO);
          const details = isOwnAgenda ? ownDetails(startISO) : null;
          return (
            <button
              key={idx}
              disabled={occupied && !details}
              onClick={() => {
                if (!occupied && isOwnAgenda) setCreating({ start: startISO });
              }}
              className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${occupied ? 'bg-gray-100' : 'bg-white'} ${(!occupied && isOwnAgenda) ? 'active:scale-[.99] transition' : ''}`}
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
                isOwnAgenda ? <span className="text-green-600">Libre</span> : <span className="text-gray-400">—</span>
              )}
            </button>
          );
        })}
      </div>

      {creating && (
        <CreateDialog
          startISO={creating.start}
          onClose={() => setCreating(null)}
          onCreated={() => { setCreating(null); setDate(d=>d.clone()); }}
          therapistId={userId}
        />
      )}

      <footer className="pt-6 text-center">
        <button className="text-sm underline" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button>
      </footer>
    </div>
  );
}

function CreateDialog({ startISO, onClose, onCreated, therapistId }:{
  startISO:string; onClose:()=>void; onCreated:()=>void; therapistId:string;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('Reiki');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const start = dayjs(startISO);
  const endISO = start.add(30,'minute').toDate().toISOString();

  async function save() {
    setSaving(true);
    try {
      // 1) crear/obtener paciente por nombre (MVP)
      let patientId: string | undefined;
      if (name.trim()) {
        const { data: existing } = await supabase
          .from('patients')
          .select('id')
          .eq('therapist_id', therapistId)
          .ilike('full_name', name.trim())
          .limit(1);
        if (existing && existing.length) {
          patientId = existing[0].id;
        } else {
          const { data: p, error: pe } = await supabase
            .from('patients')
            .insert({ therapist_id: therapistId, full_name: name.trim(), phone })
            .select('id')
            .single();
          if (pe) throw pe;
          patientId = p!.id;
        }
      }

      // 2) crear turno
      const { error: ae } = await supabase.from('appointments').insert({
        therapist_id: therapistId,
        patient_id: patientId || null,
        start_at: startISO,
        end_at: endISO,
        status: 'scheduled',
        service,
        note,
        created_by: therapistId,
      });
      if (ae) throw ae;
      onCreated();
    } catch (e) {
      alert('Error guardando turno. Verifica que no esté ocupado.');
      console.error(e);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Nuevo turno — {start.format('DD/MM HH:mm')}</div>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Nombre del paciente" value={name} onChange={e=>setName(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono (opcional)" value={phone} onChange={e=>setPhone(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Servicio (p.ej. Reiki)" value={service} onChange={e=>setService(e.target.value)} />
        <textarea className="w-full border rounded-xl px-3 py-2" placeholder="Nota (opcional)" value={note} onChange={e=>setNote(e.target.value)} />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
