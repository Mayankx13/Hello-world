/** Admin "Engine Config" section — tabbed wrapper over the engine-params and
 *  questionnaire editors. Both apply live (no redeploy): remote PUT to the API
 *  Worker (D1) when signed in, or a localStorage override in the offline demo. */
import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "../lib/auth";
import { IS_REMOTE } from "../lib/api";
import type { Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";
import ConfigEditor from "./ConfigEditor";
import QuestionnaireEditor from "./QuestionnaireEditor";

type Tab = "engine" | "questions";

export default function EngineConfigScreen({ lang }: { lang: Lang }): JSX.Element {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("engine");

  // In the offline demo the token is a `demo:` stub; live edits are held locally.
  const remoteToken = IS_REMOTE ? token : null;

  return (
    <div className="cfg-screen">
      <div className="page-head">
        <h1>{t(UI.cfg_title, lang)}</h1>
        <p>{t(UI.cfg_sub, lang)}</p>
      </div>

      <div className="ed-tabs">
        <button type="button" className={`ed-tab${tab === "engine" ? " on" : ""}`} onClick={() => setTab("engine")}>
          {t(UI.tab_engine, lang)}
        </button>
        <button type="button" className={`ed-tab${tab === "questions" ? " on" : ""}`} onClick={() => setTab("questions")}>
          {t(UI.tab_questions, lang)}
        </button>
      </div>

      {tab === "engine"
        ? <ConfigEditor lang={lang} token={remoteToken} />
        : <QuestionnaireEditor lang={lang} token={remoteToken} />}
    </div>
  );
}
