import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

const DEV_SESSION_COOKIE = 'suprhire_admin_session';

const safeCompare = (value: string, expected: string): boolean => {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
};

export const getAdminTokenFromHeaders = (headers: IncomingHttpHeaders): string | null => {
  const legacyHeader = headers['x-admin-key'];
  if (typeof legacyHeader === 'string' && legacyHeader.length > 0) {
    return legacyHeader;
  }

  if (Array.isArray(legacyHeader) && legacyHeader.length > 0) {
    return legacyHeader[0] ?? null;
  }

  const authHeader = headers.authorization;
  if (typeof authHeader === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    return match ? match[1] : null;
  }

  return null;
};

export const getAdminTokenFromCookies = (cookieHeader?: string): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((entry) => entry.trim());
  for (const entry of cookies) {
    const [name, ...rest] = entry.split('=');
    if (name === DEV_SESSION_COOKIE && rest.length > 0) {
      return decodeURIComponent(rest.join('=')).trim();
    }
  }

  return null;
};

export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const headerToken = getAdminTokenFromHeaders(req.headers);
  const cookieToken = getAdminTokenFromCookies(req.headers.cookie);
  const configuredServerToken = env.adminApiKey || '';
  const devToken = env.adminDevToken || '';

  if (configuredServerToken && headerToken && safeCompare(headerToken, configuredServerToken)) {
    next();
    return;
  }

  if (devToken && cookieToken && safeCompare(cookieToken, devToken)) {
    next();
    return;
  }

  if (!configuredServerToken && !devToken) {
    res.status(503).json({
      error: 'Admin authentication is not configured.',
      message: 'Set ADMIN_API_KEY or ADMIN_DEV_TOKEN on the backend before enabling admin access.',
    });
    return;
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'A valid server-side admin session is required.',
  });
};

export const configureDevSessionCookie = (res: Response, token: string): void => {
  res.cookie(DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 1000,
  });
};
