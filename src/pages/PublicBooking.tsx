import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

type Therapist = { id: string; full_name: string };
type BusySlot = { start_at: string; end_at: string; status: string };

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toISO(d: Date){ return d.toISOString(); }
function range30(start: any, end: any){
  const slots: any[] = []; let cur = start.clone();
  while(cur.isBefore(end)){ slots.push(cur); cur = cur.add(30,'minute'); }
  return slots;
}

export default function PublicBooking(){
  // guía / pasos
  const [step, setStep] = useState<number>(() => {
    const seen = localStorage.getItem('guide_seen_v1');
    return seen ? 2 : 1; // si nunca la vio, arranca en 1 (intro)
  });
  useEffect(() => {
    if (step > 1) localStorage.setItem('guide_seen_v1', 'true');
  }, [step]);

  // terapeutas y selección
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [tId, setTId] = useState<string>('');

  // calendario mensual (compacto)
  const [viewMonth, setViewMonth] = useState(()=>dayjs().startOf('month'));
  const monthLabel = viewMonth.format('MMMM YYYY');
  const first = viewMonth.startOf('month');
  const dowMon0 = (first.day() + 6) % 7;    // Lunes=0
  const gridStart = first.subtract(dowMon0, 'day');
  const days = useMemo(()=>Array.from({length: 42}, (_,i)=>gridStart.add(i,'day')), [gridStart]);

  // día y horas
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
      const { data } = await supabase.rpc('list_therapists');
      if(data){
        setTherapists(data as Therapist[]);
        if(!tId && data.length) setTId((data as Therapist[])[0].id);
      }
    })();
  },[]);

  // cargar ocupación
  useEffect(()=>{
    if(!tId) return;
    (async ()=>{
      const { data } = await supabase.rpc('get_busy_slots', { t_id: tId, day: date.format('YYYY-MM-DD') });
      setBusy((data||[]) as BusySlot[]);
    })();
  },[tId, date]);

  // --- MODIFICADO: Lógica de Ocupación con 1.5 horas de bloqueo ---
  function isOccupied(iso: string){
    const currentSlot = dayjs(iso); // El slot que estamos revisando (ej: 10:30)

    // Revisa si el slot actual cae dentro del bloqueo de 1.5 horas de CUALQUIER cita agendada
    return busy.some(appointment => {
      const appointmentStart = dayjs(appointment.start_at);
      
      // La consulta dura 1 hora y la preparación 30 min.
      // El bloqueo total es de 90 minutos desde el inicio de la cita.
      const blockEnd = appointmentStart.add(90, 'minutes');

      // El slot está ocupado si es igual al inicio de la cita, o si está entre el inicio y el fin del bloqueo.
      return currentSlot.isSame(appointmentStart) || (currentSlot.isAfter(appointmentStart) && currentSlot.isBefore(blockEnd));
    });
  }

  async function book() {
    if (!creating || !tId) return;
    setMsg('');
    try {
      const payload = {
        t_id: tId,
        start_at: new Date(creating).toISOString(),
        patient_name: (form.name || '').trim() || null,
        phone: (form.phone || '').trim(),
        service: (form.service || 'Reiki').trim(),
        note: (form.note || '').trim() || null,
      };
      const { error } = await supabase.rpc('book_appointment', payload);
      if (error) {
        console.error('RPC book_appointment error:', error);
        const serverText = ((error as any)?.details as string) || ((error as any)?.hint as string) || (error.message ?? '');
        const low = serverText.toLowerCase();
        const userMsg =
          low.includes('phone_required') ? 'El teléfono es obligatorio.' :
          low.includes('slot_taken')     ? 'Ese horario ya fue reservado.' :
          (low.includes('not null') && low.includes('phone')) ? 'El teléfono es obligatorio.' :
          serverText || 'No se pudo reservar. Probá nuevamente.';
        setMsg(userMsg);
        return;
      }
      const tf = therapists.find(t => t.id === tId)?.full_name || 'tu terapeuta';
      setMsg(`Tu cita con “${tf}” se agendó para ${dayjs(creating).format('dddd D [de] MMMM')} a las ${dayjs(creating).format('HH:mm')} hs.`);
      setCreating(null);
      const { data: busyData } = await supabase.rpc('get_busy_slots', { t_id: tId, day: date.format('YYYY-MM-DD') });
      setBusy((busyData || []) as BusySlot[]);
      setForm({ name: '', phone: '', service: 'Reiki', note: '' });
    } catch (e: any) {
      console.error('book() exception:', e);
      setMsg('Error de red. Verificá conexión e intenta nuevamente.');
    }
  }

  // UI
  return (
    <>
      <Header />
      {/* barra de “pasos” */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-2 flex gap-2 text-sm">
          <Step label="Agenda tu cita" active={step>=1}/>
          <Step label="Selecciona tu Terapeuta" active={step>=2}/>
          <Step label="Selecciona tu Día" active={step>=3}/>
          <Step label="Selecciona tu Hora" active={step>=4}/>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* selector de terapeuta */}
        <div className="flex items-center justify-between">
          <select
            className="border rounded-xl px-3 py-2"
            value={tId}
            onChange={e=>{ setTId(e.target.value); setStep(s=>Math.max(s,2)); }}
          >
            {therapists.map(t => <option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setViewMonth(m=>m.add(-1,'month'))}>◀︎</button>
            <div className="min-w-[10rem] text-center capitalize font-semibold">{monthLabel}</div>
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setViewMonth(m=>m.add(1,'month'))}>▶︎</button>
          </div>
        </div>

        {/* calendario compacto */}
        <div className="flex justify-center">
          <div className="w-full max-w-md border rounded-2xl p-3">
            <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-2">
              {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d,i)=>{
                const isThisMonth = d.month() === viewMonth.month();
                const isSelected = d.isSame(date,'day');
                const isToday = d.isSame(dayjs(),'day');
                return (
                  <button
                    key={i}
                    onClick={()=>{ setDate(d.startOf('day')); setStep(s=>Math.max(s,3)); }}
                    className={[
                      "h-9 rounded-xl border text-sm",
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
        </div>

        {/* horas del día */}
        <div>
          <div className="text-center mb-2">
            <div className="text-sm text-gray-500 capitalize">{date.format('dddd')}</div>
            <div className="text-lg font-semibold">{date.format('DD/MM/YYYY')}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slots.map((s:any, idx:number)=>{
              const startISO = toISO(s.toDate());
              const label = s.format('HH:mm');
              const occupied = isOccupied(startISO);
              
              // Ocultamos el slot si está ocupado
              if (occupied) {
                return null;
              }

              return (
                <button key={idx}
                  onClick={()=>{ setCreating(startISO); setStep(4); }}
                  className={`flex items-center justify-between rounded-2xl border px-3 py-3 bg-white active:scale-[.99] transition`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-green-600">Libre</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal guía inicial */}
      {step===1 && (
        <GuideModal onClose={()=>setStep(2)} />
      )}

      {/* Modal de reserva pública */}
      {creating && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Reservar — {dayjs(creating).format('dddd D [de] MMMM HH:mm')}</div>
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
    </>
  );
}

function Step({label, active}:{label:string; active:boolean}) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${active?'bg-black text-white border-black':'bg-white'}`}>
        ✓
      </div>
      <div>{label}</div>
    </div>
  );
}

function GuideModal({ onClose }:{ onClose:()=>void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-semibold">Agenda tu cita</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li>Selecciona tu Terapeuta.</li>
          <li>Elige el día en el calendario.</li>
          <li>Elige la hora disponible.</li>
          <li>Completa tu <b>teléfono</b> y confirma.</li>
        </ol>
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
