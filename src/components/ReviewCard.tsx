import { Star } from "lucide-react";

interface ReviewCardProps {
  name: string;
  date: string;
  rating: number;
  text: string;
  source: string;
}

export default function ReviewCard({ name, date, rating, text, source }: ReviewCardProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-[#0a0a0a]">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#0a0a0a] truncate">{name}</div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{date}</span>
      </div>

      {/* Rating */}
      <div className="mt-3 flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < rating ? "fill-[#facc15] text-[#facc15]" : "text-gray-200"}
          />
        ))}
      </div>

      {/* Text */}
      <p className="mt-3 text-sm text-gray-500 leading-relaxed">{text}</p>

      {/* Source */}
      <div className="mt-4 inline-flex px-2.5 py-1 bg-gray-100 rounded-md">
        <span className="text-xs text-gray-600 font-medium">{source}</span>
      </div>
    </div>
  );
}
