import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  canShowPushPrompt,
  clearPushPromptTrigger,
  createPushSubscription,
  dismissPushPrompt,
  getExistingPushSubscription,
  getPushPromptTrigger,
  subscribeToPushPromptEvents,
  type PushPromptTrigger,
} from "@/lib/push-notifications";
import { trpc } from "@/providers/trpc";

export default function PushNotificationPrompt() {
  const location = useLocation();
  const isAuthenticated = useAuth(state => state.isAuthenticated);
  const [trigger, setTrigger] = useState<PushPromptTrigger | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const isBlockedRoute =
    location.pathname.startsWith("/admin") || location.pathname === "/checkout";

  const vapidKeyQuery = trpc.auth.getVapidPublicKey.useQuery(undefined, {
    enabled: isAuthenticated && isOpen,
    staleTime: 60 * 60 * 1000,
  });
  const registerPush = trpc.auth.registerPush.useMutation();

  const considerTrigger = useCallback(
    async (nextTrigger: PushPromptTrigger | null) => {
      if (!nextTrigger || !isAuthenticated || isBlockedRoute) return;
      if (!canShowPushPrompt(nextTrigger)) {
        clearPushPromptTrigger();
        return;
      }

      try {
        const existing = await getExistingPushSubscription();
        if (existing) {
          clearPushPromptTrigger();
          return;
        }
      } catch {
        // A registration failure should not prevent the explanatory prompt.
      }

      setTrigger(nextTrigger);
      setIsOpen(true);
    },
    [isAuthenticated, isBlockedRoute]
  );

  useEffect(() => {
    void considerTrigger(getPushPromptTrigger());
    return subscribeToPushPromptEvents(nextTrigger => {
      void considerTrigger(nextTrigger);
    });
  }, [considerTrigger, location.pathname]);

  const dismiss = useCallback(() => {
    if (trigger) dismissPushPrompt(trigger.source);
    setIsOpen(false);
    setTrigger(null);
  }, [trigger]);

  const handleEnable = async () => {
    if (!trigger || isEnabling) return;
    setIsEnabling(true);
    try {
      const subscription = await createPushSubscription(vapidKeyQuery.data || "");
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Браузер вернул неполные данные подписки.");
      }

      await registerPush.mutateAsync({
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        userAgent: navigator.userAgent,
      });

      clearPushPromptTrigger();
      setIsOpen(false);
      setTrigger(null);
      toast.success("Push-уведомления о заказах включены");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось включить уведомления"
      );
    } finally {
      setIsEnabling(false);
    }
  };

  if (!trigger) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) dismiss();
      }}
    >
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-[520px]">
        <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-9">
          <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <BellRing className="size-7" aria-hidden="true" />
          </div>
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl leading-tight">
              Будьте в курсе заказа
            </DialogTitle>
            <DialogDescription className="mt-2 text-[15px] leading-6">
              Push-уведомления — самый быстрый способ узнать, что заказ принят,
              готов к выдаче или передан в доставку.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 flex gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-cyan-600 dark:text-cyan-300"
              aria-hidden="true"
            />
            <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">
              Сейчас включим только важные уведомления о заказах и сообщениях
              магазина. Новости и предложения настраиваются отдельно в личном
              кабинете.
            </p>
          </div>

          <p className="mt-4 text-sm leading-5 text-slate-500 dark:text-slate-400">
            Так коммуникация с магазином будет быстрее и удобнее. Разрешение
            можно отключить в настройках браузера в любое время.
          </p>

          <DialogFooter className="mt-7 gap-3 sm:justify-start">
            <Button
              type="button"
              className="h-12 rounded-full px-6"
              onClick={handleEnable}
              disabled={isEnabling || vapidKeyQuery.isLoading}
            >
              {isEnabling || vapidKeyQuery.isLoading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <BellRing aria-hidden="true" />
              )}
              Включить уведомления
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-full px-5"
              onClick={dismiss}
              disabled={isEnabling}
            >
              Не сейчас
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

