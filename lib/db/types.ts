// Minimal hand-written Database type — sufficient for our hand-rolled query helpers.
// In a real project, regenerate with `supabase gen types typescript` and replace this file.

export type AppRole = "viewer" | "author" | "manager";
export type PostStatus = "draft" | "submitted" | "scheduled" | "published" | "archived";
export type MediaType = "image" | "video" | "audio" | "document";
export type MediaSourceType = "upload" | "external_url";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  weekly_post_day: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedUserRow {
  id: string;
  email: string;
  role: AppRole;
  weekly_post_day: number | null;
  created_by: string | null;
  created_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface PostRow {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_json: unknown;
  content_html: string;
  status: PostStatus;
  week_start_date: string;
  assigned_weekday: number | null;
  published_at: string | null;
  scheduled_for: string | null;
  cover_media_id: string | null;
  read_time_minutes: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface MediaAssetRow {
  id: string;
  owner_id: string;
  post_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source_type: MediaSourceType;
  media_type: MediaType;
  mime_type: string | null;
  size_bytes: number | null;
  external_url: string | null;
  provider: string | null;
  title: string | null;
  alt_text: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface PostTemplateRow {
  id: string;
  name: string;
  description: string | null;
  content_json: unknown;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

// `Database` is intentionally permissive — we only use it as a generic to the
// Supabase client so server queries compile without `any`. Replace with
// generated types in production.
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, never>;
    Functions: {
      assign_weekday: {
        Args: { p_user_id: string; p_weekday: number | null };
        Returns: undefined;
      };
      bootstrap_profile: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      is_convegenius_user: { Args: Record<string, never>; Returns: boolean };
      is_manager: { Args: Record<string, never>; Returns: boolean };
      current_user_role: { Args: Record<string, never>; Returns: AppRole };
      is_author_or_manager: { Args: Record<string, never>; Returns: boolean };
      is_authorized_author: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      post_status: PostStatus;
      media_type: MediaType;
      media_source_type: MediaSourceType;
    };
    CompositeTypes: Record<string, never>;
  };
};
