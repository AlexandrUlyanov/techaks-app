import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router";
import { Toaster } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyBottomBar from "@/components/StickyBottomBar";
import ScrollToTop from "@/components/ScrollToTop";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import DesignThemeBridge from "@/design-system/DesignThemeBridge";
import HomePage from "@/pages/HomePage";
import CatalogMenu from "@/components/Catalog/CatalogMenu";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MaintenancePage from "@/components/MaintenancePage";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";

const CatalogPage = lazy(() => import("@/pages/CatalogPage"));
const ProductPage = lazy(() => import("@/pages/ProductPage"));
const StoresPage = lazy(() => import("@/pages/StoresPage"));
const ContactsPage = lazy(() => import("@/pages/ContactsPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const PromotionsPage = lazy(() => import("@/pages/PromotionsPage"));
const PromotionDetailPage = lazy(() => import("@/pages/PromotionDetailPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogPostPage = lazy(() => import("@/pages/BlogPostPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const PaymentResultPage = lazy(() => import("@/pages/PaymentResultPage"));
const AccountPage = lazy(() => import("@/pages/AccountPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const LegalDocumentPage = lazy(() => import("@/pages/LegalDocumentPage"));

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminReservations = lazy(() => import("@/pages/admin/AdminReservations"));
const AdminStores = lazy(() => import("@/pages/admin/AdminStores"));
const AdminLeads = lazy(() => import("@/pages/admin/AdminLeads"));
const AdminOrderDetails = lazy(() => import("@/pages/admin/AdminOrderDetails"));
const AdminBanners = lazy(() => import("@/pages/admin/AdminBanners"));
const AdminBlog = lazy(() => import("@/pages/admin/AdminBlog"));
const AdminCategories = lazy(() => import("@/pages/admin/AdminCategories"));
const AdminNormalizeSpecs = lazy(() => import("@/pages/admin/AdminNormalizeSpecs"));
const AdminMerchandising = lazy(() => import("@/pages/admin/AdminMerchandising"));
const AdminReviews = lazy(() => import("@/pages/admin/AdminReviews"));
const AdminMerchandisingAi = lazy(
  () => import("@/pages/admin/merchandising/AdminMerchandisingAi")
);
const AdminMerchandisingAssignments = lazy(
  () => import("@/pages/admin/merchandising/AdminMerchandisingAssignments")
);
const AdminMerchandisingBadges = lazy(
  () => import("@/pages/admin/merchandising/AdminMerchandisingBadges")
);
const AdminMerchandisingQuality = lazy(
  () => import("@/pages/admin/merchandising/AdminMerchandisingQuality")
);
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminAuditLog = lazy(() => import("@/pages/admin/AdminAuditLog"));
const AdminFeeds = lazy(() => import("@/pages/admin/AdminFeeds"));
const AdminSeoDashboard = lazy(() => import("@/pages/admin/AdminSeoDashboard"));
const AdminYooKassaSettings = lazy(
  () => import("@/pages/admin/AdminYooKassaSettings")
);
const AdminDesignSystem = lazy(() => import("@/pages/admin/AdminDesignSystem"));
const AdminSearchPage = lazy(() => import("@/pages/admin/search/AdminSearchPage"));
const AdminSearchSettingsPage = lazy(
  () => import("@/pages/admin/search/AdminSearchSettingsPage")
);
const AdminSearchSynonymsPage = lazy(
  () => import("@/pages/admin/search/AdminSearchSynonymsPage")
);
const AdminSearchAnalyticsPage = lazy(
  () => import("@/pages/admin/search/AdminSearchAnalyticsPage")
);
const SyncLayout = lazy(() => import("@/pages/admin/sync/SyncLayout"));
const AdminSyncMenu = lazy(() => import("@/pages/admin/sync/AdminSyncMenu"));
const AdminSyncMoySklad = lazy(
  () => import("@/pages/admin/sync/AdminSyncMoySklad")
);
const AdminSyncMoySkladOrders = lazy(
  () => import("@/pages/admin/sync/AdminSyncMoySkladOrders")
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:color-mix(in_srgb,var(--tech-color-primary)_20%,white)] border-t-[var(--tech-color-primary)]" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isCheckout = location.pathname === "/checkout";
  const shouldNoindex =
    isAdmin ||
    ["/checkout", "/payment/result", "/account", "/search", "/login"].includes(
      location.pathname
    );

  useSeo({ noindex: shouldNoindex, canonicalPath: location.pathname });

  const { data: maintenance } = trpc.settings.getMaintenanceStatus.useQuery(undefined, {
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  if (maintenance?.isEnabled && !isAdmin) {
    return <MaintenancePage reopenDate={maintenance.reopenDate} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <DesignThemeBridge />
      <CatalogMenu />
      {!isAdmin && !isCheckout && <Header />}
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/promotions/:slug" element={<PromotionDetailPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/result" element={<PaymentResultPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/offer" element={<LegalDocumentPage />} />
            <Route path="/privacy-policy" element={<LegalDocumentPage />} />
            <Route path="/payment-delivery" element={<LegalDocumentPage />} />
            <Route path="/returns" element={<LegalDocumentPage />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute action="read" subject="AdminPanel" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="leads/:id" element={<AdminOrderDetails />} />
                <Route path="reservations" element={<AdminReservations />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="stores" element={<AdminStores />} />
                <Route path="banners" element={<AdminBanners />} />
                <Route path="merchandising" element={<AdminMerchandising />} />
                <Route path="merchandising/badges" element={<AdminMerchandisingBadges />} />
                <Route path="merchandising/ai" element={<AdminMerchandisingAi />} />
                <Route
                  path="merchandising/assignments"
                  element={<AdminMerchandisingAssignments />}
                />
                <Route
                  path="merchandising/quality"
                  element={<AdminMerchandisingQuality />}
                />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="blog" element={<AdminBlog />} />
                <Route path="search" element={<AdminSearchPage />}>
                  <Route index element={<AdminSearchSettingsPage />} />
                  <Route path="settings" element={<AdminSearchSettingsPage />} />
                  <Route path="synonyms" element={<AdminSearchSynonymsPage />} />
                  <Route path="analytics" element={<AdminSearchAnalyticsPage />} />
                </Route>
                <Route path="design-system" element={<AdminDesignSystem />} />
                <Route path="audit" element={<AdminAuditLog />} />
                <Route path="feeds" element={<AdminFeeds />} />
                <Route path="seo" element={<AdminSeoDashboard />} />
                <Route path="normalize-specs" element={<AdminNormalizeSpecs />} />

                <Route path="sync" element={<SyncLayout />}>
                  <Route index element={<AdminSyncMenu />} />
                  <Route path="moysklad" element={<AdminSyncMoySklad />} />
                  <Route
                    path="moysklad/orders"
                    element={<AdminSyncMoySkladOrders />}
                  />
                </Route>

                <Route path="settings" element={<AdminSettings />} />
                <Route
                  path="settings/payment/yookassa"
                  element={<AdminYooKassaSettings />}
                />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </main>
      {!isAdmin && !isCheckout && <Footer />}
      {!isAdmin && !isCheckout && <StickyBottomBar />}
      {!isAdmin && <CookieConsentBanner />}
      <Toaster position="top-center" richColors />
    </div>
  );
}
