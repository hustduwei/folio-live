import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取持仓" },
      { status: 500 },
    );
  }
}
