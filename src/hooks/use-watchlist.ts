"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiGet, apiSend, errorMessage } from "@/lib/client/fetcher";
import { readLocalWatchlist, writeLocalWatchlist } from "@/lib/client/local-watchlist";

export interface WatchlistServerItem {
  symbol: string;
  position: number;
}

/** المفضلة: من الخادم للمستخدم المسجل، ومن Local Storage للزائر */
export function useWatchlist() {
  const { status } = useSession();
  const authed = status === "authenticated";
  const qc = useQueryClient();
  const [local, setLocal] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setLocal(readLocalWatchlist());
    sync();
    window.addEventListener("cryptoscope:watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cryptoscope:watchlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const server = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => apiGet<{ items: WatchlistServerItem[] }>("/api/watchlist"),
    enabled: authed,
  });

  const symbols = useMemo<string[]>(() => (authed ? (server.data?.items.map((i) => i.symbol) ?? []) : local), [authed, server.data, local]);

  const add = useMutation({
    mutationFn: (symbol: string) => apiSend("/api/watchlist", "POST", { symbol }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (symbol: string) => apiSend(`/api/watchlist/${encodeURIComponent(symbol)}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reorder = useMutation({
    mutationFn: (order: string[]) => apiSend("/api/watchlist", "PATCH", { symbols: order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggle = useCallback(
    (symbol: string) => {
      const has = symbols.includes(symbol);
      if (authed) {
        if (has) remove.mutate(symbol, { onSuccess: () => toast.success(`تمت إزالة ${symbol} من المفضلة`) });
        else add.mutate(symbol, { onSuccess: () => toast.success(`تمت إضافة ${symbol} إلى المفضلة`) });
      } else {
        const next = has ? symbols.filter((s) => s !== symbol) : [...symbols, symbol];
        writeLocalWatchlist(next);
        toast.success(has ? `تمت إزالة ${symbol} من المفضلة` : `تمت إضافة ${symbol} إلى المفضلة (محفوظة في هذا المتصفح فقط)`);
      }
    },
    [authed, symbols, add, remove],
  );

  const setOrder = useCallback(
    (order: string[]) => {
      if (authed) reorder.mutate(order);
      else writeLocalWatchlist(order);
    },
    [authed, reorder],
  );

  return {
    symbols,
    authed,
    loading: authed ? server.isLoading : false,
    has: (s: string) => symbols.includes(s),
    toggle,
    setOrder,
  };
}
