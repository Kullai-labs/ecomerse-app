import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store-context'
import { apiGet, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Star, ShoppingCart, Heart, ArrowLeft, Truck, Shield, RotateCcw } from 'lucide-react'

export default function ProductDetail() {
  const { pageData, setPage, addToCart, user } = useStore()
  const [product, setProduct] = useState<any>(pageData)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' })
  const [submitting, setSubmitting] = useState(false)
  const [recommendations, setRecommendations] = useState<any[]>([])

  useEffect(() => {
    if (product?.id) {
      apiGet(`/store/products/${product.slug}`).then(d => {
        setProduct(d.product)
        setReviews(d.product.reviews || [])
      }).catch(() => {})
      apiGet(`/store/recommendations/${product.id}`).then(d => setRecommendations(d.products || [])).catch(() => {})
    }
  }, [pageData?.id])

  if (!product) return <div className="p-8 text-center">Product not found</div>

  const price = selectedVariant ? selectedVariant.price : product.price
  const stock = selectedVariant ? selectedVariant.stock : product.stock
  const discount = product.comparePrice ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100) : 0
  const formatPrice = (p: number) => `₹${p.toLocaleString('en-IN')}`

  const submitReview = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const data = await apiPost('/reviews', { userId: user.id, productId: product.id, ...reviewForm })
      setReviews(prev => [data.review, ...prev])
      setReviewForm({ rating: 5, title: '', comment: '' })
    } catch (err: any) {
      alert(err.message)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => setPage('store')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Store
      </Button>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-3">
            <img
              src={product.images?.[selectedImage]?.url || 'https://via.placeholder.com/600'}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {product.images?.map((img: any, i: number) => (
              <button key={i} onClick={() => setSelectedImage(i)}
                className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 border-2 ${selectedImage === i ? 'border-primary' : 'border-transparent'}`}>
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          <Badge variant="outline" className="mb-2">{product.category?.name}</Badge>
          <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
          <p className="text-sm text-muted-foreground mb-3">by {product.vendor?.storeName}</p>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
              ))}
            </div>
            <span className="text-sm font-medium">{product.rating?.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({product.reviewCount} reviews)</span>
          </div>

          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold text-primary">{formatPrice(price)}</span>
            {product.comparePrice && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
                <Badge className="bg-green-100 text-green-700">{discount}% off</Badge>
              </>
            )}
          </div>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Variant:</p>
              <div className="flex gap-2 flex-wrap">
                {product.variants.map((v: any) => (
                  <Button key={v.id} variant={selectedVariant?.id === v.id ? 'default' : 'outline'} size="sm"
                    onClick={() => setSelectedVariant(v)} disabled={v.stock <= 0}>
                    {v.name} {v.stock <= 0 && '(Out of stock)'}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <span className={`text-sm font-medium ${stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {stock > 0 ? `✓ In Stock (${stock} available)` : '✗ Out of Stock'}
            </span>
          </div>

          <div className="flex gap-3 mb-6">
            <div className="flex items-center border rounded-lg">
              <Button variant="ghost" size="sm" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</Button>
              <span className="w-10 text-center font-medium">{quantity}</span>
              <Button variant="ghost" size="sm" onClick={() => setQuantity(Math.min(stock, quantity + 1))}>+</Button>
            </div>
            <Button className="flex-1" size="lg" disabled={stock <= 0} onClick={() => addToCart(product.id, selectedVariant?.id, quantity)}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <Truck className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-medium">Free Delivery</p>
              <p className="text-xs text-muted-foreground">On orders over ₹500</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <Shield className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-medium">Secure Payment</p>
              <p className="text-xs text-muted-foreground">100% protected</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <RotateCcw className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-medium">Easy Returns</p>
              <p className="text-xs text-muted-foreground">7-day return policy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Description & Reviews */}
      <Tabs defaultValue="description" className="mb-12">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="py-4">
          <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          {product.tags && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {JSON.parse(product.tags || '[]').map((tag: string) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="reviews" className="py-4 space-y-4">
          {user && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <h4 className="font-medium mb-3">Write a Review</h4>
                <div className="flex gap-1 mb-2">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewForm({ ...reviewForm, rating: s })}>
                      <Star className={`w-5 h-5 ${s <= reviewForm.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
                <Input placeholder="Review title" className="mb-2" value={reviewForm.title} onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })} />
                <Textarea placeholder="Your review..." className="mb-2" value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })} />
                <Button size="sm" onClick={submitReview} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Review'}</Button>
              </CardContent>
            </Card>
          )}
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No reviews yet. Be the first to review!</p>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="border-b pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <span className="font-medium text-sm">{review.user?.name || 'User'}</span>
                </div>
                {review.title && <p className="font-medium text-sm">{review.title}</p>}
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4">Customers Also Bought</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recommendations.map(rec => (
              <Card key={rec.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setProduct(rec); setPage('product-detail') }}>
                <div className="aspect-square overflow-hidden bg-muted">
                  <img src={rec.images?.[0]?.url || 'https://via.placeholder.com/300'} alt={rec.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{rec.vendor?.storeName}</p>
                  <h4 className="text-sm font-medium line-clamp-1">{rec.title}</h4>
                  <p className="font-bold text-primary">{formatPrice(rec.price)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
