/**
 * Validation helpers for News Management System
 * Plain TypeScript helpers to avoid external runtime dependencies.
 */

const isValidSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const generateSlug = (title: string) => {
  return title
    .toLowerCase()
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidGoogleMapsUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false;
  const urlObj = new URL(url);
  return urlObj.hostname.includes('google.com') || urlObj.hostname.includes('maps.google.com');
};

export type CategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  icon_emoji?: string;
  color_hex?: string;
};

export type TagInput = {
  name: string;
  slug?: string;
  color_hex?: string;
};

export type CreateArticleInput = {
  title: string;
  subtitle?: string;
  body: string;
  slug?: string;
  category_id?: string | null;
  tags?: string[];
  featured_image_url?: string;
  published?: boolean;
  published_at?: string;
  expires_at?: string;
};

export type UpdateArticleInput = Partial<CreateArticleInput> & {
  featured_on_homepage?: boolean;
  archived?: boolean;
  pinned?: boolean;
  pin_order?: number;
  featured_image_url?: string | null;
  category_id?: string | null;
  expires_at?: string | null;
};

export type CreateEventInput = {
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
};

export type UpdateEventInput = Partial<CreateEventInput>;

export type NewsSearchFiltersInput = {
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
};

export {
  generateSlug,
  isValidUrl,
  isValidGoogleMapsUrl,
  isValidSlug,
};
