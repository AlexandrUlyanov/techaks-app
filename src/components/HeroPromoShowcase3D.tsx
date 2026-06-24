import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  Html,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import { ArrowLeft, ArrowRight } from "lucide-react";
import * as THREE from "three";
import ProductCard from "@/components/ProductCard";
import HomeSectionActionLink from "@/components/home/HomeSectionActionLink";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackHomepagePromoShowcase } from "@/lib/yandex-metrika";
import { cn } from "@/lib/utils";

type PromoShowcaseCard = {
  id: number;
  slug: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string;
  badge: string | null;
  inStock: boolean;
  categoryName?: string | null;
};

type PromoShowcaseTab = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  href: string;
  products: PromoShowcaseCard[];
};

type HeroPromoShowcase3DProps = {
  showcase: {
    eyebrow: string;
    title: string;
    subtitle: string;
    description: string;
    accent: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    spotlight: PromoShowcaseCard | null;
    categoryRail: Array<{
      slug: string;
      name: string;
      productCount: number;
      href: string;
    }>;
    tabs: PromoShowcaseTab[];
  };
};

type SceneProduct = PromoShowcaseCard & {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

const DESKTOP_LAYOUTS: Record<number, Array<Pick<SceneProduct, "position" | "rotation" | "scale">>> =
  {
    1: [{ position: [0, 0.25, 0.2], rotation: [0, 0, 0], scale: 1.14 }],
    2: [
      { position: [-1.7, -0.1, 0], rotation: [-0.03, 0.12, -0.05], scale: 1.02 },
      { position: [1.75, 0.1, 0.5], rotation: [0.03, -0.12, 0.05], scale: 1.08 },
    ],
    3: [
      { position: [-2.45, 0.8, -0.55], rotation: [0.02, 0.16, -0.08], scale: 0.92 },
      { position: [0.05, 0.1, 0.8], rotation: [0.01, 0.02, 0], scale: 1.16 },
      { position: [2.55, 0.85, -0.5], rotation: [-0.02, -0.16, 0.08], scale: 0.94 },
    ],
    4: [
      { position: [-3.2, 1.1, -0.75], rotation: [0.03, 0.18, -0.08], scale: 0.88 },
      { position: [-1.15, -0.42, 0.32], rotation: [-0.01, 0.08, -0.04], scale: 0.98 },
      { position: [1.25, -0.15, 0.88], rotation: [0.01, -0.04, 0.03], scale: 1.12 },
      { position: [3.38, 1.05, -0.72], rotation: [-0.03, -0.18, 0.08], scale: 0.88 },
    ],
    5: [
      { position: [-3.95, 1.08, -0.85], rotation: [0.03, 0.2, -0.08], scale: 0.84 },
      { position: [-1.85, -0.48, 0.22], rotation: [-0.02, 0.1, -0.05], scale: 0.96 },
      { position: [0.1, 0.28, 1.08], rotation: [0.01, 0.02, 0], scale: 1.2 },
      { position: [2.18, -0.38, 0.28], rotation: [0.02, -0.1, 0.05], scale: 0.97 },
      { position: [4.08, 1.04, -0.88], rotation: [-0.03, -0.2, 0.08], scale: 0.84 },
    ],
  };

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ru-RU").format(price)} ₽`;
}

function buildDiscountLabel(product: PromoShowcaseCard) {
  if (
    typeof product.oldPrice === "number" &&
    product.oldPrice > product.price &&
    product.oldPrice > 0
  ) {
    const percent = Math.max(
      1,
      Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    );
    return `-${percent}%`;
  }

  return product.badge?.trim() || null;
}

function truncateProductName(value: string, maxLength = 54) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function resolveVisibleProducts(products: PromoShowcaseCard[], page: number, count: number) {
  if (products.length <= count) {
    return products;
  }

  return Array.from({ length: count }, (_, index) => products[(page + index) % products.length]);
}

function ProductPanelImage({ image }: { image: string }) {
  const texture = useLoader(THREE.TextureLoader, image);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[0, 0.42, 0.08]}>
      <planeGeometry args={[1.66, 1.66]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function FloatingPromoCard3D({
  product,
  highlighted,
  onHover,
  onLeave,
  onClick,
  reducedMotion,
}: {
  product: SceneProduct;
  highlighted: boolean;
  onHover: (product: PromoShowcaseCard) => void;
  onLeave: () => void;
  onClick: (product: PromoShowcaseCard) => void;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const discountLabel = buildDiscountLabel(product);

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return;

    const targetX = highlighted ? -0.03 + state.pointer.y * 0.06 : state.pointer.y * 0.04;
    const targetY =
      product.rotation[1] + (highlighted ? 0.04 : 0) + state.pointer.x * 0.05;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX,
      1 - Math.exp(-delta * 3)
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY,
      1 - Math.exp(-delta * 3)
    );
  });

  return (
    <Float
      speed={reducedMotion ? 0 : 1.2}
      rotationIntensity={reducedMotion ? 0 : 0.18}
      floatIntensity={reducedMotion ? 0 : highlighted ? 0.32 : 0.24}
    >
      <group
        ref={groupRef}
        position={product.position}
        rotation={product.rotation}
        scale={product.scale * (highlighted ? 1.03 : 1)}
        onPointerOver={event => {
          event.stopPropagation();
          onHover(product);
        }}
        onPointerOut={event => {
          event.stopPropagation();
          onLeave();
        }}
        onClick={event => {
          event.stopPropagation();
          onClick(product);
        }}
      >
        <mesh position={[0, 0.02, -0.09]}>
          <planeGeometry args={[2.42, 3.35]} />
          <meshBasicMaterial color="#05C3D4" transparent opacity={highlighted ? 0.16 : 0.08} />
        </mesh>

        <RoundedBox args={[2.28, 3.18, 0.1]} radius={0.18} smoothness={5}>
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.28}
            metalness={0.02}
            emissive={highlighted ? "#dffafe" : "#ffffff"}
            emissiveIntensity={highlighted ? 0.18 : 0.03}
          />
        </RoundedBox>

        <ProductPanelImage image={product.image} />

        <mesh position={[0, -1.03, 0.07]}>
          <planeGeometry args={[1.86, 0.01]} />
          <meshBasicMaterial color="#e6eef6" transparent opacity={0.9} />
        </mesh>

        <Html position={[-0.83, 1.37, 0.12]} transform distanceFactor={6.5}>
          {discountLabel ? (
            <span
              style={{ pointerEvents: "none" }}
              className="inline-flex rounded-full bg-[#05C3D4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_34px_rgba(5,195,212,0.18)]"
            >
              {discountLabel}
            </span>
          ) : null}
        </Html>
      </group>
    </Float>
  );
}

function PromoShowcaseThreeScene({
  products,
  highlightedId,
  onHover,
  onLeave,
  onSelect,
  reducedMotion,
}: {
  products: PromoShowcaseCard[];
  highlightedId: number | null;
  onHover: (product: PromoShowcaseCard) => void;
  onLeave: () => void;
  onSelect: (product: PromoShowcaseCard) => void;
  reducedMotion: boolean;
}) {
  const sceneProducts = useMemo(() => {
    const layout = DESKTOP_LAYOUTS[Math.min(products.length, 5)] ?? DESKTOP_LAYOUTS[5];
    return products.slice(0, 5).map((product, index) => ({
      ...product,
      ...layout[index],
    }));
  }, [products]);

  return (
    <Canvas camera={{ position: [0, 0.25, 9.2], fov: 32 }} dpr={[1, 1.6]}>
      <ambientLight intensity={1.35} />
      <directionalLight position={[4, 6, 6]} intensity={2.2} color="#ffffff" />
      <pointLight position={[-4, -2, 4]} intensity={1.4} color="#8be6ef" />
      <pointLight position={[5, 3, 2]} intensity={1.2} color="#ffffff" />

      <Suspense fallback={null}>
        <group position={[0, -0.18, 0]}>
          {sceneProducts.map(product => (
            <FloatingPromoCard3D
              key={product.id}
              product={product}
              highlighted={highlightedId === product.id}
              onHover={onHover}
              onLeave={onLeave}
              onClick={onSelect}
              reducedMotion={reducedMotion}
            />
          ))}
        </group>
      </Suspense>

      <Sparkles
        count={18}
        scale={[10, 4.5, 2]}
        size={1.4}
        speed={reducedMotion ? 0 : 0.28}
        opacity={0.22}
        color="#7de9f7"
      />
      <ContactShadows position={[0, -2.15, 0]} blur={2.4} opacity={0.1} scale={10} />
    </Canvas>
  );
}

function ShowcaseInfoPanel({
  product,
  onOpen,
}: {
  product: PromoShowcaseCard;
  onOpen: () => void;
}) {
  const discountLabel = buildDiscountLabel(product);

  return (
    <div className="flex max-w-[23rem] flex-col gap-3 rounded-[26px] bg-white/86 px-5 py-4 backdrop-blur-xl dark:bg-[#10161d]/88">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#05C3D4]">
            {product.categoryName || "Премиальная витрина"}
          </div>
          <div className="text-base font-black leading-tight text-[#131720] dark:text-white">
            {truncateProductName(product.name)}
          </div>
        </div>
        {discountLabel ? (
          <span className="inline-flex shrink-0 rounded-full bg-[#05C3D4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
            {discountLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-end gap-3">
        <span className="text-[1.85rem] font-black leading-none text-[#131720] dark:text-white">
          {formatPrice(product.price)}
        </span>
        {typeof product.oldPrice === "number" && product.oldPrice > product.price ? (
          <span className="pb-1 text-sm font-bold text-slate-400 line-through">
            {formatPrice(product.oldPrice)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            "text-sm font-semibold",
            product.inStock ? "text-green-600" : "text-slate-400"
          )}
        >
          {product.inStock ? "В наличии" : "Нет в наличии"}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#05C3D4] px-4 text-sm font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#21d9e6] dark:text-black"
        >
          Открыть товар
        </button>
      </div>
    </div>
  );
}

export default function HeroPromoShowcase3D({ showcase }: HeroPromoShowcase3DProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const tabs = showcase.tabs;
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
  const [page, setPage] = useState(0);
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const activeTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  );

  useEffect(() => {
    if (!tabs.some(tab => tab.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? "");
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    trackHomepagePromoShowcase({
      action: "view_collection",
      tabId: activeTab.id,
      tabLabel: activeTab.label,
      href: activeTab.href,
    });
  }, [activeTab]);

  useEffect(() => {
    setPage(0);
  }, [activeTabId]);

  if (!activeTab) return null;

  const desktopProducts = resolveVisibleProducts(activeTab.products, page, 5);
  const focusedProduct =
    desktopProducts.find(product => product.id === hoveredProductId) ?? desktopProducts[2] ?? desktopProducts[0];
  const canScrollProducts = activeTab.products.length > 5;

  const handleTabSelect = (tab: PromoShowcaseTab) => {
    setActiveTabId(tab.id);
    setHoveredProductId(null);
    trackHomepagePromoShowcase({
      action: "tab_click",
      tabId: tab.id,
      tabLabel: tab.label,
      href: tab.href,
    });
  };

  const handleOpenProduct = (product: PromoShowcaseCard) => {
    const href = `/product/${product.slug}`;
    trackHomepagePromoShowcase({
      action: "product_click",
      tabId: activeTab.id,
      tabLabel: activeTab.label,
      productId: String(product.id),
      productName: product.name,
      href,
    });
    navigate(href);
  };

  const handleShiftProducts = (direction: "prev" | "next") => {
    if (!canScrollProducts) return;
    setPage(current => {
      const total = activeTab.products.length;
      if (direction === "next") {
        return (current + 1) % total;
      }
      return (current - 1 + total) % total;
    });
  };

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_8%_82%,rgba(5,195,212,0.12),transparent_24%),radial-gradient(circle_at_92%_16%,rgba(5,195,212,0.14),transparent_20%),linear-gradient(180deg,rgba(250,252,255,0.98),rgba(244,249,251,0.98))] transition-colors duration-500 dark:bg-[radial-gradient(circle_at_8%_82%,rgba(5,195,212,0.16),transparent_22%),radial-gradient(circle_at_92%_16%,rgba(5,195,212,0.14),transparent_18%),linear-gradient(180deg,#0e1319,#131a21)]">
      <style>{`
        @keyframes promoShowcaseAura {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.55; }
          50% { transform: translate3d(18px, -16px, 0) scale(1.05); opacity: 0.82; }
          100% { transform: translate3d(-14px, 12px, 0) scale(0.98); opacity: 0.58; }
        }

        @media (prefers-reduced-motion: reduce) {
          .promo-showcase-3d-aura {
            animation: none !important;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="promo-showcase-3d-aura absolute left-[-8%] top-[16%] h-56 w-56 rounded-full bg-[#05C3D4]/14 blur-[120px]"
          style={{ animation: "promoShowcaseAura 16s ease-in-out infinite alternate" }}
        />
        <div
          className="promo-showcase-3d-aura absolute right-[-6%] top-[12%] h-72 w-72 rounded-full bg-sky-200/50 blur-[140px] dark:bg-cyan-500/12"
          style={{ animation: "promoShowcaseAura 19s ease-in-out -6s infinite alternate" }}
        />
        <div
          className="promo-showcase-3d-aura absolute bottom-[-8%] left-[22%] h-64 w-64 rounded-full bg-[#05C3D4]/10 blur-[138px]"
          style={{ animation: "promoShowcaseAura 18s ease-in-out -2s infinite alternate" }}
        />
      </div>

      <div className="container-main relative z-10 py-8 md:py-10 lg:py-12">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <HomeSectionActionLink
              to={activeTab.href}
              label="Смотреть все акции"
              onClick={() =>
                trackHomepagePromoShowcase({
                  action: "primary_cta_click",
                  tabId: activeTab.id,
                  tabLabel: activeTab.label,
                  href: activeTab.href,
                })
              }
              className="min-h-10 self-start"
            />

            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end md:gap-3">
              {tabs.map(tab => {
                const isActive = tab.id === activeTab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabSelect(tab)}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] transition-colors md:min-w-[182px] md:text-[11px]",
                      isActive
                        ? "bg-[#05C3D4] text-white dark:text-black"
                        : "bg-white/72 text-[#171c24] dark:bg-white/8 dark:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isMobile ? (
            <div className="space-y-4">
              <Carousel
                key={activeTab.id}
                opts={{
                  align: "start",
                  loop: activeTab.products.length > 1,
                }}
                className="relative"
              >
                <CarouselContent className="-ml-3 sm:-ml-5">
                  {activeTab.products.map((product, index) => (
                    <CarouselItem
                      key={product.id}
                      className="pl-3 sm:pl-5 basis-[88%] min-[520px]:basis-1/2"
                    >
                      <ProductCard
                        product={{
                          id: product.id,
                          slug: product.slug,
                          name: product.name,
                          price: product.price,
                          oldPrice: product.oldPrice,
                          badge: product.badge,
                          image: product.image,
                          categoryId: 0,
                          categoryName: product.categoryName ?? null,
                          inStock: product.inStock,
                        }}
                        imagePriority={index < 2}
                        blockLinkNavigation={false}
                        onNavigate={url => {
                          trackHomepagePromoShowcase({
                            action: "product_click",
                            tabId: activeTab.id,
                            tabLabel: activeTab.label,
                            productId: String(product.id),
                            productName: product.name,
                            href: url,
                          });
                        }}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden min-[520px]:flex -left-3 top-1/2 h-10 w-10 border-transparent bg-white text-[#171c24] hover:bg-[#05C3D4] hover:text-white dark:bg-[#1a222b] dark:text-white dark:hover:text-black" />
                <CarouselNext className="hidden min-[520px]:flex -right-3 top-1/2 h-10 w-10 border-transparent bg-white text-[#171c24] hover:bg-[#05C3D4] hover:text-white dark:bg-[#1a222b] dark:text-white dark:hover:text-black" />
              </Carousel>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[34px] bg-white/38 px-5 py-6 backdrop-blur-[6px] dark:bg-white/[0.03]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-end">
                <div className="relative h-[36rem] overflow-hidden rounded-[30px]">
                  <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.92),rgba(255,255,255,0.56)_40%,rgba(255,255,255,0.18)_100%)] dark:bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_42%,rgba(255,255,255,0)_100%)]" />

                  <div className="absolute inset-0">
                    <PromoShowcaseThreeScene
                      products={desktopProducts}
                      highlightedId={hoveredProductId}
                      onHover={product => setHoveredProductId(product.id)}
                      onLeave={() => setHoveredProductId(null)}
                      onSelect={handleOpenProduct}
                      reducedMotion={prefersReducedMotion}
                    />
                  </div>

                  {canScrollProducts ? (
                    <>
                      <button
                        type="button"
                        aria-label="Предыдущие товары"
                        onClick={() => handleShiftProducts("prev")}
                        className="absolute left-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-[#171c24] transition-colors hover:bg-[#05C3D4] hover:text-white dark:bg-[#182029]/92 dark:text-white dark:hover:text-black"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label="Следующие товары"
                        onClick={() => handleShiftProducts("next")}
                        className="absolute right-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-[#171c24] transition-colors hover:bg-[#05C3D4] hover:text-white dark:bg-[#182029]/92 dark:text-white dark:hover:text-black"
                      >
                        <ArrowRight size={18} />
                      </button>
                    </>
                  ) : null}
                </div>

                {focusedProduct ? (
                  <div className="self-end xl:pb-6">
                    <ShowcaseInfoPanel
                      product={focusedProduct}
                      onOpen={() => handleOpenProduct(focusedProduct)}
                    />
                  </div>
                ) : (
                  <div className="min-h-[11.25rem]" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
