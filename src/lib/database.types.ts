export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      candidates: {
        Row: {
          appearance: string | null
          birth_date: string | null
          character_description: string | null
          chassidut: string | null
          city: string | null
          community: string | null
          country_of_origin: string | null
          created_at: string
          degree: string | null
          desired_home_style: string | null
          education_history: Json
          first_name: string
          future_plans: string | null
          gender: Database["public"]["Enums"]["gender"]
          general_notes: string | null
          hebrew_birth_date: string | null
          height_cm: number | null
          id: string
          institution: string | null
          institution_type: string | null
          last_name: string
          occupation: string | null
          owner_id: string
          region: string | null
          special_requirements: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appearance?: string | null
          birth_date?: string | null
          character_description?: string | null
          chassidut?: string | null
          city?: string | null
          community?: string | null
          country_of_origin?: string | null
          created_at?: string
          degree?: string | null
          desired_home_style?: string | null
          education_history?: Json
          first_name: string
          future_plans?: string | null
          gender: Database["public"]["Enums"]["gender"]
          general_notes?: string | null
          hebrew_birth_date?: string | null
          height_cm?: number | null
          id?: string
          institution?: string | null
          institution_type?: string | null
          last_name: string
          occupation?: string | null
          owner_id?: string
          region?: string | null
          special_requirements?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appearance?: string | null
          birth_date?: string | null
          character_description?: string | null
          chassidut?: string | null
          city?: string | null
          community?: string | null
          country_of_origin?: string | null
          created_at?: string
          degree?: string | null
          desired_home_style?: string | null
          education_history?: Json
          first_name?: string
          future_plans?: string | null
          gender?: Database["public"]["Enums"]["gender"]
          general_notes?: string | null
          hebrew_birth_date?: string | null
          height_cm?: number | null
          id?: string
          institution?: string | null
          institution_type?: string | null
          last_name?: string
          occupation?: string | null
          owner_id?: string
          region?: string | null
          special_requirements?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_details: {
        Row: {
          birth_order: number | null
          candidate_id: string
          father_name: string | null
          father_occupation: string | null
          lineage: string | null
          mother_maiden_name: string | null
          mother_name: string | null
          mother_occupation: string | null
          siblings_count: number | null
        }
        Insert: {
          birth_order?: number | null
          candidate_id: string
          father_name?: string | null
          father_occupation?: string | null
          lineage?: string | null
          mother_maiden_name?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          siblings_count?: number | null
        }
        Update: {
          birth_order?: number | null
          candidate_id?: string
          father_name?: string | null
          father_occupation?: string | null
          lineage?: string | null
          mother_maiden_name?: string | null
          mother_name?: string | null
          mother_occupation?: string | null
          siblings_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_details_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_details_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          body: string | null
          created_at: string
          done: boolean
          female_id: string | null
          id: string
          male_id: string | null
          owner_id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          done?: boolean
          female_id?: string | null
          id?: string
          male_id?: string | null
          owner_id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          done?: boolean
          female_id?: string | null
          id?: string
          male_id?: string | null
          owner_id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_female_id_fkey"
            columns: ["female_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_female_id_fkey"
            columns: ["female_id"]
            isOneToOne: false
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_male_id_fkey"
            columns: ["male_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_male_id_fkey"
            columns: ["male_id"]
            isOneToOne: false
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
        ]
      }
      in_laws: {
        Row: {
          candidate_id: string
          details: string | null
          full_name: string
          id: string
          relation: string
          sort_order: number
        }
        Insert: {
          candidate_id: string
          details?: string | null
          full_name: string
          id?: string
          relation: string
          sort_order?: number
        }
        Update: {
          candidate_id?: string
          details?: string | null
          full_name?: string
          id?: string
          relation?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "in_laws_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "in_laws_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          created_at: string
          from_stage: Database["public"]["Enums"]["proposal_stage"] | null
          id: string
          kind: string
          proposal_id: string
          response: Database["public"]["Enums"]["side_response"] | null
          side: Database["public"]["Enums"]["gender"] | null
          text: string | null
          to_stage: Database["public"]["Enums"]["proposal_stage"] | null
        }
        Insert: {
          created_at?: string
          from_stage?: Database["public"]["Enums"]["proposal_stage"] | null
          id?: string
          kind: string
          proposal_id: string
          response?: Database["public"]["Enums"]["side_response"] | null
          side?: Database["public"]["Enums"]["gender"] | null
          text?: string | null
          to_stage?: Database["public"]["Enums"]["proposal_stage"] | null
        }
        Update: {
          created_at?: string
          from_stage?: Database["public"]["Enums"]["proposal_stage"] | null
          id?: string
          kind?: string
          proposal_id?: string
          response?: Database["public"]["Enums"]["side_response"] | null
          side?: Database["public"]["Enums"]["gender"] | null
          text?: string | null
          to_stage?: Database["public"]["Enums"]["proposal_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          closed_reason: string | null
          created_at: string
          female_id: string
          female_response: Database["public"]["Enums"]["side_response"]
          id: string
          male_id: string
          male_response: Database["public"]["Enums"]["side_response"]
          next_followup: string | null
          notes: string | null
          owner_id: string
          stage: Database["public"]["Enums"]["proposal_stage"]
          updated_at: string
        }
        Insert: {
          closed_reason?: string | null
          created_at?: string
          female_id: string
          female_response?: Database["public"]["Enums"]["side_response"]
          id?: string
          male_id: string
          male_response?: Database["public"]["Enums"]["side_response"]
          next_followup?: string | null
          notes?: string | null
          owner_id?: string
          stage?: Database["public"]["Enums"]["proposal_stage"]
          updated_at?: string
        }
        Update: {
          closed_reason?: string | null
          created_at?: string
          female_id?: string
          female_response?: Database["public"]["Enums"]["side_response"]
          id?: string
          male_id?: string
          male_response?: Database["public"]["Enums"]["side_response"]
          next_followup?: string | null
          notes?: string | null
          owner_id?: string
          stage?: Database["public"]["Enums"]["proposal_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_female_id_fkey"
            columns: ["female_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_female_id_fkey"
            columns: ["female_id"]
            isOneToOne: false
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_male_id_fkey"
            columns: ["male_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_male_id_fkey"
            columns: ["male_id"]
            isOneToOne: false
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          candidate_id: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          candidate_id: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          candidate_id?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          candidate_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          owner_id: string
          proposal_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          owner_id?: string
          proposal_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          owner_id?: string
          proposal_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      candidates_view: {
        Row: {
          age: number | null
          appearance: string | null
          birth_date: string | null
          character_description: string | null
          chassidut: string | null
          city: string | null
          community: string | null
          country_of_origin: string | null
          created_at: string | null
          degree: string | null
          desired_home_style: string | null
          education_history: Json | null
          first_name: string | null
          future_plans: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          general_notes: string | null
          hebrew_birth_date: string | null
          height_cm: number | null
          id: string | null
          institution: string | null
          institution_type: string | null
          last_name: string | null
          occupation: string | null
          owner_id: string | null
          region: string | null
          resume_file_name: string | null
          resume_id: string | null
          resume_mime_type: string | null
          resume_size_bytes: number | null
          resume_storage_path: string | null
          resume_uploaded_at: string | null
          special_requirements: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      owns_candidate: {
        Args: {
          cid: string
        }
        Returns: boolean
      }
      owns_proposal: {
        Args: {
          pid: string
        }
        Returns: boolean
      }
      save_candidate: {
        Args: {
          payload: Json
        }
        Returns: string
      }
    }
    Enums: {
      gender: "male" | "female"
      proposal_stage:
        | "idea"
        | "suggested"
        | "checking"
        | "meeting"
        | "engaged"
        | "closed"
      side_response: "pending" | "interested" | "declined"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

