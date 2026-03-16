const mongoose = require('mongoose');
const MONGO = 'mongodb+srv://sahasforindia_db_user:Strongpass1234@myappdata.u7djf6g.mongodb.net/trivastuRealty?appName=myAppData';

mongoose.connect(MONGO).then(async () => {
    console.log('Connected to MongoDB');

    const Lead = mongoose.model('Lead', new mongoose.Schema({}, { strict: false }), 'leads');
    const Agent = mongoose.model('Agent', new mongoose.Schema({}, { strict: false }), 'agents');
    const User = mongoose.model('User', new mongoose.Schema({ role: String }, { strict: false }), 'users');

    const l = await Lead.deleteMany({});
    const a = await Agent.deleteMany({});
    const u = await User.deleteMany({ role: { $in: ['customer', 'agent'] } });

    console.log('Deleted leads:', l.deletedCount);
    console.log('Deleted agents:', a.deletedCount);
    console.log('Deleted customer/agent users:', u.deletedCount);
    console.log('Done! Fresh start ready.');
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
