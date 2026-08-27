const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo's endpoint rejects requests without a browser-like User-Agent.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface StockQuote {
  symbol: string;
  name: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  error: string | null;
}

interface ChartMeta {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  currency?: string;
}

interface ChartResponse {
  chart: {
    result: { meta: ChartMeta }[] | null;
  };
}

function emptyQuote(symbol: string, error: string): StockQuote {
  return {
    symbol,
    name: null,
    price: null,
    previousClose: null,
    change: null,
    changePercent: null,
    currency: null,
    error,
  };
}

async function getQuote(symbol: string): Promise<StockQuote> {
  try {
    const response = await fetch(`${CHART_URL}/${encodeURIComponent(symbol)}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      return emptyQuote(symbol, `HTTP ${response.status}`);
    }

    const data = (await response.json()) as ChartResponse;
    const meta = data.chart.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) {
      return emptyQuote(symbol, "Symbol not found");
    }

    const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
    const price = meta.regularMarketPrice;
    const change = price - previousClose;

    return {
      symbol: meta.symbol ?? symbol,
      name: meta.longName ?? meta.shortName ?? symbol,
      price,
      previousClose,
      change,
      changePercent: previousClose ? (change / previousClose) * 100 : 0,
      currency: meta.currency ?? "USD",
      error: null,
    };
  } catch (err) {
    return emptyQuote(symbol, err instanceof Error ? err.message : "Unknown error");
  }
}

export async function getQuotes(symbols: string[]): Promise<StockQuote[]> {
  return Promise.all(symbols.map((symbol) => getQuote(symbol)));
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartQuoteArrays {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

interface ChartHistoryResponse {
  chart: {
    result: { timestamp?: number[]; indicators: { quote: ChartQuoteArrays[] } }[] | null;
  };
}

export async function getDailyCandles(symbol: string, range = "3mo"): Promise<Candle[]> {
  const response = await fetch(
    `${CHART_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
    { headers: { "User-Agent": USER_AGENT } },
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as ChartHistoryResponse;
  const result = data.chart.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators.quote[0];
  if (!timestamps || !quote) {
    throw new Error("Symbol not found");
  }

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({ time: timestamps[i], open, high, low, close, volume: quote.volume[i] ?? 0 });
  }
  return candles;
}
