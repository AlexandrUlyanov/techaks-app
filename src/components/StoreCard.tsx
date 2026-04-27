import { MapPin, Phone, Clock, Star } from "lucide-react";

interface StoreCardProps {
  name: string;
  address: string;
  hours: string;
  phone: string;
  rating: string;
  reviews: string;
  image: string;
  isOpen: boolean;
}

export default function StoreCard({
  name,
  address,
  hours,
  phone,
  rating,
  reviews,
  image,
  isOpen,
}: StoreCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]">
      {/* Image */}
      <div className="h-[220px] overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Info */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-[#0a0a0a]">{address}</h3>
        <span
          className={`inline-flex mt-3 px-3 py-1 rounded-full text-xs font-medium ${
            isOpen
              ? "bg-[#dcfce7] text-[#166534]"
              : "bg-[#fee2e2] text-[#991b1b]"
          }`}
        >
          {isOpen ? "Открыто" : "Закрыто"}
        </span>

        <div className="mt-3 flex items-center gap-2 text-gray-500">
          <Clock size={16} />
          <span className="text-sm">{hours}</span>
        </div>

        <div className="mt-2 flex items-center gap-2 text-gray-500">
          <Phone size={16} />
          <span className="text-sm font-medium">{phone}</span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star size={14} className="fill-[#facc15] text-[#facc15]" />
            <span className="text-sm font-semibold">{rating}</span>
          </div>
          <span className="text-sm text-gray-500">({reviews})</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 flex gap-3">
        <a
          href={`https://yandex.ru/maps/?text=${encodeURIComponent(address + " Пенза")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold hover:border-[#00bcd4] transition-colors"
        >
          <MapPin size={16} />
          Маршрут
        </a>
        <a
          href={`tel:${phone.replace(/\D/g, "")}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#00bcd4] text-white rounded-lg text-sm font-semibold hover:bg-[#0097a7] transition-colors"
        >
          <Phone size={16} />
          Позвонить
        </a>
      </div>
    </div>
  );
}
