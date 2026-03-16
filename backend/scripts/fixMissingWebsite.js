const mongoose = require('mongoose');
const MONGO = 'mongodb+srv://sahasforindia_db_user:Strongpass1234@myappdata.u7djf6g.mongodb.net/trivastuRealty?appName=myAppData';

mongoose.connect(MONGO).then(async () => {
    const P = mongoose.model('Property', new mongoose.Schema({}, { strict: false }), 'properties');

    // Fix properties missing 'website' field by setting website=plots for plot types
    const fixed = await P.updateMany(
        { $or: [{ website: null }, { website: '' }, { website: { $exists: false } }] },
        { $set: { website: 'plots', status: 'approved', isAvailable: true } }
    );
    console.log('Fixed properties:', fixed.modifiedCount);

    // Verify
    const all = await P.find({}).select('title website status isAvailable type').lean();
    console.log('All properties after fix:');
    all.forEach(p => console.log(`  ${p.title} | website=${p.website} | status=${p.status} | avail=${p.isAvailable}`));
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
