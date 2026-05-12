import { Link } from "react-router-dom";

type Variant = "on-dark" | "on-light";

type BrandProps = {
  variant?: Variant;
  size?: number;
  showWordmark?: boolean;
  linkTo?: string | null;
};

export function Brand({ variant = "on-dark", size = 28, showWordmark = true, linkTo = "/" }: BrandProps) {
  const markSrc = variant === "on-dark" ? "/akbay/mark-on-dark.svg" : "/akbay/mark.svg";
  const text    = variant === "on-dark" ? "var(--color-bone)"        : "var(--color-dagat)";

  // mark viewBox is 410x215 → aspect ratio ~1.91
  const markHeight = size;
  const markWidth  = Math.round(size * (410 / 215));

  const content = (
    <span className="inline-flex items-center gap-2.5 select-none">
      <img
        src={markSrc}
        alt={showWordmark ? "" : "akbay"}
        width={markWidth}
        height={markHeight}
        style={{ display: "block", flexShrink: 0 }}
      />
      {showWordmark && (
        <span
          className="font-display font-bold"
          style={{
            fontSize: Math.round(size * 0.9),
            letterSpacing: "-0.03em",
            color: text,
            lineHeight: 1,
          }}
        >
          akbay
        </span>
      )}
    </span>
  );

  if (linkTo === null) return content;
  return (
    <Link to={linkTo} className="inline-flex items-center" aria-label="akbay — home">
      {content}
    </Link>
  );
}
