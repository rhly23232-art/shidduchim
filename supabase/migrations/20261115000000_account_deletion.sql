-- =============================================================================
-- שידוכים — מחיקת חשבון (זכות למחיקה)
-- delete_my_account(): deletes the CALLER's auth user. Every owned table references
-- auth.users with ON DELETE CASCADE (candidates → family/in-laws/resumes, ideas, journal,
-- email_log), so one delete removes all of the account's rows in one transaction.
-- Storage files are removed by the client first (Storage API), see supabaseApi.deleteAccount.
-- SECURITY DEFINER is required to touch auth.users; it acts only on auth.uid().
-- =============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
