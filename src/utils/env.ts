import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Public URL the frontend uses to reach this backend. Used to build the
  // mock-provider `authUrl` returned by the seller-auth flow so the browser
  // can navigate to a backend route. Default suits local development.
  PUBLIC_BACKEND_URL: z.string().url().default('http://localhost:3001'),
  // Public URL of the frontend. Used as the base for the mock-provider
  // authorize route's 302 redirect to /sell/callback. Phase 5 real connectors
  // will redirect the browser back to the same path via the provider, so the
  // var stays useful past the mock.
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env: Env = parsed.data;
