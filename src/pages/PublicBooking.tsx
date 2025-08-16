import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';

type Therapist = { id: string; full_name: string };
type BusySlot = { start_at: string; end_at: string; status: string };

function toISO(d: Date){ return d.toISOString(); }
function range30(start: dayjs.Dayjs, end: dayjs.Dayjs){
  const slots: dayjs.Dayjs[] = []; let cur = start.clone();
  while(cur.isBefore(end)){ slots.push(cur); cur = cur.add(30,'minute'); }
  return slots;
}

export default function PublicBooking(){
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [tId, setTId] = useState<string>('');
  const [date, setDate] = useState(()=>dayjs().startOf('day'));
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [form, setForm] = useState<{name: string; phone: string; service: string; note: string}>(()=>({name:'',phone:'',service:'Reiki',note:''}));
  const [creating, setCreating] = useState<string|null>(null);
  const [msg, setMsg] = useState<string>('');

  const dayStart = useMemo(()=>date.hour(8).minute(0).second(0),[date]);
  const dayEnd   = useMemo(()=>date.hour(20).minute(0).second(0),[date]);
  const slots = useMemo(()=>range30(dayStart, dayEnd),[dayStart, dayEnd]);

  useEffect(()=>{
    (async ()=>{
      const { data, error } = await supabase.rpc('list_therapists');
      if(!error && data){ setTherapists(data as Therapist[]); if(!tId && data.length){ setTId(data[0].id); } }
    })();
  },[]);

  useEffect(()=>{
    if(!tId) return;
    (async ()=>{
      const { data } = await supabase.rpc('get_busy_slots', { t_id: tId, day: date.format('YYYY-MM-DD') });
      setBusy((data||[]) as BusySlot[]);
    })();
  },[tId, date]);

  function isOccupied(iso: string){
    const s = dayjs(iso);
    return busy.some(b=>{
      const a = dayjs(b.start_at), e = dayjs(b.end_at);
      return (s.isSame(a) || (s.isAfter(a) && s.isBefore(e)));
    });
  }

  async function book(){
    if(!creating || !tId) return;
    setMsg('');
    if(!form.phone.trim()){ setMsg('El teléfono es obligatorio.'); return; }
    try{
      const { error } = await supabase.rpc('book_appointment', {
        t_id: tId,
        start_at: creating,
        patient_name: form.name || null,
        phone: form.phone,
        service: form.service || 'Reiki',
        note: form.note || null,
      });
      if(error){ throw error; }
      setMsg('¡Turno reservado! Te esperamos.');
      setCreating(null);
      // refrescar disponibilidad
      const { data } = await supabase.rpc('get_busy_slots', { t_id: tId, day: date.format('YYYY-MM-DD') });
      setBusy((data||[]) as BusySlot[]);
      setForm({name:'', phone:'', service:'Reiki', note:''});
    }catch(e:any){
      setMsg('No se pudo reservar (¿horario ocupado?). Probá con otro horario.');
      console.error(e);
    }
  }

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

      <select className="w-full border rounded-xl px-3 py-2" value={tId} onChange={e=>setTId(e.target.value)}>
        {therapists.map(t => <option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>)}
      </select>

      <div className="grid grid-cols-1 gap-2">
        {slots.map((s, idx)=>{
          const startISO = toISO(s.toDate());
          const label = s.format('HH:mm');
          const occupied = isOccupied(startISO);
          return (
            <button key={idx}
              disabled={occupied}
              onClick={()=>setCreating(startISO)}
              className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${occupied ? 'bg-gray-100' : 'bg-white active:scale-[.99] transition'}`}
            >
              <span className="font-medium">{label}</span>
              {occupied ? <span className="text-gray-500">Ocupado</span> : <span className="text-green-600">Libre</span>}
            </button>
          );
        })}
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Reservar — {dayjs(creating).format('DD/MM HH:mm')}</div>
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Tu nombre (opcional)" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono (obligatorio)" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Servicio (ej. Reiki)" value={form.service} onChange={e=>setForm({...form, service: e.target.value})} />
            <textarea className="w-full border rounded-xl px-3 py-2" placeholder="Nota (opcional)" value={form.note} onChange={e=>setForm({...form, note: e.target.value})} />
            {msg && <p className="text-sm text-blue-700">{msg}</p>}
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-xl border" onClick={()=>setCreating(null)}>Cancelar</button>
              <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={book}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="pt-2 text-center text-sm">
        <a href="/panel" className="underline">Panel de terapeutas</a>
      </footer>
    </div>
  );
}
