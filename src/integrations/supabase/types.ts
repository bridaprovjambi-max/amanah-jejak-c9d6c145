export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      authority_report_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          report_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type?: string | null
          report_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          report_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "authority_report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "authority_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      authority_reports: {
        Row: {
          authority_description: string
          created_at: string
          execution_summary: string
          follow_up_notes: string | null
          id: string
          jenjang: Database["public"]["Enums"]["jenjang"]
          obstacles: string | null
          period_month: number
          period_year: number
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          authority_description: string
          created_at?: string
          execution_summary: string
          follow_up_notes?: string | null
          id?: string
          jenjang: Database["public"]["Enums"]["jenjang"]
          obstacles?: string | null
          period_month: number
          period_year: number
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          authority_description?: string
          created_at?: string
          execution_summary?: string
          follow_up_notes?: string | null
          id?: string
          jenjang?: Database["public"]["Enums"]["jenjang"]
          obstacles?: string | null
          period_month?: number
          period_year?: number
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_folders: {
        Row: {
          created_at: string
          hint: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hint?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hint?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_analyzed_at: string | null
          ai_entities: Json | null
          ai_error: string | null
          ai_key_points: Json | null
          ai_status: string
          ai_summary: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          folder: string
          id: string
          mime_type: string | null
          title: string
          uploaded_by: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_entities?: Json | null
          ai_error?: string | null
          ai_key_points?: Json | null
          ai_status?: string
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          folder?: string
          id?: string
          mime_type?: string | null
          title: string
          uploaded_by: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_entities?: Json | null
          ai_error?: string | null
          ai_key_points?: Json | null
          ai_status?: string
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          folder?: string
          id?: string
          mime_type?: string | null
          title?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      external_api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          note: string | null
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          note?: string | null
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          note?: string | null
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      pokja: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          jabatan: string | null
          jenjang: Database["public"]["Enums"]["jenjang"]
          nip: string | null
          pangkat_golongan: string | null
          pokja_id: string | null
          telegram_chat_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          jabatan?: string | null
          jenjang?: Database["public"]["Enums"]["jenjang"]
          nip?: string | null
          pangkat_golongan?: string | null
          pokja_id?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          jabatan?: string | null
          jenjang?: Database["public"]["Enums"]["jenjang"]
          nip?: string | null
          pangkat_golongan?: string | null
          pokja_id?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pokja_id_fkey"
            columns: ["pokja_id"]
            isOneToOne: false
            referencedRelation: "pokja"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          report_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type?: string | null
          report_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          report_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: string
          created_at: string
          id: string
          progress: number
          reported_by: string
          status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          progress?: number
          reported_by: string
          status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          progress?: number
          reported_by?: string
          status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_review_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          review_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type?: string | null
          review_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          review_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_review_attachments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "staff_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_review_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["staff_review_status"] | null
          id: string
          notes: string | null
          review_id: string
          to_status: Database["public"]["Enums"]["staff_review_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["staff_review_status"]
            | null
          id?: string
          notes?: string | null
          review_id: string
          to_status: Database["public"]["Enums"]["staff_review_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["staff_review_status"]
            | null
          id?: string
          notes?: string | null
          review_id?: string
          to_status?: Database["public"]["Enums"]["staff_review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_review_history_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "staff_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_reviews: {
        Row: {
          category: Database["public"]["Enums"]["staff_review_category"]
          created_at: string
          disposisi_at: string | null
          disposisi_notes: string | null
          fakta_data: string
          id: string
          judul: string
          kesimpulan: string
          pembahasan: string
          pokok_persoalan: string
          pra_anggapan: string
          recipient_id: string
          reporter_id: string
          saran: Json
          status: Database["public"]["Enums"]["staff_review_status"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["staff_review_category"]
          created_at?: string
          disposisi_at?: string | null
          disposisi_notes?: string | null
          fakta_data: string
          id?: string
          judul: string
          kesimpulan: string
          pembahasan: string
          pokok_persoalan: string
          pra_anggapan: string
          recipient_id: string
          reporter_id: string
          saran?: Json
          status?: Database["public"]["Enums"]["staff_review_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["staff_review_category"]
          created_at?: string
          disposisi_at?: string | null
          disposisi_notes?: string | null
          fakta_data?: string
          id?: string
          judul?: string
          kesimpulan?: string
          pembahasan?: string
          pokok_persoalan?: string
          pra_anggapan?: string
          recipient_id?: string
          reporter_id?: string
          saran?: Json
          status?: Database["public"]["Enums"]["staff_review_status"]
          updated_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          mentioned_user_ids: string[]
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          mentioned_user_ids?: string[]
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          mentioned_user_ids?: string[]
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          id: string
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          task_id: string
          to_status: Database["public"]["Enums"]["task_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          id?: string
          task_id?: string
          to_status?: Database["public"]["Enums"]["task_status"]
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string | null
          assigned_to_pokja: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          parent_task_id: string | null
          priority: string
          reminder_sent_h1: boolean
          reminder_sent_h3: boolean
          reminder_sent_overdue: boolean
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to?: string | null
          assigned_to_pokja?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          reminder_sent_h1?: boolean
          reminder_sent_h3?: boolean
          reminder_sent_overdue?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string | null
          assigned_to_pokja?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          reminder_sent_h1?: boolean
          reminder_sent_h3?: boolean
          reminder_sent_overdue?: boolean
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_pokja_fkey"
            columns: ["assigned_to_pokja"]
            isOneToOne: false
            referencedRelation: "pokja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "kepala"
        | "sekretaris"
        | "kasubbag"
        | "pokja_member"
        | "staf_pelaksana"
        | "jafung_member"
        | "ketua_pokja_riset"
        | "ketua_pokja_inovasi"
        | "anggota_pokja_riset"
        | "anggota_pokja_inovasi"
      jenjang:
        | "eselon_ii"
        | "eselon_iii"
        | "eselon_iv"
        | "pokja"
        | "staf"
        | "jafung"
      staff_review_category: "perencanaan" | "keuangan" | "kepegawaian"
      staff_review_status:
        | "draft"
        | "submitted"
        | "reviewed"
        | "approved"
        | "rejected"
      task_status: "pending" | "in_progress" | "completed" | "overdue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "kepala",
        "sekretaris",
        "kasubbag",
        "pokja_member",
        "staf_pelaksana",
        "jafung_member",
        "ketua_pokja_riset",
        "ketua_pokja_inovasi",
        "anggota_pokja_riset",
        "anggota_pokja_inovasi",
      ],
      jenjang: [
        "eselon_ii",
        "eselon_iii",
        "eselon_iv",
        "pokja",
        "staf",
        "jafung",
      ],
      staff_review_category: ["perencanaan", "keuangan", "kepegawaian"],
      staff_review_status: [
        "draft",
        "submitted",
        "reviewed",
        "approved",
        "rejected",
      ],
      task_status: ["pending", "in_progress", "completed", "overdue"],
    },
  },
} as const
