import { useEffect, useState } from "react";
import type { SymbolLinkMappingsState } from "../types";

interface Props {
  onClose: () => void;
}

interface RowOverrides {
  finviz: string;
  finvizFutures: boolean;
  tradingview: string;
}

// Fired on window after a save, so every mounted Stock Quotes/Stock Chart
// instance (not just the one that opened this dialog) refreshes its links.
export const SYMBOL_LINK_MAPPINGS_UPDATED_EVENT = "symbol-link-mappings-updated";

export function SymbolMappingsDialog({ onClose }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, RowOverrides>>({});

  useEffect(() => {
    Promise.all([
      window.api.getSymbolLinkMappings(),
      window.api.getStocks(),
      window.api.getAllStockChartSymbols(),
    ]).then(([mappings, stocks, stockCharts]) => {
      const all = new Set<string>(Object.keys(mappings));
      Object.values(stocks).forEach((items) => {
        items.forEach((item) => all.add(item.symbol.toUpperCase()));
      });
      Object.values(stockCharts).forEach((symbol) => {
        if (symbol) all.add(symbol.toUpperCase());
      });

      const nextOverrides: Record<string, RowOverrides> = {};
      all.forEach((symbol) => {
        nextOverrides[symbol] = {
          finviz: mappings[symbol]?.finviz ?? "",
          finvizFutures: mappings[symbol]?.finvizFutures ?? false,
          tradingview: mappings[symbol]?.tradingview ?? "",
        };
      });

      setSymbols([...all].sort());
      setOverrides(nextOverrides);
      setLoaded(true);
    });
  }, []);

  function setOverride<K extends keyof RowOverrides>(symbol: string, field: K, value: RowOverrides[K]): void {
    setOverrides((prev) => ({
      ...prev,
      [symbol]: { ...prev[symbol], [field]: value },
    }));
  }

  function save(): void {
    const next: SymbolLinkMappingsState = {};
    for (const symbol of symbols) {
      const row = overrides[symbol];
      const finviz = row?.finviz.trim().toUpperCase();
      const tradingview = row?.tradingview.trim().toUpperCase();
      const finvizFutures = row?.finvizFutures ?? false;
      if (!finviz && !tradingview && !finvizFutures) continue;
      next[symbol] = {
        ...(finviz && { finviz }),
        ...(finvizFutures && { finvizFutures }),
        ...(tradingview && { tradingview }),
      };
    }
    window.api.saveSymbolLinkMappings(next).then(() => {
      window.dispatchEvent(new Event(SYMBOL_LINK_MAPPINGS_UPDATED_EVENT));
      onClose();
    });
  }

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="symbol-mappings-dialog" onClick={(event) => event.stopPropagation()}>
        <p className="confirm-message">Map Symbols</p>

        {!loaded ? (
          <p>Loading…</p>
        ) : symbols.length === 0 ? (
          <p className="module-placeholder">No symbols yet in Stock Quotes or Stock Chart.</p>
        ) : (
          <div className="symbol-mapping-list">
            <div className="symbol-mapping-row symbol-mapping-header">
              <span>Yahoo</span>
              <span>Finviz</span>
              <span>TradingView</span>
            </div>
            {symbols.map((symbol) => (
              <div className="symbol-mapping-row" key={symbol}>
                <span className="symbol-mapping-yahoo">{symbol}</span>
                <div className="symbol-mapping-finviz-cell">
                  <input
                    className="stock-symbol-input"
                    placeholder={symbol}
                    value={overrides[symbol]?.finviz ?? ""}
                    onChange={(event) => setOverride(symbol, "finviz", event.target.value)}
                  />
                  <label className="symbol-mapping-futures">
                    <input
                      type="checkbox"
                      checked={overrides[symbol]?.finvizFutures ?? false}
                      onChange={(event) => setOverride(symbol, "finvizFutures", event.target.checked)}
                    />
                    Futures
                  </label>
                </div>
                <input
                  className="stock-symbol-input"
                  placeholder={symbol}
                  value={overrides[symbol]?.tradingview ?? ""}
                  onChange={(event) => setOverride(symbol, "tradingview", event.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="symbol-mappings-save" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
