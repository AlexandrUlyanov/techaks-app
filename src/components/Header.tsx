import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Sun, Moon, ShoppingCart, User, Search, Loader2, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";
import { CatalogTrigger } from "./Catalog/CatalogMenu";

const ORDER_MESSAGE_SEEN_STORAGE_KEY = "techaks-order-message-seen";

function readSeenConversationMap() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const raw = window.localStorage.getItem(ORDER_MESSAGE_SEEN_STORAGE_KEY);
    if (!raw) return {} as Record<string, string>;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, string>;
  }
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [, setSeenVersion] = useState(0);
  const { theme, setTheme } = useTheme();
  const { getItemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Search Logic
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults = [], isLoading: searchLoading } =
    trpc.product.search.useQuery(
      { query: searchQuery },
      { enabled: searchQuery.length >= 2 }
    );

  const { data: orderNotifications } =
    trpc.ecommerce.getMyOrderNotifications.useQuery(undefined, {
      enabled: isAuthenticated,
      retry: false,
    });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const handleSeenUpdate = () => setSeenVersion(prev => prev + 1);
    window.addEventListener("techaks-order-conversation-seen", handleSeenUpdate);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener(
        "techaks-order-conversation-seen",
        handleSeenUpdate
      );
    };
  }, []);

  const unreadManagerMessagesCount = (() => {
    if (!isAuthenticated || !orderNotifications?.items?.length) return 0;
    const seenMap = readSeenConversationMap();
    return orderNotifications.items.filter(item => {
      if (!item.latestManagerCommentAt) return false;
      const latestManagerIso = new Date(item.latestManagerCommentAt).toISOString();
      const seenAt = seenMap[String(item.orderId)];
      return !seenAt || new Date(latestManagerIso).getTime() > new Date(seenAt).getTime();
    }).length;
  })();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleSearchSelect = (slug: string) => {
    setSearchQuery("");
    setShowResults(false);
    navigate(`/product/${slug}`);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.length >= 2) {
      setShowResults(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "shadow-2xl" : ""}`}
      >
        {/* Main Bar: Logo, Search, Actions */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border py-4">
          <div className="container-main flex items-center gap-4 md:gap-8 h-11">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center group active:scale-95 transition-transform shrink-0 h-full"
            >
              <img
                src={
                  theme === "dark"
                    ? "/images/logo-color.svg"
                    : "/images/logo-light.svg"
                }
                alt="ТЕХАКС"
                className="h-9 w-auto object-contain mt-1"
              />
            </Link>

            {/* Desktop Catalog & Nav */}
            <div className="hidden xl:flex items-center gap-6 h-full">
              <CatalogTrigger />

              <nav className="flex items-center gap-6 h-full">
                <Link
                  to="/promotions"
                  className="relative group flex items-center h-full"
                >
                  <span className="text-[11px] font-black uppercase tracking-widest text-foreground/60 group-hover:text-[#05C3D4] transition-colors mt-0.5">
                    Акции
                  </span>
                  <span className="absolute top-0 -right-3 px-1.5 py-0.5 bg-[#05C3D4] text-white dark:text-black text-[7px] font-black rounded uppercase animate-pulse">
                    Hot
                  </span>
                </Link>
                <Link
                  to="/stores"
                  className="flex items-center h-full text-[11px] font-black uppercase tracking-widest text-foreground/60 hover:text-[#05C3D4] transition-colors mt-0.5"
                >
                  Магазины
                </Link>
              </nav>
            </div>

            {/* Search */}
            <div
              ref={searchRef}
              className="hidden md:block flex-1 max-w-xl relative h-full"
            >
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center h-full bg-muted/50 border border-border rounded-xl px-4 text-muted-foreground hover:border-[#05C3D4]/50 transition-all group"
              >
                <Search
                  size={18}
                  className="mr-3 group-hover:text-[#05C3D4] transition-colors"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Найти аксессуар или гаджет..."
                  className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder:text-muted-foreground text-foreground h-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ml-2 hover:text-foreground h-full flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                )}
              </form>

              {/* Search Results Dropdown */}
              {showResults && searchQuery.length >= 2 && (
                <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  {searchLoading ? (
                    <div className="p-8 flex items-center justify-center">
                      <Loader2
                        className="animate-spin text-[#05C3D4]"
                        size={24}
                      />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                      <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Результаты: {searchResults.length}
                        </span>
                        <button
                          onClick={() => handleSearchSubmit()}
                          className="text-[10px] font-black uppercase tracking-widest text-[#05C3D4] hover:underline"
                        >
                          Показать все
                        </button>
                      </div>
                      {searchResults.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleSearchSelect(item.slug)}
                          className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left group"
                        >
                          <div className="w-12 h-12 bg-white rounded-lg border border-border p-2 shrink-0">
                            <img
                              src={item.image}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-[#05C3D4] transition-colors">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-black text-[#05C3D4]">
                                {new Intl.NumberFormat("ru-RU").format(
                                  item.price
                                )}{" "}
                                ₽
                              </span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                {item.categoryName}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-sm font-bold text-muted-foreground">
                        Ничего не найдено по запросу «{searchQuery}»
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4 ml-auto shrink-0 h-full">
              <a
                href="tel:+79273750555"
                className="hidden lg:flex flex-col items-end mr-2 justify-center h-full mt-0.5"
              >
                <span className="text-xs font-black text-foreground leading-none mb-1">
                  +7 (927) 375-05-55
                </span>
                <span className="text-[9px] font-bold text-[#05C3D4] uppercase tracking-wider leading-none">
                  Ежедневно 9-21
                </span>
              </a>

              <div className="flex items-center gap-1 md:gap-2 h-full">
                <button
                  onClick={toggleTheme}
                  className="w-11 h-11 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors rounded-xl hover:bg-muted"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun size={20} />
                  ) : (
                    <Moon size={20} />
                  )}
                </button>

                {isAuthenticated ? (
                  <Link
                    to="/account"
                    className="hidden md:flex relative w-11 h-11 items-center justify-center text-foreground/40 hover:text-foreground transition-colors rounded-xl hover:bg-muted"
                    aria-label="Личный кабинет"
                  >
                    <User size={20} />
                    {unreadManagerMessagesCount > 0 && (
                      <span className="absolute top-2 right-2 min-w-4 h-4 px-1 bg-amber-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border border-background">
                        {unreadManagerMessagesCount > 9
                          ? "9+"
                          : unreadManagerMessagesCount}
                      </span>
                    )}
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="hidden md:flex w-11 h-11 items-center justify-center text-foreground/40 hover:text-foreground transition-colors rounded-xl hover:bg-muted"
                    aria-label="Войти"
                  >
                    <User size={20} />
                  </Link>
                )}

                <Link
                  to="/checkout"
                  className="hidden md:flex w-11 h-11 items-center justify-center text-foreground/40 hover:text-[#05C3D4] transition-colors rounded-xl hover:bg-muted relative"
                  aria-label="Корзина"
                >
                  <ShoppingCart size={22} />
                  {getItemCount() > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-[#05C3D4] text-white dark:text-black text-[8px] font-black flex items-center justify-center rounded-full border border-background">
                      {getItemCount()}
                    </span>
                  )}
                </Link>

                {/* Mobile Catalog Trigger */}
                <div className="xl:hidden h-full flex items-center">
                  <CatalogTrigger />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[76px]" />
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </>
  );
}
