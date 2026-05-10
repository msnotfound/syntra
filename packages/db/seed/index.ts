import dotenv from 'dotenv'; import path from 'path'; dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { connectDb, disconnectDb } from '../connection.js';
import { seedSundaramPharma } from './sundaram-pharma.js';
import { seedSundaramPharmaV3 } from './sundaram-pharma-v3.js';
import { seedSanctionsFixtures } from './sanctions-fixtures.js';

async function main() {
  await connectDb();
  await seedSundaramPharma();
  await seedSundaramPharmaV3();
  await seedSanctionsFixtures();
  await disconnectDb();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
