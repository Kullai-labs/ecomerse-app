import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store-context'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, Users, Package, ShoppingCart, IndianRupee, CheckCircle, XCircle, FileText, Tag } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', suspended: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700', out_of_stock: 'bg-red-100 text-red-700',
}

export default function AdminPanel() {
  const { user, showToast } = useStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<any>({})
  const [vendors, setVendors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCouponDialog, setShowCouponDialog] = useState(false)
  const [couponForm, setCouponForm] = useState({ code: '', description: '', discountType: 'percentage', discountValue: '', minOrder: '', maxDiscount: '', usageLimit: '', expiresAt: '' })
  const [vendorFilter, setVendorFilter] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [s, v, p, o, inv, c] = await Promise.all([
      apiGet('/admin/stats').catch(() => ({ stats: {} })),
      apiGet('/admin/vendors').catch(() => ({ vendors: [] })),
      apiGet('/admin/products').catch(() => ({ products: [] })),
      apiGet('/admin/orders').catch(() => ({ orders: [] })),
      apiGet('/admin/invoices').catch(() => ({ invoices: [] })),
      apiGet('/admin/coupons').catch(() => ({ coupons: [] })),
    ])
    setStats(s.stats || {})
    setVendors(v.vendors || [])
    setProducts(p.products || [])
    setOrders(o.orders || [])
    setInvoices(inv.invoices || [])
    setCoupons(c.coupons || [])
    setLoading(false)
  }

  const approveVendor = async (vendorId: string, status: string) => {
    await apiPatch(`/admin/vendors/${vendorId}`, { status })
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status } : v))
    showToast(`Vendor ${status}`)
  }

  const updateProductStatus = async (productId: string, status: string) => {
    await apiPatch(`/admin/products/${productId}`, { status })
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, status } : p))
    showToast(`Product ${status}`)
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    await apiPatch(`/orders/${orderId}/status`, { status })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    showToast(`Order ${status}`)
  }

  const saveCoupon = async () => {
    try {
      await apiPost('/admin/coupons', couponForm)
      setShowCouponDialog(false)
      setCouponForm({ code: '', description: '', discountType: 'percentage', discountValue: '', minOrder: '', maxDiscount: '', usageLimit: '', expiresAt: '' })
      const c = await apiGet('/admin/coupons')
      setCoupons(c.coupons || [])
      showToast('Coupon created!')
    } catch (err: any) { showToast(err.message, 'error') }
  }

  const formatPrice = (p: number) => `₹${p.toLocaleString('en-IN')}`

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold">Admin Access Required</h2>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">⚡ Admin Panel</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card><CardContent className="p-4 text-center">
          <ShoppingCart className="w-5 h-5 mx-auto text-blue-600 mb-1" />
          <p className="text-xl font-bold">{stats.totalOrders || 0}</p><p className="text-xs text-muted-foreground">Orders</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <IndianRupee className="w-5 h-5 mx-auto text-green-600 mb-1" />
          <p className="text-xl font-bold">{formatPrice(stats.totalRevenue || 0)}</p><p className="text-xs text-muted-foreground">Revenue</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Users className="w-5 h-5 mx-auto text-purple-600 mb-1" />
          <p className="text-xl font-bold">{stats.totalVendors || 0}</p><p className="text-xs text-muted-foreground">Vendors</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Package className="w-5 h-5 mx-auto text-orange-600 mb-1" />
          <p className="text-xl font-bold">{stats.totalProducts || 0}</p><p className="text-xs text-muted-foreground">Products</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <FileText className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
          <p className="text-xl font-bold">{invoices.length}</p><p className="text-xs text-muted-foreground">Invoices</p>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
        </TabsList>

        {/* Vendors */}
        <TabsContent value="vendors">
          <div className="flex gap-2 mb-4">
            <Button variant={vendorFilter === '' ? 'default' : 'outline'} size="sm" onClick={() => setVendorFilter('')}>All</Button>
            <Button variant={vendorFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setVendorFilter('pending')}>Pending</Button>
            <Button variant={vendorFilter === 'approved' ? 'default' : 'outline'} size="sm" onClick={() => setVendorFilter('approved')}>Approved</Button>
            <Button variant={vendorFilter === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => setVendorFilter('rejected')}>Rejected</Button>
          </div>
          <div className="space-y-3">
            {vendors.filter(v => !vendorFilter || v.status === vendorFilter).map(vendor => (
              <Card key={vendor.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{vendor.storeName}</span>
                      <Badge className={STATUS_COLORS[vendor.status] || ''}>{vendor.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{vendor.user?.email} · {vendor.gstin || 'No GSTIN'}</p>
                    <p className="text-xs text-muted-foreground">{vendor._count?.products || 0} products</p>
                  </div>
                  {vendor.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveVendor(vendor.id, 'approved')}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => approveVendor(vendor.id, 'rejected')}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  {vendor.status === 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => approveVendor(vendor.id, 'suspended')}>Suspend</Button>
                  )}
                  {vendor.status === 'suspended' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveVendor(vendor.id, 'approved')}>Reinstate</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products">
          <div className="space-y-3">
            {products.map(p => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <img src={p.images?.[0]?.url || 'https://via.placeholder.com/60'} className="w-14 h-14 rounded bg-muted object-cover" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{p.title}</span>
                      <Badge className={STATUS_COLORS[p.status] || ''}>{p.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.vendor?.storeName} · {p.category?.name} · Stock: {p.stock}</p>
                  </div>
                  <p className="font-bold">{formatPrice(p.price)}</p>
                  <div className="flex gap-1">
                    {p.status === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => updateProductStatus(p.id, 'archived')}>Archive</Button>
                    )}
                    {p.status !== 'active' && (
                      <Button size="sm" variant="outline" onClick={() => updateProductStatus(p.id, 'active')}>Activate</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders">
          <div className="space-y-3">
            {orders.map(order => (
              <Card key={order.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold">{order.orderNumber}</span>
                      <Badge className={STATUS_COLORS[order.status] || ''}>{order.status.replace('_', ' ')}</Badge>
                      <Badge variant="outline">{order.paymentStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.buyer?.name || order.buyer?.email} · {order.items.length} items · {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="font-bold">{formatPrice(order.total)}</p>
                  <Select value={order.status} onValueChange={v => updateOrderStatus(order.id, v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="placed">Placed</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Order</th>
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Buyer</th>
                  <th className="py-2 px-3 text-right">Subtotal</th>
                  <th className="py-2 px-3 text-right">GST</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="py-2 px-3 text-xs">{inv.order?.orderNumber}</td>
                    <td className="py-2 px-3 text-xs">{inv.vendorName}</td>
                    <td className="py-2 px-3 text-xs">{inv.buyerName}</td>
                    <td className="py-2 px-3 text-right text-xs">{formatPrice(inv.subtotal)}</td>
                    <td className="py-2 px-3 text-right text-xs">{formatPrice(inv.totalTax)}</td>
                    <td className="py-2 px-3 text-right font-bold text-xs">{formatPrice(inv.total)}</td>
                    <td className="py-2 px-3 text-xs">{new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Coupons */}
        <TabsContent value="coupons">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowCouponDialog(true)}><Tag className="w-4 h-4 mr-1" /> Create Coupon</Button>
          </div>
          <div className="space-y-3">
            {coupons.map(c => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold">{c.code}</span>
                      <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                  <p className="font-bold">{c.discountType === 'percentage' ? `${c.discountValue}%` : formatPrice(c.discountValue)}</p>
                  <p className="text-xs text-muted-foreground">Min: {formatPrice(c.minOrder)} · Used: {c.usageCount}/{c.usageLimit || '∞'}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Coupon</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Code</Label><Input value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
                <div className="space-y-2"><Label>Description</Label><Input value={couponForm.description} onChange={e => setCouponForm({ ...couponForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Type</Label>
                    <Select value={couponForm.discountType} onValueChange={v => setCouponForm({ ...couponForm, discountType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Value</Label><Input type="number" value={couponForm.discountValue} onChange={e => setCouponForm({ ...couponForm, discountValue: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Min Order (₹)</Label><Input type="number" value={couponForm.minOrder} onChange={e => setCouponForm({ ...couponForm, minOrder: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Max Discount (₹)</Label><Input type="number" value={couponForm.maxDiscount} onChange={e => setCouponForm({ ...couponForm, maxDiscount: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Usage Limit</Label><Input type="number" value={couponForm.usageLimit} onChange={e => setCouponForm({ ...couponForm, usageLimit: e.target.value })} /></div>
                <Button className="w-full" onClick={saveCoupon}>Create Coupon</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
