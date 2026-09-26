import { TIMEFRAME_DURATIONS } from './timeframeSync';

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EngineDrawRecord {
  id: string;
  issue: number;
  timeframe: string;
  price: string;
  d1: number;
  d2: number;
  d3: number;
  sum: number;
  tags: string[];
  timestamp: number;
}

function hashInt(x: number): number {
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return x >>> 0;
}

/**
 * Deterministic Bitcoin price for any given second timestamp.
 * Guaranteed to return the exact same price down to the cent on any machine,
 * server, container instance, or device at the same second.
 */
export function getDeterministicBtcPrice(sec: number): number {
  const macro = Math.sin(sec / 7200) * 160 + Math.cos(sec / 3600) * 110;
  const med = Math.sin(sec / 480) * 45 + Math.cos(sec / 180) * 30;
  const short = Math.sin(sec / 40) * 18 + Math.cos(sec / 15) * 10;
  const micro = ((hashInt(sec) % 2000) / 100) - 10; // -10.00 to +9.99
  const price = 86450 + macro + med + short + micro;
  return Number(price.toFixed(2));
}

/**
 * Compute the exact, deterministic draw outcome for any given timeframe and issue number.
 * The 3 draw digits (d1, d2, d3) are strictly the last 3 digits of the closing Bitcoin price:
 * d1: last digit of the integer part (ones digit)
 * d2: first decimal digit (tenths digit)
 * d3: second decimal digit (hundredths digit)
 */
export function getDeterministicDraw(tf: string, issue: number): EngineDrawRecord {
  const duration = TIMEFRAME_DURATIONS[tf] || 30;
  const issueStr = String(issue);
  const y = parseInt(issueStr.slice(0, 4), 10);
  const m = parseInt(issueStr.slice(4, 6), 10) - 1;
  const d = parseInt(issueStr.slice(6, 8), 10);
  const cycleIndex = parseInt(issueStr.slice(8), 10);

  const startOfDaySec = Math.floor(Date.UTC(y, m, d, 0, 0, 0) / 1000);
  const endSec = startOfDaySec + (cycleIndex * duration);

  const priceNum = getDeterministicBtcPrice(endSec);
  const priceStr = priceNum.toFixed(2);
  const parts = priceStr.split('.');
  const d1 = parseInt(parts[0].slice(-1), 10);
  const d2 = parseInt(parts[1][0], 10);
  const d3 = parseInt(parts[1][1], 10);
  const sum = d1 + d2 + d3;
  const isBig = sum >= 14;
  const isDouble = sum % 2 === 0;
  const tags = [
    isBig ? 'Big' : 'Small',
    isDouble ? 'Double' : 'Single',
    `${isBig ? 'Big' : 'Small'} ${isDouble ? 'Double' : 'Single'}`,
  ];

  return {
    id: `DR-SYNC-${tf}-${issue}`,
    issue,
    timeframe: tf,
    price: priceStr,
    d1,
    d2,
    d3,
    sum,
    tags,
    timestamp: endSec * 1000,
  };
}

/**
 * Generate historical deterministic draws for any timeframe.
 */
export function getDeterministicHistory(tf: string, currentIssue: number, limit = 30): EngineDrawRecord[] {
  const issueStr = String(currentIssue);
  const y = parseInt(issueStr.slice(0, 4), 10);
  const m = parseInt(issueStr.slice(4, 6), 10) - 1;
  const d = parseInt(issueStr.slice(6, 8), 10);
  const cycleIndex = parseInt(issueStr.slice(8), 10);

  const datePrefix = `${y}${String(m + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  const list: EngineDrawRecord[] = [];

  for (let i = 1; i <= limit; i++) {
    const prevCycle = cycleIndex - i;
    if (prevCycle > 0) {
      const prevIssue = Number(`${datePrefix}${String(prevCycle).padStart(4, '0')}`);
      list.push(getDeterministicDraw(tf, prevIssue));
    }
  }

  return list;
}

/**
 * Generate deterministic candlesticks for a timeframe so charts look 100% identical on all devices.
 */
export function getDeterministicCandles(tf: string, count = 25, currentSec?: number): Candle[] {
  const duration = TIMEFRAME_DURATIONS[tf] || 30;
  const nowSec = currentSec || Math.floor(Date.now() / 1000);
  const currentIntervalStart = Math.floor(nowSec / duration) * duration;
  const candles: Candle[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const barStart = currentIntervalStart - (i * duration);
    const barMid = barStart + Math.floor(duration / 2);
    const barEnd = barStart + duration;

    const pOpen = getDeterministicBtcPrice(barStart);
    const pMid = getDeterministicBtcPrice(barMid);
    const pClose = getDeterministicBtcPrice(barEnd);

    const high = Math.max(pOpen, pMid, pClose) + 3.5;
    const low = Math.min(pOpen, pMid, pClose) - 3.5;

    candles.push({
      open: pOpen,
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: pClose,
    });
  }

  return candles;
}

export interface SanitizedDrawResult {
  price: string;
  d1: number;
  d2: number;
  d3: number;
  sum: number;
  math: string;
  tags: string[];
  isBig: boolean;
  isDouble: boolean;
  issue: number;
}

/**
 * Extracts d1, d2, d3, sum, math, and tags strictly from the last 3 digits of a price.
 * d1: last digit of integer part
 * d2: first decimal digit
 * d3: second decimal digit
 */
export function parseDrawResultFromPrice(price: string | number, issue: number = 0): SanitizedDrawResult {
  const priceNum = typeof price === 'number' ? price : parseFloat(String(price));
  const validPrice = (!isNaN(priceNum) && priceNum > 0) ? priceNum.toFixed(2) : '86500.00';
  const parts = validPrice.split('.');
  const d1 = parseInt(parts[0].slice(-1), 10);
  const d2 = parseInt(parts[1][0], 10);
  const d3 = parseInt(parts[1][1], 10);
  const sum = d1 + d2 + d3;
  const isBig = sum >= 14;
  const isDouble = sum % 2 === 0;
  return {
    price: validPrice,
    d1,
    d2,
    d3,
    sum,
    math: `${d1}+${d2}+${d3}=${sum}`,
    tags: [
      isBig ? 'Big' : 'Small',
      isDouble ? 'Double' : 'Single',
      `${isBig ? 'Big' : 'Small'} ${isDouble ? 'Double' : 'Single'}`,
    ],
    isBig,
    isDouble,
    issue,
  };
}
