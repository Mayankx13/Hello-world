import { ImageResponse } from "next/og";
import { site, hero } from "@/lib/content";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FRAUNCES_TTF =
  "https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDg.ttf";

async function loadFraunces() {
  try {
    const res = await fetch(FRAUNCES_TTF);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const fraunces = await loadFraunces();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAF7F0",
          color: "#1A1A1A",
          padding: "72px 80px",
          fontFamily: fraunces ? "Fraunces" : "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div style={{ fontSize: 44 }}>{site.name}</div>
          <div style={{ fontSize: 22, color: "#5C5850" }}>{site.tagline}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 36,
          }}
        >
          <div
            style={{
              width: 88,
              height: 4,
              background: "#B3552D",
            }}
          />
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.08,
              letterSpacing: "-0.015em",
              maxWidth: 980,
            }}
          >
            {hero.headline}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#8F421F",
          }}
        >
          {hero.kicker}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fraunces
        ? [{ name: "Fraunces", data: fraunces, style: "normal", weight: 500 }]
        : undefined,
    }
  );
}
