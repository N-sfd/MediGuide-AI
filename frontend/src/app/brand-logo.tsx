/* eslint-disable @next/next/no-img-element */

type BrandVariant = "mark" | "wordmark" | "full";

type BrandLogoProps = {
  className?: string;
  /** mark = compact symbol; wordmark = symbol + MediGuide; full = lockup with tagline */
  variant?: BrandVariant;
  priority?: boolean;
};

const TAGLINE = "HEALTH INFORMATION. CLEARER. CONFIDENT. CONNECTED.";

/** Document + timeline mark matching the approved MediGuide logo. */
export function BrandMark({ className = "", title = "MediGuide" }: { className?: string; title?: string }) {
  return (
    <svg
      className={`brand-mark-svg ${className}`.trim()}
      viewBox="0 0 40 48"
      width="28"
      height="34"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Document */}
      <path
        d="M6 4h20l8 8v30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
        fill="#f7faf8"
        stroke="#156b5a"
        strokeWidth="2.5"
      />
      <path d="M26 4v8h8" fill="none" stroke="#156b5a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 4l8 8" fill="#dcefe4" stroke="#156b5a" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Timeline line */}
      <path d="M10 34 L16 28 L24 24 L30 16" fill="none" stroke="#17221f" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="34" r="2.4" fill="#156b5a" />
      <circle cx="16" cy="28" r="2.4" fill="#156b5a" />
      <circle cx="24" cy="24" r="2.4" fill="#156b5a" />
      <circle cx="30" cy="16" r="3.2" fill="#d87968" />
      {/* Leaf */}
      <path
        d="M28 40c6-1 10-5 11-10-5 1-9 5-11 10z"
        fill="#9ec9b4"
        opacity="0.95"
      />
    </svg>
  );
}

/**
 * Official MediGuide branding.
 * Navigation uses compact mark + wordmark (never a huge raster).
 * Full lockup with tagline is for landing footer / about surfaces.
 */
export function BrandLogo({ className = "", variant = "wordmark", priority = false }: BrandLogoProps) {
  if (variant === "mark") {
    return <BrandMark className={className} />;
  }

  if (variant === "full") {
    return (
      <span className={`brand-lockup brand-lockup-full ${className}`.trim()}>
        <img
          className="brand-logo-full-img"
          src="/assets/mediguide-logo.jpg"
          alt={`MediGuide — ${TAGLINE}`}
          width={280}
          height={72}
          decoding="async"
          {...(priority ? { fetchPriority: "high" as const } : {})}
        />
      </span>
    );
  }

  return (
    <span className={`brand-lockup brand-lockup-wordmark ${className}`.trim()}>
      <BrandMark />
      <span className="brand-wordmark-text">MediGuide</span>
    </span>
  );
}

export const MEDIGUIDE_TAGLINE = TAGLINE;
