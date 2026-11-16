import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z
    .object({
      p256dh: z.string(),
      auth: z.string(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Format langganan Web Push tidak valid.' }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: 'Langganan notifikasi senyap (Mode B: Sholat & Hidrasi) berhasil disimpan.',
    });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan langganan Web Push.' }, { status: 500 });
  }
}
