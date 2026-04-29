import { Link } from "react-router";
import {
  ArrowRight,
  MapPin,
  CheckCircle,
  Smartphone,
  Headphones,
  BatteryCharging,
  Shield,
  Watch,
  Home,
  Gamepad2,
  Wrench,
  Star,
} from "lucide-react";
import ProductCard from "@/components/ProductCard";
import StoreCard from "@/components/StoreCard";
import ReviewCard from "@/components/ReviewCard";
import LeadForm from "@/components/LeadForm";
import { trpc } from "@/providers/trpc";

const blogPosts = [
  { category: "Обзоры", title: "Как выбрать power bank: гид по ёмкости и мощности", date: "18 апреля 2026", image: "/images/blog-1.jpg" },
  { category: "Новинки", title: "Обзор смарт-часов ISA: функции и сравнение", date: "15 апреля 2026", image: "/images/product-watch-1.jpg" },
  { category: "Подборки", title: "Топ-10 аксессуаров для iPhone в 2026", date: "12 апреля 2026", image: "/images/product-case-1.jpg" },
];

const iconMap: Record<string, React.ElementType> = {
  Smartphone,
  Headphones,
  BatteryCharging,
  Shield,
  Watch,
  Home,
  Gamepad2,
  Wrench,
};

const defaultReviews = [
  { author: "Анна К.", rating: 5, text: "Отличный магазин! Помогли подобрать чехол для iPhone, цены приятные, персонал вежливый. Обязательно приду ещё.", createdAt: new Date("2024-04-15").toISOString() },
  { author: "Михаил С.", rating: 5, text: "Клеил защитное стекло, сделали быстро и качественно. Широкий выбор аксессуаров, всё в наличии. Рекомендую!", createdAt: new Date("2024-04-10").toISOString() },
  { author: "Елена В.", rating: 5, text: "Купила power bank HOCO, работает отлично. Продавец объяснил все характеристики, помог выбрать под мои задачи. Спасибо!", createdAt: new Date("2024-04-05").toISOString() },
];

export default function HomePage() {
  const { data: products = [] } = trpc.product.getAll.useQuery();
  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();
  const { data: banners = [] } = trpc.banner.getActive.useQuery();
  
  const productWeek = products.find(p => p.badge === "Акция") || products[0];
  const now = new Date();
  const isStoreOpen = now.getHours() >= 9 && now.getHours() < 21;
  const activeBanners = banners.slice(0, 2);

  return (
    <div className="pb-16 md:pb-0">
      {/* Hero */}
      <section className="min-h-[85vh] bg-gradient-to-br from-[#003238] to-[#004d5c] flex items-center">
        <div className="container-main py-16">
          <h1 className="text-4xl md:text-5xl lg:text-[3rem] font-extrabold text-white max-w-[640px] leading-tight tracking-tight">
            Техника и аксессуары в Пензе
          </h1>
          <p className="mt-5 text-base text-white/70 max-w-[520px] leading-relaxed">
            Два магазина • Ежедневно 9:00–21:00 • Акции недели • Подбор аксессуаров
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#00bcd4] text-white rounded-lg text-sm font-semibold hover:bg-[#0097a7] transition-colors"
              style={{ boxShadow: "0 2px 8px rgba(0,188,212,0.35)" }}
            >
              Смотреть каталог
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/30 text-white rounded-lg text-sm font-semibold hover:bg-white/5 hover:border-white/60 transition-all"
            >
              Узнать наличие
            </Link>
            <a
              href="https://yandex.ru/maps/?text=%D0%BF%D1%80.+%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2C+50%D0%90+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/30 text-white rounded-lg text-sm font-semibold hover:bg-white/5 hover:border-white/60 transition-all"
            >
              <MapPin size={16} />
              Построить маршрут
            </a>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-wrap gap-6">
            {[
              "Официальные партнёры",
              "Цены от производителей",
              "2 магазина",
              "Рейтинг 4.9",
            ].map((badge) => (
              <div key={badge} className="flex items-center gap-2">
                <CheckCircle size={18} className="text-[#22c55e]" />
                <span className="text-sm text-white/80">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-20 bg-white">
        <div className="container-main">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
            Популярные категории
          </h2>
          <p className="mt-3 text-base text-gray-600 text-center">
            Выберите нужный раздел и найдите подходящий товар
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.slice(0, 8).map((cat) => {
              const Icon = iconMap[cat.icon || "Smartphone"] || Smartphone;
              return (
                <Link
                  key={cat.slug}
                  to={`/catalog?cat=${cat.slug}`}
                  className="group bg-gray-50 rounded-xl p-8 text-center hover:bg-[#eaeaea] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Icon size={48} className="mx-auto text-[#007c91] mb-4" />
                  <h3 className="text-lg font-semibold text-[#0a0a0a]">{cat.name}</h3>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">{cat.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Product of the Week */}
      {productWeek && (
        <section className="py-20 bg-gray-50">
          <div className="container-main">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
              Товар недели
            </h2>
            <p className="mt-3 text-base text-gray-600 text-center">
              Специальное предложение с лучшей ценой
            </p>
            <div className="mt-12 flex flex-col lg:flex-row gap-12 items-center">
              {/* Image */}
              <div className="flex-1 w-full">
                <div className="bg-white rounded-xl p-12 flex items-center justify-center">
                  <img
                    src={productWeek.image}
                    alt={productWeek.name}
                    className="max-h-[320px] object-contain"
                  />
                </div>
              </div>
              {/* Info */}
              <div className="flex-1 w-full">
                {productWeek.badge && (
                  <span className="inline-flex bg-[#00bcd4] text-white text-xs font-semibold px-3 py-1 rounded-md uppercase tracking-wide">
                    {productWeek.badge}
                  </span>
                )}
                <h3 className="mt-4 text-3xl md:text-4xl font-bold text-[#0a0a0a]">
                  {productWeek.name}
                </h3>
                <p className="mt-3 text-base text-gray-600 leading-relaxed">
                  {productWeek.description}
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <span className="text-4xl md:text-5xl font-extrabold text-[#007c91]">
                    {productWeek.price.toLocaleString("ru-RU")} ₽
                  </span>
                  {productWeek.oldPrice && (
                    <span className="text-2xl text-gray-400 line-through">
                      {productWeek.oldPrice.toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </div>
                <Link
                  to={`/product/${productWeek.slug}`}
                  className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-[#00bcd4] text-white rounded-lg text-sm font-semibold hover:bg-[#0097a7] transition-colors"
                  style={{ boxShadow: "0 2px 8px rgba(0,188,212,0.35)" }}
                >
                  Узнать наличие
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Promo Banners */}
      {activeBanners.length > 0 && (
        <section id="promos" className="py-20 bg-white">
          <div className="container-main">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
              Акции и спецпредложения
            </h2>
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeBanners.map((promo) => (
                <div
                  key={promo.id}
                  className="flex flex-col sm:flex-row items-center gap-8 bg-gradient-to-br from-[#003238] to-[#004d5c] rounded-xl p-8 md:p-10"
                >
                  <div className="flex-1">
                    <span className="inline-flex bg-[rgba(128,222,234,0.2)] text-[#80deea] text-xs font-semibold px-3 py-1 rounded-md uppercase tracking-wider">
                      Акция
                    </span>
                    <h3 className="mt-3 text-xl font-bold text-white">{promo.title}</h3>
                    <p className="mt-2 text-sm text-white/70 line-clamp-2">{promo.subtitle}</p>
                    <Link
                      to={`/promotions/${promo.slug}`}
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 border border-white/30 text-white rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors"
                    >
                      Подробнее
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                  <div className="flex-shrink-0 w-[140px] h-[140px] rounded-lg overflow-hidden bg-white/5 p-2">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                to="/promotions"
                className="text-sm font-bold text-[#007c91] hover:underline"
              >
                Смотреть все акции
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stores */}
      <section className="py-20 bg-gray-50">
        <div className="container-main">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
            Наши магазины
          </h2>
          <p className="mt-3 text-base text-gray-600 text-center">
            Два магазина в Пензе — выбирайте ближайший
          </p>
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {stores.map((store) => (
              <StoreCard
                key={store.id}
                name={store.name}
                address={store.address}
                hours={store.hours}
                phone={store.phone}
                rating={store.rating}
                reviews={`${store.reviewCount} оценок`}
                image={store.image}
                isOpen={isStoreOpen}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-20 bg-white">
        <div className="container-main">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
            Отзывы покупателей
          </h2>
          <p className="mt-3 text-base text-gray-600 text-center">
            Что говорят о нас на Яндекс Картах и 2ГИС
          </p>

          {/* Rating Summary */}
          <div className="mt-8 flex flex-wrap justify-center gap-12">
            {[
              { platform: "Яндекс Карты", rating: "4.9", count: "59 отзывов" },
              { platform: "2ГИС", rating: "4.8", count: "39 отзывов" },
            ].map((item) => (
              <div key={item.platform} className="text-center">
                <div className="text-sm font-semibold text-gray-500">{item.platform}</div>
                <div className="mt-2 flex items-center gap-2 justify-center">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} className="fill-[#facc15] text-[#facc15]" />
                    ))}
                  </div>
                  <span className="text-xl font-bold text-[#0a0a0a]">{item.rating}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{item.count}</div>
              </div>
            ))}
          </div>

          {/* Review Cards */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {defaultReviews.map((review, i) => (
              <ReviewCard 
                key={i} 
                name={review.author} 
                rating={review.rating} 
                text={review.text} 
                date={new Date(review.createdAt).toLocaleDateString("ru-RU")}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href="https://yandex.ru/maps/org/techaks/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-[#007c91] text-[#007c91] rounded-lg text-sm font-semibold hover:bg-[#007c91] hover:text-white transition-colors"
            >
              Оставить отзыв
            </a>
          </div>
        </div>
      </section>

      {/* Lead Form */}
      <section className="py-20 bg-gradient-to-br from-[#003238] to-[#004d5c]">
        <div className="container-main max-w-[640px] mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Нужна помощь с выбором?
          </h2>
          <p className="mt-3 text-base text-white/70">
            Оставьте номер — мы перезвоним и поможем подобрать аксессуар
          </p>
          <div className="mt-10">
            <LeadForm
              dark
              buttonText="Заказать звонок"
            />
          </div>
        </div>
      </section>

      {/* Blog Preview */}
      <section id="blog" className="py-20 bg-white">
        <div className="container-main">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
            Блог и новости
          </h2>
          <p className="mt-3 text-base text-gray-600 text-center">
            Обзоры товаров, полезные подборки и акции
          </p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post, i) => (
              <div
                key={i}
                className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-250"
              >
                <div className="h-[180px] overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <span className="text-xs font-semibold uppercase text-[#007c91] tracking-wide">
                    {post.category}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-[#0a0a0a] leading-snug line-clamp-2">
                    {post.title}
                  </h3>
                  <span className="mt-3 inline-block text-xs text-gray-400">
                    {post.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <span className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-[#0a0a0a] rounded-lg text-sm font-semibold hover:border-[#007c91] hover:text-[#007c91] transition-colors cursor-pointer">
              Все статьи
            </span>
          </div>
        </div>
      </section>

      {/* Popular Products */}
      <section className="py-20 bg-gray-50">
        <div className="container-main">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0a0a0a] text-center">
            Популярные товары
          </h2>
          <p className="mt-3 text-base text-gray-600 text-center">
            Часто покупают в наших магазинах
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00bcd4] text-white rounded-lg text-sm font-semibold hover:bg-[#0097a7] transition-colors"
            >
              Смотреть все товары
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
