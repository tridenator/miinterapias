import { useEffect, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import { Link } from 'react-router-dom';

// --- TIPOS ---
type ByosenPoint = { x: number; y: number; view: 'front' | 'side' | 'back' }; // <-- Vista añadida
type MedicalHistory = {
  allergies?: string;
  surgeries?: string;
  diagnosed_illnesses?: string;
  physical_problems?: string;
  emotional_mental_problems?: string;
  children?: string;
  partner?: string;
  other?: string;
};
type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  consultation_reason: string | null;
  medical_history: MedicalHistory | null;
  created_at: string;
};
type Appointment = {
  id: string;
  start_at: string;
  service: string | null;
  note: string | null;
  status: string;
  visit_observations: string | null;
  byosen_points: ByosenPoint[] | null;
};

// --- COMPONENTE PRINCIPAL ---
export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchPatients = async (therapistId: string) => {
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('full_name');
    if (data) setPatients(data);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchPatients(user.id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('start_at', { ascending: false })
        .then(({ data }) => {
          if (data) setAppointments(data as Appointment[]);
        });
    } else {
      setAppointments([]);
    }
  }, [selectedPatient]);

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <Header />
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Mis Pacientes</h1>
          <div>
            <button onClick={() => setIsEditing(true)} className="mr-4 px-4 py-2 text-sm rounded-xl border bg-blue-500 text-white hover:bg-blue-600">
              Nuevo Paciente
            </button>
            <Link to="/panel" className="text-sm underline">Volver a mi agenda</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-4 rounded-xl border">
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {patients.map(patient => (
                <li key={patient.id}>
                  <button
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full text-left p-2 rounded-lg ${selectedPatient?.id === patient.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-50'}`}
                  >
                    {patient.full_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            {selectedPatient ? (
              <PatientFile 
                patient={selectedPatient} 
                appointments={appointments}
                onEdit={() => setIsEditing(true)}
                onUpdateAppointments={async () => {
                  const { data } = await supabase.from('appointments').select('*').eq('patient_id', selectedPatient.id).order('start_at', { ascending: false });
                  if (data) setAppointments(data as Appointment[]);
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border-2 border-dashed">
                <p className="text-gray-500">Selecciona un paciente para ver su ficha</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {(isEditing || !selectedPatient && patients.length === 0 && !loading) && (
        <PatientEditModal
          patient={isEditing ? selectedPatient : null}
          therapistId={userId!}
          onClose={() => setIsEditing(false)}
          onSuccess={async (newPatient) => {
            setIsEditing(false);
            await fetchPatients(userId!);
            if (newPatient) {
              setSelectedPatient(newPatient);
            }
          }}
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENTES ---

function PatientFile({ patient, appointments, onEdit, onUpdateAppointments }: { patient: Patient; appointments: Appointment[]; onEdit: () => void; onUpdateAppointments: () => void }) {
  const [editingObservation, setEditingObservation] = useState<{id: string, text: string, points: ByosenPoint[] } | null>(null);

  const handleSaveObservation = async () => {
    if (!editingObservation) return;
    await supabase
      .from('appointments')
      .update({ 
        visit_observations: editingObservation.text,
        byosen_points: editingObservation.points 
      })
      .eq('id', editingObservation.id);
    setEditingObservation(null);
    onUpdateAppointments();
  };

  return (
    <div className="bg-white p-4 rounded-xl border space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold">{patient.full_name}</h2>
          <p className="text-sm text-gray-600">Tel: {patient.phone || 'N/A'} | Email: {patient.email || 'N/A'}</p>
          <p className="text-sm text-gray-600">F.N.: {patient.birth_date ? dayjs(patient.birth_date).format('DD/MM/YYYY') : 'N/A'}</p>
        </div>
        <button onClick={onEdit} className="text-sm underline">Editar Ficha</button>
      </div>
      <div className="space-y-2 text-sm">
        <h3 className="font-semibold">Motivo de la Consulta</h3>
        <p className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap">{patient.consultation_reason || 'No especificado'}</p>
      </div>
      <div className="space-y-2 text-sm">
        <h3 className="font-semibold">Historial de Enfermedades o Cuestiones de Interés</h3>
        <div className="p-2 bg-gray-50 rounded-md">
          {Object.entries(patient.medical_history || {}).map(([key, value]) => value ? <p key={key}><b>{key.replace(/_/g, ' ')}:</b> {value}</p> : null)}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-2">Historial de Consultas</h3>
        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
          {appointments.map(appt => (
            <div key={appt.id} className="p-3 border rounded-lg">
              <p className="font-semibold capitalize">{dayjs(appt.start_at).format('dddd, D MMM YYYY - HH:mm [hs]')}</p>
              <p className="text-sm"><b>Servicio:</b> {appt.service || 'N/A'}</p>
              <div className="mt-2">
                <h4 className="text-xs font-semibold text-gray-600">Observaciones y Lámina Byosen:</h4>
                {editingObservation?.id === appt.id ? (
                  <div>
                    <textarea 
                      className="w-full border rounded-md p-1 text-sm mb-2"
                      value={editingObservation.text}
                      onChange={(e) => setEditingObservation({ ...editingObservation, text: e.target.value })}
                    />
                    <ByosenChart points={editingObservation.points} onPointsChange={(newPoints) => setEditingObservation({...editingObservation, points: newPoints})} />
                    <button onClick={handleSaveObservation} className="text-xs bg-blue-500 text-white px-2 py-1 rounded mt-2">Guardar</button>
                    <button onClick={() => setEditingObservation(null)} className="text-xs ml-2">Cancelar</button>
                  </div>
                ) : (
                  <div onClick={() => setEditingObservation({id: appt.id, text: appt.visit_observations || '', points: appt.byosen_points || []})} className="cursor-pointer hover:bg-gray-50 rounded p-1">
                    <p className="text-sm whitespace-pre-wrap">
                      {appt.visit_observations || <span className="text-gray-400">Clic para añadir observaciones...</span>}
                    </p>
                    <ByosenChart points={appt.byosen_points || []} isReadOnly />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- MODIFICADO: Componente ByosenChart con vistas ---
function ByosenChart({ points, onPointsChange, isReadOnly = false }: { points: ByosenPoint[], onPointsChange?: (points: ByosenPoint[]) => void, isReadOnly?: boolean }) {
  const [view, setView] = useState<'front' | 'side' | 'back'>('front');

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isReadOnly || !onPointsChange) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const existingPoint = points.find(p => p.view === view && Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2);
    if (existingPoint) {
      onPointsChange(points.filter(p => p !== existingPoint));
    } else {
      onPointsChange([...points, { x, y, view }]);
    }
  };

  const views = {
    front: <path d="M50,8.3C40.6,8.3,33,16.2,33,26.1c0,9.9,7.6,17.9,17,17.9s17-7.9,17-17.9C67,16.2,59.4,8.3,50,8.3z M50,47.8 c-1.8,0-3.5-0.3-5.1-0.8L45,47.2V52h10v-4.8l0.1,0.2c-1.6,0.5-3.3,0.8-5.1,0.8z M41.5,55.8v31.9l-6.7,44.2l-2.5,16.8h7.5 l2.5-18.8l4.2-28.1h5v-30H41.5z M58.5,55.8v30h-5v30h4.2l-2.5,18.8h7.5l-2.5-16.8l-6.7-44.2V55.8H58.5z"/>,
    side: <path d="M50,8.3c-4.6,0-8.8,1.8-11.9,4.8c-3.1,3-4.8,7.2-4.8,11.9c0,9.9,7.6,17.9,17,17.9c1.8,0,3.5-0.3,5.1-0.8 c-0.5-1.5-0.8-3.1-0.8-4.8c0-4.6,1.8-8.8,4.8-11.9C62.8,14.6,56.7,8.3,50,8.3z M45,47.2V52h2.5v30h-2.5v4.8l-2.5,16.8v18.8h5 v-18.8l-2.5-16.8V82h2.5V52H45z"/>,
    back: <path d="M50,8.3C40.6,8.3,33,16.2,33,26.1c0,9.9,7.6,17.9,17,17.9s17-7.9,17-17.9C67,16.2,59.4,8.3,50,8.3z M50,47.8 c-1.8,0-3.5-0.3-5.1-0.8L45,47.2V52h10v-4.8l0.1,0.2c-1.6,0.5-3.3,0.8-5.1,0.8z M41.5,55.8v31.9l-6.7,44.2l-2.5,16.8h7.5 l2.5-18.8l4.2-28.1h5v-30H41.5z M58.5,55.8v30h-5v30h4.2l-2.5,18.8h7.5l-2.5-16.8l-6.7-44.2V55.8H58.5z"/>
  };

  return (
    <div className="my-2">
      <div className="flex justify-center border-b mb-1">
        {(['front', 'side', 'back'] as const).map(v => (
          <button 
            key={v} 
            onClick={() => !isReadOnly && setView(v)}
            disabled={isReadOnly}
            className={`px-3 py-1 text-xs capitalize ${view === v ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}
          >
            {v === 'front' ? 'Frente' : v === 'side' ? 'Lado' : 'Espalda'}
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <svg viewBox="0 0 100 180" onClick={handleClick} className={`w-48 bg-gray-50 rounded ${isReadOnly ? '' : 'cursor-crosshair'}`}>
          {views[view]}
          {points.filter(p => p.view === view).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2" fill="red" />
          ))}
        </svg>
      </div>
    </div>
  );
}


function PatientEditModal({ patient, therapistId, onClose, onSuccess }: { patient: Patient | null; therapistId: string; onClose: () => void; onSuccess: (newPatient?: Patient) => void; }) {
  const [form, setForm] = useState<Partial<Patient>>({
    full_name: '', phone: '', email: '', birth_date: '', consultation_reason: '', medical_history: {}
  });
  const [history, setHistory] = useState<MedicalHistory>({});

  useEffect(() => {
    if (patient) {
      setForm(patient);
      setHistory(patient.medical_history || {});
    }
  }, [patient]);

  const handleSave = async () => {
    const payload = { ...form, medical_history: history, therapist_id: therapistId };
    const { data, error } = patient 
      ? await supabase.from('patients').update(payload).eq('id', patient.id).select().single()
      : await supabase.from('patients').insert(payload).select().single();
    
    if (error) alert('Error al guardar: ' + error.message);
    else onSuccess(data as Patient);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl p-5 space-y-3 my-8">
        <h2 className="text-lg font-semibold">{patient ? 'Editar Ficha' : 'Nuevo Paciente'}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
            <input className="border rounded-xl px-3 py-2" placeholder="Nombre y Apellidos" value={form.full_name || ''} onChange={e=>setForm({...form, full_name: e.target.value})} />
            <input type="date" className="border rounded-xl px-3 py-2" value={form.birth_date || ''} onChange={e=>setForm({...form, birth_date: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Teléfono" value={form.phone || ''} onChange={e=>setForm({...form, phone: e.target.value})} />
            <input type="email" className="border rounded-xl px-3 py-2" placeholder="Email" value={form.email || ''} onChange={e=>setForm({...form, email: e.target.value})} />
        </div>
        <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={3} placeholder="Motivo de la consulta" value={form.consultation_reason || ''} onChange={e=>setForm({...form, consultation_reason: e.target.value})} />
        <h3 className="font-semibold text-sm pt-2">Historial / Cuestiones de Interés</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <input className="border rounded-xl px-3 py-2" placeholder="Alergias" value={history.allergies || ''} onChange={e=>setHistory({...history, allergies: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Operaciones" value={history.surgeries || ''} onChange={e=>setHistory({...history, surgeries: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Enfermedades diagnosticadas" value={history.diagnosed_illnesses || ''} onChange={e=>setHistory({...history, diagnosed_illnesses: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Problemas físicos" value={history.physical_problems || ''} onChange={e=>setHistory({...history, physical_problems: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Problemas emocionales/mentales" value={history.emotional_mental_problems || ''} onChange={e=>setHistory({...history, emotional_mental_problems: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Hijos" value={history.children || ''} onChange={e=>setHistory({...history, children: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Pareja" value={history.partner || ''} onChange={e=>setHistory({...history, partner: e.target.value})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Otros" value={history.other || ''} onChange={e=>setHistory({...history, other: e.target.value})} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Cancelar</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={handleSave}>Guardar Ficha</button>
        </div>
      </div>
    </div>
  );
}
