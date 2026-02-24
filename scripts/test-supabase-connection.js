
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Manually load .env since we don't assume dotenv is installed
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading env from: ${envPath}`);

try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2 && !line.trim().startsWith('#')) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            process.env[key] = value;
        }
    });
} catch (e) {
    console.error('Could not read .env file:', e.message);
    process.exit(1);
}

// 2. Get Credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase Key:', SUPABASE_ANON_KEY ? 'Found (hidden)' : 'Missing');

// 3. Initialize Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 4. Test Connection
async function testConnection() {
    console.log('\nTesting connection to Supabase...');

    // Try to list buckets as a simple connectivity test
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('❌ Connection Failed:', error.message);
    } else {
        console.log('✅ Connection Successful!');
        console.log('Available Storage Buckets:');
        if (data.length === 0) {
            console.log('  (No buckets found)');
        } else {
            data.forEach(bucket => {
                console.log(`  - ${bucket.name} (public: ${bucket.public})`);
            });
        }
    }
}

testConnection();
