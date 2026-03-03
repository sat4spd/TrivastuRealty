/**
 * locationHierarchy.js
 * Geographic hierarchy for Jharkhand real estate search.
 * Enables smart location expansion: "Ranchi" → Tupudana, Nagri, Lodhma, etc.
 */

// ── JHARKHAND LOCATION HIERARCHY ──
// Structure: district → [ known localities / sub-areas ]
const JHARKHAND_HIERARCHY = {
    // ── RANCHI DISTRICT ──
    ranchi: [
        'ranchi',
        'tupudana', 'nagri', 'lodhma', 'kanke', 'bariatu',
        'ratu', 'ormanjhi', 'namkum', 'tatisilwai', 'itki',
        'irba', 'angara', 'sonahatu', 'silli', 'bundu',
        'tamar', 'mandar', 'bero', 'lapung', 'rajdhanwar',
        'hinoo', 'doranda', 'harmu', 'kadru', 'hehal',
        'dhurwa', 'lalpur', 'ratu road', 'khelgaon',
        'bariatu road', 'kantatoli', 'morabadi', 'lower chetar',
        'argora', 'upper bazar', 'main road ranchi',
        'kokar', 'purulia road', 'hatia', 'pundag',
        'gonda', 'nofalia', 'sukhdeonagar', 'chutia',
        'ashok nagar ranchi', 'vikas nagar ranchi',
    ],

    // ── JAMSHEDPUR (EAST SINGHBHUM) DISTRICT ──
    jamshedpur: [
        'jamshedpur', 'east singhbhum',
        'telco', 'adityapur', 'jugsalai', 'mango',
        'sakchi', 'bistupur', 'sonari', 'kadma', 'baridih',
        'golmuri', 'bagbera', 'boram', 'parsudih',
        'gamharia', 'kandra', 'ghatsila',
        'baharagora', 'dhalbhum',
    ],

    // ── DHANBAD DISTRICT ──
    dhanbad: [
        'dhanbad',
        'jharia', 'sindri', 'nirsa', 'gobindpur',
        'katras', 'kenduadih', 'topchanchi',
        'baliapur', 'moonidih', 'patherdih',
        'chas', 'bokaro steel city',
    ],

    // ── BOKARO DISTRICT ──
    bokaro: [
        'bokaro', 'bokaro steel city',
        'chas', 'chandankiyari', 'gomia', 'bermo',
        'petarbar', 'tenughat',
    ],

    // ── HAZARIBAGH DISTRICT ──
    hazaribagh: [
        'hazaribagh',
        'ramgarh', 'chouparan', 'ichak', 'barhi',
        'sadar', 'katkamsandi', 'mandu', 'churchu',
    ],

    // ── DEOGHAR DISTRICT ──
    deoghar: [
        'deoghar', 'baidyanath dham',
        'jasidih', 'mohanpur', 'palojori', 'sarwan',
    ],

    // ── DUMKA DISTRICT ──
    dumka: [
        'dumka',
        'shikaripara', 'jarmundi', 'masalia', 'gopikandar',
        'jama', 'ranishwar',
    ],

    // ── GIRIDIH DISTRICT ──
    giridih: [
        'giridih',
        'dhanbad', 'bengabad', 'birni', 'gawan',
        'tisri', 'dhanwar',
    ],

    // ── SINGHBHUM (WEST) ──
    singhbhum: [
        'chaibasa', 'west singhbhum',
        'chakradharpur', 'khunti', 'simdega',
        'kolhan', 'saraikela',
    ],

    // ── PALAMU DISTRICT ──
    palamu: [
        'medininagar', 'palamu', 'daltonganj',
        'hussainabad', 'bishrampur', 'chianki',
    ],

    // ── KODERMA DISTRICT ──
    koderma: [
        'koderma', 'jhumri telaiya',
        'domchanch', 'satgawan', 'chandwara',
    ],

    // ── CHAIBASA / KHUNTI ──
    khunti: [
        'khunti', 'murhu', 'rania', 'karra', 'arki',
    ],

    // ── LOHARDAGA DISTRICT ──
    lohardaga: [
        'lohardaga', 'kuru', 'bhandra', 'senha',
    ],

    // ── GUMLA DISTRICT ──
    gumla: [
        'gumla', 'siria', 'raidih', 'chainpur',
        'bishunpur', 'dumri',
    ],

    // ── PAKUR DISTRICT ──
    pakur: [
        'pakur', 'maheshpur', 'pakuria', 'hiranpur',
    ],

    // ── GODDA DISTRICT ──
    godda: [
        'godda', 'boarijor', 'mahagama', 'poraiyahat',
    ],

    // ── SAHIBGANJ DISTRICT ──
    sahibganj: [
        'sahibganj', 'rajmahal', 'barhait', 'pathna',
    ],

    // ── LATEHAR DISTRICT ──
    latehar: [
        'latehar', 'mahuadanr', 'balumath', 'chandwa',
    ],
};

// ── FLAT LIST OF ALL JHARKHAND LOCALITIES ──
const ALL_JHARKHAND_LOCATIONS = Object.values(JHARKHAND_HIERARCHY).flat();

// ── ALIASES (common misspellings / alternate names) ──
const LOCATION_ALIASES = {
    'jsr': 'jamshedpur',
    'bskcity': 'bokaro steel city',
    'baidyanathdham': 'deoghar',
    'daltonganj': 'medininagar',
    'singhmore': 'singhbhum',
    'rourkela': 'jamshedpur', // bordering, often mentioned
    'chaibasha': 'chaibasa',
    'medinipur': 'medininagar',
    'jharkand': 'jharkhand',
    'jharkhnd': 'jharkhand',
    'rachi': 'ranchi',
    'ranchy': 'ranchi',
};

/**
 * Normalize a location string — lowercase, trim, apply aliases
 * @param {string} loc
 * @returns {string}
 */
const normalizeLocation = (loc) => {
    if (!loc) return '';
    const cleaned = loc.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    return LOCATION_ALIASES[cleaned] || cleaned;
};

/**
 * Expand a location query to include all sub-localities.
 *
 * Examples:
 *   expandLocation("Jharkhand") → all 200+ localities
 *   expandLocation("Ranchi")    → ranchi + tupudana + nagri + lodhma + ...
 *   expandLocation("Tupudana")  → ["tupudana"]
 *   expandLocation("Lodhma, Nagri") → ["lodhma", "nagri"]
 *
 * @param {string|string[]} locationInput - single string or array of locations
 * @returns {string[]} - unique array of lowercase location strings to search
 */
const expandLocation = (locationInput) => {
    if (!locationInput) return [];

    // Support comma-separated or array input
    const inputList = Array.isArray(locationInput)
        ? locationInput
        : locationInput.split(/[,;]/).map(l => l.trim());

    const expanded = new Set();

    for (const rawLoc of inputList) {
        const loc = normalizeLocation(rawLoc);
        if (!loc) continue;

        // Check if it's "jharkhand" (state-level) → return everything
        if (loc === 'jharkhand' || loc === 'jharkhand state') {
            ALL_JHARKHAND_LOCATIONS.forEach(l => expanded.add(l));
            continue;
        }

        // Check if it matches a district key exactly
        if (JHARKHAND_HIERARCHY[loc]) {
            JHARKHAND_HIERARCHY[loc].forEach(l => expanded.add(l));
            continue;
        }

        // Check if the query is contained in any district key or name
        let foundInDistrict = false;
        for (const [district, localities] of Object.entries(JHARKHAND_HIERARCHY)) {
            // If query matches district name
            if (district.includes(loc) || loc.includes(district)) {
                localities.forEach(l => expanded.add(l));
                foundInDistrict = true;
                break;
            }
        }
        if (foundInDistrict) continue;

        // Otherwise add the raw locality name (it may match in DB)
        expanded.add(loc);
        // Also add original casing in case DB has sentence case
        expanded.add(rawLoc.trim());
    }

    return [...expanded].filter(Boolean);
};

/**
 * Build a MongoDB $or query for location matching
 * Handles multi-location + hierarchy expansion
 *
 * @param {string|string[]} locationInput
 * @returns {object|null} - MongoDB query fragment or null if no location
 */
const buildLocationQuery = (locationInput) => {
    const locations = expandLocation(locationInput);
    if (locations.length === 0) return null;

    // If the expanded set is very large (e.g., all of Jharkhand),
    // use a simple regex on state name instead
    if (locations.length > 50) {
        return { location: { $regex: 'jharkhand|ranchi|jamshedpur|dhanbad|bokaro', $options: 'i' } };
    }

    // Build $or with regex for each location
    const orConditions = locations.map(loc => ({
        location: { $regex: loc, $options: 'i' },
    }));

    return { $or: orConditions };
};

/**
 * Find which district a locality belongs to
 * @param {string} locality
 * @returns {string|null}
 */
const getDistrict = (locality) => {
    const norm = normalizeLocation(locality);
    for (const [district, localities] of Object.entries(JHARKHAND_HIERARCHY)) {
        if (localities.includes(norm) || district === norm) {
            return district;
        }
    }
    return null;
};

/**
 * Check if a location is in Jharkhand
 * @param {string} location
 * @returns {boolean}
 */
const isInJharkhand = (location) => {
    const norm = normalizeLocation(location);
    if (norm === 'jharkhand') return true;
    return ALL_JHARKHAND_LOCATIONS.includes(norm) ||
        Object.keys(JHARKHAND_HIERARCHY).includes(norm);
};

module.exports = {
    expandLocation,
    buildLocationQuery,
    normalizeLocation,
    getDistrict,
    isInJharkhand,
    JHARKHAND_HIERARCHY,
    ALL_JHARKHAND_LOCATIONS,
};
