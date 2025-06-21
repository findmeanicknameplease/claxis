export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      salons: {
        Row: {
          id: string
          business_name: string
          owner_name: string
          email: string
          phone: string
          whatsapp_number: string | null
          instagram_handle: string | null
          address: Json
          timezone: string
          subscription_tier: 'professional' | 'enterprise'
          subscription_status: string
          trial_ends_at: string | null
          settings: Json
          metadata: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          business_name: string
          owner_name: string
          email: string
          phone: string
          whatsapp_number?: string | null
          instagram_handle?: string | null
          address: Json
          timezone?: string
          subscription_tier?: 'professional' | 'enterprise'
          subscription_status?: string
          trial_ends_at?: string | null
          settings?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          business_name?: string
          owner_name?: string
          email?: string
          phone?: string
          whatsapp_number?: string | null
          instagram_handle?: string | null
          address?: Json
          timezone?: string
          subscription_tier?: 'professional' | 'enterprise'
          subscription_status?: string
          trial_ends_at?: string | null
          settings?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      staff_members: {
        Row: {
          id: string
          salon_id: string
          name: string
          email: string | null
          phone: string | null
          role: string
          is_owner: boolean
          availability: Json
          services: Json
          commission_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          name: string
          email?: string | null
          phone?: string | null
          role: string
          is_owner?: boolean
          availability?: Json
          services?: Json
          commission_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          role?: string
          is_owner?: boolean
          availability?: Json
          services?: Json
          commission_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          salon_id: string
          name: string
          description: string | null
          duration_minutes: number
          price: number
          category: string
          requires_consultation: boolean
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          name: string
          description?: string | null
          duration_minutes: number
          price: number
          category: string
          requires_consultation?: boolean
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          name?: string
          description?: string | null
          duration_minutes?: number
          price?: number
          category?: string
          requires_consultation?: boolean
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          salon_id: string
          name: string
          phone: string
          email: string | null
          preferred_language: string
          preferred_channel: 'whatsapp' | 'instagram' | 'web'
          notes: string | null
          tags: Json
          last_visit_at: string | null
          total_spent: number
          visit_count: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          name: string
          phone: string
          email?: string | null
          preferred_language?: string
          preferred_channel?: 'whatsapp' | 'instagram' | 'web'
          notes?: string | null
          tags?: Json
          last_visit_at?: string | null
          total_spent?: number
          visit_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          name?: string
          phone?: string
          email?: string | null
          preferred_language?: string
          preferred_channel?: 'whatsapp' | 'instagram' | 'web'
          notes?: string | null
          tags?: Json
          last_visit_at?: string | null
          total_spent?: number
          visit_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          salon_id: string
          customer_id: string
          staff_member_id: string
          service_id: string
          service_window_id: string | null
          start_time: string
          end_time: string
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          price: number
          deposit_amount: number | null
          notes: string | null
          reminder_sent_at: string | null
          confirmed_at: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          customer_id: string
          staff_member_id: string
          service_id: string
          service_window_id?: string | null
          start_time: string
          end_time: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          price: number
          deposit_amount?: number | null
          notes?: string | null
          reminder_sent_at?: string | null
          confirmed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          customer_id?: string
          staff_member_id?: string
          service_id?: string
          service_window_id?: string | null
          start_time?: string
          end_time?: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          price?: number
          deposit_amount?: number | null
          notes?: string | null
          reminder_sent_at?: string | null
          confirmed_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          salon_id: string
          customer_id: string | null
          channel: 'whatsapp' | 'instagram' | 'web'
          external_id: string
          status: 'active' | 'resolved' | 'escalated' | 'archived'
          assigned_to: string | null
          last_message_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          customer_id?: string | null
          channel: 'whatsapp' | 'instagram' | 'web'
          external_id: string
          status?: 'active' | 'resolved' | 'escalated' | 'archived'
          assigned_to?: string | null
          last_message_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          customer_id?: string | null
          channel?: 'whatsapp' | 'instagram' | 'web'
          external_id?: string
          status?: 'active' | 'resolved' | 'escalated' | 'archived'
          assigned_to?: string | null
          last_message_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_type: string
          sender_id: string | null
          content: string
          message_type: string
          external_id: string | null
          is_read: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_type: string
          sender_id?: string | null
          content: string
          message_type?: string
          external_id?: string | null
          is_read?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_type?: string
          sender_id?: string | null
          content?: string
          message_type?: string
          external_id?: string | null
          is_read?: boolean
          metadata?: Json
          created_at?: string
        }
      }
      workflows: {
        Row: {
          id: string
          salon_id: string
          n8n_workflow_id: string
          name: string
          description: string | null
          trigger_type: string
          status: 'active' | 'paused' | 'error'
          configuration: Json
          error_count: number
          last_error_at: string | null
          last_error_message: string | null
          execution_count: number
          last_executed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          salon_id: string
          n8n_workflow_id: string
          name: string
          description?: string | null
          trigger_type: string
          status?: 'active' | 'paused' | 'error'
          configuration?: Json
          error_count?: number
          last_error_at?: string | null
          last_error_message?: string | null
          execution_count?: number
          last_executed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          salon_id?: string
          n8n_workflow_id?: string
          name?: string
          description?: string | null
          trigger_type?: string
          status?: 'active' | 'paused' | 'error'
          configuration?: Json
          error_count?: number
          last_error_at?: string | null
          last_error_message?: string | null
          execution_count?: number
          last_executed_at?: string | null
          created_at?: string
          updated_at?: string
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
      booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
      conversation_status: 'active' | 'resolved' | 'escalated' | 'archived'
      message_channel: 'whatsapp' | 'instagram' | 'web'
      service_window_status: 'available' | 'reserved' | 'booked' | 'blocked'
      subscription_tier: 'professional' | 'enterprise'
      workflow_status: 'active' | 'paused' | 'error'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}