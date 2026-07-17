import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CreateLoanInput,
  FriendGroup,
  FriendGroupDetail,
  FriendRequest,
  GameSearchResult,
  GameDetail,
  GroupGame,
  GroupGamesQuery,
  Loan,
  LoansQuery,
  Page,
  PublicUser,
} from '@ludoteca/shared';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly api = inject(ApiService);

  search(q: string, page = 1, pageSize = 24, type: 'all' | 'base' | 'expansion' = 'all'): Promise<GameSearchResult> {
    return firstValueFrom(this.api.get<GameSearchResult>('/games/search', { q, page, pageSize, type }));
  }

  detail(gameId: string): Promise<GameDetail> {
    return firstValueFrom(this.api.get<GameDetail>(`/games/${gameId}`));
  }
}

@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly api = inject(ApiService);

  // --- Friends --------------------------------------------------------------

  searchUsers(q: string, page = 1): Promise<Page<PublicUser>> {
    return firstValueFrom(this.api.get<Page<PublicUser>>('/users/search', { q, page, pageSize: 20 }));
  }

  friends(page = 1): Promise<Page<PublicUser>> {
    return firstValueFrom(this.api.get<Page<PublicUser>>('/friends', { page, pageSize: 50 }));
  }

  requests(): Promise<FriendRequest[]> {
    return firstValueFrom(this.api.get<FriendRequest[]>('/friends/requests'));
  }

  sendRequest(userId: string): Promise<FriendRequest> {
    return firstValueFrom(this.api.post<FriendRequest>('/friends/requests', { userId }));
  }

  acceptRequest(requestId: string): Promise<FriendRequest> {
    return firstValueFrom(this.api.post<FriendRequest>(`/friends/requests/${requestId}/accept`));
  }

  /** Rejects an incoming request or withdraws one you sent. */
  dismissRequest(requestId: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/friends/requests/${requestId}`));
  }

  unfriend(userId: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/friends/${userId}`));
  }

  // --- Groups ---------------------------------------------------------------

  groups(): Promise<FriendGroup[]> {
    return firstValueFrom(this.api.get<FriendGroup[]>('/groups'));
  }

  group(groupId: string): Promise<FriendGroupDetail> {
    return firstValueFrom(this.api.get<FriendGroupDetail>(`/groups/${groupId}`));
  }

  createGroup(name: string, memberIds: string[] = []): Promise<FriendGroupDetail> {
    return firstValueFrom(this.api.post<FriendGroupDetail>('/groups', { name, memberIds }));
  }

  deleteGroup(groupId: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/groups/${groupId}`));
  }

  addMembers(groupId: string, memberIds: string[]): Promise<FriendGroupDetail> {
    return firstValueFrom(this.api.post<FriendGroupDetail>(`/groups/${groupId}/members`, { memberIds }));
  }

  removeMembers(groupId: string, memberIds: string[]): Promise<FriendGroupDetail> {
    return firstValueFrom(this.api.delete<FriendGroupDetail>(`/groups/${groupId}/members`, { memberIds }));
  }

  groupGames(groupId: string, query: Partial<GroupGamesQuery>): Promise<Page<GroupGame>> {
    return firstValueFrom(this.api.get<Page<GroupGame>>(`/groups/${groupId}/games`, query as never));
  }

  // --- Loans ----------------------------------------------------------------

  loans(query: Partial<LoansQuery> = {}): Promise<Page<Loan>> {
    return firstValueFrom(this.api.get<Page<Loan>>('/loans', query as never));
  }

  createLoan(input: CreateLoanInput): Promise<Loan> {
    return firstValueFrom(this.api.post<Loan>('/loans', input));
  }

  setLoanStatus(loanId: string, status: 'active' | 'returned'): Promise<Loan> {
    return firstValueFrom(this.api.patch<Loan>(`/loans/${loanId}`, { status }));
  }
}
