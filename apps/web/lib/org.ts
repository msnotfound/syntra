import { Organization } from '@syntra/db';
import type { IOrganization } from '@syntra/db';
import { ensureDb } from './db';

export async function getOrgBySlug(slug: string): Promise<IOrganization | null> {
  await ensureDb();
  return Organization.findOne({ slug, status: { $ne: 'cancelled' } }).lean();
}

export async function getOrgBySlugOrThrow(slug: string): Promise<IOrganization> {
  const org = await getOrgBySlug(slug);
  if (!org) throw Object.assign(new Error('Org not found'), { status: 404 });
  return org;
}

export const PLAN_LIMITS = {
  trial:      { entities: 50,  apiPerMin: 100 },
  starter:    { entities: 100, apiPerMin: 100 },
  growth:     { entities: 500, apiPerMin: 1000 },
  enterprise: { entities: Infinity, apiPerMin: 10000 },
};
