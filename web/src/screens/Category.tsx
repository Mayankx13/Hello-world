/**
 * Category picker. Tiles are driven from getQuestionnaire().categories so the
 * order/labels follow the data; each tile uses the prototype's SVG icon.
 */
import type { JSX } from "react";
import type { Lang, Questionnaire } from "../lib/api";
import type { Category as Cat } from "../state";
import { UI, t } from "../lib/i18n";
import { CategoryIcon, CATEGORY_ICON } from "../components/Icons";

export interface CategoryProps {
  lang: Lang;
  questionnaire: Questionnaire;
  onPick: (category: Cat) => void;
  onBack: () => void;
}

export default function Category({
  lang,
  questionnaire,
  onPick,
  onBack,
}: CategoryProps): JSX.Element {
  const entries = Object.entries(questionnaire.categories);

  return (
    <>
      <div className="eyebrow">{t(UI.step_category, lang)}</div>
      <h2>{t(UI.category_title, lang)}</h2>
      <div className="tiles">
        {entries.map(([key, cat]) => {
          const icon = CATEGORY_ICON[key] ?? "ac";
          return (
            <button
              key={key}
              type="button"
              className="tile"
              onClick={() => onPick(key as Cat)}
            >
              <CategoryIcon icon={icon} />
              <div className="t-name">{t(cat.label, lang)}</div>
              <div className="t-sub">{t(cat.sub, lang)}</div>
            </button>
          );
        })}
      </div>
      <div className="navrow">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {t(UI.back, lang)}
        </button>
        <span />
      </div>
    </>
  );
}
