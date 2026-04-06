export type UserRole = 'artist' | 'venue';

export type ApplicationStatus = 'pending' | 'viewed' | 'shortlisted' | 'rejected' | 'hired';
export type JobStatus = 'draft' | 'published' | 'closed' | 'filled';
export type ContractType = 'full_time' | 'part_time' | 'seasonal' | 'residency' | 'one_off' | 'tour';
export type PayType = 'hourly' | 'per_show' | 'daily' | 'weekly' | 'monthly' | 'negotiable';
export type VenueType = 'cruise_ship' | 'hotel' | 'festival' | 'circus' | 'amusement_park' | 'production_company' | 'theater' | 'casino' | 'corporate' | 'restaurant' | 'agency' | 'other';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  facebook_id?: string;
  created_at: string;
}

export interface ArtistProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string;
  location_city: string;
  location_country: string;
  disciplines: string[];
  experience_years: number;
  languages: string[];
  available_from?: string;
  available_to?: string;
  is_available: boolean;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  currency: string;
  website_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  is_public: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  // joined
  portfolio_items?: PortfolioItem[];
}

export interface PortfolioItem {
  id: string;
  artist_id: string;
  type: 'video' | 'photo';
  url: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  duration_secs?: number;
  sort_order: number;
  created_at: string;
}

export interface VenueProfile {
  id: string;
  user_id: string;
  name: string;
  venue_type: VenueType;
  description: string;
  location_city: string;
  location_country: string;
  website_url?: string;
  contact_name: string;
  contact_title: string;
  logo_url?: string;
  cover_image_url?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobPost {
  id: string;
  venue_id: string;
  title: string;
  description: string;
  disciplines_needed: string[];
  venue_type: VenueType;
  contract_type: ContractType;
  location_city: string;
  location_country: string;
  remote_possible: boolean;
  start_date?: string;
  end_date?: string;
  pay_min?: number;
  pay_max?: number;
  pay_currency: string;
  pay_type: PayType;
  requirements?: string;
  how_to_apply?: string;
  status: JobStatus;
  view_count: number;
  application_count: number;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  // joined
  venue?: VenueProfile;
  match_score?: number;
}

export interface Application {
  id: string;
  job_id: string;
  artist_id: string;
  cover_message?: string;
  highlighted_items?: string[];
  status: ApplicationStatus;
  venue_notes?: string;
  match_score?: number;
  applied_at: string;
  updated_at: string;
  // joined
  job?: JobPost;
  artist?: ArtistProfile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  job_id?: string;
  created_at: string;
  last_message_at: string;
  // joined
  other_user?: Partial<User & { display_name: string; avatar_url: string }>;
  last_message?: Message;
  unread_count?: number;
}
