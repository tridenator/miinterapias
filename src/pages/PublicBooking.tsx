import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';

type Therapist = { id: string; full_name: string };
type BusySlot = { start_at: string; end_at: string; status: string };

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function toISO(d: Date){ return d.toISOString(); }
function range30(start: any, end: any){
  const slots: any[] = []; let cur = start.clone();
  while(cur.isBefore(end)){ slots.push(cur); cur = cur.add(30,'minute'); }
  return slots;
}

export default function PublicBooking(){
  // terapeutas y selección
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [tId, setTId] = useState<string>('');

  // calendario mensual
  const [viewMonth, setViewMonth] = useState(()=>dayjs().startOf('month'));
  const monthLabel = viewMonth.format('MMMM YYYY'); // en español
  const gridStart = viewMonth.startOf('month').startOf('week'); // inicia domingo
  const days = useMemo(()=>Array.from({length: 42}, (_,i)=>gridStart.add(i,'day')), [gridStart]);

  // día seleccionado y horas
  const [date, setDate] = useState(()=>dayjs().startOf('day'));
  const dayStart = useMemo(()=>date.hour(8).minute(0).second(0), [date]);
  const dayEnd   = useMemo(()=>date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(()=>range30(dayStart, dayEnd), [dayStart, dayEnd]);

  // ocupación y reserva
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [creating, setCreating] = useState<string|null>(null);
  const [form, setForm] = useState({ name:'', phone:'', service:'Reiki', note:'' });
  const [msg, setMsg] = useState('');

  // cargar terapeutas
  useEffect(()=>{
    (async ()=>{
      const { data, error } = await supabase.rpc('list_therapists');
      if(!error && data){
        setTherapists(data as Therapist[]);
        if(!tId && data.length) setTId(data[0].id);
      }
    })();
  },[]);

  // cargar ocupación del día elegido
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
      if(error) throw error;
      setMsg('¡Turno reservado!');
      setCreating(null);
      // refrescar ocupación del día
      const { data } = await supabase.rpc('get_busy_slots', { t_id: tId, day: date.format('YYYY-MM-DD') });
      setBusy((data||[]) as BusySlot[]);
      setForm({ name:'', phone:'', service:'Reiki', note:'' });
    }catch(e:any){
      setMsg('No se pudo reservar (¿horario ocupado?). Probá otro horario.');
      console.error(e);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Selector de terapeuta */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <select
          className="w-full sm:w-auto border rounded-xl px-3 py-2"
          value={tId} onChange={e=>setTId(e.target.value)}
        >
          {therapists.map(t => <option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-xl border" onClick={()=>setViewMonth(m=>m.add(-1,'month'))}>◀︎</button>
          <div className="min-w-[10rem] text-center capitalize font-semibold">{monthLabel}</div>
          <button className="px-3 py-2 rounded-xl border" onClick={()=>setViewMonth(m=>m.add(1,'month'))}>▶︎</button>
        </div>
      </div>

      {/* Grilla mensual (6 semanas) */}
      <div className="border rounded-2xl p-3">
        <div className="grid grid-cols-7 text-center text-sm text-gray-600 mb-2">
          {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i)=>{
            const isThisMonth = d.month() === viewMonth.month();
            const isSelected = d.isSame(date, 'day');
            const isToday = d.isSame(dayjs(), 'day');
            return (
              <button
                key={i}
                onClick={()=>setDate(d.startOf('day'))}
                className={[
                  "h-10 rounded-xl border text-sm",
                  isSelected ? "bg-black text-white border-black" : "bg-white",
                  !isThisMonth ? "opacity-40" : "",
                  isToday && !isSelected ? "border-black" : ""
                ].join(' ')}
                title={d.format('DD/MM/YYYY')}
              >
                {d.format('D')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horas del día seleccionado */}
      <div className="space-y-2">
        <div className="text-center">
          <div className="text-sm text-gray-500 capitalize">{date.format('dddd')}</div>
          <div className="text-lg font-semibold">{date.format('DD/MM/YYYY')}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {slots.map((s:any, idx:number)=>{
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
      </div>

      {/* Modal de reserva pública */}
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
