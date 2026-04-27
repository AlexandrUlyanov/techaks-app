import { Phone, MessageCircle, MapPin } from "lucide-react";

export default function StickyBottomBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-2 flex gap-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <a
        href="tel:+79273750555"
        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-[#dcfce7] text-[#166534]"
      >
        <Phone size={20} />
        <span className="text-xs font-semibold">Позвонить</span>
      </a>
      <a
        href="https://t.me/tech_aks"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-[#00bcd4] text-white"
      >
        <MessageCircle size={20} />
        <span className="text-xs font-semibold">Написать</span>
      </a>
      <a
        href="https://yandex.ru/maps/?text=%D0%BF%D1%80.+%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2C+50%D0%90+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg bg-[#eff6ff] text-[#1d4ed8]"
      >
        <MapPin size={20} />
        <span className="text-xs font-semibold">Маршрут</span>
      </a>
    </div>
  );
}
