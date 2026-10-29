// The catalogue. Images live in public/images; swap them and this file to
// make the store yours. Prices are in whole currency units.

export type Category = 'ceramics' | 'textiles' | 'lighting' | 'kitchen' | 'home' | 'pantry'

export const categories: { key: Category; label: string; image: string; blurb: string }[] = [
  { key: 'ceramics', label: 'Ceramics', image: '/images/carafe.jpg', blurb: 'Thrown and glazed by hand' },
  { key: 'textiles', label: 'Textiles', image: '/images/throw.jpg', blurb: 'Washed linen and cotton' },
  { key: 'lighting', label: 'Lighting', image: '/images/lamp.jpg', blurb: 'Warm, low and quiet' },
]

export interface Product {
  slug: string
  name: string
  price: number
  compareAt?: number
  category: Category
  image: string
  badge?: 'New' | 'Bestseller' | 'Low stock'
  short: string
  description: string
  details: string[]
  materials: string
  options?: { name: string; values: string[] }
  featured?: boolean
}

export const products: Product[] = [
  {
    slug: 'basmati-rice',
    name: 'Aged basmati rice',
    price: 289,
    category: 'pantry',
    image: '/images/rice.svg',
    short: '5 kg · single-origin, aged 12 months',
    description: 'Long-grain basmati rice sourced from a single farming cooperative and aged for a fragrant, fluffy finish.',
    details: ['5 kg reusable paper sack', 'Naturally aged for 12 months', 'Harvest lot and packed date shown on delivery'],
    materials: '100% aged basmati rice from a verified farmer cooperative.',
    featured: true,
  },
  {
    slug: 'filter-coffee',
    name: 'South Indian filter coffee',
    price: 399,
    category: 'pantry',
    image: '/images/coffee.svg',
    short: '1 kg · roasted weekly in small batches',
    description: 'A balanced, freshly roasted blend of Arabica and Robusta coffee with a little chicory, packed close to roast day.',
    details: ['1 kg resealable bag', '70% Arabica, 30% Robusta with chicory', 'Roast date printed on the bag'],
    materials: 'Small-batch roasted coffee beans and chicory from traceable Indian farms.',
    featured: true,
  },
  {
    slug: 'cold-pressed-oil',
    name: 'Cold-pressed groundnut oil',
    price: 325,
    category: 'pantry',
    image: '/images/oil.svg',
    short: '1 litre · wood-pressed in small batches',
    description: 'Single-origin groundnuts slowly wood-pressed in small batches for a gently nutty, everyday cooking oil.',
    details: ['1 litre tamper-evident bottle', 'Wood-pressed below 45°C', 'Batch and best-before dates on label'],
    materials: '100% cold-pressed groundnut oil; no added fragrance or preservatives.',
  },
  {
    slug: 'oat-milk-case',
    name: 'Unsweetened oat drink',
    price: 225,
    category: 'pantry',
    image: '/images/oat.svg',
    short: '6 × 1 litre · unsweetened',
    description: 'A mild, unsweetened oat drink in shelf-stable cartons for coffee, cereal and everyday use.',
    details: ['Case of six 1 litre cartons', 'No added sugar', 'Refrigerate after opening'],
    materials: 'Oats, water and a pinch of salt. Check carton for full ingredient and allergen information.',
  },
  {
    slug: 'toor-dal',
    name: 'Unpolished toor dal',
    price: 195,
    category: 'pantry',
    image: '/images/lentils.svg',
    short: '2 kg · sorted and gently cleaned',
    description: 'Everyday toor dal, sorted and gently cleaned without polishing away its natural outer layer.',
    details: ['2 kg resealable food-safe pack', 'Harvest and packed dates shown on bag', 'Rinse before cooking'],
    materials: '100% toor dal from a regional grower collective.',
  },
  {
    slug: 'free-range-eggs',
    name: 'Free-range eggs',
    price: 179,
    category: 'pantry',
    image: '/images/eggs.svg',
    short: '12 eggs · collected and packed weekly',
    description: 'A dozen farm-collected eggs from small free-range flocks, handled and delivered in a recyclable pulp carton.',
    details: ['12 eggs, carefully graded', 'Collected and packed weekly', 'Keep refrigerated after delivery'],
    materials: 'Eggs from a verified small-farm cooperative. Contains egg.',
  },
  {
    slug: 'pour-over-carafe',
    name: 'Pour-over carafe',
    price: 68,
    category: 'ceramics',
    image: '/images/carafe.jpg',
    badge: 'Bestseller',
    short: 'Matte stoneware, 750 ml',
    description:
      'A carafe shaped for the slow pour. The waist sits naturally in the hand and the lip is cut so the last drop lands in the cup, not on the table.',
    details: ['Holds 750 ml', 'Dishwasher safe, though it prefers a rinse', 'Each piece varies slightly in tone'],
    materials: 'Stoneware with a matte sand glaze, fired at 1240°C in our Lisbon studio.',
    featured: true,
  },
  {
    slug: 'speckled-mug-pair',
    name: 'Speckled mug, pair',
    price: 54,
    category: 'ceramics',
    image: '/images/mugs.jpg',
    short: 'Oatmeal glaze, 320 ml each',
    description: 'Two mugs with a generous handle and a lip that is thin enough to drink from well. The speckle comes from iron in the clay, so no two are alike.',
    details: ['Set of two', '320 ml each', 'Microwave and dishwasher safe'],
    materials: 'Iron-flecked stoneware with a satin oatmeal glaze.',
    options: { name: 'Glaze', values: ['Oatmeal', 'Ash', 'Clay'] },
    featured: true,
  },
  {
    slug: 'washed-linen-throw',
    name: 'Washed linen throw',
    price: 148,
    category: 'textiles',
    image: '/images/throw.jpg',
    badge: 'New',
    short: 'Oat, 130 by 180 cm',
    description: 'Heavyweight European flax, stone-washed until it drapes like something you have owned for years. The fringe is twisted by hand.',
    details: ['130 by 180 cm', 'Softens further with every wash', 'Woven in Portugal'],
    materials: '100% European flax linen, pre-washed. Machine wash cool, line dry.',
    options: { name: 'Colour', values: ['Oat', 'Charcoal', 'Sage'] },
    featured: true,
  },
  {
    slug: 'walnut-serving-board',
    name: 'Walnut serving board',
    price: 92,
    category: 'kitchen',
    image: '/images/board.jpg',
    short: 'Solid walnut, 60 cm',
    description: 'A long board cut from a single piece of American black walnut, with a handle turned to sit comfortably in the palm. Finished with food-safe oil.',
    details: ['60 by 14 cm', 'Hand wash and oil occasionally', 'Grain and colour vary'],
    materials: 'Solid American black walnut, finished with beeswax and mineral oil.',
    featured: true,
  },
  {
    slug: 'amber-soy-candle',
    name: 'Soy candle, cedar and fig',
    price: 38,
    category: 'home',
    image: '/images/candle.jpg',
    badge: 'Bestseller',
    short: 'Amber glass, 50 hours',
    description: 'Dry cedar, green fig and a little smoke. Poured by hand in small batches into reusable amber glass with a cotton wick that burns clean.',
    details: ['Approximately 50 hours', 'Reusable glass with a wooden lid', 'Trim the wick to 5 mm before each burn'],
    materials: 'Soy wax, cotton wick, essential and fine fragrance oils.',
    options: { name: 'Scent', values: ['Cedar and fig', 'Tobacco leaf', 'Sea salt'] },
  },
  {
    slug: 'brass-table-lamp',
    name: 'Brass table lamp',
    price: 240,
    category: 'lighting',
    image: '/images/lamp.jpg',
    short: 'Brushed brass, linen shade',
    description: 'A small lamp with a tapered brass base and a natural linen shade that turns any bulb warm. Made for a bedside or a desk corner.',
    details: ['42 cm tall', 'E27 fitting, bulb included', 'Inline dimmer switch'],
    materials: 'Brushed solid brass base, natural linen shade on a steel frame.',
    featured: true,
  },
  {
    slug: 'terracotta-vase',
    name: 'Tall terracotta vase',
    price: 76,
    category: 'ceramics',
    image: '/images/vase.jpg',
    short: 'Unglazed, 34 cm',
    description: 'A tall bottle vase with a narrow neck for a single branch. Left unglazed so the clay keeps its soft, chalky surface.',
    details: ['34 cm tall', 'Water resistant interior', 'Wipe clean'],
    materials: 'Red earthenware, sealed inside.',
  },
  {
    slug: 'waffle-towel-set',
    name: 'Waffle towel set',
    price: 86,
    category: 'textiles',
    image: '/images/towels.jpg',
    short: 'Three towels, cotton',
    description: 'A loose waffle weave that dries fast and feels light on the skin. Gets fluffier with washing, not thinner.',
    details: ['Two bath, one hand towel', 'Long-staple Turkish cotton', 'Machine wash warm'],
    materials: '100% long-staple cotton, 350 gsm.',
    options: { name: 'Colour', values: ['Ivory', 'Stone', 'Moss'] },
    featured: true,
  },
  {
    slug: 'glass-carafe-set',
    name: 'Glass carafe and tumbler',
    price: 44,
    category: 'kitchen',
    image: '/images/glass.jpg',
    short: 'Borosilicate, 1 l',
    description: 'A bedside carafe with a tumbler that doubles as its lid. Thin, light and surprisingly tough.',
    details: ['1 litre carafe, 250 ml tumbler', 'Heat resistant', 'Dishwasher safe'],
    materials: 'Mouth-blown borosilicate glass.',
  },
  {
    slug: 'linen-apron',
    name: 'Linen apron',
    price: 58,
    category: 'textiles',
    image: '/images/apron.jpg',
    short: 'Sage, cross-back',
    description: 'A cross-back apron that stays on the shoulders without a neck strap. Deep front pocket, long ties, no fuss.',
    details: ['One size', 'Cross-back straps', 'Front pocket'],
    materials: '100% washed linen.',
    options: { name: 'Colour', values: ['Sage', 'Natural', 'Charcoal'] },
  },
  {
    slug: 'soapstone-incense-holder',
    name: 'Soapstone incense holder',
    price: 32,
    category: 'home',
    image: '/images/incense.jpg',
    badge: 'Low stock',
    short: 'Hand-carved stone',
    description: 'A pebble of black soapstone with a single hole, carved and polished by hand. Heavy enough to stay put, small enough to travel.',
    details: ['Approximately 9 cm across', 'Fits standard sticks', 'Wipe clean'],
    materials: 'Natural soapstone. Each one is a slightly different shape.',
  },
]

export const bySlug = (slug: string) => products.find((p) => p.slug === slug)
export const featured = products.filter((p) => p.featured)
export const newArrivals = products.slice(0, 4)

export const FREE_SHIPPING_AT = 120
