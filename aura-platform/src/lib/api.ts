const API_BASE = 'http://localhost:3001/api'
const SESSION_KEY = 'aura_session'

// Get stored session token
function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

// Store session token
export function setSessionToken(token: string | null) {
  if (token) {
    localStorage.setItem(SESSION_KEY, token)
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const sessionToken = getSessionToken()
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error.error || `API error: ${res.status}`)
  }
  return res.json()
}

// Entity fetching
export const api = {
  // Countries
  getCountries: () => fetchApi<Entity[]>('/countries'),
  getCountry: (id: string) => fetchApi<Entity>(`/countries/${id}`),

  // Games
  getGames: () => fetchApi<Entity[]>('/games'),
  getGame: (id: string) => fetchApi<Entity>(`/games/${id}`),

  // Regions
  getRegions: (gameId?: string) =>
    fetchApi<Entity[]>(gameId ? `/regions?gameId=${gameId}` : '/regions'),
  getRegion: (id: string) => fetchApi<Entity>(`/regions/${id}`),

  // Organisations
  getOrganisations: () => fetchApi<Entity[]>('/organisations'),
  getOrganisation: (id: string) => fetchApi<Entity>(`/organisations/${id}`),

  // Organisation Games
  getOrganisationGames: () => fetchApi<Entity[]>('/organisation-games'),

  // Brands
  getBrands: () => fetchApi<Entity[]>('/brands'),
  getBrand: (id: string) => fetchApi<Entity>(`/brands/${id}`),

  // Peripherals
  getPeripherals: (params?: { brandId?: string; type?: string }) => {
    const query = new URLSearchParams()
    if (params?.brandId) query.set('brandId', params.brandId)
    if (params?.type) query.set('type', params.type)
    const queryStr = query.toString()
    return fetchApi<Entity[]>(`/peripherals${queryStr ? `?${queryStr}` : ''}`)
  },
  getPeripheral: (id: string) => fetchApi<Entity>(`/peripherals/${id}`),

  // Roles
  getRoles: (gameId?: string) =>
    fetchApi<Entity[]>(gameId ? `/roles?gameId=${gameId}` : '/roles'),

  // Weapons
  getWeapons: (gameId?: string) =>
    fetchApi<Entity[]>(gameId ? `/weapons?gameId=${gameId}` : '/weapons'),

  // Characters
  getCharacters: (gameId?: string) =>
    fetchApi<Entity[]>(gameId ? `/characters?gameId=${gameId}` : '/characters'),

  // Players
  getPlayers: (params?: { gameId?: string; organisationId?: string; countryId?: string }) => {
    const query = new URLSearchParams()
    if (params?.gameId) query.set('gameId', params.gameId)
    if (params?.organisationId) query.set('organisationId', params.organisationId)
    if (params?.countryId) query.set('countryId', params.countryId)
    const queryStr = query.toString()
    return fetchApi<Entity[]>(`/players${queryStr ? `?${queryStr}` : ''}`)
  },
  getPlayer: (id: string) => fetchApi<Entity>(`/players/${id}`),

  // User Profile
  getUserProfile: (visitorId: string) =>
    fetchApi<Entity | null>(`/user-profile/${visitorId}`).catch(() => null),

  createUserProfile: (data: {
    visitorId: string
    name?: string
    countryId?: string
    organisationId?: string
    mainGameId?: string
    regionId?: string
    gameIds?: string[]
  }) =>
    fetchApi<Entity>('/players', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePlayer: (id: string, data: Partial<{
    name: string
    countryId: string
    organisationId: string | null
    mainGameId: string
    regionId: string
    gameIds: string[]
    associatedEntityIds: string[]
  }>) =>
    fetchApi<Entity>(`/players/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Votes
  getVote: (visitorId: string, entityId: string, entityType: string) =>
    fetchApi<Vote | null>(`/votes?visitorId=${visitorId}&entityId=${entityId}&entityType=${entityType}`),

  getVisitorVotes: (visitorId: string) =>
    fetchApi<Vote[]>(`/votes?visitorId=${visitorId}`),

  vote: (data: { visitorId: string; entityId: string; entityType: string; direction: 'UP' | 'DOWN' }) =>
    fetchApi<Vote & { credits: { upvotesRemaining: number; downvotesRemaining: number } }>('/votes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeVote: (data: { visitorId: string; entityId: string; entityType: string }) =>
    fetchApi<{ success: boolean }>('/votes', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  // Credits
  getCredits: (visitorId: string) =>
    fetchApi<{ upvotesRemaining: number; downvotesRemaining: number }>(`/votes/credits?visitorId=${visitorId}`),

  refreshCredits: (visitorId: string) =>
    fetchApi<{ upvotesRemaining: number; downvotesRemaining: number }>('/votes/credits/refresh', {
      method: 'POST',
      body: JSON.stringify({ visitorId }),
    }),

  // Auth
  signUp: (email: string, password: string) =>
    fetchApi<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signIn: (email: string, password: string) =>
    fetchApi<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signOut: () =>
    fetchApi<{ success: boolean }>('/auth/signout', {
      method: 'POST',
    }),

  getMe: () =>
    fetchApi<{ user: User }>('/auth/me'),

  deleteAccount: () =>
    fetchApi<{ success: boolean }>('/auth/account', {
      method: 'DELETE',
    }),

  linkPlayer: (playerId: string) =>
    fetchApi<{ user: User }>('/auth/link-player', {
      method: 'PATCH',
      body: JSON.stringify({ playerId }),
    }),

  // Events
  getPublicEvents: (search?: string) =>
    fetchApi<Event[]>(`/events${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  getMyEvents: () =>
    fetchApi<Event[]>('/events/my'),

  getEvent: (id: string) =>
    fetchApi<EventWithParticipants>(`/events/${id}`),

  createEvent: (data: { name: string; gameId: string; isPublic: boolean; participants: Array<{ playerId?: string; tempName?: string }> }) =>
    fetchApi<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEvent: (id: string, data: { name?: string; isPublic?: boolean }) =>
    fetchApi<Event>(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string) =>
    fetchApi<{ success: boolean }>(`/events/${id}`, {
      method: 'DELETE',
    }),

  addEventParticipant: (eventId: string, data: { playerId?: string; tempName?: string }) =>
    fetchApi<EventParticipant>(`/events/${eventId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeEventParticipant: (eventId: string, participantId: string) =>
    fetchApi<{ success: boolean }>(`/events/${eventId}/participants/${participantId}`, {
      method: 'DELETE',
    }),

  voteEventParticipant: (eventId: string, data: { visitorId: string; participantId: string; direction: 'UP' | 'DOWN' }) =>
    fetchApi<{ participantId: string; auraScore: number; direction: string }>(`/events/${eventId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeEventVote: (eventId: string, data: { visitorId: string; participantId: string }) =>
    fetchApi<{ participantId: string; auraScore: number }>(`/events/${eventId}/vote`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  getEventVotes: (eventId: string, visitorId: string) =>
    fetchApi<Array<{ participantId: string; direction: 'UP' | 'DOWN' }>>(`/events/${eventId}/votes?visitorId=${visitorId}`),

  // Sub-events
  getSubEvents: (leaderboardId: string) =>
    fetchApi<SubEvent[]>(`/events/${leaderboardId}/sub-events`),

  getSubEvent: (leaderboardId: string, subEventId: string) =>
    fetchApi<SubEventWithParticipants>(`/events/${leaderboardId}/sub-events/${subEventId}`),

  createSubEvent: (leaderboardId: string, data: { name: string; participantIds: string[]; imageUrl?: string }) =>
    fetchApi<SubEvent>(`/events/${leaderboardId}/sub-events`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSubEvent: (leaderboardId: string, subEventId: string) =>
    fetchApi<{ success: boolean }>(`/events/${leaderboardId}/sub-events/${subEventId}`, {
      method: 'DELETE',
    }),

  addSubEventParticipant: (leaderboardId: string, subEventId: string, data: { leaderboardParticipantId: string }) =>
    fetchApi<SubEventParticipant>(`/events/${leaderboardId}/sub-events/${subEventId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeSubEventParticipant: (leaderboardId: string, subEventId: string, participantId: string) =>
    fetchApi<{ success: boolean }>(`/events/${leaderboardId}/sub-events/${subEventId}/participants/${participantId}`, {
      method: 'DELETE',
    }),

  voteSubEventParticipant: (leaderboardId: string, subEventId: string, data: { visitorId: string; participantId: string; direction: 'UP' | 'DOWN' }) =>
    fetchApi<{ participantId: string; auraScore: number; direction: string }>(`/events/${leaderboardId}/sub-events/${subEventId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeSubEventVote: (leaderboardId: string, subEventId: string, data: { visitorId: string; participantId: string }) =>
    fetchApi<{ participantId: string; auraScore: number }>(`/events/${leaderboardId}/sub-events/${subEventId}/vote`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  getSubEventVotes: (leaderboardId: string, subEventId: string, visitorId: string) =>
    fetchApi<Array<{ participantId: string; direction: 'UP' | 'DOWN' }>>(`/events/${leaderboardId}/sub-events/${subEventId}/votes?visitorId=${visitorId}`),

  updateSubEvent: (leaderboardId: string, subEventId: string, data: { imageUrl?: string }) =>
    fetchApi<SubEvent>(`/events/${leaderboardId}/sub-events/${subEventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addSubEventComment: (leaderboardId: string, subEventId: string, data: { visitorId: string; content: string; username?: string; parentId?: string }) =>
    fetchApi<SubEventComment>(`/events/${leaderboardId}/sub-events/${subEventId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  voteComment: (leaderboardId: string, subEventId: string, commentId: string, data: { visitorId: string; direction: 'UP' | 'DOWN' }) =>
    fetchApi<{ commentId: string; voteCount: number }>(`/events/${leaderboardId}/sub-events/${subEventId}/comments/${commentId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCommentVotes: (leaderboardId: string, subEventId: string, visitorId: string) =>
    fetchApi<Array<{ commentId: string; direction: 'UP' | 'DOWN' }>>(`/events/${leaderboardId}/sub-events/${subEventId}/comments/votes?visitorId=${visitorId}`),

  deleteSubEventComment: (leaderboardId: string, subEventId: string, commentId: string, data: { visitorId: string }) =>
    fetchApi<{ success: boolean }>(`/events/${leaderboardId}/sub-events/${subEventId}/comments/${commentId}`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),
}

// Types for API responses
interface Entity {
  id: string
  name: string
  slug: string
  auraScore: number
  createdAt: Date
  type: string
  imageUrl?: string
  aliases?: string[]
  // Specific fields
  flagCode?: string
  gameType?: string
  gameId?: string
  organisationId?: string
  brandId?: string
  peripheralType?: string
  countryId?: string
  mainGameId?: string
  regionId?: string
  gameIds?: string[]
  associatedEntityIds?: string[]
  isUserProfile?: boolean
  visitorId?: string
}

interface Vote {
  id: string
  visitorId: string
  entityId: string
  entityType: string
  direction: 'UP' | 'DOWN'
  timestamp: Date
}

interface User {
  id: string
  email: string
  playerId?: string
  createdAt: Date
}

interface AuthResponse {
  user: User
  session: {
    id: string
    expiresAt: Date
  }
}

interface Event {
  id: string
  name: string
  slug: string
  gameId: string
  ownerId: string
  isPublic: boolean
  createdAt: Date
}

interface EventParticipant {
  id: string
  eventId: string
  playerId: string | null
  tempName: string | null
  auraScore: number
  player: {
    id: string
    name: string
    slug: string
    globalAuraScore: number
  } | null
  createdAt: Date
}

interface EventWithParticipants extends Event {
  participants: EventParticipant[]
}

interface SubEvent {
  id: string
  leaderboardId: string
  name: string
  slug: string
  imageUrl: string | null
  createdAt: Date
}

interface SubEventComment {
  id: string
  subEventId: string
  visitorId: string
  username: string
  content: string
  parentId: string | null
  voteCount: number
  createdAt: Date
}

interface SubEventParticipant {
  id: string
  subEventId: string
  leaderboardParticipantId: string
  auraScore: number
  tempName: string | null
  player: {
    id: string
    name: string
    slug: string
    globalAuraScore: number
  } | null
  createdAt: Date
}

interface SubEventWithParticipants extends SubEvent {
  participants: SubEventParticipant[]
  comments: SubEventComment[]
}

export type { Entity, Vote, User, AuthResponse, Event, EventParticipant, EventWithParticipants, SubEvent, SubEventParticipant, SubEventWithParticipants, SubEventComment }
