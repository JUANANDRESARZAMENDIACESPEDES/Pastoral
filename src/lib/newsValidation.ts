/**
 * Validation schemas for News Management System
 * Esquemas de validación con Zod
 */

import { z } from 'zod';

// Helpers
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

// Validación de URL
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

// Schemas
export const CategorySchema = z.object({
  name: z.string().min(3, 'Nombre debe tener al menos 3 caracteres').max(100),
  slug: z.string().toLowerCase().refine(isValidSlug, 'Slug debe ser válido (solo letras, números y guiones)').optional(),
  description: z.string().max(500).optional(),
  icon_emoji: z.string().max(5).optional(),
  color_hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color debe ser hexadecimal válido').default('#C8973A'),
});

export const TagSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(50),
  slug: z.string().toLowerCase().refine(isValidSlug, 'Slug debe ser válido').optional(),
  color_hex: z.string().regex(/^#[0-9A-F]{6}$/i).default('#C8973A'),
});

export const CreateArticleSchema = z.object({
  title: z.string()
    .min(5, 'Título debe tener al menos 5 caracteres')
    .max(200, 'Título no puede exceder 200 caracteres'),
  subtitle: z.string().max(300, 'Subtítulo no puede exceder 300 caracteres').optional(),
  body: z.string()
    .min(20, 'El cuerpo debe tener al menos 20 caracteres')
    .max(10000, 'El cuerpo no puede exceder 10000 caracteres'),
  slug: z.string()
    .toLowerCase()
    .refine(isValidSlug, 'Slug debe ser válido')
    .optional(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().uuid()).default([]),
  featured_image_url: z.string().url('URL de imagen inválida').optional(),
  published: z.boolean().default(false),
  published_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
}).strict();

export const UpdateArticleSchema = z.object({
  title: z.string()
    .min(5, 'Título debe tener al menos 5 caracteres')
    .max(200, 'Título no puede exceder 200 caracteres')
    .optional(),
  subtitle: z.string().max(300).optional(),
  body: z.string()
    .min(20, 'El cuerpo debe tener al menos 20 caracteres')
    .max(10000, 'El cuerpo no puede exceder 10000 caracteres')
    .optional(),
  slug: z.string().toLowerCase().refine(isValidSlug, 'Slug debe ser válido').optional(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().uuid()).optional(),
  featured_image_url: z.string().url().optional().nullable(),
  featured_on_homepage: z.boolean().optional(),
  published: z.boolean().optional(),
  published_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional().nullable(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  pin_order: z.number().int().min(0).max(999).optional(),
}).strict();

export const CreateEventSchema = z.object({
  article_id: z.string().uuid(),
  start_date: z.string().date('Fecha de inicio inválida'),
  start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Hora debe ser HH:MM en formato 24h').optional(),
  end_date: z.string().date().optional(),
  end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  location_name: z.string().max(150).optional(),
  location_address: z.string().max(500).optional(),
  google_maps_url: z.string()
    .url('URL inválida')
    .refine(isValidGoogleMapsUrl, 'Debe ser una URL válida de Google Maps')
    .optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  allow_inscription: z.boolean().default(false),
  max_participants: z.number().int().min(1).optional(),
  inscription_deadline: z.string().datetime().optional(),
  contact_person_name: z.string().max(100).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
}).strict();

export const UpdateEventSchema = z.object({
  start_date: z.string().date().optional(),
  start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  end_date: z.string().date().optional(),
  end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  location_name: z.string().max(150).optional(),
  location_address: z.string().max(500).optional(),
  google_maps_url: z.string()
    .url()
    .refine(isValidGoogleMapsUrl, 'Debe ser una URL válida de Google Maps')
    .optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  allow_inscription: z.boolean().optional(),
  max_participants: z.number().int().min(1).optional(),
  inscription_deadline: z.string().datetime().optional(),
  contact_person_name: z.string().max(100).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
}).strict();

export const NewsSearchFiltersSchema = z.object({
  query: z.string().optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string().uuid()).optional(),
  published: z.boolean().optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  is_event: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort_by: z.enum(['published_at', 'created_at', 'views', 'event_date']).default('published_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
}).strict();

// Export utilities
export { generateSlug, isValidUrl, isValidGoogleMapsUrl };

export type CategoryInput = z.infer<typeof CategorySchema>;
export type TagInput = z.infer<typeof TagSchema>;
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type NewsSearchFiltersInput = z.infer<typeof NewsSearchFiltersSchema>;
