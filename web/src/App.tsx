/**
 * LIQO root — auth gate. Unauthenticated → Login; authenticated → the
 * role-based Shell (Sales Assistant · Inventory · Command Centre · Leaderboard
 * · Engine Config · Data & Import). Language is held here and shared down.
 */
import { useState } from "react";
import type { JSX } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import type { Lang } from "./lib/api";
import Login from "./screens/Login";
import Shell from "./components/Shell";
import "./styles.css";
import "./app.css";

export default function App(): JSX.Element {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  );
}

function Root(): JSX.Element {
  const { user, loading } = useAuth();
  const [lang, setLang] = useState<Lang>("en");
  const toggleLang = () => setLang((l) => (l === "en" ? "hi" : "en"));

  if (loading) return <div className="loading">…</div>;
  if (!user) return <Login lang={lang} onToggleLang={toggleLang} />;
  return <Shell lang={lang} onToggleLang={toggleLang} />;
}
