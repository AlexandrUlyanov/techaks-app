import { Phone, MessageCircle, MapPin } from "lucide-react";

export default function StickyBottomBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#15171A]/90 backdrop-blur-xl border-t border-white/5 px-4 py-3 flex gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <a
        href="tel:+79273750555"
        className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/5 text-white active:scale-95 transition-all"
      >
        <Phone size={18} className="text-[#05C3D4]" />
        <span className="text-[9px] font-black uppercase tracking-widest">Позвонить</span>
      </a>
      <a
        href="https://t.me/tech_aks"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-[1.5] flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#05C3D4] text-black shadow-[0_0_20px_rgba(5,195,212,0.2)] active:scale-95 transition-all"
      >
        <MessageCircle size={18} className="fill-current" />
        <span className="text-[9px] font-black uppercase tracking-widest">Telegram</span>
      </a>
      <a
        href="https://yandex.ru/maps/?text=%D0%BF%D1%80.+%D0%A1%D1%82%D1%80%D0%BE%D0%B8%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%2C+50%D0%90+%D0%9F%D0%B5%D0%BD%D0%B7%D0%B0"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/5 text-white active:scale-95 transition-all"
      >
        <MapPin size={18} className="text-[#05C3D4]" />
        <span className="text-[9px] font-black uppercase tracking-widest">Маршрут</span>
      </a>
    </div>
  );
}
