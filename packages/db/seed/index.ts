import 'dotenv/config';
import { connectDb, disconnectDb } from '../connection.js';
import { seedSundaramPharma } from './sundaram-pharma.js';
import { seedSundaramPharmaV3 } from './sundaram-pharma-v3.js';

async function main() {
  await connectDb();
  await seedSundaramPharma();
  await seedSundaramPharmaV3();
  await disconnectDb();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
