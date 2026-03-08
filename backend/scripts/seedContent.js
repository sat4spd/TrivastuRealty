/**
 * Content Seeding Script for Trivastu CMS
 * Seeds: Testimonials, Construction Projects, Services/Packages, Plot Listings, Business Info
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Testimonial = require('../models/Testimonial');
const Project = require('../models/Project');
const Service = require('../models/Service');
const Property = require('../models/Property');
const BusinessInfo = require('../models/BusinessInfo');

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
];

const PROJECTS = [
    {
        title: 'Modern Villa — Doranda',
        location: 'Ranchi',
        type: 'Residential',
        status: 'Completed',
        description: '3BHK luxury villa with contemporary architecture, premium interiors, and landscaped garden. Built on 2400 sq.ft plot with modern amenities.',
        image: '/images/project-villa.png',
        images: ['/images/project-villa.png'],
        isPublished: true,
    },
    {
        title: 'Greenfield Township',
        location: 'Bokaro',
        type: 'Residential',
        status: 'Ongoing',
        description: 'Premium residential township spread across 50 acres with modern amenities, green spaces, community center, and 24x7 security.',
        image: '/images/project-apartments.png',
        images: ['/images/project-apartments.png'],
        isPublished: true,
    },
    {
        title: 'Commercial Complex — Hatia',
        location: 'Ranchi',
        type: 'Commercial',
        status: 'Completed',
        description: 'Multi-story commercial complex with 15,000 sq.ft of retail and office space. Prime location with excellent connectivity.',
        image: '/images/commercial-building.png',
        images: ['/images/commercial-building.png'],
        isPublished: true,
    },
    {
        title: 'Luxury Duplex — Harmu',
        location: 'Ranchi',
        type: 'Residential',
        status: 'Completed',
        description: '4BHK duplex with rooftop garden, modular kitchen, and smart home features. Built on 3200 sq.ft with premium Italian marble flooring.',
        image: '/images/project-villa.png',
        images: ['/images/project-villa.png'],
        isPublished: true,
    },
    {
        title: 'Farm House — Ormanjhi',
        location: 'Ranchi',
        type: 'Residential',
        status: 'Ongoing',
        description: 'Sprawling farmhouse on 5000 sq.ft with landscaped gardens, sustainable design, rainwater harvesting, and solar panels.',
        image: '/images/construction-site.png',
        images: ['/images/construction-site.png'],
        isPublished: true,
    },
    {
        title: 'Office Complex — Bistupur',
        location: 'Jamshedpur',
        type: 'Commercial',
        status: 'Upcoming',
        description: 'Modern office complex with 8,000 sq.ft of co-working spaces, premium amenities, and high-speed fiber connectivity.',
        image: '/images/commercial-building.png',
        images: ['/images/commercial-building.png'],
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

        // Seed testimonials
        const existingTestimonials = await Testimonial.countDocuments();
        if (existingTestimonials === 0) {
            await Testimonial.insertMany(TESTIMONIALS);
            console.log(`✅ Seeded ${TESTIMONIALS.length} testimonials`);
        } else {
            console.log(`⏩ Testimonials already exist (${existingTestimonials}), skipping`);
        }

        // Seed projects
        const existingProjects = await Project.countDocuments();
        if (existingProjects === 0) {
            await Project.insertMany(PROJECTS);
            console.log(`✅ Seeded ${PROJECTS.length} construction projects`);
        } else {
            console.log(`⏩ Projects already exist (${existingProjects}), skipping`);
        }

        // Seed services
        const existingServices = await Service.countDocuments();
        if (existingServices === 0) {
            await Service.insertMany(SERVICES);
            console.log(`✅ Seeded ${SERVICES.length} service packages`);
        } else {
            console.log(`⏩ Services already exist (${existingServices}), skipping`);
        }

        // Seed plots (only if no plots exist with website='plots')
        const existingPlots = await Property.countDocuments({ website: 'plots' });
        if (existingPlots === 0) {
            // We need an addedBy user; use the first admin user if available
            const User = require('../models/User');
            let adminUser = await User.findOne({ role: 'admin' });
            if (!adminUser) {
                adminUser = await User.findOne(); // Just grab any user
            }
            const plotsWithUser = PLOTS.map(p => ({
                ...p,
                addedBy: adminUser ? adminUser._id : new mongoose.Types.ObjectId(),
            }));
            await Property.insertMany(plotsWithUser);
            console.log(`✅ Seeded ${PLOTS.length} plot listings`);
        } else {
            console.log(`⏩ Plot listings already exist (${existingPlots}), skipping`);
        }

        // Seed business info
        const existingInfo = await BusinessInfo.findOne({ key: 'main' });
        if (!existingInfo) {
            await BusinessInfo.create(BUSINESS_INFO);
            console.log('✅ Seeded business info');
        } else {
            console.log('⏩ Business info already exists, skipping');
        }

        console.log('\n🎉 Content seeding complete!');
    } catch (error) {
        console.error('❌ Seeding error:', error);
    }
    process.exit(0);
}

seed();
