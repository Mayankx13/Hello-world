/** Role-based app shell: sidebar nav + topbar (store switcher / user) + section. */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useAuth } from "../lib/auth";
import { getStores, IS_REMOTE } from "../lib/api";
import type { Lang, Role, Store } from "../lib/api";
import { UI, t } from "../lib/i18n";
import { Bolt, NavIcon } from "./NavIcons";
import SalesAssistant from "../screens/SalesAssistant";
import InventoryBrowser from "../screens/InventoryBrowser";
import Leaderboard from "../screens/Leaderboard";
import EngineConfigScreen from "../screens/EngineConfig";
import Placeholder from "../screens/Placeholder";

type Section = "sales" | "inventory" | "command" | "leaderboard" | "config" | "data";

interface NavDef { id: Section; roles: Role[]; icon: keyof typeof NavIcon; label: keyof typeof UI }
const NAV: NavDef[] = [
  { id: "sales", roles: ["admin", "manager", "salesperson"], icon: "sales", label: "nav_sales" },
  { id: "inventory", roles: ["admin", "manager", "salesperson"], icon: "inventory", label: "nav_inventory" },
  { id: "command", roles: ["admin"], icon: "command", label: "nav_command" },
  { id: "leaderboard", roles: ["admin", "manager", "salesperson"], icon: "leaderboard", label: "nav_leaderboard" },
  { id: "config", roles: ["admin"], icon: "config", label: "nav_config" },
  { id: "data", roles: ["admin"], icon: "data", label: "nav_data" },
];
const DEFAULT_SECTION: Record<Role, Section> = { admin: "command", manager: "inventory", salesperson: "sales" };

export default function Shell({ lang, onToggleLang }: { lang: Lang; onToggleLang: () => void }): JSX.Element {
  const { user, logout } = useAuth();
  const role = user!.role;
  const items = NAV.filter((n) => n.roles.includes(role));
  const [section, setSection] = useState<Section>(DEFAULT_SECTION[role]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(user!.storeId);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    getStores().then(setStores).catch(() => {});
  }, []);

  const isAdmin = role === "admin";
  const activeStoreId = isAdmin ? selectedStoreId : user!.storeId;
  const concreteStoreId = activeStoreId ?? stores[0]?.id ?? "";
  const currentStore = useMemo(
    () => stores.find((s) => s.id === concreteStoreId),
    [stores, concreteStoreId],
  );
  const storeLabel = currentStore?.label ?? currentStore?.name ?? concreteStoreId;
  const initials = user!.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  function go(s: Section) {
    setSection(s);
    setNavOpen(false);
  }

  let body: JSX.Element;
  switch (section) {
    case "sales":
      body = <SalesAssistant lang={lang} storeId={concreteStoreId} stores={stores} />;
      break;
    case "inventory":
      body = <InventoryBrowser lang={lang} storeId={concreteStoreId} storeLabel={storeLabel} />;
      break;
    case "leaderboard":
      body = <Leaderboard lang={lang} user={user!} />;
      break;
    case "command":
      body = <Placeholder lang={lang} title={t(UI.nav_command, lang)} icon="command"
        desc="North-star items-per-bill, store comparison, dead-stock and inventory health across all stores — arriving next." />;
      break;
    case "config":
      body = <EngineConfigScreen lang={lang} />;
      break;
    default:
      body = <Placeholder lang={lang} title={t(UI.nav_data, lang)} icon="data"
        desc="Connect the BUSY / SQL Server feed, map columns, and preview the hourly sync into the live snapshot." />;
  }

  return (
    <div className="layout">
      <div className={`scrim${navOpen ? " show" : ""}`} onClick={() => setNavOpen(false)} aria-hidden="true" />
      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <div className="brand">
          <span className="mark"><Bolt /></span>
          <span className="name">LIQO<small>Retail Intelligence</small></span>
        </div>
        <nav className="nav" aria-label="Sections">
          {items.map((n) => (
            <button key={n.id} type="button" className={`nav-item${section === n.id ? " on" : ""}`}
              aria-current={section === n.id ? "page" : undefined} onClick={() => go(n.id)}>
              {NavIcon[n.icon]} {t(UI[n.label], lang)}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="led" /> v0.1 · {IS_REMOTE ? t(UI.busy_connected, lang) : t(UI.offline_badge, lang)}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-btn" aria-label="Menu" onClick={() => setNavOpen((v) => !v)}>
              {NavIcon.menu}
            </button>
          </div>
          <div className="topbar-right">
            {isAdmin ? (
              <span className="store-select">
                <span className="pin" aria-hidden="true">◉</span>
                <select aria-label={t(UI.lb_store, lang)} value={selectedStoreId ?? ""}
                  onChange={(e) => setSelectedStoreId(e.target.value || null)}>
                  <option value="">{t(UI.all_stores, lang)}</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </span>
            ) : (
              <span className="store-select"><span className="pin" aria-hidden="true">◉</span> {storeLabel}</span>
            )}
            <button type="button" className="lang-pill" aria-pressed={lang === "hi"} onClick={onToggleLang}>
              {lang === "en" ? <><b>EN</b> | हिं</> : <>EN | <b>हिं</b></>}
            </button>
            <div className="usr">
              <span className="av">{initials}</span>
              <span className="who"><b>{user!.name}</b><small>{t(roleLabel(role), lang)}</small></span>
              <button type="button" className="out" onClick={logout}>{t(UI.sign_out, lang)}</button>
            </div>
          </div>
        </header>
        <main className="content">{body}</main>
      </div>
    </div>
  );
}

function roleLabel(role: Role) {
  return role === "admin" ? UI.role_admin : role === "manager" ? UI.role_manager : UI.role_salesperson;
}
