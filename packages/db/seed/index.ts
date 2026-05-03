import 'dotenv/config';
import { connectDb, disconnectDb } from '../connection.js';
import { seedSundaramPharma } from './sundaram-pharma.js';

async function main() {
  await connectDb();
  await seedSundaramPharma();
  await disconnectDb();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
