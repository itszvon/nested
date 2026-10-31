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
    PostgrestVersion: "14.18"
  }
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      file_extensions: {
        Row: {
          extension: string
          language: Database["public"]["Enums"]["file_language"]
        }
        Insert: {
          extension: string
          language: Database["public"]["Enums"]["file_language"]
        }
        Update: {
          extension?: string
          language?: Database["public"]["Enums"]["file_language"]
        }
        Relationships: []
      }
      files: {
        Row: {
          byte_size: number
          content: string
          content_hash: string | null
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          language: Database["public"]["Enums"]["file_language"] | null
          name: string
          owner_id: string
          project_id: string | null
          revision: number
          sort_order: number
          trash_root_id: string | null
          updated_at: string
        }
        Insert: {
          byte_size?: number
          content?: string
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["file_kind"]
          language?: Database["public"]["Enums"]["file_language"] | null
          name: string
          owner_id: string
          project_id?: string | null
          revision?: number
          sort_order?: number
          trash_root_id?: string | null
          updated_at?: string
        }
        Update: {
          byte_size?: number
          content?: string
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          language?: Database["public"]["Enums"]["file_language"] | null
          name?: string
          owner_id?: string
          project_id?: string | null
          revision?: number
          sort_order?: number
          trash_root_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          sort_order: number
          trash_root_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          sort_order?: number
          trash_root_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          sort_order?: number
          trash_root_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          payload: Json
          purpose: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id: string
          payload: Json
          purpose: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          purpose?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          settings: Json
          storage_bytes: number
          username: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          settings?: Json
          storage_bytes?: number
          username: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          settings?: Json
          storage_bytes?: number
          username?: string
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          created_at: string
          file_count: number
          id: string
          message: string | null
          owner_id: string
          project_id: string
          total_bytes: number
        }
        Insert: {
          created_at?: string
          file_count?: number
          id?: string
          message?: string | null
          owner_id: string
          project_id: string
          total_bytes?: number
        }
        Update: {
          created_at?: string
          file_count?: number
          id?: string
          message?: string | null
          owner_id?: string
          project_id?: string
          total_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      versions: {
        Row: {
          byte_size: number
          content: string
          content_hash: string
          created_at: string
          file_id: string
          id: string
          label: string | null
          owner_id: string
          snapshot_id: string | null
          source: Database["public"]["Enums"]["version_source"]
          source_revision: number
        }
        Insert: {
          byte_size: number
          content: string
          content_hash: string
          created_at?: string
          file_id: string
          id?: string
          label?: string | null
          owner_id: string
          snapshot_id?: string | null
          source: Database["public"]["Enums"]["version_source"]
          source_revision: number
        }
        Update: {
          byte_size?: number
          content?: string
          content_hash?: string
          created_at?: string
          file_id?: string
          id?: string
          label?: string | null
          owner_id?: string
          snapshot_id?: string | null
          source?: Database["public"]["Enums"]["version_source"]
          source_revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_account: { Args: never; Returns: undefined }
      empty_trash: { Args: never; Returns: number }
      move_node: {
        Args: {
          p_id: string
          p_kind: string
          p_new_parent: string
          p_new_sort?: number
        }
        Returns: undefined
      }
      project_of_folder: { Args: { p_folder: string }; Returns: string }
      purge_trash: { Args: { p_days?: number }; Returns: number }
      reorder_nodes: {
        Args: { p_ids: string[]; p_kind: string; p_parent: string }
        Returns: undefined
      }
      restore_node: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      restore_project: { Args: { p_snapshot_id: string }; Returns: number }
      restore_version: { Args: { p_version_id: string }; Returns: string }
      save_file: {
        Args: {
          p_content: string
          p_expected_revision: number
          p_file_id: string
        }
        Returns: {
          revision: number
          version_id: string
        }[]
      }
      save_project: {
        Args: { p_items: Json; p_message: string; p_project_id: string }
        Returns: {
          saved: number
          skipped: number
          snapshot_id: string
        }[]
      }
      trash_node: { Args: { p_id: string; p_kind: string }; Returns: number }
    }
    Enums: {
      file_kind: "markdown" | "code"
      file_language:
        | "python"
        | "java"
        | "javascript"
        | "html"
        | "css"
        | "cpp"
        | "typescript"
        | "go"
        | "rust"
        | "sql"
        | "bash"
      version_source: "file" | "project" | "auto"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      file_kind: ["markdown", "code"],
      file_language: [
        "python",
        "java",
        "javascript",
        "html",
        "css",
        "cpp",
        "typescript",
        "go",
        "rust",
        "sql",
        "bash",
      ],
      version_source: ["file", "project", "auto"],
    },
  },
} as const
