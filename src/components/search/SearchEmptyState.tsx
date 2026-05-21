import { Link } from "react-router";
import { Search, ShoppingCart } from "lucide-react";

export default function SearchEmptyState({
  query,
  correctedQuery,
}: {
  query: string;
  correctedQuery?: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-[var(--tech-radius-card)] border border-border bg-card px-6 py-12 text-center shadow-[var(--tech-shadow-card)]">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Search size={34} />
      </div>
      <h2 className="mt-6 text-2xl font-black uppercase tracking-tight text-foreground">
        Ничего не нашли
      </h2>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        По запросу «{query}» совпадений пока нет. Попробуйте изменить формулировку,
        убрать часть слов или перейти в каталог.
      </p>
      {correctedQuery ? (
        <p className="mt-3 text-sm font-semibold text-foreground">
          Возможно, вы искали:{" "}
          <Link
            to={`/search?q=${encodeURIComponent(correctedQuery)}`}
            className="text-[var(--tech-color-primary)] hover:underline"
          >
            {correctedQuery}
          </Link>
        </p>
      ) : null}
      <div className="mt-8">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-3 rounded-xl bg-[var(--tech-color-primary)] px-5 py-3 text-[11px] font-black uppercase tracking-widest text-[var(--tech-color-primary-foreground)]"
        >
          <ShoppingCart size={16} />
          Перейти в каталог
        </Link>
      </div>
    </div>
  );
}
