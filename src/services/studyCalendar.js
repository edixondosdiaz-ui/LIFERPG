import { supabase } from './supabase'
import { unwrap } from './api'
import { shiftStudyMonth } from '../lib/studyCalendar'
export async function studyMonthSessions(month){
  const rows=[]
  for(let start=0;;start+=500){
    const page=unwrap(await supabase.from('edu_sessions').select('id,topic,category,mode,minutes,studied_on,created_at,xp_awarded')
      .gte('studied_on',`${month}-01`).lt('studied_on',`${shiftStudyMonth(month,1)}-01`)
      .order('created_at').order('id').range(start,start+499))
    rows.push(...page);if(page.length<500)return rows
  }
}
