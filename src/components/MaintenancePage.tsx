import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface MaintenancePageProps {
  reopenDate: string | null;
}

export default function MaintenancePage({ reopenDate }: MaintenancePageProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!reopenDate) return;

    const targetDate = new Date(reopenDate).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [reopenDate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#15171A] p-6 text-white">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#05C3D4]/10">
          <Clock size={40} className="text-[#05C3D4]" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Скоро откроемся!
          </h1>
          <p className="text-lg text-white/60">
            Мы проводим технические работы, чтобы сделать наш сервис ещё лучше.
          </p>
        </div>

        {timeLeft ? (
          <div className="grid grid-cols-4 gap-4">
            <TimeUnit value={timeLeft.days} label="Дней" />
            <TimeUnit value={timeLeft.hours} label="Часов" />
            <TimeUnit value={timeLeft.minutes} label="Минут" />
            <TimeUnit value={timeLeft.seconds} label="Секунд" />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-8 text-xl font-black">
            Мы скоро вернемся!
          </div>
        )}

        <div className="pt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/40">
            <span className="h-2 w-2 rounded-full bg-[#05C3D4] animate-pulse" />
            Технические работы в процессе
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-3xl font-black sm:text-4xl">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </div>
    </div>
  );
}
