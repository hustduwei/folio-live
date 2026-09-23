import { NextResponse } from "next/server";
import { addCapitalEvent, removeCapitalEvent } from "@/lib/portfolio";
import { buildSnapshot } from "@/lib/snapshot";
import type { CapitalKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kind?: CapitalKind;
      cny?: number | string;
      fx?: number | string;
      note?: string;
      executedAt?: string;
    };

    const kind = body.kind === "withdraw" ? "withdraw" : body.kind === "deposit" ? "deposit" : null;
    if (!kind) {
      return NextResponse.json({ error: "请选择入金或提现" }, { status: 400 });
    }

    const event = await addCapitalEvent({
      kind,
      cny: Number(body.cny),
      fx: Number(body.fx),
      note: body.note,
      executedAt: body.executedAt,
      affectsCash: true,
    });

    const snapshot = await buildSnapshot();
    return NextResponse.json({ ...snapshot, lastEvent: event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登记失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少资金记录 id" }, { status: 400 });
    }
    await removeCapitalEvent(id);
    const snapshot = await buildSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "撤销失败" },
      { status: 400 },
    );
  }
}
