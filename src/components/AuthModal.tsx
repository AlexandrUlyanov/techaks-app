import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Phone, User as UserIcon } from "lucide-react";

interface AuthModalProps {
  onSuccess?: () => void;
}

type Mode = "login" | "register";

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showReset, setShowReset] = useState(false);
  const { setUser, setToken } = useAuth();

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: data => {
      setUser(data.user);
      setToken(data.token);
      toast.success("Вход выполнен");
      onSuccess?.();
    },
    onError: err => toast.error(err.message),
  });

  const registerMutation = trpc.auth.registerWithPassword.useMutation({
    onSuccess: data => {
      setUser(data.user);
      setToken(data.token);
      toast.success("Регистрация выполнена");
      onSuccess?.();
    },
    onError: err => toast.error(err.message),
  });

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: data => toast.success(data.message),
    onError: err => toast.error(err.message),
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Введите электронную почту или телефон");
      return;
    }
    if (password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail.trim()) {
      toast.error("Введите электронную почту");
      return;
    }
    if (!registerName.trim() || registerName.trim().length < 2) {
      toast.error("Введите имя");
      return;
    }
    if (registerPassword.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    registerMutation.mutate({
      email: registerEmail.trim(),
      phone: registerPhone.trim() || undefined,
      fullName: registerName.trim(),
      password: registerPassword,
    });
  };

  return (
    <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm transition-all animate-in fade-in zoom-in duration-300">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#05C3D4]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#05C3D4]">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-black uppercase font-heading tracking-tight text-foreground">
          {mode === "login" ? "Вход в ТЕХАКС" : "Регистрация"}
        </h2>
      </div>

      <div className="mb-6 flex rounded-xl border border-border p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`h-10 flex-1 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${
            mode === "login"
              ? "bg-[#05C3D4] text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`h-10 flex-1 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${
            mode === "register"
              ? "bg-[#05C3D4] text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Регистрация
        </button>
      </div>

      {mode === "login" ? (
        <form onSubmit={handleLoginSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
              Электронная почта или телефон
            </Label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="example@mail.ru или +7..."
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Пароль</Label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold focus:ring-2 focus:ring-[#05C3D4]/20"
                required
              />
            </div>
          </div>
          <Button
            disabled={loginMutation.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs"
          >
            {loginMutation.isPending ? <Loader2 className="animate-spin" /> : "Войти"}
          </Button>
          <button
            type="button"
            onClick={() => setShowReset(prev => !prev)}
            className="w-full text-center text-xs font-bold text-[#05C3D4] hover:underline"
          >
            {showReset ? "Скрыть восстановление" : "Забыли пароль?"}
          </button>
          {showReset && (
            <div className="rounded-xl border border-border p-3 space-y-3 bg-background/60">
              <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
                Электронная почта для восстановления
              </Label>
              <Input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="example@mail.ru"
                className="h-11 rounded-xl"
              />
              <Button
                type="button"
                variant="outline"
                disabled={resetMutation.isPending}
                onClick={() => {
                  if (!resetEmail.trim()) {
                    toast.error("Введите электронную почту");
                    return;
                  }
                  resetMutation.mutate({ email: resetEmail.trim() });
                }}
                className="w-full h-10 text-[11px] uppercase tracking-widest"
              >
                {resetMutation.isPending ? <Loader2 className="animate-spin" /> : "Отправить ссылку"}
              </Button>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Имя</Label>
            <div className="relative">
              <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                placeholder="Ваше имя"
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Электронная почта</Label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={registerEmail}
                onChange={e => setRegisterEmail(e.target.value)}
                placeholder="example@mail.ru"
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Телефон (опционально)</Label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={registerPhone}
                onChange={e => setRegisterPhone(e.target.value)}
                placeholder="+7..."
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Пароль</Label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={registerPassword}
                onChange={e => setRegisterPassword(e.target.value)}
                placeholder="Не менее 6 символов"
                className="h-14 pl-12 rounded-xl border-border bg-background font-bold"
                required
              />
            </div>
          </div>
          <Button
            disabled={registerMutation.isPending}
            className="w-full h-14 tracking-widest uppercase text-xs"
          >
            {registerMutation.isPending ? <Loader2 className="animate-spin" /> : "Зарегистрироваться"}
          </Button>
        </form>
      )}
    </div>
  );
}
