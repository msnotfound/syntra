import mongoose from 'mongoose';

let cachedConnection: typeof mongoose | null = null;

export async function connectDb(): Promise<typeof mongoose> {
  if (cachedConnection && mongoose.connection.readyState === 1) return cachedConnection;

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? 'syntra';

  if (!uri) {
    console.warn('[MOCK] MONGODB_URI not set — using in-memory MongoDB (mongodb-memory-server).');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const inMemoryUri = mongod.getUri();
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
