import { StoreProvider, useStore } from '@/lib/store-context'
import Header from '@/components/Header'
import Auth from '@/components/Auth'
import Storefront from '@/components/Storefront'
import ProductDetail from '@/components/ProductDetail'
import Cart from '@/components/Cart'
import Checkout from '@/components/Checkout'
import BuyerDashboard from '@/components/BuyerDashboard'
import VendorOnboard, { VendorDashboard } from '@/components/VendorDashboard'
import AdminPanel from '@/components/AdminPanel'
import Notifications from '@/components/Notifications'
import { useEffect } from 'react'

function Router() {
  const { page } = useStore()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {page === 'store' && <Storefront />}
        {page === 'auth' && <Auth />}
        {page === 'product-detail' && <ProductDetail />}
        {page === 'cart' && <Cart />}
        {page === 'checkout' && <Checkout />}
        {page === 'dashboard' && <BuyerDashboard />}
        {page === 'vendor-onboard' && <VendorOnboard />}
        {page === 'vendor-dashboard' && <VendorDashboard />}
        {page === 'admin' && <AdminPanel />}
        {page === 'notifications' && <Notifications />}
      </main>
      <Toast />
    </div>
  )
}

function Toast() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-5 ${
      toast.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-green-600 text-white'
    }`}>
      {toast.message}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
