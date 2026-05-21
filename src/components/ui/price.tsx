import { cn } from "@/lib/utils";

function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

export function Price({
  value,
  oldValue,
  className,
}: {
  value: number;
  oldValue?: number | null;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end gap-2", className)}>
      <span
        className="font-black leading-none text-[var(--tech-color-primary)]"
        style={{ fontSize: "var(--tech-font-size-price)" }}
      >
        {formatPrice(value)}
      </span>
      {oldValue ? (
        <span
          className="font-bold leading-none text-[var(--tech-color-text-muted)] line-through"
          style={{ fontSize: "var(--tech-font-size-old-price)" }}
        >
          {formatPrice(oldValue)}
        </span>
      ) : null}
    </div>
  );
}
