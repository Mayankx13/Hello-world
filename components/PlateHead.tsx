"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Section header: accent plate number, uppercase label, hairline rule.
 * The plate number gets a small rise-in transition as the section
 * scrolls into view (Framer Motion; disabled under reduced motion).
 */
export default function PlateHead({
  num,
  label,
}: {
  num: string;
  label: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="plate-head">
      <span className="plate-num" aria-hidden="true">
        {reduceMotion ? (
          <span className="num">{num}</span>
        ) : (
          <motion.span
            className="num"
            initial={{ y: "0.5em", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {num}
          </motion.span>
        )}
      </span>
      <span className="plate-label">{label}</span>
      <span className="plate-rule" />
    </div>
  );
}
