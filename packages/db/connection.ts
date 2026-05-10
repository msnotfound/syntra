import mongoose from 'mongoose';

let cachedConnection: typeof mongoose | null = null;

// Use global to persist the MongoMemoryServer across HMR reloads in dev
const globalWithMongo = global as typeof globalThis & {
  cachedMongod?: any;
};

export async function connectDb(): Promise<typeof mongoose> {
  if (cachedConnection && mongoose.connection.readyState === 1) return cachedConnection;

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? 'syntra';

  if (!uri) {
    if (!globalWithMongo.cachedMongod) {
      console.warn('[MOCK] MONGODB_URI not set — starting singleton in-memory MongoDB (mongodb-memory-server).');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      
      // Configure for low memory footprint and no disk persistence/journaling
      globalWithMongo.cachedMongod = await MongoMemoryServer.create({
        instance: {
          dbName,
          // Limit memory usage for WiredTiger cache (default is 50% of RAM - 1GB)
          // For dev, 256MB is plenty.
          args: ['--wiredTigerCacheSizeGB', '0.25', '--nojournal'],
          storageEngine: 'ephemeralForTest', // Use purely in-memory engine if available
        },
      });
      
      // Ensure we stop the server on process exit
      const cleanup = async () => {
        if (globalWithMongo.cachedMongod) {
          console.log('[MOCK] Stopping in-memory MongoDB...');
          await globalWithMongo.cachedMongod.stop();
          globalWithMongo.cachedMongod = null;
        }
      };
      
      process.on('SIGTERM', cleanup);
      process.on('SIGINT', cleanup);
      // Also catch uncaught exceptions to try and cleanup
      process.on('uncaughtException', cleanup);
    }
    
    const inMemoryUri = globalWithMongo.cachedMongod.getUri();
    cachedConnection = await mongoose.connect(inMemoryUri, { dbName });
    return cachedConnection;
  }

  cachedConnection = await mongoose.connect(uri, { dbName });
  return cachedConnection;
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  cachedConnection = null;
}
