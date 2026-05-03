// Auth abstraction — uses Clerk if keys present, mock otherwise
const hasClerk = !!(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export interface AuthSession {
  userId: string;
  orgId: string;
  orgSlug: string;
  orgRole: string;
}

export async function getServerAuth(): Promise<AuthSession | null> {
  if (hasClerk) {
    const { auth } = await import('@clerk/nextjs/server');
    const session = auth();
    if (!session.userId) return null;
    return {
      userId: session.userId,
      orgId: session.orgId ?? '',
      orgSlug: session.orgSlug ?? '',
      orgRole: session.orgRole ?? 'org:member',
    };
  }
  const { auth } = await import('@syntra/shared/mocks/clerk');
  return auth();
}

export async function requireAuth(): Promise<AuthSession> {
  const session = await getServerAuth();
  if (!session) throw new Error('Unauthorized');
  return session;
}
