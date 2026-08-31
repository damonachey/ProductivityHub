import type { StockLinkTarget } from "../../types";

export const STOCK_LINK_TARGETS: { value: StockLinkTarget; label: string }[] = [
  { value: "yahoo", label: "Yahoo Finance" },
  { value: "finviz", label: "Finviz" },
  { value: "tradingview", label: "TradingView" },
];

export function buildStockLinkUrl(target: StockLinkTarget, symbol: string): string {
  const encoded = encodeURIComponent(symbol);
  if (target === "finviz") return `https://finviz.com/quote.ashx?t=${encoded}`;
  if (target === "tradingview") return `https://www.tradingview.com/chart/?symbol=${encoded}`;
  return `https://finance.yahoo.com/quote/${encoded}`;
}
