// ─── Types ────────────────────────────────────────────────────────────────────

export type BeverageCategory =
  | "featured" | "cocktail" | "champagne"
  | "spirit"   | "wine"     | "beer"
  | "shot"     | "non-alcoholic";

export interface Beverage {
  id:           string;
  name:         string;
  tagline:      string;        // short ingredient list shown on card
  description:  string;        // full paragraph shown in modal
  ingredients:  string[];      // bullet list in modal
  category:     BeverageCategory;
  emoji:        string;
  imageUrl?:    string | null; // photo, when set — falls back to emoji when null
  price:        number;
  isAlcoholic:  boolean;
  isAvailable:  boolean;
  isFeatured:   boolean;
  isSignature:  boolean;
  isVip:        boolean;
  prepMinutes:  number;
  tags:         string[];
  pairsWith?:   string;        // food pairing note
}

export interface Location {
  id:       string;
  name:     string;
  section:  string;
  floor:    number;
  isActive: boolean;
}

export interface CartItem {
  beverage:  Beverage;
  quantity:  number;
  note:      string;
}

export interface PlacedOrder {
  id:                string;
  locationName:      string;
  items:             CartItem[];
  estimatedMinutes:  number;
  placedAt:          string;
  surchargeAmount?:  number;
  surchargeLabel?:   string | null;
}

// ─── Category display config ──────────────────────────────────────────────────

export interface CategoryMeta {
  label: string;
  emoji: string;
  shortLabel: string;
}

export const CATEGORY_META: Record<BeverageCategory, CategoryMeta> = {
  featured:       { label: "Featured",     emoji: "✦",  shortLabel: "Featured"    },
  cocktail:       { label: "Cocktails",    emoji: "🍸", shortLabel: "Cocktails"   },
  champagne:      { label: "Champagne",    emoji: "🍾", shortLabel: "Champagne"   },
  spirit:         { label: "Spirits",      emoji: "🥃", shortLabel: "Spirits"     },
  wine:           { label: "Wine",         emoji: "🍷", shortLabel: "Wine"        },
  beer:           { label: "Beer",         emoji: "🍺", shortLabel: "Beer"        },
  shot:           { label: "Shots",        emoji: "⚡",  shortLabel: "Shots"       },
  "non-alcoholic":{ label: "Non-Alcoholic",emoji: "💧", shortLabel: "Non-Alc"    },
};

export const MENU_CATEGORIES: BeverageCategory[] = [
  "cocktail", "champagne", "spirit", "wine", "beer", "shot", "non-alcoholic",
];

// ─── Locations ────────────────────────────────────────────────────────────────

export const LOCATIONS: Location[] = [
  { id:"loc-01", name:"Slot Bay A — Row 3",     section:"Main Slots Floor",   floor:1, isActive:true  },
  { id:"loc-02", name:"Blackjack Table 12",     section:"Table Games East",   floor:1, isActive:true  },
  { id:"loc-03", name:"Poker Room — Seat 8",    section:"High Stakes Poker",  floor:2, isActive:true  },
  { id:"loc-04", name:"VIP Lounge — Section C", section:"VIP Level",          floor:3, isActive:true  },
  { id:"loc-05", name:"Roulette Wheel 4",       section:"Table Games West",   floor:1, isActive:false },
];

// ─── Beverages ────────────────────────────────────────────────────────────────

export const BEVERAGES: Beverage[] = [
  // ── Signature Cocktails ────────────────────────────────────────────────────
  {
    id: "bev-01",
    name: "Royal Flush",
    tagline: "Bourbon · Honey · Lemon · Bitters",
    description: "Our bartenders' crown jewel. Knob Creek small-batch bourbon is shaken with raw wildflower honey syrup, freshly squeezed lemon juice, and a measured dash of aromatic Angostura bitters. Served over a single hand-cut ice cube and finished with an expressed orange peel.",
    ingredients: ["Knob Creek Bourbon", "Wildflower Honey Syrup", "Fresh Lemon Juice", "Angostura Bitters", "Orange Peel"],
    category: "cocktail",
    emoji: "🍸",
    price: 22,
    isAlcoholic: true, isAvailable: true, isFeatured: true, isSignature: true, isVip: false,
    prepMinutes: 5,
    tags: ["signature", "popular", "stirred"],
    pairsWith: "Pairs beautifully with salted nuts or charcuterie.",
  },
  {
    id: "bev-02",
    name: "Midnight Negroni",
    tagline: "Hendrick's Gin · Campari · Sweet Vermouth",
    description: "A modern take on the timeless Italian aperitivo. Hendrick's gin, Campari, and Cocchi Americano rosso are stirred over ice until perfectly diluted and chilled. Served in a crystal rocks glass, garnished with a wide orange peel and a single house-dried cherry.",
    ingredients: ["Hendrick's Gin", "Campari", "Cocchi Americano Rosso", "Orange Peel"],
    category: "cocktail",
    emoji: "🍹",
    price: 20,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: true, isVip: false,
    prepMinutes: 4,
    tags: ["classic", "strong", "bitter"],
    pairsWith: "Best enjoyed before dinner or between hands.",
  },
  {
    id: "bev-03",
    name: "Espresso Martini",
    tagline: "Grey Goose · Kahlúa · Fresh Espresso",
    description: "Grey Goose vodka, Kahlúa coffee liqueur, and a freshly pulled double-shot espresso, dry-shaken vigorously to build the iconic three-bean foam crown. Rich, silky, with a bittersweet finish that keeps you sharp for the next hand.",
    ingredients: ["Grey Goose Vodka", "Kahlúa", "Fresh Double Espresso", "Vanilla Bean Syrup"],
    category: "cocktail",
    emoji: "🍸",
    price: 21,
    isAlcoholic: true, isAvailable: true, isFeatured: true, isSignature: false, isVip: false,
    prepMinutes: 5,
    tags: ["coffee", "popular", "shaken"],
  },
  {
    id: "bev-04",
    name: "House Margarita",
    tagline: "Patrón Silver · Cointreau · Fresh Lime",
    description: "The definitive version of the world's most ordered cocktail. Patrón Silver tequila, Cointreau triple sec, and lime juice pressed to order, shaken hard and served over crushed ice. Available with salted, chili-salt, or unsalted rim.",
    ingredients: ["Patrón Silver Tequila", "Cointreau", "Fresh Lime Juice", "Agave Nectar"],
    category: "cocktail",
    emoji: "🍹",
    price: 18,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 4,
    tags: ["popular", "shaken", "refreshing"],
    pairsWith: "Order a side of guacamole to complete it.",
  },
  {
    id: "bev-05",
    name: "Vegas Vice",
    tagline: "Campari · Blood Orange · Prosecco · Rosemary",
    description: "Born on the casino floor. Campari and fresh blood-orange juice over ice, topped with ice-cold Prosecco and a charred rosemary sprig for a smoky, herbal finish. Vibrant, effervescent, and impossible to resist.",
    ingredients: ["Campari", "Fresh Blood Orange Juice", "Prosecco DOC", "Charred Rosemary", "Elderflower Liqueur"],
    category: "cocktail",
    emoji: "🥂",
    price: 19,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: true, isVip: false,
    prepMinutes: 4,
    tags: ["signature", "bubbly", "refreshing"],
  },
  // ── Champagne ─────────────────────────────────────────────────────────────
  {
    id: "bev-06",
    name: "Moët & Chandon Brut",
    tagline: "Imperial NV · Glass",
    description: "Moët's iconic non-vintage Brut Imperial — the world's most celebrated Champagne. A blend of Pinot Noir, Chardonnay, and Pinot Meunier that balances freshness and maturity with notes of fresh pear, citrus, and a long, elegant finish. Served in a crystal flute.",
    ingredients: ["Pinot Noir", "Chardonnay", "Pinot Meunier"],
    category: "champagne",
    emoji: "🍾",
    price: 35,
    isAlcoholic: true, isAvailable: true, isFeatured: true, isSignature: false, isVip: false,
    prepMinutes: 2,
    tags: ["premium", "celebration", "bubbly"],
    pairsWith: "Perfect for any occasion worth celebrating.",
  },
  {
    id: "bev-07",
    name: "Dom Pérignon 2015",
    tagline: "Vintage Prestige Cuvée · Glass",
    description: "The pinnacle of Champagne craft. Dom Pérignon's 2015 vintage is a masterwork of tension and harmony — white flowers, citrus zest, and toasted almond on the nose, leading to a deep, creamy richness that lasts for minutes. Reserved for those who play at the highest level.",
    ingredients: ["Premier Cru Chardonnay", "Premier Cru Pinot Noir"],
    category: "champagne",
    emoji: "🍾",
    price: 195,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: true,
    prepMinutes: 3,
    tags: ["vip", "ultra-premium", "allocated"],
    pairsWith: "A moment that deserves no food pairing — just appreciation.",
  },
  // ── Spirits ───────────────────────────────────────────────────────────────
  {
    id: "bev-08",
    name: "Pappy Van Winkle 23yr",
    tagline: "Family Reserve · Served Neat",
    description: "One of the rarest whiskeys ever produced. Pappy Van Winkle's Family Reserve 23-year is allocated in microscopic quantities each year. Deep amber, with an extraordinary complexity of dark chocolate, dried fruit, ancient oak, and a finish that lasts for over a minute. Served neat in a warmed Glencairn glass.",
    ingredients: ["Wheat Mash Bill", "23 Years in American Oak"],
    category: "spirit",
    emoji: "🥃",
    price: 145,
    isAlcoholic: true, isAvailable: true, isFeatured: true, isSignature: false, isVip: true,
    prepMinutes: 2,
    tags: ["vip", "rare", "neat", "allocated"],
    pairsWith: "Served alone. This is the pairing.",
  },
  {
    id: "bev-09",
    name: "Johnnie Walker Blue",
    tagline: "Blended Scotch · Served Neat or On the Rocks",
    description: "Assembled from some of Scotland's rarest single malts, including casks over 60 years old. Velvet-smooth with a woven tapestry of sweet honey, dark fruit, smoky Islay notes, and a long, warming finish. One of the finest Scotch whiskies available.",
    ingredients: ["Rare Single Malts", "Grain Whiskies", "Aged up to 60 Years"],
    category: "spirit",
    emoji: "🥃",
    price: 65,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 2,
    tags: ["premium", "scotch"],
  },
  // ── Wine ──────────────────────────────────────────────────────────────────
  {
    id: "bev-10",
    name: "Caymus Cabernet",
    tagline: "Napa Valley · Glass",
    description: "Caymus Special Selection Cabernet Sauvignon is Napa Valley at its most seductive: inky purple, with an exuberant nose of dark cherry, cassis, and mocha, leading to a sumptuous, velvety palate with silky tannins and a finish that goes on and on.",
    ingredients: ["Cabernet Sauvignon", "Napa Valley, California"],
    category: "wine",
    emoji: "🍷",
    price: 28,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 2,
    tags: ["premium", "red", "bold"],
    pairsWith: "Outstanding with red meat — ask about tonight's chef's selections.",
  },
  {
    id: "bev-11",
    name: "Whispering Angel Rosé",
    tagline: "Côtes de Provence · Glass",
    description: "The world's best-selling Provence rosé. Delicate salmon-pink with a shimmering clarity, offering notes of ripe strawberry, white peach, and a hint of orange blossom. Bone dry, light-bodied, and impossibly refreshing — the Riviera in a glass.",
    ingredients: ["Grenache", "Cinsault", "Vermentino", "Côtes de Provence, France"],
    category: "wine",
    emoji: "🥂",
    price: 22,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 2,
    tags: ["rosé", "light", "refreshing"],
  },
  // ── Beer ──────────────────────────────────────────────────────────────────
  {
    id: "bev-12",
    name: "Modelo Especial",
    tagline: "Mexican Lager · Ice Cold",
    description: "A rich, full-flavored Mexican lager with a clean, crisp finish. Brewed with a blend of malted barley, hops, and corn for a smooth, light character. Served ice-cold, straight from the cooler, with a fresh lime wedge.",
    ingredients: ["Barley Malt", "Hops", "Water", "Corn"],
    category: "beer",
    emoji: "🍺",
    price: 9,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 1,
    tags: ["light", "popular", "quick"],
  },
  {
    id: "bev-13",
    name: "Blue Moon",
    tagline: "Belgian White Ale · Draft",
    description: "An American take on a Belgian witbier, brewed with Valencia orange peel and a touch of coriander for a bright, citrusy character. Unfiltered for a naturally cloudy, golden pour. Served with an orange wheel.",
    ingredients: ["Malted Wheat", "Valencia Orange Peel", "Coriander", "Oats"],
    category: "beer",
    emoji: "🍺",
    price: 10,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 1,
    tags: ["craft", "wheat", "citrus"],
  },
  // ── Shots ─────────────────────────────────────────────────────────────────
  {
    id: "bev-14",
    name: "Don Julio 1942",
    tagline: "Añejo Tequila · Served Neat",
    description: "Aged for a minimum of two and a half years in American white oak barrels, Don Julio 1942 delivers a rich, smooth sip with notes of caramel, chocolate, and roasted agave. A true celebration in a shot glass. Named for the year Don Julio González began his tequila journey.",
    ingredients: ["Blue Weber Agave", "Aged 2.5+ Years in American Oak"],
    category: "shot",
    emoji: "🥃",
    price: 28,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 1,
    tags: ["premium", "quick"],
  },
  {
    id: "bev-15",
    name: "Jameson Irish Whiskey",
    tagline: "Triple Distilled · Classic Irish",
    description: "The world's best-selling Irish whiskey. Triple-distilled for exceptional smoothness, with a gentle blend of grain whiskey and single pot still whiskeys that delivers a perfectly balanced flavour — light floral notes, toasted wood, and a long, smooth finish.",
    ingredients: ["Malted Barley", "Unmalted Barley", "Grain Whiskey"],
    category: "shot",
    emoji: "🥃",
    price: 14,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 1,
    tags: ["classic", "smooth", "quick"],
  },
  // ── Non-Alcoholic ──────────────────────────────────────────────────────────
  {
    id: "bev-16",
    name: "Garden Lemonade",
    tagline: "House-Made · Fresh Squeezed · Mint",
    description: "Made entirely to order — freshly squeezed lemons, cold-filtered water, raw local honey, and a generous handful of fresh mint leaves, lightly muddled. No concentrate, no syrups, no shortcuts. Served over hand-crushed ice with a lemon wheel.",
    ingredients: ["Fresh Squeezed Lemons", "Raw Honey", "Fresh Mint", "Cold-Filtered Water"],
    category: "non-alcoholic",
    emoji: "🍋",
    price: 8,
    isAlcoholic: false, isAvailable: true, isFeatured: false, isSignature: true, isVip: false,
    prepMinutes: 3,
    tags: ["signature", "refreshing", "made-to-order"],
  },
  {
    id: "bev-17",
    name: "San Pellegrino",
    tagline: "Natural Sparkling Mineral Water",
    description: "Sourced from the natural spring in San Pellegrino Terme, Italy, this mineral water has a naturally effervescent character and a distinctive mineral finish. Served ice-cold in the bottle with a fresh lemon or lime wedge.",
    ingredients: ["Natural Sparkling Mineral Water"],
    category: "non-alcoholic",
    emoji: "💧",
    price: 6,
    isAlcoholic: false, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 1,
    tags: ["quick", "light"],
  },
  {
    id: "bev-18",
    name: "Seedlip Spice 94",
    tagline: "Non-Alcoholic Spirit · Aromatic",
    description: "The world's leading non-alcoholic spirit. Seedlip Spice 94 is a complex blend of allspice, cardamom, oak, lemon, and grapefruit — served long over ice with premium tonic and garnished with a flamed orange peel. All the ritual and sophistication, none of the alcohol.",
    ingredients: ["Allspice Berry", "Cardamom", "Oak Bark", "Lemon Peel", "Grapefruit Peel"],
    category: "non-alcoholic",
    emoji: "🌿",
    price: 12,
    isAlcoholic: false, isAvailable: true, isFeatured: false, isSignature: true, isVip: false,
    prepMinutes: 3,
    tags: ["sophisticated", "signature", "spirit-free"],
    pairsWith: "The non-alcoholic choice for guests who won't compromise on experience.",
  },
  // ── Added via Supabase admin (bev-19, bev-20) ──────────────────────────────
  {
    id: "bev-19",
    name: "Jack & Coke",
    tagline: "Jack Daniel's · Coca-Cola · Lime",
    description: "A classic that never goes out of style. Jack Daniel's Tennessee whiskey poured over ice and topped with Coca-Cola, finished with a fresh lime wedge. Simple, smooth, and always the right call.",
    ingredients: ["Jack Daniel's Tennessee Whiskey", "Coca-Cola", "Fresh Lime"],
    category: "cocktail",
    emoji: "🥃",
    price: 14,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 2,
    tags: ["classic", "popular", "quick"],
  },
  {
    id: "bev-20",
    name: "Rum Punch",
    tagline: "Spiced Rum · Tropical Juices · Grenadine",
    description: "A vacation in a glass. A blend of spiced and dark rum mixed with pineapple, orange, and a splash of grenadine, finished with a float of fresh nutmeg. Bright, fruity, and built for a casino floor that never sleeps.",
    ingredients: ["Spiced Rum", "Dark Rum", "Pineapple Juice", "Orange Juice", "Grenadine", "Fresh Nutmeg"],
    category: "cocktail",
    emoji: "🍹",
    price: 16,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 4,
    tags: ["tropical", "fruity", "shaken"],
  },
  {
    id: "bev-21",
    name: "White Russian",
    tagline: "Vodka · Kahlúa · Fresh Cream",
    description: "Rich, smooth, and unapologetically indulgent. Premium vodka and Kahlúa coffee liqueur layered over ice with fresh cream, stirred to a silky finish. A late-night favorite for a reason.",
    ingredients: ["Premium Vodka", "Kahlúa", "Fresh Cream"],
    category: "cocktail",
    emoji: "🥛",
    price: 17,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: false, isVip: false,
    prepMinutes: 3,
    tags: ["classic", "creamy", "stirred"],
  },
  {
    id: "bev-22",
    name: "Spicy Martini",
    tagline: "Jalapeño-Infused Vodka · Dry Vermouth · Chili Garnish",
    description: "For guests who like their drinks with an edge. Jalapeño-infused vodka shaken with a touch of dry vermouth and served ice-cold with a sliced chili garnish. Bold, clean, and built to wake up the table.",
    ingredients: ["Jalapeño-Infused Vodka", "Dry Vermouth", "Sliced Jalapeño", "Olive Brine"],
    category: "cocktail",
    emoji: "🌶️",
    price: 19,
    isAlcoholic: true, isAvailable: true, isFeatured: false, isSignature: true, isVip: false,
    prepMinutes: 4,
    tags: ["spicy", "bold", "shaken"],
  },
];
