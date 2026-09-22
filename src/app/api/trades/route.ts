import { NextResponse } from "next/server";
import { addTrade, removeTrade } from "@/lib/portfolio";
import { fetchQuotes, normalizeSymbol } from "@/lib/quotes";
import { buildSnapshot } from "@/lib/snapshot";
import type { TradeSide } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      symbol?: string;
      name?: string;
      side?: TradeSide;
      shares?: number | string;
      price?: number | string;
      executedAt?: string;
      note?: string;
    };

    const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
    if (!side) {
      return NextResponse.json({ error: "请选择买入或卖出" }, { status: 400 });
    }

    const symbol = normalizeSymbol(body.symbol || "");
    const shares = Number(body.shares);
    const price = Number(body.price);

    let name = body.name?.trim();
    if (!name) {
      try {
        const [quote] = await fetchQuotes([symbol]);
        name = quote?.name || symbol;
      } catch {
        name = symbol;
      }
    }

    await addTrade({
      symbol,
      name,
      side,
      shares,
      price,
      executedAt: body.executedAt,
      note: body.note,
    });

    const snapshot = await buildSnapshot();
    return NextResponse.json(snapshot);
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
      return NextResponse.json({ error: "缺少交易 id" }, { status: 400 });
    }
    await removeTrade(id);
    const snapshot = await buildSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 400 },
    );
  }
}
