import { useEffect, useState } from 'react';
import dayjs from '../lib/dayjs';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import { Link } from 'react-router-dom';

// --- TIPOS ---
type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
};
type Appointment = {
  id: string;
  start_at: string;
  service: string | null;
  note: string | null;
  status: string;
};

// --- COMPONENTE PRINCIPAL DE LA PÁGINA ---
export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Primero, obtenemos el ID del terapeuta logueado
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        // Luego, cargamos la lista de sus pacientes
        const { data: patientData } = await supabase
          .from('patients')
          .select('*')
          .eq('therapist_id', user.id)
          .order('full_name');
        if (patientData) {
          setPatients(patientData);
        }
      }
      setLoading(false);
    });
  }, []);

  // Efecto para cargar las citas cuando se selecciona un paciente
  useEffect(() => {
    if (selectedPatient) {
      (async () => {
        const { data } = await supabase
          .from('appointments')
          .select('id, start_at, service, note, status')
          .eq('patient_id', selectedPatient.id)
          .order('start_at', { ascending: false }); // Las más recientes primero
        if (data) {
          setAppointments(data);
        }
      })();
    }
  }, [selectedPatient]);

  if (loading) {
    return <div>Cargando pacientes...</div>;
  }

  return (
    <div>
      <Header />
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Mis Pacientes</h1>
          <Link to="/panel" className="text-sm underline">Volver a mi agenda</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Columna de la lista de pacientes */}
          <div className="md:col-span-1 bg-white p-4 rounded-xl border">
            <h2 className="font-semibold mb-2">Seleccionar Paciente</h2>
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {patients.map(patient => (
                <li key={patient.id}>
                  <button
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full text-left p-2 rounded-lg ${selectedPatient?.id === patient.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50'}`}
                  >
                    {patient.full_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna del historial del paciente seleccionado */}
          <div className="md:col-span-2">
            {selectedPatient ? (
              <div className="bg-white p-4 rounded-xl border">
                <h2 className="text-xl font-bold mb-1">{selectedPatient.full_name}</h2>
                <p className="text-sm text-gray-600 mb-4">Teléfono: {selectedPatient.phone || 'No especificado'}</p>
                <h3 className="font-semibold mb-2">Historial de Consultas</h3>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {appointments.length > 0 ? (
                    appointments.map(appt => (
                      <div key={appt.id} className="p-3 border rounded-lg bg-gray-50">
                        <p className="font-semibold capitalize">{dayjs(appt.start_at).format('dddd, D [de] MMMM [de] YYYY - HH:mm [hs]')}</p>
                        <p className="text-sm"><b>Servicio:</b> {appt.service || 'No especificado'}</p>
                        {appt.note && <p className="text-sm mt-1"><b>Nota:</b> {appt.note}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Este paciente aún no tiene citas registradas.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border-2 border-dashed">
                <p className="text-gray-500">Selecciona un paciente para ver su historial</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
