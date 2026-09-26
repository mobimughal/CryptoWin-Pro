// Synchronized Timeframe Engine Utility
// Ensures 100% clock synchronization between Frontend (App.tsx), Admin Portal (AdminPortal.tsx), and Backend (server.ts)

export const TIMEFRAME_DURATIONS: { [tf: string]: number } = {
  '30s': 30,
  '1min': 60,
  '5min': 300,
  '15min': 900,
  '30min': 1800,
  '1hour': 3600,
};

export interface TimeframeSyncState {
  timeframe: string;
  remaining: number;
  duration: number;
  minStr: string;
  secStr: string;
  display: string;
  issue: number;
  isLocked: boolean; // last 5 seconds locked
}

let serverTimeOffsetMs = (() => {
  try {
    const saved = localStorage.getItem('pkw_server_offset_ms');
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
})();

export function setServerTimeOffset(serverTimeMs: number) {
  if (typeof serverTimeMs === 'number' && serverTimeMs > 0) {
    serverTimeOffsetMs = serverTimeMs - Date.now();
    try {
      localStorage.setItem('pkw_server_offset_ms', String(serverTimeOffsetMs));
    } catch {}
  }
}

export function getServerTimeOffset(): number {
  return serverTimeOffsetMs;
}

export function getSynchronizedTimeframe(tf: string, offsetMs = serverTimeOffsetMs): TimeframeSyncState {
  const duration = TIMEFRAME_DURATIONS[tf] || 30;
  const nowMs = Date.now() + offsetMs;
  const nowSec = Math.floor(nowMs / 1000);

  // Use UTC calendar date & UTC midnight so every device across all timezones computes identical issues!
  const dateObj = new Date(nowMs);
  const y = dateObj.getUTCFullYear();
  const mth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');

  const startOfDayUtcSec = Math.floor(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0) / 1000);
  const secondsSinceMidnight = Math.max(0, nowSec - startOfDayUtcSec);

  const elapsed = secondsSinceMidnight % duration;
  // remaining counts down from duration down to 1
  const remaining = duration - elapsed;

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const minStr = m < 10 ? '0' + m : String(m);
  const secStr = s < 10 ? '0' + s : String(s);

  // Period index: 1-indexed count of rounds since UTC midnight
  const cycleIndex = Math.floor(secondsSinceMidnight / duration) + 1;
  // Pad cycleIndex to 4 digits for realistic lottery issue numbers
  const issue = Number(`${y}${mth}${d}${String(cycleIndex).padStart(4, '0')}`);

  return {
    timeframe: tf,
    remaining,
    duration,
    minStr,
    secStr,
    display: `${minStr}:${secStr}`,
    issue,
    isLocked: remaining <= 5,
  };
}

export function getAllSynchronizedTimeframes(offsetMs = serverTimeOffsetMs): { [tf: string]: TimeframeSyncState } {
  const res: { [tf: string]: TimeframeSyncState } = {};
  for (const tf of Object.keys(TIMEFRAME_DURATIONS)) {
    res[tf] = getSynchronizedTimeframe(tf, offsetMs);
  }
  return res;
}
