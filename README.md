# Flop Time Machine

A read-only, searchable archive of the Technocore lobby, backed by Supabase.

## Local development

1. Copy `.env.example` to `.env.local` and provide the Supabase project URL and public publishable or anonymous key.
2. Install dependencies with `npm install`.
3. Start the application with `npm run dev`.

Only public Supabase credentials belong in the frontend environment. The service-role key and collector token must remain server-side secrets and are not used by this application.

## Checks

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
