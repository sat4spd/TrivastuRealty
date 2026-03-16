const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://sahasforindia_db_user:Strongpass1234@myappdata.u7djf6g.mongodb.net/trivastuRealty?appName=myAppData').then(async () => {
    const P = mongoose.model('Property', new mongoose.Schema({}, { strict: false }), 'properties');

    const baha = await P.find({ title: /baha/i }).lean();
    console.log('Baha records:', baha.length);
    baha.forEach(p => console.log(JSON.stringify({
        _id: p._id, title: p.title, website: p.website, status: p.status, isAvailable: p.isAvailable, type: p.type
    })));

    console.log('\nAll properties:');
    const all = await P.find({}).lean();
    all.forEach(p => console.log(`  ${p.title} | website=${p.website} | status=${p.status} | type=${p.type}`));
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
