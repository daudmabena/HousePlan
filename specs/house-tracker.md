# Budget My House

Next.js and Supabase provide a Vercel-ready tracker for multiple independent house projects. Verified users can create houses and invite equal co-owners through email-bound, single-use links valid for seven days. Owners send links themselves. Creator attribution provides no extra permissions.

Every house has its own currency, stages, items, budgets, payments, tasks and membership. New houses receive 20 stages and 42 starter items with blank estimates, no payments and no assumed dates. All tables retain SN columns. Summaries, search and CSV exports apply only to the selected house; exports include its name. Archived houses remain readable and must be restored before edits.

PostgreSQL membership policies authorize reads and writes. Composite foreign keys reject cross-house links. Privileged operations lock the house row, validate verified membership and preserve at least one owner. Token hashes alone are stored. Acceptance requires the invited verified email and rejects expired, revoked or previously accepted tokens. Registration preserves the invitation route.

A transactional legacy migration creates one house for each legacy user, preserving record identifiers and financial values without merging copies. Fresh installations use generic templates; a separate administrator-run import can assign original Mabena House records to a designated verified owner. Development preview data stays local and production never imports workbook records automatically.

Acceptance checks cover financial calculations, migration totals, memberships, invitations, authorization, cross-house constraints, archive behavior, creation and switching, responsive navigation, scoped exports and production compilation. Local PostgreSQL tests use PGlite, which serializes connections; hosted concurrent-session validation and real email confirmation require a configured Supabase deployment.
