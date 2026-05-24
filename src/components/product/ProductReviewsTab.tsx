import { Link } from "react-router";
import ReviewComposer from "@/components/reviews/ReviewComposer";
import { formatRussianCount } from "@/lib/russian-plurals";

type ReviewSummary = {
  avgRating?: number | null;
  totalCount?: number | null;
  verifiedCount?: number | null;
};

type ReviewItem = {
  id: number;
  title: string;
  text: string;
  pros?: string | null;
  cons?: string | null;
  rating: number;
  authorName: string;
  publishedAt?: string | Date | null;
  isVerifiedPurchase?: boolean;
  storeReply?: string | null;
};

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

export default function ProductReviewsTab({
  productId,
  productName,
  isAuthenticated,
  summary,
  reviews,
  existingReview,
  verifiedPurchase,
  onSuccess,
}: {
  productId: number;
  productName: string;
  isAuthenticated: boolean;
  summary?: ReviewSummary | null;
  reviews: ReviewItem[];
  existingReview?: ExistingReview | null;
  verifiedPurchase?: boolean;
  onSuccess?: () => void | Promise<void>;
}) {
  const totalCount = Number(summary?.totalCount ?? reviews.length ?? 0);
  const avgRating = Number(summary?.avgRating ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl">
            Отзывы
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
            Мнения покупателей и ответы магазина.
          </p>
        </div>

        {totalCount > 0 ? (
          <div className="rounded-2xl bg-[var(--tech-color-surface-muted)] px-5 py-4">
            <div className="text-3xl font-black text-[var(--tech-color-primary)]">
              {avgRating.toFixed(1)}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--tech-color-text-main)]">
              {formatRussianCount(totalCount, ["отзыв", "отзыва", "отзывов"])}
            </div>
            <div className="text-xs text-[var(--tech-color-text-muted)]">
              Подтверждённых покупок: {Number(summary?.verifiedCount ?? 0)}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("tab-review-composer")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#05C3D4] px-5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Оставить отзыв
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,var(--tech-color-surface))] px-5 py-5">
          <div className="text-base font-black text-[var(--tech-color-text-main)]">
            Отзывов пока нет. Станьте первым, кто оставит отзыв о товаре.
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--tech-color-border)]/55">
          {reviews.map(review => (
            <article key={review.id} className="border-b border-[var(--tech-color-border)]/55 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-[var(--tech-color-text-main)]">{review.title}</h3>
                    {review.isVerifiedPurchase ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        Подтверждённая покупка
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {review.authorName}
                    {review.publishedAt
                      ? ` · ${new Date(review.publishedAt).toLocaleDateString("ru-RU")}`
                      : ""}
                  </div>
                </div>
                <div className="text-lg font-black text-[var(--tech-color-primary)]">{review.rating}/5</div>
              </div>
              {review.pros ? (
                <p className="mt-4 text-sm text-emerald-700">
                  <strong>Достоинства:</strong> {review.pros}
                </p>
              ) : null}
              {review.cons ? (
                <p className="mt-2 text-sm text-rose-700">
                  <strong>Недостатки:</strong> {review.cons}
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-7 text-[var(--tech-color-text-main)]">{review.text}</p>
              {review.storeReply ? (
                <div className="mt-5 rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,var(--tech-color-surface))] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                    Ответ магазина
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--tech-color-text-main)]">{review.storeReply}</div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <div id="tab-review-composer">
        {isAuthenticated ? (
          <ReviewComposer
            compact
            productId={productId}
            productName={productName}
            existingReview={existingReview}
            verifiedPurchase={verifiedPurchase}
            onSuccess={onSuccess}
          />
        ) : (
          <div className="rounded-2xl border border-[var(--tech-color-border)]/70 bg-[var(--tech-color-surface-muted)] p-5">
            <div className="text-base font-black text-[var(--tech-color-text-main)]">Оставить отзыв</div>
            <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
              Чтобы оставить отзыв, войдите в личный кабинет. После отправки отзыв попадёт на модерацию и только потом появится на сайте.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#05C3D4] px-5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Войти и оставить отзыв
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
