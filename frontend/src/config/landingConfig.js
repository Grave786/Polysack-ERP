/**
 * ============================================================================
 * LANDING PAGE CONFIGURATION — PP POLY & PAPER PRODUCTS
 * ============================================================================
 * 
 * Central configuration file for all company text, contact details, product
 * catalogs, process steps, statistics, and FAQs.
 * 
 * PLACEHOLDER VALUES:
 * Fields marked with "[REPLACE: ...]" are placeholders designed for the site
 * owner to replace with their verified physical information.
 * Any statistic with an empty string or null will be automatically hidden.
 */

export const COMPANY_CONFIG = {
    // ── Static Marketing Copy & Non-Profile Metadata ──────────────────────────
    tagline: 'Strong Packaging. Trusted Quality. Delivered On Time.',
    subTagline: 'Precision-manufactured PP woven sacks, laminated & unlaminated bags, BOPP packaging, liners, and high-tensile woven fabrics for agriculture, chemicals, and industrial bulk handling.',
    yearEstablished: '2018',
    natureOfBusiness: 'Manufacturer & Exporter of PP Woven Sacks & Poly Bags',
    workingHours: 'Monday – Saturday: 9:00 AM – 7:00 PM (Sunday Closed)',

    // ── Social / Online Links ─────────────────────────────────────────────────
    socialLinks: {
        linkedin: '',
        indiamart: '',
        tradeindia: ''
    },

    // ── Images & Media Configuration ──────────────────────────────────────────
    media: {
        factoryBannerImage: '',
        certifications: []
    }
};

// ── Key Numbers & Safe Facts (Hide if value is empty/null) ─────────────────────
export const STATS_CONFIG = [
    {
        id: 'years',
        value: 8,
        suffix: '+',
        label: 'Years of Manufacturing Excellence',
        description: 'Consistent quality supply in poly packaging'
    },
    {
        id: 'capacity',
        value: 1200,
        suffix: '+ MT',
        label: 'Monthly Processing Capacity',
        description: 'High-speed extrusion & circular loom weaving'
    },
    {
        id: 'products',
        value: 50,
        suffix: '+',
        label: 'Bag Sizes & Custom Specifications',
        description: 'Laminated, unlaminated, BOPP & gusseted designs'
    },
    {
        id: 'states',
        value: 18,
        suffix: '+',
        label: 'States Supplied Pan-India',
        description: 'Reliable logistics & multimodal fleet dispatches'
    }
];

// ── Manufacturing Pipeline / Process Timeline (Matches ERP Flow) ──────────────
export const PROCESS_STEPS = [
    {
        step: '01',
        title: 'Tape Extrusion',
        subtitle: 'Virgin PP Granules to High-Tensile Flat Yarn',
        description: 'High-grade polypropylene virgin resin melted, stretched, and heat-set to produce consistent denier tapes with optimal tensile strength and minimal elongation.',
        tags: ['Virgin Polypropylene', 'Controlled Denier', 'UV Additives']
    },
    {
        step: '02',
        title: 'Circular Loom Weaving',
        subtitle: 'Seamless Tubular Fabric Construction',
        description: 'High-precision 4-shuttle and 6-shuttle circular looms weave the PP tapes into robust tubular fabric rolls without side seams, eliminating burst points.',
        tags: ['Tubular Weaving', 'Uniform Mesh', 'Anti-Slip Weave']
    },
    {
        step: '03',
        title: 'Extrusion Lamination',
        subtitle: 'Moisture Barrier & Weatherproofing',
        description: 'Micron-controlled LDPE/PP polymer film extrusion coated onto the woven substrate for 100% moisture barrier, granule containment, and gloss finish.',
        tags: ['LDPE/PP Coating', 'Gloss & Matte', 'Waterproof Barrier']
    },
    {
        step: '04',
        title: 'Flexographic & BOPP Printing',
        subtitle: 'High-Impact Brand Graphics & Multicolour Prints',
        description: 'Corona-treated surfaces printed with treated inks up to multi-color precision (single/double side) or reverse-printed high-definition BOPP films for retail shelf appeal.',
        tags: ['Rotogravure & Flexo', 'Treated Inks', 'Single & Double Side']
    },
    {
        step: '05',
        title: 'Precision Cutting & Sewing',
        subtitle: 'Bottom Stitching & Heavy-Duty Threading',
        description: 'Automated heat/cold cutting to precise length, reinforced single or double-fold bottom stitching with heavy-duty polyester twine to guarantee rated load capacity.',
        tags: ['Heavy Twine Stitched', 'Top Hemming / EZ Open', 'Valve Sacks']
    },
    {
        step: '06',
        title: 'Baling, Packing & Quality Check',
        subtitle: 'Hydraulic Compaction & Strict QC Batch Sign-off',
        description: 'Every production lot undergoes rigorous GSM, drop-test, tensile, and dimension audits before hydraulic baling into tamper-evident strapped bundles.',
        tags: ['Hydraulic Bales', 'Batch Traceability', 'Gate Pass & POD']
    }
];

// ── Product Catalog with Technical Specifications (No prices shown) ──────────
export const PRODUCT_CATEGORIES = [
    'All Products',
    'PP Woven Sacks',
    'Flour & Grain Sacks',
    'Chemical & Polymer Bags',
    'BOPP Laminated Bags',
    'Liners & Heavy Duty',
    'Woven Fabric Rolls'
];

export const PRODUCTS_LIST = [
    {
        id: 'pp-woven-sack-standard',
        name: 'Standard PP Woven Sack',
        category: 'PP Woven Sacks',
        capacity: '25 Kg – 50 Kg',
        gsm: '55 – 85 GSM',
        lamination: 'Unlaminated / Laminated',
        printOption: 'Plain or Multi-Color Flexo',
        shape: 'Flat / Gusseted Bottom',
        bestFor: 'Agriculture grains, pulses, animal feed, sugar & general dry goods.',
        icon: 'Package',
        badge: 'High Demand',
        description: 'Heavy-duty circular-woven polypropylene sacks built from 100% virgin polymer resin with optimal denier control. Specially treated for high burst tensile strength, tear prevention, and balanced UV resistance during transit and warehousing.',
        features: [
            'Custom Dimension & Mesh Count',
            'Single / Double Bottom Stitch',
            'Anti-Slip Weave Pattern',
            'UV Stabilized Virgin Polymer',
            'Safe for Food & Dry Agrochemicals'
        ],
        images: [
            '/images/product-1.webp',
            '/images/product-7.jpg'
        ],
        imageSrc: '/images/product-1.webp',
        imageFit: 'contain',
        imageAlt: 'Standard PP woven sack in orange and green'
    },
    {
        id: 'flour-atta-sack',
        name: '10 Kg / 20 Kg / 30 Kg Flour Sack',
        category: 'Flour & Grain Sacks',
        capacity: '10 Kg, 20 Kg, 30 Kg, 50 Kg',
        gsm: '65 – 95 GSM',
        lamination: 'Extrusion Laminated (Anti-Seepage)',
        printOption: 'Front & Back Multi-Color Flexo Print',
        shape: 'Gusseted with EZ-Open Top',
        bestFor: 'Wheat flour (Atta), Maida, Suji, and powdered food staples.',
        icon: 'Boxes',
        badge: 'Food Grade',
        description: 'Food-contact certified flour and grain sacks featuring precision LDPE extrusion coating to prevent moisture seepage and powder dusting. Finished with clean multi-color flexographic brand graphics and optional EZ-open top seams.',
        features: [
            '100% Food-Grade Certified Material',
            'Zero Seepage Extrusion LDPE Coating',
            'Multi-Color High-Resolution Flexo Print',
            'EZ-Open Easy-Pull Top Stitching',
            'Side Gusseted for Retail Standup'
        ],
        images: [
            '/images/product-5.jpg'
        ],
        imageSrc: '/images/product-5.jpg',
        imageFit: 'contain',
        imageAlt: 'Flour and grain printed packaging sack'
    },
    {
        id: 'chemical-granule-bag',
        name: '25 Kg Chemical & Polymer Bag',
        category: 'Chemical & Polymer Bags',
        capacity: '25 Kg – 50 Kg',
        gsm: '75 – 110 GSM Heavy Duty',
        lamination: 'Laminated with Inside LDPE Liner option',
        printOption: 'High-Contrast Technical & Hazchem Warning Print',
        shape: 'Flat Bottom / Valve Bag',
        bestFor: 'Plastic granules, masterbatches, industrial salts, detergents & agrochemicals.',
        icon: 'ShieldCheck',
        badge: 'Chemical Grade',
        description: 'Rigid heavy-duty sacks formulated to withstand hazardous chemicals, plastic raw materials, and detergent granules. Equipped with high-micron extrusion lamination and optional heat-sealed LDPE inner liners for hygroscopic compound protection.',
        features: [
            'High Tensile Burst Strength (Up to 110 GSM)',
            'Moisture, Chemical & Acid Resistant Barrier',
            'Hazchem Warning Safety Panel Printing',
            'Heat-Sealed Liner Option for Hygroscopic Salts',
            'Anti-Static & Slip-Resistant Surface'
        ],
        images: [
            '/images/product-3.webp'
        ],
        imageSrc: '/images/product-3.webp',
        imageFit: 'contain',
        imageAlt: 'Chemical and polymer granules bag'
    },
    {
        id: 'bopp-laminated-bag',
        name: 'BOPP Multi-Color Laminated Bag',
        category: 'BOPP Laminated Bags',
        capacity: '5 Kg – 25 Kg',
        gsm: '70 – 120 GSM (Substrate + Film)',
        lamination: 'Biaxially Oriented Polypropylene (BOPP) Film',
        printOption: 'Photographic High-Gloss Reverse Print up to 8 Colors',
        shape: 'Side Gusseted / Handle Bag',
        bestFor: 'Premium basmati rice, seeds, pet food, and retail branded packaging.',
        icon: 'Sparkles',
        badge: 'Retail Premium',
        description: 'Ultra-premium packaging combining high-tensile PP woven backing with high-definition reverse rotogravure BOPP film printing. Delivers brilliant retail shelf presence, gloss or matte sheen, and tamper-resistant heat sealing.',
        features: [
            'Up to 8-Color Photorealistic Rotogravure Print',
            'High-Gloss or Luxury Matte Lamination',
            'Side Gussets with Die-Cut Punch Handles',
            'Puncture, Scratch & Friction Proof',
            'Superior Moisture & Odor Containment'
        ],
        images: [
            '/images/product-4.jpg'
        ],
        imageSrc: '/images/product-4.jpg',
        imageFit: 'contain',
        imageAlt: 'BOPP multi-color laminated retail bag'
    },
    {
        id: 'cattle-feed-bag',
        name: '50 Kg Animal & Cattle Feed Bag',
        category: 'PP Woven Sacks',
        capacity: '40 Kg – 50 Kg',
        gsm: '60 – 80 GSM',
        lamination: 'Unlaminated (Breathable) or Laminated',
        printOption: 'Custom Brand Print on Bleached White or Milky Base',
        shape: 'Heavy Bottom Stitched',
        bestFor: 'Cattle feed mash, poultry feed, aquaculture pellets, and de-oiled cakes.',
        icon: 'Package',
        badge: 'Heavy Duty',
        description: 'Breathable or micro-perforated polypropylene sacks manufactured specifically for livestock feed, poultry mash, and aqua pellets. Keeps feed fresh while preventing internal moisture condensation during prolonged storage.',
        features: [
            'Controlled Aeration & Breathable Weave',
            'Engineered for 50 Kg Heavy Bulk Loads',
            'Anti-Slip Weave for High Pallet Stacking',
            'Weather-Resistant Multi-Color Brand Graphics',
            'Reinforced Bottom Hem with Heavy Twine'
        ],
        images: [
            '/images/product-2.webp'
        ],
        imageSrc: '/images/product-2.webp',
        imageFit: 'cover',
        imageAlt: 'Animal and cattle feed woven bag'
    },
    {
        id: 'cement-construction-bag',
        name: '50 Kg Cement & Wall Putty Bag',
        category: 'Chemical & Polymer Bags',
        capacity: '50 Kg',
        gsm: '70 – 90 GSM Micro-Perforated',
        lamination: 'BOPP or Paper-Laminated Woven Sack',
        printOption: 'Single / Double Sided Technical Markings',
        shape: 'Block Bottom Valve Sack',
        bestFor: 'Portland cement, wall putty, tile adhesives, gypsum & minerals.',
        icon: 'Layers',
        badge: 'Burst Proof',
        description: 'Industrial block-bottom valve bags engineered for automated high-speed packing lines. Micro-perforations release entrapped air rapidly while keeping powder locked inside, creating compact, pallet-friendly stackable shapes.',
        features: [
            'Self-Closing Automatic Valve Filling Port',
            'Micro-Perforated De-aeration Channels',
            'Brick-Shaped Block Bottom for Stable Stacking',
            'Zero Spillage & Low Breakage Guarantee',
            'High Drop-Impact & Burst Resistance'
        ],
        images: [
            '/images/product-6.jpg',
            '/images/product-3.webp'
        ],
        imageSrc: '/images/product-6.jpg',
        imageFit: 'contain',
        imageAlt: 'Cement and wall putty block bottom sack'
    },
    {
        id: 'poly-liner-insert-bag',
        name: '25 / 50 Kg PP Sack with LDPE Liner',
        category: 'Liners & Heavy Duty',
        capacity: '25 Kg – 50 Kg',
        gsm: '70 GSM Woven Sack + 25-50 Micron Liner',
        lamination: 'Inserted / Bottom-Tacked LDPE Liner',
        printOption: 'Plain or 2-Color Flexographic',
        shape: 'Bottom Stitched with Top Extended Liner',
        bestFor: 'Hygroscopic chemicals, spices, milk powder, sugar & moisture-critical products.',
        icon: 'ShieldCheck',
        badge: '100% Moisture Proof',
        description: 'Two-in-one packaging solution with an inner virgin LDPE tube liner bottom-tacked or loosely inserted inside a strong woven outer sack. 100% barrier against ambient moisture, vapor transmission, and fine powder migration.',
        features: [
            'Seamless Virgin LDPE Tube Liner Insert',
            'Bottom-Tacked or Loose Cuff Insertion',
            'Hermetic Vapor & Ambient Moisture Barrier',
            'Ideal for Sugar, Milk Powder & Fine Salts',
            'Double-Hemmed Base for Maximum Load Retention'
        ],
        images: [
            '/images/product-7.jpg'
        ],
        imageSrc: '/images/product-7.jpg',
        imageFit: 'cover',
        imageAlt: 'PP woven sack with inner LDPE liner'
    },
    {
        id: 'pp-woven-fabric-roll',
        name: 'PP Woven Circular & Flat Fabric Roll',
        category: 'Woven Fabric Rolls',
        capacity: 'Continuous Rolls (500m – 3000m)',
        gsm: '50 – 140 GSM',
        lamination: 'Uncoated or Coated (15 – 35 Micron)',
        printOption: 'Edge Striped or Custom Marker Lines',
        shape: 'Circular Tubular (12" – 48") or Slit Flat (up to 96")',
        bestFor: 'Tarpaulins, bag conversion plants, wrapping industrial coils & lumber.',
        icon: 'Layers',
        badge: 'Bulk Rolls',
        description: 'Continuously wound tubular and open-flat PP woven fabric rolls. Produced on state-of-the-art multi-shuttle circular looms with uniform denier and weave tension for downstream industrial converting, lumber wraps, and agro-sheets.',
        features: [
            'Tubular Seamless (12"–48") or Slit Flat (Up to 96")',
            'Continuous High-Tension Roll Lengths up to 3,000m',
            'Uncoated, Extrusion-Coated, or BOPP-Laminated',
            'Color-Coded Edge Identification Lines',
            'Heavy-Duty Cores for Automated Converting Machinery'
        ],
        images: [
            '/images/product-8.jpg'
        ],
        imageSrc: '/images/product-8.jpg',
        imageFit: 'cover',
        imageAlt: 'PP woven circular and flat fabric roll'
    }
];

// ── Why Choose Us Features ───────────────────────────────────────────────────
export const WHY_CHOOSE_US = [
    {
        title: 'Custom Sizes, GSM & Micron Specs',
        description: 'Manufactured to your exact weight rating, burst tolerance, bag dimensions, mesh count, and micron lamination requirements.',
        icon: 'Layers'
    },
    {
        title: 'Full In-House Vertical Integration',
        description: 'From PP tape extrusion and high-speed circular weaving to lamination and bag stitching under one continuous quality-controlled roof.',
        icon: 'Factory'
    },
    {
        title: 'Precision Brand Printing',
        description: 'Flexographic and high-definition BOPP multi-color printing ensures crisp logos, legible barcode scanning, and standout shelf branding.',
        icon: 'Sparkles'
    },
    {
        title: 'Rigorous Batch-by-Batch QC Checks',
        description: 'Every roll and baled lot is tested for GSM uniformity, drop resistance, breaking strength, stitch tenacity, and seal integrity.',
        icon: 'ShieldCheck'
    },
    {
        title: 'Large-Volume Dispatch & On-Time Supply',
        description: 'Scalable production schedules engineered to deliver bulk commercial orders reliably across India without shop-floor bottlenecks.',
        icon: 'Truck'
    },
    {
        title: 'Direct Manufacturer Support',
        description: 'Work directly with dedicated packaging technicians and sales engineers — zero intermediary markups or communication delays.',
        icon: 'UserCheck'
    }
];

// ── Industries We Serve ───────────────────────────────────────────────────────
export const INDUSTRIES_SERVED = [
    {
        name: 'Flour, Grain & Food Processing',
        description: 'Food-safe flour sacks, basmati rice bags, pulses, and sugar packaging with zero migration.',
        icon: 'Wheat'
    },
    {
        name: 'Chemicals & Specialty Polymers',
        description: 'Moisture-impermeable bags with secure liners for masterbatches, resinated pellets, and chemical powders.',
        icon: 'FlaskConical'
    },
    {
        name: 'Cement, Minerals & Construction',
        description: 'Micro-perforated valve sacks and block-bottom bags for cement, tile adhesives, wall putty, and sand.',
        icon: 'Building2'
    },
    {
        name: 'Animal, Cattle & Poultry Feed',
        description: 'Durable, breathable woven sacks engineered to transport high-density cattle feed and aquaculture pellets.',
        icon: 'Beef'
    },
    {
        name: 'Fertilizers & Agro Inputs',
        description: 'Corrosion-resistant sacks for urea, NPK fertilizers, seeds, and bio-fertilizer compounds.',
        icon: 'Sprout'
    },
    {
        name: 'Retail BOPP Consumer Packaging',
        description: 'High-gloss photographic reverse-printed consumer retail bags with carrying handles and easy-pour tops.',
        icon: 'ShoppingBag'
    }
];

// ── Quality Control & Process Promise ────────────────────────────────────────
export const QUALITY_STANDARDS = [
    {
        title: 'GSM & Thickness Uniformity',
        description: 'Digital GSM circular cutter and precision micrometer tests performed across warp and weft to ensure exact material density.'
    },
    {
        title: 'Tensile Strength & Elongation',
        description: 'Universal tensile testing machines verify warp/weft breaking load and elongation percentage to withstand heavy industrial drops.'
    },
    {
        title: 'Drop & Burst Testing',
        description: 'Filled sacks subjected to repeated free-fall drop tests from specified heights to ensure zero seam ruptures during transit.'
    },
    {
        title: 'Lamination & Seepage Barrier Audit',
        description: 'Delamination pull tests and hydrostatic pressure checks ensure 100% polymer bond with zero chemical powder seepage.'
    },
    {
        title: 'Print Adhesion & Rub Resistance',
        description: 'Tape adhesion tests and solvent rub evaluations verify ink permanence across rough handling, stacking, and sunlight.'
    },
    {
        title: 'Seam & Bottom Stitch Tenacity',
        description: 'Multi-ply bottom stitch inspections with high-denier polyester threads to eliminate bag failure under full rated load.'
    }
];

// ── How Ordering Works (4 Simple Steps) ──────────────────────────────────────
export const ORDERING_STEPS = [
    {
        number: '01',
        title: 'Submit Your Requirement',
        description: 'Share your desired bag size, product to pack, capacity (Kg), GSM, and print preference via our online quotation form.'
    },
    {
        number: '02',
        title: 'Receive Factory Direct Quote',
        description: 'Our technical packaging team reviews your specifications and provides transparent bulk manufacturer pricing within 24 hours.'
    },
    {
        number: '03',
        title: 'Sample & Design Approval',
        description: 'We generate design mockups and provide physical bag samples for fitment, strength, and print alignment sign-off.'
    },
    {
        number: '04',
        title: 'Bulk Production & Fleet Dispatch',
        description: 'High-speed extrusion, weaving, conversion, and QC inspection followed by compacted hydraulic baling and tracked delivery.'
    }
];

// ── Frequently Asked Questions (FAQ Accordion + JSON-LD) ─────────────────────
export const FAQS = [
    {
        question: 'What is the Minimum Order Quantity (MOQ) for custom PP woven sacks?',
        answer: 'Our standard Minimum Order Quantity (MOQ) is typically 5,000 to 10,000 bags for plain or flexo-printed bags, and 20,000 bags for multi-color BOPP laminated sacks. For trial commercial runs, please contact our sales desk to discuss initial batch flexibility.'
    },
    {
        question: 'What is the difference between laminated and unlaminated PP woven bags?',
        answer: 'Unlaminated bags are breathable and allow air passage, making them ideal for grains, seeds, and pulses that require ventilation. Laminated bags have an extruded LDPE/PP polymer coating that creates a moisture-resistant barrier, perfect for flour, chemicals, and sugar where water seepage must be prevented.'
    },
    {
        question: 'Can you manufacture bags in custom sizes, colours, and GSM ratings?',
        answer: 'Yes, 100% of our production can be customized. We manufacture widths from 12 inches to 48 inches (tubular) and lengths up to 60 inches, with GSM options ranging from 50 to 140 GSM in white, yellow, blue, red, green, or custom masterbatch fabric shades.'
    },
    {
        question: 'What printing options are available for branding our bags?',
        answer: 'We provide two primary printing technologies: High-speed Flexographic printing (up to multi-color on single or both sides for commercial sacks), and Rotogravure reverse-printed BOPP film lamination (up to 8 colors photographic print for retail display packaging).'
    },
    {
        question: 'Do you offer bags with inside plastic liners for moisture-sensitive products?',
        answer: 'Yes, we manufacture PP woven sacks with inserted or bottom-stitched LDPE/LLDPE liners (ranging from 20 to 60 microns). These provide 100% hermetic protection against moisture absorption, leakage of fine powders, and external humidity.'
    },
    {
        question: 'What is your typical production and delivery lead time?',
        answer: 'For standard plain or repeat orders, production and dispatch typically take 7 to 10 business days. For new custom orders requiring brand cylinder engraving or stereo printing blocks, lead time is usually 12 to 15 days upon sample sign-off.'
    },
    {
        question: 'Which geographical regions do you supply to?',
        answer: 'We operate across India with logistics tie-ups connecting Gujarat, Maharashtra, Rajasthan, Madhya Pradesh, Punjab, Haryana, Uttar Pradesh, and southern industrial clusters through dedicated transporter fleets and full truckload (FTL) dispatches.'
    },
    {
        question: 'How do you ensure consistent quality across every batch of sacks?',
        answer: 'Every lot is produced from tested virgin PP polymers and audited through in-house quality checkpoints: tape denier testing, circular mesh count, burst resistance, free-fall drop testing, and stitch tenacity sign-off before hydraulic baling.'
    }
];

// ── Factory Videos (Hero Background Playlist & Inside Our Factory Section) ──
// NOTE: Titles and captions below are editable placeholders — update them
// anytime to match the exact footage in frontend/public/videos/.
export const FACTORY_VIDEOS = [
    {
        id: 'factory-1',
        src: '/videos/factory_video_1_optimized (1).mp4',
        title: 'Weaving and Lamination Floor',
        caption: 'In-house polypropylene fabric weaving and extrusion lamination operations.'
    },
    {
        id: 'factory-3',
        src: '/videos/factory_video_3_optimized (1).mp4',
        title: 'Printing and Stitching',
        caption: 'Precision flexographic printing, cutting, and bag stitching lines.'
    },
    {
        id: 'factory-4',
        src: '/videos/factory_video_4_optimized (1).mp4',
        title: 'Quality Check and Packing',
        caption: 'Finished bag inspection, baling, and dispatch-ready handling.'
    }
];
