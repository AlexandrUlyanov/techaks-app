import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import ReviewStarsInput from "./ReviewStarsInput";

type ExistingReview = {
  rating?: number | null;
  title?: string | null;
  text?: string | null;
  pros?: string | null;
  cons?: string | null;
  usageContext?: string | null;
  usageDuration?: string | null;
  isRecommended?: boolean | null;
  status?: string | null;
};

function statusHint(status?: string | null) {
  switch (status) {
    case "pending_moderation":
      return "Отзыв сохранён и ждёт модерации.";
    case "published":
      return "Отзыв опубликован. После редактирования он снова уйдёт на модерацию.";
    case "rejected":
      return "Отзыв был отклонён. Вы можете обновить его и отправить повторно.";
    case "hidden":
      return "Отзыв скрыт. После обновления он снова уйдёт на модерацию.";
    default:
      return null;
  }
}

export default function ReviewComposer({
  productId,
  productName,
  existingReview,
  verifiedPurchase = false,
  compact = false,
  onSuccess,
}: {
  productId: number;
  productName: string;
  existingReview?: ExistingReview | null;
  verifiedPurchase?: boolean;
  compact?: boolean;
  onSuccess?: () => void | Promise<void>;
}) {
  const utils = trpc.useUtils();
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [text, setText] = useState(existingReview?.text ?? "");
  const [pros, setPros] = useState(existingReview?.pros ?? "");
  const [cons, setCons] = useState(existingReview?.cons ?? "");
  const [usageContext, setUsageContext] = useState(existingReview?.usageContext ?? "");
  const [usageDuration, setUsageDuration] = useState(existingReview?.usageDuration ?? "");
  const [isRecommended, setIsRecommended] = useState(existingReview?.isRecommended ?? true);

  useEffect(() => {
    setRating(existingReview?.rating ?? 5);
    setTitle(existingReview?.title ?? "");
    setText(existingReview?.text ?? "");
    setPros(existingReview?.pros ?? "");
    setCons(existingReview?.cons ?? "");
    setUsageContext(existingReview?.usageContext ?? "");
    setUsageDuration(existingReview?.usageDuration ?? "");
    setIsRecommended(existingReview?.isRecommended ?? true);
  }, [
    existingReview?.cons,
    existingReview?.isRecommended,
    existingReview?.pros,
    existingReview?.rating,
    existingReview?.text,
    existingReview?.title,
    existingReview?.usageContext,
    existingReview?.usageDuration,
  ]);

  const saveReview = trpc.reviews.upsertMyReview.useMutation({
    onSuccess: async () => {
      toast.success("Отзыв отправлен на модерацию");
      await Promise.all([
        utils.reviews.listProductReviews.invalidate({ productId }),
        utils.reviews.getEligibility.invalidate({ productId }),
        utils.reviews.myReviews.invalidate(),
        utils.product.getBySlug.invalidate(),
      ]);
      await onSuccess?.();
    },
    onError: error => {
      toast.error(error.message || "Не удалось сохранить отзыв");
    },
  });

  const hint = useMemo(() => statusHint(existingReview?.status), [existingReview?.status]);

  return (
    <div
      className={`rounded-2xl border border-border bg-card text-card-foreground shadow-[var(--tech-shadow-card)] ${compact ? "p-4" : "p-6"}`}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`${compact ? "text-base" : "text-lg"} font-black text-foreground`}>
            {existingReview ? "Обновить отзыв" : "Оставить отзыв"}
          </h3>
          {verifiedPurchase ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Подтверждённая покупка
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {productName}
        </p>
        {hint ? <p className="text-xs font-semibold text-[#0099A8]">{hint}</p> : null}
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={event => {
          event.preventDefault();
          saveReview.mutate({
            productId,
            rating,
            title,
            text,
            pros,
            cons,
            usageContext,
            usageDuration,
            isRecommended,
          });
        }}
      >
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
            Оценка
          </span>
          <ReviewStarsInput value={rating} onChange={setRating} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              Заголовок
            </span>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Например: Хорошо держится в авто"
              className="h-11 px-4 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              Срок использования
            </span>
            <Input
              value={usageDuration}
              onChange={event => setUsageDuration(event.target.value)}
              placeholder="Например: 2 месяца"
              className="h-11 px-4 text-sm"
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
            Где использовали товар
          </span>
          <Input
            value={usageContext}
            onChange={event => setUsageContext(event.target.value)}
            placeholder="Например: В машине, дома, для iPhone, для офиса"
            className="h-11 px-4 text-sm"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              Достоинства
            </span>
            <Textarea
              value={pros}
              onChange={event => setPros(event.target.value)}
              placeholder="Что особенно понравилось"
              rows={4}
              className="px-4 py-3 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              Недостатки
            </span>
            <Textarea
              value={cons}
              onChange={event => setCons(event.target.value)}
              placeholder="Что можно улучшить"
              rows={4}
              className="px-4 py-3 text-sm"
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/80">
            Текст отзыва
          </span>
          <Textarea
            value={text}
            onChange={event => setText(event.target.value)}
            placeholder="Опишите, как товар показал себя в реальном использовании"
            rows={compact ? 5 : 7}
            className="px-4 py-3 text-sm"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-white/60 px-4 py-3 dark:bg-white/[0.03]">
          <input
            type="checkbox"
            checked={Boolean(isRecommended)}
            onChange={event => setIsRecommended(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-semibold text-foreground">
            Я рекомендую этот товар
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saveReview.isPending}>
            {saveReview.isPending ? "Сохраняем..." : existingReview ? "Обновить отзыв" : "Отправить отзыв"}
          </Button>
          <span className="text-xs text-muted-foreground">
            После отправки отзыв попадёт на модерацию магазина.
          </span>
        </div>
      </form>
    </div>
  );
}
