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
import SearchPage from "@/pages/SearchPage";
import CatalogMenu from "@/components/Catalog/CatalogMenu";

// Admin Pages
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminStores from "@/pages/admin/AdminStores";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminBanners from "@/pages/admin/AdminBanners";
import AdminBlog from "@/pages/admin/AdminBlog";
import AdminCategories from "@/pages/admin/AdminCategories";
import SyncLayout from "@/pages/admin/sync/SyncLayout";
import AdminSyncMenu from "@/pages/admin/sync/AdminSyncMenu";
import AdminSyncMoySklad from "@/pages/admin/sync/AdminSyncMoySklad";

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isCheckout = location.pathname === "/checkout";

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
          <Route path="/account" element={<AccountPage />} />
          <Route path="/search" element={<SearchPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="stores" element={<AdminStores />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="blog" element={<AdminBlog />} />

            <Route path="sync" element={<SyncLayout />}>
              <Route index element={<AdminSyncMenu />} />
              <Route path="moysklad" element={<AdminSyncMoySklad />} />
            </Route>

            <Route
              path="settings"
              element={<div>Настройки системы (в разработке)</div>}
            />
          </Route>
        </Routes>
      </main>
      {!isAdmin && !isCheckout && <Footer />}
      {!isAdmin && !isCheckout && <StickyBottomBar />}
      <Toaster position="top-center" richColors />
    </div>
  );
}
