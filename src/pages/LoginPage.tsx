import { Navigate } from "react-router";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/hooks/use-auth";
import { useSeo } from "@/lib/seo";

export default function LoginPage() {
  const { isAuthenticated } = useAuth();

  useSeo({
    title: "Вход в ТЕХАКС",
    description: "Авторизация в интернет-магазине ТЕХАКС.",
    canonicalPath: "/login",
    noindex: true,
  });

  if (isAuthenticated) {
    return <Navigate to="/account" replace />;
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-background">
      <AuthModal />
    </div>
  );
}
