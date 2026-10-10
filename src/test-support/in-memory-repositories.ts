import type { DomainRepository } from "@/lib/domain/repositories";
import type {
  AttendanceRecord,
  GroupRecord,
  GroupOrganizerRecord,
  PlayerAccountRecord,
  PlayerGender,
  PlayerSessionHistoryRecord,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundSitRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

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

  async joinPublicGroup(accountId: string, groupId: string) {
    const account = this.state.playerAccounts.find((item) => item.id === accountId);
    const group = this.state.groups.find((item) => item.id === groupId && (item.isPublic === true || item.ownerAccountId === accountId));
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
      rating: account.initialRating,
      ratedGamesPlayed: 0,
      active: true,
      accountId,
      username: account.username,
      gender: account.gender ?? null,
    };
    this.state.players.push(player);
    return player;
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
        let rating = player.initialRating;
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
        history.push({ sessionId: session.id, groupId: group.id, groupName: group.name, startedAt: session.startedAt, wins, losses, rating });
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
      if (player.initialRating !== undefined) Object.assign(existing, { initialRating: player.initialRating });
      this.writeCount += 1;
    }
  }

  async deletePlayer(playerId: string, groupId: string) {
    this.state.players = this.state.players.filter(
      (p) => !(p.id === playerId && p.groupId === groupId),
    );
    this.state.attendance = this.state.attendance.filter(
      (a) => a.playerId !== playerId,
    );
    this.state.matchPlayers = this.state.matchPlayers.filter(
      (mp) => mp.playerId !== playerId,
    );
    this.state.roundSits = this.state.roundSits.filter(
      (rs) => rs.playerId !== playerId,
    );
    this.writeCount += 1;
  }

  async getSession(sessionId: string) {
    return this.state.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async listPlayers(groupId: string) {
    return this.state.players
      .filter((player) => player.groupId === groupId)
      .map((player) => {
        if (player.username) return player;
        if (player.accountId) {
          const account = this.state.playerAccounts.find((a) => a.id === player.accountId);
          if (account?.username) {
            return { ...player, username: account.username };
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

  async updateMatch(match: MatchRecord) {
    this.state.matches = this.state.matches.map((item) =>
      item.id === match.id ? structuredClone(match) : item,
    );
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

  async listReplayMatches(groupId: string): Promise<readonly ReplayMatch[]> {
    const sessions = new Map(
      this.state.sessions
        .filter((session) => session.groupId === groupId)
        .map((session) => [session.id, session]),
    );
    const rounds = new Map(
      this.state.rounds
        .filter((round) => sessions.has(round.sessionId))
        .map((round) => [round.id, round]),
    );
    const actual = this.state.matches.flatMap((match): ReplayMatch[] => {
      if (!rounds.has(match.roundId) || match.status === "pending" || !match.completedAt) return [];
      const members = this.state.matchPlayers.filter((item) => item.matchId === match.id);
      const team1 = members.filter((item) => item.team === 1).map((item) => item.playerId);
      const team2 = members.filter((item) => item.team === 2).map((item) => item.playerId);
      if (team1.length !== 2 || team2.length !== 2) return [];
      return [
        {
          id: match.id,
          groupId,
          status: match.status,
          completedAt: match.completedAt,
          team1: [team1[0], team1[1]],
          team2: [team2[0], team2[1]],
          team1Score: match.team1Score ?? 0,
          team2Score: match.team2Score ?? 0,
        },
      ];
    });
    return [...this.state.replayMatches.filter((match) => match.groupId === groupId), ...actual];
  }

  async replaceRatingState(
    groupId: string,
    players: readonly Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed">[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    const ratings = new Map(players.map((player) => [player.id, player]));
    this.state.players = this.state.players.map((player) => {
      if (player.groupId !== groupId) return player;
      const rating = ratings.get(player.id)!;
      return { ...player, rating: rating.rating, ratedGamesPlayed: rating.ratedGamesPlayed };
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
}
