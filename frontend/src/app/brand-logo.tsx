/* eslint-disable @next/next/no-img-element */

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

/** Official MediGuide lockup: document + timeline mark with wordmark. */
export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/assets/mediguide-logo.jpg"
      alt="MediGuide — Health information. Clearer. Confident. Connected."
      width={220}
      height={56}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
    />
  );
}
