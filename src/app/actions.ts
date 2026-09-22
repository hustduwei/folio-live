"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addTrade, removeTrade } from "@/lib/portfolio";
import { fetchQuotes, normalizeSymbol } from "@/lib/quotes";
import type { TradeSide } from "@/lib/types";

function fail(message: string): never {
  redirect(`/?error=${encodeURIComponent(message)}`);
}

export async function recordTrade(formData: FormData) {
  const sideRaw = String(formData.get("side") || "buy");
  const side: TradeSide = sideRaw === "sell" ? "sell" : "buy";
  const symbol = normalizeSymbol(String(formData.get("symbol") || ""));
  const shares = Number(formData.get("shares"));
  const price = Number(formData.get("price"));
  const note = String(formData.get("note") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!symbol) fail("请填写股票代码");
  if (!Number.isFinite(shares) || shares <= 0) fail("请填写大于 0 的股数");

  let quoteName = name;
  let quotePrice = Number.isFinite(price) && price > 0 ? price : 0;
  try {
    const [quote] = await fetchQuotes([symbol]);
    quoteName = quote?.name || name || symbol;
    if (!(quotePrice > 0)) quotePrice = quote?.price || 0;
  } catch {
    quoteName = name || symbol;
  }

  if (!(quotePrice > 0)) fail("请填写成交价");

  try {
    await addTrade({
      symbol,
      name: quoteName,
      side,
      shares,
      price: quotePrice,
      note: note || undefined,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : "登记失败");
  }

  revalidatePath("/");
  redirect("/");
}

export async function undoTrade(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) fail("缺少交易 id");
  try {
    await removeTrade(id);
  } catch (error) {
    fail(error instanceof Error ? error.message : "撤销失败");
  }
  revalidatePath("/");
  redirect("/");
}
