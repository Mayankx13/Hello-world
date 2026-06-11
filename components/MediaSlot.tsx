import Image from "next/image";

type MediaSlotProps = {
  /** Image source — when absent, renders the mockup's cream placeholder. */
  src?: string;
  alt?: string;
  /** Placeholder caption shown while no media is wired up. */
  label?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/**
 * A fixed-aspect media well (the mockup's <image-slot>). Always reserves
 * its box via CSS aspect-ratio / explicit size, so swapping a real image
 * in causes zero layout shift.
 */
export default function MediaSlot({
  src,
  alt = "",
  label,
  sizes,
  priority,
  className,
}: MediaSlotProps) {
  return (
    <div className={`media-slot${className ? ` ${className}` : ""}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "100vw"}
          priority={priority}
          style={{ objectFit: "cover" }}
        />
      ) : (
        label && (
          <span className="media-ph" aria-hidden="true">
            {label}
          </span>
        )
      )}
    </div>
  );
}
