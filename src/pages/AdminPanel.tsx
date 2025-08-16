import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Role = 'therapist' | 'admin';
type Profile = { id: string; full_name: string | null; role: Role; is_active: boolean };

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Profile[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: ok } = await supabase.rpc('is_admin', { uid: user.id as any }).catch(() => ({ data: false }));
      setIsAdmin(!!ok);
      if (ok) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_active')
          .order('full_name', { ascending: true });
        setRows((data || []) as Profile[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    const s = (r.full_name || '').toLowerCase();
    return q ? s.includes(q.toLowerCase()) || r.id.includes(q) : true;
  });

  async function setRole(id: string, role: Role) {
    setMsg('');
    const { error } = await supabase.rpc('admin_set_role', { target_user: id, new_role: role as any });
    if (error) { setMsg('No se pudo cambiar el rol'); return; }
    setRows(rs => rs.map(r => r.id === id ? { ...r, role } : r));
    setMsg('Rol actualizado');
  }

  async function toggleActive(id: string, next: boolean) {
    setMsg('');
    const { error } = await supabase.from('profiles').update({ is_active: next }).eq('id', id);
    if (error) { setMsg('No se pudo actualizar el estado'); return; }
    setRows(rs => rs.map(r => r.id === id ? { ...r, is_active: next } : r));
    setMsg(next ? 'Activado' : 'Desactivado');
  }

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!isAdmin) return <div className="p-6">Solo administradores. <a className="underline" href="/">Volver</a></div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Administración de terapeutas</h1>
        <a href="/panel" className="text-sm underline">Volver al panel</a>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Buscar por nombre o ID"
        className="w-full border rounded-xl px-3 py-2"
      />

      {msg && <div className="text-sm text-blue-700">{msg}</div>}

      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className="flex items-center justify-between border rounded-xl px-3 py-2">
            <div>
              <div className="font-medium">{r.full_name || '(sin nombre)'}</div>
              <div className="text-xs text-gray-500">{r.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full border">{r.role}</span>
              <button
                onClick={() => setRole(r.id, r.role === 'admin' ? 'therapist' : 'admin')}
                className="px-3 py-1 rounded-xl border"
              >
                {r.role === 'admin' ? 'Hacer Terapeuta' : 'Hacer Admin'}
              </button>
              <button
                onClick={() => toggleActive(r.id, !r.is_active)}
                className={`px-3 py-1 rounded-xl border ${r.is_active ? '' : 'bg-gray-100'}`}
              >
                {r.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-sm text-gray-500">No hay coincidencias.</div>}
      </div>
    </div>
  );
}
