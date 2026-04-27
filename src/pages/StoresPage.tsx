import { MapPin } from "lucide-react";
import StoreCard from "@/components/StoreCard";

export default function StoresPage() {
  const now = new Date();
  const isStoreOpen = now.getHours() >= 9 && now.getHours() < 21;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Hero */}
      <section className="bg-gray-50 py-12">
        <div className="container-main text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0a]">
            Магазины ТЕХАКС в Пензе
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Адреса, часы работы, фото и маршруты
          </p>
        </div>
      </section>

      {/* Store Cards */}
      <section className="py-16">
        <div className="container-main">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <StoreCard
              name="пр. Строителей, 50А"
              address="пр. Строителей, 50А"
              hours="Ежедневно 9:00–21:00"
              phone="+7 (927) 375-05-55"
              rating="4.9"
              reviews="31 оценка, 28 отзывов"
              image="/images/store-stroiteley.jpg"
              isOpen={isStoreOpen}
            />
            <StoreCard
              name="ул. Генерала Глазунова, 1"
              address="ул. Генерала Глазунова, 1 (ТЦ Застава)"
              hours="Ежедневно 9:00–21:00"
              phone="+7 (927) 375-05-55"
              rating="4.9"
              reviews="35 оценок, 33 отзыва"
              image="/images/store-glazunova.jpg"
              isOpen={isStoreOpen}
            />
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-16 bg-gray-50">
        <div className="container-main text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0a0a0a]">
            Как добраться
          </h2>
          <div className="mt-8 bg-gray-200 rounded-xl h-[400px] flex items-center justify-center">
            <div className="text-center">
              <MapPin size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                Карта с магазинами — интеграция Яндекс/2ГИС
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                <a
                  href="https://yandex.ru/maps/?text=%D0%BF%D1%80.+%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2C+50%D0%90+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  <MapPin size={16} className="text-[#00bcd4]" />
                  пр. Строителей, 50А
                </a>
                <a
                  href="https://yandex.ru/maps/?text=%D1%83%D0%BB.+%D0%93%D0%B5%D0%BD%D0%B5%D1%80%D0%B0%D0%BB%D0%B0+%D0%93%D0%BB%D0%B0%D0%B7%D1%83%D0%BD%D0%BE%D0%B2%D0%B0%2C+1+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  <MapPin size={16} className="text-[#00bcd4]" />
                  ул. Генерала Глазунова, 1
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
