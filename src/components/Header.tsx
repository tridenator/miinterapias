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
    const fetchUserData = async (currentUser: User | null) => {
      if (currentUser) {
        setUser(currentUser);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUser.id)
          .single();
        setProfile(profileData);
        const { data: adminStatus } = await supabase.rpc('is_admin');
        setIsAdmin(Boolean(adminStatus));
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserData(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserData(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Función para renderizar la sección del usuario de forma clara
  const renderUserSection = () => {
    if (loading) {
      return <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />; // Muestra un placeholder mientras carga
    }

    if (user) {
      // Si el usuario está logueado
      return (
        <>
          <span>
            <b>{profile?.full_name || user.email}</b>
          </span>
          {isAdmin && (
            <a href="/panel/admin" className="font-medium text-blue-600 hover:underline">
              Panel Admin
            </a>
          )}
          <a href="/panel" className="font-medium text-gray-700 hover:underline">
            Mi Panel
          </a>
          <button className="underline" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </>
      );
    } else {
      // Si el usuario no está logueado
      return <a href="/login" className="underline">Ingresar</a>;
    }
  };

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Agenda de Terapias Reiki</h1>
        <div className="flex items-center gap-4 text-sm">
          {renderUserSection()}
        </div>
      </div>
    </header>
  );
}
