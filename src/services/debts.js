import { supabase } from './supabase'
const result=({data,error})=>{if(error){const issue=new Error('No pudimos guardar. Revisa los datos y tu conexión.');issue.uncertain=!error.code;throw issue;}return data}
export async function debts(){const [a,b]=await Promise.all([supabase.from('fin_debts').select('*').order('created_at',{ascending:false}),supabase.from('fin_debt_payments').select('*').order('paid_on',{ascending:false}).order('created_at',{ascending:false})]);return {debts:result(a),payments:result(b)}}
export const createDebt=(name,principal,deadline,request)=>supabase.rpc('create_debt',{p_name:name,p_principal:Number(principal),p_deadline:deadline || null,p_request:request}).then(result)
export const payDebt=(id,amount,date,description,request)=>supabase.rpc('pay_debt',{p_debt:id,p_amount:Number(amount),p_date:date,p_description:description,p_request:request}).then(result)
