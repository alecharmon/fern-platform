export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    graphql_public: {
        Tables: {
            [_ in never]: never;
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            graphql: {
                Args: {
                    extensions?: Json;
                    operationName?: string;
                    query?: string;
                    variables?: Json;
                };
                Returns: Json;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
    public: {
        Tables: {
            _prisma_migrations: {
                Row: {
                    applied_steps_count: number;
                    checksum: string;
                    finished_at: string | null;
                    id: string;
                    logs: string | null;
                    migration_name: string;
                    rolled_back_at: string | null;
                    started_at: string;
                };
                Insert: {
                    applied_steps_count?: number;
                    checksum: string;
                    finished_at?: string | null;
                    id: string;
                    logs?: string | null;
                    migration_name: string;
                    rolled_back_at?: string | null;
                    started_at?: string;
                };
                Update: {
                    applied_steps_count?: number;
                    checksum?: string;
                    finished_at?: string | null;
                    id?: string;
                    logs?: string | null;
                    migration_name?: string;
                    rolled_back_at?: string | null;
                    started_at?: string;
                };
                Relationships: [];
            };
            AnalyticsRecord: {
                Row: {
                    created_at: string;
                    docs_org: string | null;
                    docs_site: string | null;
                    end_date: string | null;
                    id: number;
                    pages_404: Json | null;
                    start_date: string | null;
                    top_api_explorer: Json | null;
                    top_channels: Json | null;
                    top_countries: Json | null;
                    top_device_types: Json | null;
                    top_llm_bot_traffic: Json | null;
                    top_llm_txts: Json | null;
                    top_paths: Json | null;
                    top_referring_domains: Json | null;
                    total_views: number | null;
                    total_visitors: number | null;
                    view_chart: Json | null;
                    visitor_chart: Json | null;
                };
                Insert: {
                    created_at?: string;
                    docs_org?: string | null;
                    docs_site?: string | null;
                    end_date?: string | null;
                    id?: number;
                    pages_404?: Json | null;
                    start_date?: string | null;
                    top_api_explorer?: Json | null;
                    top_channels?: Json | null;
                    top_countries?: Json | null;
                    top_device_types?: Json | null;
                    top_llm_bot_traffic?: Json | null;
                    top_llm_txts?: Json | null;
                    top_paths?: Json | null;
                    top_referring_domains?: Json | null;
                    total_views?: number | null;
                    total_visitors?: number | null;
                    view_chart?: Json | null;
                    visitor_chart?: Json | null;
                };
                Update: {
                    created_at?: string;
                    docs_org?: string | null;
                    docs_site?: string | null;
                    end_date?: string | null;
                    id?: number;
                    pages_404?: Json | null;
                    start_date?: string | null;
                    top_api_explorer?: Json | null;
                    top_channels?: Json | null;
                    top_countries?: Json | null;
                    top_device_types?: Json | null;
                    top_llm_bot_traffic?: Json | null;
                    top_llm_txts?: Json | null;
                    top_paths?: Json | null;
                    top_referring_domains?: Json | null;
                    total_views?: number | null;
                    total_visitors?: number | null;
                    view_chart?: Json | null;
                    visitor_chart?: Json | null;
                };
                Relationships: [];
            };
            billing_product: {
                Row: {
                    created_at: string;
                    display_name: string;
                    id: string;
                    is_active: boolean;
                    kind: string;
                    sku: string;
                    tier: string | null;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    display_name: string;
                    id?: string;
                    is_active?: boolean;
                    kind: string;
                    sku: string;
                    tier?: string | null;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    display_name?: string;
                    id?: string;
                    is_active?: boolean;
                    kind?: string;
                    sku?: string;
                    tier?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            CustomDomainVerification: {
                Row: {
                    createdAt: string;
                    dnsConfigured: boolean;
                    docsUrl: string;
                    domain: string;
                    expiresAt: string;
                    id: string;
                    orgId: string;
                    ownershipVerified: boolean;
                    prUrl: string | null;
                    status: string;
                    updatedAt: string;
                    vercelDomainId: string | null;
                    verificationValue: string;
                    verifiedAt: string | null;
                };
                Insert: {
                    createdAt?: string;
                    dnsConfigured?: boolean;
                    docsUrl: string;
                    domain: string;
                    expiresAt: string;
                    id?: string;
                    orgId: string;
                    ownershipVerified?: boolean;
                    prUrl?: string | null;
                    status?: string;
                    updatedAt?: string;
                    vercelDomainId?: string | null;
                    verificationValue: string;
                    verifiedAt?: string | null;
                };
                Update: {
                    createdAt?: string;
                    dnsConfigured?: boolean;
                    docsUrl?: string;
                    domain?: string;
                    expiresAt?: string;
                    id?: string;
                    orgId?: string;
                    ownershipVerified?: boolean;
                    prUrl?: string | null;
                    status?: string;
                    updatedAt?: string;
                    vercelDomainId?: string | null;
                    verificationValue?: string;
                    verifiedAt?: string | null;
                };
                Relationships: [];
            };
            deprecated_payment_metadata: {
                Row: {
                    created_at: string;
                    id: string;
                    org_id: string;
                    stripe_customer_id: string;
                    subscription_end_date: string | null;
                    subscription_id: string | null;
                    subscription_start_date: string | null;
                    subscription_status: string | null;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    org_id: string;
                    stripe_customer_id: string;
                    subscription_end_date?: string | null;
                    subscription_id?: string | null;
                    subscription_start_date?: string | null;
                    subscription_status?: string | null;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    org_id?: string;
                    stripe_customer_id?: string;
                    subscription_end_date?: string | null;
                    subscription_id?: string | null;
                    subscription_start_date?: string | null;
                    subscription_status?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            deprecated_PaymentMetadata: {
                Row: {
                    created_at: string;
                    id: string;
                    org_id: string;
                    pricing_tier: string;
                    product_ids: string[] | null;
                    stripe_customer_id: string;
                    subscription_end_date: string | null;
                    subscription_id: string | null;
                    subscription_start_date: string | null;
                    subscription_status: string | null;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    org_id: string;
                    pricing_tier?: string;
                    product_ids?: string[] | null;
                    stripe_customer_id: string;
                    subscription_end_date?: string | null;
                    subscription_id?: string | null;
                    subscription_start_date?: string | null;
                    subscription_status?: string | null;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    org_id?: string;
                    pricing_tier?: string;
                    product_ids?: string[] | null;
                    stripe_customer_id?: string;
                    subscription_end_date?: string | null;
                    subscription_id?: string | null;
                    subscription_start_date?: string | null;
                    subscription_status?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            deprecated_product_ownership: {
                Row: {
                    created_at: string;
                    id: string;
                    org_id: string;
                    product_registry_id: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    org_id: string;
                    product_registry_id: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    org_id?: string;
                    product_registry_id?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "product_ownership_product_registry_id_fkey";
                        columns: ["product_registry_id"];
                        isOneToOne: false;
                        referencedRelation: "deprecated_product_registry";
                        referencedColumns: ["id"];
                    }
                ];
            };
            deprecated_product_registry: {
                Row: {
                    created_at: string;
                    display_name: string;
                    id: string;
                    tier: string | null;
                    type: string | null;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    display_name: string;
                    id?: string;
                    tier?: string | null;
                    type?: string | null;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    display_name?: string;
                    id?: string;
                    tier?: string | null;
                    type?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            DocsInstance: {
                Row: {
                    createdAt: string;
                    id: string;
                    orgId: string;
                    updatedAt: string | null;
                    url: string;
                };
                Insert: {
                    createdAt?: string;
                    id: string;
                    orgId: string;
                    updatedAt?: string | null;
                    url: string;
                };
                Update: {
                    createdAt?: string;
                    id?: string;
                    orgId?: string;
                    updatedAt?: string | null;
                    url?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "DocsInstance_orgId_fkey";
                        columns: ["orgId"];
                        isOneToOne: false;
                        referencedRelation: "Organization";
                        referencedColumns: ["orgId"];
                    }
                ];
            };
            Feedback: {
                Row: {
                    browser: string | null;
                    comment: string | null;
                    deviceType: string | null;
                    docsInstanceId: string | null;
                    email: string | null;
                    eventId: string | null;
                    id: number;
                    isHelpful: boolean;
                    location: string | null;
                    pageUrl: string;
                    selection: string | null;
                    sessionId: string | null;
                    submittedAt: string | null;
                    votedAt: string;
                };
                Insert: {
                    browser?: string | null;
                    comment?: string | null;
                    deviceType?: string | null;
                    docsInstanceId?: string | null;
                    email?: string | null;
                    eventId?: string | null;
                    id?: number;
                    isHelpful: boolean;
                    location?: string | null;
                    pageUrl: string;
                    selection?: string | null;
                    sessionId?: string | null;
                    submittedAt?: string | null;
                    votedAt?: string;
                };
                Update: {
                    browser?: string | null;
                    comment?: string | null;
                    deviceType?: string | null;
                    docsInstanceId?: string | null;
                    email?: string | null;
                    eventId?: string | null;
                    id?: number;
                    isHelpful?: boolean;
                    location?: string | null;
                    pageUrl?: string;
                    selection?: string | null;
                    sessionId?: string | null;
                    submittedAt?: string | null;
                    votedAt?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "Feedback_docsInstanceId_fkey";
                        columns: ["docsInstanceId"];
                        isOneToOne: false;
                        referencedRelation: "DocsInstance";
                        referencedColumns: ["id"];
                    }
                ];
            };
            OidcGroupMappings: {
                Row: {
                    connection_name: string;
                    created_at: string;
                    created_by: string | null;
                    group_id: string;
                    id: string;
                    mapping_type: Database["public"]["Enums"]["oidc_mapping_type"];
                    org_id: string;
                    resource_id: string | null;
                    resource_type: string | null;
                    role: Database["public"]["Enums"]["oidc_role"];
                    updated_at: string;
                };
                Insert: {
                    connection_name: string;
                    created_at?: string;
                    created_by?: string | null;
                    group_id: string;
                    id?: string;
                    mapping_type: Database["public"]["Enums"]["oidc_mapping_type"];
                    org_id: string;
                    resource_id?: string | null;
                    resource_type?: string | null;
                    role: Database["public"]["Enums"]["oidc_role"];
                    updated_at?: string;
                };
                Update: {
                    connection_name?: string;
                    created_at?: string;
                    created_by?: string | null;
                    group_id?: string;
                    id?: string;
                    mapping_type?: Database["public"]["Enums"]["oidc_mapping_type"];
                    org_id?: string;
                    resource_id?: string | null;
                    resource_type?: string | null;
                    role?: Database["public"]["Enums"]["oidc_role"];
                    updated_at?: string;
                };
                Relationships: [];
            };
            org_activity_log: {
                Row: {
                    created_at: string;
                    expires_at: string | null;
                    id: string;
                    metadata: Json;
                    org_id: string;
                    site: string;
                    type: string;
                };
                Insert: {
                    created_at?: string;
                    expires_at?: string | null;
                    id?: string;
                    metadata?: Json;
                    org_id: string;
                    site: string;
                    type: string;
                };
                Update: {
                    created_at?: string;
                    expires_at?: string | null;
                    id?: string;
                    metadata?: Json;
                    org_id?: string;
                    site?: string;
                    type?: string;
                };
                Relationships: [];
            };
            org_billing_account: {
                Row: {
                    created_at: string;
                    org_id: string;
                    stripe_customer_id: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    org_id: string;
                    stripe_customer_id: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    org_id?: string;
                    stripe_customer_id?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            org_entitlement_usage: {
                Row: {
                    key: string;
                    org_id: string;
                    updated_at: string;
                    usage_count: number;
                };
                Insert: {
                    key: string;
                    org_id: string;
                    updated_at?: string;
                    usage_count?: number;
                };
                Update: {
                    key?: string;
                    org_id?: string;
                    updated_at?: string;
                    usage_count?: number;
                };
                Relationships: [];
            };
            org_fern_credit_usage: {
                Row: {
                    created_at: string;
                    credits_used: number;
                    event_id: string | null;
                    id: string;
                    org_id: string;
                    site: string;
                };
                Insert: {
                    created_at?: string;
                    credits_used: number;
                    event_id?: string | null;
                    id?: string;
                    org_id: string;
                    site: string;
                };
                Update: {
                    created_at?: string;
                    credits_used?: number;
                    event_id?: string | null;
                    id?: string;
                    org_id?: string;
                    site?: string;
                };
                Relationships: [];
            };
            org_subscription: {
                Row: {
                    created_at: string;
                    current_period_end: string | null;
                    current_period_start: string | null;
                    id: string;
                    org_id: string;
                    status: string;
                    stripe_subscription_id: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    current_period_end?: string | null;
                    current_period_start?: string | null;
                    id?: string;
                    org_id: string;
                    status: string;
                    stripe_subscription_id: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    current_period_end?: string | null;
                    current_period_start?: string | null;
                    id?: string;
                    org_id?: string;
                    status?: string;
                    stripe_subscription_id?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "org_subscription_org_id_fkey";
                        columns: ["org_id"];
                        isOneToOne: false;
                        referencedRelation: "org_billing_account";
                        referencedColumns: ["org_id"];
                    }
                ];
            };
            org_subscription_item: {
                Row: {
                    created_at: string;
                    id: string;
                    org_billing_product: string;
                    org_subscription_id: string;
                    quantity: number;
                    stripe_subscription_item_id: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    org_billing_product: string;
                    org_subscription_id: string;
                    quantity?: number;
                    stripe_subscription_item_id: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    org_billing_product?: string;
                    org_subscription_id?: string;
                    quantity?: number;
                    stripe_subscription_item_id?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "org_subscription_item_org_billing_product_fkey";
                        columns: ["org_billing_product"];
                        isOneToOne: false;
                        referencedRelation: "billing_product";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "org_subscription_item_org_billing_product_fkey";
                        columns: ["org_billing_product"];
                        isOneToOne: false;
                        referencedRelation: "org_active_products";
                        referencedColumns: ["billing_product_id"];
                    },
                    {
                        foreignKeyName: "org_subscription_item_org_subscription_id_fkey";
                        columns: ["org_subscription_id"];
                        isOneToOne: false;
                        referencedRelation: "org_active_products";
                        referencedColumns: ["subscription_id"];
                    },
                    {
                        foreignKeyName: "org_subscription_item_org_subscription_id_fkey";
                        columns: ["org_subscription_id"];
                        isOneToOne: false;
                        referencedRelation: "org_subscription";
                        referencedColumns: ["id"];
                    }
                ];
            };
            Organization: {
                Row: {
                    orgId: string;
                };
                Insert: {
                    orgId: string;
                };
                Update: {
                    orgId?: string;
                };
                Relationships: [];
            };
            postman_app_installations: {
                Row: {
                    app_installation_id: string;
                    created_at: string;
                    shared_secret: string;
                    team_id: string;
                    updated_at: string;
                };
                Insert: {
                    app_installation_id: string;
                    created_at?: string;
                    shared_secret: string;
                    team_id: string;
                    updated_at?: string;
                };
                Update: {
                    app_installation_id?: string;
                    created_at?: string;
                    shared_secret?: string;
                    team_id?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            postman_collection_openapi_specs: {
                Row: {
                    collection_id: string;
                    created_at: string;
                    id: string;
                    openapi_spec: Json;
                    team_id: string;
                    user_id: string;
                };
                Insert: {
                    collection_id: string;
                    created_at?: string;
                    id?: string;
                    openapi_spec: Json;
                    team_id: string;
                    user_id: string;
                };
                Update: {
                    collection_id?: string;
                    created_at?: string;
                    id?: string;
                    openapi_spec?: Json;
                    team_id?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
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
            stripe_event_inbox: {
                Row: {
                    created_at: string;
                    payload: Json;
                    processed_at: string | null;
                    processing_error: string | null;
                    stripe_event_id: string;
                    type: string;
                };
                Insert: {
                    created_at: string;
                    payload: Json;
                    processed_at?: string | null;
                    processing_error?: string | null;
                    stripe_event_id: string;
                    type: string;
                };
                Update: {
                    created_at?: string;
                    payload?: Json;
                    processed_at?: string | null;
                    processing_error?: string | null;
                    stripe_event_id?: string;
                    type?: string;
                };
                Relationships: [];
            };
            User: {
                Row: {
                    createdAt: string;
                    email: string;
                    githubUsername: string | null;
                    isAdmin: boolean;
                    userId: string;
                };
                Insert: {
                    createdAt?: string;
                    email: string;
                    githubUsername?: string | null;
                    isAdmin?: boolean;
                    userId: string;
                };
                Update: {
                    createdAt?: string;
                    email?: string;
                    githubUsername?: string | null;
                    isAdmin?: boolean;
                    userId?: string;
                };
                Relationships: [];
            };
            UserOrganization: {
                Row: {
                    orgId: string;
                    userId: string;
                };
                Insert: {
                    orgId: string;
                    userId: string;
                };
                Update: {
                    orgId?: string;
                    userId?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "UserOrganization_orgId_fkey";
                        columns: ["orgId"];
                        isOneToOne: false;
                        referencedRelation: "Organization";
                        referencedColumns: ["orgId"];
                    },
                    {
                        foreignKeyName: "UserOrganization_userId_fkey";
                        columns: ["userId"];
                        isOneToOne: false;
                        referencedRelation: "User";
                        referencedColumns: ["userId"];
                    }
                ];
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
        };
        Views: {
            org_active_products: {
                Row: {
                    billing_product_id: string | null;
                    kind: string | null;
                    org_id: string | null;
                    qty: number | null;
                    sku: string | null;
                    status: string | null;
                    subscription_id: string | null;
                    tier: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "org_subscription_org_id_fkey";
                        columns: ["org_id"];
                        isOneToOne: false;
                        referencedRelation: "org_billing_account";
                        referencedColumns: ["org_id"];
                    }
                ];
            };
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            oidc_mapping_type: "org_role" | "resource_role";
            oidc_role: "admin" | "editor" | "viewer";
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
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never
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
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
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
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
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
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    graphql_public: {
        Enums: {}
    },
    public: {
        Enums: {
            oidc_mapping_type: ["org_role", "resource_role"],
            oidc_role: ["admin", "editor", "viewer"]
        }
    }
} as const;
