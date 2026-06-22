import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Sun, Moon, ShoppingCart, User, Search, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";
import { CatalogTrigger } from "./Catalog/CatalogMenu";
import SearchSuggestions from "@/components/search/SearchSuggestions";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const { getItemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Search Logic
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const clickLogMutation = trpc.search.logClick.useMutation();

  const { data: searchResults = { products: [], categories: [], pages: [] }, isLoading: searchLoading } =
    trpc.search.suggestions.useQuery(
      { query: searchQuery },
      { enabled: searchQuery.length >= 2 }
    );

  const { data: orderNotifications } =
    trpc.ecommerce.getMyOrderNotifications.useQuery(undefined, {
      enabled: isAuthenticated,
      retry: false,
    });
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();

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

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const unreadManagerMessagesCount = (() => {
    if (!isAuthenticated || !orderNotifications?.items?.length) return 0;
    return orderNotifications.items.length;
  })();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleSearchSelect = (
    url: string,
    entityType: "product" | "category" | "page",
    entityId: number,
    position: number
  ) => {
    setSearchQuery("");
    setShowResults(false);
    clickLogMutation.mutate({
      entityType,
      entityId,
      position,
      url,
    });
    navigate(url);
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
                  <span className="absolute top-0 -right-5 px-1.5 py-0.5 bg-[#05C3D4] text-white dark:text-black text-[7px] font-black rounded uppercase animate-pulse">
                    Скидки
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
                <SearchSuggestions
                  query={searchQuery}
                  results={searchResults}
                  isLoading={searchLoading}
                  onSelect={handleSearchSelect}
                  onShowAll={() => handleSearchSubmit()}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4 ml-auto shrink-0 h-full">
              <a
                href={`tel:${(siteProfile?.contacts.primaryPhone || "").replace(/\s+/g, "")}`}
                className="hidden lg:flex flex-col items-end mr-2 justify-center h-full mt-0.5"
              >
                <span className="text-xs font-black text-foreground leading-none mb-1">
                  {siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88"}
                </span>
                <span className="text-[9px] font-bold text-[#05C3D4] uppercase tracking-wider leading-none">
                  {siteProfile?.contacts.workingHours || "Ежедневно 9:00–21:00"}
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
