import type { DomainRepository } from "@/lib/domain/repositories";
import type {
  AttendanceRecord,
  GroupRecord,
  GroupOrganizerRecord,
  PlayerAccountRecord,
  PlayerGender,
  PlayerSessionHistoryRecord,
  PlayerSynergyRecord,
  PairMatchSynergyResult,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundSitRecord,
  SessionRecord,
  StartedRoundRecord,
  TournamentRecord,
} from "@/lib/domain/types";
import { updateSynergyState } from "@/lib/synergy/calculator";
import { replayRatings } from "@/lib/domain/rating-replay";

interface InMemoryState {
  groups: GroupRecord[];
  playerAccounts: PlayerAccountRecord[];
  groupOrganizers: { groupId: string; accountId: string }[];
  players: PlayerRecord[];
  sessions: SessionRecord[];
  attendance: AttendanceRecord[];
  rounds: RoundRecord[];
  matches: MatchRecord[];
  matchPlayers: MatchPlayerRecord[];
  roundSits: RoundSitRecord[];
  replayMatches: ReplayMatch[];
  ratingSnapshots: Map<string, readonly RatingSnapshot[]>;
  synergies: PlayerSynergyRecord[];
  tournaments: TournamentRecord[];
}

type InMemorySeed = Partial<Omit<InMemoryState, "ratingSnapshots">> & {
  ratingSnapshots?: ReadonlyMap<string, readonly RatingSnapshot[]>;
};

export class InMemoryRepositories implements DomainRepository {
  state: InMemoryState;
  writeCount = 0;
  committedTransactions = 0;

  constructor(seed: InMemorySeed = {}) {
    this.state = {
      groups: structuredClone(seed.groups ?? []),
      playerAccounts: structuredClone(seed.playerAccounts ?? []),
      groupOrganizers: structuredClone(seed.groupOrganizers ?? []),
      players: structuredClone(seed.players ?? []),
      sessions: structuredClone(seed.sessions ?? []),
      attendance: structuredClone(seed.attendance ?? []),
      rounds: structuredClone(seed.rounds ?? []),
      matches: structuredClone(seed.matches ?? []),
      matchPlayers: structuredClone(seed.matchPlayers ?? []),
      roundSits: structuredClone(seed.roundSits ?? []),
      replayMatches: structuredClone(seed.replayMatches ?? []),
      ratingSnapshots: new Map(seed.ratingSnapshots ?? []),
      synergies: structuredClone(seed.synergies ?? []),
      tournaments: structuredClone(seed.tournaments ?? []),
    };
  }

  async transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T> {
    const before = structuredClone(this.state);
    const writesBefore = this.writeCount;
    try {
      const result = await operation(this);
      this.committedTransactions += 1;
      return result;
    } catch (error) {
      this.state = before;
      this.writeCount = writesBefore;
      throw error;
    }
  }

  async getGroup(groupId: string) {
    return this.state.groups.find((group) => group.id === groupId) ?? null;
  }

  async getGroupsByName(name: string) {
    const exactName = name.trim();
    return this.state.groups.filter((group) => group.name === exactName);
  }

  async listPublicGroups(search: string, accountId?: string) {
    const term = search.trim().toLocaleLowerCase();
    return this.state.groups
      .filter((group) => group.isPublic === true && (!term || group.name.toLocaleLowerCase().includes(term)))
      .sort((first, second) => first.name.localeCompare(second.name))
      .slice(0, 50)
      .map((group) => ({
        id: group.id,
        name: group.name,
        playerCount: this.state.players.filter((player) => player.groupId === group.id && player.active).length,
        isMember: accountId ? this.state.players.some((player) => player.groupId === group.id && player.accountId === accountId && player.active) : false,
        isHost: accountId ? group.ownerAccountId === accountId : false,
        isOrganizer: accountId
          ? group.ownerAccountId === accountId ||
            this.state.groupOrganizers.some((org) => org.groupId === group.id && org.accountId === accountId)
          : false,
      }));
  }

  async listAccountGroups(accountId: string) {
    return this.state.groups
      .filter((group) => group.ownerAccountId === accountId ||
        this.state.groupOrganizers.some((item) => item.groupId === group.id && item.accountId === accountId) ||
        this.state.players.some((player) => player.groupId === group.id && player.accountId === accountId && player.active))
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((group) => ({
        id: group.id,
        name: group.name,
        playerCount: this.state.players.filter((player) => player.groupId === group.id && player.active).length,
        isMember: this.state.players.some((player) => player.groupId === group.id && player.accountId === accountId && player.active),
        isHost: group.ownerAccountId === accountId,
        isOrganizer: group.ownerAccountId === accountId || this.state.groupOrganizers.some((item) => item.groupId === group.id && item.accountId === accountId),
      }));
  }

  async isGroupOrganizer(groupId: string, accountId: string) {
    return this.state.groups.some((group) => group.id === groupId && group.ownerAccountId === accountId) ||
      this.state.groupOrganizers.some((item) => item.groupId === groupId && item.accountId === accountId);
  }

  async addGroupOrganizer(groupId: string, accountId: string) {
    if (!this.state.groupOrganizers.some((item) => item.groupId === groupId && item.accountId === accountId)) {
      this.state.groupOrganizers.push({ groupId, accountId });
      this.writeCount += 1;
    }
  }

  async removeGroupOrganizer(groupId: string, accountId: string) {
    this.state.groupOrganizers = this.state.groupOrganizers.filter(
      (item) => !(item.groupId === groupId && item.accountId === accountId),
    );
    this.writeCount += 1;
  }

  async listGroupOrganizers(groupId: string): Promise<readonly GroupOrganizerRecord[]> {
    const group = this.state.groups.find((item) => item.id === groupId);
    const entries = [
      ...(group?.ownerAccountId ? [{ accountId: group.ownerAccountId, isHost: true }] : []),
      ...this.state.groupOrganizers.filter((item) => item.groupId === groupId && item.accountId !== group?.ownerAccountId).map((item) => ({ accountId: item.accountId, isHost: false })),
    ];
    return entries.flatMap(({ accountId, isHost }) => {
      const account = this.state.playerAccounts.find((item) => item.id === accountId);
      return account ? [{ accountId, username: account.username, name: account.name, isHost }] : [];
    });
  }

  async transferGroupHost(groupId: string, newHostAccountId: string) {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (!group) return;
    const oldHostAccountId = group.ownerAccountId;
    this.state.groups = this.state.groups.map((item) =>
      item.id === groupId ? { ...item, ownerAccountId: newHostAccountId } : item
    );
    this.state.groupOrganizers = this.state.groupOrganizers.filter(
      (item) => !(item.groupId === groupId && item.accountId === newHostAccountId)
    );
    if (oldHostAccountId && !this.state.groupOrganizers.some((item) => item.groupId === groupId && item.accountId === oldHostAccountId)) {
      this.state.groupOrganizers.push({ groupId, accountId: oldHostAccountId });
    }
    this.writeCount += 1;
  }

  async getPlayerAccount(accountId: string) {
    return this.state.playerAccounts.find((account) => account.id === accountId) ?? null;
  }

  async getPlayerAccountByUsername(username: string) {
    const normalized = username.trim().toLowerCase();
    return this.state.playerAccounts.find((account) => account.username.toLowerCase() === normalized) ?? null;
  }

  async createPlayerAccount(account: PlayerAccountRecord) {
    const username = account.username.trim().toLowerCase();
    if (this.state.playerAccounts.some((item) => item.username.trim().toLowerCase() === username)) {
      throw new Error("Username already exists");
    }
    this.state.playerAccounts.push(structuredClone({ ...account, username }));
  }

  async updatePlayerAccountName(accountId: string, name: string) {
    const account = this.state.playerAccounts.find((item) => item.id === accountId);
    if (!account) return;
    account.name = name;
    this.state.players = this.state.players.map((player) =>
      player.accountId === accountId ? { ...player, name } : player,
    );
  }

  async updatePlayerAccountUsername(accountId: string, username: string) {
    const normalized = username.trim().toLowerCase();
    const existing = this.state.playerAccounts.find(
      (account) => account.username.toLowerCase() === normalized && account.id !== accountId,
    );
    if (existing) {
      throw new Error("Username already exists");
    }
    const account = this.state.playerAccounts.find((item) => item.id === accountId);
    if (!account) return;
    (account as { username: string }).username = normalized;
  }

  async updatePlayerAccountGender(accountId: string, gender: PlayerGender) {
    const account = this.state.playerAccounts.find((item) => item.id === accountId);
    if (!account) return;
    account.gender = gender;
    this.state.players = this.state.players.map((player) =>
      player.accountId === accountId ? { ...player, gender } : player,
    );
  }

  async addPlayerToGroup(accountId: string, groupId: string) {
    const account = this.state.playerAccounts.find((item) => item.id === accountId);
    const group = this.state.groups.find((item) => item.id === groupId);
    if (!account || !group) return null;
    const existing = this.state.players.find((player) => player.groupId === groupId && player.accountId === accountId);
    if (existing) {
      const reactivated = { ...existing, active: true, username: existing.username ?? account.username, gender: existing.gender ?? account.gender ?? null };
      this.state.players = this.state.players.map((player) => player.id === existing.id ? reactivated : player);
      return reactivated;
    }
    const player: PlayerRecord = {
      id: `ply_${this.state.players.length + 1}`,
      groupId,
      name: account.name,
      initialRating: account.initialRating,
      rating: account.rating ?? account.initialRating,
      ratedGamesPlayed: account.ratedGamesPlayed ?? 0,
      active: true,
      accountId,
      username: account.username,
      gender: account.gender ?? null,
    };
    this.state.players.push(player);
    return player;
  }

  async linkGuestPlayer(groupId: string, playerId: string, accountId: string): Promise<PlayerRecord | null> {
    const account = this.state.playerAccounts.find((item) => item.id === accountId);
    if (!account) return null;

    const playerIndex = this.state.players.findIndex(
      (item) => item.id === playerId && item.groupId === groupId && !item.accountId,
    );
    if (playerIndex === -1) return null;

    const guestPlayer = this.state.players[playerIndex];

    const existingIndex = this.state.players.findIndex(
      (item) => item.groupId === groupId && item.accountId === accountId,
    );

    if (existingIndex !== -1) {
      const existingPlayer = this.state.players[existingIndex];
      const targetPlayerId = existingPlayer.id;

      // session_attendance
      const sAttendances = this.state.attendance.filter((a) => a.playerId === playerId);
      for (const sa of sAttendances) {
        const targetAttIndex = this.state.attendance.findIndex(
          (a) => a.sessionId === sa.sessionId && a.playerId === targetPlayerId,
        );
        if (targetAttIndex >= 0) {
          const targetAtt = this.state.attendance[targetAttIndex];
          const minJoined = Math.min(targetAtt.joinedRound, sa.joinedRound);
          const mergedLeft =
            targetAtt.leftRound === null || sa.leftRound === null
              ? null
              : Math.max(targetAtt.leftRound, sa.leftRound);
          this.state.attendance[targetAttIndex] = {
            ...targetAtt,
            joinedRound: minJoined,
            leftRound: mergedLeft,
          };
          this.state.attendance = this.state.attendance.filter(
            (a) => !(a.sessionId === sa.sessionId && a.playerId === playerId),
          );
        } else {
          this.state.attendance = this.state.attendance.map((a) =>
            a.sessionId === sa.sessionId && a.playerId === playerId
              ? { ...a, playerId: targetPlayerId }
              : a,
          );
        }
      }

      // match_players
      const sMatchPlayers = this.state.matchPlayers.filter((mp) => mp.playerId === playerId);
      for (const sm of sMatchPlayers) {
        const existsTarget = this.state.matchPlayers.some(
          (mp) => mp.matchId === sm.matchId && mp.playerId === targetPlayerId,
        );
        if (existsTarget) {
          this.state.matchPlayers = this.state.matchPlayers.filter(
            (mp) => !(mp.matchId === sm.matchId && mp.playerId === playerId),
          );
        } else {
          this.state.matchPlayers = this.state.matchPlayers.map((mp) =>
            mp.matchId === sm.matchId && mp.playerId === playerId
              ? { ...mp, playerId: targetPlayerId }
              : mp,
          );
        }
      }

      // round_sits
      const sSits = this.state.roundSits.filter((s) => s.playerId === playerId);
      for (const ss of sSits) {
        const existsTarget = this.state.roundSits.some(
          (s) => s.roundId === ss.roundId && s.playerId === targetPlayerId,
        );
        if (existsTarget) {
          this.state.roundSits = this.state.roundSits.filter(
            (s) => !(s.roundId === ss.roundId && s.playerId === playerId),
          );
        } else {
          this.state.roundSits = this.state.roundSits.map((s) =>
            s.roundId === ss.roundId && s.playerId === playerId
              ? { ...s, playerId: targetPlayerId }
              : s,
          );
        }
      }

      // Delete duplicate guest player from players state
      this.state.players = this.state.players.filter((p) => p.id !== playerId);

      // Update target existing player
      const updatedExisting: PlayerRecord = {
        ...existingPlayer,
        active: true,
        gender: existingPlayer.gender ?? guestPlayer.gender ?? account.gender ?? null,
        name: account.name,
        username: account.username,
      };

      const finalExistingIndex = this.state.players.findIndex((p) => p.id === targetPlayerId);
      if (finalExistingIndex !== -1) {
        this.state.players[finalExistingIndex] = updatedExisting;
      }

      await replayRatings(groupId, this);

      return this.state.players.find((p) => p.id === targetPlayerId) ?? updatedExisting;
    }

    const updated: PlayerRecord = {
      ...guestPlayer,
      accountId: account.id,
      username: account.username,
      name: account.name,
      gender: guestPlayer.gender ?? account.gender ?? null,
      initialRating: account.initialRating,
      rating: account.rating ?? account.initialRating,
      ratedGamesPlayed: account.ratedGamesPlayed ?? 0,
      active: true,
    };
    this.state.players[playerIndex] = updated;
    await replayRatings(groupId, this);
    return this.state.players[playerIndex] ?? updated;
  }

  async joinPublicGroup(accountId: string, groupId: string) {
    const group = this.state.groups.find((item) => item.id === groupId && (item.isPublic === true || item.ownerAccountId === accountId));
    if (!group) return null;
    return this.addPlayerToGroup(accountId, groupId);
  }

  async leavePublicGroup(accountId: string, groupId: string) {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (group?.ownerAccountId === accountId) return false;
    const membership = this.state.players.find(
      (player) => player.groupId === groupId && player.accountId === accountId && player.active,
    );
    if (!membership) return false;
    this.state.groupOrganizers = this.state.groupOrganizers.filter(
      (item) => !(item.groupId === groupId && item.accountId === accountId),
    );
    this.state.players = this.state.players.map((player) =>
      player.id === membership.id ? { ...player, active: false } : player,
    );
    return true;
  }

  async listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]> {
    const memberships = this.state.players.filter((player) => player.accountId === accountId);
    const history: PlayerSessionHistoryRecord[] = [];
    for (const player of memberships) {
      const group = this.state.groups.find((item) => item.id === player.groupId);
      for (const attendance of this.state.attendance.filter((entry) => entry.playerId === player.id)) {
        const session = this.state.sessions.find((item) => item.id === attendance.sessionId);
        if (!session || !group) continue;
        const rounds = this.state.rounds.filter((round) => round.sessionId === session.id);
        const roundIds = new Set(rounds.map((round) => round.id));
        const matchIds = new Set(this.state.matches.filter((match) => roundIds.has(match.roundId) && match.status === "completed").map((match) => match.id));
        let wins = 0;
        let losses = 0;
        const account = this.state.playerAccounts.find((item) => item.id === accountId);
        let rating = account?.rating ?? account?.initialRating ?? player.initialRating;
        const playerMatches = this.state.matchPlayers
          .filter((membership) => membership.playerId === player.id && matchIds.has(membership.matchId))
          .sort((first, second) => (this.state.matches.find((match) => match.id === first.matchId)?.completedAt?.getTime() ?? 0) - (this.state.matches.find((match) => match.id === second.matchId)?.completedAt?.getTime() ?? 0));
        for (const matchPlayer of playerMatches) {
          const match = this.state.matches.find((item) => item.id === matchPlayer.matchId);
          if (!match || match.team1Score === null || match.team2Score === null) continue;
          const won = (matchPlayer.team === 1 && match.team1Score > match.team2Score) || (matchPlayer.team === 2 && match.team2Score > match.team1Score);
          if (won) wins += 1;
          else losses += 1;
          if (matchPlayer.ratingAfter !== null) rating = matchPlayer.ratingAfter ?? rating;
        }
        history.push({
          sessionId: session.id,
          groupId: group.id,
          groupName: group.name,
          startedAt: session.startedAt,
          wins,
          losses,
          rating,
          type: session.type ?? "regular",
          sessionName: session.name ?? null,
        });
      }
    }
    return history.sort((first, second) => second.startedAt.getTime() - first.startedAt.getTime());
  }

  async updateGroupVisibility(groupId: string, isPublic: boolean) {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (group) this.state.groups = this.state.groups.map((item) => item.id === groupId ? { ...item, isPublic } : item);
  }

  async updateGroupName(groupId: string, name: string) {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (group) {
      this.state.groups = this.state.groups.map((item) => item.id === groupId ? { ...item, name } : item);
      this.writeCount += 1;
    }
  }

  async deleteGroup(groupId: string) {
    this.state.groups = this.state.groups.filter((g) => g.id !== groupId);
    this.state.groupOrganizers = this.state.groupOrganizers.filter((o) => o.groupId !== groupId);
    const sessionIds = new Set(this.state.sessions.filter((s) => s.groupId === groupId).map((s) => s.id));
    this.state.sessions = this.state.sessions.filter((s) => s.groupId !== groupId);
    const roundIds = new Set(this.state.rounds.filter((r) => sessionIds.has(r.sessionId)).map((r) => r.id));
    this.state.rounds = this.state.rounds.filter((r) => !sessionIds.has(r.sessionId));
    const matchIds = new Set(this.state.matches.filter((m) => roundIds.has(m.roundId)).map((m) => m.id));
    this.state.matches = this.state.matches.filter((m) => !roundIds.has(m.roundId));
    this.state.matchPlayers = this.state.matchPlayers.filter((mp) => !matchIds.has(mp.matchId));
    this.state.roundSits = this.state.roundSits.filter((rs) => !roundIds.has(rs.roundId));
    this.state.attendance = this.state.attendance.filter((a) => !sessionIds.has(a.sessionId));
    this.state.players = this.state.players.filter((p) => p.groupId !== groupId);
    this.writeCount += 1;
  }

  async insertGroup(group: GroupRecord) {
    this.state.groups.push(structuredClone(group));
    this.writeCount += 1;
  }

  async listSessions(groupId: string) {
    return this.state.sessions
      .filter((session) => session.groupId === groupId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async createPlayer(player: PlayerRecord) {
    this.state.players.push(structuredClone(player));
    this.writeCount += 1;
  }

  async updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }) {
    const existing = this.state.players.find(
      (p) => p.id === player.id && p.groupId === player.groupId,
    );
    if (existing) {
      if (player.name !== undefined) Object.assign(existing, { name: player.name });
      if (player.active !== undefined) Object.assign(existing, { active: player.active });
      if (player.initialRating !== undefined) {
        Object.assign(existing, { initialRating: player.initialRating });
        if (existing.accountId) {
          const account = this.state.playerAccounts.find((a) => a.id === existing.accountId);
          if (account) (account as { initialRating: number }).initialRating = player.initialRating;
          for (const p of this.state.players) {
            if (p.accountId === existing.accountId) {
              Object.assign(p, { initialRating: player.initialRating });
            }
          }
        }
      }
      this.writeCount += 1;
    }
  }

  async removePlayerFromGroup(playerId: string, groupId: string): Promise<boolean> {
    const player = this.state.players.find((p) => p.id === playerId && p.groupId === groupId);
    if (!player) return false;
    const group = this.state.groups.find((g) => g.id === groupId);
    if (group && player.accountId && group.ownerAccountId === player.accountId) {
      return false;
    }
    if (player.accountId) {
      this.state.groupOrganizers = this.state.groupOrganizers.filter(
        (o) => !(o.groupId === groupId && o.accountId === player.accountId),
      );
    }
    this.state.players = this.state.players.map((p) =>
      p.id === playerId && p.groupId === groupId ? { ...p, active: false } : p,
    );
    const activeSessionIds = new Set(
      this.state.sessions
        .filter((s) => s.groupId === groupId && s.status === "active")
        .map((s) => s.id),
    );
    this.state.attendance = this.state.attendance.map((att) => {
      if (att.playerId === playerId && activeSessionIds.has(att.sessionId) && att.leftRound === null) {
        const session = this.state.sessions.find((s) => s.id === att.sessionId);
        return {
          ...att,
          leftRound: (session?.currentRoundNumber ?? 0) + 1,
        };
      }
      return att;
    });
    this.writeCount += 1;
    return true;
  }

  async deletePlayer(playerId: string, groupId: string) {
    await this.removePlayerFromGroup(playerId, groupId);
  }

  async mergeGuestPlayers(
    groupId: string,
    targetPlayerId: string,
    sourcePlayerIds: readonly string[],
    mergedName: string,
  ): Promise<PlayerRecord> {
    const targetPlayer = this.state.players.find((p) => p.id === targetPlayerId && p.groupId === groupId);
    if (!targetPlayer || targetPlayer.accountId) {
      throw new Error("Target player is not a valid guest player in this group.");
    }

    for (const sId of sourcePlayerIds) {
      if (sId === targetPlayerId) continue;
      const sPlayer = this.state.players.find((p) => p.id === sId && p.groupId === groupId);
      if (!sPlayer || sPlayer.accountId) {
        throw new Error("One or more players to merge are not valid guest players in this group.");
      }

      // session_attendance
      const sAttendances = this.state.attendance.filter((a) => a.playerId === sId);
      for (const sa of sAttendances) {
        const targetAttIndex = this.state.attendance.findIndex(
          (a) => a.sessionId === sa.sessionId && a.playerId === targetPlayerId,
        );
        if (targetAttIndex >= 0) {
          const targetAtt = this.state.attendance[targetAttIndex];
          const minJoined = Math.min(targetAtt.joinedRound, sa.joinedRound);
          const mergedLeft =
            targetAtt.leftRound === null || sa.leftRound === null
              ? null
              : Math.max(targetAtt.leftRound, sa.leftRound);
          this.state.attendance[targetAttIndex] = {
            ...targetAtt,
            joinedRound: minJoined,
            leftRound: mergedLeft,
          };
          this.state.attendance = this.state.attendance.filter(
            (a) => !(a.sessionId === sa.sessionId && a.playerId === sId),
          );
        } else {
          this.state.attendance = this.state.attendance.map((a) =>
            a.sessionId === sa.sessionId && a.playerId === sId
              ? { ...a, playerId: targetPlayerId }
              : a,
          );
        }
      }

      // match_players
      const sMatchPlayers = this.state.matchPlayers.filter((mp) => mp.playerId === sId);
      for (const sm of sMatchPlayers) {
        const existsTarget = this.state.matchPlayers.some(
          (mp) => mp.matchId === sm.matchId && mp.playerId === targetPlayerId,
        );
        if (existsTarget) {
          this.state.matchPlayers = this.state.matchPlayers.filter(
            (mp) => !(mp.matchId === sm.matchId && mp.playerId === sId),
          );
        } else {
          this.state.matchPlayers = this.state.matchPlayers.map((mp) =>
            mp.matchId === sm.matchId && mp.playerId === sId
              ? { ...mp, playerId: targetPlayerId }
              : mp,
          );
        }
      }

      // round_sits
      const sSits = this.state.roundSits.filter((s) => s.playerId === sId);
      for (const ss of sSits) {
        const existsTarget = this.state.roundSits.some(
          (s) => s.roundId === ss.roundId && s.playerId === targetPlayerId,
        );
        if (existsTarget) {
          this.state.roundSits = this.state.roundSits.filter(
            (s) => !(s.roundId === ss.roundId && s.playerId === sId),
          );
        } else {
          this.state.roundSits = this.state.roundSits.map((s) =>
            s.roundId === ss.roundId && s.playerId === sId
              ? { ...s, playerId: targetPlayerId }
              : s,
          );
        }
      }

      // Delete duplicate guest player from players state
      this.state.players = this.state.players.filter((p) => p.id !== sId);
    }

    // Update target player name
    const targetIndex = this.state.players.findIndex((p) => p.id === targetPlayerId);
    this.state.players[targetIndex] = {
      ...this.state.players[targetIndex],
      name: mergedName.trim(),
    };

    // Replay ratings
    await replayRatings(groupId, this);

    this.writeCount += 1;
    return this.state.players.find((p) => p.id === targetPlayerId)!;
  }


  async getSession(sessionId: string) {
    return this.state.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async listPlayers(groupId?: string, options?: { includeInactive?: boolean }) {
    return this.state.players
      .filter((player) => (!groupId || player.groupId === groupId) && (options?.includeInactive ? true : player.active))
      .map((player) => {
        if (player.accountId) {
          const account = this.state.playerAccounts.find((a) => a.id === player.accountId);
          if (account) {
            return {
              ...player,
              username: account.username ?? player.username,
              rating: account.rating ?? player.rating,
              ratedGamesPlayed: account.ratedGamesPlayed ?? player.ratedGamesPlayed,
              gender: player.gender ?? account.gender ?? null,
            };
          }
        }
        return player;
      });
  }

  async listAttendance(sessionId: string) {
    return this.state.attendance.filter((item) => item.sessionId === sessionId);
  }

  async listStartedRounds(sessionId: string): Promise<readonly StartedRoundRecord[]> {
    return this.state.rounds
      .filter((round) => round.sessionId === sessionId)
      .map((round) => {
        const matches = this.state.matches.filter((match) => match.roundId === round.id);
        const matchIds = new Set(matches.map((match) => match.id));
        return {
          round,
          matches,
          matchPlayers: this.state.matchPlayers.filter((item) => matchIds.has(item.matchId)),
          sits: this.state.roundSits.filter((sit) => sit.roundId === round.id),
        };
      });
  }

  async getRound(roundId: string) {
    return this.state.rounds.find((round) => round.id === roundId) ?? null;
  }

  async getMatch(matchId: string) {
    return this.state.matches.find((match) => match.id === matchId) ?? null;
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]) {
    this.state.sessions.push(structuredClone(session));
    this.state.attendance.push(...structuredClone(attendance));
    this.writeCount += 1;
  }

  async updateSession(session: SessionRecord) {
    this.state.sessions = this.state.sessions.map((item) =>
      item.id === session.id ? structuredClone(session) : item,
    );
    this.writeCount += 1;
  }

  async updateSessionName(sessionId: string, name: string) {
    const session = this.state.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.name = name;
      this.writeCount += 1;
    }
  }

  async deleteSession(sessionId: string, groupId: string): Promise<void> {
    const session = this.state.sessions.find((s) => s.id === sessionId && s.groupId === groupId);
    if (!session) return;

    const sessionRoundIds = new Set(this.state.rounds.filter((r) => r.sessionId === sessionId).map((r) => r.id));
    const sessionMatchIds = new Set(this.state.matches.filter((m) => sessionRoundIds.has(m.roundId)).map((m) => m.id));

    this.state.sessions = this.state.sessions.filter((s) => s.id !== sessionId);
    this.state.attendance = this.state.attendance.filter((a) => a.sessionId !== sessionId);
    this.state.matchPlayers = this.state.matchPlayers.filter((mp) => !sessionMatchIds.has(mp.matchId));
    this.state.roundSits = this.state.roundSits.filter((rs) => !sessionRoundIds.has(rs.roundId));
    this.state.matches = this.state.matches.filter((m) => !sessionRoundIds.has(m.roundId));
    this.state.rounds = this.state.rounds.filter((r) => !sessionRoundIds.has(r.id));
    this.writeCount += 1;
  }

  async saveAttendance(attendance: AttendanceRecord) {
    const index = this.state.attendance.findIndex(
      (item) =>
        item.sessionId === attendance.sessionId && item.playerId === attendance.playerId,
    );
    if (index === -1) this.state.attendance.push(structuredClone(attendance));
    else this.state.attendance[index] = structuredClone(attendance);
    this.writeCount += 1;
  }

  async insertStartedRound(record: StartedRoundRecord) {
    this.state.rounds.push(structuredClone(record.round));
    this.state.matches.push(...structuredClone(record.matches));
    this.state.matchPlayers.push(...structuredClone(record.matchPlayers));
    this.state.roundSits.push(...structuredClone(record.sits));
    this.writeCount += 1;
  }

  async insertMatch(match: MatchRecord, matchPlayers: readonly MatchPlayerRecord[]) {
    this.state.matches.push(structuredClone(match));
    this.state.matchPlayers.push(...structuredClone(matchPlayers));
    this.writeCount += 1;
  }

  async updateMatch(match: MatchRecord) {
    this.state.matches = this.state.matches.map((item) =>
      item.id === match.id ? structuredClone(match) : item,
    );
    this.writeCount += 1;
  }

  async updateMatchPlayers(matchId: string, matchPlayers: readonly MatchPlayerRecord[]) {
    this.state.matchPlayers = this.state.matchPlayers.filter((mp) => mp.matchId !== matchId);
    this.state.matchPlayers.push(...structuredClone(matchPlayers));
    this.writeCount += 1;
  }

  async deleteMatch(matchId: string) {
    this.state.matches = this.state.matches.filter((m) => m.id !== matchId);
    this.state.matchPlayers = this.state.matchPlayers.filter((mp) => mp.matchId !== matchId);
    this.state.ratingSnapshots.delete(matchId);
    this.writeCount += 1;
  }

  async updateRound(round: RoundRecord) {
    this.state.rounds = this.state.rounds.map((item) =>
      item.id === round.id ? structuredClone(round) : item,
    );
    this.writeCount += 1;
  }

  async deleteRound(roundId: string) {
    const matchIds = new Set(
      this.state.matches.filter((match) => match.roundId === roundId).map((match) => match.id),
    );
    this.state.rounds = this.state.rounds.filter((round) => round.id !== roundId);
    this.state.matches = this.state.matches.filter((match) => match.roundId !== roundId);
    this.state.matchPlayers = this.state.matchPlayers.filter(
      (item) => !matchIds.has(item.matchId),
    );
    this.state.roundSits = this.state.roundSits.filter((sit) => sit.roundId !== roundId);
    for (const matchId of matchIds) this.state.ratingSnapshots.delete(matchId);
    this.writeCount += 1;
  }

  async listReplayMatches(groupId?: string): Promise<readonly ReplayMatch[]> {
    const sessions = new Map(
      this.state.sessions
        .filter((session) => !groupId || session.groupId === groupId)
        .map((session) => [session.id, session]),
    );
    const rounds = new Map(
      this.state.rounds
        .filter((round) => sessions.has(round.sessionId))
        .map((round) => [round.id, round]),
    );
    const actual = this.state.matches.flatMap((match): ReplayMatch[] => {
      if (!rounds.has(match.roundId) || match.status === "pending" || !match.completedAt) return [];
      const session = sessions.get(rounds.get(match.roundId)!.sessionId);
      if (!session) return [];
      const members = this.state.matchPlayers.filter((item) => item.matchId === match.id);
      const team1 = members.filter((item) => item.team === 1).map((item) => item.playerId);
      const team2 = members.filter((item) => item.team === 2).map((item) => item.playerId);
      if (team1.length !== 2 || team2.length !== 2) return [];
      return [
        {
          id: match.id,
          groupId: session.groupId,
          status: match.status,
          completedAt: match.completedAt,
          team1: [team1[0], team1[1]],
          team2: [team2[0], team2[1]],
          team1Score: match.team1Score ?? 0,
          team2Score: match.team2Score ?? 0,
        },
      ];
    });
    return [
      ...this.state.replayMatches.filter((match) => !groupId || match.groupId === groupId),
      ...actual,
    ];
  }

  async replaceRatingState(
    groupId: string,
    players: readonly Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed">[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    const ratings = new Map(players.map((player) => [player.id, player]));
    const accountRatings = new Map<string, Pick<PlayerRecord, "rating" | "ratedGamesPlayed">>();

    for (const player of this.state.players) {
      const updated = ratings.get(player.id);
      if (updated && player.accountId) {
        accountRatings.set(player.accountId, updated);
      }
    }

    this.state.playerAccounts = this.state.playerAccounts.map((account) => {
      const updated = accountRatings.get(account.id);
      if (!updated) return account;
      return { ...account, rating: updated.rating, ratedGamesPlayed: updated.ratedGamesPlayed };
    });

    this.state.players = this.state.players.map((player) => {
      if (player.accountId && accountRatings.has(player.accountId)) {
        const updated = accountRatings.get(player.accountId)!;
        return { ...player, rating: updated.rating, ratedGamesPlayed: updated.ratedGamesPlayed };
      }
      const updated = ratings.get(player.id);
      if (updated) {
        return { ...player, rating: updated.rating, ratedGamesPlayed: updated.ratedGamesPlayed };
      }
      return player;
    });
    this.state.ratingSnapshots = new Map(snapshots);
    this.state.matchPlayers = this.state.matchPlayers.map((item) => {
      const snapshot = snapshots.get(item.matchId)?.find((entry) => entry.playerId === item.playerId);
      return snapshot
        ? { ...item, ratingBefore: snapshot.ratingBefore, ratingAfter: snapshot.ratingAfter }
        : { ...item, ratingBefore: null, ratingAfter: null };
    });
    this.writeCount += 1;
  }

  async updatePlayerPrivacy(accountId: string, isPublic: boolean): Promise<void> {
    const account = this.state.playerAccounts.find((a) => a.id === accountId);
    if (account) {
      (account as { isPublic?: boolean }).isPublic = isPublic;
      this.writeCount += 1;
    }
  }

  async listPairSynergies(accountIds: readonly string[]): Promise<readonly PlayerSynergyRecord[]> {
    const accounts = new Set(accountIds);
    return this.state.synergies.filter((pair) => accounts.has(pair.accountId1) && accounts.has(pair.accountId2));
  }

  async getPairSynergy(accountIdA: string, accountIdB: string): Promise<PlayerSynergyRecord | null> {
    if (accountIdA === accountIdB) return null;
    const [first, second] = accountIdA < accountIdB ? [accountIdA, accountIdB] : [accountIdB, accountIdA];
    return this.state.synergies.find((s) => s.accountId1 === first && s.accountId2 === second) ?? null;
  }

  async getBestPartner(accountId: string): Promise<{ partnerAccountId: string; username: string; synergyScore: number; matchesPlayed: number } | null> {
    const eligible = this.state.synergies.filter(
      (s) => (s.accountId1 === accountId || s.accountId2 === accountId) && s.matchesPlayed >= 1
    );
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => b.synergyScore - a.synergyScore || b.matchesPlayed - a.matchesPlayed);
    const best = eligible[0];
    const partnerId = best.accountId1 === accountId ? best.accountId2 : best.accountId1;
    const partnerAcc = this.state.playerAccounts.find((a) => a.id === partnerId);
    if (!partnerAcc) return null;
    return {
      partnerAccountId: partnerId,
      username: partnerAcc.username,
      synergyScore: best.synergyScore,
      matchesPlayed: best.matchesPlayed,
    };
  }

  async recordMatchesSynergy(pairResults: readonly PairMatchSynergyResult[]): Promise<void> {
    for (const pair of pairResults) {
      if (pair.accountIdA === pair.accountIdB) continue;
      const [first, second] = pair.accountIdA < pair.accountIdB ? [pair.accountIdA, pair.accountIdB] : [pair.accountIdB, pair.accountIdA];
      const existing = this.state.synergies.find((s) => s.accountId1 === first && s.accountId2 === second);
      const updated = updateSynergyState(
        existing
          ? {
              matchesPlayed: existing.matchesPlayed,
              wins: existing.wins,
              weightSum: existing.weightSum,
              contributionSum: existing.contributionSum,
              weightSqSum: existing.weightSqSum,
            }
          : null,
        {
          won: pair.won,
          expectedWinProbability: pair.expectedWinProbability,
          ownScore: pair.ownScore,
          opponentScore: pair.opponentScore,
        }
      );

      const record: PlayerSynergyRecord = {
        accountId1: first,
        accountId2: second,
        matchesPlayed: updated.matchesPlayed,
        wins: updated.wins,
        synergyScore: updated.synergyScore,
        weightSum: updated.weightSum,
        contributionSum: updated.contributionSum,
        weightSqSum: updated.weightSqSum,
        updatedAt: new Date(),
      };

      if (existing) {
        const index = this.state.synergies.indexOf(existing);
        this.state.synergies[index] = record;
      } else {
        this.state.synergies.push(record);
      }
    }
    this.writeCount += 1;
  }

  async searchPlayerAccounts(query: string, limit: number = 10): Promise<readonly PlayerAccountRecord[]> {
    const trimmed = query.trim().toLowerCase().replace(/^@/, "");
    if (!trimmed) return [];
    return this.state.playerAccounts
      .filter((a) => a.username.toLowerCase().includes(trimmed) || a.name.toLowerCase().includes(trimmed))
      .slice(0, limit);
  }

  async listPlayerAccounts(search: string = "", limit: number = 50): Promise<readonly PlayerAccountRecord[]> {
    const trimmed = search.trim().toLowerCase().replace(/^@/, "");
    return structuredClone(
      this.state.playerAccounts
        .filter((a) => !trimmed || a.username.toLowerCase().includes(trimmed) || a.name.toLowerCase().includes(trimmed))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit)
    );
  }

  async getTournament(tournamentId: string): Promise<TournamentRecord | null> {
    const found = this.state.tournaments.find((t) => t.id === tournamentId);
    return found ? structuredClone(found) : null;
  }

  async listTournaments(groupId: string): Promise<readonly TournamentRecord[]> {
    return structuredClone(
      this.state.tournaments
        .filter((t) => t.groupId === groupId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    );
  }

  async createTournament(tournament: TournamentRecord): Promise<void> {
    this.state.tournaments.push(structuredClone(tournament));
    this.writeCount += 1;
  }

  async updateTournament(tournament: TournamentRecord): Promise<void> {
    const idx = this.state.tournaments.findIndex((t) => t.id === tournament.id);
    if (idx !== -1) {
      this.state.tournaments[idx] = structuredClone(tournament);
      this.writeCount += 1;
    }
  }

  async deleteTournament(tournamentId: string, groupId: string): Promise<void> {
    const idx = this.state.tournaments.findIndex((t) => t.id === tournamentId && t.groupId === groupId);
    if (idx !== -1) {
      this.state.tournaments.splice(idx, 1);
      this.writeCount += 1;
    }
  }
}

