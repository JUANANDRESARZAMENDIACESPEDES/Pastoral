/**
 * Types for News Management System
 * Tipos para el Sistema de Gestión de Noticias y Eventos
 */

export interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon_emoji?: string;
  color_hex: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface NewsTag {
  id: string;
  name: string;
  slug: string;
  color_hex: string;
  created_at: string;
}

export interface NewsImage {
  id: string;
  article_id: string;
  image_url: string;
  alt_text?: string;
  caption?: string;
  sort_order: number;
  width?: number;
  height?: number;
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface NewsEvent {
  id: string;
  article_id: string;
  start_date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM
  end_date?: string;
  end_time?: string;
  location_name?: string;
  location_address?: string;
  google_maps_url?: string;
  location_lat?: number;
  location_lng?: number;
  allow_inscription: boolean;
  max_participants?: number;
  current_participants: number;
  inscription_deadline?: string;
  contact_person_name?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  slug: string;
  category_id?: string;
  tags: string[]; // IDs de tags
  featured_image_url?: string;
  gallery_urls: string[]; // URLs de imágenes
  published: boolean;
  pinned: boolean;
  pin_order: number;
  featured_on_homepage: boolean;
  author_id?: string;
  views_count: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  expires_at?: string;
  archived: boolean;
  archived_at?: string;
}

// Extended views (joined data)
export interface NewsArticleWithDetails extends NewsArticle {
  category?: NewsCategory;
  tag_objects?: NewsTag[];
  event?: NewsEvent;
  images?: NewsImage[];
}

export interface NewsActivityLog {
  id: string;
  article_id?: string;
  action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'ARCHIVE' | 'DELETE' | 'PIN' | 'UNPIN';
  actor_id?: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// Request/Response DTOs
export interface CreateArticleRequest {
  title: string;
  subtitle?: string;
  body: string;
  slug?: string; // Si no se proporciona, se auto-genera
  category_id?: string;
  tags?: string[];
  featured_image_url?: string;
  published?: boolean;
  published_at?: string;
  expires_at?: string;
}

export interface UpdateArticleRequest {
  title?: string;
  subtitle?: string;
  body?: string;
  slug?: string;
  category_id?: string | null;
  tags?: string[];
  featured_image_url?: string | null;
  featured_on_homepage?: boolean;
  published?: boolean;
  published_at?: string;
  expires_at?: string | null;
  archived?: boolean;
  pinned?: boolean;
  pin_order?: number;
}

export interface CreateEventRequest {
  article_id: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location_name?: string;
  location_address?: string;
  google_maps_url?: string;
  location_lat?: number;
  location_lng?: number;
  allow_inscription?: boolean;
  max_participants?: number;
  inscription_deadline?: string;
  contact_person_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface UpdateEventRequest {
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  location_name?: string;
  location_address?: string;
  google_maps_url?: string;
  location_lat?: number;
  location_lng?: number;
  allow_inscription?: boolean;
  max_participants?: number;
  inscription_deadline?: string;
  contact_person_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface NewsSearchFilters {
  query?: string;
  category_id?: string;
  tags?: string[];
  published?: boolean;
  archived?: boolean;
  pinned?: boolean;
  from_date?: string;
  to_date?: string;
  is_event?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'published_at' | 'created_at' | 'views' | 'event_date';
  sort_order?: 'asc' | 'desc';
}

export interface NewsArticleResponse {
  success: boolean;
  message?: string;
  data?: NewsArticleWithDetails;
  error?: string;
}

export interface NewsListResponse {
  success: boolean;
  data: NewsArticleWithDetails[];
  total: number;
  limit: number;
  offset: number;
}

export interface CategoriesResponse {
  success: boolean;
  data: NewsCategory[];
}

export interface TagsResponse {
  success: boolean;
  data: NewsTag[];
}
