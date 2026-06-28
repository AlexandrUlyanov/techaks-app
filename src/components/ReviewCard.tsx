import { useEffect, useState } from "react";
import { ExternalLink, Star } from "lucide-react";

interface ReviewCardProps {
  name: string;
  date: string;
  rating: number;
  text: string;
  source: string;
  avatarUrl?: string | null;
  authorBadge?: string | null;
  photoUrl?: string | null;
  reviewUrl?: string | null;
  replyText?: string | null;
}

export default function ReviewCard({
  name,
  date,
  rating,
  text,
  source,
  avatarUrl,
  authorBadge,
  photoUrl,
  reviewUrl,
  replyText,
}: ReviewCardProps) {
  const [avatarVisible, setAvatarVisible] = useState(Boolean(avatarUrl));
  const [photoVisible, setPhotoVisible] = useState(Boolean(photoUrl));

  useEffect(() => {
    setAvatarVisible(Boolean(avatarUrl));
  }, [avatarUrl]);

  useEffect(() => {
    setPhotoVisible(Boolean(photoUrl));
  }, [photoUrl]);

  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase();

  return (
    <article className="overflow-hidden rounded-[28px] border border-border bg-card p-6 transition-colors duration-300 hover:border-[#05C3D4]/25 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-sm font-black uppercase text-[#05C3D4]">
          {avatarUrl && avatarVisible ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setAvatarVisible(false)}
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black tracking-tight text-foreground">
            {name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
            <span>{date}</span>
            {authorBadge ? <span className="normal-case tracking-normal">{authorBadge}</span> : null}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-black text-foreground">
          <Star size={14} className="fill-[#05C3D4] text-[#05C3D4]" />
          <span>{rating.toFixed(1)}</span>
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={
              i < rating
                ? "fill-[#05C3D4] text-[#05C3D4]"
                : "text-foreground/10 dark:text-white/10"
            }
          />
        ))}
      </div>

      {photoUrl && photoVisible ? (
        <div className="mt-5 overflow-hidden rounded-[22px] bg-muted">
          <img
            src={photoUrl}
            alt={`Фото к отзыву ${name}`}
            className="h-56 w-full object-cover"
            loading="lazy"
            onError={() => setPhotoVisible(false)}
          />
        </div>
      ) : null}

      <p className="mt-5 text-sm font-medium leading-relaxed text-foreground/85">
        {text}
      </p>

      {replyText ? (
        <div className="mt-5 rounded-[22px] bg-muted/75 px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
            Ответ ТЕХАКС
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-4">
            {replyText}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-px w-4 bg-border" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {source}
          </span>
        </div>
        {reviewUrl ? (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#05C3D4] transition-colors hover:text-[#049eac]"
          >
            Читать
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
    </article>
  );
}
