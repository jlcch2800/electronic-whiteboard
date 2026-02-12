'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { addMinutes, isAfter, isBefore, formatISO } from 'date-fns'
import { headers } from 'next/headers'

// Helper to get client IP (optional, for logging if needed)
async function getClientIp() {
    const headerList = await headers()
    return headerList.get('x-forwarded-for') || 'unknown'
}

/**
 * Check if a user is currently locked out
 */
export async function checkUserLockStatus(email: string) {
    const supabase = createAdminClient()

    // Find user by email
    const { data: user, error } = await supabase
        .from('users')
        .select('locked_until, failed_attempts')
        .or(`email.eq.${email},user_account.eq.${email}`) // Try both to be safe
        .single()

    if (error || !user) {
        // user not found or error, default to not locked to let auth fail naturally
        return { isLocked: false, message: '' }
    }

    if (user.locked_until && isAfter(new Date(user.locked_until), new Date())) {
        return {
            isLocked: true,
            message: '帳號已鎖定，目前無法輸入'
        }
    }

    return { isLocked: false, message: '' }
}

/**
 * Handle successful login: Reset counters and log event
 */
export async function handleLoginSuccess(userId: string, email: string) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const date = now.split('T')[0]

    // 1. Get user details for logging
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single()

    // 2. Reset failed attempts
    await supabase.from('users').update({
        failed_attempts: 0,
        last_failed_at: null,
        locked_until: null
    }).eq('email', email)

    // 3. Log Login Event
    await supabase.from('system_change_log').insert({
        date: date,
        action_type: 'Login',
        user_name: user?.user_name || email,
        user_account: user?.user_account || email,
        user_unit: user?.unit || null,
        modify_table: 'users',
        modify_record_id: user?.id || userId,
        old_data: null,
        new_data: { message: 'User logged in successfully' }
    })
}

/**
 * Handle login failure: Increment counters, lock if needed, log event
 */
export async function handleLoginFailure(email: string) {
    const supabase = createAdminClient()
    const now = new Date()
    const nowIso = now.toISOString()
    const date = nowIso.split('T')[0]

    // 1. Find user
    const { data: user } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${email},user_account.eq.${email}`)
        .single()

    // Handle non-existent user
    if (!user) {
        const { error: logError } = await supabase.from('system_change_log').insert({
            date: date,
            action_type: '密碼錯誤',
            user_account: email,
            user_name: 'Unknown',
            user_unit: null,
            modify_table: 'users',
            modify_record_id: '00000000-0000-0000-0000-000000000000',
            old_data: null,
            new_data: { error: 'User not found' }
        })

        if (logError) {
            console.error('Failed to log non-existent user login attempt:', logError)
        }
        return
    }

    let newFailedAttempts = (user.failed_attempts || 0) + 1
    let updates: any = {
        last_failed_at: nowIso
    }

    // Check if previous lock has expired
    if (user.locked_until && isAfter(now, new Date(user.locked_until))) {
        // Lock expired, reset counter to 1 (current failure)
        newFailedAttempts = 1
        updates.locked_until = null
    }

    updates.failed_attempts = newFailedAttempts

    let isLocked = false
    // 2. Check Lock Condition (5 attempts)
    if (newFailedAttempts >= 5) {
        const lockDurationMinutes = 30
        const lockedUntil = addMinutes(now, lockDurationMinutes)
        updates.locked_until = lockedUntil.toISOString()
        isLocked = true
    }

    // 3. Update User
    await supabase.from('users').update(updates).eq('id', user.id)

    // 4. Log Failure/Lock Event
    await supabase.from('system_change_log').insert({
        date: date,
        action_type: '密碼錯誤',
        user_name: user.user_name,
        user_account: user.user_account,
        user_unit: user.unit,
        modify_table: 'users',
        modify_record_id: user.id,
        old_data: {
            failed_attempts: user.failed_attempts,
            locked_until: user.locked_until
        },
        new_data: {
            failed_attempts: updates.failed_attempts,
            locked_until: updates.locked_until,
            status: isLocked ? 'Account Locked (30m)' : 'Login Failed',
            error: 'Invalid password'
        }
    })

    return { isLocked, failedAttempts: newFailedAttempts }
}

/**
 * Handle Logout: Log event
 */
export async function handleLogout(userId: string) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const date = now.split('T')[0]

    // Get user info for log
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single()

    if (user) {
        await supabase.from('system_change_log').insert({
            date: date,
            action_type: 'Logout',
            user_name: user.user_name,
            user_account: user.user_account,
            user_unit: user.unit,
            modify_table: 'users',
            modify_record_id: user.id,
            old_data: null,
            new_data: { message: 'User logged out' }
        })
    }
}
