import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'mfaa_session';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret');

export interface SessionPayload {
  usuarioId: string;
  email: string;
  nome: string;
  papel: string;
  deveTrocarSenha: boolean;
}

export async function criarSessao(payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
}

export async function lerSessao(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destruirSessao() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
