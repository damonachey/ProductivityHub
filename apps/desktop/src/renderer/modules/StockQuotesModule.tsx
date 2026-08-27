import { useEffect, useState } from "react";
import type { StockQuote } from "@productivityhub/yahoo-finance";
import type { StockItem } from "../../types";
import { getCached, setCached } from "../cache";
import type { ModuleProps } from "./types";

function quoteCacheKey(moduleId: string): string {
  return `stock-quotes-${moduleId}`;
}

function formatPrice(quote: StockQuote): string {
  if (quote.price == null) return "—";
  return quote.price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(quote: StockQuote): string {
  if (quote.change == null || quote.changePercent == null) return "";
  const sign = quote.change >= 0 ? "+" : "";
  return `${sign}${quote.change.toFixed(2)} (${sign}${quote.changePercent.toFixed(2)}%)`;
}

export function StockQuotesModule({ moduleId, lockLayout, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.stockQuotes * 60_000;
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, StockQuote> | null>(
    () => getCached<Record<string, StockQuote>>(quoteCacheKey(moduleId)) ?? null,
  );
  const [addingOpen, setAddingOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    window.api.getStocks().then((stocks) => {
      setItems(stocks[moduleId] ?? []);
    });
  }, [moduleId]);

  useEffect(() => {
    if (lockLayout) setAddingOpen(false);
  }, [lockLayout]);

  useEffect(() => {
    if (!items) return;
    if (items.length === 0) {
      setQuotes({});
      return;
    }

    let cancelled = false;
    const symbols = items.map((item) => item.symbol);

    function fetchQuotes(): void {
      window.api.getStockQuotes(symbols).then((results) => {
        if (cancelled) return;
        const bySymbol: Record<string, StockQuote> = {};
        results.forEach((quote) => {
          bySymbol[quote.symbol] = quote;
        });
        setQuotes(bySymbol);
        setCached(quoteCacheKey(moduleId), bySymbol, refreshIntervalMs);
      });
    }

    fetchQuotes();
    const interval = setInterval(fetchQuotes, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [items, moduleId, refreshIntervalMs]);

  function persist(next: StockItem[]): void {
    setItems(next);
    window.api.saveStocks(moduleId, next);
  }

  function startAdd(): void {
    if (lockLayout) return;
    setNewSymbol("");
    setAddingOpen(true);
  }

  function commitAdd(): void {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol || !items) {
      setAddingOpen(false);
      return;
    }
    persist([...items, { id: crypto.randomUUID(), symbol }]);
    setAddingOpen(false);
  }

  function removeItem(id: string): void {
    if (!items || lockLayout) return;
    persist(items.filter((item) => item.id !== id));
  }

  function reorder(draggedItemId: string, targetId: string): void {
    if (!items || lockLayout) return;
    const fromIndex = items.findIndex((item) => item.id === draggedItemId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist(next);
  }

  if (!items) {
    return <p>Loading…</p>;
  }

  return (
    <div className="stocks">
      {items.length === 0 && !addingOpen && (
        <p className="module-placeholder">No stocks yet.</p>
      )}

      <ul className="stock-list">
        {items.map((item) => {
          const quote = quotes?.[item.symbol];
          const positive = quote?.change != null && quote.change >= 0;

          return (
            <li
              key={item.id}
              className={[
                "stock-item",
                item.id === draggedId && "dragging",
                item.id === dragOverId && "drag-over",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={!lockLayout}
              onDragStart={() => setDraggedId(item.id)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedId && draggedId !== item.id) {
                  setDragOverId(item.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedId && draggedId !== item.id) {
                  reorder(draggedId, item.id);
                }
                setDraggedId(null);
                setDragOverId(null);
              }}
            >
              {!lockLayout && (
                <span className="stock-drag-handle" aria-hidden="true">
                  ⠿
                </span>
              )}
              <div className="stock-info">
                <span className="stock-symbol">{item.symbol}</span>
                {quote?.name && <span className="stock-name">{quote.name}</span>}
              </div>
              <div className="stock-quote">
                {quote?.error ? (
                  <span className="module-error">{quote.error}</span>
                ) : quote ? (
                  <>
                    <span className="stock-price">{formatPrice(quote)}</span>
                    <span className={positive ? "stock-change-up" : "stock-change-down"}>
                      {formatChange(quote)}
                    </span>
                  </>
                ) : (
                  <span className="module-placeholder">…</span>
                )}
              </div>
              {!lockLayout && (
                <button aria-label={`Remove ${item.symbol}`} onClick={() => removeItem(item.id)}>
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!lockLayout &&
        (addingOpen ? (
          <div className="stock-add-form">
            <input
              className="stock-symbol-input"
              autoFocus
              placeholder="Symbol, e.g. AAPL"
              value={newSymbol}
              onChange={(event) => setNewSymbol(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitAdd();
                if (event.key === "Escape") setAddingOpen(false);
              }}
            />
            <button onClick={commitAdd}>Add</button>
            <button onClick={() => setAddingOpen(false)}>Cancel</button>
          </div>
        ) : (
          <button className="stock-add-button" onClick={startAdd}>
            + Add stock
          </button>
        ))}
    </div>
  );
}
