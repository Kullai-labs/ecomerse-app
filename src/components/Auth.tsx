import { useState } from 'react'
import { useStore } from '@/lib/store-context'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Store } from 'lucide-react'

export default function Auth() {
  const { setUser, setPage, showToast } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        const data = await apiPost('/auth/register', { ...form, role })
        const session = await apiPost('/auth/session', { userId: data.user.id })
        localStorage.setItem('saasum_token', session.token)
        setUser(data.user)
        if (role === 'seller') setPage('vendor-onboard')
        else setPage('store')
        showToast(`Welcome, ${data.user.name || data.user.email}!`)
      } else {
        const data = await apiPost('/auth/login', { email: form.email, password: form.password })
        const session = await apiPost('/auth/session', { userId: data.user.id })
        localStorage.setItem('saasum_token', session.token)
        setUser(data.user)
        if (data.user.role === 'admin') setPage('admin')
        else if (data.user.role === 'seller') setPage('vendor-dashboard')
        else setPage('store')
        showToast(`Welcome back, ${data.user.name || data.user.email}!`)
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to Saasum</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button variant={mode === 'login' ? 'default' : 'outline'} onClick={() => setMode('login')}>Sign In</Button>
            <Button variant={mode === 'register' ? 'default' : 'outline'} onClick={() => setMode('register')}>Sign Up</Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={role === 'buyer' ? 'default' : 'outline'} onClick={() => setRole('buyer')} className="h-10">
                      🛍️ Buyer
                    </Button>
                    <Button type="button" variant={role === 'seller' ? 'default' : 'outline'} onClick={() => setRole('seller')} className="h-10">
                      🏪 Seller
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm space-y-1">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Demo Accounts</p>
              <p>👤 Buyer: <code>buyer@saasum.com</code> / <code>buyer123</code></p>
              <p>🏪 Vendor: <code>vendor1@saasum.com</code> / <code>seller123</code></p>
              <p>⚡ Admin: <code>admin@saasum.com</code> / <code>admin123</code></p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
