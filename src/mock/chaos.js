import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.MOCK_APP_URL || 'http://localhost:8080';
const action = process.argv[2] || 'crash';

async function main() {
  const endpoint = action === 'recover' ? `${BASE_URL}/chaos/recover` : `${BASE_URL}/chaos/crash`;
  
  try {
    console.log(`💥 Injecting chaos action [${action}] into ${BASE_URL}...`);
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    console.log('✅ Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`❌ Failed to contact mock server at ${BASE_URL}. Ensure the mock server is running: npm run start:mock`);
    process.exit(1);
  }
}

main();
