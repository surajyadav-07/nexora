/**
 * ====================================================================
 * NEXORA - Programmatic Product Database Engine
 * Total Products: 200 (Generated via modular algorithms & templates)
 * Ready for future Python Flask + SQLite DB migration
 * ====================================================================
 */

// 1. Category Definitions with target counts and price bounds
const CATEGORY_CONFIG = [
    { category: "Mobiles", count: 30, minPrice: 12999, maxPrice: 129999 },
    { category: "Laptops", count: 25, minPrice: 34999, maxPrice: 189999 },
    { category: "Fashion", count: 30, minPrice: 699, maxPrice: 6499 },
    { category: "Shoes", count: 25, minPrice: 1899, maxPrice: 17999 },
    { category: "Watches", count: 20, minPrice: 1499, maxPrice: 79999 },
    { category: "Electronics", count: 30, minPrice: 899, maxPrice: 39999 },
    { category: "Accessories", count: 20, minPrice: 499, maxPrice: 12999 },
    { category: "Gaming", count: 20, minPrice: 2199, maxPrice: 59999 }
];

// 2. Realistic Brands per Category
const CATEGORY_BRANDS = {
    Mobiles: ["Apple", "Samsung", "OnePlus", "Realme"],
    Laptops: ["Apple", "HP", "Dell", "Lenovo", "Asus"],
    Fashion: ["Nike", "Adidas", "Puma"],
    Shoes: ["Nike", "Adidas", "Puma"],
    Watches: ["Apple", "Samsung", "Titan", "Casio", "Fastrack", "Noise"],
    Electronics: ["Sony", "Boat", "JBL", "Logitech", "Razer", "Apple"],
    Accessories: ["Apple", "Boat", "Fastrack", "Casio", "Logitech"],
    Gaming: ["Sony", "Asus", "Razer", "Logitech"]
};

// 3. Realistic Item Base Models for Programmatic Title Generation
const CATEGORY_MODELS = {
    Mobiles: [
        "iPhone 15 Pro Max 256GB", "iPhone 15 128GB Midnight", "iPhone 14 Plus Blue", "iPhone 13 Starlight",
        "iPhone SE 5G Compact", "Galaxy S24 Ultra AI Edition", "Galaxy S24 Plus Onyx", "Galaxy S23 FE Mint",
        "Galaxy Z Fold 5 Phantom", "Galaxy Z Flip 5 Lavender", "Galaxy A55 5G Iceblue", "Galaxy A35 5G Navy",
        "Galaxy M34 5G Prism", "OnePlus 12 Flowy Emerald", "OnePlus 12R Cool Blue", "OnePlus Open Foldable",
        "OnePlus Nord 3 5G Gray", "OnePlus Nord CE 4 Marble", "Realme GT 5 Pro Flagship", "Realme 12 Pro+ 5G Blue",
        "Realme 12+ 5G Pioneer", "Realme Narzo 60x 5G", "Realme C67 5G Oasis", "iPhone 14 Pro Deep Purple",
        "Galaxy S22 Ultra 256GB", "OnePlus 11 5G Titan", "Realme GT Neo 3 150W", "Galaxy Z Flip 4 Bora",
        "iPhone 13 Pro Alpine", "OnePlus Nord CE 3 Lite"
    ],
    Laptops: [
        "MacBook Pro 16\" M3 Max", "MacBook Pro 14\" M3 Pro", "MacBook Air 15\" M2", "MacBook Air 13\" M1",
        "Spectre x360 2-in-1 OLED", "Envy x360 14 Ryzen 7", "Pavilion Plus 14 Core i7", "Victus 15 Gaming RTX 4050",
        "Omen 16 RTX 4070 Beast", "XPS 15 InfinityEdge OLED", "XPS 13 Plus Ultralight", "Inspiron 15 Core i5",
        "G15 Gaming 165Hz", "Alienware m16 R2 Gaming", "ThinkPad X1 Carbon Gen 11", "Legion Pro 5 16\" WQXGA",
        "IdeaPad Slim 5 AMD", "Yoga 9i Dual OLED", "LOQ 15 Gaming Essential", "ROG Zephyrus G14 OLED",
        "ROG Strix SCAR 16 RTX 4080", "TUF Gaming A15 Military", "Zenbook 14 OLED Ultra 7", "Vivobook 16X Creator",
        "Inspiron 14 2-in-1 Touch"
    ],
    Fashion: [
        "Sportswear Club Fleece Hoodie", "Dri-FIT UV Miler Running Top", "Therma-FIT Puffer Jacket", "Tech Fleece Full-Zip Windrunner",
        "Jordan Flight Graphic Crewneck", "Pro Compression Baselayer Tights", "SB Skateboarding Chinos", "Air Heritage Track Pants",
        "Dri-FIT Basketball Short-Sleeve", "Essential Knit Running Jacket", "Originals Trefoil Classic Hoodie", "Tiro 23 League Training Pants",
        "Essentials 3-Stripes Warm-Up Top", "Adicolor Firebird Track Jacket", "Aeroready HIIT Engineered Tee", "Terrex Multi Wind Jacket",
        "All Szn Fleece Sweatpants", "Designed for Training Tank", "Originals Woven Overshirt", "Sportswear Future Icons Tee",
        "Downtown Graphic Relaxed Hoodie", "BMW M Motorsport Track Top", "Ferrari Race Statement T7 Jacket", "Evostripe Ultimate Joggers",
        "Cloudspun Precision Polo", "Classics Blocked Windbreaker", "Manchester City Replica Jersey", "Running Ultraweave Light Jacket",
        "Power Logo Colorblock Tee", "Court Legacy Tennis Polo"
    ],
    Shoes: [
        "Air Jordan 1 Retro High OG", "Air Max 270 React Triple Black", "Air Force 1 '07 Classic White", "Dunk Low Retro Panda Edition",
        "Pegasus 40 Road Running", "Invincible 3 Cushion Marathon", "Metcon 9 Cross Training", "Mercurial Vapor 15 Turf",
        "Ultraboost Light Running", "Samba Classic Indoor OG", "Gazelle Bold Platform Sneaker", "Stan Smith Primegreen",
        "NMD_R1 Urban Explorer", "Forum Low 84 Retro Basketball", "Adizero Boston 12 Marathon", "Terrex Free Hiker 2.0 GTX",
        "RS-X Efekt Retro Futurism", "Suede Classic XXI Heritage", "Deviate Nitro 2 Carbon Plate", "Slipstream Bboy Nostalgia High",
        "Future Play Soccer Cleats", "Softride Rift Tech Walking", "Blazer Mid '77 Vintage Suede", "Superstar Shell Toe Classics",
        "Velocity Nitro 3 All-Weather"
    ],
    Watches: [
        "Watch Ultra 2 Titanium Cellular", "Watch Series 9 Always-On Retina", "Watch SE 2nd Gen Sport", "Galaxy Watch 6 Classic Rotating",
        "Galaxy Watch 5 Pro Sapphire", "Galaxy Fit 3 AMOLED Band", "Edge Ultra-Slim Ceramic", "Octane Aerobatics Chronograph",
        "Neo Workwear Quartz Analog", "G-Shock GA-2100 Carbon Core", "Vintage A168WG Gold Digital", "Edifice Bluetooth Solar Chrono",
        "G-Shock Mudmaster Master of G", "Limitless FS1 Pro AMOLED", "Reflex Play Plus BT Calling", "Vyb Analog Rose Gold Sunray",
        "ColorFit Pro 5 Max AMOLED", "Halo Plus Elite Metal Strap", "Origin Premium Sensor Smartwatch", "Grandmaster Mechanical Automatic"
    ],
    Electronics: [
        "WH-1000XM5 ANC Headphones", "WF-1000XM5 Flagship Earbuds", "SRS-XG300 Bluetooth Boombox", "HT-S20R 5.1ch Surround Soundbar",
        "Alpha ZV-E10 Mirrorless Vlog Camera", "Airdopes 141 ANC 42H Playback", "Rockerz 550 Over-Ear Headset", "Stone 1200 14W RGB Speaker",
        "Nirvana Ion Spatial Audio", "Storm Call 2 BT Calling", "Flip 6 Waterproof Speaker", "Charge 5 Powerbank Party Speaker",
        "Tune 770NC Adaptive ANC", "Wave Beam True Wireless", "Bar 500 Dolby Atmos Soundbar", "MX Master 3S Ergonomic Mouse",
        "MX Keys S Illuminated Keyboard", "C920x HD Pro 1080p Webcam", "Z407 2.1 Subwoofer Speakers", "Zone Vibe 100 Wireless Headset",
        "BlackShark V2 Pro Esports Headset", "DeathAdder V3 Ultra-Light Mouse", "Huntsman V2 Optical Keyboard", "Seiren Mini USB Condenser Mic",
        "Leviathan V2 X PC Soundbar", "AirPods Pro 2nd Gen USB-C MagSafe", "AirPods Max Spatial Audio Gray", "HomePod Mini Smart Speaker",
        "LinkBuds S Ultra-Light Earbuds", "Quantum 810 Wireless RGB Headset"
    ],
    Accessories: [
        "MagSafe Duo Dual Wireless Charger", "20W USB-C Fast Power Adapter", "AirTag 4-Pack Precision Finding", "Magic Trackpad Multi-Touch",
        "Power Bank 20000mAh 22.5W QC", "Rugged Braided Type-C to Lightning", "Car Charger Dual Rapid Fast", "Polarized Aviator Sunglasses",
        "UV400 Matte Black Wayfarer", "Leatherette Slim Cardholder Wallet", "Scientific Calculator fx-991CW", "Crayon Digital Stylus for iPad",
        "Desk Mat Studio Spill-Resistant", "K380 Multi-Device BT Keyboard", "Pencil 2nd Gen Magnetic Charging", "Universal Travel Adapter 4-in-1",
        "Sport Polycarbonate Backpack 28L", "Lift Vertical Ergonomic Mouse", "Leather Wallet with Find My", "Dual Port 65W GaN Compact Charger"
    ],
    Gaming: [
        "PlayStation 5 Slim 1TB Console", "PlayStation DualSense Edge Controller", "PlayStation VR2 Horizon Bundle", "Pulse 3D Wireless Headset Black",
        "DualSense Wireless Controller Red", "ROG Swift OLED 240Hz Monitor", "ROG Ally Handheld Z1 Extreme", "ROG Throne Qi Stand RGB",
        "ROG Azoth 75% Custom Wireless", "ROG Chakram X Origin Mouse", "Blade 15 Armor Hard Backpack", "Viper V3 Pro 54g Esports Mouse",
        "Wolverine V2 Pro Controller", "Kishi V2 Mobile Controller USB-C", "Nommo V2 Pro 2.1 THX Speakers", "G29 Driving Force Racing Wheel",
        "G PRO X 2 LIGHTSPEED Headset", "G502 X PLUS Wireless RGB Mouse", "G915 TKL Wireless Mechanical Keyboard", "Firefly V2 Pro RGB Mouse Mat"
    ]
};

// 4. Curated Image Pools (High-resolution, verified Unsplash CDN endpoints)
const IMAGE_POOLS = {
    Mobiles: [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80"
    ],
    Laptops: [
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&auto=format&fit=crop&q=80"
    ],
    Fashion: [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=80"
    ],
    Shoes: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600&auto=format&fit=crop&q=80"
    ],
    Watches: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1539874701005-59424fa77e23?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80"
    ],
    Electronics: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1585298723682-7115561c51b7?w=600&auto=format&fit=crop&q=80"
    ],
    Accessories: [
        "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1628149455678-16f37bc392f4?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&auto=format&fit=crop&q=80"
    ],
    Gaming: [
        "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1612287232070-5b57f0ebc728?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1526509867162-5b0c0d1b4b33?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80"
    ]
};

const BADGE_OPTIONS = ["Bestseller", "Hot Deal", "Trending", "New Launch", "Top Rated", "Editor's Choice", ""];

// 5. Programmatic Product Generator
function generateProductDatabase() {
    const database = [];
    let currentId = 1;

    CATEGORY_CONFIG.forEach(cfg => {
        const cat = cfg.category;
        const brands = CATEGORY_BRANDS[cat] || ["NEXORA"];
        const models = CATEGORY_MODELS[cat] || [];
        const images = IMAGE_POOLS[cat] || [];

        for (let i = 0; i < cfg.count; i++) {
            const rawModel = models[i] || `${cat} Premium Model ${i + 1}`;
            
            // Deduce brand from model or assign round-robin
            let brand = brands.find(b => rawModel.toLowerCase().includes(b.toLowerCase()));
            if (!brand) {
                brand = brands[i % brands.length];
            }

            // Ensure title has brand prefix if not already present
            const title = rawModel.toLowerCase().includes(brand.toLowerCase())
                ? rawModel
                : `${brand} ${rawModel}`;

            // Programmatic pricing distribution
            const step = Math.floor((cfg.maxPrice - cfg.minPrice) / cfg.count);
            let price = cfg.minPrice + (step * i);
            price = Math.round(price / 100) * 100 - 1; // e.g. 2999, 14999
            if (price < cfg.minPrice) price = cfg.minPrice;

            // Markup calculation (15% to 42% higher)
            const markup = 1.15 + (((i * 7) % 27) / 100);
            const originalPrice = Math.round((price * markup) / 100) * 100 - 1;

            // Realistic pseudo-random metrics based on index
            const rating = Number((4.1 + (((i * 13) % 9) / 10)).toFixed(1));
            const reviewsCount = 45 + ((i * 47) % 650);
            const stock = 3 + ((i * 11) % 45);
            const badge = BADGE_OPTIONS[(i * 3) % BADGE_OPTIONS.length];
            const image = images[i % images.length];

            const description = `Engineered by ${brand}, the ${title} delivers state-of-the-art performance, premium durability, and sleek aesthetics tailored for modern lifestyles.`;

            database.push({
                id: currentId++,
                title,
                category: cat,
                price,
                originalPrice,
                rating,
                reviewsCount,
                image,
                badge,
                description,
                stock,
                brand
            });
        }
    });

    return database;
}

// Global products database generated programmatically (Total: 200 items)
const products = generateProductDatabase();

// Reusable Helper Functions
function getProductById(id) {
    const numId = parseInt(id, 10);
    return products.find(p => p.id === numId) || null;
}

function getRelatedProducts(category, excludeId, limit = 4) {
    const numExclude = parseInt(excludeId, 10);
    return products
        .filter(p => p.category.toLowerCase() === category.toLowerCase() && p.id !== numExclude)
        .slice(0, limit);
}

function getAllBrands() {
    return [...new Set(products.map(p => p.brand))].sort();
}

function getAllCategories() {
    return [...new Set(products.map(p => p.category))];
}

// Module export for Node.js environments if required
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        products,
        getProductById,
        getRelatedProducts,
        getAllBrands,
        getAllCategories
    };
}
