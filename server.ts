import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Data storage directory
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, 'admin-config.json');

export interface AdminWithdrawal {
  id: string;
  amount: number;
  address: string;
  network: string;
  timestamp: number;
  status: string;
}

export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  network: string; // 'TRC20' | 'BEP20'
  depositAddress: string;
  txHash: string;
  screenshot?: string;
  timestamp: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedAt?: number;
  rejectionReason?: string;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  amount: number;
  networkFee: number;
  netAmount: number;
  address: string;
  timestamp: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedAt?: number;
  txHash?: string;
  rejectionReason?: string;
  refunded?: boolean;
  turnoverCompleted?: number;
  turnoverRequired?: number;
  turnoverStatus?: 'Satisfied' | 'Incomplete';
}

export interface TransferRequest {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  amount: number;
  timestamp: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedAt?: number;
  rejectionReason?: string;
  refunded?: boolean;
}

export interface SettledLedgerEntry {
  id: string;
  timeframe: string;
  issue: number | string;
  userId: string;
  type: string;
  amount: number;
  result: 'WIN' | 'LOSS';
  payout: number;
  houseImpact: number; // e.g. +50 USDT if player lost, or -45 USDT if won
  timestamp: number;
}

export interface SupportMessage {
  id: string;
  userId: string;
  sender: 'user' | 'admin';
  message: string;
  timestamp: number;
  readByAdmin?: boolean;
  readByUser?: boolean;
}

export interface RegisteredUser {
  id: string; // e.g. "USR-526482"
  username: string;
  email: string;
  password: string;
  referralCode: string;
  referredBy?: string | null;
  referrerId?: string | null;
  balance: number;
  registeredAt: number;
  lastLoginAt: number;
  status: 'active' | 'suspended';
  ip?: string;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerUsername: string;
  referrerCode: string;
  invitedUserId: string;
  invitedUsername: string;
  invitedEmailMasked: string;
  bonusAmount: number;
  registeredAt: number;
  status: 'Rewarded' | 'Active';
}

export interface PasswordRecoveryRequest {
  id: string; // e.g. "REC-492812"
  usernameOrEmail: string;
  claimedBalance?: string;
  depositProofSlip?: string; // base64 image or text proof
  userNotes?: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
  matchedUserId?: string;
  matchedUsername?: string;
  currentPassword?: string;
  newPassword?: string;
  resolvedAt?: number;
  adminNotes?: string;
}

interface AdminConfig {
  passcode: string;
  policies: { [tf: string]: string };
  houseVaultBalance: number; // Admin wallet balance accumulated from losing bets
  totalCollectedLosses: number; // Total amount from player losses
  totalPaidOutWins: number; // Total payouts to players
  withdrawals: AdminWithdrawal[];
  ledger: SettledLedgerEntry[];
  depositRequests: DepositRequest[];
  withdrawRequests: WithdrawRequest[];
  transferRequests: TransferRequest[];
  supportMessages: SupportMessage[];
  users: RegisteredUser[];
  deletedUserIds?: string[];
  referralRecords?: ReferralRecord[];
  recoveryRequests?: PasswordRecoveryRequest[];
  announcementTicker?: string;
  depositWallets?: {
    trc20: string;
    bep20: string;
  };
  drawHistory?: { [tf: string]: ServerDrawRecord[] };
}

interface ServerDrawRecord {
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

function loadConfig(): AdminConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        passcode: parsed.passcode || '8888',
        policies: parsed.policies || {
          '30s': 'auto',
          '1min': 'auto',
          '5min': 'auto',
          '15min': 'auto',
          '30min': 'auto',
          '1hour': 'auto',
        },
        houseVaultBalance: typeof parsed.houseVaultBalance === 'number' ? parsed.houseVaultBalance : 0,
        totalCollectedLosses: typeof parsed.totalCollectedLosses === 'number' ? parsed.totalCollectedLosses : 0,
        totalPaidOutWins: typeof parsed.totalPaidOutWins === 'number' ? parsed.totalPaidOutWins : 0,
        withdrawals: parsed.withdrawals || [],
        ledger: parsed.ledger || [],
        depositRequests: parsed.depositRequests || [],
        withdrawRequests: parsed.withdrawRequests || [],
        transferRequests: parsed.transferRequests || [],
        supportMessages: parsed.supportMessages || [],
        users: parsed.users || [],
        deletedUserIds: parsed.deletedUserIds || [],
        referralRecords: parsed.referralRecords || [],
        recoveryRequests: parsed.recoveryRequests || [],
        announcementTicker: parsed.announcementTicker || '🔥 This game has just launched! Join now, start trading, and earn up to 3.8x USDT payouts! 🚀',
        depositWallets: parsed.depositWallets || {
          trc20: 'TYu982aXzQkL90123mK912pLq10293',
          bep20: '',
        },
        drawHistory: parsed.drawHistory || {},
      };
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return {
    passcode: '8888',
    policies: {
      '30s': 'auto',
      '1min': 'auto',
      '5min': 'auto',
      '15min': 'auto',
      '30min': 'auto',
      '1hour': 'auto',
    },
    houseVaultBalance: 0,
    totalCollectedLosses: 0,
    totalPaidOutWins: 0,
    withdrawals: [],
    ledger: [],
    depositRequests: [],
    withdrawRequests: [],
    transferRequests: [],
    supportMessages: [],
    users: [],
    deletedUserIds: [],
    referralRecords: [],
    recoveryRequests: [],
    announcementTicker: '🔥 This game has just launched! Join now, start trading, and earn up to 3.8x USDT payouts! 🚀',
    depositWallets: {
      trc20: 'TYu982aXzQkL90123mK912pLq10293',
      bep20: '',
    },
    drawHistory: {},
  };
}

function saveConfig(config: AdminConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

let serverConfig = loadConfig();

// Real-time Connected Clients (Heartbeat tracking)
interface ClientSession {
  lastSeen: number;
  isPlayer: boolean;
  role: 'player' | 'admin';
}
const activeClients: Map<string, ClientSession> = new Map();

function cleanStaleClients() {
  const now = Date.now();
  // Allow 12 seconds grace period before considering a client disconnected
  for (const [clientId, session] of activeClients.entries()) {
    if (now - session.lastSeen > 12000) {
      activeClients.delete(clientId);
    }
  }
}

// Active bets per timeframe
export interface ServerBet {
  id: string;
  userId: string;
  timeframe: string;
  issue: number | string;
  type: string;
  amount: number;
  timestamp: number;
}

const activeBets: Map<string, ServerBet[]> = new Map([
  ['30s', []],
  ['1min', []],
  ['5min', []],
  ['15min', []],
  ['30min', []],
  ['1hour', []],
]);

let totalHistoricalVolume = 0;

// Timeframes durations in seconds
const TIMEFRAME_DURATIONS: { [tf: string]: number } = {
  '30s': 30,
  '1min': 60,
  '5min': 300,
  '15min': 900,
  '30min': 1800,
  '1hour': 3600,
};

// Helper to calculate exact UTC issue number for any timestamp and timeframe
function getIssueForTime(nowMs: number, duration: number): number {
  const nowSec = Math.floor(nowMs / 1000);
  const dateObj = new Date(nowMs);
  const y = dateObj.getUTCFullYear();
  const mth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  const startOfDayUtcSec = Math.floor(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0) / 1000);
  const secondsSinceMidnight = Math.max(0, nowSec - startOfDayUtcSec);
  const cycleIndex = Math.floor(secondsSinceMidnight / duration) + 1;
  return Number(`${y}${mth}${d}${String(cycleIndex).padStart(4, '0')}`);
}

// Calculate synchronized remaining seconds for all timeframes (authoritative UTC clock)
function getTimeframeTimers() {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const dateObj = new Date(nowMs);
  const y = dateObj.getUTCFullYear();
  const mth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getUTCDate()).padStart(2, '0');
  const startOfDayUtcSec = Math.floor(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0) / 1000);
  const secondsSinceMidnight = Math.max(0, nowSec - startOfDayUtcSec);

  const timers: {
    [tf: string]: {
      remaining: number;
      duration: number;
      minStr: string;
      secStr: string;
      display: string;
      issue: number;
      isLocked: boolean;
    };
  } = {};

  for (const [tf, duration] of Object.entries(TIMEFRAME_DURATIONS)) {
    const elapsed = secondsSinceMidnight % duration;
    const remaining = duration - elapsed;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const minStr = m < 10 ? '0' + m : String(m);
    const secStr = s < 10 ? '0' + s : String(s);
    const cycleIndex = Math.floor(secondsSinceMidnight / duration) + 1;
    const issue = Number(`${y}${mth}${d}${String(cycleIndex).padStart(4, '0')}`);

    timers[tf] = {
      remaining,
      duration,
      minStr,
      secStr,
      display: `${minStr}:${secStr}`,
      issue,
      isLocked: remaining <= 5,
    };
  }

  return timers;
}

// Deterministic Crypto Price & Outcome Engine (Zero external dependencies)
function hashInt(x: number): number {
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return x >>> 0;
}

function getDeterministicBtcPrice(sec: number): number {
  const macro = Math.sin(sec / 7200) * 160 + Math.cos(sec / 3600) * 110;
  const med = Math.sin(sec / 480) * 45 + Math.cos(sec / 180) * 30;
  const short = Math.sin(sec / 40) * 18 + Math.cos(sec / 15) * 10;
  const micro = ((hashInt(sec) % 2000) / 100) - 10;
  const price = 86450 + macro + med + short + micro;
  return Number(price.toFixed(2));
}

function getDeterministicDraw(tf: string, issue: number): ServerDrawRecord {
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

function getDeterministicHistory(tf: string, currentIssue: number, limit = 30): ServerDrawRecord[] {
  const issueStr = String(currentIssue);
  const y = parseInt(issueStr.slice(0, 4), 10);
  const m = parseInt(issueStr.slice(4, 6), 10) - 1;
  const d = parseInt(issueStr.slice(6, 8), 10);
  const cycleIndex = parseInt(issueStr.slice(8), 10);

  const datePrefix = `${y}${String(m + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  const list: ServerDrawRecord[] = [];

  for (let i = 1; i <= limit; i++) {
    const prevCycle = cycleIndex - i;
    if (prevCycle > 0) {
      const prevIssue = Number(`${datePrefix}${String(prevCycle).padStart(4, '0')}`);
      list.push(getDeterministicDraw(tf, prevIssue));
    }
  }

  return list;
}

function getDeterministicCandles(tf: string, count = 25, currentSec?: number): Array<{ open: number; high: number; low: number; close: number }> {
  const duration = TIMEFRAME_DURATIONS[tf] || 30;
  const nowSec = currentSec || Math.floor(Date.now() / 1000);
  const currentIntervalStart = Math.floor(nowSec / duration) * duration;
  const candles: Array<{ open: number; high: number; low: number; close: number }> = [];

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

// Live Central Bitcoin Market Price Engine (Deterministic across all replicas & devices)
let currentBtcPrice = getDeterministicBtcPrice(Math.floor(Date.now() / 1000));
const serverCandles: { [tf: string]: Array<{ open: number; high: number; low: number; close: number }> } = {};

function updateLiveMarket() {
  const sec = Math.floor(Date.now() / 1000);
  currentBtcPrice = getDeterministicBtcPrice(sec);
  for (const tf of Object.keys(TIMEFRAME_DURATIONS)) {
    serverCandles[tf] = getDeterministicCandles(tf, 30, sec);
  }
}

updateLiveMarket();
setInterval(updateLiveMarket, 1000);

// Authoritative outcome generator: d1, d2, d3 ALWAYS match the last 3 digits of the settled BTC price
function generateAuthoritativeDraw(policy: string, tfBets: ServerBet[] = [], overridePrice?: number | string, tf = '30s', issue?: number) {
  if (policy === 'auto' && issue) {
    return getDeterministicDraw(tf, issue);
  }

  let finalPriceNum = typeof overridePrice === 'number'
    ? overridePrice
    : typeof overridePrice === 'string'
      ? parseFloat(overridePrice)
      : currentBtcPrice;

  if (isNaN(finalPriceNum) || finalPriceNum <= 0) {
    finalPriceNum = currentBtcPrice;
  }

  let d1 = 0, d2 = 0, d3 = 0;

  if (policy === 'force_big_double') {
    d1 = 6; d2 = 6; d3 = 4; // sum = 16, Big Double
  } else if (policy === 'force_big_single') {
    d1 = 7; d2 = 5; d3 = 5; // sum = 17, Big Single
  } else if (policy === 'force_small_double') {
    d1 = 3; d2 = 4; d3 = 3; // sum = 10, Small Double
  } else if (policy === 'force_small_single') {
    d1 = 2; d2 = 3; d3 = 4; // sum = 9, Small Single
  } else if (policy === 'player_loss' && tfBets.length > 0) {
    const types = tfBets.map((b) => b.type.toLowerCase());
    const hasBig = types.some((t) => t.includes('big'));
    const hasSmall = types.some((t) => t.includes('small'));
    const hasDouble = types.some((t) => t.includes('double'));
    const hasSingle = types.some((t) => t.includes('single'));

    if (hasBig && !hasSmall) {
      d1 = 2; d2 = 3; d3 = 4; // Small Single (9)
    } else if (hasSmall && !hasBig) {
      d1 = 6; d2 = 5; d3 = 5; // Big Single (16)
    } else if (hasDouble && !hasSingle) {
      d1 = 2; d2 = 3; d3 = 4; // Small Single (9)
    } else if (hasSingle && !hasDouble) {
      d1 = 3; d2 = 4; d3 = 3; // Small Double (10)
    } else {
      d1 = 2; d2 = 3; d3 = 4; // Small Single (9)
    }
  } else if (policy === 'player_win' && tfBets.length > 0) {
    const firstType = tfBets[0].type.toLowerCase();
    if (firstType.includes('big') && firstType.includes('double')) {
      d1 = 6; d2 = 6; d3 = 4; // 16 Big Double
    } else if (firstType.includes('big') && firstType.includes('single')) {
      d1 = 7; d2 = 5; d3 = 5; // 17 Big Single
    } else if (firstType.includes('small') && firstType.includes('double')) {
      d1 = 3; d2 = 4; d3 = 3; // 10 Small Double
    } else if (firstType.includes('small') && firstType.includes('single')) {
      d1 = 2; d2 = 3; d3 = 4; // 9 Small Single
    } else if (firstType.includes('big')) {
      d1 = 6; d2 = 5; d3 = 5; // 16 Big Single
    } else if (firstType.includes('small')) {
      d1 = 2; d2 = 3; d3 = 4; // 9 Small Single
    } else if (firstType.includes('double')) {
      d1 = 4; d2 = 4; d3 = 4; // 12 Small Double
    } else {
      d1 = 3; d2 = 4; d3 = 4; // 11 Small Single
    }
  } else {
    // Normal auto market: extract d1, d2, d3 directly from the live BTC price's last 3 digits!
    const priceStr = finalPriceNum.toFixed(2);
    const parts = priceStr.split('.');
    d1 = parseInt(parts[0].slice(-1), 10);
    d2 = parseInt(parts[1][0], 10);
    d3 = parseInt(parts[1][1], 10);
  }

  // If a risk policy intervened to pick specific d1, d2, d3,
  // ensure the settled BTC price's last 3 digits match those digits identically!
  if (policy !== 'auto') {
    const baseTen = Math.floor(finalPriceNum / 10) * 10;
    finalPriceNum = Number(`${baseTen + d1}.${d2}${d3}`);
    currentBtcPrice = finalPriceNum;
  }

  // Format price and ensure exact 1-to-1 match with d1, d2, d3
  const formattedPrice = finalPriceNum.toFixed(2);
  const parts = formattedPrice.split('.');
  d1 = parseInt(parts[0].slice(-1), 10);
  d2 = parseInt(parts[1][0], 10);
  d3 = parseInt(parts[1][1], 10);

  const sum = d1 + d2 + d3;
  const isBig = sum >= 14;
  const isDouble = sum % 2 === 0;
  const tags: string[] = [
    isBig ? 'Big' : 'Small',
    isDouble ? 'Double' : 'Single',
    `${isBig ? 'Big' : 'Small'} ${isDouble ? 'Double' : 'Single'}`,
  ];

  return { d1, d2, d3, sum, isBig, isDouble, tags, price: formattedPrice };
}

// Seed initial history and sanitize existing history so d1, d2, d3 ALWAYS match price's last 3 digits
function seedInitialDrawsIfEmpty() {
  serverConfig.drawHistory = serverConfig.drawHistory || {};
  const nowMs = Date.now();

  for (const [tf, duration] of Object.entries(TIMEFRAME_DURATIONS)) {
    const currentIssue = getIssueForTime(nowMs, duration);
    const deterministicList = getDeterministicHistory(tf, currentIssue, 35);
    const existingList = serverConfig.drawHistory[tf] || [];
    const existingMap = new Map(existingList.map((d) => [d.issue, d]));

    const merged = deterministicList.map((det) => {
      if (existingMap.has(det.issue)) {
        const ex = existingMap.get(det.issue)!;
        const parts = Number(ex.price).toFixed(2).split('.');
        const d1 = parseInt(parts[0].slice(-1), 10);
        const d2 = parseInt(parts[1][0], 10);
        const d3 = parseInt(parts[1][1], 10);
        return {
          ...ex,
          price: Number(ex.price).toFixed(2),
          d1,
          d2,
          d3,
          sum: d1 + d2 + d3,
        };
      }
      return det;
    });

    serverConfig.drawHistory[tf] = merged;
  }
  saveConfig(serverConfig);
}

// Central Server-Authoritative Game Round Loop
const lastSettledIssues: { [tf: string]: number } = {};

function startServerGameEngine() {
  seedInitialDrawsIfEmpty();
  const nowMs = Date.now();
  for (const [tf, duration] of Object.entries(TIMEFRAME_DURATIONS)) {
    lastSettledIssues[tf] = getIssueForTime(nowMs, duration);
  }

  setInterval(() => {
    const currentMs = Date.now();
    for (const [tf, duration] of Object.entries(TIMEFRAME_DURATIONS)) {
      const currentIssue = getIssueForTime(currentMs, duration);
      const prevIssue = lastSettledIssues[tf];

      if (prevIssue && currentIssue !== prevIssue) {
        // Round for prevIssue has ended! Settle it centrally on server!
        lastSettledIssues[tf] = currentIssue;
        settleServerRoundCentral(tf, prevIssue);
      }
    }
  }, 500);

  console.log('[GameEngine] Centralized Game Round Engine running across all timeframes.');
}

function settleServerRoundCentral(tf: string, finishedIssue: number) {
  serverConfig.drawHistory = serverConfig.drawHistory || {};
  serverConfig.users = serverConfig.users || [];
  serverConfig.ledger = serverConfig.ledger || [];

  const policy = serverConfig.policies?.[tf] || 'auto';
  const bets = activeBets.get(tf) || [];
  // Outcome generator guarantees outcome.price has outcome.d1, d2, d3 as last 3 digits!
  const outcome = (policy === 'auto')
    ? getDeterministicDraw(tf, finishedIssue)
    : generateAuthoritativeDraw(policy, bets, currentBtcPrice, tf, finishedIssue);

  const drawRecord: ServerDrawRecord = {
    id: `DR-SYNC-${tf}-${finishedIssue}`,
    issue: finishedIssue,
    timeframe: tf,
    price: outcome.price,
    d1: outcome.d1,
    d2: outcome.d2,
    d3: outcome.d3,
    sum: outcome.sum,
    tags: outcome.tags,
    timestamp: Date.now(),
  };

  serverConfig.drawHistory[tf] = [drawRecord, ...(serverConfig.drawHistory[tf] || [])].slice(0, 100);

  // Push new candle for timeframe
  const tfCandles = serverCandles[tf];
  if (tfCandles && tfCandles.length > 0) {
    tfCandles.shift();
    tfCandles.push({
      open: currentBtcPrice,
      high: Number((currentBtcPrice + 12).toFixed(2)),
      low: Number((currentBtcPrice - 12).toFixed(2)),
      close: currentBtcPrice,
    });
  }

  let totalLossCollected = 0;
  let totalWinPaid = 0;

  for (const bet of bets) {
    const betTypeNorm = bet.type.trim().toLowerCase();
    const isWin = outcome.tags.some((tag) => tag.toLowerCase() === betTypeNorm);
    const multiplier = betTypeNorm.includes(' ') ? 3.8 : 1.95;
    const payout = isWin ? Number((bet.amount * multiplier).toFixed(2)) : 0;

    if (isWin) {
      totalWinPaid += payout;
      const user = serverConfig.users.find((u) => u.id === bet.userId);
      if (user) {
        user.balance = Number((user.balance + payout).toFixed(2));
      }
      serverConfig.ledger.unshift({
        id: `LED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timeframe: tf,
        issue: finishedIssue,
        userId: bet.userId,
        type: bet.type,
        amount: bet.amount,
        result: 'WIN',
        payout,
        houseImpact: -(payout - bet.amount),
        timestamp: Date.now(),
      });
    } else {
      totalLossCollected += bet.amount;
      serverConfig.ledger.unshift({
        id: `LED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timeframe: tf,
        issue: finishedIssue,
        userId: bet.userId,
        type: bet.type,
        amount: bet.amount,
        result: 'LOSS',
        payout: 0,
        houseImpact: bet.amount,
        timestamp: Date.now(),
      });
    }
  }

  serverConfig.totalCollectedLosses += totalLossCollected;
  serverConfig.totalPaidOutWins += totalWinPaid;
  serverConfig.houseVaultBalance += (totalLossCollected - totalWinPaid);
  serverConfig.ledger = serverConfig.ledger.slice(0, 100);

  // Clear bets for finished round
  activeBets.set(tf, []);
  saveConfig(serverConfig);

  console.log(
    `[Engine] Settle ${tf} #${finishedIssue}: ${outcome.d1}+${outcome.d2}+${outcome.d3}=${outcome.sum} (${outcome.tags.join(', ')}) | Bets: ${bets.length}, Losses: +$${totalLossCollected}, Wins: -$${totalWinPaid}`
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 1. Heartbeat to track 100% REAL live online users & enforce session validity
  app.post('/api/heartbeat', (req, res) => {
    const { clientId, userId, isPlayer = true, isRegistered = false } = req.body;
    if (clientId) {
      activeClients.set(clientId, {
        lastSeen: Date.now(),
        isPlayer: Boolean(isPlayer),
        role: isPlayer ? 'player' : 'admin',
      });
    }
    cleanStaleClients();

    let accountDeleted = false;
    if (userId && typeof userId === 'string' && userId.trim()) {
      const cleanUid = userId.trim();
      serverConfig.users = serverConfig.users || [];
      serverConfig.deletedUserIds = serverConfig.deletedUserIds || [];
      const isBlacklisted = serverConfig.deletedUserIds.includes(cleanUid);
      if (isBlacklisted) {
        accountDeleted = true;
      } else if (isRegistered) {
        // Only verify existence if the client is logged into a registered user session
        const userExists = serverConfig.users.some((u) => u.id === cleanUid);
        if (!userExists) {
          accountDeleted = true;
        }
      }
    }

    let onlinePlayers = 0;
    let onlineAdmins = 0;
    for (const session of activeClients.values()) {
      if (session.isPlayer) onlinePlayers++;
      else onlineAdmins++;
    }

    res.json({
      success: true,
      accountDeleted,
      onlineUsers: Math.max(1, activeClients.size),
      onlinePlayers,
      onlineAdmins,
    });
  });

  // 2. Real-time Status for Admin & Game (Online users, bets summary, timers, house vault balance)
  app.get('/api/status', (req, res) => {
    cleanStaleClients();

    let onlinePlayers = 0;
    let onlineAdmins = 0;
    for (const session of activeClients.values()) {
      if (session.isPlayer) onlinePlayers++;
      else onlineAdmins++;
    }

    // Sum total active bets
    let totalActiveBetsAmount = 0;
    let totalActiveBetsCount = 0;
    const timeframeSummary: { [tf: string]: { totalAmount: number; count: number; bets: ServerBet[] } } = {};

    for (const [tf, bets] of activeBets.entries()) {
      const sum = bets.reduce((acc, b) => acc + b.amount, 0);
      totalActiveBetsAmount += sum;
      totalActiveBetsCount += bets.length;
      timeframeSummary[tf] = {
        totalAmount: Number(sum.toFixed(2)),
        count: bets.length,
        bets,
      };
    }

    const timeframeTimers = getTimeframeTimers();

    res.json({
      serverTime: Date.now(),
      btcPrice: currentBtcPrice,
      onlineUsers: Math.max(1, activeClients.size),
      onlinePlayers,
      onlineAdmins,
      totalActiveBetsAmount: Number(totalActiveBetsAmount.toFixed(2)),
      totalActiveBetsCount,
      policies: serverConfig.policies,
      timeframeSummary,
      timeframeTimers,
      historicalTurnover: Number(totalHistoricalVolume.toFixed(2)),
      // House Vault Balance: Accumulated from losing player bets!
      houseVaultBalance: Number(serverConfig.houseVaultBalance.toFixed(2)),
      totalCollectedLosses: Number(serverConfig.totalCollectedLosses.toFixed(2)),
      totalPaidOutWins: Number(serverConfig.totalPaidOutWins.toFixed(2)),
      ledger: serverConfig.ledger.slice(0, 50),
      withdrawals: serverConfig.withdrawals,
      depositRequests: serverConfig.depositRequests || [],
      withdrawRequests: serverConfig.withdrawRequests || [],
      transferRequests: serverConfig.transferRequests || [],
      pendingDepositsCount: (serverConfig.depositRequests || []).filter((d) => d.status === 'Pending').length,
      pendingWithdrawalsCount: (serverConfig.withdrawRequests || []).filter((w) => w.status === 'Pending').length,
      pendingTransfersCount: (serverConfig.transferRequests || []).filter((t) => t.status === 'Pending').length,
      totalSupportUnread: (serverConfig.supportMessages || []).filter((m) => m.sender === 'user' && !m.readByAdmin).length,
      totalUsersCount: (serverConfig.users || []).length,
      recoveryRequests: serverConfig.recoveryRequests || [],
      pendingRecoveryCount: (serverConfig.recoveryRequests || []).filter((r) => r.status === 'pending').length,
      announcementTicker: serverConfig.announcementTicker || '🔥 This game has just launched! Join now, start trading, and earn up to 3.8x USDT payouts! 🚀',
    });
  });

  // Authoritative Synchronized Game State for all devices
  app.get('/api/game/state', (req, res) => {
    const timeframeTimers = getTimeframeTimers();
    const latestDraws: { [tf: string]: ServerDrawRecord | null } = {};
    for (const tf of Object.keys(TIMEFRAME_DURATIONS)) {
      const list = serverConfig.drawHistory?.[tf] || [];
      latestDraws[tf] = list.length > 0 ? list[0] : null;
    }
    res.json({
      success: true,
      serverTime: Date.now(),
      btcPrice: currentBtcPrice,
      candles: serverCandles,
      timeframeTimers,
      latestDraws,
    });
  });

  // Official Central Draw History endpoint
  app.get('/api/game/history', (req, res) => {
    const timeframe = (req.query.timeframe as string) || '30s';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    serverConfig.drawHistory = serverConfig.drawHistory || {};
    let history = serverConfig.drawHistory[timeframe] || [];

    // If history is empty or short, merge with deterministic history
    const nowMs = Date.now();
    const duration = TIMEFRAME_DURATIONS[timeframe] || 30;
    const currentIssue = getIssueForTime(nowMs, duration);
    const deterministicList = getDeterministicHistory(timeframe, currentIssue, limit);
    const existingMap = new Map(history.map((d) => [d.issue, d]));
    history = deterministicList.map((d) => existingMap.get(d.issue) || d);

    res.json({
      success: true,
      timeframe,
      btcPrice: currentBtcPrice,
      draws: history.slice(0, limit),
      lastResult: history.length > 0 ? history[0] : null,
    });
  });

  // Active bets across timeframes for a user
  app.get('/api/bets/active', (req, res) => {
    const userId = req.query.userId as string;
    const allBets: ServerBet[] = [];
    for (const [, bets] of activeBets.entries()) {
      for (const b of bets) {
        if (!userId || b.userId === userId) {
          allBets.push(b);
        }
      }
    }
    res.json({ success: true, activeBets: allBets });
  });

  // Public Announcement Ticker Endpoint
  app.get('/api/announcement', (req, res) => {
    res.json({
      success: true,
      ticker: serverConfig.announcementTicker || '🔥 This game has just launched! Join now, start trading, and earn up to 3.8x USDT payouts! 🚀',
    });
  });

  // Admin update announcement
  app.post('/api/admin/announcement', (req, res) => {
    const { ticker } = req.body;
    if (typeof ticker === 'string' && ticker.trim().length > 0) {
      serverConfig.announcementTicker = ticker.trim();
      saveConfig(serverConfig);
    }
    res.json({ success: true, ticker: serverConfig.announcementTicker });
  });

  // 3. Admin Passcode Verification
  app.post('/api/admin/verify-passcode', (req, res) => {
    const { passcode } = req.body;
    if (passcode === serverConfig.passcode) {
      return res.json({ success: true, message: 'Passcode verified' });
    }
    return res.status(401).json({ success: false, message: 'Invalid Master Passcode' });
  });

  // 4. Admin Passcode Change
  app.post('/api/admin/change-passcode', (req, res) => {
    const { currentPasscode, newPasscode } = req.body;
    if (currentPasscode !== serverConfig.passcode) {
      return res.status(401).json({ success: false, message: 'Current passcode is incorrect' });
    }
    if (!newPasscode || newPasscode.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'New passcode must be at least 4 characters' });
    }

    serverConfig.passcode = newPasscode.trim();
    saveConfig(serverConfig);
    console.log(`[Admin] Passcode updated to: ${serverConfig.passcode}`);
    return res.json({ success: true, message: 'Passcode updated successfully' });
  });

  // 5. Update Risk Policy for a Timeframe
  app.post('/api/admin/set-policy', (req, res) => {
    const { timeframe, policy } = req.body;
    if (!timeframe || !policy) {
      return res.status(400).json({ error: 'Missing timeframe or policy' });
    }
    serverConfig.policies[timeframe] = policy;
    saveConfig(serverConfig);
    console.log(`[Admin] Policy updated for ${timeframe}: ${policy}`);
    res.json({ success: true, policies: serverConfig.policies });
  });

  // 6. Reset all policies to 'auto'
  app.post('/api/admin/reset-policies', (req, res) => {
    for (const tf of Object.keys(serverConfig.policies)) {
      serverConfig.policies[tf] = 'auto';
    }
    saveConfig(serverConfig);
    res.json({ success: true, policies: serverConfig.policies });
  });

  // 7. Place a bet (from Game)
  app.post('/api/bets/place', (req, res) => {
    const { userId, timeframe, issue, type, amount } = req.body;
    if (!timeframe || !type || !amount) {
      return res.status(400).json({ error: 'Invalid bet parameters' });
    }

    if (userId && typeof userId === 'string') {
      const cleanUid = userId.trim();
      serverConfig.deletedUserIds = serverConfig.deletedUserIds || [];
      if (serverConfig.deletedUserIds.includes(cleanUid)) {
        return res.status(403).json({ success: false, deleted: true, error: 'Account has been deleted by administrator.' });
      }
    }

    const bet: ServerBet = {
      id: 'bet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: userId || 'Anonymous',
      timeframe,
      issue: issue || 0,
      type,
      amount: Number(amount),
      timestamp: Date.now(),
    };

    if (!activeBets.has(timeframe)) {
      activeBets.set(timeframe, []);
    }
    activeBets.get(timeframe)!.push(bet);
    totalHistoricalVolume += Number(amount);

    console.log(`[Game] Bet placed on ${timeframe}: ${type} - ${amount} USDT`);
    res.json({ success: true, bet });
  });

  // 8. Settle Round - CREDITS LOST BETS DIRECTLY INTO ADMIN / HOUSE VAULT
  app.post('/api/bets/settle-round', (req, res) => {
    const { timeframe, issue, lostBetsTotal = 0, wonBetsTotal = 0, settledBets = [] } = req.body;

    if (timeframe && activeBets.has(timeframe)) {
      activeBets.set(timeframe, []);
    }

    const lostAmount = Number(lostBetsTotal) || 0;
    const wonAmount = Number(wonBetsTotal) || 0;

    // Credit lost bets directly to House Treasury Vault
    serverConfig.totalCollectedLosses += lostAmount;
    serverConfig.totalPaidOutWins += wonAmount;
    serverConfig.houseVaultBalance += (lostAmount - wonAmount);

    // Save recent settled bets in ledger
    if (Array.isArray(settledBets) && settledBets.length > 0) {
      const newEntries: SettledLedgerEntry[] = settledBets.map((b: any) => ({
        id: b.id || 'settle_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timeframe: timeframe || 'unknown',
        issue: issue || b.issue || 0,
        userId: b.userId || 'Player',
        type: b.type,
        amount: Number(b.amount) || 0,
        result: b.result === 'WIN' ? 'WIN' : 'LOSS',
        payout: Number(b.payout) || 0,
        // If loss, house gained 100% of bet; if win, house paid (payout - amount)
        houseImpact: b.result === 'LOSS' ? Number(b.amount) : -(Number(b.payout) - Number(b.amount)),
        timestamp: Date.now(),
      }));

      serverConfig.ledger = [...newEntries, ...serverConfig.ledger].slice(0, 100);
    }

    saveConfig(serverConfig);

    console.log(
      `[Settle] Round on ${timeframe} settled! Lost bets collected: +${lostAmount} USDT. House Vault Balance: ${serverConfig.houseVaultBalance.toFixed(2)} USDT`
    );

    res.json({
      success: true,
      houseVaultBalance: serverConfig.houseVaultBalance,
      totalCollectedLosses: serverConfig.totalCollectedLosses,
      totalPaidOutWins: serverConfig.totalPaidOutWins,
    });
  });

  // 9. Admin Vault Withdrawal (Admin withdrawing collected house profit)
  app.post('/api/admin/vault/withdraw', (req, res) => {
    const { amount, address, network = 'USDT-TRC20' } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }
    if (numAmount > serverConfig.houseVaultBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient vault balance. Available: $${serverConfig.houseVaultBalance.toFixed(2)} USDT`,
      });
    }
    if (!address || address.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid USDT destination address' });
    }

    serverConfig.houseVaultBalance -= numAmount;

    const withdrawal: AdminWithdrawal = {
      id: 'VAULT-WD-' + Math.floor(10000 + Math.random() * 90000),
      amount: numAmount,
      address: address.trim(),
      network,
      timestamp: Date.now(),
      status: 'Sent / Completed',
    };

    serverConfig.withdrawals = [withdrawal, ...(serverConfig.withdrawals || [])];
    saveConfig(serverConfig);

    console.log(`[Admin] Vault withdrawal of ${numAmount} USDT to ${address}`);
    res.json({
      success: true,
      message: `Successfully transferred ${numAmount.toFixed(2)} USDT to ${address}`,
      withdrawal,
      remainingVaultBalance: serverConfig.houseVaultBalance,
    });
  });

  // 9b. Calibrate or Reset Admin Vault Stats
  app.post('/api/admin/vault/calibrate', (req, res) => {
    const { houseVaultBalance, totalCollectedLosses, totalPaidOutWins, resetLedger } = req.body;

    if (typeof houseVaultBalance === 'number') {
      serverConfig.houseVaultBalance = Number(houseVaultBalance);
    }
    if (typeof totalCollectedLosses === 'number') {
      serverConfig.totalCollectedLosses = Math.max(0, Number(totalCollectedLosses));
    }
    if (typeof totalPaidOutWins === 'number') {
      serverConfig.totalPaidOutWins = Math.max(0, Number(totalPaidOutWins));
    }
    if (resetLedger) {
      serverConfig.ledger = [];
    }

    saveConfig(serverConfig);
    console.log(`[Admin] Vault calibrated: Vault=${serverConfig.houseVaultBalance}, Losses=${serverConfig.totalCollectedLosses}, Wins=${serverConfig.totalPaidOutWins}`);
    res.json({
      success: true,
      houseVaultBalance: serverConfig.houseVaultBalance,
      totalCollectedLosses: serverConfig.totalCollectedLosses,
      totalPaidOutWins: serverConfig.totalPaidOutWins,
      ledger: serverConfig.ledger,
    });
  });

  // Official Deposit Wallets Configuration
  app.get('/api/deposit-wallets', (req, res) => {
    res.json({
      success: true,
      wallets: serverConfig.depositWallets || {
        trc20: 'TYu982aXzQkL90123mK912pLq10293',
        bep20: '',
      },
    });
  });

  app.post('/api/admin/deposit-wallets', (req, res) => {
    const { trc20, bep20 } = req.body;
    serverConfig.depositWallets = {
      trc20: trc20 !== undefined ? String(trc20).trim() : (serverConfig.depositWallets?.trc20 || ''),
      bep20: bep20 !== undefined ? String(bep20).trim() : (serverConfig.depositWallets?.bep20 || ''),
    };
    saveConfig(serverConfig);
    console.log(`[Admin] Deposit wallets updated: TRC20=${serverConfig.depositWallets.trc20}, BEP20=${serverConfig.depositWallets.bep20}`);
    res.json({
      success: true,
      message: 'Official deposit wallets updated successfully!',
      wallets: serverConfig.depositWallets,
    });
  });

  // 10. Player Deposit Request (Min: $50 USDT, sent to Admin Dashboard with screenshot proof)
  app.post('/api/user/deposit-request', (req, res) => {
    const { userId, amount, network = 'TRC20', txHash, depositAddress, screenshot } = req.body;
    const numAmount = Number(amount);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    if (isNaN(numAmount) || numAmount < 50) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit amount is 50 USDT. You entered: $' + (isNaN(numAmount) ? 0 : numAmount) + ' USDT',
      });
    }

    const newDeposit: DepositRequest = {
      id: 'DEP-' + Math.floor(100000 + Math.random() * 900000),
      userId,
      amount: Number(numAmount.toFixed(2)),
      network,
      depositAddress: depositAddress || (network === 'TRC20' ? 'TYu982aXzQkL90123mK912pLq10293' : '0x71c...99a2'),
      txHash: txHash && txHash.trim().length > 0 ? txHash.trim() : 'PROOF-IMG-' + Date.now().toString(36).toUpperCase(),
      screenshot: typeof screenshot === 'string' && screenshot.trim().length > 0 ? screenshot.trim() : undefined,
      timestamp: Date.now(),
      status: 'Pending',
    };

    serverConfig.depositRequests = [newDeposit, ...(serverConfig.depositRequests || [])];
    saveConfig(serverConfig);

    console.log(`[Deposit] New request ${newDeposit.id} by ${userId}: $${numAmount} USDT (${network})`);
    res.json({
      success: true,
      message: `Deposit request of ${numAmount.toFixed(2)} USDT submitted to Admin for approval.`,
      request: newDeposit,
    });
  });

  // 11. Player Withdrawal Request (Min: $50 USDT, Max: Available Account Balance, Turnover Policy Enforced)
  app.post('/api/user/withdraw-request', (req, res) => {
    const { userId, amount, address, userBalance, turnoverCompleted, turnoverRequired } = req.body;
    const numAmount = Number(amount);
    const availableBal = Number(userBalance);
    const completedTurnover = Number(turnoverCompleted || 0);
    const reqTurnover = Number(turnoverRequired || 0);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    if (isNaN(numAmount) || numAmount < 50) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is 50 USDT. You entered: $' + (isNaN(numAmount) ? 0 : numAmount) + ' USDT',
      });
    }

    // Turnover Policy Enforcement:
    if (reqTurnover > 0 && completedTurnover < reqTurnover) {
      return res.status(400).json({
        success: false,
        message: `Turnover Requirement Incomplete! You must complete at least $${reqTurnover.toFixed(2)} USDT in trading turnover before requesting a withdrawal. (Completed: $${completedTurnover.toFixed(2)} USDT)`,
      });
    }

    // Check user balance in server database
    serverConfig.users = serverConfig.users || [];
    const dbUser = serverConfig.users.find((u) => u.id === userId);
    const userBalToCheck = dbUser ? dbUser.balance : availableBal;

    if (!isNaN(userBalToCheck) && numAmount > userBalToCheck) {
      return res.status(400).json({
        success: false,
        message: `Withdrawal amount ($${numAmount.toFixed(2)} USDT) cannot exceed your available balance ($${userBalToCheck.toFixed(2)} USDT).`,
      });
    }
    if (!address || address.trim().length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid destination USDT wallet address.',
      });
    }

    const fee = 1.0;
    const netAmount = Math.max(0, numAmount - fee);

    const newWithdraw: WithdrawRequest = {
      id: 'WD-' + Math.floor(100000 + Math.random() * 900000),
      userId,
      amount: Number(numAmount.toFixed(2)),
      networkFee: fee,
      netAmount: Number(netAmount.toFixed(2)),
      address: address.trim(),
      timestamp: Date.now(),
      status: 'Pending',
      turnoverCompleted: completedTurnover,
      turnoverRequired: reqTurnover,
      turnoverStatus: reqTurnover > 0 && completedTurnover < reqTurnover ? 'Incomplete' : 'Satisfied',
    };

    serverConfig.withdrawRequests = [newWithdraw, ...(serverConfig.withdrawRequests || [])];
    if (dbUser) {
      dbUser.balance = Math.max(0, Number((dbUser.balance - numAmount).toFixed(2)));
    }
    saveConfig(serverConfig);

    console.log(`[Withdrawal] New request ${newWithdraw.id} by ${userId}: $${numAmount} USDT to ${address}, turnover: $${completedTurnover}/$${reqTurnover}`);
    res.json({
      success: true,
      message: `Withdrawal request of ${numAmount.toFixed(2)} USDT submitted for verification.`,
      request: newWithdraw,
    });
  });

  // 12. Query Player Requests Status
  app.get('/api/user/requests', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.json({ deposits: [], withdrawals: [], transfers: [] });
    }
    const deposits = (serverConfig.depositRequests || []).filter((d) => d.userId === userId);
    const withdrawals = (serverConfig.withdrawRequests || []).filter((w) => w.userId === userId);
    const transfers = (serverConfig.transferRequests || []).filter(
      (t) => t.senderId === userId || t.recipientId === userId
    );
    res.json({ deposits, withdrawals, transfers });
  });

  // 12b. Player P2P Transfer Request (Funds held & submitted to Admin for approval)
  app.post('/api/user/transfer-request', (req, res) => {
    const { senderId, recipientId, amount } = req.body;
    const numAmount = Number(amount);

    if (!senderId || !recipientId) {
      return res.status(400).json({ success: false, message: 'Sender and Recipient IDs are required' });
    }
    if (isNaN(numAmount) || numAmount < 1) {
      return res.status(400).json({ success: false, message: 'Minimum transfer amount is 1.00 USDT' });
    }

    serverConfig.users = serverConfig.users || [];
    const cleanSender = String(senderId).trim();
    const sender = serverConfig.users.find(
      (u) => u.id === cleanSender || u.id.replace('USR-', '') === cleanSender.replace('USR-', '')
    );
    if (!sender) {
      return res.status(404).json({ success: false, message: 'Sender user account not found' });
    }

    const cleanRecipientQuery = String(recipientId).trim().toLowerCase();
    const cleanRecipientId = cleanRecipientQuery.replace('usr-', '');
    const recipient = serverConfig.users.find((u) => {
      const uClean = u.id.toLowerCase().replace('usr-', '');
      return (
        uClean === cleanRecipientId ||
        u.id.toLowerCase() === cleanRecipientQuery ||
        u.username.toLowerCase() === cleanRecipientQuery ||
        u.email.toLowerCase() === cleanRecipientQuery
      );
    });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: `Recipient "${recipientId}" not found. Please verify the Player ID or Username.`,
      });
    }

    if (recipient.id === sender.id) {
      return res.status(400).json({ success: false, message: 'Cannot transfer funds to your own account.' });
    }

    if (sender.balance < numAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${sender.balance.toFixed(2)} USDT`,
      });
    }

    // Deduct from sender balance pending Admin approval
    sender.balance = Math.max(0, Number((sender.balance - numAmount).toFixed(2)));

    const newTransfer: TransferRequest = {
      id: 'TRF-' + Math.floor(100000 + Math.random() * 900000),
      senderId: sender.id,
      senderName: sender.username,
      recipientId: recipient.id,
      recipientName: recipient.username,
      amount: Number(numAmount.toFixed(2)),
      timestamp: Date.now(),
      status: 'Pending',
    };

    serverConfig.transferRequests = [newTransfer, ...(serverConfig.transferRequests || [])];
    saveConfig(serverConfig);

    console.log(`[Transfer] New request ${newTransfer.id}: ${sender.id} -> ${recipient.id} ($${numAmount} USDT)`);
    res.json({
      success: true,
      message: `Transfer request of ${numAmount.toFixed(2)} USDT submitted for verification.`,
      request: newTransfer,
      newBalance: sender.balance,
    });
  });

  // 13. Admin Action: Approve / Reject Deposit Request
  app.post('/api/admin/requests/deposit-action', (req, res) => {
    const { id, action, creditedAmount, rejectionReason } = req.body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action parameters' });
    }

    const reqItem = (serverConfig.depositRequests || []).find((d) => d.id === id);
    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }

    const wasPending = reqItem.status === 'Pending';
    reqItem.status = action === 'approve' ? 'Approved' : 'Rejected';
    reqItem.reviewedAt = Date.now();

    serverConfig.users = serverConfig.users || [];
    const dbUser = serverConfig.users.find((u) => u.id === reqItem.userId);

    if (action === 'approve') {
      if (creditedAmount && Number(creditedAmount) > 0) {
        reqItem.amount = Number(Number(creditedAmount).toFixed(2));
      }
      if (wasPending && dbUser) {
        dbUser.balance = Number(((dbUser.balance || 0) + reqItem.amount).toFixed(2));
        console.log(`[Admin] Deposit credited: +${reqItem.amount} USDT to ${dbUser.id}. New balance: ${dbUser.balance}`);
      }
    }
    if (action === 'reject') {
      reqItem.rejectionReason = rejectionReason || 'Verification declined';
    }

    saveConfig(serverConfig);
    console.log(`[Admin] Deposit ${id} ${reqItem.status} for ${reqItem.userId}`);

    res.json({
      success: true,
      message: `Deposit request ${id} ${reqItem.status.toLowerCase()} successfully`,
      request: reqItem,
      userBalance: dbUser?.balance,
    });
  });

  // 14. Admin Action: Approve / Reject Withdrawal Request
  app.post('/api/admin/requests/withdraw-action', (req, res) => {
    const { id, action, txHash, rejectionReason } = req.body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action parameters' });
    }

    const reqItem = (serverConfig.withdrawRequests || []).find((w) => w.id === id);
    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    const wasPending = reqItem.status === 'Pending';
    reqItem.status = action === 'approve' ? 'Approved' : 'Rejected';
    reqItem.reviewedAt = Date.now();

    serverConfig.users = serverConfig.users || [];
    const dbUser = serverConfig.users.find((u) => u.id === reqItem.userId);

    if (action === 'approve') {
      reqItem.txHash = txHash || '0x' + Math.random().toString(16).substring(2, 18);
    } else {
      reqItem.rejectionReason = rejectionReason || 'Declined (funds refunded to balance)';
      reqItem.refunded = true;
      // AUTOMATIC REFUND: Refund the deducted withdrawal amount back to user's balance
      if (wasPending && dbUser) {
        dbUser.balance = Number(((dbUser.balance || 0) + reqItem.amount).toFixed(2));
        console.log(`[Admin] Automatic Refund: Returned +${reqItem.amount} USDT to user ${dbUser.id}. New balance: ${dbUser.balance}`);
      }
    }

    saveConfig(serverConfig);
    console.log(`[Admin] Withdrawal ${id} ${reqItem.status} for ${reqItem.userId}`);

    res.json({
      success: true,
      message: `Withdrawal request ${id} ${reqItem.status.toLowerCase()} successfully`,
      request: reqItem,
      userBalance: dbUser?.balance,
    });
  });

  // 14b. Admin Action: Approve / Reject Player Transfer Request
  app.post('/api/admin/requests/transfer-action', (req, res) => {
    const { id, action, rejectionReason } = req.body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action parameters' });
    }

    serverConfig.transferRequests = serverConfig.transferRequests || [];
    const reqItem = serverConfig.transferRequests.find((t) => t.id === id);
    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'Transfer request not found' });
    }

    if (reqItem.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Transfer request is already ${reqItem.status}` });
    }

    serverConfig.users = serverConfig.users || [];
    const sender = serverConfig.users.find((u) => u.id === reqItem.senderId);
    const recipient = serverConfig.users.find((u) => u.id === reqItem.recipientId);

    reqItem.reviewedAt = Date.now();

    if (action === 'approve') {
      reqItem.status = 'Approved';
      // Deliver funds to recipient
      if (recipient) {
        recipient.balance = Number(((recipient.balance || 0) + reqItem.amount).toFixed(2));
        console.log(`[Admin] Transfer Approved: Delivered +${reqItem.amount} USDT to recipient ${recipient.id}. New balance: ${recipient.balance}`);
      }
    } else {
      reqItem.status = 'Rejected';
      reqItem.refunded = true;
      reqItem.rejectionReason = rejectionReason || 'Transfer declined (funds refunded)';
      // Refund sender
      if (sender) {
        sender.balance = Number(((sender.balance || 0) + reqItem.amount).toFixed(2));
        console.log(`[Admin] Transfer Rejected: Refunded +${reqItem.amount} USDT back to sender ${sender.id}. New balance: ${sender.balance}`);
      }
    }

    saveConfig(serverConfig);
    console.log(`[Admin] Transfer ${id} ${reqItem.status}: ${reqItem.senderId} -> ${reqItem.recipientId} ($${reqItem.amount})`);

    res.json({
      success: true,
      message: `Transfer request ${id} ${reqItem.status.toLowerCase()} successfully`,
      request: reqItem,
      senderBalance: sender?.balance,
      recipientBalance: recipient?.balance,
    });
  });

  // 15. User & Admin: Get Support Messages for a User
  app.get('/api/support/messages', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.json({ success: true, messages: [] });
    }
    serverConfig.supportMessages = serverConfig.supportMessages || [];
    const messages = serverConfig.supportMessages.filter((m) => m.userId === userId);
    
    // If request comes with forUser=true, mark admin messages as read by user
    if (req.query.forUser === 'true') {
      let updated = false;
      messages.forEach((m) => {
        if (m.sender === 'admin' && !m.readByUser) {
          m.readByUser = true;
          updated = true;
        }
      });
      if (updated) saveConfig(serverConfig);
    }

    res.json({ success: true, messages });
  });

  // 16. User & Admin: Send Support Message
  app.post('/api/support/send', (req, res) => {
    const { userId, message, sender = 'user' } = req.body;
    if (!userId || !message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content and userId are required' });
    }

    serverConfig.supportMessages = serverConfig.supportMessages || [];
    const newMsg: SupportMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      sender: sender === 'admin' ? 'admin' : 'user',
      message: message.trim(),
      timestamp: Date.now(),
      readByAdmin: sender === 'admin',
      readByUser: sender === 'user',
    };

    serverConfig.supportMessages.push(newMsg);
    saveConfig(serverConfig);

    console.log(`[Support] [${newMsg.sender.toUpperCase()}] to/from ${userId}: ${newMsg.message.substring(0, 45)}`);

    res.json({
      success: true,
      message: newMsg,
    });
  });

  // 17. Admin: Get All Support Threads / Chats Grouped by User
  app.get('/api/admin/support/chats', (req, res) => {
    serverConfig.supportMessages = serverConfig.supportMessages || [];
    const allMsgs = serverConfig.supportMessages;

    interface ChatThread {
      userId: string;
      lastMessage: string;
      lastSender: 'user' | 'admin';
      lastTimestamp: number;
      unreadCount: number;
      totalMessages: number;
    }

    const threadMap = new Map<string, ChatThread>();

    allMsgs.forEach((m) => {
      const isUnread = m.sender === 'user' && !m.readByAdmin;
      const existing = threadMap.get(m.userId);
      if (!existing) {
        threadMap.set(m.userId, {
          userId: m.userId,
          lastMessage: m.message,
          lastSender: m.sender,
          lastTimestamp: m.timestamp,
          unreadCount: isUnread ? 1 : 0,
          totalMessages: 1,
        });
      } else {
        existing.totalMessages += 1;
        if (isUnread) existing.unreadCount += 1;
        if (m.timestamp >= existing.lastTimestamp) {
          existing.lastMessage = m.message;
          existing.lastSender = m.sender;
          existing.lastTimestamp = m.timestamp;
        }
      }
    });

    const threads = Array.from(threadMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    const totalUnread = threads.reduce((acc, t) => acc + t.unreadCount, 0);

    res.json({
      success: true,
      threads,
      totalUnread,
    });
  });

  // 18. Admin: Reply to Support Chat & Mark Thread as Read
  app.post('/api/admin/support/reply', (req, res) => {
    const { userId, message } = req.body;
    if (!userId || !message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content and userId are required' });
    }

    serverConfig.supportMessages = serverConfig.supportMessages || [];

    // Mark previous user messages in thread as read by admin
    serverConfig.supportMessages.forEach((m) => {
      if (m.userId === userId && m.sender === 'user') {
        m.readByAdmin = true;
      }
    });

    const adminMsg: SupportMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      sender: 'admin',
      message: message.trim(),
      timestamp: Date.now(),
      readByAdmin: true,
      readByUser: false,
    };

    serverConfig.supportMessages.push(adminMsg);
    saveConfig(serverConfig);

    console.log(`[Admin Reply] To user ${userId}: ${adminMsg.message.substring(0, 45)}`);

    res.json({
      success: true,
      message: adminMsg,
    });
  });

  // 19. Admin: Mark Thread Read
  app.post('/api/admin/support/mark-read', (req, res) => {
    const { userId } = req.body;
    if (userId && serverConfig.supportMessages) {
      serverConfig.supportMessages.forEach((m) => {
        if (m.userId === userId && m.sender === 'user') {
          m.readByAdmin = true;
        }
      });
      saveConfig(serverConfig);
    }
    res.json({ success: true });
  });

  // 20. Admin: Clear or Delete Support Thread
  app.post('/api/admin/support/clear-thread', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }
    serverConfig.supportMessages = (serverConfig.supportMessages || []).filter((m) => m.userId !== userId);
    saveConfig(serverConfig);
    res.json({ success: true, message: `Chat thread for ${userId} cleared` });
  });

  // 21. User Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, referralCode } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    serverConfig.users = serverConfig.users || [];

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if username already exists
    const existingUser = serverConfig.users.find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase() || u.email.toLowerCase() === cleanEmail
    );
    if (existingUser) {
      if (existingUser.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Username is already taken' });
      }
      return res.status(400).json({ success: false, message: 'Email is already registered. Please log in.' });
    }

    // Generate unique 6-digit User ID
    let newUid = 'USR-' + Math.floor(100000 + Math.random() * 900000);
    while (serverConfig.users.some((u) => u.id === newUid)) {
      newUid = 'USR-' + Math.floor(100000 + Math.random() * 900000);
    }

    const userRefCode = 'CWP-' + newUid.replace('USR-', '');
    let referredBy: string | null = null;
    let referrerId: string | null = null;
    let initialBalance = 0.0; // Defaults to 0.00 unless registered via referral invite

    // Check referral code
    if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
      const trimmedRef = referralCode.trim().toUpperCase();
      const referrer = serverConfig.users.find((u) =>
        (u.referralCode && u.referralCode.toUpperCase() === trimmedRef) ||
        (u.id && u.id.toUpperCase() === trimmedRef) ||
        ('CWP-' + u.id.replace('USR-', '').toUpperCase() === trimmedRef) ||
        ('PKW-' + u.id.replace('USR-', '').toUpperCase() === trimmedRef) ||
        ('REF' + u.id.replace('USR-', '').toUpperCase() === trimmedRef) ||
        (u.username && u.username.toUpperCase() === trimmedRef)
      );
      if (referrer) {
        referredBy = referrer.username;
        referrerId = referrer.id;
        initialBalance = 2.0; // Grant $2.00 welcome bonus to invited player
        referrer.balance = Number(((referrer.balance || 0) + 2.0).toFixed(2)); // Grant $2.00 reward to referrer
        
        serverConfig.referralRecords = serverConfig.referralRecords || [];
        const maskedEmail = cleanEmail.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c);
        serverConfig.referralRecords.unshift({
          id: 'REF-REC-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900),
          referrerId: referrer.id,
          referrerUsername: referrer.username,
          referrerCode: referrer.referralCode,
          invitedUserId: newUid,
          invitedUsername: cleanUsername,
          invitedEmailMasked: maskedEmail,
          bonusAmount: 2.0,
          registeredAt: Date.now(),
          status: 'Rewarded',
        });

        console.log(`[Referral] User ${cleanUsername} (${newUid}) registered via referrer ${referrer.username} (${referrer.id}). Both awarded $2.00 USDT.`);
      }
    }

    const newUser: RegisteredUser = {
      id: newUid,
      username: cleanUsername,
      email: cleanEmail,
      password: password, // For administrative record & recovery
      referralCode: userRefCode,
      referredBy: referredBy,
      referrerId: referrerId,
      balance: initialBalance,
      registeredAt: Date.now(),
      lastLoginAt: Date.now(),
      status: 'active',
    };

    serverConfig.users.push(newUser);
    saveConfig(serverConfig);

    console.log(`[Auth] Registered new user: ${newUser.username} (${newUser.id}) with balance $${newUser.balance}`);

    // Return sanitized user object
    const { password: _, ...safeUser } = newUser;
    res.json({
      success: true,
      message: 'Account registered successfully!',
      user: safeUser,
    });
  });

  // 22. User Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and Password are required' });
    }

    serverConfig.users = serverConfig.users || [];
    const cleanLogin = login.trim().toLowerCase();

    const user = serverConfig.users.find(
      (u) => u.username.toLowerCase() === cleanLogin || u.email.toLowerCase() === cleanLogin
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found. Please check credentials or register.' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account is temporarily suspended. Please contact customer support.',
      });
    }

    user.lastLoginAt = Date.now();
    saveConfig(serverConfig);

    console.log(`[Auth] User logged in: ${user.username} (${user.id})`);

    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Login successful!',
      user: safeUser,
    });
  });

  // 23. User Auth: Get Me / Profile
  app.get('/api/auth/me', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    serverConfig.users = serverConfig.users || [];
    serverConfig.deletedUserIds = serverConfig.deletedUserIds || [];

    if (serverConfig.deletedUserIds.includes(userId)) {
      return res.status(404).json({ success: false, deleted: true, message: 'Account permanently deleted' });
    }

    const user = serverConfig.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, deleted: true, message: 'User not found or deleted' });
    }

    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      user: safeUser,
    });
  });

  // 24. User Balance Query & Delta Sync (Authoritative Server Balance)
  app.get('/api/user/balance', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }
    serverConfig.users = serverConfig.users || [];
    serverConfig.deletedUserIds = serverConfig.deletedUserIds || [];

    if (serverConfig.deletedUserIds.includes(userId)) {
      return res.status(404).json({ success: false, deleted: true, message: 'Account deleted' });
    }

    const user = serverConfig.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, deleted: true, message: 'User not found or deleted' });
    }
    res.json({ success: true, balance: user.balance, status: user.status });
  });

  // 25. User Referrals: Query team members who joined via this user's link
  app.get('/api/user/referrals', (req, res) => {
    const userId = ((req.query.userId as string) || '').trim();
    const referralCode = ((req.query.referralCode as string) || '').trim().toUpperCase();
    const username = ((req.query.username as string) || '').trim().toLowerCase();

    if (!userId && !referralCode && !username) {
      return res.status(400).json({ success: false, message: 'User identification required' });
    }

    serverConfig.users = serverConfig.users || [];
    serverConfig.referralRecords = serverConfig.referralRecords || [];

    // Find the current user in server records if exists
    const user = serverConfig.users.find(
      (u) =>
        (userId && u.id.toLowerCase() === userId.toLowerCase()) ||
        (referralCode && u.referralCode.toUpperCase() === referralCode) ||
        (username && u.username.toLowerCase() === username)
    );

    const targetUserId = user ? user.id : userId;
    const targetRefCode = user ? user.referralCode.toUpperCase() : referralCode;
    const targetUsername = user ? user.username.toLowerCase() : username;

    const combinedMap = new Map<string, any>();

    // 1. Check all registered users who have referredBy or referrerId matching this user
    for (const u of serverConfig.users) {
      if (targetUserId && u.id === targetUserId) continue; // do not include self
      const matches =
        (targetUserId && (u.referrerId === targetUserId || u.referredBy === targetUserId)) ||
        (targetUsername && u.referredBy && u.referredBy.toLowerCase() === targetUsername) ||
        (targetRefCode && u.referredBy && u.referredBy.toUpperCase() === targetRefCode);

      if (matches) {
        const maskedEmail = (u.email || '').replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c);
        combinedMap.set(u.id, {
          id: u.id,
          name: u.username,
          email: maskedEmail,
          joinDate: new Date(u.registeredAt || Date.now()).toISOString().split('T')[0],
          joinDateTime: new Date(u.registeredAt || Date.now()).toLocaleString(),
          registeredAt: u.registeredAt || Date.now(),
          commission: 2.0,
          tier: 'Direct Invite',
          status: 'Joined & Bonus Awarded',
        });
      }
    }

    // 2. Check referralRecords log
    for (const rec of serverConfig.referralRecords) {
      const matchesLog =
        (targetUserId && rec.referrerId === targetUserId) ||
        (targetRefCode && rec.referrerCode.toUpperCase() === targetRefCode) ||
        (targetUsername && rec.referrerUsername.toLowerCase() === targetUsername);

      if (matchesLog && !combinedMap.has(rec.invitedUserId)) {
        combinedMap.set(rec.invitedUserId, {
          id: rec.invitedUserId,
          name: rec.invitedUsername,
          email: rec.invitedEmailMasked,
          joinDate: new Date(rec.registeredAt).toISOString().split('T')[0],
          joinDateTime: new Date(rec.registeredAt).toLocaleString(),
          registeredAt: rec.registeredAt,
          commission: rec.bonusAmount || 2.0,
          tier: 'Direct Invite',
          status: 'Joined & Bonus Awarded',
        });
      }
    }

    const list = Array.from(combinedMap.values()).sort((a, b) => b.registeredAt - a.registeredAt);
    const totalCommission = list.reduce((sum, item) => sum + (item.commission || 2.0), 0);

    res.json({
      success: true,
      totalInvited: list.length,
      totalCommission: totalCommission,
      referrals: list,
    });
  });

  app.post('/api/user/sync-balance', (req, res) => {
    const { userId, action, delta } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Valid userId required' });
    }

    serverConfig.users = serverConfig.users || [];
    serverConfig.deletedUserIds = serverConfig.deletedUserIds || [];

    if (serverConfig.deletedUserIds.includes(userId)) {
      return res.status(404).json({ success: false, deleted: true, message: 'Account permanently deleted' });
    }

    const user = serverConfig.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, deleted: true, message: 'User not found or deleted' });
    }

    // Only modify server balance if client provides an explicit transactional trade delta
    if (action === 'trade' && typeof delta === 'number') {
      user.balance = Math.max(0, Number((user.balance + delta).toFixed(2)));
      saveConfig(serverConfig);
    }

    // Return the single source of truth balance from server database
    res.json({ success: true, balance: user.balance, status: user.status });
  });

  // 25. Admin: Get All Registered Users
  app.get('/api/admin/users', (req, res) => {
    serverConfig.users = serverConfig.users || [];
    const users = [...serverConfig.users].sort(
      (a, b) => (b.registeredAt || 0) - (a.registeredAt || 0) || a.id.localeCompare(b.id)
    );

    const totalBalance = users.reduce((acc, u) => acc + (u.balance || 0), 0);
    const activeCount = users.filter((u) => u.status === 'active').length;
    const suspendedCount = users.filter((u) => u.status === 'suspended').length;

    res.json({
      success: true,
      users,
      stats: {
        total: users.length,
        active: activeCount,
        suspended: suspendedCount,
        totalBalance: Number(totalBalance.toFixed(2)),
      },
    });
  });

  // 26. Admin: Toggle User Status (Active / Suspended)
  app.post('/api/admin/users/status', (req, res) => {
    const { userId, status } = req.body;
    if (!userId || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid userId and status required' });
    }

    serverConfig.users = serverConfig.users || [];
    const user = serverConfig.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = status;
    saveConfig(serverConfig);

    res.json({
      success: true,
      message: `User ${user.username} is now ${status}`,
      user,
    });
  });

  // 27. Admin: Adjust User Balance (Strict Add / Deduct / Set with Real-time Logging)
  app.post('/api/admin/users/balance', (req, res) => {
    const { userId, amount, mode } = req.body; // mode: 'set' | 'add' | 'subtract'
    const numAmount = Number(amount);
    if (!userId || isNaN(numAmount)) {
      return res.status(400).json({ success: false, message: 'userId and numeric amount required' });
    }

    serverConfig.users = serverConfig.users || [];
    const user = serverConfig.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const prevBalance = Number(user.balance || 0);
    if (mode === 'add') {
      user.balance = Number((prevBalance + numAmount).toFixed(2));
    } else if (mode === 'subtract') {
      user.balance = Math.max(0, Number((prevBalance - numAmount).toFixed(2)));
    } else {
      user.balance = Math.max(0, Number(numAmount.toFixed(2)));
    }

    saveConfig(serverConfig);
    console.log(`[Admin] Balance adjusted for ${user.username} (${user.id}): was $${prevBalance}, mode=${mode} $${numAmount} -> now $${user.balance}`);

    res.json({
      success: true,
      message: `Balance for ${user.username} updated from $${prevBalance.toFixed(2)} to $${user.balance.toFixed(2)}`,
      user,
    });
  });

  // 28. Admin: Delete User
  app.post('/api/admin/users/delete', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    const cleanUid = String(userId).trim();
    serverConfig.users = serverConfig.users || [];
    serverConfig.deletedUserIds = serverConfig.deletedUserIds || [];

    const initialLen = serverConfig.users.length;
    serverConfig.users = serverConfig.users.filter((u) => u.id !== cleanUid);

    if (!serverConfig.deletedUserIds.includes(cleanUid)) {
      serverConfig.deletedUserIds.push(cleanUid);
    }

    // Kill any active real-time client sessions matching this deleted user
    for (const [clientId] of activeClients.entries()) {
      if (clientId.includes(cleanUid)) {
        activeClients.delete(clientId);
      }
    }

    saveConfig(serverConfig);
    console.log(`[Admin] User ${cleanUid} was permanently deleted and added to deleted blacklist.`);

    res.json({
      success: true,
      deleted: true,
      message: serverConfig.users.length < initialLen ? 'User deleted successfully' : 'User marked permanently deleted',
    });
  });

  // 29. Admin: Reset/Update User Password
  app.post('/api/admin/users/password', (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || !String(newPassword).trim()) {
      return res.status(400).json({ success: false, message: 'User ID and new password are required' });
    }

    serverConfig.users = serverConfig.users || [];
    const user = serverConfig.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const cleanPass = String(newPassword).trim();
    user.password = cleanPass;
    saveConfig(serverConfig);

    console.log(`[Admin] Admin updated password for user ${user.username} (${user.id}) to: ${cleanPass}`);

    res.json({
      success: true,
      message: `Password for @${user.username} successfully updated to "${cleanPass}"`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        password: user.password,
      },
    });
  });

  // 30. User: Submit Account Ownership Proof / Password Recovery Request
  app.post('/api/auth/recovery-request', (req, res) => {
    const { usernameOrEmail, claimedBalance, depositProofSlip, userNotes } = req.body;
    if (!usernameOrEmail || !String(usernameOrEmail).trim()) {
      return res.status(400).json({ success: false, message: 'Username or Registered Email is required' });
    }

    const cleanInput = String(usernameOrEmail).trim().toLowerCase();
    serverConfig.users = serverConfig.users || [];
    const matchedUser = serverConfig.users.find(
      (u) => u.username.toLowerCase() === cleanInput || u.email.toLowerCase() === cleanInput
    );

    const newReq: PasswordRecoveryRequest = {
      id: 'REC-' + Math.floor(100000 + Math.random() * 900000),
      usernameOrEmail: String(usernameOrEmail).trim(),
      claimedBalance: claimedBalance ? String(claimedBalance).trim() : undefined,
      depositProofSlip: depositProofSlip || undefined,
      userNotes: userNotes ? String(userNotes).trim() : undefined,
      createdAt: Date.now(),
      status: 'pending',
      matchedUserId: matchedUser?.id,
      matchedUsername: matchedUser?.username,
      currentPassword: matchedUser?.password,
    };

    serverConfig.recoveryRequests = serverConfig.recoveryRequests || [];
    serverConfig.recoveryRequests.unshift(newReq);

    // If matched with registered user, push a notification in support chat
    if (matchedUser) {
      serverConfig.supportMessages = serverConfig.supportMessages || [];
      serverConfig.supportMessages.push({
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        userId: matchedUser.id,
        sender: 'user',
        message: `[🔐 Account Recovery Ticket #${newReq.id}]\nUser requested Password Reset.\nClaimed Balance: ${claimedBalance || 'Not specified'}\nNote: ${userNotes || 'None'}`,
        timestamp: Date.now(),
        readByAdmin: false,
        readByUser: true,
      });
    }

    saveConfig(serverConfig);
    console.log(`[Recovery] New recovery request ${newReq.id} for ${newReq.usernameOrEmail} (matched: ${matchedUser?.username || 'none'})`);

    res.json({
      success: true,
      requestId: newReq.id,
      matched: !!matchedUser,
      message: 'Account ownership verification submitted! Waiting for Admin verification.',
    });
  });

  // 31. User: Check/Poll Password Recovery Request Status
  app.get('/api/auth/recovery-request/:id', (req, res) => {
    const { id } = req.params;
    serverConfig.recoveryRequests = serverConfig.recoveryRequests || [];
    const reqItem = serverConfig.recoveryRequests.find((r) => r.id === id);

    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'Recovery request not found' });
    }

    res.json({
      success: true,
      request: {
        id: reqItem.id,
        status: reqItem.status,
        newPassword: reqItem.newPassword,
        matchedUsername: reqItem.matchedUsername,
        createdAt: reqItem.createdAt,
        resolvedAt: reqItem.resolvedAt,
        adminNotes: reqItem.adminNotes,
      },
    });
  });

  // 32. Admin: Get All Password Recovery Requests
  app.get('/api/admin/recovery-requests', (req, res) => {
    serverConfig.recoveryRequests = serverConfig.recoveryRequests || [];
    const pendingCount = serverConfig.recoveryRequests.filter((r) => r.status === 'pending').length;

    // Attach current user balance if matched
    const requestsWithData = serverConfig.recoveryRequests.map((r) => {
      let actualBalance: number | undefined = undefined;
      if (r.matchedUserId) {
        const u = serverConfig.users.find((user) => user.id === r.matchedUserId);
        if (u) {
          actualBalance = u.balance;
          // Keep currentPassword fresh
          r.currentPassword = u.password;
        }
      }
      return {
        ...r,
        actualBalance,
      };
    });

    res.json({
      success: true,
      requests: requestsWithData,
      pendingCount,
    });
  });

  // 33. Admin: Resolve Password Recovery Request (Approve & Set Password / Reject)
  app.post('/api/admin/recovery-requests/resolve', (req, res) => {
    const { requestId, action, newPassword, adminNotes } = req.body;
    serverConfig.recoveryRequests = serverConfig.recoveryRequests || [];
    const rec = serverConfig.recoveryRequests.find((r) => r.id === requestId);

    if (!rec) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (action === 'approve') {
      const passToSet = (newPassword && String(newPassword).trim()) || rec.currentPassword || 'Pass786';
      rec.status = 'approved';
      rec.newPassword = passToSet;
      rec.adminNotes = adminNotes || 'Approved by Admin';
      rec.resolvedAt = Date.now();

      // Update actual user in database!
      if (rec.matchedUserId) {
        const user = serverConfig.users.find((u) => u.id === rec.matchedUserId);
        if (user) {
          user.password = passToSet;
          console.log(`[Recovery] User ${user.username} password updated to: ${passToSet}`);
        }
      }

      // Also notify in support thread
      if (rec.matchedUserId) {
        serverConfig.supportMessages = serverConfig.supportMessages || [];
        serverConfig.supportMessages.push({
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          userId: rec.matchedUserId,
          sender: 'admin',
          message: `✅ [Password Reset Approved] Your account password has been updated to: ${passToSet}`,
          timestamp: Date.now(),
          readByAdmin: true,
          readByUser: false,
        });
      }
    } else {
      rec.status = 'rejected';
      rec.adminNotes = adminNotes || 'Rejected by Admin';
      rec.resolvedAt = Date.now();
    }

    saveConfig(serverConfig);

    res.json({
      success: true,
      message: `Recovery request ${rec.id} marked as ${rec.status}`,
      request: rec,
    });
  });

  // Health check endpoints for Cloud Run and container uptime monitoring
  app.get(['/health', '/healthz', '/api/health'], (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
  });

  // Serve Frontend / Vite
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, 'dist/index.html'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Common /admin URLs are disguised: automatically redirect to the game so curious users find nothing
    app.get(['/admin', '/admin.html'], (req, res) => {
      res.redirect('/');
    });

    // Secret Owner-Only Admin Routes
    app.get(['/cwp-master-786', '/cwp-owner-portal', '/admin-secret'], async (req, res, next) => {
      try {
        const adminHtmlPath = path.resolve(__dirname, 'admin.html');
        let template = fs.readFileSync(adminHtmlPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get(['/admin', '/admin.html'], (req, res) => {
      res.redirect('/');
    });
    app.get(['/cwp-master-786', '/cwp-owner-portal', '/admin-secret'], (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/admin.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  startServerGameEngine();

  // Primary listener on port 3000 (required for AI Studio dev proxy & iframe)
  const server3000 = app.listen(3000, '0.0.0.0', () => {
    console.log(`✨ Crypto Platform Server running on port 3000`);
    console.log(`🎮 Game: http://localhost:3000/`);
    console.log(`🛡️ Admin: http://localhost:3000/cwp-master-786`);
  });

  server3000.on('error', (err: any) => {
    if (err.code !== 'EADDRINUSE') {
      console.error('[Server 3000 Error]:', err);
    }
  });

  // Support Cloud Run deployment where ingress expects container to listen on process.env.PORT (e.g. 8080)
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  if (envPort && envPort !== 3000) {
    const cloudRunServer = app.listen(envPort, '0.0.0.0', () => {
      console.log(`🚀 Live Cloud Run service listening on PORT ${envPort}`);
    });

    cloudRunServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Info] Port ${envPort} already bound (reverse proxy in dev), running primary on 3000.`);
      } else {
        console.error(`[Server ${envPort} Error]:`, err);
      }
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
