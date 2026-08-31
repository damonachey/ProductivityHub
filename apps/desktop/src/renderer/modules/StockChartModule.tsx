import { useEffect, useState } from "react";
import type { Candle, StockQuote } from "@productivityhub/yahoo-finance";
import type { StockLinkTarget, SymbolLinkMappingsState } from "../../types";
import { getCached, setCached } from "../cache";
import { SYMBOL_LINK_MAPPINGS_UPDATED_EVENT, SymbolMappingsDialog } from "../SymbolMappingsDialog";
import { buildStockLinkUrl, STOCK_LINK_TARGETS } from "./stockLinks";
import type { ModuleProps } from "./types";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 220;
const PADDING = 8;

function chartCacheKey(symbol: string): string {
  return `stock-chart-${symbol}`;
}

function quoteCacheKey(symbol: string): string {
  return `stock-chart-quote-${symbol}`;
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

function CandlestickChart({ candles }: { candles: Candle[] }) {
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const priceRange = maxPrice - minPrice || 1;

  const innerWidth = CHART_WIDTH - PADDING * 2;
  const innerHeight = CHART_HEIGHT - PADDING * 2;
  const candleSlot = innerWidth / candles.length;
  const candleWidth = Math.max(2, candleSlot * 0.6);

  function y(price: number): number {
    return PADDING + innerHeight - ((price - minPrice) / priceRange) * innerHeight;
  }

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="stock-chart-svg"
    >
      {candles.map((candle, index) => {
        const x = PADDING + index * candleSlot + candleSlot / 2;
        const isUp = candle.close >= candle.open;
        const color = isUp ? "#4ade80" : "#f87171";
        const bodyTop = y(Math.max(candle.open, candle.close));
        const bodyBottom = y(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        return (
          <g key={candle.time}>
            <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={1} />
            <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

export function StockChartModule({ moduleId, lockLayout, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.stockChart * 60_000;
  const [symbol, setSymbol] = useState("");
  const [draftSymbol, setDraftSymbol] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<StockLinkTarget>("yahoo");
  const [mappings, setMappings] = useState<SymbolLinkMappingsState>({});
  const [mapDialogOpen, setMapDialogOpen] = useState(false);

  useEffect(() => {
    window.api.getSymbolLinkMappings().then(setMappings);
    function refreshMappings(): void {
      window.api.getSymbolLinkMappings().then(setMappings);
    }
    window.addEventListener(SYMBOL_LINK_MAPPINGS_UPDATED_EVENT, refreshMappings);
    return () => window.removeEventListener(SYMBOL_LINK_MAPPINGS_UPDATED_EVENT, refreshMappings);
  }, []);

  useEffect(() => {
    window.api.getStockChartSymbol(moduleId).then((saved) => {
      setSymbol(saved);
      setDraftSymbol(saved);
      setCandles(saved ? (getCached<Candle[]>(chartCacheKey(saved)) ?? null) : null);
      setQuote(saved ? (getCached<StockQuote>(quoteCacheKey(saved)) ?? null) : null);
      setLoaded(true);
    });
  }, [moduleId]);

  useEffect(() => {
    window.api.getStockLinkTarget(moduleId).then(setLinkTarget);
  }, [moduleId]);

  function commitLinkTarget(target: StockLinkTarget): void {
    setLinkTarget(target);
    window.api.saveStockLinkTarget(moduleId, target);
  }

  useEffect(() => {
    if (lockLayout) setDraftSymbol(symbol);
  }, [lockLayout, symbol]);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;

    function fetchData(): void {
      window.api
        .getStockCandles(symbol)
        .then((result) => {
          if (cancelled) return;
          setCandles(result);
          setCached(chartCacheKey(symbol), result, refreshIntervalMs);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });

      window.api.getStockQuotes([symbol]).then(([result]) => {
        if (cancelled || !result) return;
        setQuote(result);
        setCached(quoteCacheKey(symbol), result, refreshIntervalMs);
      });
    }

    fetchData();
    const interval = setInterval(fetchData, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol, refreshIntervalMs]);

  function commitSymbol(): void {
    const normalized = draftSymbol.trim().toUpperCase();
    if (!normalized) return;
    setSymbol(normalized);
    setCandles(getCached<Candle[]>(chartCacheKey(normalized)) ?? null);
    setQuote(getCached<StockQuote>(quoteCacheKey(normalized)) ?? null);
    setError(null);
    window.api.saveStockChartSymbol(moduleId, normalized);
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <div className="stock-chart-module">
      {!lockLayout && (
        <div className="stock-chart-form">
          <input
            className="stock-symbol-input"
            value={draftSymbol}
            placeholder="Symbol, e.g. AAPL"
            onChange={(event) => setDraftSymbol(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitSymbol();
            }}
          />
          <button onClick={commitSymbol}>Set</button>
          <label className="stock-link-target">
            Link to
            <select
              className="stock-link-select"
              value={linkTarget}
              onChange={(event) => commitLinkTarget(event.target.value as StockLinkTarget)}
            >
              {STOCK_LINK_TARGETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="stock-map-symbols-button" onClick={() => setMapDialogOpen(true)}>
            Map Symbols
          </button>
        </div>
      )}

      {!symbol ? (
        <p className="module-placeholder">Enter a ticker symbol above.</p>
      ) : (
        <>
          <div className="stock-chart-header">
            <div className="stock-info">
              <a
                className="stock-chart-symbol"
                href={buildStockLinkUrl(linkTarget, symbol, mappings)}
                target="_blank"
                rel="noreferrer"
              >
                {symbol}
              </a>
              {quote?.name && <span className="stock-name">{quote.name}</span>}
            </div>
            <div className="stock-quote">
              {quote?.error ? (
                <span className="module-error">{quote.error}</span>
              ) : quote ? (
                <>
                  <span className="stock-price">{formatPrice(quote)}</span>
                  <span
                    className={
                      quote.change != null && quote.change >= 0
                        ? "stock-change-up"
                        : "stock-change-down"
                    }
                  >
                    {formatChange(quote)}
                  </span>
                </>
              ) : (
                <span className="module-placeholder">…</span>
              )}
            </div>
          </div>
          {error ? (
            <p className="module-error">Error: {error}</p>
          ) : candles && candles.length > 0 ? (
            <CandlestickChart candles={candles} />
          ) : (
            <p>Loading chart…</p>
          )}
        </>
      )}

      {mapDialogOpen && <SymbolMappingsDialog onClose={() => setMapDialogOpen(false)} />}
    </div>
  );
}
