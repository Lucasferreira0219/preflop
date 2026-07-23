import { useState } from "react";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

interface Props {
  onLogin: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "6px",
  color: "#f8fafc",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

export function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== password2) {
      setError("As senhas nao conferem");
      return;
    }
    if (password.length < 4) {
      setError("Senha muito curta (minimo 4 caracteres)");
      return;
    }
    setLoading(true);
    try {
      const fn = mode === "login" ? api.authLogin : api.authRegister;
      const data = await fn(username.trim(), password);
      saveAuth(data.access_token, data.user);
      onLogin();
    } catch (err) {
      if (mode === "login") setError("Usuario ou senha invalidos");
      else setError(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      padding: "1rem",
    }}>
      <div style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "2rem",
        width: "100%",
        maxWidth: "380px",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>♠</div>
          <h1 style={{ color: "#f8fafc", fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            Preflop Trainer
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {mode === "login" ? "Entre na sua conta" : "Criar nova conta"}
          </p>
        </div>

        <div style={{ display: "flex", background: "#0f172a", borderRadius: "8px", padding: "4px", marginBottom: "1.5rem" }}>
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1,
                padding: "0.5rem",
                background: mode === m ? "#3b82f6" : "transparent",
                color: mode === m ? "#fff" : "#64748b",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: "0.75rem", display: "block", marginBottom: "0.375rem" }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="seu_usuario"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ color: "#94a3b8", fontSize: "0.75rem", display: "block", marginBottom: "0.375rem" }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
          {mode === "register" && (
            <div>
              <label style={{ color: "#94a3b8", fontSize: "0.75rem", display: "block", marginBottom: "0.375rem" }}>
                Confirmar senha
              </label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                required
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
          )}
          {error && (
            <p style={{
              color: "#ef4444",
              fontSize: "0.8125rem",
              margin: 0,
              padding: "0.5rem 0.75rem",
              background: "#ef444415",
              borderRadius: "6px",
              border: "1px solid #ef444430",
            }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem",
              background: loading ? "#334155" : "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
