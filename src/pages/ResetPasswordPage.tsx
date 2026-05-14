import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Lock, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSeo } from "@/lib/seo";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useSeo({
    title: "Восстановление пароля — ТЕХАКС",
    description: "Установка нового пароля для аккаунта ТЕХАКС.",
    canonicalPath: "/reset-password",
    noindex: true,
  });

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: data => {
      toast.success(data.message);
      setPassword("");
      setConfirmPassword("");
    },
    onError: err => toast.error(err.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Ссылка восстановления некорректна.");
      return;
    }
    if (password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }
    resetMutation.mutate({ token, password });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#05C3D4]/10 text-[#05C3D4]">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-black uppercase font-heading">Новый пароль</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
              Новый пароль
            </Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-12 rounded-xl"
              placeholder="Не менее 6 символов"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
              Повторите пароль
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="h-12 rounded-xl"
              placeholder="Повторите пароль"
              required
            />
          </div>
          <Button disabled={resetMutation.isPending} className="w-full h-12 text-xs uppercase tracking-widest">
            {resetMutation.isPending ? <Loader2 className="animate-spin" /> : "Сохранить пароль"}
          </Button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/account" className="text-sm text-[#05C3D4] hover:underline">
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  );
}

