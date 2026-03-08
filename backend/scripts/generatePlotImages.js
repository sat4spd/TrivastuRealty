/**
 * Generate unique plot images using kie.ai nano-banana-pro API
 * Usage: node scripts/generatePlotImages.js
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = '27343e49d03c6398f37a9a3ee193f2b7';
const BASE_URL = 'https://api.kie.ai';

const PLOT_PROMPTS = [
    {
        name: 'plot-tupudana',
        prompt: 'A premium gated residential community entrance in a semi-urban Indian town, decorative iron gate with security booth, internal paved road with street lights and speed breakers, boundary wall with greenery, some plots have houses under construction with scaffolding, neat landscaping with marigold flowers, afternoon golden sunlight, professional real estate photography, photorealistic, 4:3 aspect ratio'
    },
    {
        name: 'plot-lodhma',
        prompt: 'An affordable residential plot in a fast-developing outskirt area of Ranchi India, flat open ground with fresh demarcation boundary stones, a new blacktop road being built alongside, nearby under-construction houses, electric transformer and poles, a municipal water pipeline, road construction machinery nearby, morning sunlight, realistic Indian suburban setting, photorealistic'
    },
    {
        name: 'plot-hatia-commercial',
        prompt: 'A prime commercial plot of land near a busy railway station area in an Indian city, road-facing with heavy pedestrian traffic, adjacent shops and commercial buildings with colorful signboards, auto-rickshaws and bikes parked nearby, wide main road, utility poles, clear flat ground ready for construction, bustling daytime Indian market atmosphere, photorealistic'
    },
    {
        name: 'plot-bistupur-industrial',
        prompt: 'A large premium commercial plot in Jamshedpur India business district, wide road-facing flat land, modern office buildings and glass towers in background, trees along the road, vehicles passing on a well-maintained highway, plot fenced with temporary bamboo fencing, a hoarding showing the plot details, clear blue sky, professional commercial real estate photography, photorealistic'
    },
    {
        name: 'plot-namkum-agricultural',
        prompt: 'Fertile green agricultural farmland in Namkum near Ranchi India, lush paddy fields, a small natural pond with lotus plants, tall palm trees in background, thatched hut at one corner, a village dirt road alongside, old tractor parked nearby, rolling green hills in far background, warm afternoon sunlight with few clouds, professional landscape photography, photorealistic'
    },
    {
        name: 'plot-bundu-farmland',
        prompt: 'A large 3 acre agricultural tract near Bundu Jharkhand India, mango orchard with young trees in rows, red laterite soil visible, a seasonal river stream at the edge, tribal village huts in far background, green Chotanagpur plateau hills, wildflowers blooming, morning golden light with mist rising, wide angle professional landscape photography, photorealistic'
    },
    {
        name: 'plot-ormanjhi-scenic',
        prompt: 'Scenic hilly farmland near Ormanjhi outskirts of Ranchi Jharkhand India, terraced green fields on gentle slopes, winding village road, Patratu valley hills in background, sal trees and bamboo groves, a small waterfall or stream, traditional stone boundary wall, grazing cows in distance, clear evening sky with clouds, professional landscape photography, photorealistic'
    },
    {
        name: 'plot-tupudana-residential',
        prompt: 'A well-located residential plot near a busy Indian bazaar market, paved road with shops selling vegetables and groceries, electric wiring overhead, water tap and drainage visible, nearby two-story houses with balconies, children playing cricket on street, cycle rickshaw passing by, warm afternoon light, typical Indian small town residential area, photorealistic'
    },
];

const DEST_DIR = path.join(__dirname, '..', '..', 'trivastu-plots', 'public', 'images');

function apiRequest(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, BASE_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`Parse error: ${data}`)); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            const stream = fs.createWriteStream(dest);
            res.pipe(stream);
            stream.on('finish', () => { stream.close(); resolve(dest); });
            stream.on('error', reject);
        }).on('error', reject);
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateImage(plotPrompt) {
    console.log(`🎨 Creating task for: ${plotPrompt.name}`);

    const result = await apiRequest('POST', '/api/v1/jobs/createTask', {
        model: 'nano-banana-pro',
        input: {
            prompt: plotPrompt.prompt,
            aspect_ratio: '4:3',
            resolution: '2K',
            output_format: 'png',
        },
    });

    if (result.code !== 200) {
        console.error(`❌ Failed to create task for ${plotPrompt.name}:`, result.message);
        return null;
    }

    const taskId = result.data.taskId;
    console.log(`   Task ID: ${taskId}`);

    // Poll for result
    let attempts = 0;
    while (attempts < 60) {
        await sleep(5000);
        attempts++;

        const status = await apiRequest('GET', `/api/v1/jobs/recordInfo?taskId=${taskId}`);
        if (status.code !== 200) continue;

        const state = status.data.state;
        if (state === 'success') {
            const resultJson = JSON.parse(status.data.resultJson);
            const imageUrl = resultJson.resultUrls[0];
            console.log(`   ✅ Generated: ${plotPrompt.name}`);

            // Download image
            const destPath = path.join(DEST_DIR, `${plotPrompt.name}.png`);
            await downloadFile(imageUrl, destPath);
            console.log(`   💾 Saved: ${destPath}`);
            return { name: plotPrompt.name, url: imageUrl, localPath: destPath };
        } else if (state === 'fail') {
            console.error(`   ❌ Failed: ${plotPrompt.name} - ${status.data.failMsg}`);
            return null;
        } else {
            process.stdout.write(`   ⏳ ${state}... (${attempts * 5}s)\r`);
        }
    }

    console.error(`   ❌ Timeout for ${plotPrompt.name}`);
    return null;
}

async function main() {
    console.log('🚀 Starting image generation via kie.ai nano-banana-pro\n');
    console.log(`📁 Output directory: ${DEST_DIR}\n`);

    // Ensure output directory exists
    fs.mkdirSync(DEST_DIR, { recursive: true });

    const results = [];
    // Generate 2 at a time to avoid rate limits
    for (let i = 0; i < PLOT_PROMPTS.length; i += 2) {
        const batch = PLOT_PROMPTS.slice(i, i + 2);
        const batchResults = await Promise.all(batch.map(p => generateImage(p)));
        results.push(...batchResults.filter(Boolean));
        if (i + 2 < PLOT_PROMPTS.length) {
            console.log('   ⏳ Waiting 3s before next batch...\n');
            await sleep(3000);
        }
    }

    console.log(`\n🎉 Generated ${results.length}/${PLOT_PROMPTS.length} images successfully!`);
    console.log('\nGenerated files:');
    results.forEach(r => console.log(`  - ${r.name}.png`));

    console.log('\n📝 Update seedContent.js with these URLs:');
    results.forEach(r => {
        console.log(`  ${r.name}: 'https://plot.trivastu.com/images/${r.name}.png'`);
    });
}

main().catch(console.error);
