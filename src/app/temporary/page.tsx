import { getActionRepository, getActivePlayerAccountId } from "@/app/actions/action-context";
import { TemporaryGroupClient } from "@/components/temporary/temporary-group-client";

export default async function TemporaryGroupPage() {
  const accountId = await getActivePlayerAccountId();
  let userGroups: { id: string; name: string; players: { id: string; name: string }[] }[] = [];

  if (accountId) {
    try {
      const repository = getActionRepository();
      const groups = await repository.listAccountGroups(accountId);
      const organized = await Promise.all(
        groups.map(async (g) => {
          const isOrg = await repository.isGroupOrganizer(g.id, accountId);
          if (!isOrg) return null;
          const players = await repository.listPlayers(g.id);
          return {
            id: g.id,
            name: g.name,
            players: players.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
          };
        }),
      );
      userGroups = organized.filter((g): g is NonNullable<typeof g> => g !== null);
    } catch {
      // Fallback in test/in-memory environments without db
    }
  }

  return <TemporaryGroupClient accountId={accountId} userGroups={userGroups} />;
}
