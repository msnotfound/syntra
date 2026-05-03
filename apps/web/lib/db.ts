import { connectDb } from '@syntra/db';
import { Organization } from '@syntra/db';

let connecting: Promise<unknown> | null = null;

export async function ensureDb() {
  if (!connecting) {
    connecting = (async () => {
      await connectDb();
      // In-memory mode: auto-seed demo data so the web server has data without a separate seed step
      if (!process.env.MONGODB_URI) {
        const exists = await Organization.findOne({ slug: 'sundaram-pharma' }).lean();
        if (!exists) {
          const { seedSundaramPharma } = await import('@syntra/db/seed/api');
          await seedSundaramPharma();
          console.log('[db] Auto-seeded demo data (in-memory mode)');
        }
      }
    })();
  }
  return connecting;
}
