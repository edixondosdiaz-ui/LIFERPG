import { supabase } from './supabase'
import { unwrap } from './api'

export const wallet = async () => unwrap(await supabase.rpc('shop_wallet'))
export const claimRewards = async () => unwrap(await supabase.rpc('claim_economy_rewards'))
export const usernameStatus = async (username) => unwrap(await supabase.rpc('username_status', { p_username: username }))
export const purchase = async (itemId, requestId, price) => unwrap(await supabase.rpc('purchase_shop_item', { p_item_id: itemId, p_request_id: requestId, p_expected_price: price }))
export const useStreakGuard = async () => unwrap(await supabase.rpc('use_streak_guard'))
export const ledger = async () => unwrap(await supabase.from('coin_ledger').select('id,amount,balance,reason,created_at').order('id', { ascending: false }).limit(40))
export const rules = async () => unwrap(await supabase.from('economy_rules').select('level_coins,weekly_streak_coins,complete_day_coins,league_promotion_coins,premium_discount,premium_rename_days').single())
export const cosmetics = async () => unwrap(await supabase.rpc('my_cosmetics'))
export const premiumStatus = async () => unwrap(await supabase.rpc('my_premium_status'))
export const activateTrial = async () => unwrap(await supabase.rpc('activate_premium_trial'))
