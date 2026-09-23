"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/format";
import type { CapitalKind, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: Snapshot | null;
  onRecorded?: (snapshot: Snapshot) => void;
};

export function CapitalForm({ snapshot, onRecorded }: Props) {
  const router = useRouter();
  const lastFx = snapshot?.capital?.events.at(-1)?.fx ?? 7.1;
  const [kind, setKind] = useState<CapitalKind>("withdraw");
  const [cny, setCny] = useState("");
  const [fx, setFx] = useState(String(lastFx));
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const usd = useMemo(() => {
    const amount = Number(cny);
    const rate = Number(fx);
    if (!(amount > 0) || !(rate > 0)) return 0;
    return Math.round((amount / rate) * 100) / 100;
  }, [cny, fx]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(cny);
    const rate = Number(fx);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("请填写大于 0 的人民币金额");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("请填写大于 0 的汇率");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          cny: amount,
          fx: rate,
          note: note.trim() || undefined,
        }),
      });
      const data = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) {
        toast.error(data.error || "登记失败");
        return;
      }
      toast.success(kind === "withdraw" ? `已记提现 ${formatUsd(usd)}` : `已记入金 ${formatUsd(usd)}`);
      setCny("");
      setNote("");
      onRecorded?.(data);
      router.refresh();
    } catch {
      toast.error("登记失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setKind("withdraw")}
          className={cn(
            "h-8 rounded-md text-sm font-medium transition-colors",
            kind === "withdraw" ? "bg-[#B45309] text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          提现
        </button>
        <button
          type="button"
          onClick={() => setKind("deposit")}
          className={cn(
            "h-8 rounded-md text-sm font-medium transition-colors",
            kind === "deposit" ? "bg-[#0369A1] text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          入金
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cny">人民币金额</Label>
          <Input
            id="cny"
            inputMode="decimal"
            value={cny}
            onValueChange={setCny}
            className="h-10"
            placeholder="14658"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fx">汇率 CNY/USD</Label>
          <Input
            id="fx"
            inputMode="decimal"
            value={fx}
            onValueChange={setFx}
            className="h-10"
            placeholder="7.1"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="capital-note">备注（可选）</Label>
        <Input
          id="capital-note"
          value={note}
          onValueChange={setNote}
          className="h-10"
          placeholder="用途，例如金饰品"
          autoComplete="off"
        />
      </div>

      <p className="rounded-xl border border-black/10 bg-[#F7F8FC] px-3 py-2 font-mono text-sm">
        折合美元 <b>{usd > 0 ? formatUsd(usd) : "—"}</b>
        {kind === "withdraw" ? " · 会从现金里扣" : " · 会加进现金"}
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "登记中…" : kind === "withdraw" ? "记入提现" : "记入入金"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        以后提现就记在这里，或直接跟我说：「提现 8000 人民币，汇率 7.05」。历史那笔金饰品不会再动现金。
      </p>
    </form>
  );
}
