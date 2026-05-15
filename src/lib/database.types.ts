export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          slug: string;
          admin_token: string;
          couple_names: string;
          welcome_message: string;
          qr_background_path: string | null;
          creator_id: string | null;
          created_at: string;
          community_rules?: string;
          moderation_enabled?: boolean;
          invite_code?: string | null;
          guest_page_views?: number;
          unique_visitor_count?: number;
          memory_submission_count?: number;
        };
        Insert: {
          id?: string;
          slug: string;
          admin_token?: string;
          couple_names: string;
          welcome_message: string;
          qr_background_path?: string | null;
          creator_id?: string | null;
          created_at?: string;
          community_rules?: string;
          moderation_enabled?: boolean;
          invite_code?: string | null;
          guest_page_views?: number;
          unique_visitor_count?: number;
          memory_submission_count?: number;
        };
        Update: {
          id?: string;
          slug?: string;
          admin_token?: string;
          couple_names?: string;
          welcome_message?: string;
          qr_background_path?: string | null;
          creator_id?: string | null;
          created_at?: string;
          community_rules?: string;
          moderation_enabled?: boolean;
          invite_code?: string | null;
          guest_page_views?: number;
          unique_visitor_count?: number;
          memory_submission_count?: number;
        };
      };
      memories: {
        Row: {
          id: string;
          event_id: string;
          owner_id: string;
          full_name: string;
          note: string | null;
          photo_path: string | null;
          video_path: string | null;
          created_at: string;
          moderation_status?: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          owner_id: string;
          full_name: string;
          note?: string | null;
          photo_path?: string | null;
          video_path?: string | null;
          created_at?: string;
          moderation_status?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          owner_id?: string;
          full_name?: string;
          note?: string | null;
          photo_path?: string | null;
          video_path?: string | null;
          created_at?: string;
          moderation_status?: string;
        };
      };
      event_visitor_keys: {
        Row: {
          event_id: string;
          visitor_key: string;
          first_seen: string;
        };
        Insert: {
          event_id: string;
          visitor_key: string;
          first_seen?: string;
        };
        Update: {
          event_id?: string;
          visitor_key?: string;
          first_seen?: string;
        };
      };
    };
    Functions: {
      track_guest_visit: {
        Args: { p_event: string; p_visitor_key: string };
        Returns: undefined;
      };
      update_event_admin_settings: {
        Args: {
          p_slug: string;
          p_admin_token: string;
          p_community_rules: string;
          p_moderation_enabled: boolean;
          p_invite_code: string | null;
          p_clear_invite: boolean;
        };
        Returns: undefined;
      };
      moderate_memory: {
        Args: { p_admin_token: string; p_memory_id: string; p_status: string };
        Returns: undefined;
      };
    };
  };
}

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type MemoryRow = Database["public"]["Tables"]["memories"]["Row"];
