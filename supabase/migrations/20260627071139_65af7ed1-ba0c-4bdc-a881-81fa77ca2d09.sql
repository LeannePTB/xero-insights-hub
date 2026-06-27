CREATE OR REPLACE FUNCTION public.get_mfa_posture_counts()
RETURNS TABLE(
  total_staff integer,
  enrolled_staff integer,
  total_admins integer,
  enrolled_admins integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH verified_totp AS (
    SELECT DISTINCT mf.user_id
    FROM auth.mfa_factors mf
    WHERE mf.factor_type = 'totp'
      AND mf.status = 'verified'
  ),
  staff_users AS (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('advisor', 'super_admin')
  ),
  admin_users AS (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'super_admin'
  )
  SELECT
    (SELECT COUNT(*) FROM staff_users)::integer AS total_staff,
    (SELECT COUNT(*) FROM staff_users s WHERE s.user_id IN (SELECT user_id FROM verified_totp))::integer AS enrolled_staff,
    (SELECT COUNT(*) FROM admin_users)::integer AS total_admins,
    (SELECT COUNT(*) FROM admin_users a WHERE a.user_id IN (SELECT user_id FROM verified_totp))::integer AS enrolled_admins;
$$;

REVOKE EXECUTE ON FUNCTION public.get_mfa_posture_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_mfa_posture_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_mfa_posture_counts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_mfa_posture_counts() TO service_role;