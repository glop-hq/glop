import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "./db";
import * as Sentry from "@sentry/nextjs";

export const authConfig: NextAuthConfig = {
  providers: [Google, GitHub],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      try {
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
          const slug = user.email
            .split("@")[0]
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-");

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

        // Resolve pending invitations for this email
        const userEmail = user.email!;
        const pendingInvitations = await db
          .select()
          .from(schema.workspace_invitations)
          .where(
            and(
              eq(schema.workspace_invitations.email, userEmail),
              eq(schema.workspace_invitations.status, "pending")
            )
          );

        const now = new Date();
        // Look up the user's ID (may have just been created above)
        const resolvedUser = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, userEmail))
          .limit(1);

        if (resolvedUser[0] && pendingInvitations.length > 0) {
          const userId = resolvedUser[0].id;

          for (const invitation of pendingInvitations) {
            if (new Date(invitation.expires_at) < now) {
              // Expired — mark as revoked
              await db
                .update(schema.workspace_invitations)
                .set({ status: "revoked" })
                .where(eq(schema.workspace_invitations.id, invitation.id));
              continue;
            }

            // Check not already a member
            const alreadyMember = await db
              .select({ id: schema.workspace_members.id })
              .from(schema.workspace_members)
              .where(
                and(
                  eq(
                    schema.workspace_members.workspace_id,
                    invitation.workspace_id
                  ),
                  eq(schema.workspace_members.user_id, userId)
                )
              )
              .limit(1);

            if (alreadyMember.length > 0) {
              await db
                .update(schema.workspace_invitations)
                .set({
                  status: "accepted",
                  accepted_at: now.toISOString(),
                })
                .where(eq(schema.workspace_invitations.id, invitation.id));
              continue;
            }

            // Add to workspace
            await db.insert(schema.workspace_members).values({
              id: crypto.randomUUID(),
              workspace_id: invitation.workspace_id,
              user_id: userId,
              role: invitation.role,
              created_at: now.toISOString(),
            });

            await db
              .update(schema.workspace_invitations)
              .set({
                status: "accepted",
                accepted_at: now.toISOString(),
              })
              .where(eq(schema.workspace_invitations.id, invitation.id));
          }
        }

        return true;
      } catch (error) {
        Sentry.captureException(error);
        console.error("[auth] signIn callback error:", error);
        throw error;
      }
    },

    async jwt({ token, account }) {
      const db = getDb();

      if (account) {
        // On sign-in, look up our user by provider and embed info in the JWT
        const found = await db
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

        if (found[0]) {
          token.user_id = found[0].id;
          token.email = found[0].email;
          token.name = found[0].name;
          token.avatar_url = found[0].avatar_url;
        }
      }

      // Always refresh workspace memberships from DB (IDs + roles only)
      if (token.user_id) {
        const memberships = await db
          .select({
            workspace_id: schema.workspace_members.workspace_id,
            role: schema.workspace_members.role,
          })
          .from(schema.workspace_members)
          .where(eq(schema.workspace_members.user_id, token.user_id as string));

        token.workspaces = memberships.map((m) => ({
          id: m.workspace_id,
          role: m.role,
        }));
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
