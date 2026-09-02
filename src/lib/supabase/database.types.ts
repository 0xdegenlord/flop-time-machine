export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_lobby_archive_status: {
        Args: Record<PropertyKey, never>;
        Returns: {
          archive_enabled: boolean;
          current_epoch_number: number | null;
          last_saved_seq: string | null;
          last_successful_poll_at: string | null;
          latest_message_timestamp: string | null;
        }[];
      };

      get_lobby_epochs: {
        Args: {
          p_before_epoch_number?: number | null;
          p_limit?: number;
        };
        Returns: {
          epoch_id: string;
          epoch_number: number;
          observed_started_at: string;
          observed_ended_at: string | null;
          message_count: string;
          first_message_timestamp: string | null;
          last_message_timestamp: string | null;
          gap_count: string;
        }[];
      };

      get_lobby_messages: {
        Args: {
          p_before_epoch_number?: number | null;
          p_before_seq?: string | null;
          p_epoch_number?: number | null;
          p_from_timestamp?: string | null;
          p_limit?: number;
          p_query?: string | null;
          p_sender?: string | null;
          p_to_timestamp?: string | null;
        };
        Returns: {
          epoch_number: number;
          seq: string;
          message_timestamp: string;
          sender: string;
          message_text: string;
          nonce: string | null;
          collected_at: string;
        }[];
      };
    };

    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
