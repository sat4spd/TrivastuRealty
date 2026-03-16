const https = require('https');

https.get('https://admin.trivastu.com/dashboard/cms/plots/listings', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/_next\/static\/chunks\/app\/dashboard\/cms\/plots\/listings\/page-([^"]+)\.js/);
    if (!matches) {
       console.log("No chunks found!");
       return;
    }
    const jsPath = matches[0];
    https.get('https://admin.trivastu.com/' + jsPath, (jsRes) => {
      let jsData = '';
      jsRes.on('data', chunk => jsData += chunk);
      jsRes.on('end', () => {
         if (jsData.includes('PlotListings')) {
             if (jsData.includes('CMS API returned')) {
                 console.log('✅ Fix is LIVE on Vercel');
             } else {
                 console.log('❌ Old code is still running on Vercel');
             }
         } else {
             console.log('Could not parse PlotListings function');
         }
      });
    });
  });
});
