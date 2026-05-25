import { Link } from "react-router";
import { MessageSquareHeart, Star } from "lucide-react";
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
    <div className="space-y-8 text-[#20262E]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
            Отзывы
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
            Что говорят покупатели
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#6B7280]">
            Мнения покупателей и ответы магазина. Все отзывы проходят модерацию перед публикацией.
          </p>
        </div>

        {totalCount > 0 ? (
          <div className="rounded-[1.4rem] border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-[#05C3D4]">
              <Star size={18} className="fill-current" />
              <span className="text-3xl font-black">{avgRating.toFixed(1)}</span>
            </div>
            <div className="mt-1 text-sm font-bold text-[#20262E]">
              {formatRussianCount(totalCount, ["отзыв", "отзыва", "отзывов"])}
            </div>
            <div className="text-xs text-[#6B7280]">
              Подтверждённых покупок: {Number(summary?.verifiedCount ?? 0)}
            </div>
          </div>
        ) : null}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-[1.5rem] bg-[radial-gradient(circle_at_top,rgba(5,195,212,0.10),transparent_45%)] px-6 py-14 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#05C3D4] shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <MessageSquareHeart size={24} />
          </div>
          <h3 className="mt-5 text-2xl font-black tracking-tight text-[#20262E]">
            Отзывов пока нет
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#6B7280]">
            Будьте первым, кто оставит отзыв о товаре.
          </p>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("tab-review-composer")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-[#05C3D4] px-5 text-sm font-extrabold text-white transition hover:-translate-y-px hover:shadow-[0_12px_24px_rgba(5,195,212,0.22)]"
          >
            Оставить отзыв
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <article
              key={review.id}
              className="rounded-[1.4rem] border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold text-[#20262E]">{review.title}</h3>
                    {review.isVerifiedPurchase ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        Подтверждённая покупка
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-[#6B7280]">
                    {review.authorName}
                    {review.publishedAt
                      ? ` · ${new Date(review.publishedAt).toLocaleDateString("ru-RU")}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-[rgba(5,195,212,0.10)] px-3 py-2 text-sm font-extrabold text-[#047E8A]">
                  <Star size={15} className="fill-current" />
                  {review.rating}/5
                </div>
              </div>

              {(review.pros || review.cons) ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {review.pros ? (
                    <div className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <strong>Достоинства:</strong> {review.pros}
                    </div>
                  ) : null}
                  {review.cons ? (
                    <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <strong>Недостатки:</strong> {review.cons}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-4 text-sm leading-7 text-[#20262E]">{review.text}</p>

              {review.storeReply ? (
                <div className="mt-5 rounded-[1rem] bg-[rgba(5,195,212,0.08)] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                    Ответ магазина
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[#20262E]">{review.storeReply}</div>
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
          <div className="rounded-[1.4rem] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
            <div className="text-base font-extrabold text-[#20262E]">Оставить отзыв</div>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Чтобы оставить отзыв, войдите в личный кабинет. После отправки отзыв попадёт на модерацию и только потом появится на сайте.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-[#05C3D4] px-5 text-sm font-extrabold text-white transition hover:-translate-y-px hover:shadow-[0_12px_24px_rgba(5,195,212,0.22)]"
            >
              Войти и оставить отзыв
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
