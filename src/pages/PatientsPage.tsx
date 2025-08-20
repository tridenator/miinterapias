import { useEffect, useMemo, useState } from "react";
import dayjs from "../lib/dayjs";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import { Link } from "react-router-dom";
import ByosenSheet, { ByosenPoint } from "../components/ByosenSheet";

// --- TIPOS ---
type MedicalHistory = { allergies?: string; surgeries?: string; diagnosed_illnesses?: string; physical_problems?: string; emotional_mental_problems?: string; children?: string; partner?: string; other?: string; };
type Patient = { id: string; full_name: string; phone: string | null; email: string | null; birth_date: string | null; consultation_reason: string | null; medical_history: MedicalHistory | null; created_at: string; };
type Appointment = { id: string; start_at: string; service: string | null; note: string | null; status: string; visit_observations: string | null; byosen_points: ByosenPoint[] | null; };

// --- PÁGINA ---
export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchPatients = async (therapistId: string) => {
    const { data, error } = await supabase.from("patients").select("*").eq("therapist_id", therapistId).order("full_name", { ascending: true });
    if (error) { console.error(error); return; }
    if (data) setPatients(data as Patient[]);
  };

  const fetchAppointments = async (patientId: string) => {
    const { data, error } = await supabase.from("appointments").select("*").eq("patient_id", patientId).order("start_at", { ascending: false });
    if (error) { console.error(error); return; }
    setAppointments((data || []) as Appointment[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user?.id) {
        setUserId(user.id);
        await fetchPatients(user.id);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selectedPatient?.id) fetchAppointments(selectedPatient.id);
    else setAppointments([]);
  }, [selectedPatient?.id]);
  
  // --- NUEVO: Función para eliminar paciente ---
  const handleDeletePatient = async (patientToDelete: Patient) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar a ${patientToDelete.full_name}? Esta acción no se puede deshacer.`)) {
      try {
        const { error } = await supabase.rpc('delete_patient', { patient_id_to_delete: patientToDelete.id });
        if (error) throw error;
        
        // Refrescar la lista de pacientes
        setSelectedPatient(null);
        if (userId) await fetchPatients(userId);
      } catch (e) {
        console.error(e);
        alert("Error al eliminar el paciente.");
      }
    }
  };

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [patients, search]);

  if (loading) return <div className="p-6">Cargando…</div>;

  return (
    <div>
      <Header />
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">Mis Pacientes</h1>
          <div className="flex items-center gap-3">
            <Link to="/panel" className="text-sm underline">Volver a mi agenda</Link>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm rounded-xl border bg-blue-600 text-white hover:bg-blue-700">Nuevo Paciente</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-4 rounded-xl border">
            <div className="mb-3">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Buscar paciente…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <ul className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
              {filteredPatients.map((patient) => (
                <li key={patient.id}>
                  <button onClick={() => setSelectedPatient(patient)} className={`w-full text-left px-3 py-2 rounded-lg transition ${selectedPatient?.id === patient.id ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-gray-50"}`}>
                    {patient.full_name}
                  </button>
                </li>
              ))}
              {filteredPatients.length === 0 && (<li className="text-sm text-gray-500 p-2">No se encontraron pacientes.</li>)}
            </ul>
          </div>
          <div className="md:col-span-2">
            {selectedPatient ? (
              <PatientFile patient={selectedPatient} appointments={appointments} onEdit={() => setIsEditing(true)} onDelete={() => handleDeletePatient(selectedPatient)} onUpdateAppointments={() => fetchAppointments(selectedPatient.id)} />
            ) : (
              <div className="flex items-center justify-center h-[60vh] bg-gray-50 rounded-xl border-2 border-dashed"><p className="text-gray-500">Selecciona un paciente para ver su ficha</p></div>
            )}
          </div>
        </div>
      </div>
      {(isEditing || (!selectedPatient && patients.length === 0 && !loading)) && (
        <PatientEditModal patient={isEditing ? selectedPatient : null} therapistId={userId!} onClose={() => setIsEditing(false)} onSuccess={async (newPatient) => { setIsEditing(false); if (userId) await fetchPatients(userId); if (newPatient) setSelectedPatient(newPatient); }} />
      )}
    </div>
  );
}

// --- SUBCOMPONENTES ---
function PatientFile({ patient, appointments, onEdit, onDelete, onUpdateAppointments }: { patient: Patient; appointments: Appointment[]; onEdit: () => void; onDelete: () => void; onUpdateAppointments: () => void; }) {
  const [editing, setEditing] = useState<{ id: string; text: string; points: ByosenPoint[]; } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("appointments").update({ visit_observations: editing.text, byosen_points: editing.points }).eq("id", editing.id);
      if (error) throw error;
      setEditing(null);
      onUpdateAppointments();
    } catch (e) {
      console.error(e);
      alert("Error al guardar la consulta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{patient.full_name}</h2>
          <p className="text-sm text-gray-600">Tel: {patient.phone || "N/A"} | Email: {patient.email || "N/A"}</p>
          <p className="text-sm text-gray-600">F.N.: {patient.birth_date ? dayjs(patient.birth_date).format("DD/MM/YYYY") : "N/A"}</p>
        </div>
        <div className="flex gap-4">
            <button onClick={onEdit} className="text-sm underline">Editar Ficha</button>
            <button onClick={onDelete} className="text-sm text-red-600 hover:underline">Eliminar Ficha</button>
        </div>
      </div>
      <section className="space-y-2 text-sm">
        <h3 className="font-semibold">Motivo de la Consulta</h3>
        <p className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap">{patient.consultation_reason || "No especificado"}</p>
      </section>
      <section className="space-y-2 text-sm">
        <h3 className="font-semibold">Historial de Enfermedades o Cuestiones de Interés</h3>
        <div className="p-2 bg-gray-50 rounded-md">
          {Object.entries(patient.medical_history || {}).length === 0 && (<p className="text-gray-500">Sin datos.</p>)}
          {Object.entries(patient.medical_history || {}).map(([k, v]) => v ? (<p key={k}><b>{k.replace(/_/g, " ")}:</b> {v}</p>) : null)}
        </div>
      </section>
      <section>
        <h3 className="font-semibold mb-2">Historial de Consultas</h3>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {appointments.map((appt) => (
            <div key={appt.id} className="p-3 border rounded-lg">
              <p className="font-semibold capitalize">{dayjs(appt.start_at).format("dddd, D MMM YYYY - HH:mm [hs]")}</p>
              <p className="text-sm"><b>Servicio:</b> {appt.service || "N/A"}</p>
              <div className="mt-2">
                <h4 className="text-xs font-semibold text-gray-600">Observaciones y Lámina Byosen</h4>
                {editing?.id === appt.id ? (
                  <div className="mt-1">
                    <textarea className="w-full border rounded-md p-2 text-sm mb-2" rows={3} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                    <ByosenSheet points={editing.points || []} onPointsChange={(pts) => setEditing({ ...editing, points: pts })} />
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={handleSave} disabled={saving} className="text-xs bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
                      <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 rounded">Cancelar</button>
                      <span className="flex-1" />
                      <button onClick={() => setEditing({ ...editing, points: [] })} className="text-xs px-2 py-1 rounded border" title="Limpiar marcas">Limpiar</button>
                      <button onClick={() => setEditing({ ...editing, points: editing.points.slice(0, -1) })} className="text-xs px-2 py-1 rounded border" title="Deshacer última">Deshacer</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setEditing({ id: appt.id, text: appt.visit_observations || "", points: (appt.byosen_points as ByosenPoint[]) || [] })} className="cursor-pointer hover:bg-gray-50 rounded p-1">
                    <p className="text-sm whitespace-pre-wrap">{appt.visit_observations || (<span className="text-gray-400">Clic para añadir observaciones…</span>)}</p>
                    <ByosenSheet points={appt.byosen_points || []} isReadOnly />
                  </div>
                )}
              </div>
            </div>
          ))}
          {appointments.length === 0 && (<div className="text-sm text-gray-500 p-2">Aún no hay consultas registradas para este paciente.</div>)}
        </div>
      </section>
    </div>
  );
}

function PatientEditModal({ patient, therapistId, onClose, onSuccess }: { patient: Patient | null; therapistId: string; onClose: () => void; onSuccess: (newPatient?: Patient) => void; }) {
  const [form, setForm] = useState<Partial<Patient>>({ full_name: "", phone: "", email: "", birth_date: "", consultation_reason: "", medical_history: {} });
  const [history, setHistory] = useState<MedicalHistory>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      setForm(patient);
      setHistory(patient.medical_history || {});
    }
  }, [patient]);

  const handleSave = async () => {
    const payload = { ...form, medical_history: history, therapist_id: therapistId };
    try {
      setSaving(true);
      let data: any = null;
      let error: any = null;
      if (patient) {
        ({ data, error } = await supabase.from("patients").update(payload).eq("id", patient.id).select().single());
      } else {
        ({ data, error } = await supabase.from("patients").insert(payload).select().single());
      }
      if (error) throw error;
      onSuccess(data as Patient);
    } catch (e) {
      console.error(e);
      alert("Error al guardar la ficha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg bg-white rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">{patient ? "Editar Ficha" : "Nuevo Paciente"}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <input className="border rounded-xl px-3 py-2 col-span-2" placeholder="Nombre y Apellidos" value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input type="date" className="border rounded-xl px-3 py-2" value={form.birth_date || ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Teléfono" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="email" className="border rounded-xl px-3 py-2 col-span-2" placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={3} placeholder="Motivo de la consulta" value={form.consultation_reason || ""} onChange={(e) => setForm({ ...form, consultation_reason: e.target.value })} />
        <h3 className="font-semibold text-sm pt-1">Historial / Cuestiones de Interés</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <input className="border rounded-xl px-3 py-2" placeholder="Alergias" value={history.allergies || ""} onChange={(e) => setHistory({ ...history, allergies: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Operaciones" value={history.surgeries || ""} onChange={(e) => setHistory({ ...history, surgeries: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Enfermedades diagnosticadas" value={history.diagnosed_illnesses || ""} onChange={(e) => setHistory({ ...history, diagnosed_illnesses: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Problemas físicos" value={history.physical_problems || ""} onChange={(e) => setHistory({ ...history, physical_problems: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Problemas emocionales/mentales" value={history.emotional_mental_problems || ""} onChange={(e) => setHistory({ ...history, emotional_mental_problems: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Hijos" value={history.children || ""} onChange={(e) => setHistory({ ...history, children: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Pareja" value={history.partner || ""} onChange={(e) => setHistory({ ...history, partner: e.target.value })} />
          <input className="border rounded-xl px-3 py-2 col-span-2" placeholder="Otros" value={history.other || ""} onChange={(e) => setHistory({ ...history, other: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Cancelar</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60" onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar Ficha"}</button>
        </div>
      </div>
    </div>
  );
}
