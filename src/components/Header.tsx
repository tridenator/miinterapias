import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

type Profile = {
  full_name: string;
};

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Esta función se encarga de obtener toda la información del usuario
    const fetchUserData = async (currentUser: User | null) => {
      if (currentUser) {
        setUser(currentUser);

        // 1. Obtenemos el nombre del perfil
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUser.id)
          .single();
        setProfile(profileData);

        // 2. Verificamos si es admin
        const { data: adminStatus } = await supabase.rpc('is_admin');
        setIsAdmin(Boolean(adminStatus));
      } else {
        // Si no hay usuario, reseteamos los estados
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    };

    // Obtenemos la sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user ?? null);
    });

    // Y nos suscribimos a los cambios de sesión (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserData(session?.user ?? null);
    });

    // Limpiamos la suscripción al desmontar el componente
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // No mostramos nada mientras carga para evitar parpadeos
  if (loading) {
    return (
        <header className="w-full border-b bg-white">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                <h1 className="text-lg sm:text-xl font-semibold">Agenda de Terapias Reiki</h1>
            </div>
        </header>
    );
  }

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Agenda de Terapias Reiki</h1>
        
        {/* Usamos el estado del perfil para mostrar el nombre */}
        <div className="flex items-center gap-4 text-sm">
          {profile?.full_name ? (
            <>
              <span>Terapeuta: <b>{profile.full_name}</b></span>
              {isAdmin && (
                <a href="/panel" className="font-medium text-blue-600 hover:underline">
                  Panel Admin
                </a>
              )}
              <button className="underline" onClick={() => supabase.auth.signOut()}>
                Cerrar sesión
              </button>
            </>
          ) : (
            // Este link solo se vería si el usuario está logueado pero no tiene perfil
            <a href="/login" className="underline">Ingresar</a>
          )}
        </div>
      </div>
    </header>
  );
}
