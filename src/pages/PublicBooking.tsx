import { useEffect, useMemo, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

// --- TIPOS ---
type Therapist = { id: string; full_name: string; color: string | null };
type BusySlot = { start_at: string; end_at: string; status: string };
type SuccessInfo = { therapistName: string; date: string; time: string };


const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const agendaColorStyles: { [key: string]: { bg: string; border: string } } = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-400' },
    green:  { bg: 'bg-green-50',  border: 'border-green-400' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400' },
    pink:   { bg: 'bg-pink-50',   border: 'border-pink-400' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-400' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-400' },
    gray:   { bg: 'bg-gray-50',  border: 'border-gray-200' },
};

function toISO(d: Date){ return d.toISOString(); }
function range30(start: any, end: any){
  const slots: any[] = []; let cur = start.clone();
  while(cur.isBefore(end)){ slots.push(cur); cur = cur.add(30,'minute'); }
  return slots;
}

export default function PublicBooking(){
  const [step, setStep] = useState<number>(1);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [tId, setTId] = useState<string>('');

  const [viewMonth, setViewMonth] = useState(()=>dayjs().startOf('month'));
  const monthLabel = viewMonth.format('MMMM YYYY');
  const first = viewMonth.startOf('month');
  const dowMon0 = (first.day() + 6) % 7;
  const gridStart = first.subtract(dowMon0, 'day');
  const days = useMemo(()=>Array.from({length: 42}, (_,i)=>gridStart.add(i,'day')), [gridStart]);

  const [date, setDate] = useState(()=>dayjs().startOf('day'));
  const dayStart = useMemo(()=>date.hour(8).minute(0).second(0), [date]);
  const dayEnd   = useMemo(()=>date.hour(20).minute(0).second(0), [date]);
  const slots = useMemo(()=>range30(dayStart, dayEnd), [dayStart, dayEnd]);

  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [creating, setCreating] = useState<string|null>(null);
  const [form, setForm] = useState({ name:'', phone:'', service:'Reiki', note:'' });
  const [msg, setMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  useEffect(()=>{
    (async ()=>{
      const { data } = await supabase.rpc('list_therapists');
      if(data){
        setTherapists(data as Therapist[]);
      }
    })();
  },[]);

  useEffect(()=>{
    if(!tId) {
      setBusy([]);
      return;
    };
    (async ()=>{
      const { data } = await supabase.rpc('get_all_busy_slots', { day: date.format('YYYY-MM-DD') });
      setBusy((data||[]) as BusySlot[]);
    })();
  },[tId, date]);

  function isOccupied(iso: string){
    const currentSlot = dayjs(iso);
    return busy.some(appointment => {
      const appointmentStart = dayjs(appointment.start_at);
      const blockStart = appointmentStart.subtract(60, 'minutes');
      const blockEnd = appointmentStart.add(90, 'minutes');
      return currentSlot.isSame(blockStart) || (currentSlot.isAfter(blockStart) && currentSlot.isBefore(blockEnd));
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
      const { error } = await supabase.rpc('book_appointment_with_phone_check', payload);
      if (error) {
        const serverText = ((error as any)?.details as string) || ((error as any)?.hint as string) || (error.message ?? '');
        const low = serverText.toLowerCase();
        const userMsg =
          low.includes('phone_required') ? 'El teléfono es obligatorio.' :
          low.includes('slot_taken')     ? 'Ese horario ya fue reservado.' :
          serverText || 'No se pudo reservar. Probá nuevamente.';
        setMsg(userMsg);
        return;
      }

      const tf = therapists.find(t => t.id === tId)?.full_name || 'tu terapeuta';
      setSuccessInfo({
        therapistName: tf,
        date: dayjs(creating).format('dddd D [de] MMMM'),
        time: dayjs(creating).format('HH:mm'),
      });
      setCreating(null);
      const { data: busyData } = await supabase.rpc('get_all_busy_slots', { day: date.format('YYYY-MM-DD') });
      setBusy((busyData || []) as BusySlot[]);
      setForm({ name: '', phone: '', service: 'Reiki', note: '' });

    } catch (e: any) {
      console.error('book() exception:', e);
      setMsg('Error de red. Verificá conexión e intenta nuevamente.');
    }
  }
  
  const selectedTherapist = useMemo(() => therapists.find(t => t.id === tId), [therapists, tId]);

  return (
    <>
      <Header />
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-2 flex gap-2 sm:gap-4 text-sm flex-wrap">
          <Step label="Selecciona Terapeuta" active={step>=1}/>
          <Step label="Selecciona Día" active={step>=2}/>
          <Step label="Selecciona Hora" active={step>=3}/>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <select
            className="border rounded-xl px-3 py-2"
            value={tId}
            onChange={e=>{ setTId(e.target.value); setStep(2); }}
          >
            <option value="" disabled>Seleccione su terapeuta</option>
            {therapists.map(t => <option key={t.id} value={t.id}>{t.full_name || 'Terapeuta'}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setViewMonth(m=>m.add(-1,'month'))}>◀︎</button>
            <div className="min-w-[10rem] text-center capitalize font-semibold">{monthLabel}</div>
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setViewMonth(m=>m.add(1,'month'))}>▶︎</button>
          </div>
        </div>

        <div className={`transition-opacity duration-300 ${step < 2 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
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
                                onClick={()=>{ setDate(d.startOf('day')); setStep(3); }}
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
        </div>

        <div className={`transition-opacity duration-300 ${step < 3 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="text-center mb-2">
            <div className="text-sm text-gray-500 capitalize">{date.format('dddd')}</div>
            <div className="text-lg font-semibold">{date.format('DD/MM/YYYY')}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slots.map((s:any, idx:number)=>{
              const startISO = toISO(s.toDate());
              const label = s.format('HH:mm');
              const occupied = isOccupied(startISO);
              if (occupied) return null;
              
              const colorName = selectedTherapist?.color || 'gray';
              const style = agendaColorStyles[colorName] || agendaColorStyles.gray;

              return (
                <button key={idx}
                  onClick={()=>{ setCreating(startISO); setStep(4); }}
                  className={`flex items-center justify-between rounded-2xl border-2 px-3 py-3 transition active:scale-[.99] ${style.bg} ${style.border}`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-green-600">Libre</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {step < 2 && <GuideModal onClose={()=>setStep(2)} />}

      {creating && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Reservar — {dayjs(creating).format('dddd D [de] MMMM HH:mm')}</div>
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Tu nombre (obligatorio)" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Teléfono (obligatorio, solo números)" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value.replace(/\D/g, '')})} />
            <input className="w-full border rounded-xl px-3 py-2" placeholder="Servicio (ej. Reiki)" value={form.service} onChange={e=>setForm({...form, service: e.target.value})} />
            <textarea className="w-full border rounded-xl px-3 py-2" placeholder="Nota (opcional)" value={form.note} onChange={e=>setForm({...form, note: e.target.value})} />
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-xl border" onClick={()=>setCreating(null)}>Cancelar</button>
              <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={book}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      
      {successInfo && (
        <SuccessModal info={successInfo} onClose={() => setSuccessInfo(null)} />
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

function SuccessModal({ info, onClose }: { info: SuccessInfo, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 text-center">
        <h2 className="text-lg font-semibold">¡Cita Agendada!</h2>
        <p className="text-sm text-gray-700">
          Te has agendado para el día <b className="capitalize">{info.date}</b> a las <b>{info.time} hs</b> con <b>{info.therapistName}</b>.
        </p>
        <p className="text-sm text-gray-700">
          Nos comunicaremos contigo para recordarte y confirmar asistencia. Gracias.
        </p>
        <div className="flex justify-center">
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
