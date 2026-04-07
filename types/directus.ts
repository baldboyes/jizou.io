export type Status = 'published' | 'draft' | 'archived'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'
export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'entertainment' | 'shopping' | 'other'
export type PaymentMethod = 'cash' | 'card' | 'ic'
export type TripUserRole = 'owner' | 'editor' | 'read_only'
export type TripInvitationStatus = 'pending' | 'accepted' | 'revoked'
export type SuitcaseType = 'checked' | 'carry_on' | 'backpack' | 'other'

export interface DirectusFile {
  id: string
  title: string
  url: string
}

export interface AccommodationRoom {
  id: number
  accommodation_id: number | Accommodation
  room_type?: string
  room_count?: number
  is_private_bath?: boolean
  board_basis?: string[]
}

export interface AccommodationRoomEntry {
  room_type?: string
  room_count?: number
  is_private_bath?: boolean
  board_basis?: string[]
}

export interface Activity {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  currency: string
  title: string
  type: string
  price: number
  payment_status: PaymentStatus
  address?: string
  prefecture?: string
  city?: string
  google_maps_link?: string
  latitude?: number
  longitude?: number
  notes?: string
  start_date?: string
  end_date?: string
  attachments?: number[] | DirectusFile[]
}

export interface Accommodation {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  currency: string
  name: string
  address?: string
  check_in?: string
  check_out?: string
  room_type?: string
  room_count?: number
  rooms?: AccommodationRoomEntry[]
  price: number
  payment_status: PaymentStatus
  prefecture?: string
  city?: string
  google_maps_link?: string
  latitude?: number
  longitude?: number
  notes?: string
  phone?: string
  email?: string
  has_luggage_forwarding?: boolean
  board_basis?: string[]
  is_private?: boolean
  attachments?: number[] | DirectusFile[]
}

export interface CurrencyExchange {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  currency: string
  date: string
  amount_from: number
  amount_to: number
  rate: number
  place?: string
  fund_destination?: string
}

export interface Expense {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  paid_by_trip_user_id?: number | TripsUser | null
  client_generated_id?: string
  date: string
  concept: string
  amount: number
  category: ExpenseCategory
  description?: string
  payment_method: PaymentMethod
  is_shared: boolean
  external_id?: string
  city?: string
  prefectura?: string
  notes?: string
  location_lat?: number
  location_lng?: number
  expense_status?: 'real' | 'planned'
}

export interface ExpenseSplit {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  expense_id: number | Expense
  trip_user_id: number | TripsUser
  amount: number
  percentage?: number | null
  settled: boolean
  settled_at?: string | null
  note?: string | null
}

export interface TripSettlement {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  from_trip_user_id: number | TripsUser
  to_trip_user_id: number | TripsUser
  amount: number
  date: string
  settlement_status: 'pending' | 'completed' | 'void'
  settled_at?: string | null
  note?: string | null
}

export interface DailyNote {
  id: number
  trip_id: number | Trip
  date: string
  content: string
}

export interface Notification {
  id: number
  status: Status
  user_created: string
  date_created: string
  user_updated?: string
  date_updated?: string
  recipient_id: string
  title: string
  message: string
  type: string
  read_at?: string
  action_link?: string
}

export interface Insurance {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  currency: string
  provider: string
  type: string
  policy_number?: string
  emergency_phone?: string
  emergency_email?: string
  start_date?: string
  end_date?: string
  price: number
  payment_status: PaymentStatus
  notes?: string
  attachments?: number[] | DirectusFile[]
}

export interface Transport {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  currency: string
  name: string
  type?: string
  category?: string
  price: number
  start_date?: string
  end_date?: string
  payment_status: PaymentStatus
  duration_type?: string
  stops?: any[]
  pass_id?: string
  notes?: string
  attachments?: number[] | DirectusFile[]
}

export interface Trip {
  id: number
  status: Status
  user_created: string | DirectusUser
  date_created: string
  title: string
  start_date: string
  end_date: string
  daily_budget?: number
  cover_image?: string
  currency: string
  iso_code?: string
  country?: any
  destinations?: any[]
  collaborators?: number[] | any[]
  expenses?: number[] | Expense[]
}

export interface Suitcase {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  type: SuitcaseType
  name: string
  sort?: number
  items?: number[] | SuitcaseItem[]
}

export interface SuitcaseItem {
  id: number
  status: Status
  user_created: string
  date_created: string
  suitcase_id: number | Suitcase
  name: string
  quantity: number
  packed: boolean
  sort?: number
}

export interface TripsUser {
  id: number
  trip_id: number | Trip
  directus_user_id: string
  rol: TripUserRole
  status: 'published' | 'draft'
}

export interface DirectusUser {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  avatar?: string | null
  avatar_url?: string | null
}

export interface TripInvitation {
  id: number
  email: string
  trip_id: number | Trip
  inviter_id?: string | null
  inviter_email?: string | null
  role: Exclude<TripUserRole, 'owner'>
  status: TripInvitationStatus
}

export interface Flight {
  id: number
  status: Status
  user_created: string
  date_created: string
  trip_id: number | Trip
  currency: string
  departure_airport: string
  arrival_airport: string
  departure_time: string
  arrival_time: string
  airline: string
  booking_reference?: string
  price: number
  flight_number?: string
  terminal?: string
  layovers?: any[]
  title?: string
  payment_status: PaymentStatus
  attachments?: number[] | DirectusFile[]
}

export interface Task {
  id: number
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  trip_id?: number | Trip
  user_created?: string | DirectusUser
  assigned_to?: string | DirectusUser
  entity_type?: string
  entity_id?: string | number
  task_group?: string | number
}

export interface Schema {
  activities: Activity[]
  accommodations: Accommodation[]
  accommodation_rooms: AccommodationRoom[]
  currency_exchanges: CurrencyExchange[]
  expenses: Expense[]
  expense_splits: ExpenseSplit[]
  daily_notes: DailyNote[]
  notifications: Notification[]
  insurances: Insurance[]
  transports: Transport[]
  trips: Trip[]
  trips_users: TripsUser[]
  trip_invitations: TripInvitation[]
  flights: Flight[]
  tasks: Task[]
  trip_settlements: TripSettlement[]
  suitcases: Suitcase[]
  suitcase_items: SuitcaseItem[]
}
