import { NextResponse } from "next/server";
import { aliasHits, resolveAlias } from "@/lib/aliases";
import { searchSymbols } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ hits: [] });

  const alias = resolveAlias(q);
  const local = aliasHits(q);
  let remote: Awaited<ReturnType<typeof searchSymbols>> = [];
  try {
    remote = await searchSymbols(alias || q);
  } catch {
    remote = [];
  }

  const seen = new Set<string>();
  const hits = [];
  if (alias) {
    hits.push({ symbol: alias, name: q, type: "EQUITY", exchange: "US" });
    seen.add(alias);
  }
  for (const hit of local) {
    if (seen.has(hit.symbol)) continue;
    seen.add(hit.symbol);
    hits.push({ symbol: hit.symbol, name: hit.name, type: "EQUITY", exchange: "US" });
  }
  for (const hit of remote) {
    if (seen.has(hit.symbol)) continue;
    seen.add(hit.symbol);
    hits.push(hit);
  }

  return NextResponse.json({ hits: hits.slice(0, 8) });
}
