export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          created_at: string
          name: string | null
          family_notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name?: string | null
          family_notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string | null
          family_notes?: string | null
        }
      }
      users: {
        Row: {
          id: string
          household_id: string | null
          email: string
          password: string | null
          pin: string | null
          name: string
          role: string
          avatar: string | null
          allergies: string[] | null
          preferences: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id?: string | null
          email: string
          password?: string | null
          pin?: string | null
          name: string
          role: string
          avatar?: string | null
          allergies?: string[] | null
          preferences?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          email?: string
          password?: string | null
          pin?: string | null
          name?: string
          role?: string
          avatar?: string | null
          allergies?: string[] | null
          preferences?: string[] | null
          created_at?: string
        }
      }
      shopping: {
        Row: {
          id: string
          household_id: string | null
          name: string
          category: string
          quantity: string
          completed: boolean
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id?: string | null
          name: string
          category: string
          quantity?: string
          completed?: boolean
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          name?: string
          category?: string
          quantity?: string
          completed?: boolean
          added_by?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          household_id: string | null
          title: string
          assignees: string[] | null
          due_date: string
          due_time: string | null
          completed: boolean
          recurrence: Json | null
          created_at: string
          category: string
        }
        Insert: {
          id?: string
          household_id?: string | null
          title: string
          assignees?: string[] | null
          due_date: string
          due_time?: string | null
          completed?: boolean
          recurrence?: Json | null
          created_at?: string
          category?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          title?: string
          assignees?: string[] | null
          due_date?: string
          due_time?: string | null
          completed?: boolean
          recurrence?: Json | null
          created_at?: string
          category?: string
        }
      }
      meals: {
        Row: {
          id: string
          household_id: string | null
          date: string
          type: string
          description: string
          for_user_ids: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id?: string | null
          date: string
          type: string
          description: string
          for_user_ids?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          date?: string
          type?: string
          description?: string
          for_user_ids?: string[] | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          household_id: string | null
          amount: number
          category: string
          merchant: string
          date: string
          receipt_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id?: string | null
          amount: number
          category: string
          merchant: string
          date: string
          receipt_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          amount?: number
          category?: string
          merchant?: string
          date?: string
          receipt_url?: string | null
          created_at?: string
        }
      }
      sections: {
        Row: {
          id: string
          household_id: string | null
          category: string
          title: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id?: string | null
          category: string
          title: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          category?: string
          title?: string
          content?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}