import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SendPushSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  type: z.enum(['prayer', 'hydration']),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = SendPushSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload notifikasi tidak lengkap.' }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      dispatched: true,
      payload: parsed.data,
    });
  } catch {
    return NextResponse.json({ error: 'Gagal mengirim notifikasi Web Push.' }, { status: 500 });
  }
}
