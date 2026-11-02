import type { APIRoute } from 'astro';
import { config } from '../lib/env';

// Entry point for profile-first signup (§6.8).
export const GET: APIRoute = () => Response.redirect(`${config().appOrigin}/signup?intent=profile`, 302);
