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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_runs: {
        Row: {
          attempts: number
          created_at: string
          error_code: string | null
          goal_id: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          module: Database["public"]["Enums"]["ai_module"]
          output_tokens: number | null
          prompt_version: string
          provider: string
          status: string
          used_byok: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          goal_id?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          module: Database["public"]["Enums"]["ai_module"]
          output_tokens?: number | null
          prompt_version: string
          provider: string
          status: string
          used_byok?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          goal_id?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          module?: Database["public"]["Enums"]["ai_module"]
          output_tokens?: number | null
          prompt_version?: string
          provider?: string
          status?: string
          used_byok?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_profiles: {
        Row: {
          blackout_dates: string[]
          created_at: string
          days_per_week: number
          effective_from: string
          goal_id: string
          id: string
          ideal_minutes: number
          minimum_minutes: number
          normal_minutes: number
          note: string | null
          preferred_days: number[]
          user_id: string
        }
        Insert: {
          blackout_dates?: string[]
          created_at?: string
          days_per_week: number
          effective_from: string
          goal_id: string
          id?: string
          ideal_minutes: number
          minimum_minutes: number
          normal_minutes: number
          note?: string | null
          preferred_days?: number[]
          user_id: string
        }
        Update: {
          blackout_dates?: string[]
          created_at?: string
          days_per_week?: number
          effective_from?: string
          goal_id?: string
          id?: string
          ideal_minutes?: number
          minimum_minutes?: number
          normal_minutes?: number
          note?: string | null
          preferred_days?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_profiles_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          energy: number | null
          goal_id: string
          id: string
          kind: Database["public"]["Enums"]["checkin_kind"]
          minutes_available: number | null
          minutes_spent: number | null
          note: string | null
          occurred_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number | null
          goal_id: string
          id?: string
          kind: Database["public"]["Enums"]["checkin_kind"]
          minutes_available?: number | null
          minutes_spent?: number | null
          note?: string | null
          occurred_on: string
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number | null
          goal_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["checkin_kind"]
          minutes_available?: number | null
          minutes_spent?: number | null
          note?: string | null
          occurred_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      constraints: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          is_hard: boolean
          kind: Database["public"]["Enums"]["constraint_kind"]
          label: string
          user_id: string
          value_date: string | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          is_hard?: boolean
          kind: Database["public"]["Enums"]["constraint_kind"]
          label: string
          user_id: string
          value_date?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          is_hard?: boolean
          kind?: Database["public"]["Enums"]["constraint_kind"]
          label?: string
          user_id?: string
          value_date?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "constraints_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          body: string | null
          created_at: string
          goal_id: string
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          node_id: string | null
          storage_path: string | null
          task_id: string | null
          url: string | null
          user_id: string
          weekly_outcome_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          goal_id: string
          id?: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          node_id?: string | null
          storage_path?: string | null
          task_id?: string | null
          url?: string | null
          user_id: string
          weekly_outcome_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          node_id?: string | null
          storage_path?: string | null
          task_id?: string | null
          url?: string | null
          user_id?: string
          weekly_outcome_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "goal_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_weekly_outcome_id_fkey"
            columns: ["weekly_outcome_id"]
            isOneToOne: false
            referencedRelation: "weekly_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      feasibility_assessments: {
        Row: {
          alternative: Json | null
          comparable_basis: string | null
          confidence: number
          created_at: string
          goal_id: string
          id: string
          key_risks: Json
          rationale: string
          user_id: string
          verdict: Database["public"]["Enums"]["feasibility_verdict"]
        }
        Insert: {
          alternative?: Json | null
          comparable_basis?: string | null
          confidence: number
          created_at?: string
          goal_id: string
          id?: string
          key_risks?: Json
          rationale: string
          user_id: string
          verdict: Database["public"]["Enums"]["feasibility_verdict"]
        }
        Update: {
          alternative?: Json | null
          comparable_basis?: string | null
          confidence?: number
          created_at?: string
          goal_id?: string
          id?: string
          key_risks?: Json
          rationale?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["feasibility_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "feasibility_assessments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_intake: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          goal_id: string
          motivation: string | null
          questions: Json
          starting_point: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          goal_id: string
          motivation?: string | null
          questions?: Json
          starting_point?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          goal_id?: string
          motivation?: string | null
          questions?: Json
          starting_point?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_intake_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: true
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_nodes: {
        Row: {
          completed_at: string | null
          created_at: string
          estimated_minutes: number | null
          goal_id: string
          health: Database["public"]["Enums"]["node_health"]
          id: string
          kind: Database["public"]["Enums"]["node_kind"]
          parent_id: string | null
          sequence: number
          status: Database["public"]["Enums"]["node_status"]
          summary: string | null
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
          verification: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          estimated_minutes?: number | null
          goal_id: string
          health?: Database["public"]["Enums"]["node_health"]
          id?: string
          kind: Database["public"]["Enums"]["node_kind"]
          parent_id?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["node_status"]
          summary?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
          verification: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          estimated_minutes?: number | null
          goal_id?: string
          health?: Database["public"]["Enums"]["node_health"]
          id?: string
          kind?: Database["public"]["Enums"]["node_kind"]
          parent_id?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["node_status"]
          summary?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_nodes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "goal_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_signals: {
        Row: {
          captured_on: string
          created_at: string
          execution_rate: number | null
          explanation: Json
          goal_id: string
          id: string
          inputs: Json
          momentum: number | null
          plan_confidence: number | null
          projected_completion_date: string | null
          risk_level: Database["public"]["Enums"]["node_health"]
          user_id: string
        }
        Insert: {
          captured_on: string
          created_at?: string
          execution_rate?: number | null
          explanation: Json
          goal_id: string
          id?: string
          inputs: Json
          momentum?: number | null
          plan_confidence?: number | null
          projected_completion_date?: string | null
          risk_level?: Database["public"]["Enums"]["node_health"]
          user_id: string
        }
        Update: {
          captured_on?: string
          created_at?: string
          execution_rate?: number | null
          explanation?: Json
          goal_id?: string
          id?: string
          inputs?: Json
          momentum?: number | null
          plan_confidence?: number | null
          projected_completion_date?: string | null
          risk_level?: Database["public"]["Enums"]["node_health"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_signals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          created_at: string
          domain: string | null
          horizon_weeks: number | null
          id: string
          outcome_statement: string
          raw_input: string
          started_on: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          domain?: string | null
          horizon_weeks?: number | null
          id?: string
          outcome_statement: string
          raw_input: string
          started_on?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          domain?: string | null
          horizon_weeks?: number | null
          id?: string
          outcome_statement?: string
          raw_input?: string
          started_on?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      node_dependencies: {
        Row: {
          created_at: string
          from_node_id: string
          goal_id: string
          id: string
          rationale: string | null
          to_node_id: string
          type: Database["public"]["Enums"]["dependency_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          from_node_id: string
          goal_id: string
          id?: string
          rationale?: string | null
          to_node_id: string
          type?: Database["public"]["Enums"]["dependency_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          from_node_id?: string
          goal_id?: string
          id?: string
          rationale?: string | null
          to_node_id?: string
          type?: Database["public"]["Enums"]["dependency_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_dependencies_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "goal_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_dependencies_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_dependencies_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "goal_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_weeks: {
        Row: {
          capacity_minutes: number
          ends_on: string
          goal_id: string
          id: string
          plan_id: string
          starts_on: string
          theme: string | null
          user_id: string
          week_index: number
        }
        Insert: {
          capacity_minutes: number
          ends_on: string
          goal_id: string
          id?: string
          plan_id: string
          starts_on: string
          theme?: string | null
          user_id: string
          week_index: number
        }
        Update: {
          capacity_minutes?: number
          ends_on?: string
          goal_id?: string
          id?: string
          plan_id?: string
          starts_on?: string
          theme?: string | null
          user_id?: string
          week_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_weeks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_weeks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          activated_at: string | null
          generated_at: string
          goal_id: string
          horizon_end: string
          horizon_start: string
          id: string
          rationale: string | null
          source: Database["public"]["Enums"]["plan_source"]
          status: Database["public"]["Enums"]["plan_status"]
          supersedes_id: string | null
          user_id: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          generated_at?: string
          goal_id: string
          horizon_end: string
          horizon_start: string
          id?: string
          rationale?: string | null
          source: Database["public"]["Enums"]["plan_source"]
          status?: Database["public"]["Enums"]["plan_status"]
          supersedes_id?: string | null
          user_id: string
          version: number
        }
        Update: {
          activated_at?: string | null
          generated_at?: string
          goal_id?: string
          horizon_end?: string
          horizon_start?: string
          id?: string
          rationale?: string | null
          source?: Database["public"]["Enums"]["plan_source"]
          status?: Database["public"]["Enums"]["plan_status"]
          supersedes_id?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          tier: Database["public"]["Enums"]["user_tier"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          tier?: Database["public"]["Enums"]["user_tier"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reflections: {
        Row: {
          ai_synthesis: Json | null
          blockers: string | null
          created_at: string
          goal_id: string
          id: string
          plan_week_id: string | null
          user_id: string
          what_didnt: string | null
          what_worked: string | null
        }
        Insert: {
          ai_synthesis?: Json | null
          blockers?: string | null
          created_at?: string
          goal_id: string
          id?: string
          plan_week_id?: string | null
          user_id: string
          what_didnt?: string | null
          what_worked?: string | null
        }
        Update: {
          ai_synthesis?: Json | null
          blockers?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          plan_week_id?: string | null
          user_id?: string
          what_didnt?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reflections_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reflections_plan_week_id_fkey"
            columns: ["plan_week_id"]
            isOneToOne: false
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      replan_events: {
        Row: {
          accepted: boolean | null
          created_at: string
          diagnosis: string
          from_plan_id: string | null
          goal_id: string
          id: string
          patch: Json
          responded_at: string | null
          to_plan_id: string | null
          trigger: Database["public"]["Enums"]["replan_trigger"]
          trigger_detail: Json
          user_id: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          diagnosis: string
          from_plan_id?: string | null
          goal_id: string
          id?: string
          patch: Json
          responded_at?: string | null
          to_plan_id?: string | null
          trigger: Database["public"]["Enums"]["replan_trigger"]
          trigger_detail?: Json
          user_id: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          diagnosis?: string
          from_plan_id?: string | null
          goal_id?: string
          id?: string
          patch?: Json
          responded_at?: string | null
          to_plan_id?: string | null
          trigger?: Database["public"]["Enums"]["replan_trigger"]
          trigger_detail?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replan_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replan_events_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replan_events_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          blocked_by_task_id: string | null
          completed_at: string | null
          created_at: string
          effort_minutes: number
          goal_id: string
          id: string
          is_user_added: boolean
          plan_week_id: string
          project_node_id: string | null
          scheduled_for: string | null
          sequence: number
          status: Database["public"]["Enums"]["task_status"]
          tier: Database["public"]["Enums"]["task_tier"]
          title: string
          user_id: string
          weekly_outcome_id: string | null
          why: string | null
        }
        Insert: {
          blocked_by_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          effort_minutes: number
          goal_id: string
          id?: string
          is_user_added?: boolean
          plan_week_id: string
          project_node_id?: string | null
          scheduled_for?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["task_status"]
          tier?: Database["public"]["Enums"]["task_tier"]
          title: string
          user_id: string
          weekly_outcome_id?: string | null
          why?: string | null
        }
        Update: {
          blocked_by_task_id?: string | null
          completed_at?: string | null
          created_at?: string
          effort_minutes?: number
          goal_id?: string
          id?: string
          is_user_added?: boolean
          plan_week_id?: string
          project_node_id?: string | null
          scheduled_for?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["task_status"]
          tier?: Database["public"]["Enums"]["task_tier"]
          title?: string
          user_id?: string
          weekly_outcome_id?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_blocked_by_task_id_fkey"
            columns: ["blocked_by_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_plan_week_id_fkey"
            columns: ["plan_week_id"]
            isOneToOne: false
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_node_id_fkey"
            columns: ["project_node_id"]
            isOneToOne: false
            referencedRelation: "goal_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_weekly_outcome_id_fkey"
            columns: ["weekly_outcome_id"]
            isOneToOne: false
            referencedRelation: "weekly_outcomes"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          module_class: string
          period_start: string
          user_id: string
        }
        Insert: {
          count?: number
          module_class: string
          period_start: string
          user_id: string
        }
        Update: {
          count?: number
          module_class?: string
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credentials: {
        Row: {
          auth_tag: string
          ciphertext: string
          created_at: string
          id: string
          iv: string
          key_hint: string
          last_verified_at: string | null
          provider: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          ciphertext: string
          created_at?: string
          id?: string
          iv: string
          key_hint: string
          last_verified_at?: string | null
          provider: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          ciphertext?: string
          created_at?: string
          id?: string
          iv?: string
          key_hint?: string
          last_verified_at?: string | null
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_outcomes: {
        Row: {
          completed_at: string | null
          goal_id: string
          id: string
          plan_week_id: string
          priority: number
          project_node_id: string | null
          statement: string
          status: Database["public"]["Enums"]["node_status"]
          success_criteria: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          goal_id: string
          id?: string
          plan_week_id: string
          priority?: number
          project_node_id?: string | null
          statement: string
          status?: Database["public"]["Enums"]["node_status"]
          success_criteria: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          goal_id?: string
          id?: string
          plan_week_id?: string
          priority?: number
          project_node_id?: string | null
          statement?: string
          status?: Database["public"]["Enums"]["node_status"]
          success_criteria?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_outcomes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_outcomes_plan_week_id_fkey"
            columns: ["plan_week_id"]
            isOneToOne: false
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_outcomes_project_node_id_fkey"
            columns: ["project_node_id"]
            isOneToOne: false
            referencedRelation: "goal_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_module:
        | "clarify"
        | "assess"
        | "decompose"
        | "plan_week"
        | "plan_day"
        | "progress"
        | "reflect"
        | "replan"
      checkin_kind: "daily" | "weekly"
      constraint_kind:
        | "time"
        | "money"
        | "hard_date"
        | "commitment"
        | "preference"
        | "prohibition"
      dependency_type: "blocks" | "informs"
      evidence_kind: "link" | "text" | "file" | "self_attest"
      feasibility_verdict:
        | "realistic"
        | "ambitious_but_possible"
        | "unrealistic_as_stated"
      goal_status:
        | "draft"
        | "active"
        | "paused"
        | "achieved"
        | "abandoned"
        | "rescoped"
      node_health: "on_track" | "at_risk" | "off_track" | "unknown"
      node_kind: "milestone" | "project"
      node_status:
        | "not_started"
        | "in_progress"
        | "blocked"
        | "complete"
        | "dropped"
      plan_source: "initial" | "replan" | "manual"
      plan_status: "generating" | "draft" | "active" | "superseded" | "failed"
      replan_trigger:
        | "user_requested"
        | "low_execution"
        | "milestone_off_track"
        | "capacity_changed"
        | "ahead_of_schedule"
        | "missed_checkins"
        | "priority_change"
        | "dependency_change"
      task_status: "pending" | "done" | "skipped" | "deferred" | "dropped"
      task_tier: "minimum" | "normal" | "ideal"
      user_tier: "free" | "byok"
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
      ai_module: [
        "clarify",
        "assess",
        "decompose",
        "plan_week",
        "plan_day",
        "progress",
        "reflect",
        "replan",
      ],
      checkin_kind: ["daily", "weekly"],
      constraint_kind: [
        "time",
        "money",
        "hard_date",
        "commitment",
        "preference",
        "prohibition",
      ],
      dependency_type: ["blocks", "informs"],
      evidence_kind: ["link", "text", "file", "self_attest"],
      feasibility_verdict: [
        "realistic",
        "ambitious_but_possible",
        "unrealistic_as_stated",
      ],
      goal_status: [
        "draft",
        "active",
        "paused",
        "achieved",
        "abandoned",
        "rescoped",
      ],
      node_health: ["on_track", "at_risk", "off_track", "unknown"],
      node_kind: ["milestone", "project"],
      node_status: [
        "not_started",
        "in_progress",
        "blocked",
        "complete",
        "dropped",
      ],
      plan_source: ["initial", "replan", "manual"],
      plan_status: ["generating", "draft", "active", "superseded", "failed"],
      replan_trigger: [
        "user_requested",
        "low_execution",
        "milestone_off_track",
        "capacity_changed",
        "ahead_of_schedule",
        "missed_checkins",
        "priority_change",
        "dependency_change",
      ],
      task_status: ["pending", "done", "skipped", "deferred", "dropped"],
      task_tier: ["minimum", "normal", "ideal"],
      user_tier: ["free", "byok"],
    },
  },
} as const
