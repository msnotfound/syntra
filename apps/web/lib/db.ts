import { connectDb } from '@syntra/db';

let connecting: Promise<unknown> | null = null;

export async function ensureDb() {
  if (!connecting) connecting = connectDb();
  return connecting;
}
