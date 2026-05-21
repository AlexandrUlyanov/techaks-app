import type { FormEvent } from "react";
import { Search, X } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Поиск по товарам, артикулам и категориям",
  autoFocus = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Search size={18} />
      </div>
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        autoFocus={autoFocus}
        inputMode="search"
        placeholder={placeholder}
        aria-label="Поисковый запрос"
        className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистить запрос"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      ) : null}
      <button
        type="submit"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tech-color-primary)] px-4 text-[11px] font-black uppercase tracking-widest text-[var(--tech-color-primary-foreground)] transition hover:brightness-95"
      >
        Найти
      </button>
    </form>
  );
}
