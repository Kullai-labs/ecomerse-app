import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from './api'

interface User {
  id: string; email: string; name: string; role: string; phone?: string
  vendor?: { id: string; storeName: string; status: string } | null
}

interface CartItem {
  id: string; quantity: number
  product: { id: string; title: string; price: number; images: { url: string }[]; vendor: { id: string; storeName: string }; stock: number }
  variant?: { id: string; name: string; price: number; stock: number } | null
}

interface AppContext {
  user: User | null; setUser: (u: User | null) => void
  cart: CartItem[]; cartCount: number
  refreshCart: () => Promise<void>
  addToCart: (productId: string, variantId?: string, quantity?: number) => Promise<void>
  removeFromCart: (itemId: string) => Promise<void>
  updateCartItem: (itemId: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  notifications: any[]; unreadCount: number
  refreshNotifications: () => Promise<void>
  page: string; setPage: (p: string) => void
  pageData: any; setPageData: (d: any) => void
  loading: boolean; setLoading: (l: boolean) => void
  toast: { message: string; type: 'success' | 'error' } | null; showToast: (m: string, t?: 'success' | 'error') => void
}

const StoreContext = createContext<AppContext | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [page, setPage] = useState('store')
  const [pageData, setPageData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const refreshCart = useCallback(async () => {
    if (!user) { setCart([]); return }
    try {
      const data = await apiGet(`/cart/${user.id}`)
      setCart(data.items || [])
    } catch { setCart([]) }
  }, [user])

  const addToCart = useCallback(async (productId: string, variantId?: string, quantity = 1) => {
    if (!user) { showToast('Please login to add items to cart', 'error'); return }
    await apiPost('/cart/add', { userId: user.id, productId, variantId, quantity })
    await refreshCart()
    showToast('Added to cart!')
  }, [user, refreshCart, showToast])

  const removeFromCart = useCallback(async (itemId: string) => {
    await apiDelete(`/cart/${itemId}`)
    await refreshCart()
  }, [refreshCart])

  const updateCartItem = useCallback(async (itemId: string, quantity: number) => {
    await apiPut(`/cart/${itemId}`, { quantity })
    await refreshCart()
  }, [refreshCart])

  const clearCart = useCallback(async () => {
    if (!user) return
    await apiDelete(`/cart/clear/${user.id}`)
    setCart([])
  }, [user])

  const refreshNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); return }
    try {
      const data = await apiGet(`/notifications/${user.id}`)
      setNotifications(data.notifications || [])
    } catch { setNotifications([]) }
  }, [user])

  useEffect(() => {
    const token = localStorage.getItem('saasum_token')
    if (token) {
      apiGet('/auth/me').then(data => {
        if (data.user) {
          setUser(data.user)
        } else {
          localStorage.removeItem('saasum_token')
        }
      }).catch(() => localStorage.removeItem('saasum_token'))
    }
  }, [])

  useEffect(() => {
    if (user) {
      refreshCart()
      refreshNotifications()
    }
  }, [user, refreshCart, refreshNotifications])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <StoreContext.Provider value={{
      user, setUser, cart, cartCount, refreshCart, addToCart, removeFromCart, updateCartItem, clearCart,
      notifications, unreadCount, refreshNotifications,
      page, setPage, pageData, setPageData, loading, setLoading,
      toast, showToast,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
