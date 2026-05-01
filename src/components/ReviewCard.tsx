import { Star } from "lucide-react";

interface ReviewCardProps {
  name: string;
  date: string;
  rating: number;
  text: string;
  source: string;
}

export default function ReviewCard({ name, date, rating, text }: ReviewCardProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="bg-card border border-border rounded-2xl p-8 hover:border-[#05C3D4]/20 transition-all duration-300 shadow-sm hover:shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-sm font-black text-[#05C3D4] uppercase">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-foreground uppercase tracking-tight truncate">{name}</div>
          <div className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-1">{date}</div>
        </div>
      </div>

      {/* Rating */}
      <div className="mt-6 flex items-center gap-1 bg-muted inline-flex px-3 py-1.5 rounded-lg border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < rating ? "fill-[#05C3D4] text-[#05C3D4]" : "text-foreground/10 dark:text-white/10"}
          />
        ))}
      </div>

      {/* Text */}
      <p className="mt-6 text-sm text-foreground/80 font-medium leading-relaxed italic line-clamp-4">
        "{text}"
      </p>

      {/* Source */}
      <div className="mt-8 flex items-center gap-2">
        <span className="w-4 h-px bg-border" />
        <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Яндекс Карты</span>
      </div>
    </div>
  );
}
