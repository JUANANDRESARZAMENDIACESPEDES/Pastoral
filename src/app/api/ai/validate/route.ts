import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();

    const key: string | undefined = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ valid: false, error: 'No hay ninguna clave para validar.' }, { status: 400 });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`
    );

    if (res.ok) {
      return NextResponse.json({ valid: true, error: null });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({
      valid: false,
      error: data?.error?.message || 'Google rechazó la clave.',
    });
  } catch {
    return NextResponse.json({ valid: false, error: 'Error de conexión con Google.' }, { status: 500 });
  }
}
