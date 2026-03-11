const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
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

// File upload (doesn't use fetchApi because it needs FormData)
async function uploadFile(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(error.error || `Upload failed: ${res.status}`)
  }

  return res.json()
}

// Entity fetching
export const api = {
  // File upload
  uploadImage: uploadFile,

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
  getPlayers: (params?: { gameId?: string; organisationId?: string; countryId?: string; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.gameId) query.set('gameId', params.gameId)
    if (params?.organisationId) query.set('organisationId', params.organisationId)
    if (params?.countryId) query.set('countryId', params.countryId)
    if (params?.search) query.set('search', params.search)
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

  vote: (data: { visitorId: string; entityId: string; entityType: string; direction: 'UP' | 'DOWN'; userId?: string }) =>
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

  refreshCredits: (visitorId: string, userId?: string) =>
    fetchApi<{ upvotesRemaining: number; downvotesRemaining: number }>('/votes/credits/refresh', {
      method: 'POST',
      body: JSON.stringify({ visitorId, userId }),
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

  createEvent: (data: { name: string; gameId: string; isPublic: boolean; description?: string; imageUrl?: string; participants: Array<{ playerId?: string; tempName?: string }> }) =>
    fetchApi<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEvent: (id: string, data: { name?: string; isPublic?: boolean; description?: string; imageUrl?: string }) =>
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

  joinEvent: (eventIdOrSlug: string) =>
    fetchApi<EventParticipant>(`/events/${eventIdOrSlug}/join`, {
      method: 'POST',
    }),

  removeEventParticipant: (eventId: string, participantId: string) =>
    fetchApi<{ success: boolean }>(`/events/${eventId}/participants/${participantId}`, {
      method: 'DELETE',
    }),

  voteEventParticipant: (eventId: string, data: { visitorId: string; participantId: string; direction: 'UP' | 'DOWN'; userId?: string }) =>
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

  voteSubEventParticipant: (leaderboardId: string, subEventId: string, data: { visitorId: string; participantId: string; direction: 'UP' | 'DOWN'; userId?: string }) =>
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

  updateSubEvent: (leaderboardId: string, subEventId: string, data: { imageUrl?: string; name?: string }) =>
    fetchApi<SubEvent>(`/events/${leaderboardId}/sub-events/${subEventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addSubEventComment: (leaderboardId: string, subEventId: string, data: { visitorId: string; content: string; username?: string; parentId?: string; imageUrl?: string; userId?: string }) =>
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

  deleteSubEventComment: (leaderboardId: string, subEventId: string, commentId: string, data: { visitorId: string; userId?: string }) =>
    fetchApi<{ success: boolean }>(`/events/${leaderboardId}/sub-events/${subEventId}/comments/${commentId}`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  // Aura Farms
  getAuraFarms: (search?: string, sort?: 'new' | 'popular' | 'oldest', entityId?: string) => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (sort) query.set('sort', sort)
    if (entityId) query.set('entityId', entityId)
    const queryStr = query.toString()
    return fetchApi<AuraFarm[]>(`/aura-farms${queryStr ? `?${queryStr}` : ''}`)
  },

  getMyAuraFarms: () =>
    fetchApi<AuraFarm[]>('/aura-farms/my'),

  getAuraFarm: (id: string) =>
    fetchApi<AuraFarm>(`/aura-farms/${id}`),

  createAuraFarm: (data: { title: string; description?: string; entityId: string; entityType: string; imageUrl?: string }) =>
    fetchApi<AuraFarm>('/aura-farms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAuraFarm: (id: string) =>
    fetchApi<{ success: boolean }>(`/aura-farms/${id}`, {
      method: 'DELETE',
    }),

  updateAuraFarm: (id: string, data: { title?: string; description?: string; imageUrl?: string }) =>
    fetchApi<AuraFarm>(`/aura-farms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  voteAuraFarm: (farmId: string, data: { visitorId: string; direction: 'UP' | 'DOWN' }) =>
    fetchApi<{ farmId: string; auraScore: number; direction: string }>(`/aura-farms/${farmId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeAuraFarmVote: (farmId: string, data: { visitorId: string }) =>
    fetchApi<{ farmId: string; auraScore: number }>(`/aura-farms/${farmId}/vote`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  getAuraFarmVotes: (farmId: string, visitorId: string) =>
    fetchApi<Array<{ farmId: string; direction: 'UP' | 'DOWN' }>>(`/aura-farms/${farmId}/votes?visitorId=${visitorId}`),

  // Aura farm comments
  getAuraFarmComments: (farmId: string) =>
    fetchApi<AuraFarmComment[]>(`/aura-farms/${farmId}/comments`),

  addAuraFarmComment: (farmId: string, data: { visitorId: string; content: string; username?: string; parentId?: string; imageUrl?: string; userId?: string }) =>
    fetchApi<AuraFarmComment>(`/aura-farms/${farmId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAuraFarmComment: (farmId: string, commentId: string, data: { visitorId: string; userId?: string }) =>
    fetchApi<{ success: boolean }>(`/aura-farms/${farmId}/comments/${commentId}`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  voteAuraFarmComment: (farmId: string, commentId: string, data: { visitorId: string; direction: 'UP' | 'DOWN' }) =>
    fetchApi<{ commentId: string; voteCount: number }>(`/aura-farms/${farmId}/comments/${commentId}/vote`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAuraFarmCommentVotes: (farmId: string, visitorId: string) =>
    fetchApi<Array<{ commentId: string; direction: 'UP' | 'DOWN' }>>(`/aura-farms/${farmId}/comments/votes?visitorId=${visitorId}`),

  // Suggestions
  submitSuggestion: (data: { type: string; name: string; description?: string; links?: string; visitorId?: string; userId?: string; submittedByName?: string }) =>
    fetchApi<{ success: boolean; id: string }>('/suggestions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSuggestions: (status?: 'pending' | 'approved' | 'rejected') =>
    fetchApi<Suggestion[]>(`/suggestions${status ? `?status=${status}` : ''}`),

  updateSuggestion: (id: string, data: { status: 'pending' | 'approved' | 'rejected'; adminNotes?: string }) =>
    fetchApi<{ success: boolean }>(`/suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteSuggestion: (id: string) =>
    fetchApi<{ success: boolean }>(`/suggestions/${id}`, {
      method: 'DELETE',
    }),

  // Notifications
  getNotifications: (userId: string, params?: { limit?: number; unreadOnly?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.unreadOnly) query.set('unreadOnly', 'true')
    const queryStr = query.toString()
    return fetchApi<Notification[]>(`/notifications/${userId}${queryStr ? `?${queryStr}` : ''}`)
  },

  getUnreadNotificationCount: (userId: string) =>
    fetchApi<{ count: number }>(`/notifications/${userId}/unread-count`),

  markNotificationRead: (notificationId: string) =>
    fetchApi<{ success: boolean }>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),

  markAllNotificationsRead: (userId: string) =>
    fetchApi<{ success: boolean }>(`/notifications/${userId}/read-all`, {
      method: 'PATCH',
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
  ownerName: string | null
  isPublic: boolean
  description: string | null
  imageUrl: string | null
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
  userId: string | null
  username: string
  content: string
  parentId: string | null
  voteCount: number
  imageUrl: string | null
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

// Aura Farms
interface AuraFarm {
  id: string
  title: string
  slug: string | null
  description: string | null
  entityId: string
  entityType: string
  ownerId: string
  ownerName: string | null
  imageUrl: string | null
  auraScore: number
  createdAt: Date
  entity: {
    id: string
    name: string
    slug: string
    auraScore: number
    imageUrl: string | null
  } | null
}

interface AuraFarmComment {
  id: string
  farmId: string
  visitorId: string
  userId: string | null
  username: string
  content: string
  parentId: string | null
  voteCount: number
  imageUrl: string | null
  createdAt: Date
}

interface Suggestion {
  id: string
  type: string
  name: string
  description: string | null
  links: string | null
  submittedByVisitorId: string | null
  submittedByUserId: string | null
  submittedByName: string | null
  status: 'pending' | 'approved' | 'rejected'
  adminNotes: string | null
  createdAt: Date
}

interface Notification {
  id: string
  userId: string
  type: string
  sourceType: string
  sourceId: string
  sourceUrl: string
  fromUserId: string | null
  fromUsername: string
  content: string
  read: boolean
  createdAt: Date
}

export type { Entity, Vote, User, AuthResponse, Event, EventParticipant, EventWithParticipants, SubEvent, SubEventParticipant, SubEventWithParticipants, SubEventComment, AuraFarm, AuraFarmComment, Suggestion, Notification }
