// API Route for Admin User Management (with password handling)
// Uses Service Role Key to securely manage passwords via Supabase Auth Admin API

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hashPasswordServer } from '@/lib/crypto-server'
import { format } from 'date-fns'

// Helper to log changes (Updated for password tracking)
// Helper to log changes (Updated for password tracking)
async function logChange(
    supabaseAdmin: any,
    user: any, // The admin user performing the action
    actionType: 'Insert' | 'Update' | 'Delete',
    modifyRecordId: string,
    oldData: any | null,
    newData: any | null
) {
    const today = new Date()
    const dateStr = format(today, 'yyyy-MM-dd')

    const { error } = await supabaseAdmin.from('system_change_log').insert({
        date: dateStr,
        action_type: actionType,
        user_name: user?.user_metadata?.user_name || 'Admin', // Fallback if meta missing
        user_account: user?.user_account || user?.user_metadata?.user_account || user?.email || 'admin', // Fallback
        user_unit: user?.user_metadata?.unit || null,
        modify_table: 'users',
        modify_record_id: modifyRecordId,
        old_data: oldData,
        new_data: newData
    })

    if (error) {
        console.error('Failed to write system log:', error)
        throw new Error(`System Log Error: ${error.message}`)
    }
}

// POST: Create new user with password
export async function POST(request: NextRequest) {
    try {
        // Verify admin session
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: '未登入' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('users')
            .select('*') // Select all to get unit/name for logging
            .eq('id', user.id)
            .single()

        if ((profile as any)?.role !== 'admin') {
            return NextResponse.json({ error: '權限不足' }, { status: 403 })
        }

        // Attach profile data to user object for logger helper
        const adminUserWithProfile = {
            ...user,
            user_account: profile?.user_account, // Explicitly attach user_account for logger
            user_metadata: {
                ...user.user_metadata,
                user_name: profile?.user_name,
                unit: profile?.unit,
                user_account: profile?.user_account
            }
        }

        // Parse request body
        const body = await request.json()
        const { unit, user_name, user_account, password, role, email, is_active } = body

        // Validate required fields
        if (!email || !password || !user_name || !unit || !user_account) {
            return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
        }

        // Use Admin client to create user with password
        const supabaseAdmin = createAdminClient()

        // SHA-256 + Key-stretching——與前端 hash 一致
        const hashedPassword = hashPasswordServer(password)

        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: hashedPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: { user_name }
        })

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 })
        }

        // Create or update profile in public.users table
        const newUserProfile = {
            id: authData.user.id,
            unit,
            user_name,
            user_account,
            password_hash: 'MANAGED_BY_SUPABASE_AUTH',
            role: role || 'staff',
            email,
            is_active: is_active ?? true
        }

        const { error: profileError } = await supabaseAdmin
            .from('users')
            .upsert(newUserProfile, { onConflict: 'id' })

        if (profileError) {
            // Rollback: delete auth user if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        // Log the creation
        await logChange(
            supabaseAdmin,
            adminUserWithProfile,
            'Insert',
            authData.user.id,
            null,
            newUserProfile
        )

        return NextResponse.json({ success: true, userId: authData.user.id })
    } catch (error: any) {
        console.error('Create user error:', error)
        return NextResponse.json({ error: error.message || '建立帳號失敗' }, { status: 500 })
    }
}

// PUT: Update user (optionally update password)
export async function PUT(request: NextRequest) {
    try {
        // Verify admin session
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: '未登入' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

        if ((profile as any)?.role !== 'admin') {
            return NextResponse.json({ error: '權限不足' }, { status: 403 })
        }

        const adminUserWithProfile = {
            ...user,
            user_account: profile?.user_account, // Explicitly attach user_account for logger
            user_metadata: {
                ...user.user_metadata,
                user_name: profile?.user_name,
                unit: profile?.unit,
                user_account: profile?.user_account
            }
        }

        // Parse request body
        const body = await request.json()
        const { id, unit, user_name, user_account, password, role, email, is_active, failed_attempts, last_failed_at, locked_until } = body

        if (!id) {
            return NextResponse.json({ error: '缺少使用者 ID' }, { status: 400 })
        }

        const supabaseAdmin = createAdminClient()

        // Fetch OLD data for logging
        const { data: oldUserData } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', id)
            .single()

        // Update profile in public.users table
        const updates = {
            unit,
            user_name,
            user_account,
            role,
            email,
            is_active,
            failed_attempts,
            last_failed_at,
            locked_until
        }

        const { error: profileError } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', id)

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        // Update password if provided
        if (password && password.trim() !== '') {
            // SHA-256 + Key-stretching——與前端 hash 一致
            const hashedPassword = hashPasswordServer(password)
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
                password: hashedPassword,
                email
            })

            if (authError) {
                return NextResponse.json({ error: authError.message }, { status: 400 })
            }
        } else if (email) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
                email
            })

            if (authError) {
                return NextResponse.json({ error: authError.message }, { status: 400 })
            }
        }

        // Log the update
        await logChange(
            supabaseAdmin,
            adminUserWithProfile,
            'Update',
            id,
            oldUserData, // Old state
            { ...updates, ...(password ? { password: '***CHANGED***' } : {}) } // New state (mask password)
        )

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Update user error:', error)
        return NextResponse.json({ error: error.message || '更新帳號失敗' }, { status: 500 })
    }
}

// DELETE: Delete user
export async function DELETE(request: NextRequest) {
    try {
        // Verify admin session
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: '未登入' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

        if ((profile as any)?.role !== 'admin') {
            return NextResponse.json({ error: '權限不足' }, { status: 403 })
        }

        const adminUserWithProfile = {
            ...user,
            user_account: profile?.user_account, // Explicitly attach user_account for logger
            user_metadata: {
                ...user.user_metadata,
                user_name: profile?.user_name,
                unit: profile?.unit,
                user_account: profile?.user_account
            }
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: '缺少使用者 ID' }, { status: 400 })
        }

        // Prevent self-deletion
        if (id === user.id) {
            return NextResponse.json({ error: '不能刪除自己的帳號' }, { status: 400 })
        }

        const supabaseAdmin = createAdminClient()

        // Fetch OLD data for logging before deletion
        const { data: oldUserData } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', id)
            .single()

        // Delete from public.users (cascade will handle related data)
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', id)

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        // Delete from auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

        if (authError) {
            console.warn('Failed to delete auth user:', authError.message)
        }

        // Log the deletion
        if (oldUserData) {
            await logChange(
                supabaseAdmin,
                adminUserWithProfile,
                'Delete',
                id,
                oldUserData,
                null
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Delete user error:', error)
        return NextResponse.json({ error: error.message || '刪除帳號失敗' }, { status: 500 })
    }
}
