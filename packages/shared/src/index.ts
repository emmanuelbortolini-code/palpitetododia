// Shared package — tipos, schemas e utilitários compartilhados entre web e mobile.

export const SHARED_PACKAGE_VERSION = '0.1.0';

export { createSupabaseClient, type SupabaseClient } from './api/client';
export * from './schemas/auth';
export * from './schemas/article';
export * from './types/article';
export * from './schemas/academy';
export * from './types/academy';
export * from './schemas/sportsbook';
export * from './types/sportsbook';
export * from './schemas/prediction';
export * from './types/prediction';
