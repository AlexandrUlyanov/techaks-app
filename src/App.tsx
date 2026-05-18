import { Routes, Route, useLocation } from "react-router";
import { Toaster } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyBottomBar from "@/components/StickyBottomBar";
import ScrollToTop from "@/components/ScrollToTop";
import HomePage from "@/pages/HomePage";
import CatalogPage from "@/pages/CatalogPage";
import ProductPage from "@/pages/ProductPage";
import StoresPage from "@/pages/StoresPage";
import ContactsPage from "@/pages/ContactsPage";
import PromotionsPage from "@/pages/PromotionsPage";
import PromotionDetailPage from "@/pages/PromotionDetailPage";
import BlogPage from "@/pages/BlogPage";
import BlogPostPage from "@/pages/BlogPostPage";
import CheckoutPage from "@/pages/CheckoutPage";
import AccountPage from "@/pages/AccountPage";
import LoginPage from "@/pages/LoginPage";
import SearchPage from "@/pages/SearchPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import CatalogMenu from "@/components/Catalog/CatalogMenu";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MaintenancePage from "@/components/MaintenancePage";
import { trpc } from "@/providers/trpc";

// Admin Pages
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminReservations from "@/pages/admin/AdminReservations";
import AdminStores from "@/pages/admin/AdminStores";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminOrderDetails from "@/pages/admin/AdminOrderDetails";
import AdminBanners from "@/pages/admin/AdminBanners";
import AdminBlog from "@/pages/admin/AdminBlog";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminNormalizeSpecs from "@/pages/admin/AdminNormalizeSpecs";
import AdminMerchandising from "@/pages/admin/AdminMerchandising";
import AdminReviews from "@/pages/admin/AdminReviews";
import AdminMerchandisingAi from "@/pages/admin/merchandising/AdminMerchandisingAi";
import AdminMerchandisingAssignments from "@/pages/admin/merchandising/AdminMerchandisingAssignments";
import AdminMerchandisingBadges from "@/pages/admin/merchandising/AdminMerchandisingBadges";
import AdminMerchandisingQuality from "@/pages/admin/merchandising/AdminMerchandisingQuality";
import AdminSettings from "@/pages/admin/AdminSettings";
import SyncLayout from "@/pages/admin/sync/SyncLayout";
import AdminSyncMenu from "@/pages/admin/sync/AdminSyncMenu";
import AdminSyncMoySklad from "@/pages/admin/sync/AdminSyncMoySklad";
import { useSeo } from "@/lib/seo";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isCheckout = location.pathname === "/checkout";
  const shouldNoindex = isAdmin || ["/checkout", "/account", "/search", "/login"].includes(location.pathname);

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
      <CatalogMenu />
      {!isAdmin && !isCheckout && <Header />}
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/promotions/:slug" element={<PromotionDetailPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
              <Route path="merchandising/assignments" element={<AdminMerchandisingAssignments />} />
              <Route path="merchandising/quality" element={<AdminMerchandisingQuality />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="normalize-specs" element={<AdminNormalizeSpecs />} />

              <Route path="sync" element={<SyncLayout />}>
                <Route index element={<AdminSyncMenu />} />
                <Route path="moysklad" element={<AdminSyncMoySklad />} />
              </Route>

              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>
        </Routes>
      </main>
      {!isAdmin && !isCheckout && <Footer />}
      {!isAdmin && !isCheckout && <StickyBottomBar />}
      <Toaster position="top-center" richColors />
    </div>
  );
}
