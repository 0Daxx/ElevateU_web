/**
 * env.js — Consolidated Configuration Interface
 *
 * Exposes environment variables injected by Vite during build/dev cycles.
 * Standardizes fallbacks so services degrade gracefully if variables are omitted.
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * AI provider credentials and ordering for server-side LLM calls.
 * These values are forwarded to the Supabase Edge Functions, which use them as
 * default credentials when no dedicated server secret (GROQ_API_KEY /
 * CEREBRAS_API_KEY / LLM_PROVIDER_ORDER) is configured there.
 * Comma-separated lists are supported so a primary key can fall back to extras.
 */
export const GROQ_KEYS = import.meta.env.VITE_PUBLIC_GROQ_KEYS || '';
export const CEREBRAS_KEYS = import.meta.env.VITE_PUBLIC_CEREBRAS_KEYS || '';
export const LLM_PROVIDER_ORDER = import.meta.env.VITE_LLM_PROVIDER_ORDER || '';
