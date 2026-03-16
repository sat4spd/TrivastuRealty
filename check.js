const https = require('https');

https.get('https://admin.trivastu.com/dashboard/cms/plots/listings', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const jsFiles = [...data.matchAll(/_next\/static\/chunks\/app\/.*?\.js/g)].map(m => m[0]);
    if (jsFiles.length === 0) return console.log('No JS files found');
    
    let checked = 0;
    jsFiles.forEach(jsPath => {
        https.get('https://admin.trivastu.com/' + jsPath, (jsRes) => {
            let jsData = '';
            jsRes.on('data', d => jsData += d);
            jsRes.on('end', () => {
                if (jsData.includes('PlotListings')) {
                    console.log('Found PlotListings component in ' + jsPath);
                    if (jsData.includes('allProps')) {
                        console.log('✅ FIX IS LIVE (Found "allProps" variable)');
                    } else {
                        console.log('❌ OLD CODE IS RUNNING');
                    }
                }
                checked++;
            });
        });
    });
  });
});
