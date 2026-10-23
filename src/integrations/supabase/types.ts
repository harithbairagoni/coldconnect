export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      connections: {
        Row: {
          company: string | null;
          created_at: string;
          email: string | null;
          id: string;
          instagram_handle: string | null;
          interests: Json;
          last_interaction_at: string | null;
          linkedin_url: string | null;
          meeting_purpose: string | null;
          name: string;
          next_followup_at: string | null;
          notes: string | null;
          profile_image: string | null;
          relationship_status: string | null;
          role: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          company?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          instagram_handle?: string | null;
          interests?: Json;
          last_interaction_at?: string | null;
          linkedin_url?: string | null;
          meeting_purpose?: string | null;
          name: string;
          next_followup_at?: string | null;
          notes?: string | null;
          profile_image?: string | null;
          relationship_status?: string | null;
          role?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          instagram_handle?: string | null;
          interests?: Json;
          last_interaction_at?: string | null;
          linkedin_url?: string | null;
          meeting_purpose?: string | null;
          name?: string;
          next_followup_at?: string | null;
          notes?: string | null;
          profile_image?: string | null;
          relationship_status?: string | null;
          role?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      followups: {
        Row: {
          channel: string | null;
          connection_id: string | null;
          created_at: string;
          id: string;
          message: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "followups_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
        ];
      };
      interactions: {
        Row: {
          channel: string | null;
          connection_id: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          occurred_at: string;
          type: string | null;
          user_id: string;
        };
        Insert: {
          channel?: string | null;
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          type?: string | null;
          user_id: string;
        };
        Update: {
          channel?: string | null;
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interactions_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          connection_id: string | null;
          created_at: string;
          id: string;
          location: string | null;
          notes: string | null;
          preparation_score: number | null;
          purpose: string | null;
          scheduled_at: string | null;
          status: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          preparation_score?: number | null;
          purpose?: string | null;
          scheduled_at?: string | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          preparation_score?: number | null;
          purpose?: string | null;
          scheduled_at?: string | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
        ];
      };
      pitch_sessions: {
        Row: {
          audio_url: string | null;
          biggest_opportunity: string | null;
          clarity_score: number | null;
          conciseness_score: number | null;
          confidence_score: number | null;
          connection_id: string | null;
          conversation_bridge: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          improved_pitch: string | null;
          memorability_score: number | null;
          overall_score: number | null;
          relevance_score: number | null;
          storytelling_score: number | null;
          transcript: string | null;
          user_id: string;
          what_to_improve: string | null;
          what_worked: string | null;
        };
        Insert: {
          audio_url?: string | null;
          biggest_opportunity?: string | null;
          clarity_score?: number | null;
          conciseness_score?: number | null;
          confidence_score?: number | null;
          connection_id?: string | null;
          conversation_bridge?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          improved_pitch?: string | null;
          memorability_score?: number | null;
          overall_score?: number | null;
          relevance_score?: number | null;
          storytelling_score?: number | null;
          transcript?: string | null;
          user_id: string;
          what_to_improve?: string | null;
          what_worked?: string | null;
        };
        Update: {
          audio_url?: string | null;
          biggest_opportunity?: string | null;
          clarity_score?: number | null;
          conciseness_score?: number | null;
          confidence_score?: number | null;
          connection_id?: string | null;
          conversation_bridge?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          improved_pitch?: string | null;
          memorability_score?: number | null;
          overall_score?: number | null;
          relevance_score?: number | null;
          storytelling_score?: number | null;
          transcript?: string | null;
          user_id?: string;
          what_to_improve?: string | null;
          what_worked?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pitch_sessions_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          about: string | null;
          career_goals: string | null;
          conversation_style: string | null;
          created_at: string;
          education: Json;
          email: string | null;
          experience: Json;
          full_name: string | null;
          headline: string | null;
          id: string;
          instagram_handle: string | null;
          interests: Json;
          linkedin_url: string | null;
          location: string | null;
          networking_goals: string | null;
          photo_url: string | null;
          profile_highlights: Json;
          skills: Json;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          about?: string | null;
          career_goals?: string | null;
          conversation_style?: string | null;
          created_at?: string;
          education?: Json;
          email?: string | null;
          experience?: Json;
          full_name?: string | null;
          headline?: string | null;
          id?: string;
          instagram_handle?: string | null;
          interests?: Json;
          linkedin_url?: string | null;
          location?: string | null;
          networking_goals?: string | null;
          photo_url?: string | null;
          profile_highlights?: Json;
          skills?: Json;
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          about?: string | null;
          career_goals?: string | null;
          conversation_style?: string | null;
          created_at?: string;
          education?: Json;
          email?: string | null;
          experience?: Json;
          full_name?: string | null;
          headline?: string | null;
          id?: string;
          instagram_handle?: string | null;
          interests?: Json;
          linkedin_url?: string | null;
          location?: string | null;
          networking_goals?: string | null;
          photo_url?: string | null;
          profile_highlights?: Json;
          skills?: Json;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
