import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "./db";

export const authConfig: NextAuthConfig = {
  providers: [Google, GitHub],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      const db = getDb();
      const provider = account.provider;
      const providerAccountId = account.providerAccountId;

      // Check if user exists
      const existing = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.provider, provider),
            eq(schema.users.provider_account_id, providerAccountId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        // Create new user
        const now = new Date().toISOString();
        const userId = crypto.randomUUID();

        await db.insert(schema.users).values({
          id: userId,
          email: user.email,
          name: user.name || null,
          avatar_url: user.image || null,
          provider,
          provider_account_id: providerAccountId,
          created_at: now,
          updated_at: now,
        });

        // Create a "Personal" workspace for the new user
        const workspaceId = crypto.randomUUID();
        const slug = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");

        await db.insert(schema.workspaces).values({
          id: workspaceId,
          name: "Personal",
          slug: `${slug}-${workspaceId.slice(0, 6)}`,
          created_by: userId,
          created_at: now,
          updated_at: now,
        });

        // Add user as admin of the workspace
        await db.insert(schema.workspace_members).values({
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          user_id: userId,
          role: "admin",
          created_at: now,
        });
      } else {
        // Update existing user info
        await db
          .update(schema.users)
          .set({
            name: user.name || existing[0].name,
            avatar_url: user.image || existing[0].avatar_url,
            updated_at: new Date().toISOString(),
          })
          .where(eq(schema.users.id, existing[0].id));
      }

      return true;
    },

    async jwt({ token, account }) {
      if (account) {
        // On sign-in, look up our user and embed info in the JWT
        const db = getDb();
        const users = await db
          .select()
          .from(schema.users)
          .where(
            and(
              eq(schema.users.provider, account.provider),
              eq(
                schema.users.provider_account_id,
                account.providerAccountId
              )
            )
          )
          .limit(1);

        if (users[0]) {
          token.user_id = users[0].id;
          token.email = users[0].email;
          token.name = users[0].name;
          token.avatar_url = users[0].avatar_url;

          // Fetch workspace memberships
          const memberships = await db
            .select({
              workspace_id: schema.workspace_members.workspace_id,
              role: schema.workspace_members.role,
              workspace_name: schema.workspaces.name,
              workspace_slug: schema.workspaces.slug,
            })
            .from(schema.workspace_members)
            .innerJoin(
              schema.workspaces,
              eq(schema.workspace_members.workspace_id, schema.workspaces.id)
            )
            .where(eq(schema.workspace_members.user_id, users[0].id));

          token.workspaces = memberships.map((m) => ({
            id: m.workspace_id,
            name: m.workspace_name,
            slug: m.workspace_slug,
            role: m.role,
          }));
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.user_id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.avatar_url as string | null;
        (session as unknown as Record<string, unknown>).workspaces = token.workspaces;
      }
      return session;
    },
  },
};
