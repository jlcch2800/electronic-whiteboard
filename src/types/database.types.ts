export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Helper Enum Types
export type EntryStatus = 'arrival' | 'departure';
export type WorkStatus = 'completed' | 'incomplete' | 'abnormal';
export type UserRole = 'admin' | 'staff';
export type ActionType = 'Insert' | 'Update' | 'Delete' | 'Login' | 'Logout';
export type LogLevel = 'Info' | 'Warning' | 'Error';
/** 借用動作：borrow=借物(到院), return=歸還(離院), none=未借物 */
export type BorrowAction = 'borrow' | 'return' | 'none';
/** 借物/歸還項目的 JSONB 結構 */
export type BorrowItems = { items: string[]; other_text: string };
/** 維修單狀態 */
export type MaintenanceStatus =
  | '已轉維修單'
  | '開單主管簽核完成'
  | '工務部門報價，主管簽核中'
  | '工務已發包'
  | '院長室簽核中'
  | '採購發包簽核中'
  | '採購已發包'
  | '施工完成，開單單位驗收中'
  | '維修部門驗收中'
  | '已驗收';

export interface Database {
  public: {
    Tables: {
      vendor_today_work: {
        Row: {
          id: string
          created_at: string
          entry_status: EntryStatus
          work_date: string
          arrival_time: string | null
          departure_time: string | null
          location: string | null
          vendor_badge_id: number | null
          head_count: number | null
          vendor_name: string
          vendor_contact: string | null
          vendor_contact_phone: string | null
          work_content: string | null
          note: string | null
          // 借物功能相關欄位
          borrow_action: BorrowAction | null
          borrowed_items: BorrowItems | null
          lender_name: string | null
          returned_items: BorrowItems | null
          receiver_name: string | null
          ref_arrival_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          entry_status?: EntryStatus
          work_date: string
          arrival_time?: string | null
          departure_time?: string | null
          location?: string | null
          vendor_badge_id?: number | null
          head_count?: number | null
          vendor_name: string
          vendor_contact?: string | null
          vendor_contact_phone?: string | null
          work_content?: string | null
          note?: string | null
          borrow_action?: BorrowAction | null
          borrowed_items?: BorrowItems | null
          lender_name?: string | null
          returned_items?: BorrowItems | null
          receiver_name?: string | null
          ref_arrival_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          entry_status?: EntryStatus
          work_date?: string
          arrival_time?: string | null
          departure_time?: string | null
          location?: string | null
          vendor_badge_id?: number | null
          head_count?: number | null
          vendor_name?: string
          vendor_contact?: string | null
          vendor_contact_phone?: string | null
          work_content?: string | null
          note?: string | null
          borrow_action?: BorrowAction | null
          borrowed_items?: BorrowItems | null
          lender_name?: string | null
          returned_items?: BorrowItems | null
          receiver_name?: string | null
          ref_arrival_id?: string | null
        }
      }
      vendor_today_work_history: {
        Row: {
          id: string
          created_at: string
          entry_status: EntryStatus
          work_date: string
          arrival_time: string | null
          departure_time: string | null
          location: string | null
          vendor_badge_id: number | null
          head_count: number | null
          vendor_name: string
          vendor_contact: string | null
          vendor_contact_phone: string | null
          work_content: string | null
          note: string | null
          borrow_action: BorrowAction | null
          borrowed_items: BorrowItems | null
          lender_name: string | null
          returned_items: BorrowItems | null
          receiver_name: string | null
          ref_arrival_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          entry_status: EntryStatus
          work_date: string
          arrival_time?: string | null
          departure_time?: string | null
          location?: string | null
          vendor_badge_id?: number | null
          head_count?: number | null
          vendor_name: string
          vendor_contact?: string | null
          vendor_contact_phone?: string | null
          work_content?: string | null
          note?: string | null
          borrow_action?: BorrowAction | null
          borrowed_items?: BorrowItems | null
          lender_name?: string | null
          returned_items?: BorrowItems | null
          receiver_name?: string | null
          ref_arrival_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          entry_status?: EntryStatus
          work_date?: string
          arrival_time?: string | null
          departure_time?: string | null
          location?: string | null
          vendor_badge_id?: number | null
          head_count?: number | null
          vendor_name?: string
          vendor_contact?: string | null
          vendor_contact_phone?: string | null
          work_content?: string | null
          note?: string | null
          borrow_action?: BorrowAction | null
          borrowed_items?: BorrowItems | null
          lender_name?: string | null
          returned_items?: BorrowItems | null
          receiver_name?: string | null
          ref_arrival_id?: string | null
        }
      }
      engineering_today_work: {
        Row: {
          id: string
          created_at: string
          start_date: string
          end_date: string
          time: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          start_date: string
          end_date: string
          time?: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          start_date?: string
          end_date?: string
          time?: string | null
          vendor_name?: string
          work_content?: string
          unit?: string
          engineering_contact?: string
          note?: string | null
        }
      }
      engineering_work_history: {
        Row: {
          id: string
          created_at: string
          start_date: string
          end_date: string
          time: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          start_date: string
          end_date: string
          time?: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          start_date?: string
          end_date?: string
          time?: string | null
          vendor_name?: string
          work_content?: string
          unit?: string
          engineering_contact?: string
          note?: string | null
        }
      }
      pending_work: {
        Row: {
          id: string
          created_at: string
          start_date: string
          end_date: string
          time: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          start_date: string
          end_date: string
          time?: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          start_date?: string
          end_date?: string
          time?: string | null
          vendor_name?: string
          work_content?: string
          unit?: string
          engineering_contact?: string
          note?: string | null
        }
      }
      pending_work_history: {
        Row: {
          id: string
          created_at: string
          start_date: string
          end_date: string
          time: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          start_date: string
          end_date: string
          time?: string | null
          vendor_name: string
          work_content: string
          unit: string
          engineering_contact: string
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          start_date?: string
          end_date?: string
          time?: string | null
          vendor_name?: string
          work_content?: string
          unit?: string
          engineering_contact?: string
          note?: string | null
        }
      }
      work_report: {

        Row: {
          id: string
          created_at: string
          report_date: string
          report_time: string | null
          vendor_name: string
          work_location: string
          engineering_contact: string
          work_content: string
          work_status: WorkStatus
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          report_date: string
          report_time?: string | null
          vendor_name: string
          work_location: string
          engineering_contact: string
          work_content: string
          work_status?: WorkStatus
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          report_date?: string
          report_time?: string | null
          vendor_name?: string
          work_location?: string
          engineering_contact?: string
          work_content?: string
          work_status?: WorkStatus
          note?: string | null
        }
      }
      work_report_history: {
        Row: {
          id: string
          created_at: string
          report_date: string
          report_time: string | null
          vendor_name: string
          work_location: string
          engineering_contact: string
          work_content: string
          work_status: WorkStatus
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          report_date: string
          report_time?: string | null
          vendor_name: string
          work_location: string
          engineering_contact: string
          work_content: string
          work_status: WorkStatus
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          report_date?: string
          report_time?: string | null
          vendor_name?: string
          work_location?: string
          engineering_contact?: string
          work_content?: string
          work_status?: WorkStatus
          note?: string | null
        }
      }
      users: {
        Row: {
          id: string
          created_at: string
          unit: string
          user_name: string
          user_account: string
          password_hash: string
          role: UserRole
          email: string
          is_active: boolean
          failed_attempts: number
          last_failed_at: string | null
          locked_until: string | null
          reset_token_hash: string | null
          reset_token_expire: string | null
          verify_token_hash: string | null
          verify_token_expire: string | null
        }
        Insert: {
          id: string
          created_at?: string
          unit: string
          user_name: string
          user_account: string
          password_hash: string
          role: UserRole
          email: string
          is_active?: boolean
          failed_attempts?: number
          last_failed_at?: string | null
          locked_until?: string | null
          reset_token_hash?: string | null
          reset_token_expire?: string | null
          verify_token_hash?: string | null
          verify_token_expire?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          unit?: string
          user_name?: string
          user_account?: string
          password_hash?: string
          role?: UserRole
          email?: string
          is_active?: boolean
          failed_attempts?: number
          last_failed_at?: string | null
          locked_until?: string | null
          reset_token_hash?: string | null
          reset_token_expire?: string | null
          verify_token_hash?: string | null
          verify_token_expire?: string | null
        }
      }
      system_change_log: {
        Row: {
          id: string
          created_at: string
          date: string
          user_unit: string | null
          user_name: string | null
          user_account: string | null
          action_type: ActionType
          modify_table: string
          modify_record_id: string
          old_data: Json | null
          new_data: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          date: string
          user_unit?: string | null
          user_name?: string | null
          user_account?: string | null
          action_type: ActionType
          modify_table: string
          modify_record_id: string
          old_data?: Json | null
          new_data?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          date?: string
          user_unit?: string | null
          user_name?: string | null
          user_account?: string | null
          action_type?: ActionType
          modify_table?: string
          modify_record_id?: string
          old_data?: Json | null
          new_data?: Json | null
        }
      }
      system_execution_log: {
        Row: {
          id: string
          created_at: string
          date: string
          table_name: string | null
          log_level: LogLevel
          message: string | null
          old_data: Json | null
          new_data: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          date: string
          table_name?: string | null
          log_level: LogLevel
          message?: string | null
          old_data?: Json | null
          new_data?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          date?: string
          table_name?: string | null
          log_level?: LogLevel
          message?: string | null
          old_data?: Json | null
          new_data?: Json | null
        }
      }
      work_file: {
        Row: {
          id: string
          created_at: string
          date: string
          vendor_name: string | null
          work_item: string | null
          uploader_name: string
          description: string | null
          folder_name: string | null
          file_url: string
          image_url: string
          video_url: string | null
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          date: string
          vendor_name?: string | null
          work_item?: string | null
          uploader_name: string
          description?: string | null
          folder_name?: string | null
          file_url: string
          image_url: string
          video_url?: string | null
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          date?: string
          vendor_name?: string | null
          work_item?: string | null
          uploader_name?: string
          description?: string | null
          folder_name?: string | null
          file_url?: string
          image_url?: string
          video_url?: string | null
          note?: string | null
        }
      }
      maintenance_work_orders: {
        Row: {
          id: string
          created_at: string
          status: MaintenanceStatus
          request_date: string
          cost_center: string
          printer_name: string | null
          submit_date: string | null
          plan_start_date: string | null
          plan_end_date: string | null
          installment_count: number | null
          installment_note: string | null
          maintain_content: string
          requester_name: string
          work_order_id: string
          handler_name: string
          work_order_date: string
          maint_mgr_name: string
          maint_mgr_date: string
          req_dept_mgr_name: string | null
          req_dept_mgr_date: string | null
          quote_user_name: string | null
          quote_user_date: string | null
          vendor_name: string | null
          amount: number | null
          dispatch_mgr_name: string | null
          dispatch_mgr_date: string | null
          dispatch_director_name: string | null
          dispatch_director_date: string | null
          vice_dean_name: string | null
          vice_dean_date: string | null
          dean_name: string | null
          dean_date: string | null
          project_order_id: string | null
          procurement_name: string | null
          procurement_date: string | null
          material_name: string | null
          material_date: string | null
          rev_vice_dean_name: string | null
          rev_vice_dean_date: string | null
          rev_dean_name: string | null
          rev_dean_date: string | null
          construct_end_date: string | null
          accept_dept_mgr_name: string | null
          accept_dept_mgr_date: string | null
          accept_handler_name: string | null
          accept_handler_date: string | null
          accept_mgr_name: string | null
          accept_mgr_date: string | null
          accept_director_name: string | null
          accept_director_date: string | null
          is_contract: boolean | null
          contract_received_date: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          status?: MaintenanceStatus
          request_date: string
          cost_center: string
          printer_name?: string | null
          submit_date?: string | null
          plan_start_date?: string | null
          plan_end_date?: string | null
          installment_count?: number | null
          installment_note?: string | null
          maintain_content: string
          requester_name: string
          work_order_id: string
          handler_name: string
          work_order_date: string
          maint_mgr_name: string
          maint_mgr_date: string
          req_dept_mgr_name?: string | null
          req_dept_mgr_date?: string | null
          quote_user_name?: string | null
          quote_user_date?: string | null
          vendor_name?: string | null
          amount?: number | null
          dispatch_mgr_name?: string | null
          dispatch_mgr_date?: string | null
          dispatch_director_name?: string | null
          dispatch_director_date?: string | null
          vice_dean_name?: string | null
          vice_dean_date?: string | null
          dean_name?: string | null
          dean_date?: string | null
          project_order_id?: string | null
          procurement_name?: string | null
          procurement_date?: string | null
          material_name?: string | null
          material_date?: string | null
          rev_vice_dean_name?: string | null
          rev_vice_dean_date?: string | null
          rev_dean_name?: string | null
          rev_dean_date?: string | null
          construct_end_date?: string | null
          accept_dept_mgr_name?: string | null
          accept_dept_mgr_date?: string | null
          accept_handler_name?: string | null
          accept_handler_date?: string | null
          accept_mgr_name?: string | null
          accept_mgr_date?: string | null
          accept_director_name?: string | null
          accept_director_date?: string | null
          is_contract?: boolean | null
          contract_received_date?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          status?: MaintenanceStatus
          request_date?: string
          cost_center?: string
          printer_name?: string | null
          submit_date?: string | null
          plan_start_date?: string | null
          plan_end_date?: string | null
          installment_count?: number | null
          installment_note?: string | null
          maintain_content?: string
          requester_name?: string
          work_order_id?: string
          handler_name?: string
          work_order_date?: string
          maint_mgr_name?: string
          maint_mgr_date?: string
          req_dept_mgr_name?: string | null
          req_dept_mgr_date?: string | null
          quote_user_name?: string | null
          quote_user_date?: string | null
          vendor_name?: string | null
          amount?: number | null
          dispatch_mgr_name?: string | null
          dispatch_mgr_date?: string | null
          dispatch_director_name?: string | null
          dispatch_director_date?: string | null
          vice_dean_name?: string | null
          vice_dean_date?: string | null
          dean_name?: string | null
          dean_date?: string | null
          project_order_id?: string | null
          procurement_name?: string | null
          procurement_date?: string | null
          material_name?: string | null
          material_date?: string | null
          rev_vice_dean_name?: string | null
          rev_vice_dean_date?: string | null
          rev_dean_name?: string | null
          rev_dean_date?: string | null
          construct_end_date?: string | null
          accept_dept_mgr_name?: string | null
          accept_dept_mgr_date?: string | null
          accept_handler_name?: string | null
          accept_handler_date?: string | null
          accept_mgr_name?: string | null
          accept_mgr_date?: string | null
          accept_director_name?: string | null
          accept_director_date?: string | null
          is_contract?: boolean | null
          contract_received_date?: string | null
        }
      }
      maintenance_work_orders_history: {
        Row: {
          id: string
          created_at: string
          status: MaintenanceStatus
          request_date: string
          cost_center: string
          printer_name: string | null
          submit_date: string | null
          plan_start_date: string | null
          plan_end_date: string | null
          installment_count: number | null
          installment_note: string | null
          maintain_content: string
          requester_name: string
          work_order_id: string
          handler_name: string
          work_order_date: string
          maint_mgr_name: string
          maint_mgr_date: string
          req_dept_mgr_name: string | null
          req_dept_mgr_date: string | null
          quote_user_name: string | null
          quote_user_date: string | null
          vendor_name: string | null
          amount: number | null
          dispatch_mgr_name: string | null
          dispatch_mgr_date: string | null
          dispatch_director_name: string | null
          dispatch_director_date: string | null
          vice_dean_name: string | null
          vice_dean_date: string | null
          dean_name: string | null
          dean_date: string | null
          project_order_id: string | null
          procurement_name: string | null
          procurement_date: string | null
          material_name: string | null
          material_date: string | null
          rev_vice_dean_name: string | null
          rev_vice_dean_date: string | null
          rev_dean_name: string | null
          rev_dean_date: string | null
          construct_end_date: string | null
          accept_dept_mgr_name: string | null
          accept_dept_mgr_date: string | null
          accept_handler_name: string | null
          accept_handler_date: string | null
          accept_mgr_name: string | null
          accept_mgr_date: string | null
          accept_director_name: string | null
          accept_director_date: string | null
          is_contract: boolean | null
          contract_received_date: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          status: MaintenanceStatus
          request_date: string
          cost_center: string
          printer_name?: string | null
          submit_date?: string | null
          plan_start_date?: string | null
          plan_end_date?: string | null
          installment_count?: number | null
          installment_note?: string | null
          maintain_content: string
          requester_name: string
          work_order_id: string
          handler_name: string
          work_order_date: string
          maint_mgr_name: string
          maint_mgr_date: string
          req_dept_mgr_name?: string | null
          req_dept_mgr_date?: string | null
          quote_user_name?: string | null
          quote_user_date?: string | null
          vendor_name?: string | null
          amount?: number | null
          dispatch_mgr_name?: string | null
          dispatch_mgr_date?: string | null
          dispatch_director_name?: string | null
          dispatch_director_date?: string | null
          vice_dean_name?: string | null
          vice_dean_date?: string | null
          dean_name?: string | null
          dean_date?: string | null
          project_order_id?: string | null
          procurement_name?: string | null
          procurement_date?: string | null
          material_name?: string | null
          material_date?: string | null
          rev_vice_dean_name?: string | null
          rev_vice_dean_date?: string | null
          rev_dean_name?: string | null
          rev_dean_date?: string | null
          construct_end_date?: string | null
          accept_dept_mgr_name?: string | null
          accept_dept_mgr_date?: string | null
          accept_handler_name?: string | null
          accept_handler_date?: string | null
          accept_mgr_name?: string | null
          accept_mgr_date?: string | null
          accept_director_name?: string | null
          accept_director_date?: string | null
          is_contract?: boolean | null
          contract_received_date?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          status?: MaintenanceStatus
          request_date?: string
          cost_center?: string
          printer_name?: string | null
          submit_date?: string | null
          plan_start_date?: string | null
          plan_end_date?: string | null
          installment_count?: number | null
          installment_note?: string | null
          maintain_content?: string
          requester_name?: string
          work_order_id?: string
          handler_name?: string
          work_order_date?: string
          maint_mgr_name?: string
          maint_mgr_date?: string
          req_dept_mgr_name?: string | null
          req_dept_mgr_date?: string | null
          quote_user_name?: string | null
          quote_user_date?: string | null
          vendor_name?: string | null
          amount?: number | null
          dispatch_mgr_name?: string | null
          dispatch_mgr_date?: string | null
          dispatch_director_name?: string | null
          dispatch_director_date?: string | null
          vice_dean_name?: string | null
          vice_dean_date?: string | null
          dean_name?: string | null
          dean_date?: string | null
          project_order_id?: string | null
          procurement_name?: string | null
          procurement_date?: string | null
          material_name?: string | null
          material_date?: string | null
          rev_vice_dean_name?: string | null
          rev_vice_dean_date?: string | null
          rev_dean_name?: string | null
          rev_dean_date?: string | null
          construct_end_date?: string | null
          accept_dept_mgr_name?: string | null
          accept_dept_mgr_date?: string | null
          accept_handler_name?: string | null
          accept_handler_date?: string | null
          accept_mgr_name?: string | null
          accept_mgr_date?: string | null
          accept_director_name?: string | null
          accept_director_date?: string | null
          is_contract?: boolean | null
          contract_received_date?: string | null
        }
      }
    }
  }
}