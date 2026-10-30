import { HomeView } from '@/components/home-view'
import { fetchCampaigns, fetchCategories, fetchProducts, type Campaign, type Category, type Product } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let campaigns: Campaign[] = []
  let featured: Product[] = []
  let arrivals: Product[] = []
  let categories: Category[] = []
  let unavailable = false

  try {
    const [campaignList, featuredPage, arrivalsPage, categoryList] = await Promise.all([
      fetchCampaigns(),
      fetchProducts({ sort: 'featured', limit: 6 }),
      fetchProducts({ sort: 'new', limit: 4 }),
      fetchCategories(),
    ])
    campaigns = campaignList.slice(0, 3)
    featured = featuredPage.items
    arrivals = arrivalsPage.items
    categories = categoryList
  } catch {
    unavailable = true
  }

  return (
    <HomeView
      campaigns={campaigns}
      featured={featured}
      arrivals={arrivals}
      categories={categories}
      unavailable={unavailable}
    />
  )
}
