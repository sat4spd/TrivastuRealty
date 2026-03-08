/**
 * Content Seeding Script for Trivastu CMS
 * Seeds: Testimonials, Construction Projects, Services/Packages, Plot Listings, Business Info
 * Use --force flag to replace existing data: node scripts/seedContent.js --force
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Testimonial = require('../models/Testimonial');
const Project = require('../models/Project');
const Service = require('../models/Service');
const Property = require('../models/Property');
const BusinessInfo = require('../models/BusinessInfo');

const FORCE = process.argv.includes('--force');

const TESTIMONIALS = [
    {
        authorName: 'Rajesh Kumar',
        authorRole: 'Plot Buyer — Nagari',
        content: 'Bought a 5 decimal residential plot in Nagari through Trivastu. The title verification was thorough and the registration process was completely hassle-free. My family is now planning to build our dream home there. Highly recommend their services for anyone looking for verified plots in Ranchi.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Priya Sharma',
        authorRole: 'Villa Construction — Doranda',
        content: 'We chose Trivastu for our 3BHK villa construction in Doranda. From the foundation to the final coat of paint, everything was delivered on time with premium quality materials. The weekly progress reports gave us complete peace of mind. The final result exceeded our expectations.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Amit Gupta',
        authorRole: 'Commercial Project — Hatia',
        content: 'Our commercial complex project in Hatia was handled professionally from start to finish. Trivastu managed all the government approvals, structural design, and construction flawlessly. The building was delivered 2 weeks ahead of schedule. Outstanding project management.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Sunita Devi',
        authorRole: 'Land Investment — Tupudana',
        content: 'I invested in agricultural land near Tupudana with Trivastu\'s guidance. They verified all the CNT Act compliance and ensured the land records were clean. The property has appreciated well since my purchase. Very trustworthy team for land investments in Jharkhand.',
        rating: 4,
        isPublished: true,
    },
    {
        authorName: 'Manoj Tiwari',
        authorRole: 'Home Renovation — Ranchi',
        content: 'Got our 20-year-old house completely renovated by Trivastu. They modernized the kitchen, rewired the entire electrical system, and added a beautiful terrace garden. The transformation was incredible. The best part was their transparent pricing with no hidden charges.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Deepak Sahu',
        authorRole: 'Residential Plot — Lodhma',
        content: 'Purchased a corner plot in Lodhma for my new house. Trivastu helped me find a general category plot with clear title, proper road access, and good water availability. The entire process from site visit to registration took just 3 weeks. Very professional service.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Anita Singh',
        authorRole: 'Interior Design — Kanke',
        content: 'Trivastu redesigned our entire living space in Kanke. The interior team understood our Vastu preferences perfectly and created a modern yet traditional ambiance. The modular kitchen and bathroom fittings are top-notch. Three months in and everything still looks brand new.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Vikram Mahato',
        authorRole: '2BHK Construction — Namkum',
        content: 'Being a first-time builder, I was nervous about the entire process. Trivastu made it incredibly simple — from plan approval to handing over the keys, every step was transparent. The 2BHK cost me exactly what they quoted. No hidden charges at all.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Kavita Dey',
        authorRole: 'Plot Investment — Ormanjhi',
        content: 'Invested in two plots near Ormanjhi on Trivastu\'s recommendation. Their market analysis was spot on — the area has seen 30% appreciation in just one year. Their legal team handled all the paperwork flawlessly. Will definitely invest more through them.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Ravi Prasad',
        authorRole: 'Commercial Build — Lalpur',
        content: 'Our showroom construction in Lalpur was completed 10 days ahead of schedule with premium quality. Trivastu\'s project manager gave us daily updates with photos. The structural engineer was brilliant — our building passed all municipal inspections on the first attempt.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Neha Kumari',
        authorRole: 'Duplex Construction — Morabadi',
        content: 'We built our 4BHK duplex through Trivastu in Morabadi. The architect was exceptional — incorporated all our Vastu requirements without compromising on modern design. The total cost stayed within 5% of the original estimate which is remarkable for a project this size.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Sanjay Mahto',
        authorRole: 'Farmhouse — Bundu',
        content: 'My weekend farmhouse near Bundu was designed and built by Trivastu. They suggested sustainable features like solar panels and rainwater harvesting that I hadn\'t even considered. The stone and wood exteriors blend perfectly with the natural surroundings. A true retreat.',
        rating: 5,
        isPublished: true,
    },
    {
        authorName: 'Pooja Agarwal',
        authorRole: 'Plot Purchase — Tupudana',
        content: 'As a woman buying property independently, I needed a team I could truly trust. Trivastu\'s legal team walked me through every document, explained the land classification clearly, and even accompanied me to the sub-registrar office. Exceptional service and genuine people.',
        rating: 5,
        isPublished: true,
    },
];

const PROJECTS = [
    {
        title: 'Modern Villa — Doranda',
        location: 'Ranchi',
        type: 'Residential',
        status: 'Completed',
        description: '3BHK luxury villa with contemporary architecture, premium interiors, and landscaped garden. Built on 2400 sq.ft plot with modern amenities.',
        image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800',
        images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800'],
        isPublished: true,
    },
    {
        title: 'Greenfield Township',
        location: 'Bokaro',
        type: 'Residential',
        status: 'Ongoing',
        description: 'Premium residential township spread across 50 acres with modern amenities, green spaces, community center, and 24x7 security.',
        image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800'],
        isPublished: true,
    },
    {
        title: 'Commercial Complex — Hatia',
        location: 'Ranchi',
        type: 'Commercial',
        status: 'Completed',
        description: 'Multi-story commercial complex with 15,000 sq.ft of retail and office space. Prime location with excellent connectivity.',
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800',
        images: ['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800'],
        isPublished: true,
    },
    {
        title: 'Luxury Duplex — Harmu',
        location: 'Ranchi',
        type: 'Residential',
        status: 'Completed',
        description: '4BHK duplex with rooftop garden, modular kitchen, and smart home features. Built on 3200 sq.ft with premium Italian marble flooring.',
        image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=800',
        images: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=800'],
        isPublished: true,
    },
    {
        title: 'Farm House — Ormanjhi',
        location: 'Ranchi',
        type: 'Residential',
        status: 'Ongoing',
        description: 'Sprawling farmhouse on 5000 sq.ft with landscaped gardens, sustainable design, rainwater harvesting, and solar panels.',
        image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=800',
        images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=800'],
        isPublished: true,
    },
    {
        title: 'Office Complex — Bistupur',
        location: 'Jamshedpur',
        type: 'Commercial',
        status: 'Upcoming',
        description: 'Modern office complex with 8,000 sq.ft of co-working spaces, premium amenities, and high-speed fiber connectivity.',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800',
        images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800'],
        isPublished: true,
    },
];

const SERVICES = [
    {
        name: 'Basic',
        priceRange: '₹1,400 - ₹1,600',
        unit: '/sq.ft',
        features: ['Standard materials', 'Basic finishes', 'Standard electrical & plumbing', '6-month warranty'],
        isPopular: false,
        order: 1,
        website: 'realty',
        isPublished: true,
    },
    {
        name: 'Premium',
        priceRange: '₹1,800 - ₹2,200',
        unit: '/sq.ft',
        features: ['High-quality materials', 'Premium finishes & branded fixtures', 'Advanced electrical systems', 'Custom architectural design', '1-year warranty', 'Interior consultation'],
        isPopular: true,
        order: 2,
        website: 'realty',
        isPublished: true,
    },
    {
        name: 'Luxury',
        priceRange: '₹2,500 - ₹3,500+',
        unit: '/sq.ft',
        features: ['Premium imported materials', 'Smart home automation', 'Bespoke architectural design', '2-year warranty', 'Complete interior design', 'Landscape design included'],
        isPopular: false,
        order: 3,
        website: 'realty',
        isPublished: true,
    },
];

const PLOTS = [
    {
        title: 'Premium Residential Plot — Nagari',
        type: 'plot',
        price: 1200000,
        location: 'Nagari, Ranchi',
        area: 5,
        unit: 'decimals',
        description: 'East-facing corner plot in prime Nagari area. Well-connected to Ranchi city via NH33. Ideal for residential construction. Clear title, ready for registration.',
        highlights: ['Corner Plot', 'East Facing', 'NH33 Access', 'Clear Title'],
        images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
        pricePerSqft: '₹1,150/sq.ft',
    },
    {
        title: 'Gated Community Plot — Tupudana',
        type: 'plot',
        price: 1800000,
        location: 'Tupudana, Ranchi',
        area: 7,
        unit: 'decimals',
        description: 'Plot in upcoming gated community near Tupudana. 24x7 security, paved roads, and proximity to Ring Road. Perfect for family home.',
        highlights: ['Gated Community', 'Near Ring Road', 'Paved Roads', 'Water Supply'],
        images: ['https://images.unsplash.com/photo-1628624747186-a941c476b7ef?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
        pricePerSqft: '₹1,350/sq.ft',
    },
    {
        title: 'Budget Residential Plot — Lodhma',
        type: 'plot',
        price: 650000,
        location: 'Lodhma, Ranchi',
        area: 4,
        unit: 'decimals',
        description: 'Affordable residential plot in fast-developing Lodhma area. Near proposed metro route. All utilities available. Ideal for first-time buyers.',
        highlights: ['Affordable', 'Near Metro Route', 'Developing Area', 'All Utilities'],
        images: ['https://images.unsplash.com/photo-1625602812206-5ec545ca1231?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
        pricePerSqft: '₹950/sq.ft',
    },
    {
        title: 'Commercial Plot — Hatia',
        type: 'commercial',
        price: 4500000,
        location: 'Hatia, Ranchi',
        area: 1200,
        unit: 'sqft',
        description: 'Prime commercial plot near Hatia railway station. High footfall area, ideal for showroom, retail store, or office space. Road-facing with parking.',
        highlights: ['Near Station', 'Road Facing', 'High Footfall', 'Parking Space'],
        images: ['https://images.unsplash.com/photo-1577415124269-fc1140a69e91?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
        pricePerSqft: '₹3,750/sq.ft',
    },
    {
        title: 'Industrial Plot — Bistupur',
        type: 'commercial',
        price: 8500000,
        location: 'Bistupur, Jamshedpur',
        area: 3000,
        unit: 'sqft',
        description: 'Premium commercial plot in Bistupur business district. Suitable for offices, clinics, or retail. Near XLRI and main market. Excellent ROI potential.',
        highlights: ['Business District', 'Near XLRI', 'High ROI', 'Clear Title'],
        images: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
        pricePerSqft: '₹2,833/sq.ft',
    },
    {
        title: 'Agricultural Land — Namkum',
        type: 'land',
        price: 3500000,
        location: 'Namkum, Ranchi',
        area: 2,
        unit: 'acres',
        description: 'Fertile agricultural land near Namkum with natural water source. Ideal for organic farming, nursery, or future residential development.',
        highlights: ['Water Source', 'Fertile Soil', 'Future Development', 'Road Access'],
        images: ['https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'cnt',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
    },
    {
        title: 'Farmland Investment — Bundu',
        type: 'land',
        price: 2200000,
        location: 'Bundu, Ranchi',
        area: 3,
        unit: 'acres',
        description: 'Large agricultural tract near Bundu. Suitable for mango orchards, poultry farming, or resort development. SC/ST land category, buyer must verify eligibility.',
        highlights: ['3 Acres', 'Orchard Potential', 'Resort Potential', 'SC/ST Land'],
        images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'sc-st',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
    },
    {
        title: 'Agricultural Plot — Ormanjhi',
        type: 'land',
        price: 1500000,
        location: 'Ormanjhi, Ranchi',
        area: 1.5,
        unit: 'acres',
        description: 'Scenic farmland near Ormanjhi with hillside views. Near Patratu Dam road. Suitable for weekend farm, homestay, or organic cultivation.',
        highlights: ['Hill Views', 'Near Patratu Road', 'Scenic Location', 'General Land'],
        images: ['https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
    },
    {
        title: 'Premium Residential Plot - Tupudana',
        type: 'plot',
        price: 390000,
        location: 'Satranji Bazaar, Tupudana',
        area: 1.78,
        unit: 'acres',
        description: 'Well-located residential plot near Satranji Bazaar in Tupudana. Excellent connectivity, surrounded by developing neighborhoods. Perfect for long-term investment.',
        highlights: ['Near Market', 'Road Frontage', 'Developing Area', 'Clear Title'],
        images: ['https://images.unsplash.com/photo-1595880500386-4b33823b29cd?auto=format&fit=crop&q=80&w=800'],
        landClassification: 'general',
        website: 'plots',
        status: 'approved',
        isAvailable: true,
    },
];

const BUSINESS_INFO = {
    key: 'main',
    companyName: 'Trivastu Ventures',
    phone: '+918655202633',
    altPhone: '',
    email: 'contact@trivastu.com',
    address: 'Singhmore, Hatia, Ranchi - 834003',
    city: 'Ranchi',
    state: 'Jharkhand',
    pincode: '834003',
    whatsapp: '+918655202633',
};

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log(FORCE ? '⚡ FORCE mode: replacing existing data\n' : '📝 Normal mode: seeding only if empty\n');

        // Seed testimonials
        const existingTestimonials = await Testimonial.countDocuments();
        if (FORCE || existingTestimonials === 0) {
            if (FORCE) await Testimonial.deleteMany({});
            await Testimonial.insertMany(TESTIMONIALS);
            console.log(`✅ Seeded ${TESTIMONIALS.length} testimonials`);
        } else {
            console.log(`⏩ Testimonials already exist (${existingTestimonials}), skipping`);
        }

        // Seed projects
        const existingProjects = await Project.countDocuments();
        if (FORCE || existingProjects === 0) {
            if (FORCE) await Project.deleteMany({});
            await Project.insertMany(PROJECTS);
            console.log(`✅ Seeded ${PROJECTS.length} construction projects`);
        } else {
            console.log(`⏩ Projects already exist (${existingProjects}), skipping`);
        }

        // Seed services
        const existingServices = await Service.countDocuments();
        if (FORCE || existingServices === 0) {
            if (FORCE) await Service.deleteMany({});
            await Service.insertMany(SERVICES);
            console.log(`✅ Seeded ${SERVICES.length} service packages`);
        } else {
            console.log(`⏩ Services already exist (${existingServices}), skipping`);
        }

        // Seed plots
        const existingPlots = await Property.countDocuments({ website: 'plots' });
        if (FORCE || existingPlots === 0) {
            const User = require('../models/User');
            let adminUser = await User.findOne({ role: 'admin' });
            if (!adminUser) adminUser = await User.findOne();
            if (FORCE) await Property.deleteMany({ website: 'plots' });
            const plotsWithUser = PLOTS.map(p => ({
                ...p,
                addedBy: adminUser ? adminUser._id : new mongoose.Types.ObjectId(),
            }));
            await Property.insertMany(plotsWithUser);
            console.log(`✅ Seeded ${PLOTS.length} plot listings`);
        } else {
            console.log(`⏩ Plot listings already exist (${existingPlots}), skipping`);
        }

        // Seed/update business info (always upsert)
        await BusinessInfo.findOneAndUpdate(
            { key: 'main' },
            BUSINESS_INFO,
            { upsert: true, new: true }
        );
        console.log('✅ Business info updated');

        console.log('\n🎉 Content seeding complete!');
    } catch (error) {
        console.error('❌ Seeding error:', error);
    }
    process.exit(0);
}

seed();
