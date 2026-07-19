import { Hono } from 'hono'
import { prisma } from './src/lib/db'
import { readFileSync, existsSync } from 'fs'

const app = new Hono()

// Download route for the project
app.get('/download', async (c) => {
  const filePath = '/app/workspace/saasum-ecommerce.tar.gz'
  if (existsSync(filePath)) {
    const data = readFileSync(filePath)
    return new Response(data, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="saasum-ecommerce.tar.gz"',
      },
    })
  }
  return c.json({ error: 'Archive not found' }, 404)
})

// Simple hash helper (for demo — use bcrypt in production)
async function hashPassword(pw: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pw + 'saasum_salt_2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${ts}-${rand}`
}

function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  return `INV-${ts}`
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ==================== AUTH ====================

app.post('/auth/register', async (c) => {
  const body = await c.req.json()
  const { email, password, name, role = 'buyer', phone } = body

  if (!email || !password) return c.json({ error: 'Email and password are required' }, 400)
  if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role, phone },
  })

  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

app.post('/auth/login', async (c) => {
  const body = await c.req.json()
  const { email, password } = body

  if (!email || !password) return c.json({ error: 'Email and password are required' }, 400)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return c.json({ error: 'Invalid email or password' }, 401)

  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) return c.json({ error: 'Invalid email or password' }, 401)

  const vendor = user.role === 'seller' ? await prisma.vendor.findUnique({ where: { userId: user.id } }) : null

  return c.json({
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone,
      vendor: vendor ? { id: vendor.id, storeName: vendor.storeName, status: vendor.status } : null,
    },
  })
})

// Simple session token store (in-memory for demo)
const sessions = new Map<string, { userId: string; expiresAt: number }>()

app.post('/auth/session', async (c) => {
  const body = await c.req.json()
  const { userId } = body
  if (!userId) return c.json({ error: 'userId required' }, 400)

  const token = Math.random().toString(36).substring(2)
  sessions.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  return c.json({ token })
})

app.get('/auth/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Not authenticated' }, 401)

  const session = sessions.get(token)
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token)
    return c.json({ error: 'Session expired' }, 401)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { vendor: true },
  })
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone,
      vendor: user.vendor ? { id: user.vendor.id, storeName: user.vendor.storeName, status: user.vendor.status } : null,
    },
  })
})

// ==================== CATEGORIES ====================

app.get('/categories', async (c) => {
  const categories = await prisma.category.findMany({
    include: { children: true, _count: { select: { products: true } } },
    where: { parentId: null },
    orderBy: { name: 'asc' },
  })
  return c.json({ categories })
})

app.post('/categories', async (c) => {
  const body = await c.req.json()
  const { name, icon, parentId } = body
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const slug = slugify(name)
  const category = await prisma.category.create({
    data: { name, slug, icon, parentId },
  })
  return c.json({ category })
})

// ==================== PRODUCTS (STOREFRONT) ====================

app.get('/store/products', async (c) => {
  const { search, category, minPrice, maxPrice, vendor, sort, page = '1', limit = '20' } = c.req.query()

  const where: any = { status: 'active' }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { tags: { contains: search } },
    ]
  }
  if (category) where.category = { slug: category }
  if (vendor) where.vendor = { storeName: { contains: vendor } }
  if (minPrice || maxPrice) {
    where.price = {}
    if (minPrice) where.price.gte = parseFloat(minPrice)
    if (maxPrice) where.price.lte = parseFloat(maxPrice)
  }

  const orderBy: any = sort === 'price_asc' ? { price: 'asc' }
    : sort === 'price_desc' ? { price: 'desc' }
    : sort === 'rating' ? { rating: 'desc' }
    : sort === 'newest' ? { createdAt: 'desc' }
    : { salesCount: 'desc' }

  const take = parseInt(limit)
  const skip = (parseInt(page) - 1) * take

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { images: true, vendor: { select: { id: true, storeName: true, rating: true } }, category: true, variants: true },
      orderBy,
      take, skip,
    }),
    prisma.product.count({ where }),
  ])

  return c.json({ products, total, page: parseInt(page), totalPages: Math.ceil(total / take) })
})

app.get('/store/products/:slug', async (c) => {
  const slug = c.req.param('slug')
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: 'asc' } },
      vendor: { select: { id: true, storeName: true, rating: true, description: true, totalSales: true } },
      category: true,
      variants: true,
      reviews: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!product) return c.json({ error: 'Product not found' }, 404)
  return c.json({ product })
})

app.get('/store/featured', async (c) => {
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    include: { images: true, vendor: { select: { id: true, storeName: true } } },
    orderBy: { salesCount: 'desc' },
    take: 8,
  })
  return c.json({ products })
})

app.get('/store/recommendations/:productId', async (c) => {
  const productId = c.req.param('productId')
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return c.json({ products: [] })

  const products = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: productId }, status: 'active' },
    include: { images: true, vendor: { select: { id: true, storeName: true } } },
    take: 4,
  })
  return c.json({ products })
})

// ==================== VENDOR ====================

app.post('/vendor/apply', async (c) => {
  const body = await c.req.json()
  const { userId, storeName, description, gstin, businessAddress, bankAccount, bankIfsc } = body

  if (!userId || !storeName) return c.json({ error: 'userId and storeName required' }, 400)

  const existing = await prisma.vendor.findUnique({ where: { userId } })
  if (existing) return c.json({ error: 'Vendor profile already exists' }, 409)

  const vendor = await prisma.vendor.create({
    data: { userId, storeName, description, gstin, businessAddress, bankAccount, bankIfsc },
  })

  await prisma.user.update({ where: { id: userId }, data: { role: 'seller' } })

  return c.json({ vendor })
})

app.get('/vendor/dashboard/:vendorId', async (c) => {
  const vendorId = c.req.param('vendorId')

  const [vendor, productCount, orderItems, totalRevenue, pendingPayouts] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId } }),
    prisma.product.count({ where: { vendorId } }),
    prisma.orderItem.findMany({
      where: { vendorId, order: { paymentStatus: 'paid' } },
      include: { order: { select: { id: true, orderNumber: true, status: true, createdAt: true, paymentStatus: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.orderItem.aggregate({
      where: { vendorId, order: { paymentStatus: 'paid' } },
      _sum: { total: true },
    }),
    prisma.payout.aggregate({
      where: { vendorId, status: 'pending' },
      _sum: { amount: true },
    }),
  ])

  if (!vendor) return c.json({ error: 'Vendor not found' }, 404)

  return c.json({
    vendor,
    stats: {
      productCount,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingPayout: pendingPayouts._sum.amount || 0,
      totalOrders: orderItems.length,
    },
    orders: orderItems,
  })
})

app.get('/vendor/products/:vendorId', async (c) => {
  const vendorId = c.req.param('vendorId')
  const products = await prisma.product.findMany({
    where: { vendorId },
    include: { images: true, category: true, variants: true },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ products })
})

app.post('/vendor/products', async (c) => {
  const body = await c.req.json()
  const { vendorId, title, description, categoryId, price, comparePrice, stock, sku, tags, images, variants } = body

  if (!vendorId || !title || !categoryId || !price) {
    return c.json({ error: 'vendorId, title, categoryId, and price are required' }, 400)
  }

  const slug = slugify(title) + '-' + Date.now().toString(36)

  const product = await prisma.product.create({
    data: {
      vendorId, title, slug, description: description || '', categoryId,
      price: parseFloat(price), comparePrice: comparePrice ? parseFloat(comparePrice) : null,
      stock: parseInt(stock) || 0, sku, tags: tags ? JSON.stringify(tags) : null,
      images: images?.length ? { create: images.map((url: string, i: number) => ({ url, position: i })) } : undefined,
      variants: variants?.length ? { create: variants.map((v: any) => ({ name: v.name, price: parseFloat(v.price), stock: parseInt(v.stock) || 0, sku: v.sku })) } : undefined,
    },
    include: { images: true, variants: true },
  })

  return c.json({ product })
})

app.put('/vendor/products/:productId', async (c) => {
  const productId = c.req.param('productId')
  const body = await c.req.json()
  const { title, description, categoryId, price, comparePrice, stock, sku, tags, status } = body

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(categoryId && { categoryId }),
      ...(price && { price: parseFloat(price) }),
      ...(comparePrice !== undefined && { comparePrice: comparePrice ? parseFloat(comparePrice) : null }),
      ...(stock !== undefined && { stock: parseInt(stock) }),
      ...(sku && { sku }),
      ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
      ...(status && { status }),
    },
    include: { images: true, variants: true },
  })

  return c.json({ product })
})

app.delete('/vendor/products/:productId', async (c) => {
  const productId = c.req.param('productId')
  await prisma.product.delete({ where: { id: productId } })
  return c.json({ ok: true })
})

// ==================== CART ====================

app.get('/cart/:userId', async (c) => {
  const userId = c.req.param('userId')
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: { include: { images: true, vendor: { select: { id: true, storeName: true } } } },
      variant: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ items })
})

app.post('/cart/add', async (c) => {
  const body = await c.req.json()
  const { userId, productId, variantId, quantity = 1 } = body

  if (!userId || !productId) return c.json({ error: 'userId and productId required' }, 400)

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.status !== 'active') return c.json({ error: 'Product not available' }, 404)

  const existing = await prisma.cartItem.findFirst({
    where: { userId, productId, variantId: variantId || null },
  })

  if (existing) {
    const newQty = existing.quantity + quantity
    if (newQty > product.stock) return c.json({ error: 'Insufficient stock' }, 400)
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } })
  } else {
    await prisma.cartItem.create({ data: { userId, productId, variantId, quantity } })
  }

  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: { include: { images: true, vendor: { select: { id: true, storeName: true } } } }, variant: true },
  })
  return c.json({ items })
})

app.put('/cart/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  const { quantity } = await c.req.json()

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } })
  } else {
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } })
  }
  return c.json({ ok: true })
})

app.delete('/cart/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  await prisma.cartItem.delete({ where: { id: itemId } })
  return c.json({ ok: true })
})

app.delete('/cart/clear/:userId', async (c) => {
  const userId = c.req.param('userId')
  await prisma.cartItem.deleteMany({ where: { userId } })
  return c.json({ ok: true })
})

// ==================== ADDRESSES ====================

app.get('/addresses/:userId', async (c) => {
  const userId = c.req.param('userId')
  const addresses = await prisma.address.findMany({ where: { userId }, orderBy: { isDefault: 'desc' } })
  return c.json({ addresses })
})

app.post('/addresses', async (c) => {
  const body = await c.req.json()
  const { userId, label, line1, line2, city, state, pincode, country, phone, isDefault } = body

  if (isDefault) {
    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } })
  }

  const address = await prisma.address.create({
    data: { userId, label, line1, line2, city, state, pincode, country: country || 'IN', phone, isDefault: isDefault || false },
  })
  return c.json({ address })
})

app.delete('/addresses/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.address.delete({ where: { id } })
  return c.json({ ok: true })
})

// ==================== COUPONS ====================

app.post('/coupons/validate', async (c) => {
  const body = await c.req.json()
  const { code, subtotal, vendorId } = body

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
  if (!coupon || !coupon.active) return c.json({ error: 'Invalid coupon code' }, 400)
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return c.json({ error: 'Coupon has expired' }, 400)
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return c.json({ error: 'Coupon usage limit reached' }, 400)
  if (coupon.minOrder && subtotal < coupon.minOrder) return c.json({ error: `Minimum order of ₹${coupon.minOrder} required` }, 400)
  if (coupon.vendorId && coupon.vendorId !== vendorId) return c.json({ error: 'Coupon not valid for this vendor' }, 400)

  let discount = coupon.discountType === 'percentage'
    ? (subtotal * coupon.discountValue) / 100
    : coupon.discountValue

  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount)

  return c.json({ coupon: { code: coupon.code, discount, discountType: coupon.discountType, discountValue: coupon.discountValue } })
})

// ==================== ORDERS ====================

app.post('/orders/place', async (c) => {
  const body = await c.req.json()
  const { userId, addressId, paymentMethod, couponCode, notes } = body

  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true, variant: true },
  })

  if (cartItems.length === 0) return c.json({ error: 'Cart is empty' }, 400)

  // Check stock
  for (const item of cartItems) {
    const stock = item.variant ? item.variant.stock : item.product.stock
    if (stock < item.quantity) {
      return c.json({ error: `Insufficient stock for ${item.product.title}` }, 400)
    }
  }

  let subtotal = 0
  let totalTax = 0
  const orderItemsData: any[] = []

  for (const item of cartItems) {
    const price = item.variant ? item.variant.price : item.product.price
    const tax = Math.round(price * item.quantity * 0.18 * 100) / 100 // 18% GST
    const itemTotal = price * item.quantity
    subtotal += itemTotal
    totalTax += tax

    orderItemsData.push({
      vendorId: item.product.vendorId,
      productId: item.product.id,
      variantId: item.variantId,
      title: item.product.title,
      image: item.product.images[0]?.url || null,
      price, quantity: item.quantity, tax, total: itemTotal + tax,
    })
  }

  let discount = 0
  if (couponCode) {
    const couponRes = await fetch(`http://localhost:${process.env.API_SERVER_PORT}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: couponCode, subtotal, vendorId: null }),
    })
    const couponData = await couponRes.json()
    if (couponData.coupon) discount = couponData.coupon.discount
  }

  const shipping = subtotal > 500 ? 0 : 49.0
  const total = subtotal + totalTax + shipping - discount

  const orderNumber = generateOrderNumber()

  const order = await prisma.order.create({
    data: {
      orderNumber, buyerId: userId, addressId, paymentMethod, couponCode, notes,
      subtotal, tax: totalTax, shipping, discount, total,
      paymentStatus: 'paid', // sandbox mode
      items: { create: orderItemsData },
    },
    include: { items: true },
  })

  // Decrement stock
  for (const item of cartItems) {
    if (item.variantId) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      })
    }
    await prisma.product.update({
      where: { id: item.product.id },
      data: { stock: { decrement: item.quantity }, salesCount: { increment: item.quantity } },
    })
    // Check if out of stock
    const updated = await prisma.product.findUnique({ where: { id: item.product.id } })
    if (updated && updated.stock <= 0) {
      await prisma.product.update({ where: { id: item.product.id }, data: { status: 'out_of_stock' } })
    }
  }

  // Clear cart
  await prisma.cartItem.deleteMany({ where: { userId } })

  // Update vendor sales
  const vendorIds = [...new Set(orderItemsData.map(i => i.vendorId))]
  for (const vid of vendorIds) {
    await prisma.vendor.update({ where: { id: vid }, data: { totalSales: { increment: 1 } } })
  }

  // Generate invoice
  const invoiceNumber = generateInvoiceNumber()
  const cgst = totalTax / 2
  const sgst = totalTax / 2

  // Get vendor and buyer info for invoice
  const firstVendor = await prisma.vendor.findFirst({ where: { id: vendorIds[0] } })
  const buyer = await prisma.user.findUnique({ where: { id: userId } })

  await prisma.invoice.create({
    data: {
      orderId: order.id, invoiceNumber, subtotal, cgst, sgst, igst: 0, totalTax, total,
      vendorName: firstVendor?.storeName || 'Unknown', vendorGstin: firstVendor?.gstin || null,
      buyerName: buyer?.name || buyer?.email || 'Customer', buyerEmail: buyer?.email || '',
    },
  })

  // Create notifications
  await prisma.notification.create({
    data: { userId, title: 'Order Placed', message: `Your order ${orderNumber} has been placed successfully.`, type: 'order' },
  })

  for (const vid of vendorIds) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vid } })
    if (vendor) {
      await prisma.notification.create({
        data: { userId: vendor.userId, title: 'New Order', message: `You have a new order ${orderNumber}.`, type: 'order' },
      })
    }
  }

  return c.json({ order })
})

app.get('/orders/:userId', async (c) => {
  const userId = c.req.param('userId')
  const orders = await prisma.order.findMany({
    where: { buyerId: userId },
    include: {
      items: true,
      invoices: true,
      tracking: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ orders })
})

app.get('/orders/detail/:orderId', async (c) => {
  const orderId = c.req.param('orderId')
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      address: true,
      invoices: true,
      tracking: true,
      buyer: { select: { id: true, name: true, email: true } },
    },
  })
  if (!order) return c.json({ error: 'Order not found' }, 404)
  return c.json({ order })
})

app.patch('/orders/:orderId/status', async (c) => {
  const orderId = c.req.param('orderId')
  const { status } = await c.req.json()

  const updateData: any = { status }
  if (status === 'shipped') {
    updateData.shippedAt = new Date()
    // Create mock tracking
    const courierNames = ['BlueDart', 'Delhivery', 'DTDC', 'FedEx', 'ShipRocket']
    await prisma.tracking.create({
      data: {
        orderId,
        courier: courierNames[Math.floor(Math.random() * courierNames.length)],
        trackingId: 'TRK' + Date.now().toString(36).toUpperCase(),
        estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    })
  } else if (status === 'delivered') {
    updateData.deliveredAt = new Date()
    updateData.paymentStatus = 'paid'
  } else if (status === 'cancelled') {
    updateData.cancelledAt = new Date()
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  })

  // Update order items status
  await prisma.orderItem.updateMany({ where: { orderId }, data: { status } })

  // Restore stock if cancelled/returned
  if (status === 'cancelled' || status === 'returned') {
    const items = await prisma.orderItem.findMany({ where: { orderId } })
    for (const item of items) {
      if (item.variantId) {
        await prisma.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } })
      }
      await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
      // Re-enable if was out of stock
      const prod = await prisma.product.findUnique({ where: { id: item.productId } })
      if (prod && prod.status === 'out_of_stock' && prod.stock > 0) {
        await prisma.product.update({ where: { id: item.productId }, data: { status: 'active' } })
      }
    }
  }

  // Notify buyer
  await prisma.notification.create({
    data: {
      userId: order.buyerId, title: `Order ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`,
      message: `Your order ${order.orderNumber} has been ${status.replace('_', ' ')}.`,
      type: 'order',
    },
  })

  return c.json({ order })
})

// ==================== WISHLIST ====================

app.get('/wishlist/:userId', async (c) => {
  const userId = c.req.param('userId')
  const items = await prisma.wishlist.findMany({
    where: { userId },
    include: { product: { include: { images: true, vendor: { select: { storeName: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ items })
})

app.post('/wishlist/toggle', async (c) => {
  const body = await c.req.json()
  const { userId, productId } = body

  const existing = await prisma.wishlist.findUnique({ where: { userId_productId: { userId, productId } } })
  if (existing) {
    await prisma.wishlist.delete({ where: { id: existing.id } })
    return c.json({ added: false })
  } else {
    await prisma.wishlist.create({ data: { userId, productId } })
    return c.json({ added: true })
  }
})

// ==================== REVIEWS ====================

app.post('/reviews', async (c) => {
  const body = await c.req.json()
  const { userId, productId, rating, title, comment } = body

  if (!userId || !productId || !rating) return c.json({ error: 'userId, productId, and rating required' }, 400)

  const existing = await prisma.review.findUnique({ where: { userId_productId: { userId, productId } } })
  if (existing) return c.json({ error: 'You have already reviewed this product' }, 409)

  const review = await prisma.review.create({
    data: { userId, productId, rating: parseInt(rating), title, comment },
    include: { user: { select: { id: true, name: true } } },
  })

  // Update product rating
  const agg = await prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true })
  await prisma.product.update({
    where: { id: productId },
    data: { rating: agg._avg.rating || 0, reviewCount: agg._count },
  })

  return c.json({ review })
})

// ==================== ADMIN ====================

app.get('/admin/vendors', async (c) => {
  const { status } = c.req.query()
  const where = status ? { status } : {}
  const vendors = await prisma.vendor.findMany({
    where,
    include: { user: { select: { id: true, email: true, name: true } }, _count: { select: { products: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ vendors })
})

app.patch('/admin/vendors/:vendorId', async (c) => {
  const vendorId = c.req.param('vendorId')
  const body = await c.req.json()
  const { status, rejectionReason, commissionRate } = body

  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...(status && { status }),
      ...(rejectionReason !== undefined && { rejectionReason }),
      ...(commissionRate !== undefined && { commissionRate: parseFloat(commissionRate) }),
    },
  })

  // Notify vendor
  await prisma.notification.create({
    data: {
      userId: vendor.userId, title: `Vendor Application ${status?.charAt(0).toUpperCase()}${status?.slice(1)}`,
      message: status === 'approved' ? 'Your vendor application has been approved!' : `Your vendor application has been ${status}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      type: 'vendor',
    },
  })

  return c.json({ vendor })
})

app.get('/admin/products', async (c) => {
  const { search, status } = c.req.query()
  const where: any = {}
  if (search) where.OR = [{ title: { contains: search } }]
  if (status) where.status = status

  const products = await prisma.product.findMany({
    where,
    include: { images: true, vendor: { select: { id: true, storeName: true } }, category: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json({ products })
})

app.patch('/admin/products/:productId', async (c) => {
  const productId = c.req.param('productId')
  const { status } = await c.req.json()
  const product = await prisma.product.update({ where: { id: productId }, data: { status } })
  return c.json({ product })
})

app.get('/admin/orders', async (c) => {
  const { status } = c.req.query()
  const where = status ? { status } : {}
  const orders = await prisma.order.findMany({
    where,
    include: { items: true, buyer: { select: { id: true, name: true, email: true } }, invoices: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json({ orders })
})

app.get('/admin/coupons', async (c) => {
  const coupons = await prisma.coupon.findMany({
    include: { vendor: { select: { storeName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ coupons })
})

app.post('/admin/coupons', async (c) => {
  const body = await c.req.json()
  const { code, description, discountType, discountValue, minOrder, maxDiscount, vendorId, usageLimit, expiresAt } = body

  const coupon = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(), description, discountType, discountValue: parseFloat(discountValue),
      minOrder: minOrder ? parseFloat(minOrder) : 0, maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      vendorId, usageLimit: usageLimit ? parseInt(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })
  return c.json({ coupon })
})

app.get('/admin/stats', async (c) => {
  const [totalOrders, totalRevenue, totalVendors, totalProducts, pendingVendors] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { total: true } }),
    prisma.vendor.count(),
    prisma.product.count(),
    prisma.vendor.count({ where: { status: 'pending' } }),
  ])

  return c.json({
    stats: {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      totalVendors,
      totalProducts,
      pendingVendors,
    },
  })
})

app.get('/admin/invoices', async (c) => {
  const invoices = await prisma.invoice.findMany({
    include: { order: { select: { id: true, orderNumber: true, status: true, createdAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json({ invoices })
})

// ==================== NOTIFICATIONS ====================

app.get('/notifications/:userId', async (c) => {
  const userId = c.req.param('userId')
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return c.json({ notifications })
})

app.patch('/notifications/:id/read', async (c) => {
  const id = c.req.param('id')
  await prisma.notification.update({ where: { id }, data: { read: true } })
  return c.json({ ok: true })
})

app.patch('/notifications/read-all/:userId', async (c) => {
  const userId = c.req.param('userId')
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
  return c.json({ ok: true })
})

// ==================== SEED DATA ====================

app.post('/seed', async (c) => {
  // Check if data already exists
  const catCount = await prisma.category.count()
  if (catCount > 0) return c.json({ message: 'Already seeded' })

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Electronics', slug: 'electronics', icon: ' Smartphone' } }),
    prisma.category.create({ data: { name: 'Fashion', slug: 'fashion', icon: '👕' } }),
    prisma.category.create({ data: { name: 'Home & Kitchen', slug: 'home-kitchen', icon: '🏠' } }),
    prisma.category.create({ data: { name: 'Books', slug: 'books', icon: '📚' } }),
    prisma.category.create({ data: { name: 'Sports', slug: 'sports', icon: '⚽' } }),
    prisma.category.create({ data: { name: 'Beauty', slug: 'beauty', icon: '💄' } }),
    prisma.category.create({ data: { name: 'Grocery', slug: 'grocery', icon: '🛒' } }),
    prisma.category.create({ data: { name: 'Toys', slug: 'toys', icon: '🧸' } }),
  ])

  // Create admin
  const adminHash = await hashPassword('admin123')
  const admin = await prisma.user.create({
    data: { email: 'admin@saasum.com', name: 'Admin', passwordHash: adminHash, role: 'admin' },
  })

  // Create demo buyer
  const buyerHash = await hashPassword('buyer123')
  const buyer = await prisma.user.create({
    data: { email: 'buyer@saasum.com', name: 'Demo Buyer', passwordHash: buyerHash, role: 'buyer' },
  })

  // Create demo vendors
  const sellerHash = await hashPassword('seller123')
  const seller1 = await prisma.user.create({
    data: { email: 'vendor1@saasum.com', name: 'Tech Store Owner', passwordHash: sellerHash, role: 'seller' },
  })
  const seller2 = await prisma.user.create({
    data: { email: 'vendor2@saasum.com', name: 'Fashion Hub Owner', passwordHash: sellerHash, role: 'seller' },
  })

  const vendor1 = await prisma.vendor.create({
    data: { userId: seller1.id, storeName: 'TechMart', description: 'Your one-stop electronics shop', gstin: '27AABCU9603R1ZM', status: 'approved', rating: 4.5, totalSales: 150 },
  })
  const vendor2 = await prisma.vendor.create({
    data: { userId: seller2.id, storeName: 'StyleHub', description: 'Latest fashion trends', gstin: '29AACCS1234F1ZP', status: 'approved', rating: 4.2, totalSales: 89 },
  })

  // Create products
  const productData = [
    { vendorId: vendor1.id, categoryId: categories[0].id, title: 'Wireless Bluetooth Headphones', slug: 'wireless-bluetooth-headphones', description: 'Premium noise-cancelling wireless headphones with 30-hour battery life. Crystal-clear audio with deep bass.', price: 2499, stock: 50, rating: 4.5, reviewCount: 120, salesCount: 340, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'] },
    { vendorId: vendor1.id, categoryId: categories[0].id, title: 'Smart Watch Pro', slug: 'smart-watch-pro', description: 'Feature-rich smartwatch with health monitoring, GPS, and 5-day battery life. Water resistant up to 50m.', price: 4999, comparePrice: 6999, stock: 30, rating: 4.3, reviewCount: 85, salesCount: 210, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'] },
    { vendorId: vendor1.id, categoryId: categories[0].id, title: 'USB-C Fast Charger 65W', slug: 'usb-c-fast-charger-65w', description: 'GaN technology compact charger. Charges laptops, tablets, and phones simultaneously.', price: 1299, comparePrice: 1799, stock: 100, rating: 4.7, reviewCount: 200, salesCount: 560, images: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=500'] },
    { vendorId: vendor1.id, categoryId: categories[0].id, title: 'Portable Bluetooth Speaker', slug: 'portable-bluetooth-speaker', description: '360° surround sound with IPX7 waterproof rating. Perfect for outdoor adventures.', price: 1999, stock: 45, rating: 4.4, reviewCount: 95, salesCount: 280, images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500'] },
    { vendorId: vendor2.id, categoryId: categories[1].id, title: 'Premium Cotton T-Shirt', slug: 'premium-cotton-t-shirt', description: 'Ultra-soft 100% organic cotton t-shirt. Available in multiple colors. Relaxed fit.', price: 599, comparePrice: 999, stock: 200, rating: 4.1, reviewCount: 300, salesCount: 1200, images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'] },
    { vendorId: vendor2.id, categoryId: categories[1].id, title: 'Slim Fit Denim Jeans', slug: 'slim-fit-denim-jeans', description: 'Classic slim fit jeans with stretch comfort. Premium denim with modern styling.', price: 1499, comparePrice: 2499, stock: 80, rating: 4.3, reviewCount: 150, salesCount: 450, images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=500'] },
    { vendorId: vendor2.id, categoryId: categories[1].id, title: 'Running Sneakers', slug: 'running-sneakers', description: 'Lightweight performance sneakers with responsive cushioning. Breathable mesh upper.', price: 3499, comparePrice: 4999, stock: 60, rating: 4.6, reviewCount: 80, salesCount: 180, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'] },
    { vendorId: vendor2.id, categoryId: categories[1].id, title: 'Classic Aviator Sunglasses', slug: 'classic-aviator-sunglasses', description: 'Polarized UV400 protection lenses. Lightweight metal frame with spring hinges.', price: 899, stock: 120, rating: 4.2, reviewCount: 60, salesCount: 320, images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500'] },
  ]

  for (const pd of productData) {
    await prisma.product.create({
      data: {
        ...pd,
        price: pd.price,
        comparePrice: pd.comparePrice || null,
        tags: JSON.stringify(['trending', 'bestseller']),
        images: { create: pd.images.map((url, i) => ({ url, position: i })) },
      },
    })
  }

  // Create demo coupon
  await prisma.coupon.create({
    data: { code: 'WELCOME10', description: '10% off on first order', discountType: 'percentage', discountValue: 10, minOrder: 500, maxDiscount: 200, usageLimit: 1000, active: true },
  })

  await prisma.coupon.create({
    data: { code: 'FLAT200', description: '₹200 off on orders above ₹2000', discountType: 'fixed', discountValue: 200, minOrder: 2000, usageLimit: 500, active: true },
  })

  // Create addresses for buyer
  await prisma.address.create({
    data: { userId: buyer.id, label: 'Home', line1: '123 MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', phone: '+91 98765 43210', isDefault: true },
  })

  return c.json({ message: 'Seed data created successfully' })
})

export default app
