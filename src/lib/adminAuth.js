import { getServiceSupabase } from './supabase';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'fallback-secret-change-me';
const TOKEN_COOKIE = 'admin_token';
const TOKEN_EXPIRY_HOURS = 8;

// Simple HMAC-based token (no external JWT library needed)
function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function createToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const data = `${header}.${body}`;
    const crypto = require('crypto');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Validate admin credentials
export function validateCredentials(userId, password) {
  const validUserId = process.env.ADMIN_USER_ID || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'admin123';
  return userId === validUserId && password === validPassword;
}

// Generate a session token
export function generateSessionToken(userId) {
  return createToken({
    userId,
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  });
}

// Verify a session token
export function verifySessionToken(token) {
  return verifyToken(token);
}

// Log admin login to database
export async function logAdminLogin({ userId, ipAddress, userAgent, sessionToken }) {
  try {
    const supabase = getServiceSupabase();
    await supabase.from('admin_login_logs').insert({
      user_id: userId,
      ip_address: ipAddress || 'unknown',
      user_agent: userAgent || 'unknown',
      session_token: sessionToken?.slice(0, 20) + '...',
      logged_in_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log admin login:', err.message);
  }
}

// Check if request is authenticated (for API routes)
export function isAuthenticated(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  if (!match) return null;
  return verifySessionToken(match[1]);
}

// Get the token cookie name
export function getTokenCookieName() {
  return TOKEN_COOKIE;
}
