-- Only the server (service role) may credit offerwall points.
-- Previously the function was executable by any authenticated user,
-- letting a user grant themselves points via the Data API.
REVOKE EXECUTE ON FUNCTION public.credit_offerwall_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_offerwall_points(uuid, integer) TO service_role;