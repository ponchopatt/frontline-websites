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
      bible_entries: {
        Row: {
          application: string | null
          application_done: boolean
          created_at: string
          id: string
          local_date: string
          obey_today: string | null
          observation: string | null
          prayer: string | null
          prayer_done: boolean
          reading_id: string
          scripture_notes: string | null
          soap_done: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          application?: string | null
          application_done?: boolean
          created_at?: string
          id?: string
          local_date: string
          obey_today?: string | null
          observation?: string | null
          prayer?: string | null
          prayer_done?: boolean
          reading_id: string
          scripture_notes?: string | null
          soap_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          application?: string | null
          application_done?: boolean
          created_at?: string
          id?: string
          local_date?: string
          obey_today?: string | null
          observation?: string | null
          prayer?: string | null
          prayer_done?: boolean
          reading_id?: string
          scripture_notes?: string | null
          soap_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_entries_reading_id_user_id_fkey"
            columns: ["reading_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bible_readings"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      bible_plans: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bible_readings: {
        Row: {
          book: string
          chapter: number
          created_at: string
          id: string
          is_completed: boolean
          local_date: string
          passage: string | null
          plan_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book: string
          chapter: number
          created_at?: string
          id?: string
          is_completed?: boolean
          local_date: string
          passage?: string | null
          plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          book?: string
          chapter?: number
          created_at?: string
          id?: string
          is_completed?: boolean
          local_date?: string
          passage?: string | null
          plan_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_readings_plan_id_user_id_fkey"
            columns: ["plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bible_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      commitments: {
        Row: {
          created_at: string
          id: string
          local_date: string
          outcome: Database["public"]["Enums"]["commitment_outcome"]
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_date: string
          outcome?: Database["public"]["Enums"]["commitment_outcome"]
          text: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          local_date?: string
          outcome?: Database["public"]["Enums"]["commitment_outcome"]
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_goals: {
        Row: {
          carried_from_id: string | null
          completed_at: string | null
          created_at: string
          estimated_minutes: number | null
          id: string
          local_date: string
          parent_weekly_goal_id: string | null
          quantity: number | null
          rank: number | null
          source: string
          status: Database["public"]["Enums"]["daily_goal_status"]
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          work_block_id: string | null
        }
        Insert: {
          carried_from_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          local_date: string
          parent_weekly_goal_id?: string | null
          quantity?: number | null
          rank?: number | null
          source?: string
          status?: Database["public"]["Enums"]["daily_goal_status"]
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          work_block_id?: string | null
        }
        Update: {
          carried_from_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          local_date?: string
          parent_weekly_goal_id?: string | null
          quantity?: number | null
          rank?: number | null
          source?: string
          status?: Database["public"]["Enums"]["daily_goal_status"]
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          work_block_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_goals_carried_from_id_user_id_fkey"
            columns: ["carried_from_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "daily_goals_parent_weekly_goal_id_user_id_fkey"
            columns: ["parent_weekly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "weekly_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "daily_goals_work_block_id_user_id_fkey"
            columns: ["work_block_id", "user_id"]
            isOneToOne: false
            referencedRelation: "work_blocks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          final_score: number | null
          id: string
          local_date: string
          score_breakdown: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          local_date: string
          score_breakdown?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          local_date?: string
          score_breakdown?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_priorities: {
        Row: {
          completed_at: string | null
          created_at: string
          daily_goal_id: string | null
          description: string | null
          id: string
          local_date: string
          position: number
          status: Database["public"]["Enums"]["priority_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          daily_goal_id?: string | null
          description?: string | null
          id?: string
          local_date: string
          position: number
          status?: Database["public"]["Enums"]["priority_status"]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          daily_goal_id?: string | null
          description?: string | null
          id?: string
          local_date?: string
          position?: number
          status?: Database["public"]["Enums"]["priority_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_priorities_daily_goal_fk"
            columns: ["daily_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          accomplished: string | null
          broke_word_where: string | null
          created_at: string
          grateful_for: string | null
          id: string
          local_date: string
          sought_god: string | null
          tomorrow_priority: string | null
          updated_at: string
          user_id: string
          wasted_time_on: string | null
        }
        Insert: {
          accomplished?: string | null
          broke_word_where?: string | null
          created_at?: string
          grateful_for?: string | null
          id?: string
          local_date: string
          sought_god?: string | null
          tomorrow_priority?: string | null
          updated_at?: string
          user_id?: string
          wasted_time_on?: string | null
        }
        Update: {
          accomplished?: string | null
          broke_word_where?: string | null
          created_at?: string
          grateful_for?: string | null
          id?: string
          local_date?: string
          sought_god?: string | null
          tomorrow_priority?: string | null
          updated_at?: string
          user_id?: string
          wasted_time_on?: string | null
        }
        Relationships: []
      }
      goal_dependencies: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          level: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          monthly_goal_id: string | null
          sort_order: number
          title: string
          updated_at: string
          user_id: string
          yearly_goal_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          monthly_goal_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          user_id?: string
          yearly_goal_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          monthly_goal_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          yearly_goal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_monthly_goal_id_user_id_fkey"
            columns: ["monthly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "monthly_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_milestones_yearly_goal_id_user_id_fkey"
            columns: ["yearly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "yearly_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goal_reviews: {
        Row: {
          actual_value: number | null
          created_at: string
          decision: Database["public"]["Enums"]["miss_decision"] | null
          id: string
          monthly_goal_id: string | null
          outcome: Database["public"]["Enums"]["review_outcome"]
          period: string
          period_start: string
          reason: Database["public"]["Enums"]["miss_reason"] | null
          reason_note: string | null
          target_value: number | null
          updated_at: string
          user_id: string
          weekly_goal_id: string | null
          yearly_goal_id: string | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["miss_decision"] | null
          id?: string
          monthly_goal_id?: string | null
          outcome: Database["public"]["Enums"]["review_outcome"]
          period: string
          period_start: string
          reason?: Database["public"]["Enums"]["miss_reason"] | null
          reason_note?: string | null
          target_value?: number | null
          updated_at?: string
          user_id?: string
          weekly_goal_id?: string | null
          yearly_goal_id?: string | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["miss_decision"] | null
          id?: string
          monthly_goal_id?: string | null
          outcome?: Database["public"]["Enums"]["review_outcome"]
          period?: string
          period_start?: string
          reason?: Database["public"]["Enums"]["miss_reason"] | null
          reason_note?: string | null
          target_value?: number | null
          updated_at?: string
          user_id?: string
          weekly_goal_id?: string | null
          yearly_goal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_reviews_monthly_goal_id_user_id_fkey"
            columns: ["monthly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "monthly_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_reviews_weekly_goal_id_user_id_fkey"
            columns: ["weekly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "weekly_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_reviews_yearly_goal_id_user_id_fkey"
            columns: ["yearly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "yearly_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goal_suggestions: {
        Row: {
          created_at: string
          id: string
          level: string
          payload: Json
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          payload: Json
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          payload?: Json
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          content: string | null
          created_at: string
          id: string
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completed_at: string
          edited_at: string | null
          habit_id: string
          id: string
          local_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          edited_at?: string | null
          habit_id: string
          id?: string
          local_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          edited_at?: string | null
          habit_id?: string
          id?: string
          local_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          category: Database["public"]["Enums"]["habit_category"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category: Database["public"]["Enums"]["habit_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["habit_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      life_areas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_goals: {
        Row: {
          aggregation: Database["public"]["Enums"]["goal_aggregation"]
          cadence: Database["public"]["Enums"]["goal_cadence"]
          completed_at: string | null
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          habit_id: string | null
          id: string
          life_area_id: string | null
          metric: string | null
          month_start: string
          parent_quarterly_goal_id: string | null
          parent_yearly_goal_id: string | null
          priority: number
          progress_source: Database["public"]["Enums"]["progress_source"]
          sort_order: number
          start_value: number | null
          state: Database["public"]["Enums"]["goal_state"]
          success: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          life_area_id?: string | null
          metric?: string | null
          month_start: string
          parent_quarterly_goal_id?: string | null
          parent_yearly_goal_id?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          life_area_id?: string | null
          metric?: string | null
          month_start?: string
          parent_quarterly_goal_id?: string | null
          parent_yearly_goal_id?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "monthly_goals_life_area_id_user_id_fkey"
            columns: ["life_area_id", "user_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "monthly_goals_parent_quarterly_goal_id_user_id_fkey"
            columns: ["parent_quarterly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quarterly_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "monthly_goals_parent_yearly_goal_id_user_id_fkey"
            columns: ["parent_yearly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "yearly_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          best_streak: number
          created_at: string
          day_start_hour: number
          display_name: string | null
          streak_threshold: number
          timezone: string
          updated_at: string
          user_id: string
          work_target_hours: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          day_start_hour?: number
          display_name?: string | null
          streak_threshold?: number
          timezone?: string
          updated_at?: string
          user_id: string
          work_target_hours?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          day_start_hour?: number
          display_name?: string | null
          streak_threshold?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          work_target_hours?: number
        }
        Relationships: []
      }
      proof_uploads: {
        Row: {
          category: Database["public"]["Enums"]["habit_category"] | null
          habit_id: string | null
          id: string
          local_date: string
          note: string | null
          storage_path: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["habit_category"] | null
          habit_id?: string | null
          id?: string
          local_date: string
          note?: string | null
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["habit_category"] | null
          habit_id?: string | null
          id?: string
          local_date?: string
          note?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_uploads_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quarterly_goals: {
        Row: {
          aggregation: Database["public"]["Enums"]["goal_aggregation"]
          cadence: Database["public"]["Enums"]["goal_cadence"]
          completed_at: string | null
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          habit_id: string | null
          id: string
          life_area_id: string | null
          metric: string | null
          parent_yearly_goal_id: string | null
          priority: number
          progress_source: Database["public"]["Enums"]["progress_source"]
          quarter: number
          sort_order: number
          start_value: number | null
          state: Database["public"]["Enums"]["goal_state"]
          success: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          why: string | null
          year: number
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          life_area_id?: string | null
          metric?: string | null
          parent_yearly_goal_id?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          quarter: number
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
          year: number
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          life_area_id?: string | null
          metric?: string | null
          parent_yearly_goal_id?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          quarter?: number
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_goals_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quarterly_goals_life_area_id_user_id_fkey"
            columns: ["life_area_id", "user_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "quarterly_goals_parent_yearly_goal_id_user_id_fkey"
            columns: ["parent_yearly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "yearly_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      weekly_goals: {
        Row: {
          aggregation: Database["public"]["Enums"]["goal_aggregation"]
          cadence: Database["public"]["Enums"]["goal_cadence"]
          carried_from_id: string | null
          completed_at: string | null
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          habit_id: string | null
          id: string
          is_major: boolean
          life_area_id: string | null
          metric: string | null
          parent_monthly_goal_id: string | null
          priority: number
          progress_source: Database["public"]["Enums"]["progress_source"]
          sort_order: number
          start_value: number | null
          state: Database["public"]["Enums"]["goal_state"]
          success: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          week_start: string
          why: string | null
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          carried_from_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          is_major?: boolean
          life_area_id?: string | null
          metric?: string | null
          parent_monthly_goal_id?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          week_start: string
          why?: string | null
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          carried_from_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          is_major?: boolean
          life_area_id?: string | null
          metric?: string | null
          parent_monthly_goal_id?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_goals_carried_from_id_user_id_fkey"
            columns: ["carried_from_id", "user_id"]
            isOneToOne: false
            referencedRelation: "weekly_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "weekly_goals_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "weekly_goals_life_area_id_user_id_fkey"
            columns: ["life_area_id", "user_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "weekly_goals_parent_monthly_goal_id_user_id_fkey"
            columns: ["parent_monthly_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "monthly_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          focus_for_next_week: string | null
          id: string
          lessons: string | null
          updated_at: string
          user_id: string
          week_start_date: string
          wins: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          focus_for_next_week?: string | null
          id?: string
          lessons?: string | null
          updated_at?: string
          user_id?: string
          week_start_date: string
          wins?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          focus_for_next_week?: string | null
          id?: string
          lessons?: string | null
          updated_at?: string
          user_id?: string
          week_start_date?: string
          wins?: string | null
        }
        Relationships: []
      }
      work_blocks: {
        Row: {
          created_at: string
          id: string
          local_date: string
          planned_end: string | null
          planned_start: string | null
          task: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_date: string
          planned_end?: string | null
          planned_start?: string | null
          task: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          local_date?: string
          planned_end?: string | null
          planned_start?: string | null
          task?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          accomplishment_note: string | null
          created_at: string
          ended_at: string | null
          id: string
          local_date: string
          started_at: string
          updated_at: string
          user_id: string
          work_block_id: string | null
        }
        Insert: {
          accomplishment_note?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          local_date: string
          started_at?: string
          updated_at?: string
          user_id?: string
          work_block_id?: string | null
        }
        Update: {
          accomplishment_note?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          local_date?: string
          started_at?: string
          updated_at?: string
          user_id?: string
          work_block_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_work_block_id_user_id_fkey"
            columns: ["work_block_id", "user_id"]
            isOneToOne: false
            referencedRelation: "work_blocks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      yearly_goals: {
        Row: {
          aggregation: Database["public"]["Enums"]["goal_aggregation"]
          cadence: Database["public"]["Enums"]["goal_cadence"]
          completed_at: string | null
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          habit_id: string | null
          id: string
          life_area_id: string | null
          metric: string | null
          priority: number
          progress_source: Database["public"]["Enums"]["progress_source"]
          sort_order: number
          start_value: number | null
          state: Database["public"]["Enums"]["goal_state"]
          success: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          why: string | null
          year: number
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          life_area_id?: string | null
          metric?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
          year: number
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["goal_aggregation"]
          cadence?: Database["public"]["Enums"]["goal_cadence"]
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          habit_id?: string | null
          id?: string
          life_area_id?: string | null
          metric?: string | null
          priority?: number
          progress_source?: Database["public"]["Enums"]["progress_source"]
          sort_order?: number
          start_value?: number | null
          state?: Database["public"]["Enums"]["goal_state"]
          success?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "yearly_goals_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "yearly_goals_life_area_id_user_id_fkey"
            columns: ["life_area_id", "user_id"]
            isOneToOne: false
            referencedRelation: "life_areas"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_profile_for: {
        Args: { p_email: string; p_meta: Json; p_user: string }
        Returns: undefined
      }
      day_summaries: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bible_done: number
          body_done: number
          body_total: number
          completed_at: string
          discipline_done: number
          discipline_total: number
          final_score: number
          god_done: number
          god_total: number
          local_date: string
          morning_done: number
          morning_total: number
          review_filled: number
          work_minutes: number
        }[]
      }
      ensure_life_areas: { Args: never; Returns: undefined }
      ensure_profile: { Args: never; Returns: undefined }
      is_valid_timezone: { Args: { tz: string }; Returns: boolean }
      local_date_at: {
        Args: { start_hour: number; ts: string; tz: string }
        Returns: string
      }
      seed_default_habits: { Args: { p_user: string }; Returns: undefined }
      seed_life_areas: { Args: { p_user: string }; Returns: undefined }
      user_local_date: { Args: { p_user: string; ts: string }; Returns: string }
      user_local_today: { Args: { p_user: string }; Returns: string }
    }
    Enums: {
      commitment_outcome: "kept" | "broken" | "cancelled" | "pending"
      daily_goal_status: "pending" | "done" | "dropped"
      goal_aggregation: "sum" | "latest"
      goal_cadence: "total" | "per_week" | "per_month"
      goal_state: "draft" | "active" | "completed" | "missed" | "cancelled"
      goal_type:
        | "outcome"
        | "performance"
        | "process"
        | "habit"
        | "milestone"
        | "binary"
      habit_category: "morning" | "body" | "discipline" | "god"
      miss_decision: "carry_forward" | "modify" | "replace" | "cancel"
      miss_reason:
        | "underestimated_time"
        | "too_ambitious"
        | "procrastination"
        | "unexpected_event"
        | "no_longer_matters"
        | "poor_planning"
        | "other"
      priority_status: "pending" | "done" | "dropped"
      progress_source:
        | "manual"
        | "children"
        | "work_hours"
        | "habit"
        | "actions"
        | "milestones"
      review_outcome: "completed" | "partial" | "missed"
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
      commitment_outcome: ["kept", "broken", "cancelled", "pending"],
      daily_goal_status: ["pending", "done", "dropped"],
      goal_aggregation: ["sum", "latest"],
      goal_cadence: ["total", "per_week", "per_month"],
      goal_state: ["draft", "active", "completed", "missed", "cancelled"],
      goal_type: [
        "outcome",
        "performance",
        "process",
        "habit",
        "milestone",
        "binary",
      ],
      habit_category: ["morning", "body", "discipline", "god"],
      miss_decision: ["carry_forward", "modify", "replace", "cancel"],
      miss_reason: [
        "underestimated_time",
        "too_ambitious",
        "procrastination",
        "unexpected_event",
        "no_longer_matters",
        "poor_planning",
        "other",
      ],
      priority_status: ["pending", "done", "dropped"],
      progress_source: [
        "manual",
        "children",
        "work_hours",
        "habit",
        "actions",
        "milestones",
      ],
      review_outcome: ["completed", "partial", "missed"],
    },
  },
} as const

