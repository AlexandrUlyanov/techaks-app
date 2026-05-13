import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, Loader2, BellRing, Smartphone, ShieldCheck, CheckCircle2 } from "lucide-react";

interface AuthModalProps {
  onSuccess?: () => void;
}

type Step = "email" | "push_waiting" | "email_otp" | "push_setup" | "success";

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { setUser, setToken } = useAuth();

  const requestEmailOTP = trpc.auth.requestEmailOTP.useMutation({
    onSuccess: () => {
      setStep("email_otp");
      toast.success("Код подтверждения отправлен на почту");
    },
    onError: err => toast.error(err.message),
  });

  const verifyEmailOTP = trpc.auth.verifyEmailOTP.useMutation({
    onSuccess: data => {
      setUser(data.user);
      setToken(data.token);
      setStep("push_setup"); // After first email login, offer push setup
    },
    onError: err => toast.error(err.message),
  });

  const requestPushAuth = trpc.auth.requestPushAuth.useMutation({
    onSuccess: data => {
      setSessionId(data.sessionId);
      setStep("push_waiting");
    },
    onError: err => {
      if (err.shape?.code === -32003 || err.shape?.code === -32004 || err.message === "Пользователь не найден") { 
        // PRECONDITION_FAILED (No devices) or NOT_FOUND (New user)
        requestEmailOTP.mutate({ email });
      } else {
        toast.error(err.message);
      }
    },
  });
  const { data: pushStatus } = trpc.auth.checkPushAuthStatus.useQuery(
    { sessionId: sessionId || "" },
    { 
      enabled: step === "push_waiting" && !!sessionId,
      refetchInterval: 2000,
    }
  );

  useEffect(() => {
    if (step === "push_waiting" && pushStatus?.status === "confirmed" && pushStatus.token && pushStatus.user) {
      setUser(pushStatus.user);
      setToken(pushStatus.token);
      setStep("success");
      toast.success("Вход выполнен успешно!");
      setTimeout(() => onSuccess?.(), 1500);
    } else if (pushStatus?.status === "expired") {
      setStep("email");
      toast.error("Время ожидания подтверждения истекло");
    }
  }, [pushStatus, step, setUser, setToken, onSuccess]);

  const registerPushMutation = trpc.auth.registerPush.useMutation({
    onSuccess: () => {
      setStep("success");
      toast.success("Устройство привязано!");
      setTimeout(() => onSuccess?.(), 1500);
    },
    onError: err => toast.error(err.message),
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Введите корректный Email");
    
    // Try push first, if it fails (no devices), requestPushAuth onError will trigger email OTP
    requestPushAuth.mutate({ email });
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return toast.error("Введите 6-значный код");
    verifyEmailOTP.mutate({ email, code });
  };

  const setupPush = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      
      if (permission !== "granted") {
        throw new Error("Разрешение на уведомления не получено");
      }

      // Get VAPID key from server
      const response = await fetch("/api/trpc/auth.getVapidPublicKey?batch=1");
      const keyData = await response.json();
      const vapidPublicKey = keyData[0].result.data;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey,
      });

      const subJson = subscription.toJSON();
      
      registerPushMutation.mutate({
        subscription: {
          endpoint: subJson.endpoint!,
          keys: {
            p256dh: subJson.keys!.p256dh!,
            auth: subJson.keys!.auth!,
          }
        },
        userAgent: navigator.userAgent,
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (step === "email") {
    return (
      <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm transition-all animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#05C3D4]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#05C3D4]">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase font-heading tracking-tight text-foreground">
            Вход в ТЕХАКС
          </h2>
          <p className="mt-3 text-sm text-muted-foreground font-medium leading-relaxed">
            Введите Email для входа или регистрации
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
              Email
            </Label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="example@mail.ru"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold focus:ring-2 focus:ring-[#05C3D4]/20"
                required
              />
            </div>
          </div>
          <Button
            disabled={requestPushAuth.isPending || requestEmailOTP.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs"
          >
            {(requestPushAuth.isPending || requestEmailOTP.isPending) ? <Loader2 className="animate-spin" /> : "ДАЛЕЕ"}
            <ArrowRight size={18} className="ml-2" />
          </Button>
        </form>
        <p className="mt-8 text-[9px] text-center text-muted-foreground uppercase font-bold tracking-widest leading-relaxed">
          Безопасный вход без паролей
        </p>
      </div>
    );
  }

  if (step === "push_waiting") {
    return (
      <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm text-center animate-in fade-in zoom-in">
        <div className="w-20 h-20 bg-[#05C3D4]/10 rounded-full flex items-center justify-center mx-auto mb-8 relative">
          <Smartphone size={40} className="text-[#05C3D4]" />
          <div className="absolute inset-0 rounded-full border-4 border-[#05C3D4] border-t-transparent animate-spin" />
        </div>
        <h2 className="text-xl font-black uppercase font-heading mb-4">Подтвердите вход</h2>
        <p className="text-sm text-muted-foreground font-medium mb-8 leading-relaxed">
          Мы отправили пуш-уведомление на ваше привязанное устройство. Нажмите <b>"Да, это я"</b> для входа.
        </p>
        <Button 
          variant="outline" 
          onClick={() => requestEmailOTP.mutate({ email })}
          className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          Войти по коду из Email
        </Button>
      </div>
    );
  }

  if (step === "email_otp") {
    return (
      <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm transition-all animate-in fade-in zoom-in">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#05C3D4]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#05C3D4]">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase font-heading tracking-tight text-foreground">
            Код из письма
          </h2>
          <p className="mt-3 text-sm text-muted-foreground font-medium leading-relaxed">
            Мы отправили 6-значный код на <br /> <b>{email}</b>
          </p>
        </div>

        <form onSubmit={handleVerifyOTP} className="space-y-6">
          <Input
            type="text"
            maxLength={6}
            placeholder="0 0 0 0 0 0"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="h-16 text-center text-2xl font-black tracking-[0.3em] rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
            required
            autoFocus
          />
          <Button
            disabled={verifyEmailOTP.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs glow-cyan"
          >
            {verifyEmailOTP.isPending ? <Loader2 className="animate-spin" /> : "ПОДТВЕРДИТЬ"}
          </Button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-[10px] font-black uppercase text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            Изменить Email
          </button>
        </form>
      </div>
    );
  }

  if (step === "push_setup") {
    return (
      <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm transition-all animate-in fade-in zoom-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#05C3D4] rounded-2xl flex items-center justify-center mx-auto mb-6 text-black shadow-xl glow-cyan">
            <BellRing size={32} />
          </div>
          <h2 className="text-xl font-black uppercase font-heading tracking-tight">Вход в 1 клик</h2>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex gap-4 items-start p-4 bg-muted/50 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-[#05C3D4]/10 flex items-center justify-center shrink-0 text-[#05C3D4]">
              <ShieldCheck size={16} />
            </div>
            <p className="text-[11px] font-bold leading-relaxed">
              Мгновенный вход без ожидания писем и ввода кодов.
            </p>
          </div>
          <div className="flex gap-4 items-start p-4 bg-muted/50 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-[#05C3D4]/10 flex items-center justify-center shrink-0 text-[#05C3D4]">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-[11px] font-bold leading-relaxed">
              Никакой рекламы и спама. Только безопасность и статусы заказов.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={setupPush}
            disabled={registerPushMutation.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs glow-cyan"
          >
            {registerPushMutation.isPending ? <Loader2 className="animate-spin" /> : "ВКЛЮЧИТЬ И ПРОДОЛЖИТЬ"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep("success");
              setTimeout(() => onSuccess?.(), 1000);
            }}
            className="w-full h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground"
          >
            ПОЗЖЕ
          </Button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="p-12 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm text-center animate-in fade-in zoom-in">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500">
          <CheckCircle2 size={48} className="animate-bounce" />
        </div>
        <h2 className="text-2xl font-black uppercase font-heading tracking-tight mb-2">Готово!</h2>
        <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Вы в системе</p>
      </div>
    );
  }

  return null;
}
