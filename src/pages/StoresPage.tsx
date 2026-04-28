import { MapPin } from "lucide-react";
import StoreCard from "@/components/StoreCard";
import { trpc } from "@/providers/trpc";

export default function StoresPage() {
  const { data: stores = [] } = trpc.store.getAll.useQuery();
  
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
                {stores.map((store) => (
                  <a
                    key={store.id}
                    href={store.mapUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <MapPin size={16} className="text-[#00bcd4]" />
                    {store.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
