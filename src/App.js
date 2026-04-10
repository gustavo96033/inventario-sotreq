import React, { useEffect, useMemo, useRef, useState } from "react";

/* ========================= CONFIG ========================= */

const SUPABASE_URL = "https://bjegmeiknyrdvtknuehv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZWdtZWlrbnlyZHZ0a251ZWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NzkzMjAsImV4cCI6MjA5MTE1NTMyMH0.-394udQXiGWmlbUKniSwfun2Aa_uC-FHqMscMTMb5kA";

const supabase =
  typeof window !== "undefined" && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/* ========================= APP ========================= */

export default function App() {
  /* ================= AUTH ================= */

  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoadingAuth(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin() {
    setLoginError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) setLoginError(error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  /* ================= BLOQUEIO ================= */

  if (loadingAuth) {
    return <div style={{ padding: 40 }}>Carregando...</div>;
  }

  if (!user) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F172A"
      }}>
        <div style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          width: 350
        }}>
          <h2>Login</h2>

          <input
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <input
            type="password"
            placeholder="Senha"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          {loginError && <div style={{ color: "red" }}>{loginError}</div>}

          <button onClick={handleLogin} style={{ width: "100%" }}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  /* ================= SISTEMA ================= */

  return (
    <div style={{ padding: 30 }}>
      <h1>ORBISYS</h1>

      <p>Usuário logado: {user.email}</p>

      <button onClick={handleLogout}>
        Sair
      </button>

      <hr />

      <h2>Sistema funcionando 🚀</h2>
    </div>
  );
}
