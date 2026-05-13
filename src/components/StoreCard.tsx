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
    <div className="bg-card border border-border rounded-3xl overflow-hidden group hover:border-[#05C3D4]/20 transition-all duration-300 shadow-sm hover:shadow-xl">
      {/* Image */}
      <div className="h-[400px] md:h-[500px] overflow-hidden relative bg-muted/20">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90" />
        
        <span
          className={`absolute top-6 left-6 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
            isOpen
              ? "bg-[#05C3D4] text-white dark:text-black"
              : "bg-black/40 text-white/90 border border-white/20 backdrop-blur-md"
          }`}
        >
          {isOpen ? "Магазин открыт" : "Сейчас закрыто"}
        </span>

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-8">
          <h3 className="text-2xl md:text-3xl font-black uppercase font-heading tracking-tight text-white drop-shadow-lg leading-tight">
            {address}
          </h3>
        </div>
      </div>

      {/* Info */}
      <div className="p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 md:pb-8 border-b border-border">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30 block">
              Время работы
            </span>
            <div className="flex items-center gap-2 text-foreground/80">
              <Clock size={16} className="text-[#05C3D4]" />
              <span className="text-sm font-bold">{hours}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30 block">
              Телефон
            </span>
            <div className="flex items-center gap-2 text-foreground/80">
              <Phone size={16} className="text-[#05C3D4]" />
              <span className="text-sm font-bold">{phone}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-foreground/5 px-3 py-1.5 rounded-lg">
              <Star size={16} className="fill-[#05C3D4] text-[#05C3D4]" />
              <span className="text-sm font-black text-foreground">
                {rating}
              </span>
            </div>
            <span className="text-xs font-bold text-foreground/30 uppercase tracking-widest">
              {reviews}
            </span>
          </div>

          <div className="flex gap-3">
            <a
              href={`https://yandex.ru/maps/?text=${encodeURIComponent(address + " Пенза")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 flex items-center justify-center border border-border rounded-xl text-foreground hover:bg-foreground/5 hover:border-[#05C3D4] transition-all active:scale-90"
              title="Маршрут"
            >
              <MapPin size={20} />
            </a>
            <a
              href={`tel:${phone.replace(/\D/g, "")}`}
              className="flex-1 flex items-center justify-center gap-3 px-6 h-12 bg-[#05C3D4] text-white dark:text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan active:scale-95 shadow-lg shadow-[#05C3D4]/10"
            >
              <Phone size={16} />
              Позвонить
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
