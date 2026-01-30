// GENERATED
// SUPABASE_ACCESS_TOKEN="..." npx supabase gen types typescript \
//     --project-id mygothwbccfcegfpjtoh --schema public \
//     > packages/commons/user-permissions/src/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    public: {
        Tables: {
            RolePermissions: {
                Row: {
                    id: number;
                    permission: string;
                    role: string;
                };
                Insert: {
                    id?: number;
                    permission: string;
                    role: string;
                };
                Update: {
                    id?: number;
                    permission?: string;
                    role?: string;
                };
                Relationships: [];
            };
            UserRolesPerResource: {
                Row: {
                    created_at: string;
                    id: string;
                    org_id: string;
                    resource_id: string;
                    resource_type: string;
                    role: string;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    org_id: string;
                    resource_id: string;
                    resource_type: string;
                    role: string;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    org_id?: string;
                    resource_id?: string;
                    resource_type?: string;
                    role?: string;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            OidcGroupMappings: {
                Row: {
                    id: string;
                    org_id: string;
                    connection_name: string;
                    group_id: string;
                    mapping_type: "org_role" | "resource_role";
                    role: string;
                    resource_type: string | null;
                    resource_id: string | null;
                    created_at: string;
                    updated_at: string;
                    created_by: string | null;
                };
                Insert: {
                    id?: string;
                    org_id: string;
                    connection_name: string;
                    group_id: string;
                    mapping_type: "org_role" | "resource_role";
                    role: string;
                    resource_type?: string | null;
                    resource_id?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    created_by?: string | null;
                };
                Update: {
                    id?: string;
                    org_id?: string;
                    connection_name?: string;
                    group_id?: string;
                    mapping_type?: "org_role" | "resource_role";
                    role?: string;
                    resource_type?: string | null;
                    resource_id?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    created_by?: string | null;
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

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
}
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
}
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
}
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
