import { NextResponse } from 'next/server';

// Temporary debug endpoint to check environment variables on Render
export async function GET() {
  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env['REDIS_URL'] ? 'PRESENT' : 'MISSING',
    UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'] ? 'PRESENT' : 'MISSING',
    UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'] ? 'PRESENT' : 'MISSING',
    REDIS_URL_PREFIX: process.env['REDIS_URL']?.substring(0, 20) + '...',
    UPSTASH_URL_PREFIX: process.env['UPSTASH_REDIS_REST_URL']?.substring(0, 30) + '...',
    timestamp: new Date().toISOString()
  };

  return NextResponse.json({
    environment: envDebug,
    redis_configured: !!(process.env['REDIS_URL'] && process.env['REDIS_URL'] !== 'redis://localhost:6379'),
    upstash_configured: !!(process.env['UPSTASH_REDIS_REST_URL'] && process.env['UPSTASH_REDIS_REST_TOKEN'])
  });
}