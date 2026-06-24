/** "Coming up next" placeholder for sections built in later phases. */
import type { JSX } from "react";
import type { Lang } from "../lib/api";
import { UI, t } from "../lib/i18n";
import { NavIcon } from "../components/NavIcons";

export default function Placeholder({
  lang,
  title,
  desc,
  icon,
}: {
  lang: Lang;
  title: string;
  desc: string;
  icon: keyof typeof NavIcon;
}): JSX.Element {
  return (
    <div className="content-narrow" lang={lang}>
      <div className="page-head">
        <h1>{title}</h1>
      </div>
      <div className="placeholder">
        <div className="ph-ic">{NavIcon[icon]}</div>
        <h2>{title} — {t(UI.coming_soon, lang)}</h2>
        <p>{desc}</p>
      </div>
    </div>
  );
}
