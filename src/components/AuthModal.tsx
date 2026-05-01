import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Phone, ArrowRight, Loader2 } from "lucide-react";

interface AuthModalProps {
  onSuccess?: () => void;
}

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const { setUser, setToken } = useAuth();

  const requestOTP = trpc.auth.requestOTP.useMutation({
    onSuccess: () => {
      setStep("code");
      toast.success("Код подтверждения отправлен");
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyOTP = trpc.auth.verifyOTP.useMutation({
    onSuccess: (data) => {
      setUser(data.user);
      setToken(data.token);
      toast.success("Вход выполнен успешно");
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return toast.error("Введите корректный номер телефона");
    requestOTP.mutate({ phone });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) return toast.error("Введите 4-значный код");
    verifyOTP.mutate({ phone, code });
  };

  return (
    <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#05C3D4]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#05C3D4]">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase font-heading tracking-tight text-foreground">Вход в ТЕХАКС</h2>
        <p className="mt-3 text-sm text-muted-foreground font-medium leading-relaxed">
          {step === "phone" 
            ? "Введите номер телефона для получения кода" 
            : `Введите 4-значный код, отправленный на номер ${phone}`}
        </p>
      </div>

      {step === "phone" ? (
        <form onSubmit={handleRequest} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Телефон</Label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="+7 (___) ___-__-__"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold focus:ring-2 focus:ring-[#05C3D4]/20"
                required
              />
            </div>
          </div>
          <Button 
            disabled={requestOTP.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs"
          >
            {requestOTP.isPending ? <Loader2 className="animate-spin" /> : "ПОЛУЧИТЬ КОД"}
            <ArrowRight size={18} className="ml-2" />
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2 text-center">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Код из СМС</Label>
            <Input
              type="text"
              maxLength={4}
              placeholder="0 0 0 0"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-16 text-center text-2xl font-black tracking-[0.5em] rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
              required
              autoFocus
            />
          </div>
          <Button 
            disabled={verifyOTP.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs glow-cyan"
          >
            {verifyOTP.isPending ? <Loader2 className="animate-spin" /> : "ВОЙТИ"}
          </Button>
          <button 
            type="button" 
            onClick={() => setStep("phone")}
            className="w-full text-[10px] font-black uppercase text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            Изменить номер
          </button>
        </form>
      )}

      <p className="mt-8 text-[9px] text-center text-muted-foreground uppercase font-bold tracking-widest leading-relaxed">
        Авторизация без пароля. <br /> Быстро. Безопасно. Просто.
      </p>
    </div>
  );
}
