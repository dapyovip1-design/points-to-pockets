<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture decisions

- Ayet Studios web offerwall is embedded on the tasks page via `https://offerwall.ayet.io/offers?adSlot=30627&externalIdentifier={profile.id}` (adSlot 30627 taken from the user's placement). The `wall.ayetstudios.com/ed/25713/30627/{uid}` URL supplied by the user returns HTTP 404 — do not revert to it.
- Offerwall conversions arrive as S2S callbacks at `/api/public/ayet-postback`, verified by the HMAC-SHA256 `X-Ayetstudios-Security-Hash` header keyed with secret `AYET_PUBLISHER_API_KEY`. Credits are idempotent via `offerwall_transactions.tx_id` and applied through the `credit_offerwall_points` RPC; reversal callbacks (tx id prefixed `r-`) deduct points.
- The points/USD rate lives in `POINTS_PER_USD` (src/hooks/use-profile.ts) and the `request_withdrawal` SQL function — keep both in sync when changing it.
- User profile points are read-only to clients (no UPDATE policy on profiles); balances only change through the two SQL functions.
- Admin system: roles live in `public.user_roles` (enum `app_role`, assigned only via privileged SQL — no user-facing write path); `/admin` page guard and every admin server fn re-verify via security-definer `has_role()`. Withdrawal state changes run only through security-definer SQL functions `admin_approve_withdrawal`, `admin_start_payment`, `admin_reject_withdrawal`, `admin_confirm_payment` (they enforce status transitions, one-time refund via `withdrawals.refunded`, and payment reference); every action is recorded in the `withdrawal_events` audit table, which non-admins cannot read and nobody can modify through the Data API.
