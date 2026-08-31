import type { StockLinkTarget, SymbolLinkMappingsState } from "../../types";

export const STOCK_LINK_TARGETS: { value: StockLinkTarget; label: string }[] = [
  { value: "yahoo", label: "Yahoo Finance" },
  { value: "finviz", label: "Finviz" },
  { value: "tradingview", label: "TradingView" },
];

export function buildStockLinkUrl(
  target: StockLinkTarget,
  symbol: string,
  mappings?: SymbolLinkMappingsState,
): string {
  const override = mappings?.[symbol.toUpperCase()];
  if (target === "finviz") {
    const finvizSymbol = encodeURIComponent(override?.finviz || symbol);
    return override?.finvizFutures
      ? `https://finviz.com/futures?t=${finvizSymbol}`
      : `https://finviz.com/quote.ashx?t=${finvizSymbol}`;
  }
  if (target === "tradingview") {
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(override?.tradingview || symbol)}`;
  }
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}
