"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type RevealTag = "div" | "h2" | "p" | "aside" | "dl" | "figure";

type RevealProps = {
  as?: RevealTag;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Scroll-reveal matching the mockup's `.will-reveal` behaviour:
 * fade + 22px rise over 0.7s, triggered once at ~12% visibility.
 * Renders static markup when the visitor prefers reduced motion.
 */
export default function Reveal({
  as = "div",
  className,
  style,
  children,
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Tag = motion[as];

  if (reduceMotion) {
    const Static = as;
    return (
      <Static className={className} style={style}>
        {children}
      </Static>
    );
  }

  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      {children}
    </Tag>
  );
}
