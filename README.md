# UC_Confessions

Anonymous confessions for UC campuses. Built with Next.js, React, Tailwind CSS, and Supabase.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase (recommended)

The app uses **Supabase** for confessions, likes, and views. Without it, data is stored only in the browser (localStorage).

1. Copy the env example and add your keys:
   ```bash
   cp .env.local.example .env.local
   ```
2. In `.env.local`, set:
   - `NEXT_PUBLIC_SUPABASE_URL` – from Supabase Dashboard → Project Settings → API → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – from the same page (anon public key)

3. In Supabase, create a `confessions` table and (optionally) RPCs:
   - **Table:** `confessions` with columns: `id` (uuid, default gen_random_uuid()), `created_at` (timestamptz, default now()), `body` (text), `school_id` (text), `views_count` (int, default 0), `likes_count` (int, default 0). Enable RLS if you want and add policies for select/insert/update.
   - **RPCs (optional but recommended):** `increment_confession_views(p_confession_id uuid)` and `increment_confession_likes(p_confession_id uuid, p_delta int)` to atomically update views and likes.

4. Verify the connection:
   ```bash
   node scripts/supabase-smoke-test.mjs
   ```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
