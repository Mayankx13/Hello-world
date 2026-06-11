"use client";

import { useState } from "react";
import MediaSlot from "@/components/MediaSlot";

type ReelFrameProps = {
  caption: string;
  duration: string;
  /** Placeholder caption for the empty media well. */
  placeholder?: string;
  /** Poster image (public path or allowed remote URL). */
  poster?: string;
  /**
   * Demo video (self-hosted MP4 or Mux playback URL). Loaded poster-first:
   * the <video> element only mounts after the visitor presses play, so the
   * initial page load never fetches video bytes.
   */
  video?: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
};

export default function ReelFrame({
  caption,
  duration,
  placeholder,
  poster,
  video,
  alt,
  sizes,
  priority,
}: ReelFrameProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="reel-frame">
      {playing && video ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- demo reels are visual demos; captions are burned into the edit
        <video src={video} poster={poster} autoPlay controls playsInline />
      ) : (
        <>
          <MediaSlot
            src={poster}
            alt={alt ?? caption}
            label={placeholder}
            sizes={sizes ?? "(max-width: 960px) 300px, 360px"}
            priority={priority}
          />
          {video ? (
            <button
              type="button"
              className="play"
              aria-label={`Play — ${caption}`}
              onClick={() => setPlaying(true)}
            />
          ) : (
            <span className="play" aria-hidden="true" />
          )}
        </>
      )}
      <figcaption className="reel-caption">
        <span>{caption}</span>
        <span className="dur">{duration}</span>
      </figcaption>
    </figure>
  );
}
