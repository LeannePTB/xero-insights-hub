type AdminAuthClient = {
  auth: {
    admin: {
      listUsers: (params: { page: number; perPage: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string | null }> };
        error: { message: string } | null;
      }>;
    };
  };
};

export async function listVerifiedAuthUsers(client: AdminAuthClient) {
  const users: Array<{ id: string; email: string | null }> = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Could not load accounts.");
    users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? null })));
    if (data.users.length < 200) break;
  }
  return users;
}

export async function findVerifiedAuthUserByEmail(client: AdminAuthClient, email: string) {
  const normalised = email.trim().toLowerCase();
  const users = await listVerifiedAuthUsers(client);
  return users.find((user) => user.email?.toLowerCase() === normalised) ?? null;
}