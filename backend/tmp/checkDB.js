const mongoose = require('mongoose');
const Property = require('./models/Property');
const User = require('./models/User');

mongoose.connect('mongodb+srv://satyamtrivastu:Eeb0R9fK98oIsc1O@cluster0.b5493.mongodb.net/trivastu?retryWrites=true&w=majority&appName=Cluster0')
    .then(async () => {
        console.log('Connected DB');
        const props = await Property.find().lean();
        console.log(`Found ${props.length} properties.`);
        if (props.length > 0) {
            console.log("Sample:", JSON.stringify(props[0], null, 2));
        }
        const admin = await User.findOne({ role: 'admin' }).lean();
        console.log("Admin exists:", !!admin);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
