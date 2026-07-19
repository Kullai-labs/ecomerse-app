import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store-context'
import { apiGet, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ArrowLeft, CreditCard, Banknote, MapPin, CheckCircle } from 'lucide-react'

export default function Checkout() {
  const { cart, user, setPage, clearCart, showToast } = useStore()
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState('')
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [newAddress, setNewAddress] = useState({ label: 'Home', line1: '', city: '', state: '', pincode: '', phone: '' })
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState<any>(null)

  const subtotal = cart.reduce((sum, item) => {
    const price = item.variant ? item.variant.price : item.product.price
    return sum + price * item.quantity
  }, 0)
  const shipping = subtotal > 500 ? 0 : 49
  const total = subtotal + shipping - couponDiscount
  const formatPrice = (p: number) => `₹${p.toLocaleString('en-IN')}`

  useEffect(() => {
    if (user) {
      apiGet(`/addresses/${user.id}`).then(d => {
        setAddresses(d.addresses || [])
        const defaultAddr = d.addresses?.find((a: any) => a.isDefault)
        if (defaultAddr) setSelectedAddress(defaultAddr.id)
        if (d.addresses?.length === 0) setShowNewAddress(true)
      }).catch(() => setShowNewAddress(true))
    }
  }, [user])

  const applyCoupon = async () => {
    try {
      const data = await apiPost('/coupons/validate', { code: couponCode, subtotal })
      if (data.coupon) {
        setCouponDiscount(data.coupon.discount)
        showToast(`Coupon applied! You save ${formatPrice(data.coupon.discount)}`)
      }
    } catch (err: any) {
      showToast(err.message, 'error')
      setCouponDiscount(0)
    }
  }

  const saveNewAddress = async () => {
    const data = await apiPost('/addresses', { userId: user!.id, ...newAddress, isDefault: addresses.length === 0 })
    setAddresses(prev => [...prev, data.address])
    setSelectedAddress(data.address.id)
    setShowNewAddress(false)
  }

  const placeOrder = async () => {
    const addrId = selectedAddress || (showNewAddress ? null : null)
    if (!addrId && !showNewAddress) {
      showToast('Please select or add a delivery address', 'error')
      return
    }
    if (showNewAddress && !newAddress.line1) {
      showToast('Please fill in the delivery address', 'error')
      return
    }

    setLoading(true)
    try {
      let addressId = addrId
      if (showNewAddress) {
        const data = await apiPost('/addresses', { userId: user!.id, ...newAddress, isDefault: addresses.length === 0 })
        addressId = data.address.id
      }

      const data = await apiPost('/orders/place', {
        userId: user!.id, addressId, paymentMethod,
        couponCode: couponDiscount > 0 ? couponCode : undefined,
      })

      setOrderPlaced(data.order)
      await clearCart()
      showToast('Order placed successfully!')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  if (orderPlaced) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Order Placed!</h2>
        <p className="text-muted-foreground mb-2">Order Number: <span className="font-mono font-bold">{orderPlaced.orderNumber}</span></p>
        <p className="text-2xl font-bold text-primary mb-6">Total: {formatPrice(orderPlaced.total)}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setPage('dashboard')}>View My Orders</Button>
          <Button variant="outline" onClick={() => setPage('store')}>Continue Shopping</Button>
        </div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Button onClick={() => setPage('store')}>Shop Now</Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => setPage('cart')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Cart
      </Button>
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Address */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Delivery Address</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {addresses.map(addr => (
                <label key={addr.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedAddress === addr.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                  <input type="radio" name="address" checked={selectedAddress === addr.id} onChange={() => { setSelectedAddress(addr.id); setShowNewAddress(false) }} className="mt-1" />
                  <div>
                    <p className="font-medium text-sm">{addr.label} {addr.isDefault && <Badge variant="secondary" className="ml-1 text-xs">Default</Badge>}</p>
                    <p className="text-sm text-muted-foreground">{addr.line1}, {addr.city}, {addr.state} - {addr.pincode}</p>
                  </div>
                </label>
              ))}
              {!showNewAddress && (
                <Button variant="outline" size="sm" onClick={() => setShowNewAddress(true)}>+ Add New Address</Button>
              )}
              {showNewAddress && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Label</Label><Input value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} placeholder="Home" /></div>
                    <div><Label>Phone</Label><Input value={newAddress.phone} onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
                  </div>
                  <div><Label>Address Line</Label><Input value={newAddress.line1} onChange={e => setNewAddress({ ...newAddress, line1: e.target.value })} placeholder="123 Main Street" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>City</Label><Input value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} /></div>
                    <div><Label>State</Label><Input value={newAddress.state} onChange={e => setNewAddress({ ...newAddress, state: e.target.value })} /></div>
                    <div><Label>Pincode</Label><Input value={newAddress.pincode} onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value })} /></div>
                  </div>
                  <Button size="sm" onClick={saveNewAddress}>Save Address</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> Payment Method</CardTitle></CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="cod" /> <Banknote className="w-4 h-4" /> <span className="text-sm font-medium">Cash on Delivery</span>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="upi" /> <CreditCard className="w-4 h-4" /> <span className="text-sm font-medium">UPI (Test Mode)</span>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="card" /> <CreditCard className="w-4 h-4" /> <span className="text-sm font-medium">Credit/Debit Card (Test Mode)</span>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cart.map(item => {
                const price = item.variant ? item.variant.price : item.product.price
                return (
                  <div key={item.id} className="flex gap-2 text-sm">
                    <img src={item.product.images?.[0]?.url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded bg-muted object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-1">{item.product.title}</p>
                      <p className="text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium">{formatPrice(price * item.quantity)}</span>
                  </div>
                )
              })}

              <div className="border-t pt-3 space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Coupon code" value={couponCode} onChange={e => setCouponCode(e.target.value)} className="text-sm h-9" />
                  <Button size="sm" variant="outline" onClick={applyCoupon} className="shrink-0">Apply</Button>
                </div>
                {couponDiscount > 0 && <p className="text-xs text-green-600">✓ Coupon applied: -{formatPrice(couponDiscount)}</p>}
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}</span></div>
                {couponDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatPrice(couponDiscount)}</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="text-primary">{formatPrice(total)}</span></div>
              </div>

              <Button className="w-full" size="lg" onClick={placeOrder} disabled={loading}>
                {loading ? 'Placing Order...' : `Place Order · ${formatPrice(total)}`}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Demo coupons: WELCOME10, FLAT200</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
