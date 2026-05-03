console.warn('[MOCK] Using mock Clerk — set CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env and restart to use real.');

export const mockOrg = {
  id: 'org_mock_sundaram',
  name: 'Sundaram Pharma',
  slug: 'sundaram-pharma',
  membersCount: 3,
};

export const mockUser = {
  id: 'user_mock_priya',
  firstName: 'Priya',
  lastName: 'Mehta',
  fullName: 'Priya Mehta',
  primaryEmailAddress: { emailAddress: 'priya@sundarampharma.com' },
  imageUrl: '',
  organizationMemberships: [
    { organization: mockOrg, role: 'org:admin' },
  ],
};

export function auth() {
  return {
    userId: mockUser.id,
    orgId: mockOrg.id,
    orgSlug: mockOrg.slug,
    orgRole: 'org:admin' as const,
  };
}

export function currentUser() {
  return Promise.resolve(mockUser);
}

export function clerkClient() {
  return {
    users: {
      getUser: (_id: string) => Promise.resolve(mockUser),
    },
    organizations: {
      getOrganization: (_id: string) => Promise.resolve(mockOrg),
      getOrganizationMembershipList: (_opts: unknown) => Promise.resolve({ data: [{ publicUserData: mockUser, role: 'org:admin' }] }),
    },
  };
}
