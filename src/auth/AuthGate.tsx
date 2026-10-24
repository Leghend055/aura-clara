import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { BrainCircuit, Eye, EyeOff, KeyRound, LoaderCircle, LogIn, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { cloudEnabled, supabase } from '../lib/supabase';
import '../index.css';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  cloudEnabled: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({ user: null, session: null, cloudEnabled: false, signOut: async () => {} });
export const useAuth = () => useContext(AuthContext);

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);
  const [recoveryMode, setRecoveryMode] = useState(false);
  useEffect(() => {
    if (!cloudEnabled || !supabase) { setLoading(false); return; }
    let alive = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventReceived = true;
      setSession(nextSession);
      setRecoveryMode(event === 'PASSWORD_RECOVERY');
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (alive && !authEventReceived) { setSession(data.session); setLoading(false); }
    }).catch(() => { if (alive && !authEventReceived) setLoading(false); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    cloudEnabled,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
  }), [session]);

  if (!cloudEnabled || !supabase) return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  if (loading) return <AuthShell><div className="auth-loading"><LoaderCircle className="auth-spinner" size={26}/><p>Preparando tu espacio de estudio…</p></div></AuthShell>;
  if (!session?.user || recoveryMode) return <AuthContext.Provider value={value}><AuthScreen key={recoveryMode ? 'password-recovery' : 'auth'} passwordRecovery={recoveryMode} onRecoveryComplete={() => setRecoveryMode(false)} /></AuthContext.Provider>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><div className="auth-background-orb auth-orb-one"/><div className="auth-background-orb auth-orb-two"/><div className="auth-shell-inner">{children}<footer className="auth-watermark">Cesar Gabriel :)</footer></div></main>;
}

function AuthScreen({ passwordRecovery = false, onRecoveryComplete }: { passwordRecovery?: boolean; onRecoveryComplete?: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'newpassword'>(passwordRecovery ? 'newpassword' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(''); setError('');
    try {
      if (mode === 'newpassword') {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage('Contraseña actualizada correctamente. Ya puedes continuar.');
        onRecoveryComplete?.();
      } else if (mode === 'signup') {
        const { error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        setMessage('Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión. Si la confirmación por correo está desactivada en Supabase, entrarás automáticamente.');
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (authError) throw authError;
        setMessage('Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la solicitud. Inténtalo de nuevo.');
    } finally { setBusy(false); }
  };

  return <AuthShell><section className="auth-card" aria-labelledby="auth-title">
    <div className="auth-brand"><span className="auth-brand-mark"><BrainCircuit size={26}/></span><span>Aura <b>Clara</b><small>UN ESPACIO PARA APRENDER</small></span></div>
    <span className="auth-eyebrow"><ShieldCheck size={14}/> TU BIBLIOTECA PERSONAL</span>
    <h1 id="auth-title">{mode === 'signup' ? 'Crea tu espacio' : mode === 'reset' ? 'Recupera el acceso' : mode === 'newpassword' ? 'Elige una nueva contraseña' : 'Qué bueno verte de nuevo'}</h1>
    <p className="auth-intro">{mode === 'signup' ? 'Crea una cuenta para guardar mapas, documentos y avances en la nube.' : mode === 'reset' ? 'Te enviaremos un enlace para establecer una nueva contraseña.' : mode === 'newpassword' ? 'Usa una contraseña segura de al menos ocho caracteres.' : 'Inicia sesión para retomar tus mapas mentales y seguir aprendiendo.'}</p>
    <form onSubmit={submit} className="auth-form">
      {mode !== 'newpassword' && <><label htmlFor="auth-email">Correo electrónico</label><div className="auth-input-wrap"><Mail size={17}/><input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" required/></div></>}
      {mode !== 'reset' && <><label htmlFor="auth-password">Contraseña</label><div className="auth-input-wrap"><KeyRound size={17}/><input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Al menos 8 caracteres" autoComplete={mode === 'signup' || mode === 'newpassword' ? 'new-password' : 'current-password'} minLength={8} required/><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></>}
      {error && <p className="auth-alert auth-alert-error" role="alert">{error}</p>}
      {message && <p className="auth-alert auth-alert-success" role="status">{message}</p>}
      <button type="submit" className="auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="auth-spinner"/> : mode === 'signup' ? <UserPlus size={17}/> : mode === 'reset' ? <Mail size={17}/> : <LogIn size={17}/>} {busy ? 'Procesando…' : mode === 'signup' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar enlace' : mode === 'newpassword' ? 'Guardar contraseña' : 'Iniciar sesión'}</button>
    </form>
    <div className="auth-links">{mode === 'login' ? <><button onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Crear cuenta</button><button onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>¿Olvidaste tu contraseña?</button></> : mode !== 'newpassword' ? <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Volver a iniciar sesión</button> : null}</div>
    <div className="auth-privacy"><ShieldCheck size={15}/><span>Tus mapas son privados. Solo tu cuenta podrá acceder a los datos asociados a ella.</span></div>
  </section></AuthShell>;
}
