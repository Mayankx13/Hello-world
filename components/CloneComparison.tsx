"use client";

import { useState } from "react";
import { proof } from "@/lib/content";
import Reveal from "@/components/Reveal";
import ReelFrame from "@/components/ReelFrame";

/**
 * "Real vs clone" challenge: pick which reel is generated. The pick
 * highlights the actual clone and reveals the verdict copy.
 */
export default function CloneComparison() {
  const { rvc } = proof;
  const [picked, setPicked] = useState<"A" | "B" | null>(null);

  const revealed = picked !== null;
  const verdict =
    picked === rvc.cloneIs ? rvc.verdictCorrect : rvc.verdictWrong;

  return (
    <Reveal className={`rvc${revealed ? " is-revealed" : ""}`}>
      <span className="kicker">{rvc.kicker}</span>
      <h3 className="display-lg">{rvc.heading}</h3>
      <p className="rvc-sub">{rvc.sub}</p>
      <div className="rvc-pair">
        {rvc.cards.map((card) => {
          const isPicked = picked === card.id;
          const isCloneRevealed = revealed && card.id === rvc.cloneIs;
          return (
            <div
              key={card.id}
              className={`rvc-card${isPicked ? " is-picked" : ""}${
                isCloneRevealed ? " is-clone-revealed" : ""
              }`}
            >
              <ReelFrame
                caption={card.caption}
                duration={card.duration}
                placeholder={card.placeholder}
                poster={card.poster}
                video={card.video}
                sizes="(max-width: 560px) 50vw, 300px"
              />
              <button
                className="pick-btn"
                type="button"
                onClick={() => setPicked(card.id)}
              >
                {card.pick}
              </button>
            </div>
          );
        })}
      </div>
      <div className="rvc-reveal" aria-live="polite">
        {revealed && (
          <>
            <p className="verdict">{verdict.heading}</p>
            <p>{verdict.body}</p>
          </>
        )}
      </div>
      <p className="rvc-note">{rvc.note}</p>
    </Reveal>
  );
}
