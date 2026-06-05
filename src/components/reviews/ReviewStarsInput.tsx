import { Star } from "lucide-react";

export default function ReviewStarsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1;
        const active = rating <= value;
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white/80 text-foreground transition-[background-color,border-color,color] hover:border-[#05C3D4]/45 hover:bg-[#05C3D4]/8 dark:bg-white/[0.04] dark:hover:bg-[#05C3D4]/12"
            aria-label={`Оценка ${rating}`}
          >
            <Star
              size={18}
              className={active ? "fill-[#05C3D4] text-[#05C3D4]" : "text-muted-foreground/30"}
            />
          </button>
        );
      })}
    </div>
  );
}
