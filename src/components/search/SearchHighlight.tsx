import type { ReactNode } from "react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function SearchHighlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalized = query.trim();
  if (!normalized) return <>{text}</>;

  const tokens = Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    )
  );

  if (tokens.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index): ReactNode => {
        const isMatch = tokens.some(token => token.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark
            key={`${part}-${index}`}
            className="rounded bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,white)] px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </>
  );
}
