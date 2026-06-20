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
      attendance_records: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade: string | null
          id: string
          name: string
          school_id: string
          whatsapp_group_name: string | null
        }
        Insert: {
          created_at?: string
          grade?: string | null
          id?: string
          name: string
          school_id: string
          whatsapp_group_name?: string | null
        }
        Update: {
          created_at?: string
          grade?: string | null
          id?: string
          name?: string
          school_id?: string
          whatsapp_group_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          teacher_id?: string
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          absent_days: number
          academic_notes: string | null
          attendance_pct: number
          behavior_notes: string | null
          class_id: string
          generated_at: string
          id: string
          month: string
          present_days: number
          school_id: string
          student_id: string
        }
        Insert: {
          absent_days?: number
          academic_notes?: string | null
          attendance_pct?: number
          behavior_notes?: string | null
          class_id: string
          generated_at?: string
          id?: string
          month: string
          present_days?: number
          school_id: string
          student_id: string
        }
        Update: {
          absent_days?: number
          academic_notes?: string | null
          attendance_pct?: number
          behavior_notes?: string | null
          class_id?: string
          generated_at?: string
          id?: string
          month?: string
          present_days?: number
          school_id?: string
          student_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_code: string | null
          created_at: string
          full_name: string | null
          id: string
          school_id: string | null
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          school_id?: string | null
        }
        Update: {
          access_code?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          amount_inr: number
          coins: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          status: Database["public"]["Enums"]["redemption_status"]
          teacher_id: string
          upi_id: string | null
        }
        Insert: {
          amount_inr: number
          coins: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          teacher_id: string
          upi_id?: string | null
        }
        Update: {
          amount_inr?: number
          coins?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          teacher_id?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      school_teachers: {
        Row: {
          class_id: string | null
          code: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          school_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          code: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          school_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          code?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          full_name: string
          id: string
          parent_phone: string | null
          roll_number: number | null
        }
        Insert: {
          class_id: string
          created_at?: string
          full_name: string
          id?: string
          parent_phone?: string | null
          roll_number?: number | null
        }
        Update: {
          class_id?: string
          created_at?: string
          full_name?: string
          id?: string
          parent_phone?: string | null
          roll_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          class_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_notes: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string
          school_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note: string
          school_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string
          school_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          teacher_id?: string
          updated_at?: string
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
      teacher_has_class: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      user_school_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "teacher" | "principal"
      attendance_status: "present" | "absent"
      redemption_status: "pending" | "approved" | "paid" | "rejected"
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
      app_role: ["admin", "teacher", "principal"],
      attendance_status: ["present", "absent"],
      redemption_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
