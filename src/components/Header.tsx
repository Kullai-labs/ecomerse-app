import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ShoppingCart, User, Search, Store, Bell, LayoutDashboard, Shield, LogOut } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const { user, setUser, cartCount, unreadCount, setPage, page } = useStore()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setPage('store')
      window.dispatchEvent(new CustomEvent('store-search', { detail: { query: searchQuery.trim() } }))
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('saasum_token')
    setUser(null)
    setPage('store')
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <button onClick={() => setPage('store')} className="flex items-center gap-2 font-bold text-xl text-primary shrink-0">
          <Store className="w-7 h-7" />
          <span>Saasum</span>
        </button>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        <nav className="flex items-center gap-1 ml-auto">
          {user?.role === 'admin' && (
            <Button variant={page === 'admin' ? 'default' : 'ghost'} size="sm" onClick={() => setPage('admin')}>
              <Shield className="w-4 h-4 mr-1" /> Admin
            </Button>
          )}
          {user?.role === 'seller' && (
            <Button variant={page.startsWith('vendor') ? 'default' : 'ghost'} size="sm" onClick={() => setPage('vendor-dashboard')}>
              <LayoutDashboard className="w-4 h-4 mr-1" /> Vendor
            </Button>
          )}
          {user && (
            <>
              <Button variant="ghost" size="sm" className="relative" onClick={() => setPage('notifications')}>
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{unreadCount}</Badge>
                )}
              </Button>
              <Button variant="ghost" size="sm" className="relative" onClick={() => setPage('cart')}>
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{cartCount}</Badge>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPage('dashboard')}>
                <User className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{user.name || user.email}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
          {!user && (
            <Button size="sm" onClick={() => setPage('auth')}>
              <User className="w-4 h-4 mr-1" /> Sign In
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
