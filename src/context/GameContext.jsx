import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as auth from '../services/auth';
import { newState, toggleHabit } from '../lib/game';

const Ctx = createContext(null);
export const useGame = () => useContext(Ctx);
const storeKey = (id) => `liferpg_data_${id}`;

export function GameProvider({ children }) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('liferpg_dark') !== '0');

  useEffect(() => {
    auth.getSession().then((u) => { setUser(u); setLoading(false); });
    return auth.onChange(setUser);
  }, []);

  useEffect(() => {
    if (!user) { setData(null); return; }
    const raw = localStorage.getItem(storeKey(user.id));
    setData(raw ? JSON.parse(raw) : newState(user.id));
  }, [user]);

  // Persistencia (solo si el estado pertenece al usuario actual)
  useEffect(() => {
    if (user && data && data.uid === user.id) localStorage.setItem(storeKey(user.id), JSON.stringify(data));
  }, [user, data]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('liferpg_dark', dark ? '1' : '0');
  }, [dark]);

  const update = useCallback((fn) => setData((s) => fn(s)), []);
  const toggle = useCallback((habit, photo) => setData((s) => toggleHabit(s, habit, photo)), []);

  return (
    <Ctx.Provider value={{ user, data, loading, update, toggle, editing, setEditing, dark, setDark }}>
      {children}
    </Ctx.Provider>
  );
}
