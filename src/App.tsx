/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  RotateCw,
  Bell,
  User,
  CheckCircle2,
  X,
  QrCode,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Wallet,
  ArrowRight,
  Info,
  Copy,
  Layers,
  Sparkles,
  Trophy,
  History,
  Timer,
  Check,
  Flame,
  Award,
  AlertTriangle,
  Lock,
  Users,
  Gift,
  Share2,
  DollarSign,
  Sliders,
  Cpu,
  ShieldAlert,
  Settings,
  Coins,
  Download,
  Power,
  Upload,
  Image,
  Trash2,
  Camera,
  Headphones,
  Briefcase,
  Eye,
  EyeOff,
  ArrowLeftRight,
  LogOut,
  Edit3,
  Send,
  MessageSquare,
  MessageCircle,
  LogIn,
  UserPlus,
  Mail,
  Key,
  RefreshCw
} from 'lucide-react';
import {
  getSynchronizedTimeframe,
  setServerTimeOffset,
  getServerTimeOffset,
} from './utils/timeframeSync';
import {
  getDeterministicBtcPrice,
  getDeterministicDraw,
  getDeterministicCandles,
  parseDrawResultFromPrice,
} from './utils/cryptoPriceEngine';

export interface UserSession {
  id: string;
  username: string;
  email: string;
  balance: number;
  referralCode: string;
  referredBy?: string | null;
  registeredAt?: number;
  status: 'active' | 'suspended';
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface BetRecord {
  id: string;
  userId?: string;
  timeframe: string;
  issue: number;
  type: string;
  amount: number;
  result: 'WIN' | 'LOSS';
  payout: number;
  time: string;
  timestamp?: number;
}

interface DrawRecord {
  id: string;
  userId?: string;
  issue: number;
  timeframe: string;
  price: string;
  d1: number;
  d2: number;
  d3: number;
  sum: number;
  tags: string[];
  time: string;
  userBets?: BetRecord[];
}

interface DepositRecord {
  id: string;
  userId?: string;
  amount: number;
  network: string;
  time: string;
  status: string;
  screenshot?: string;
  rejectionReason?: string;
}

interface WithdrawRecord {
  id: string;
  userId?: string;
  amount: number;
  address: string;
  time: string;
  status: string;
  txHash?: string;
  rejectionReason?: string;
  refunded?: boolean;
  turnoverCompleted?: number;
  turnoverRequired?: number;
}

interface TransferRecord {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  amount: number;
  timestamp: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  refunded?: boolean;
}

interface ReferralFriend {
  id: string;
  name: string;
  joinDate: string;
  joinDateTime?: string;
  registeredAt?: number;
  email?: string;
  betsCount?: number;
  totalVolume?: number;
  commission: number;
  tier: string;
  status?: string;
}

interface ActiveBet {
  userId?: string;
  type: string;
  amount: number;
  multiplier: number;
  issue?: number;
  timeframe?: string;
}

interface TimeframeState {
  duration: number;
  timer: number;
  currentIssue: number;
  activeBets: ActiveBet[];
  lastResult: {
    price: string;
    math: string;
    tags: string[];
    issue: number;
  } | null;
  candles: Candle[];
}

// Initial sample draws to populate Lottery Draw view (STRICTLY rounds with user bets)
const INITIAL_SAMPLE_DRAWS: DrawRecord[] = [
  {
    id: 'DR-89021',
    issue: 202609220029,
    timeframe: '30s',
    price: '86618.35',
    d1: 8,
    d2: 3,
    d3: 5,
    sum: 16,
    tags: ['Big', 'Double', 'Big Double'],
    time: 'Just now',
    userBets: [
      {
        id: 'BET-INIT-1',
        timeframe: '30s',
        issue: 202609220029,
        type: 'Big',
        amount: 10,
        result: 'WIN',
        payout: 19.5,
        time: 'Just now',
      },
    ],
  },
  {
    id: 'DR-89019',
    issue: 202609220027,
    timeframe: '30s',
    price: '86609.92',
    d1: 9,
    d2: 9,
    d3: 2,
    sum: 20,
    tags: ['Big', 'Double', 'Big Double'],
    time: '2 mins ago',
    userBets: [
      {
        id: 'BET-INIT-2',
        timeframe: '30s',
        issue: 202609220027,
        type: 'Small',
        amount: 5,
        result: 'LOSS',
        payout: 0,
        time: '2 mins ago',
      },
    ],
  },
];

const getUrlRefCode = (): string | null => {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('ref') || params.get('invite') || null;
    }
  } catch {}
  return null;
};

export default function App() {
  const urlRefParam = getUrlRefCode();

  const [invitedByCode, setInvitedByCode] = useState<string | null>(() => {
    if (urlRefParam) return urlRefParam;
    try {
      return sessionStorage.getItem('pkw_invited_by');
    } catch {}
    return null;
  });

  // --- Persistent State ---
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    // If opening an invitation link, do NOT log in as previous user in this session!
    // Treat as an invitation for a new visitor to register!
    if (urlRefParam) {
      try {
        sessionStorage.setItem('pkw_invited_by', urlRefParam);
      } catch {}
      return null;
    }
    try {
      const saved = localStorage.getItem('pkw_auth_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [userId, setUserId] = useState<string>(() => {
    try {
      const savedUser = localStorage.getItem('pkw_auth_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) return parsed.id;
      }
    } catch {}
    const existing = localStorage.getItem('pkw_uid');
    if (existing) return existing;
    const newUid = 'USR-' + Math.floor(100000 + Math.random() * 900000);
    try {
      localStorage.setItem('pkw_uid', newUid);
    } catch {}
    return newUid;
  });

  const [balance, setBalance] = useState<number>(() => {
    if (urlRefParam) return 0.0;
    try {
      const savedUser = localStorage.getItem('pkw_auth_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed.balance === 'number') return parsed.balance;
      }
    } catch {}
    const saved = localStorage.getItem('pkw_balance');
    return saved ? parseFloat(saved) : 0.0;
  });

  const [betHistory, setBetHistory] = useState<BetRecord[]>(() => {
    // Purge legacy unisolated test data that showed 1100
    try {
      const legacy = localStorage.getItem('pkw_bet_history');
      if (legacy) {
        localStorage.removeItem('pkw_bet_history');
      }
    } catch {}

    const uid = (() => {
      try {
        const savedUser = localStorage.getItem('pkw_auth_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) return parsed.id;
        }
      } catch {}
      return localStorage.getItem('pkw_uid');
    })();

    if (!uid) return [];
    const saved = localStorage.getItem(`pkw_bet_history_${uid}`);
    if (saved) {
      try {
        const parsed: BetRecord[] = JSON.parse(saved);
        return parsed.filter((b) => b && b.id && !b.id.startsWith('BET-INIT-') && (!b.userId || b.userId === uid));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>(() => {
    const uid = (() => {
      try {
        const savedUser = localStorage.getItem('pkw_auth_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) return parsed.id;
        }
      } catch {}
      return localStorage.getItem('pkw_uid');
    })();
    if (!uid) return [];
    const saved = localStorage.getItem(`pkw_draw_history_${uid}`);
    if (saved) {
      try {
        const parsed: DrawRecord[] = JSON.parse(saved);
        return parsed.filter(
          (d) => d && d.userBets && d.userBets.some((b) => !b.id.startsWith('BET-INIT-'))
        );
      } catch {
        return [];
      }
    }
    return [];
  });

  const [depositHistory, setDepositHistory] = useState<DepositRecord[]>(() => {
    const uid = (() => {
      try {
        const savedUser = localStorage.getItem('pkw_auth_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) return parsed.id;
        }
      } catch {}
      return localStorage.getItem('pkw_uid');
    })();
    if (!uid) return [];
    const saved = localStorage.getItem(`pkw_deposit_history_${uid}`);
    if (saved) {
      try {
        const parsed: DepositRecord[] = JSON.parse(saved);
        return parsed.filter((d) => d && !d.id.startsWith('DEP-98'));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawRecord[]>(() => {
    const uid = (() => {
      try {
        const savedUser = localStorage.getItem('pkw_auth_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) return parsed.id;
        }
      } catch {}
      return localStorage.getItem('pkw_uid');
    })();
    if (!uid) return [];
    const saved = localStorage.getItem(`pkw_withdraw_history_${uid}`);
    if (saved) {
      try {
        const parsed: WithdrawRecord[] = JSON.parse(saved);
        return parsed.filter((w) => w && !w.id.startsWith('WD-44'));
      } catch {
        return [];
      }
    }
    return [];
  });

  // UI Tabs & Modes
  const [activeTab, setActiveTab] = useState<'home' | 'trade' | 'news' | 'my'>('trade');
  const [tradeMode, setTradeMode] = useState<'trade' | 'draw'>('trade');

  // Timeframes restricted to max 1 hour (day removed)
  const availableTimeframes = useMemo(() => ['30s', '1min', '5min', '15min', '30min', '1hour'], []);
  const [activeTimeframe, setActiveTimeframe] = useState<string>(() => {
    try {
      return localStorage.getItem('pkw_active_tf') || '30s';
    } catch {
      return '30s';
    }
  });

  // Lottery Draw filters (STRICTLY rounds with user bets placed: WIN or LOSS)
  const [drawResultFilter, setDrawResultFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [drawTimeframeFilter, setDrawTimeframeFilter] = useState<string>('all');

  // Live Market Prices (Deterministic across all devices & synced with server clock)
  const [btcPrice, setBtcPrice] = useState<number>(() => {
    const sec = Math.floor((Date.now() + getServerTimeOffset()) / 1000);
    return getDeterministicBtcPrice(sec);
  });
  const [priceChangeDirection, setPriceChangeDirection] = useState<'up' | 'down'>('up');

  // Modals & Drawers
  const [betDrawerOpen, setBetDrawerOpen] = useState<boolean>(false);
  const [selectedBetType, setSelectedBetType] = useState<string>('Big');
  const [selectedBetMultiplier, setSelectedBetMultiplier] = useState<number>(1.95);
  const [betAmountInput, setBetAmountInput] = useState<string>('10');

  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [depositNetwork, setDepositNetwork] = useState<string>('TRC20');
  const [depositAmountInput, setDepositAmountInput] = useState<string>('50');
  const [depositTxHashInput, setDepositTxHashInput] = useState<string>('');
  const [depositScreenshot, setDepositScreenshot] = useState<string>('');
  const [depositSubmitting, setDepositSubmitting] = useState<boolean>(false);
  const [depositWallets, setDepositWallets] = useState<{ trc20: string; bep20: string }>({
    trc20: 'TYu982aXzQkL90123mK912pLq10293',
    bep20: '0x71C8A51A35C0e26B2d29486c9A757B36f112B16B',
  });

  useEffect(() => {
    fetch('/api/deposit-wallets')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.wallets) {
          setDepositWallets(data.wallets);
        }
      })
      .catch(() => {});
  }, [depositModalOpen]);

  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>('50');

  const [rulesModalOpen, setRulesModalOpen] = useState<boolean>(false);
  const [betHistoryModalOpen, setBetHistoryModalOpen] = useState<boolean>(false);
  const [depositHistoryModalOpen, setDepositHistoryModalOpen] = useState<boolean>(false);
  const [withdrawHistoryModalOpen, setWithdrawHistoryModalOpen] = useState<boolean>(false);
  const [referralModalOpen, setReferralModalOpen] = useState<boolean>(false);

  // My Tab Customization & Action Modals (from design screenshot)
  const [userName, setUserName] = useState<string>(() => {
    if (urlRefParam) return 'Guest Trader';
    try {
      const savedUser = localStorage.getItem('pkw_auth_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.username) return parsed.username;
      }
    } catch {}
    const saved = localStorage.getItem('pkw_user_name');
    if (saved && !saved.toLowerCase().includes('mubeen')) {
      return saved;
    }
    return 'VIP Trader';
  });

  // User Auth (Login & Register) State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(() => {
    return Boolean(urlRefParam);
  });
  const [authTab, setAuthTab] = useState<'login' | 'register'>(() => {
    return urlRefParam ? 'register' : 'login';
  });
  const [loginLoginInput, setLoginLoginInput] = useState<string>('');
  const [loginPasswordInput, setLoginPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const [regUsernameInput, setRegUsernameInput] = useState<string>('');
  const [regEmailInput, setRegEmailInput] = useState<string>('');
  const [regPasswordInput, setRegPasswordInput] = useState<string>('');
  const [regConfirmPasswordInput, setRegConfirmPasswordInput] = useState<string>('');
  const [regReferralInput, setRegReferralInput] = useState<string>(() => {
    return urlRefParam || '';
  });
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Password Recovery & Ownership Verification States
  const [recoveryModalOpen, setRecoveryModalOpen] = useState<boolean>(false);
  const [recoveryUsernameInput, setRecoveryUsernameInput] = useState<string>('');
  const [recoveryBalanceInput, setRecoveryBalanceInput] = useState<string>('');
  const [recoveryProofSlip, setRecoveryProofSlip] = useState<string | null>(null);
  const [recoveryNotesInput, setRecoveryNotesInput] = useState<string>('');
  const [recoverySubmitting, setRecoverySubmitting] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [activeRecoveryTicket, setActiveRecoveryTicket] = useState<{
    id: string;
    usernameOrEmail: string;
    claimedBalance?: string;
    depositProofSlip?: string;
    userNotes?: string;
    createdAt: number;
    status: 'pending' | 'approved' | 'rejected';
    newPassword?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('pkw_active_recovery_ticket');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showAssetBalance, setShowAssetBalance] = useState<boolean>(true);
  const [userProfitMotto, setUserProfitMotto] = useState<string>(() => {
    const saved = localStorage.getItem('pkw_user_motto');
    return saved || "Target: Daily Growth & Profit";
  });
  const [editingMotto, setEditingMotto] = useState<boolean>(false);
  const [mottoInput, setMottoInput] = useState<string>(() => {
    const saved = localStorage.getItem('pkw_user_motto');
    return saved || "Target: Daily Growth & Profit";
  });

  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [transferAmountInput, setTransferAmountInput] = useState<string>('10');
  const [transferSubmitting, setTransferSubmitting] = useState<boolean>(false);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);

  const [financialModalOpen, setFinancialModalOpen] = useState<boolean>(false);
  const [financialSubTab, setFinancialSubTab] = useState<'deposits' | 'withdrawals' | 'transfers' | 'bets'>('deposits');

  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [tempUserNameInput, setTempUserNameInput] = useState<string>(userName);

  // Live Broadcast Marquee Announcement Ticker
  const [announcementTicker, setAnnouncementTicker] = useState<string>(
    '🔥 This game has just launched! Join now, start trading, and earn up to 3.8x USDT payouts! 🚀'
  );

  useEffect(() => {
    fetch('/api/announcement')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ticker) setAnnouncementTicker(data.ticker);
      })
      .catch(() => {});
  }, []);

  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState<boolean>(false);
  const [officialModalOpen, setOfficialModalOpen] = useState<boolean>(false);
  const [serviceModalOpen, setServiceModalOpen] = useState<boolean>(false);

  // Customer Support Live Chat State
  const [supportChatOpen, setSupportChatOpen] = useState<boolean>(false);
  const [userSupportMessages, setUserSupportMessages] = useState<Array<{
    id: string;
    userId: string;
    sender: 'user' | 'admin';
    message: string;
    timestamp: number;
    readByAdmin?: boolean;
    readByUser?: boolean;
  }>>([]);
  const [userSupportInput, setUserSupportInput] = useState<string>('');
  const [userSendingSupport, setUserSendingSupport] = useState<boolean>(false);
  const [hasUnreadSupportReply, setHasUnreadSupportReply] = useState<boolean>(false);

  // Backend / Admin Result Control Engine State (Synchronized via LocalStorage)
  const [adminControlSettings, setAdminControlSettings] = useState<{
    [tf: string]: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('pkw_admin_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      '30s': 'auto',
      '1min': 'auto',
      '5min': 'auto',
      '15min': 'auto',
      '30min': 'auto',
      '1hour': 'auto',
    };
  });

  const updateAdminPolicy = (tf: string, policy: string) => {
    setAdminControlSettings((prev) => {
      const updated = { ...prev, [tf]: policy };
      try {
        localStorage.setItem('pkw_admin_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Synchronize settings if changed in another window/tab
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pkw_admin_settings' && e.newValue) {
        try {
          setAdminControlSettings(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Force logout when admin deletes player account
  const forceLogoutDeletedUser = useCallback((reason = 'Your account has been deleted by administrator.') => {
    localStorage.removeItem('pkw_auth_user');
    localStorage.removeItem('pkw_balance');
    try {
      sessionStorage.clear();
    } catch {}
    setCurrentUser(null);
    let guestId = localStorage.getItem('pkw_uid');
    if (!guestId) {
      guestId = 'USR-' + Math.floor(100000 + Math.random() * 900000);
      try {
        localStorage.setItem('pkw_uid', guestId);
      } catch {}
    }
    setUserId(guestId);
    setUserName('Player_' + guestId.slice(-4));
    setBalance(0.0);
    setBetHistory([]);
    setDepositHistory([]);
    setWithdrawHistory([]);
    setDrawHistory([]);
    setTransferHistory([]);
    setAuthModalOpen(false);
    setSettingsModalOpen(false);
    setFinancialModalOpen(false);
    setDepositModalOpen(false);
    setWithdrawModalOpen(false);
    setTransferModalOpen(false);
    showToast(`⚠️ ${reason}`);
  }, []);

  // Cross-tab sync for auth and logout
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pkw_auth_user') {
        if (!e.newValue) {
          if (currentUser) {
            forceLogoutDeletedUser('You have been logged out.');
          }
        } else {
          try {
            setCurrentUser(JSON.parse(e.newValue));
          } catch {}
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentUser, forceLogoutDeletedUser]);

  // Verify & refresh user session on load
  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/auth/me?userId=${encodeURIComponent(currentUser.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.user) {
            setCurrentUser(data.user);
            setBalance(data.user.balance);
            setUserName(data.user.username);
            localStorage.setItem('pkw_auth_user', JSON.stringify(data.user));
            localStorage.setItem('pkw_balance', data.user.balance.toString());
          } else if (data && data.deleted) {
            forceLogoutDeletedUser('This account has been permanently removed by administrator.');
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id, forceLogoutDeletedUser]);

  // Listen for forced logout event (broadcasted when admin deletes user)
  useEffect(() => {
    const handleForceLogout = (e: any) => {
      const targetId = e.detail?.userId;
      const activeUid = currentUser?.id;
      if (activeUid && targetId && targetId === activeUid) {
        forceLogoutDeletedUser('Your account was permanently removed by administrator.');
      }
    };
    window.addEventListener('pkw_force_logout', handleForceLogout);
    return () => window.removeEventListener('pkw_force_logout', handleForceLogout);
  }, [currentUser?.id, forceLogoutDeletedUser]);

  // Listen to Admin balance adjustments in real-time
  useEffect(() => {
    const handleBalanceEvent = (e: any) => {
      const activeUid = currentUser?.id || userId;
      if (e.detail && e.detail.userId === activeUid) {
        const newBal = Number(e.detail.balance);
        setBalance(newBal);
        localStorage.setItem('pkw_balance', newBal.toString());
        if (currentUser) {
          setCurrentUser((prev) => (prev ? { ...prev, balance: newBal } : null));
        }
      }
    };
    window.addEventListener('pkw_balance_updated', handleBalanceEvent);
    return () => window.removeEventListener('pkw_balance_updated', handleBalanceEvent);
  }, [userId, currentUser]);

  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);

  const handleRefreshBalance = async () => {
    const uid = currentUser?.id || userId;
    if (!uid) return;
    setIsRefreshingBalance(true);
    try {
      const res = await fetch(`/api/user/balance?userId=${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (res.ok && data.success && typeof data.balance === 'number') {
        setBalance(data.balance);
        localStorage.setItem('pkw_balance', data.balance.toString());
        if (currentUser) {
          const updated = { ...currentUser, balance: data.balance, status: data.status || currentUser.status };
          setCurrentUser(updated);
          localStorage.setItem('pkw_auth_user', JSON.stringify(updated));
        }
        showToast(`✅ Balance refreshed: $${data.balance.toFixed(2)} USDT`);
      } else {
        showToast('Balance updated to latest server state.');
      }
    } catch {
      showToast('Error syncing latest balance from server');
    } finally {
      setTimeout(() => setIsRefreshingBalance(false), 500);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRegError(null);
    if (!regUsernameInput.trim() || !regEmailInput.trim() || !regPasswordInput) {
      setRegError('Please fill in all required fields');
      return;
    }
    if (regPasswordInput.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }
    if (regPasswordInput !== regConfirmPasswordInput) {
      setRegError('Passwords do not match');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsernameInput.trim(),
          email: regEmailInput.trim(),
          password: regPasswordInput,
          referralCode: regReferralInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        setUserId(data.user.id);
        setUserName(data.user.username);
        setBalance(data.user.balance || 0);
        // Clean slate for new user: 0 transactions, 0 earnings, 0 history
        setBetHistory([]);
        setDepositHistory([]);
        setWithdrawHistory([]);
        setDrawHistory([]);
        localStorage.setItem('pkw_auth_user', JSON.stringify(data.user));
        localStorage.setItem('pkw_uid', data.user.id);
        localStorage.setItem('pkw_user_name', data.user.username);
        localStorage.setItem('pkw_balance', (data.user.balance || 0).toString());
        localStorage.setItem(`pkw_bet_history_${data.user.id}`, JSON.stringify([]));
        localStorage.setItem(`pkw_deposit_history_${data.user.id}`, JSON.stringify([]));
        localStorage.setItem(`pkw_withdraw_history_${data.user.id}`, JSON.stringify([]));
        localStorage.setItem(`pkw_draw_history_${data.user.id}`, JSON.stringify([]));
        try {
          localStorage.removeItem('pkw_bet_history');
        } catch {}
        setAuthModalOpen(false);
        setRegUsernameInput('');
        setRegEmailInput('');
        setRegPasswordInput('');
        setRegConfirmPasswordInput('');
        setRegReferralInput('');
        showToast(`Welcome ${data.user.username}! Account created. Deposit USDT to start trading.`);
      } else {
        setRegError(data.message || 'Registration failed');
      }
    } catch {
      setRegError('Network error during registration');
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError(null);
    if (!loginLoginInput.trim() || !loginPasswordInput) {
      setLoginError('Please enter your username/email and password');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: loginLoginInput.trim(),
          password: loginPasswordInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        setUserId(data.user.id);
        setUserName(data.user.username);
        setBalance(data.user.balance);
        localStorage.setItem('pkw_auth_user', JSON.stringify(data.user));
        localStorage.setItem('pkw_uid', data.user.id);
        localStorage.setItem('pkw_user_name', data.user.username);
        localStorage.setItem('pkw_balance', data.user.balance.toString());

        // Load user-specific histories
        try {
          const savedBets = localStorage.getItem(`pkw_bet_history_${data.user.id}`);
          setBetHistory(savedBets ? JSON.parse(savedBets) : []);
        } catch {
          setBetHistory([]);
        }
        try {
          const savedDraws = localStorage.getItem(`pkw_draw_history_${data.user.id}`);
          setDrawHistory(savedDraws ? JSON.parse(savedDraws) : []);
        } catch {
          setDrawHistory([]);
        }
        try {
          const savedDeps = localStorage.getItem(`pkw_deposit_history_${data.user.id}`);
          setDepositHistory(savedDeps ? JSON.parse(savedDeps) : []);
        } catch {
          setDepositHistory([]);
        }
        try {
          const savedWds = localStorage.getItem(`pkw_withdraw_history_${data.user.id}`);
          setWithdrawHistory(savedWds ? JSON.parse(savedWds) : []);
        } catch {
          setWithdrawHistory([]);
        }

        setAuthModalOpen(false);
        setLoginLoginInput('');
        setLoginPasswordInput('');
        showToast(`Welcome back, ${data.user.username}!`);
      } else {
        setLoginError(data.message || 'Invalid username/email or password');
      }
    } catch {
      setLoginError('Network error during login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pkw_auth_user');
    const guestId = 'USR-' + Math.floor(100000 + Math.random() * 900000);
    setUserId(guestId);
    setUserName('Player_' + guestId.slice(-4));
    setBalance(0.0);
    setBetHistory([]);
    setDepositHistory([]);
    setWithdrawHistory([]);
    setDrawHistory([]);
    localStorage.setItem('pkw_uid', guestId);
    localStorage.setItem('pkw_balance', '0');
    setLogoutModalOpen(false);
    showToast('Logged out successfully');
  };

  // Live polling for submitted recovery request
  useEffect(() => {
    if (!activeRecoveryTicket || activeRecoveryTicket.status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/recovery-request/${activeRecoveryTicket.id}`);
        const data = await res.json();
        if (data && data.success && data.request) {
          setActiveRecoveryTicket(data.request);
          localStorage.setItem('pkw_active_recovery_ticket', JSON.stringify(data.request));
          if (data.request.status === 'approved') {
            showToast('🎉 Your password recovery was approved! New password ready.');
          }
        }
      } catch {}
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeRecoveryTicket]);

  const handleRecoveryProofSlipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('⚠️ Image too large. Please select an image under 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setRecoveryProofSlip(compressedDataUrl);
        } else {
          setRecoveryProofSlip(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUsernameInput.trim()) {
      setRecoveryError('Please enter your account username or registered email');
      return;
    }
    setRecoveryError(null);
    setRecoverySubmitting(true);
    try {
      const res = await fetch('/api/auth/recovery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: recoveryUsernameInput.trim(),
          claimedBalance: recoveryBalanceInput.trim() || undefined,
          depositProofSlip: recoveryProofSlip || undefined,
          userNotes: recoveryNotesInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.request) {
        setActiveRecoveryTicket(data.request);
        localStorage.setItem('pkw_active_recovery_ticket', JSON.stringify(data.request));
        showToast('✅ Verification submitted to Admin! Live ticket created.');
      } else {
        setRecoveryError(data.message || 'Failed to submit recovery request');
      }
    } catch {
      setRecoveryError('Network error submitting request. Please try again.');
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const handleLoginWithRecoveredPassword = (username: string, pass: string) => {
    setLoginLoginInput(username);
    setLoginPasswordInput(pass);
    setRecoveryModalOpen(false);
    setAuthModalOpen(true);
    setAuthTab('login');
    showToast('Credentials filled! Click Sign In to access your account.');
  };

  // Real-time Heartbeat & Server Policy Sync & Approved Requests Status
  useEffect(() => {
    const sendHeartbeatAndSync = () => {
      // 1. Send heartbeat for real-time online user count & account validity
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: `player_${userId}`,
          userId: currentUser?.id || userId,
          isPlayer: true,
          isRegistered: Boolean(currentUser?.id),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.accountDeleted && currentUser) {
            forceLogoutDeletedUser('This account has been deleted by administrator.');
          }
        })
        .catch(() => {});

      // 2. Fetch live admin policy from server & sync time offset & live Bitcoin price
      fetch('/api/status')
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (typeof data.serverTime === 'number') {
              setServerTimeOffset(data.serverTime);
            }
            if (typeof data.btcPrice === 'number') {
              setBtcPrice((prev) => {
                setPriceChangeDirection(data.btcPrice >= prev ? 'up' : 'down');
                return data.btcPrice;
              });
            }
            if (data.policies) {
              setAdminControlSettings(data.policies);
            }
          }
        })
        .catch(() => {});

      // 3. Sync player deposit & withdrawal approval state with backend
      fetch(`/api/user/requests?userId=${encodeURIComponent(userId)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data) return;

          // A. Process Deposits
          if (Array.isArray(data.deposits)) {
            const creditedKey = `pkw_credited_deps_${userId}`;
            const creditedIds: string[] = JSON.parse(localStorage.getItem(creditedKey) || '[]');
            let addedBalance = 0;

            for (const dep of data.deposits) {
              if (dep.status === 'Approved' && !creditedIds.includes(dep.id)) {
                addedBalance += dep.amount;
                creditedIds.push(dep.id);
                showToast(`🎉 Deposit Approved! +$${dep.amount.toFixed(2)} USDT added to your balance.`);
              }
            }

            if (addedBalance > 0) {
              localStorage.setItem(creditedKey, JSON.stringify(creditedIds));
              setBalance((prev) => prev + addedBalance);
            }

            // Sync deposit records in local state
            setDepositHistory((prev) =>
              prev.map((d) => {
                const match = data.deposits.find((sd: any) => sd.id === d.id);
                if (match && match.status !== d.status) {
                  return { ...d, status: match.status, rejectionReason: match.rejectionReason };
                }
                return d;
              })
            );
          }

          // B. Process Withdrawals & Automatic Refunds
          if (Array.isArray(data.withdrawals)) {
            const refundedKey = `pkw_refunded_wds_${userId}`;
            const refundedIds: string[] = JSON.parse(localStorage.getItem(refundedKey) || '["WD-555197"]');
            const notifiedKey = `pkw_notified_approved_wds_${userId}`;
            const notifiedIds: string[] = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
            let refundBalance = 0;
            let notifiedChanged = false;

            for (const wd of data.withdrawals) {
              // AUTOMATIC REFUND: When withdrawal is rejected, return funds directly to user wallet balance!
              if (wd.status === 'Rejected' && !refundedIds.includes(wd.id)) {
                refundBalance += wd.amount;
                refundedIds.push(wd.id);
                showToast(`↩️ Withdrawal of $${wd.amount.toFixed(2)} USDT rejected. Funds refunded to your balance!`);
              }

              if (wd.status === 'Approved' && !notifiedIds.includes(wd.id)) {
                notifiedIds.push(wd.id);
                notifiedChanged = true;
                showToast(`✅ Withdrawal of $${wd.amount.toFixed(2)} USDT was approved and transferred!`);
              }
            }

            if (refundBalance > 0) {
              localStorage.setItem(refundedKey, JSON.stringify(refundedIds));
              setBalance((prev) => prev + refundBalance);
            }

            if (notifiedChanged) {
              localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));
            }

            // Sync withdrawal records in local state
            setWithdrawHistory((prev) =>
              prev.map((w) => {
                const match = data.withdrawals.find((sw: any) => sw.id === w.id);
                if (match && (match.status !== w.status || match.txHash !== w.txHash)) {
                  return {
                    ...w,
                    status: match.status,
                    txHash: match.txHash,
                    rejectionReason: match.rejectionReason,
                    refunded: match.status === 'Rejected',
                  };
                }
                return w;
              })
            );
          }

          // C. Process Peer-to-Peer Transfers & Automatic Updates
          if (Array.isArray(data.transfers)) {
            setTransferHistory(data.transfers);

            const refundedTrfKey = `pkw_refunded_trfs_${userId}`;
            const refundedTrfIds: string[] = JSON.parse(localStorage.getItem(refundedTrfKey) || '[]');
            const notifiedSentKey = `pkw_notified_trfs_${userId}`;
            const notifiedSentIds: string[] = JSON.parse(localStorage.getItem(notifiedSentKey) || '[]');
            const receivedTrfKey = `pkw_received_trfs_${userId}`;
            const receivedTrfIds: string[] = JSON.parse(localStorage.getItem(receivedTrfKey) || '[]');

            let trfBalanceAdjustment = 0;
            let refundedChanged = false;
            let notifiedSentChanged = false;
            let receivedChanged = false;

            for (const trf of data.transfers) {
              // 1. If user sent money and it was rejected -> auto refund to balance!
              if (trf.senderId === userId && trf.status === 'Rejected' && !refundedTrfIds.includes(trf.id)) {
                trfBalanceAdjustment += trf.amount;
                refundedTrfIds.push(trf.id);
                refundedChanged = true;
                showToast(`↩️ Transfer of $${trf.amount.toFixed(2)} USDT rejected. Funds refunded to your balance!`);
              }

              // 2. If user sent money and it was approved -> notify success!
              if (trf.senderId === userId && trf.status === 'Approved' && !notifiedSentIds.includes(trf.id)) {
                notifiedSentIds.push(trf.id);
                notifiedSentChanged = true;
                showToast(`✅ Transfer of $${trf.amount.toFixed(2)} USDT to ${trf.recipientName || trf.recipientId} approved & delivered!`);
              }

              // 3. If user was the recipient and it was approved -> credit incoming funds!
              if (trf.recipientId === userId && trf.status === 'Approved' && !receivedTrfIds.includes(trf.id)) {
                receivedTrfIds.push(trf.id);
                receivedChanged = true;
                trfBalanceAdjustment += trf.amount;
                showToast(`🎁 You received +$${trf.amount.toFixed(2)} USDT from ${trf.senderName || trf.senderId}!`);
              }
            }

            if (refundedChanged) localStorage.setItem(refundedTrfKey, JSON.stringify(refundedTrfIds));
            if (notifiedSentChanged) localStorage.setItem(notifiedSentKey, JSON.stringify(notifiedSentIds));
            if (receivedChanged) localStorage.setItem(receivedTrfKey, JSON.stringify(receivedTrfIds));

            if (trfBalanceAdjustment > 0) {
              setBalance((prev) => {
                const next = Number((prev + trfBalanceAdjustment).toFixed(2));
                localStorage.setItem('pkw_balance', String(next));
                return next;
              });
            }
          }
        })
        .catch(() => {});
    };

    sendHeartbeatAndSync();
    const interval = setInterval(sendHeartbeatAndSync, 4000);
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch customer support messages for this user
  const fetchUserSupportMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/support/messages?userId=${encodeURIComponent(userId)}&forUser=true`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.messages)) {
        setUserSupportMessages(data.messages);
        const unreadFromAdmin = data.messages.some((m: any) => m.sender === 'admin' && !m.readByUser);
        setHasUnreadSupportReply(unreadFromAdmin);
      }
    } catch {}
  }, [userId]);

  useEffect(() => {
    fetchUserSupportMessages();
    const interval = setInterval(fetchUserSupportMessages, 4000);
    return () => clearInterval(interval);
  }, [fetchUserSupportMessages]);

  const handleSendUserSupport = async (presetText?: string) => {
    const text = (presetText || userSupportInput).trim();
    if (!text || userSendingSupport) return;
    setUserSendingSupport(true);
    try {
      const res = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: text, sender: 'user' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserSupportInput('');
        fetchUserSupportMessages();
        showToast('Message sent to Customer Service! We will reply here shortly.');
      } else {
        showToast(data.message || 'Failed to send message');
      }
    } catch {
      showToast('Error sending message');
    } finally {
      setUserSendingSupport(false);
    }
  };

  // Referral System State - Real commissions dynamically calculated from actual referral invitations
  const [claimedCommission, setClaimedCommission] = useState<number>(() => {
    try {
      localStorage.removeItem('pkw_claimed_commission');
      localStorage.removeItem('pkw_unclaimed_commission');
      const saved = localStorage.getItem(`pkw_claimed_commission_${userId}`);
      return saved ? Math.max(0, parseFloat(saved)) : 0.0;
    } catch {
      return 0.0;
    }
  });

  useEffect(() => {
    if (userId) {
      try {
        const saved = localStorage.getItem(`pkw_claimed_commission_${userId}`);
        setClaimedCommission(saved ? Math.max(0, parseFloat(saved)) : 0.0);
      } catch {
        setClaimedCommission(0.0);
      }
    }
  }, [userId]);

  const referralCode = useMemo(() => {
    if (currentUser?.referralCode) return currentUser.referralCode;
    const codeNum = userId.split('-')[1] || '88219';
    return `CWP-${codeNum}`;
  }, [userId, currentUser]);

  // When arriving via an invitation link, prompt the new visitor to register
  useEffect(() => {
    const urlRef = getUrlRefCode();
    if (urlRef) {
      setInvitedByCode(urlRef);
      setRegReferralInput(urlRef);
      setAuthTab('register');
      setAuthModalOpen(true);
      showToast(`🎁 Referral link detected! Register your account with code ${urlRef} to claim your welcome bonus.`);
    }
  }, []);

  const [referralFriends, setReferralFriends] = useState<ReferralFriend[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState<boolean>(false);

  const fetchUserReferrals = useCallback(async () => {
    try {
      setLoadingReferrals(true);
      const q = new URLSearchParams();
      if (currentUser?.id) q.set('userId', currentUser.id);
      else if (userId) q.set('userId', userId);
      if (currentUser?.referralCode) q.set('referralCode', currentUser.referralCode);
      if (currentUser?.username) q.set('username', currentUser.username);

      const res = await fetch(`/api/user/referrals?${q.toString()}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.referrals)) {
        setReferralFriends(data.referrals);
      }
    } catch (e) {
      console.error('Failed to fetch referrals:', e);
    } finally {
      setLoadingReferrals(false);
    }
  }, [currentUser, userId]);

  useEffect(() => {
    fetchUserReferrals();
  }, [fetchUserReferrals]);

  // Real referral earnings calculated strictly from registered referral friends
  const totalReferralEarned = useMemo(() => {
    return referralFriends.reduce((sum, f) => sum + (Number(f.commission) || 0), 0);
  }, [referralFriends]);

  const unclaimedCommission = useMemo(() => {
    return Math.max(0, totalReferralEarned - claimedCommission);
  }, [totalReferralEarned, claimedCommission]);

  const handleClaimCommission = () => {
    if (unclaimedCommission <= 0) {
      showToast('No referral commission available to claim right now.');
      return;
    }
    const toClaim = unclaimedCommission;
    setBalance((prev) => prev + toClaim);
    const newClaimed = claimedCommission + toClaim;
    setClaimedCommission(newClaimed);
    try {
      localStorage.setItem(`pkw_claimed_commission_${userId}`, String(newClaimed));
    } catch {}
    showToast(`🎉 Claimed +${toClaim.toFixed(2)} USDT referral bonus directly to wallet balance!`);
  };

  // Dynamic real user statistics calculated directly from bet history
  const { todayTransaction, todayEarnings } = useMemo(() => {
    // Strictly isolate bets for this active user only
    const userBets = betHistory.filter(
      (b) => b && (!b.userId || b.userId === userId) && !b.id.startsWith('BET-INIT-')
    );
    const todayBets = userBets.filter(
      (b) =>
        b.time.includes('Today') ||
        b.time.includes('Just now') ||
        b.time.includes('AM') ||
        b.time.includes('PM')
    );
    const totalVolume = todayBets.reduce((acc, b) => acc + (b.amount || 0), 0);
    const winProfit = todayBets
      .filter((b) => b.result === 'WIN')
      .reduce((acc, b) => acc + (b.payout || 0) - (b.amount || 0), 0);
    const lossAmt = todayBets
      .filter((b) => b.result === 'LOSS')
      .reduce((acc, b) => acc + (b.amount || 0), 0);
    return {
      todayTransaction: totalVolume,
      todayEarnings: winProfit - lossAmt,
    };
  }, [betHistory, userId]);

  // Turnover requirement calculation (2.0x of deposits, minimum 50 USDT)
  const { userTurnover, requiredTurnover, turnoverSatisfied, turnoverRemaining, turnoverPercent } = useMemo(() => {
    // Current user's bet history only
    const userBets = betHistory.filter(
      (b) => b && (!b.userId || b.userId === userId) && !b.id.startsWith('BET-INIT-')
    );
    const currentBetVolume = userBets.reduce((acc, b) => acc + (b.amount || 0), 0);

    // User's approved deposits
    const approvedDeposits = depositHistory
      .filter((d) => d.status === 'Success')
      .reduce((acc, d) => acc + d.amount, 0);

    // 2.0x turnover rule (Minimum 50 USDT turnover)
    const required = Math.max(50, approvedDeposits * 2.0);
    const remaining = Math.max(0, Number((required - currentBetVolume).toFixed(2)));
    const satisfied = currentBetVolume >= required;
    const percent = Math.min(100, Math.round((currentBetVolume / required) * 100));

    return {
      userTurnover: currentBetVolume,
      requiredTurnover: required,
      turnoverSatisfied: satisfied,
      turnoverRemaining: remaining,
      turnoverPercent: percent,
    };
  }, [betHistory, depositHistory, userId]);

  const handleSaveMotto = () => {
    if (!mottoInput.trim()) return;
    setUserProfitMotto(mottoInput.trim());
    localStorage.setItem('pkw_user_motto', mottoInput.trim());
    setEditingMotto(false);
    showToast('Daily motto updated successfully!');
  };

  const handleSaveUserName = () => {
    if (!tempUserNameInput.trim()) return;
    setUserName(tempUserNameInput.trim());
    localStorage.setItem('pkw_user_name', tempUserNameInput.trim());
    setSettingsModalOpen(false);
    showToast('Profile name updated!');
  };

  const handleTransferSubmit = async () => {
    const amt = parseFloat(transferAmountInput);
    if (isNaN(amt) || amt < 1) {
      showToast('Minimum transfer amount is 1.00 USDT');
      return;
    }
    if (amt > balance) {
      showToast(`Insufficient balance. Max available: $${balance.toFixed(2)} USDT`);
      return;
    }
    if (!transferTargetId.trim()) {
      showToast('Please enter recipient Player ID or Username');
      return;
    }

    setTransferSubmitting(true);
    try {
      const res = await fetch('/api/user/transfer-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          recipientId: transferTargetId.trim(),
          amount: amt,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof data.newBalance === 'number') {
          setBalance(data.newBalance);
          localStorage.setItem('pkw_balance', String(data.newBalance));
        } else {
          setBalance((prev) => {
            const next = Math.max(0, Number((prev - amt).toFixed(2)));
            localStorage.setItem('pkw_balance', String(next));
            return next;
          });
        }
        if (data.request) {
          setTransferHistory((prev) => [data.request, ...prev]);
        }
        setTransferModalOpen(false);
        setTransferTargetId('');
        setTransferAmountInput('10');
        showToast(`📤 Transfer request of $${amt.toFixed(2)} USDT submitted for verification.`);
      } else {
        showToast(data.message || 'Failed to submit transfer request');
      }
    } catch {
      showToast('Network error while submitting transfer request');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Initial synchronized states for all timeframes
  const initSync30 = getSynchronizedTimeframe('30s');

  // Timeframe Engine State - ONLY up to 1hour (day removed)
  const timeframesRef = useRef<{ [key: string]: TimeframeState }>({
    '30s': { duration: 30, timer: initSync30.remaining, currentIssue: initSync30.issue, activeBets: [], lastResult: null, candles: getDeterministicCandles('30s', 25) },
    '1min': { duration: 60, timer: getSynchronizedTimeframe('1min').remaining, currentIssue: getSynchronizedTimeframe('1min').issue, activeBets: [], lastResult: null, candles: getDeterministicCandles('1min', 25) },
    '5min': { duration: 300, timer: getSynchronizedTimeframe('5min').remaining, currentIssue: getSynchronizedTimeframe('5min').issue, activeBets: [], lastResult: null, candles: getDeterministicCandles('5min', 25) },
    '15min': { duration: 900, timer: getSynchronizedTimeframe('15min').remaining, currentIssue: getSynchronizedTimeframe('15min').issue, activeBets: [], lastResult: null, candles: getDeterministicCandles('15min', 25) },
    '30min': { duration: 1800, timer: getSynchronizedTimeframe('30min').remaining, currentIssue: getSynchronizedTimeframe('30min').issue, activeBets: [], lastResult: null, candles: getDeterministicCandles('30min', 25) },
    '1hour': { duration: 3600, timer: getSynchronizedTimeframe('1hour').remaining, currentIssue: getSynchronizedTimeframe('1hour').issue, activeBets: [], lastResult: null, candles: getDeterministicCandles('1hour', 25) },
  });

  // Current view sync helper state (with lock state for last 5s / settlement)
  const [uiTimer, setUiTimer] = useState<{
    min: string;
    sec: string;
    issue: number;
    secondsLeft: number;
    isLocked: boolean;
  }>({
    min: initSync30.minStr,
    sec: initSync30.secStr,
    issue: initSync30.issue,
    secondsLeft: initSync30.remaining,
    isLocked: initSync30.isLocked,
  });
  const [lastResultUI, setLastResultUI] = useState<{
    price: string;
    math: string;
    tags: string[];
    issue?: number;
  }>(() => {
    const savedTf = (() => {
      try {
        return localStorage.getItem('pkw_active_tf') || '30s';
      } catch {
        return '30s';
      }
    })();
    try {
      const saved = localStorage.getItem(`pkw_last_result_${savedTf}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.price) {
          return parseDrawResultFromPrice(parsed.price, parsed.issue);
        }
      }
    } catch {}
    const sync = getSynchronizedTimeframe(savedTf);
    const lastIssue = sync.issue - 1;
    const det = getDeterministicDraw(savedTf, lastIssue);
    return parseDrawResultFromPrice(det.price, lastIssue);
  });

  // Persistent Active Bets (Survives browser refresh & device changes)
  const [activeBetsList, setActiveBetsList] = useState<ActiveBet[]>(() => {
    const uid = (() => {
      try {
        const savedUser = localStorage.getItem('pkw_auth_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) return parsed.id;
        }
      } catch {}
      return localStorage.getItem('pkw_uid');
    })();
    if (!uid) return [];
    try {
      const saved = localStorage.getItem(`pkw_active_bets_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeBetsListRef = useRef<ActiveBet[]>(activeBetsList);
  useEffect(() => {
    activeBetsListRef.current = activeBetsList;
  }, [activeBetsList]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('pkw_uid', userId);
    localStorage.setItem('pkw_balance', balance.toFixed(4));
    if (userId) {
      localStorage.setItem(`pkw_bet_history_${userId}`, JSON.stringify(betHistory));
      localStorage.setItem(`pkw_draw_history_${userId}`, JSON.stringify(drawHistory));
      localStorage.setItem(`pkw_deposit_history_${userId}`, JSON.stringify(depositHistory));
      localStorage.setItem(`pkw_withdraw_history_${userId}`, JSON.stringify(withdrawHistory));
      localStorage.setItem(`pkw_active_bets_${userId}`, JSON.stringify(activeBetsList));
      localStorage.setItem(`pkw_claimed_commission_${userId}`, String(claimedCommission));
    }
  }, [userId, balance, betHistory, drawHistory, depositHistory, withdrawHistory, activeBetsList, claimedCommission]);

  // Synchronize Authoritative Bitcoin Market Price, Candles & Latest Draw on Mount
  useEffect(() => {
    fetch('/api/game/state')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success) {
          if (typeof data.btcPrice === 'number') {
            setBtcPrice(data.btcPrice);
          }
          if (data.candles) {
            Object.keys(data.candles).forEach((tf) => {
              if (timeframesRef.current[tf]) {
                timeframesRef.current[tf].candles = data.candles[tf];
              }
            });
          }
          if (data.latestDraws && data.latestDraws[activeTimeframe]) {
            const ld = data.latestDraws[activeTimeframe];
            const resObj = parseDrawResultFromPrice(ld.price, ld.issue);
            setLastResultUI(resObj);
            try {
              localStorage.setItem(`pkw_last_result_${activeTimeframe}`, JSON.stringify(resObj));
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, [activeTimeframe]);

  // Periodic candle head update with deterministic synchronized market price
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const nowSec = Math.floor((Date.now() + getServerTimeOffset()) / 1000);
      const curPrice = getDeterministicBtcPrice(nowSec);
      setBtcPrice((prev) => {
        setPriceChangeDirection(curPrice >= prev ? 'up' : 'down');
        return curPrice;
      });
      Object.keys(timeframesRef.current).forEach((tf) => {
        const candles = timeframesRef.current[tf].candles;
        if (candles && candles.length > 0) {
          const last = candles[candles.length - 1];
          last.close = curPrice;
          if (curPrice > last.high) last.high = curPrice;
          if (curPrice < last.low) last.low = curPrice;
        }
      });
    }, 1000);

    return () => clearInterval(tickInterval);
  }, []);

  // Track the last settled issue for each timeframe so we settle exactly when a round completes
  const lastSettledIssuesRef = useRef<{ [tf: string]: number }>({
    '30s': initSync30.issue,
    '1min': getSynchronizedTimeframe('1min').issue,
    '5min': getSynchronizedTimeframe('5min').issue,
    '15min': getSynchronizedTimeframe('15min').issue,
    '30min': getSynchronizedTimeframe('30min').issue,
    '1hour': getSynchronizedTimeframe('1hour').issue,
  });

  // Master Timer & Settlement Loop - 100% Epoch Synchronized with Backend & Admin Portal
  useEffect(() => {
    const updateTimeframeLoop = () => {
      let activeUpdatedTimer = { min: '00', sec: '00', issue: 0, secondsLeft: 0, isLocked: false };

      Object.keys(timeframesRef.current).forEach((tf) => {
        const tfObj = timeframesRef.current[tf];
        const syncState = getSynchronizedTimeframe(tf);

        tfObj.timer = syncState.remaining;

        // If issue transitioned (new round has started, previous round has completed)
        if (lastSettledIssuesRef.current[tf] !== syncState.issue) {
          const finishedIssue = lastSettledIssuesRef.current[tf];
          lastSettledIssuesRef.current[tf] = syncState.issue;
          tfObj.currentIssue = syncState.issue;
          settleRound(tf, finishedIssue);
        } else {
          tfObj.currentIssue = syncState.issue;
        }

        if (tf === activeTimeframe) {
          activeUpdatedTimer = {
            min: syncState.minStr,
            sec: syncState.secStr,
            issue: syncState.issue,
            secondsLeft: syncState.remaining,
            isLocked: syncState.isLocked,
          };
        }
      });

      if (activeUpdatedTimer.issue !== 0) {
        setUiTimer(activeUpdatedTimer);
      }
    };

    updateTimeframeLoop();
    const timerInterval = setInterval(updateTimeframeLoop, 250);

    return () => clearInterval(timerInterval);
  }, [activeTimeframe, btcPrice]);

  // Fetch authoritative draw history and last results from server
  const fetchTimeframeHistory = useCallback(async (tf: string) => {
    try {
      const res = await fetch(`/api/game/history?timeframe=${encodeURIComponent(tf)}&limit=30`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.draws)) {
        if (typeof data.btcPrice === 'number') {
          setBtcPrice(data.btcPrice);
        }

        const userBetsMap = new Map<number, BetRecord[]>();
        betHistory.forEach((b) => {
          if (b.timeframe === tf) {
            const list = userBetsMap.get(b.issue) || [];
            list.push(b);
            userBetsMap.set(b.issue, list);
          }
        });

        const serverDraws: DrawRecord[] = data.draws.map((d: any) => ({
          id: d.id,
          issue: d.issue,
          timeframe: d.timeframe,
          price: d.price,
          d1: d.d1,
          d2: d.d2,
          d3: d.d3,
          sum: d.sum,
          tags: d.tags,
          time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          userBets: userBetsMap.get(d.issue) || undefined,
        }));

        setDrawHistory(serverDraws);
        if (data.lastResult) {
          const resObj = parseDrawResultFromPrice(data.lastResult.price, data.lastResult.issue);
          if (tf === activeTimeframe) {
            setLastResultUI(resObj);
          }
          try {
            localStorage.setItem(`pkw_last_result_${tf}`, JSON.stringify(resObj));
          } catch {}
          return data.lastResult;
        }
      }
    } catch (err) {
      console.error('Failed to fetch game history from server:', err);
    }
    return null;
  }, [betHistory, activeTimeframe]);

  // Load official draw history on timeframe switch or load
  useEffect(() => {
    fetchTimeframeHistory(activeTimeframe);
  }, [activeTimeframe, fetchTimeframeHistory]);

  // Settle Round Logic (Authoritative Server Synchronization)
  const settleRound = async (tf: string, finishedIssue?: number) => {
    const tfObj = timeframesRef.current[tf];
    const targetIssue = finishedIssue || tfObj.currentIssue;

    // Poll the server up to 6 times (every 320ms) to guarantee we receive the official server draw for targetIssue
    let serverDraw: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 320));
      try {
        const res = await fetch(`/api/game/history?timeframe=${encodeURIComponent(tf)}&limit=5`);
        const data = await res.json();
        if (data && data.success && Array.isArray(data.draws) && data.draws.length > 0) {
          const match = data.draws.find((d: any) => d.issue === targetIssue);
          if (match) {
            serverDraw = match;
            break;
          }
          if (data.draws[0].issue >= targetIssue) {
            serverDraw = data.draws[0];
            break;
          }
        }
      } catch {}
    }

    const latestResult = serverDraw || (await fetchTimeframeHistory(tf)) || getDeterministicDraw(tf, targetIssue);
    if (!latestResult) return;

    const resultObj = parseDrawResultFromPrice(latestResult.price, targetIssue);
    tfObj.lastResult = resultObj;

    const isBig = resultObj.isBig;
    const isDouble = resultObj.isDouble;

    if (tf === activeTimeframe) {
      setLastResultUI(resultObj);
    }
    try {
      localStorage.setItem(`pkw_last_result_${tf}`, JSON.stringify(resultObj));
    } catch {}

    // Evaluate active bets for this timeframe & targetIssue (supporting persistent bets across refreshes)
    const currentActive = [...activeBetsListRef.current];
    const betsForThisRound = currentActive.filter(
      (b) => b.timeframe === tf && (!b.issue || b.issue === targetIssue)
    );
    const remainingActive = currentActive.filter(
      (b) => !(b.timeframe === tf && (!b.issue || b.issue === targetIssue))
    );

    if (betsForThisRound.length > 0) {
      const roundBetsSettled: BetRecord[] = [];
      let totalWonAmount = 0;
      let roundLostBetsAmount = 0;
      const settledBetsPayload: Array<any> = [];

      betsForThisRound.forEach((b) => {
        const numAmount = Number(b.amount) || 0;
        let won = false;
        if (b.type === 'Big' && isBig) won = true;
        if (b.type === 'Small' && !isBig) won = true;
        if (b.type === 'Single' && !isDouble) won = true;
        if (b.type === 'Double' && isDouble) won = true;

        if (b.type === 'BigDouble' && isBig && isDouble) won = true;
        if (b.type === 'BigSingle' && isBig && !isDouble) won = true;
        if (b.type === 'SmallDouble' && !isBig && isDouble) won = true;
        if (b.type === 'SmallSingle' && !isBig && !isDouble) won = true;

        const payout = won ? Number((numAmount * b.multiplier).toFixed(2)) : 0.0;
        if (won) {
          totalWonAmount = Number((totalWonAmount + payout).toFixed(2));
        } else {
          roundLostBetsAmount = Number((roundLostBetsAmount + numAmount).toFixed(2));
        }

        const newBetRecord: BetRecord = {
          id: 'BET-' + Math.floor(100000 + Math.random() * 900000),
          userId,
          timeframe: tf,
          issue: targetIssue,
          type: b.type,
          amount: numAmount,
          result: won ? 'WIN' : 'LOSS',
          payout,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: Date.now(),
        };

        roundBetsSettled.push(newBetRecord);
        settledBetsPayload.push({
          id: newBetRecord.id,
          userId,
          timeframe: tf,
          issue: targetIssue,
          type: b.type,
          amount: numAmount,
          result: won ? 'WIN' : 'LOSS',
          payout,
        });
      });

      // Update active bets state & localStorage
      setActiveBetsList(remainingActive);
      activeBetsListRef.current = remainingActive;
      if (userId) {
        try {
          localStorage.setItem(`pkw_active_bets_${userId}`, JSON.stringify(remainingActive));
        } catch {}
      }

      // Update bet history in state and localStorage
      setBetHistory((prev) => {
        const next = [...roundBetsSettled, ...prev];
        if (userId) {
          try {
            localStorage.setItem(`pkw_bet_history_${userId}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      if (totalWonAmount > 0) {
        setBalance((prev) => Number((prev + totalWonAmount).toFixed(2)));
        showToast(`🎉 [${tf}] WIN! Received +${totalWonAmount.toFixed(2)} USDT payout!`);
        fetch('/api/user/sync-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: 'trade', delta: totalWonAmount }),
        }).catch(() => {});
      } else {
        showToast(`❌ [${tf}] Round #${targetIssue} settled. Bets did not win.`);
      }

      fetch('/api/bets/settle-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeframe: tf,
          issue: targetIssue,
          lostBetsTotal: roundLostBetsAmount,
          wonBetsTotal: totalWonAmount,
          roundProfit: Number((roundLostBetsAmount - totalWonAmount).toFixed(2)),
          settledBets: settledBetsPayload,
        }),
      }).catch(() => {});

      tfObj.activeBets = [];
      handleRefreshBalance();
    }

    // Refresh official history list
    fetchTimeframeHistory(tf);
  };

  // Switch Timeframe (1 hour max)
  const handleTimeframeChange = (tf: string) => {
    setActiveTimeframe(tf);
    try {
      localStorage.setItem('pkw_active_tf', tf);
      const saved = localStorage.getItem(`pkw_last_result_${tf}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.price) {
          setLastResultUI(parseDrawResultFromPrice(parsed.price, parsed.issue));
        }
      } else {
        const sync = getSynchronizedTimeframe(tf);
        const lastIssue = sync.issue - 1;
        const det = getDeterministicDraw(tf, lastIssue);
        setLastResultUI(parseDrawResultFromPrice(det.price, lastIssue));
      }
    } catch {}
    const syncState = getSynchronizedTimeframe(tf);
    setUiTimer({
      min: syncState.minStr,
      sec: syncState.secStr,
      issue: syncState.issue,
      secondsLeft: syncState.remaining,
      isLocked: syncState.isLocked,
    });
    fetchTimeframeHistory(tf);
    showToast(`Switched to ${tf} timeframe`);
  };

  // Canvas Drawing for Candlestick Chart
  useEffect(() => {
    if (tradeMode !== 'trade' || activeTab !== 'trade') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const tfData = timeframesRef.current[activeTimeframe];
    if (!tfData || !tfData.candles.length) return;

    const candles = tfData.candles;
    const candleCount = candles.length;
    const candleWidth = (w - 60) / candleCount;

    let minP = Infinity;
    let maxP = -Infinity;
    candles.forEach((c) => {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    });
    minP -= 20;
    maxP += 20;

    const getY = (price: number) => h - 25 - ((price - minP) / (maxP - minP)) * (h - 40);

    // Draw Grid Lines & Price Labels
    ctx.strokeStyle = '#121e3d';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Roboto Mono, monospace';

    for (let i = 0; i < 5; i++) {
      const p = minP + (maxP - minP) * (i / 4);
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w - 55, y);
      ctx.stroke();

      ctx.fillText(p.toFixed(0), w - 50, y + 3);
    }

    // Draw Candles
    candles.forEach((c, idx) => {
      const x = idx * candleWidth + candleWidth / 2;
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);

      const isUp = c.close >= c.open;
      const color = isUp ? '#00e676' : '#ff4d4d';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyY = Math.min(openY, closeY);
      const bodyH = Math.max(Math.abs(closeY - openY), 2);
      ctx.fillRect(x - candleWidth * 0.35, bodyY, candleWidth * 0.7, bodyH);
    });

    // Draw Moving Average (MA5) Line
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 4; i < candleCount; i++) {
      const ma5 =
        (candles[i].close +
          candles[i - 1].close +
          candles[i - 2].close +
          candles[i - 3].close +
          candles[i - 4].close) /
        5;
      const x = i * candleWidth + candleWidth / 2;
      const y = getY(ma5);
      if (i === 4) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [btcPrice, activeTimeframe, activeTab, tradeMode]);

  // Open Bet Drawer (Locked if timer <= 5s)
  const openBetDrawer = (type: string, multiplier: number) => {
    const activeTfObj = timeframesRef.current[activeTimeframe];
    if (activeTfObj && activeTfObj.timer <= 5) {
      showToast(`⚠️ Betting closed for Issue #${activeTfObj.currentIssue}! Round is drawing now (${activeTfObj.timer}s).`);
      return;
    }
    setSelectedBetType(type);
    setSelectedBetMultiplier(multiplier);
    setBetAmountInput('10');
    setBetDrawerOpen(true);
  };

  // Place Bet (Strictly blocked if round time ended or <= 5s)
  const handleConfirmBet = () => {
    const activeTfObj = timeframesRef.current[activeTimeframe];
    if (!activeTfObj || activeTfObj.timer <= 5) {
      showToast(`⚠️ Betting closed for Issue #${activeTfObj?.currentIssue || ''}! Round is drawing now.`);
      return;
    }

    const numericBet = parseFloat(betAmountInput) || 0;
    if (numericBet <= 0) {
      showToast('Please enter a valid bet amount.');
      return;
    }
    if (numericBet > balance) {
      showToast('Insufficient USDT balance!');
      return;
    }

    setBalance((prev) => prev - numericBet);

    const newBet: ActiveBet = {
      userId,
      type: selectedBetType,
      amount: numericBet,
      multiplier: selectedBetMultiplier,
      issue: activeTfObj.currentIssue,
      timeframe: activeTimeframe,
    };

    activeTfObj.activeBets.push(newBet);

    setActiveBetsList((prev) => {
      const next = [...prev, newBet];
      activeBetsListRef.current = next;
      if (userId) {
        try {
          localStorage.setItem(`pkw_active_bets_${userId}`, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    // Notify backend server of placed bet in real-time
    fetch('/api/bets/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        timeframe: activeTimeframe,
        issue: activeTfObj.currentIssue,
        type: selectedBetType,
        amount: numericBet,
      }),
    }).catch(() => {});

    // Sync transactional deduction to server
    fetch('/api/user/sync-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'trade', delta: -numericBet }),
    }).catch(() => {});

    setBetDrawerOpen(false);
    showToast(`Bet placed for [${activeTimeframe}]: ${selectedBetType} (${numericBet} USDT)`);
  };

  // Deposit Action ($50 minimum + Deposit screenshot proof + Admin approval workflow)
  const handleDepositSubmit = async () => {
    const numDeposit = parseFloat(depositAmountInput);
    if (isNaN(numDeposit) || numDeposit < 50) {
      showToast('⚠️ Minimum deposit amount is 50 USDT. Please enter 50 or more.');
      return;
    }

    if (!depositScreenshot) {
      showToast('⚠️ Please upload the screenshot of your payment receipt before submitting.');
      return;
    }

    setDepositSubmitting(true);
    try {
      const generatedRef = 'PROOF-IMG-' + Date.now().toString(36).toUpperCase();
      const res = await fetch('/api/user/deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: numDeposit,
          network: depositNetwork,
          depositAddress: depositNetwork === 'BEP20' ? depositWallets.bep20 : depositWallets.trc20,
          txHash: generatedRef,
          screenshot: depositScreenshot,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newDep: DepositRecord = {
          id: data.request?.id || ('DEP-' + Math.floor(100000 + Math.random() * 900000)),
          userId,
          amount: numDeposit,
          network: depositNetwork,
          screenshot: depositScreenshot,
          time: 'Just now',
          status: 'Processing',
        };
        setDepositHistory((prev) => [newDep, ...prev]);
        setDepositScreenshot('');
        setDepositTxHashInput('');
        setDepositModalOpen(false);
        showToast(`✅ Deposit slip of $${numDeposit.toFixed(2)} USDT submitted! Admin will verify and credit.`);
      } else {
        showToast(data.message || 'Deposit request failed');
      }
    } catch {
      showToast('Network error while submitting deposit request');
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Helper to handle image file selection and client compression
  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('⚠️ Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    // Check size limit: 12MB raw max
    if (file.size > 12 * 1024 * 1024) {
      showToast('⚠️ Image size too large. Please select an image under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Compress image using HTML5 Canvas
        const canvas = document.createElement('canvas');
        const maxDimension = 1280;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setDepositScreenshot(compressedDataUrl);
          showToast('✅ Payment screenshot attached successfully!');
        } else {
          setDepositScreenshot(event.target?.result as string);
          showToast('Payment screenshot attached!');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Withdraw Action ($50 minimum + Turnover Policy Check + Admin verification)
  const handleWithdrawSubmit = async () => {
    if (!withdrawAddress.trim()) {
      showToast('Please enter your TRC20 wallet address');
      return;
    }
    const numWithdraw = parseFloat(withdrawAmountInput);
    if (isNaN(numWithdraw) || numWithdraw < 50) {
      showToast('⚠️ Minimum withdrawal amount is 50 USDT. Please enter 50 or more.');
      return;
    }
    if (numWithdraw > balance) {
      showToast(`⚠️ Insufficient USDT balance. Available: $${balance.toFixed(2)} USDT`);
      return;
    }

    // Turnover Policy Validation
    if (!turnoverSatisfied) {
      showToast(`⚠️ Turnover Policy Incomplete! You must trade at least $${turnoverRemaining.toFixed(2)} USDT more before withdrawing.`);
      return;
    }

    try {
      const res = await fetch('/api/user/withdraw-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: numWithdraw,
          address: withdrawAddress.trim(),
          userBalance: balance,
          turnoverCompleted: userTurnover,
          turnoverRequired: requiredTurnover,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Deduct from local balance pending Admin approval
        setBalance((prev) => prev - numWithdraw);
        const newWd: WithdrawRecord = {
          id: data.request?.id || ('WD-' + Math.floor(100000 + Math.random() * 900000)),
          userId,
          amount: numWithdraw,
          address: withdrawAddress.substring(0, 6) + '...' + withdrawAddress.substring(withdrawAddress.length - 4),
          time: 'Just now',
          status: 'Processing',
          turnoverCompleted: userTurnover,
          turnoverRequired: requiredTurnover,
        };
        setWithdrawHistory((prev) => [newWd, ...prev]);
        setWithdrawModalOpen(false);
        showToast(`✅ Withdrawal of $${numWithdraw.toFixed(2)} USDT submitted! Processing shortly.`);
      } else {
        showToast(data.message || 'Withdrawal request failed');
      }
    } catch {
      showToast('Network error while submitting withdrawal request');
    }
  };

  // Stats for Profile Tab
  const totalWins = useMemo(() => {
    return betHistory
      .filter((h) => h.result === 'WIN')
      .reduce((acc, curr) => acc + curr.payout, 0);
  }, [betHistory]);

  const totalWonRounds = useMemo(() => {
    return betHistory.filter((h) => h.result === 'WIN').length;
  }, [betHistory]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  // Filtered draws for Lottery Draw View (displays all authoritative draws or user win/loss bets)
  const filteredDraws = useMemo(() => {
    return drawHistory.filter((d) => {
      // Timeframe filter
      if (drawTimeframeFilter !== 'all' && d.timeframe !== drawTimeframeFilter) {
        return false;
      }

      // Result filter (WIN / LOSS / ALL)
      if (drawResultFilter === 'win') {
        return d.userBets && d.userBets.some((b) => b.result === 'WIN');
      }
      if (drawResultFilter === 'loss') {
        return d.userBets && d.userBets.some((b) => b.result === 'LOSS');
      }

      return true; // 'all' shows all official server draws
    });
  }, [drawHistory, drawTimeframeFilter, drawResultFilter]);

  const totalBetDraws = useMemo(() => {
    return drawHistory.filter((d) => d.userBets && d.userBets.length > 0);
  }, [drawHistory]);

  const totalWinDraws = useMemo(() => {
    return totalBetDraws.filter((d) => d.userBets?.some((b) => b.result === 'WIN'));
  }, [totalBetDraws]);

  const totalLossDraws = useMemo(() => {
    return totalBetDraws.filter((d) => d.userBets?.some((b) => b.result === 'LOSS'));
  }, [totalBetDraws]);

  return (
    <div className="min-h-screen bg-[#060a17] text-white flex flex-col justify-between max-w-md mx-auto relative border-x border-[#121e3d] shadow-2xl overflow-x-hidden pb-16 select-none font-sans">
      {/* TOP HEADER */}
      <header className="bg-[#080d1f]/95 backdrop-blur-lg px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-40 border-b border-[#16254a]/80 shadow-lg">
        {activeTab === 'home' ? (
          <div className="flex items-center space-x-2.5">
            <div className="relative group">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-black font-black text-xs shadow-lg shadow-amber-500/30 border border-amber-300/60 transition-transform group-hover:scale-105">
                CW
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#080d1f] animate-pulse"></span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-base tracking-tight text-white leading-none">
                  CryptoWin
                </span>
                <span className="text-[10px] font-black bg-gradient-to-r from-amber-400 to-yellow-300 text-black px-1.5 py-0.5 rounded shadow-sm leading-none">
                  PRO
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-[9px] text-gray-400 mt-1 font-medium">
                <span className="flex items-center text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1 animate-pulse"></span>
                  LIVE ENGINE
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-300">Win-Go 30s Arena</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('home')}
              className="text-gray-300 hover:text-white p-1 rounded-lg hover:bg-white/5 transition cursor-pointer"
              aria-label="Home"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              {activeTab === 'trade' ? (tradeMode === 'trade' ? 'Win-Go Trade' : 'Lottery Results') : activeTab.toUpperCase()}
            </span>
          </div>
        )}

        {/* Top Switcher (Trade / Lottery draw) */}
        {activeTab === 'trade' && (
          <div className="flex bg-[#060a17] p-1 rounded-xl border border-[#121e3d] text-xs">
            <button
              onClick={() => {
                setTradeMode('trade');
                setActiveTab('trade');
              }}
              className={`px-3.5 py-1 rounded-lg font-semibold transition ${
                tradeMode === 'trade' && activeTab === 'trade'
                  ? 'bg-[#0088ff] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Trade
            </button>
            <button
              onClick={() => {
                setTradeMode('draw');
                setActiveTab('trade');
              }}
              className={`px-3 py-1 rounded-lg transition font-semibold flex items-center space-x-1 ${
                tradeMode === 'draw' && activeTab === 'trade'
                  ? 'bg-[#0088ff] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {/* Rules Button */}
          <button
            onClick={() => setRulesModalOpen(true)}
            className="text-xs text-gray-300 font-medium hover:text-white flex items-center space-x-1 transition cursor-pointer bg-[#121e3d]/80 px-2 py-1 rounded-lg border border-white/5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#0088ff]" />
            <span>Rules</span>
          </button>

          {/* Auth / Profile quick buttons */}
          {!currentUser ? (
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setAuthModalOpen(true);
                }}
                className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] rounded-lg shadow-md transition flex items-center space-x-1 cursor-pointer active:scale-95"
              >
                <UserPlus className="w-3 h-3" />
                <span>Register</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthModalOpen(true);
                }}
                className="px-2 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 font-bold text-[11px] rounded-lg border border-purple-500/30 transition flex items-center space-x-1 cursor-pointer active:scale-95"
              >
                <LogIn className="w-3 h-3" />
                <span>Log In</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('my')}
              className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 font-bold text-[11px] rounded-lg border border-purple-500/30 transition flex items-center space-x-1.5 cursor-pointer"
              title="Go to My Account"
            >
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span className="max-w-[70px] truncate">{currentUser.username}</span>
            </button>
          )}
        </div>
      </header>

      {/* Referral Invitation sticky banner if guest arrived via invite link */}
      {!currentUser && invitedByCode && (
        <div className="bg-gradient-to-r from-purple-950/95 via-indigo-950/95 to-[#0b1228] border-b border-purple-500/40 px-3.5 py-2 flex items-center justify-between shadow-md z-30">
          <div className="flex items-center space-x-2 min-w-0 mr-2">
            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0 animate-pulse" />
            <div className="truncate">
              <span className="text-[11px] text-white font-medium block truncate">
                Invited with code <strong className="text-yellow-300 font-mono font-bold">{invitedByCode}</strong>
              </span>
              <span className="text-[9px] text-purple-200 block">Register now to claim your +$2.00 USDT welcome bonus!</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAuthTab('register');
              setAuthModalOpen(true);
            }}
            className="px-3 py-1 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black rounded-lg text-[10px] tracking-wide transition shadow shrink-0 cursor-pointer"
          >
            Register Now
          </button>
        </div>
      )}

      {/* VIEW CONTAINERS */}
      <main className="flex-1 flex flex-col">
        {/* 1. HOME TAB */}
        {activeTab === 'home' && (
          <div className="p-4 space-y-4 animate-fadeIn">
            {/* VIP EXECUTIVE WALLET CARD */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c183a] via-[#091129] to-[#040817] border border-amber-500/35 p-4 sm:p-5 shadow-2xl shadow-blue-950/50">
              {/* Decorative Ambient Radial Lights & Glass Reflections */}
              <div className="absolute -right-8 -top-8 w-44 h-44 bg-amber-500/12 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-8 -bottom-8 w-44 h-44 bg-blue-600/12 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-amber-400/10 via-transparent to-transparent pointer-events-none" />

              <div className="relative z-10 space-y-3.5">
                {/* User Identity & VIP Level Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-purple-600/30 to-blue-600/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-black shadow-inner">
                        {currentUser ? (
                          <span className="text-sm font-black text-amber-300">
                            {currentUser.username.substring(0, 2).toUpperCase()}
                          </span>
                        ) : (
                          <User className="w-5 h-5 text-amber-400" />
                        )}
                      </div>
                      <span className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-500 rounded-full border-2 border-[#091129]">
                        <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-black text-white">
                          {currentUser ? currentUser.username : `Guest Trader`}
                        </span>
                        <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded border border-emerald-500/30">
                          VERIFIED
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400 font-mono">
                          UID: {currentUser ? currentUser.id : userId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(currentUser ? currentUser.id : userId);
                            showToast('User ID copied to clipboard!');
                          }}
                          className="text-gray-400 hover:text-amber-300 p-0.5 transition cursor-pointer"
                          title="Copy User ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* VIP Badge */}
                  <div className="bg-gradient-to-r from-amber-500/15 to-yellow-500/5 border border-amber-500/30 rounded-2xl px-3 py-1 text-right">
                    <div className="flex items-center space-x-1 justify-end">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                        VIP 1
                      </span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono font-bold block">
                      ⚡ Instant Out
                    </span>
                  </div>
                </div>

                {/* USDT Valuation & Balance */}
                <div className="bg-[#050b1c]/85 rounded-2xl p-3 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      <span>Total Available Balance</span>
                    </span>
                  </div>

                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400">
                      {balance.toFixed(2)}
                    </span>
                    <span className="text-sm font-extrabold text-amber-400 font-mono">USDT</span>
                  </div>
                </div>

                {/* Primary Action Buttons (Deposit & Withdraw) */}
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositAmountInput('50');
                      setDepositModalOpen(true);
                    }}
                    className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950/60 flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                    <span>+ DEPOSIT USDT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawAmountInput('50');
                      setWithdrawModalOpen(true);
                    }}
                    className="py-2.5 px-3 bg-gradient-to-r from-[#0088ff] to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-lg shadow-blue-950/60 flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    <span>WITHDRAW</span>
                  </button>
                </div>

                {/* Guest Callout to Login/Register if not signed in */}
                {!currentUser && (
                  <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border border-purple-500/30 rounded-xl p-2 flex items-center justify-between">
                    <span className="text-[11px] text-purple-200">
                      Welcome to CryptoWin Pro! Trade & win instantly.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('register');
                        setAuthModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[10px] rounded-lg shadow transition cursor-pointer"
                    >
                      Register Now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* QUICK SERVICE ACTION HUB */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTradeMode('trade');
                  setActiveTab('trade');
                }}
                className="bg-[#0b1228] hover:bg-[#121e3d] active:scale-95 border border-[#16254a] rounded-2xl p-2.5 flex flex-col items-center justify-center space-y-1.5 transition shadow-md group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-900/40 group-hover:scale-105 transition">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-gray-200 text-center leading-tight">
                  Win-Go Arena
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDepositAmountInput('50');
                  setDepositModalOpen(true);
                }}
                className="bg-[#0b1228] hover:bg-[#121e3d] active:scale-95 border border-[#16254a] rounded-2xl p-2.5 flex flex-col items-center justify-center space-y-1.5 transition shadow-md group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/40 group-hover:scale-105 transition">
                  <Coins className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-gray-200 text-center leading-tight">
                  Fast Deposit
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSupportChatOpen(true)}
                className="bg-[#0b1228] hover:bg-[#121e3d] active:scale-95 border border-[#16254a] rounded-2xl p-2.5 flex flex-col items-center justify-center space-y-1.5 transition shadow-md group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-900/40 group-hover:scale-105 transition">
                  <Headphones className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-gray-200 text-center leading-tight">
                  Live Support
                </span>
              </button>
            </div>

            {/* Running Broadcast Notice Ticker Ribbon (Chalnay wali patti) */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#121e3d] to-purple-500/15 border border-amber-500/30 p-2.5 shadow-lg shadow-amber-950/20 flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 shadow-md">
                <Flame className="w-3.5 h-3.5 text-black fill-black animate-bounce" />
                <span>Notice</span>
              </div>

              <div className="overflow-hidden flex-1 relative select-none">
                <div className="animate-marquee-continuous whitespace-nowrap text-xs font-semibold text-gray-200 py-0.5">
                  <div className="inline-flex items-center space-x-6 pr-8">
                    <span className="text-amber-300 font-bold tracking-wide">
                      {announcementTicker}
                    </span>
                    <span className="text-gray-500 font-mono">•</span>
                    <span className="text-emerald-400">⚡ 30s Fast Settlement Options</span>
                    <span className="text-gray-500 font-mono">•</span>
                    <span className="text-blue-400">🛡️ 24/7 Fast Deposit & Withdrawal</span>
                    <span className="text-gray-500 font-mono">•</span>
                    <span className="text-yellow-400">🚀 100% Fair BTC Live Algorithm</span>
                    <span className="text-gray-500 font-mono">•</span>
                  </div>
                  <div className="inline-flex items-center space-x-6 pr-8">
                    <span className="text-amber-300 font-bold tracking-wide">
                      {announcementTicker}
                    </span>
                    <span className="text-gray-500 font-mono">•</span>
                    <span className="text-emerald-400">⚡ 30s Fast Settlement Options</span>
                    <span className="text-gray-500 font-mono">•</span>
                    <span className="text-blue-400">🛡️ 24/7 Fast Deposit & Withdrawal</span>
                    <span className="text-gray-500 font-mono">•</span>
                    <span className="text-yellow-400">🚀 100% Fair BTC Live Algorithm</span>
                    <span className="text-gray-500 font-mono">•</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center space-x-1 pl-1 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                <span>HOT</span>
              </div>
            </div>

            {/* Prominent Game Launch Card */}
            <div className="bg-gradient-to-br from-[#121e3d] via-[#0b1228] to-[#041538] p-5 rounded-3xl border border-amber-500/40 shadow-xl relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-15 text-amber-400 pointer-events-none">
                <TrendingUp className="w-36 h-36" />
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold uppercase rounded-full flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                      <span>Live Options Arena</span>
                    </span>
                    <span className="text-xs text-amber-300 font-bold">30s • 1m • 5m</span>
                  </div>
                  <span className="text-[10px] bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-black">
                    UP TO 3.8X WIN
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white tracking-wide flex items-center space-x-2">
                    <span>CryptoWin Win-Go Arena</span>
                    <Flame className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Predict live BTC price outcomes (Big / Small / Single / Double & Combos) with instant settlement!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setTradeMode('trade');
                      setActiveTab('trade');
                    }}
                    className="py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.98] text-black font-black rounded-2xl text-xs shadow-lg shadow-amber-950/50 flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <TrendingUp className="w-4 h-4 text-black" />
                    <span>PLAY WIN-GO</span>
                  </button>
                  <button
                    onClick={() => {
                      setTradeMode('draw');
                      setActiveTab('trade');
                    }}
                    className="py-3 bg-[#121e3d] hover:bg-[#1a2b56] active:scale-[0.98] text-white font-extrabold rounded-2xl text-xs border border-[#1a2b56] flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-[#ffea00]" />
                    <span>LOTTERY DRAWS</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Crypto Market Tickers */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Live Crypto Market</span>
                <span className="text-[10px] text-emerald-400 font-normal flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Live Ticker
                </span>
              </h3>

              <div className="space-y-2">
                {/* BTC */}
                <div
                  onClick={() => {
                    setTradeMode('trade');
                    setActiveTab('trade');
                  }}
                  className="bg-[#0b1228] hover:bg-[#121e3d] p-3 rounded-xl border border-[#121e3d] flex justify-between items-center cursor-pointer transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                      ₿
                    </div>
                    <div>
                      <span className="text-sm font-bold block">BTC / USDT</span>
                      <span className="text-[10px] text-gray-400">Bitcoin Realtime</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono-num text-white block">
                      ${btcPrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">+2.45%</span>
                  </div>
                </div>

                {/* ETH */}
                <div
                  onClick={() => {
                    setTradeMode('trade');
                    setActiveTab('trade');
                  }}
                  className="bg-[#0b1228] hover:bg-[#121e3d] p-3 rounded-xl border border-[#121e3d] flex justify-between items-center cursor-pointer transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                      Ξ
                    </div>
                    <div>
                      <span className="text-sm font-bold block">ETH / USDT</span>
                      <span className="text-[10px] text-gray-400">Ethereum Realtime</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono-num text-white block">$2,540.80</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">+1.80%</span>
                  </div>
                </div>

                {/* BNB */}
                <div
                  onClick={() => {
                    setTradeMode('trade');
                    setActiveTab('trade');
                  }}
                  className="bg-[#0b1228] hover:bg-[#121e3d] p-3 rounded-xl border border-[#121e3d] flex justify-between items-center cursor-pointer transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                      BNB
                    </div>
                    <div>
                      <span className="text-sm font-bold block">BNB / USDT</span>
                      <span className="text-[10px] text-gray-400">BNB Chain Realtime</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono-num text-white block">$624.50</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">+3.12%</span>
                  </div>
                </div>

                {/* SOL */}
                <div
                  onClick={() => {
                    setTradeMode('trade');
                    setActiveTab('trade');
                  }}
                  className="bg-[#0b1228] hover:bg-[#121e3d] p-3 rounded-xl border border-[#121e3d] flex justify-between items-center cursor-pointer transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold">
                      SOL
                    </div>
                    <div>
                      <span className="text-sm font-bold block">SOL / USDT</span>
                      <span className="text-[10px] text-gray-400">Solana Realtime</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono-num text-white block">$148.25</span>
                    <span className="text-[10px] text-red-400 font-semibold">-0.65%</span>
                  </div>
                </div>

                {/* XRP */}
                <div
                  onClick={() => {
                    setTradeMode('trade');
                    setActiveTab('trade');
                  }}
                  className="bg-[#0b1228] hover:bg-[#121e3d] p-3 rounded-xl border border-[#121e3d] flex justify-between items-center cursor-pointer transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                      XRP
                    </div>
                    <div>
                      <span className="text-sm font-bold block">XRP / USDT</span>
                      <span className="text-[10px] text-gray-400">Ripple Realtime</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono-num text-white block">$0.5820</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">+4.15%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TRANSACTION / TRADE TAB (TRADE MODE vs LOTTERY DRAW MODE) */}
        {activeTab === 'trade' && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            {/* ===================== TRADE VIEW ===================== */}
            {tradeMode === 'trade' && (
              <div className="flex-1 flex flex-col">
                {/* BTC Price & Timeframe Selector (Max 1hour, day removed) */}
                <div className="p-4 pb-2 bg-[#0b1228] border-b border-[#121e3d]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-bold tracking-tight text-white">BTC / USDT</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                        Live
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-2xl font-extrabold font-mono-num transition-colors duration-300 ${
                          priceChangeDirection === 'up' ? 'text-[#00e676]' : 'text-[#ff4d4d]'
                        }`}
                      >
                        {btcPrice.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-emerald-400 font-medium">+2.45% 24h</span>
                    </div>
                  </div>

                  {/* Timeframe Tabs: 30s, 1min, 5min, 15min, 30min, 1hour (day removed) */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-[#121e3d]/80 pt-2 font-medium overflow-x-auto space-x-1">
                    {availableTimeframes.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => handleTimeframeChange(tf)}
                        className={`px-3 py-1 rounded-md whitespace-nowrap transition font-medium ${
                          activeTimeframe === tf
                            ? 'text-white bg-[#1a2b56] font-bold border-b-2 border-[#0088ff]'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Candlestick Chart Canvas */}
                <div className="relative bg-[#060a17] w-full h-60 border-b border-[#121e3d] overflow-hidden">
                  <canvas ref={canvasRef} className="w-full h-full block" />

                  {/* Overlay Moving Averages */}
                  <div className="absolute top-2 left-3 pointer-events-none flex space-x-3 text-[10px] font-mono-num">
                    <span className="text-yellow-400">MA5: {(btcPrice + 12).toFixed(1)}</span>
                    <span className="text-blue-400">MA10: {(btcPrice - 18).toFixed(1)}</span>
                    <span className="text-purple-400">MA20: {(btcPrice - 40).toFixed(1)}</span>
                  </div>
                </div>

                {/* Last Result & Issue Countdown Section */}
                <div className="p-4 bg-[#0b1228] border-b border-[#121e3d] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono-num text-gray-300">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-gray-400">Last issue:</span>
                      <span className="text-white font-bold">{lastResultUI.price}</span>
                      <span className="text-[#0088ff] font-bold">{lastResultUI.math}</span>
                    </div>
                  </div>

                  {/* Issue Tags & Refresh */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                      {lastResultUI.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded border border-[#121e3d] text-xs font-bold ${
                            tag.includes('Big')
                              ? 'bg-[#121e3d] text-[#0088ff]'
                              : tag.includes('Small')
                              ? 'bg-[#121e3d] text-emerald-400'
                              : 'bg-[#121e3d] text-purple-400'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        fetchTimeframeHistory(activeTimeframe);
                        showToast('Round data refreshed from server');
                      }}
                      className="px-3 py-1 bg-[#0088ff] hover:bg-blue-600 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center space-x-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Current Issue Countdown & Wallet Balance */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#121e3d]/80">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono-num text-gray-400">#{uiTimer.issue}</span>
                      <div
                        className={`flex items-center space-x-1 text-base font-bold font-mono-num px-2.5 py-1 rounded-lg border transition ${
                          uiTimer.isLocked
                            ? 'bg-red-950/60 border-red-500/70 text-red-400 shadow-md shadow-red-950 animate-pulse'
                            : 'bg-[#060a17] border-[#121e3d] text-white'
                        }`}
                      >
                        <span>{uiTimer.min}</span>
                        <span>:</span>
                        <span>{uiTimer.sec}</span>
                      </div>
                      {uiTimer.isLocked && (
                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-black rounded-lg uppercase flex items-center space-x-1">
                          <Lock className="w-2.5 h-2.5 mr-0.5" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block">Balance:</span>
                      <span className="text-sm font-bold font-mono-num text-[#ffea00]">
                        {balance.toFixed(4)} USDT
                      </span>
                    </div>
                  </div>

                  {/* Active Bets for this round (Preserved across page refreshes) */}
                  {activeBetsList.filter((b) => b.timeframe === activeTimeframe).length > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-blue-950/60 border border-blue-500/40 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                        <span className="text-gray-300 font-semibold">Active Bet:</span>
                        {activeBetsList.filter((b) => b.timeframe === activeTimeframe).map((b, idx) => (
                          <span key={idx} className="font-bold text-yellow-300 bg-blue-900/80 px-2 py-0.5 rounded border border-blue-400/50">
                            {b.type} (${b.amount} USDT) #{b.issue}
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-blue-300 font-mono-num font-semibold">
                        Awaiting Draw
                      </span>
                    </div>
                  )}
                </div>

                {/* Betting Options Buttons Grid */}
                <div className="p-4 bg-[#060a17] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Predict Next Draw Option:
                    </h3>
                    <span className="text-[10px] text-gray-400">Timeframe: {activeTimeframe}</span>
                  </div>

                  {/* Lock Banner if time is up / settling */}
                  {uiTimer.isLocked && (
                    <div className="bg-red-500/15 border border-red-500/50 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-red-300 animate-pulse">
                      <div className="flex items-center space-x-2">
                        <Lock className="w-3.5 h-3.5 text-red-400" />
                        <span className="font-bold">Betting Closed for Issue #{uiTimer.issue}</span>
                      </div>
                      <span className="text-[11px] text-gray-300 font-mono-num font-bold">
                        Drawing in {uiTimer.sec}s
                      </span>
                    </div>
                  )}

                  {/* Row 1: Single Property Bets (1.95 Multiplier) */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Big', mult: 1.95 },
                      { name: 'Small', mult: 1.95 },
                      { name: 'Single', mult: 1.95 },
                      { name: 'Double', mult: 1.95 },
                    ].map((item) => (
                      <button
                        key={item.name}
                        onClick={() => openBetDrawer(item.name, item.mult)}
                        className={`rounded-xl py-2.5 text-center flex flex-col items-center justify-center transition ${
                          uiTimer.isLocked
                            ? 'bg-[#121e3d] text-gray-400 opacity-60 cursor-not-allowed border border-[#1a2b56]'
                            : 'bg-gradient-to-b from-[#1d82f5] to-[#0363d6] active:scale-95 shadow-md shadow-blue-900/30'
                        }`}
                      >
                        <span className="text-xs font-extrabold text-white">{item.name}</span>
                        <span className="text-[10px] text-blue-200 mt-0.5">{item.mult}</span>
                      </button>
                    ))}
                  </div>

                  {/* Row 2: Combination Combo Bets (3.8 Multiplier) */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'SmallDouble', mult: 3.8 },
                      { name: 'SmallSingle', mult: 3.8 },
                      { name: 'BigDouble', mult: 3.8 },
                      { name: 'BigSingle', mult: 3.8 },
                    ].map((item) => (
                      <button
                        key={item.name}
                        onClick={() => openBetDrawer(item.name, item.mult)}
                        className={`rounded-xl py-2.5 text-center flex flex-col items-center justify-center transition ${
                          uiTimer.isLocked
                            ? 'bg-[#121e3d] text-gray-400 opacity-60 cursor-not-allowed border border-[#1a2b56]'
                            : 'bg-gradient-to-b from-[#1d82f5] to-[#0363d6] active:scale-95 shadow-md shadow-blue-900/30'
                        }`}
                      >
                        <span className="text-[11px] font-extrabold text-white">{item.name}</span>
                        <span className="text-[10px] text-blue-200 mt-0.5">{item.mult}</span>
                      </button>
                    ))}
                  </div>

                  {/* Jump directly to Lottery Draw Results view */}
                  <div className="pt-2">
                    <button
                      onClick={() => setTradeMode('draw')}
                      className="w-full py-3 bg-gradient-to-r from-[#0b1228] to-[#121e3d] hover:to-[#1a2b56] active:scale-[0.99] border border-[#0088ff]/40 rounded-2xl flex items-center justify-between px-4 text-xs font-semibold text-white transition shadow-lg"
                    >
                      <span className="flex items-center space-x-2">
                        <Trophy className="w-4 h-4 text-[#ffea00]" />
                        <span>View Live Lottery Draw & Bet Results</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#0088ff]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== LOTTERY DRAW & BETS RESULTS VIEW ===================== */}
            {tradeMode === 'draw' && (
              <div className="flex-1 flex flex-col space-y-3 p-4 animate-fadeIn">
                {/* Timeframe Filter Bar (All + up to 1hour, day removed) */}
                <div className="bg-[#0b1228] p-2.5 rounded-2xl border border-[#121e3d] space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center space-x-1 font-bold text-white">
                      <Timer className="w-3.5 h-3.5 text-[#0088ff]" />
                      <span>Filter by Timeframe:</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono-num">
                      {drawTimeframeFilter === 'all' ? 'Showing All' : `Filter: ${drawTimeframeFilter}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                    {['all', ...availableTimeframes].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => {
                          setDrawTimeframeFilter(tf);
                          if (tf !== 'all') {
                            handleTimeframeChange(tf);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                          drawTimeframeFilter === tf
                            ? 'bg-[#0088ff] text-white shadow-md shadow-blue-900/40'
                            : 'bg-[#060a17] text-gray-400 hover:text-white border border-[#121e3d]'
                        }`}
                      >
                        {tf === 'all' ? 'All Timeframes' : tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Next Draw Countdown Card */}
                <div className="bg-gradient-to-r from-[#0b1228] via-[#121e3d] to-[#0b1228] p-4 rounded-2xl border border-[#0088ff]/40 shadow-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                      Current Live Issue [{activeTimeframe}]
                    </span>
                    <h3 className="text-base font-black text-white font-mono-num">
                      #{uiTimer.issue}
                    </h3>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                      Settling at Live BTC Price
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block font-bold">Next Draw In</span>
                    <div className="flex items-center space-x-1 text-xl font-extrabold font-mono-num text-[#ffea00] bg-[#060a17] px-3 py-1 rounded-xl border border-[#121e3d] mt-0.5 shadow-inner">
                      <span>{uiTimer.min}</span>
                      <span>:</span>
                      <span>{uiTimer.sec}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs: Filter by Placed Bets Result (All vs Wins vs Losses) */}
                <div className="flex bg-[#0b1228] p-1 rounded-xl border border-[#121e3d] text-xs">
                  <button
                    onClick={() => setDrawResultFilter('all')}
                    className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1 ${
                      drawResultFilter === 'all'
                        ? 'bg-[#0088ff] text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>All Bets ({totalBetDraws.length})</span>
                  </button>
                  <button
                    onClick={() => setDrawResultFilter('win')}
                    className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1 ${
                      drawResultFilter === 'win'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Wins ({totalWinDraws.length})</span>
                  </button>
                  <button
                    onClick={() => setDrawResultFilter('loss')}
                    className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center space-x-1 ${
                      drawResultFilter === 'loss'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <X className="w-3.5 h-3.5 text-red-300" />
                    <span>Losses ({totalLossDraws.length})</span>
                  </button>
                </div>

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#0b1228] p-2.5 rounded-xl border border-[#121e3d] text-center">
                    <span className="text-[9px] text-gray-400 block font-semibold">Total Bets Placed</span>
                    <span className="text-sm font-bold font-mono-num text-white">
                      {totalBetDraws.length}
                    </span>
                  </div>
                  <div className="bg-[#0b1228] p-2.5 rounded-xl border border-[#121e3d] text-center">
                    <span className="text-[9px] text-gray-400 block font-semibold">Won Draws</span>
                    <span className="text-sm font-bold font-mono-num text-emerald-400">
                      {totalWinDraws.length}
                    </span>
                  </div>
                  <div className="bg-[#0b1228] p-2.5 rounded-xl border border-[#121e3d] text-center">
                    <span className="text-[9px] text-gray-400 block font-semibold">Total Net Payout</span>
                    <span className="text-sm font-bold font-mono-num text-[#ffea00]">
                      +{totalWins.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action button: Place bet on next round */}
                <div className="flex justify-between items-center bg-[#0b1228] p-3 rounded-2xl border border-[#121e3d]">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Current Balance:</span>
                    <span className="text-sm font-extrabold font-mono-num text-[#ffea00]">
                      {balance.toFixed(4)} USDT
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setTradeMode('trade');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#0088ff] to-blue-600 hover:to-blue-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition"
                  >
                    <Flame className="w-3.5 h-3.5 text-[#ffea00]" />
                    <span>Place Bet in Trade</span>
                  </button>
                </div>

                {/* LOTTERY DRAWS & BET RESULTS LIST */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider px-1">
                    <span>
                      {drawResultFilter === 'all'
                        ? 'Settled Bet Draws (Win & Loss)'
                        : drawResultFilter === 'win'
                        ? 'Winning Bet Draws'
                        : 'Loss Bet Draws'}
                      {drawTimeframeFilter !== 'all' ? ` [${drawTimeframeFilter}]` : ' [All Timeframes]'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {filteredDraws.length} records
                    </span>
                  </div>

                  {filteredDraws.length === 0 ? (
                    <div className="p-8 text-center bg-[#0b1228] rounded-2xl border border-[#121e3d] space-y-2">
                      <Trophy className="w-8 h-8 text-gray-600 mx-auto" />
                      <p className="text-xs text-gray-300 font-medium">
                        No settled bet draws found.
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Lottery Draw only displays rounds on which you placed bets (Win or Loss). Unbetted rounds are excluded.
                      </p>
                      <button
                        onClick={() => setTradeMode('trade')}
                        className="px-4 py-2 bg-[#0088ff] hover:bg-blue-600 text-white font-bold text-xs rounded-xl mt-2 transition"
                      >
                        Go to Trade Mode to Bet
                      </button>
                    </div>
                  ) : (
                    filteredDraws.map((d) => {
                      const hasUserBet = d.userBets && d.userBets.length > 0;
                      return (
                        <div
                          key={d.id}
                          className="p-3.5 rounded-2xl border transition shadow-lg bg-gradient-to-b from-[#0e1935] to-[#0b1228] border-[#0088ff]/50 ring-1 ring-[#0088ff]/20"
                        >
                          {/* Top Row: Issue #, Timeframe Badge, and Time */}
                          <div className="flex items-center justify-between pb-2 border-b border-[#121e3d]/80 text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold font-mono-num text-white">
                                #{d.issue}
                              </span>
                              <span className="px-2 py-0.5 bg-[#0088ff]/20 text-[#0088ff] text-[10px] rounded font-bold border border-[#0088ff]/30">
                                {d.timeframe}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">{d.time}</span>
                          </div>

                          {/* Middle Row: BTC Price & 3 Digits Lottery Balls */}
                          <div className="py-2.5 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-gray-400 block">Settled BTC Price:</span>
                              <span className="text-sm font-bold font-mono-num text-white">
                                ${d.price}
                              </span>
                            </div>

                            {/* Lottery Balls (guaranteed to match price's last 3 digits) */}
                            {(() => {
                              const parsed = parseDrawResultFromPrice(d.price, d.issue);
                              return (
                                <div className="flex items-center space-x-1.5">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-xs font-black text-white shadow-md">
                                    {parsed.d1}
                                  </div>
                                  <span className="text-gray-500 text-xs font-bold">+</span>
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-xs font-black text-white shadow-md">
                                    {parsed.d2}
                                  </div>
                                  <span className="text-gray-500 text-xs font-bold">+</span>
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-xs font-black text-white shadow-md">
                                    {parsed.d3}
                                  </div>
                                  <span className="text-gray-500 text-xs font-bold">=</span>
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-black text-white shadow-md">
                                    {parsed.sum}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Outcome Tags */}
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center space-x-1.5">
                              {d.tags.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                    tag.includes('Big')
                                      ? 'bg-blue-500/20 text-[#0088ff] border-blue-500/40'
                                      : tag.includes('Small')
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                      : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <span className="text-[10px] text-gray-400 font-mono-num">
                              Sum: {d.sum} ({d.sum > 13 ? 'Big' : 'Small'})
                            </span>
                          </div>

                          {/* USER BET OUTCOME SECTION (PROMINENTLY DISPLAYED IN LOTTERY DRAW!) */}
                          {hasUserBet && d.userBets && (
                            <div className="mt-3 pt-2.5 border-t border-[#1a2b56] space-y-2">
                              <span className="text-[10px] text-gray-300 uppercase tracking-wider font-extrabold flex items-center space-x-1">
                                <Award className="w-3.5 h-3.5 text-[#ffea00]" />
                                <span>Your Bet Result For This Draw:</span>
                              </span>

                              {d.userBets.map((b) => (
                                <div
                                  key={b.id}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                    b.result === 'WIN'
                                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/50'
                                      : 'bg-red-950/30 border-red-500/40'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-extrabold text-white text-xs">
                                        Bet: {b.type}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-black rounded uppercase flex items-center space-x-1 ${
                                          b.result === 'WIN'
                                            ? 'bg-emerald-500 text-navy-950'
                                            : 'bg-red-500 text-white'
                                        }`}
                                      >
                                        {b.result === 'WIN' ? (
                                          <>
                                            <Check className="w-3 h-3" />
                                            <span>WIN</span>
                                          </>
                                        ) : (
                                          <>
                                            <X className="w-3 h-3" />
                                            <span>LOSS</span>
                                          </>
                                        )}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">
                                      Stake: {b.amount.toFixed(2)} USDT
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span
                                      className={`text-sm font-black font-mono-num block ${
                                        b.result === 'WIN' ? 'text-emerald-400' : 'text-red-400'
                                      }`}
                                    >
                                      {b.result === 'WIN'
                                        ? `+${b.payout.toFixed(2)} USDT`
                                        : `-${b.amount.toFixed(2)} USDT`}
                                    </span>
                                    <span className="text-[9px] text-gray-400">
                                      {b.result === 'WIN' ? 'Payout Credited' : 'Settled'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. NEWS FLASH TAB */}
        {activeTab === 'news' && (
          <div className="p-4 space-y-3 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-[#121e3d] pb-2">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Bell className="w-4 h-4 text-[#0088ff]" />
                <span>News Flash & Notifications</span>
              </h2>
              <button
                onClick={() => showToast('All notifications marked as read')}
                className="text-xs text-[#0088ff] hover:underline"
              >
                Mark all read
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3.5 bg-[#0b1228] rounded-2xl border border-[#121e3d] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                    System Alert
                  </span>
                  <span className="text-[10px] text-gray-400">2 min ago</span>
                </div>
                <h4 className="text-xs font-bold text-white">Instant USDT Deposit & Withdrawal Online</h4>
                <p className="text-xs text-gray-300">
                  TRC-20 and BEP-20 network support is fully enabled. Withdrawals are processed automatically within 5
                  minutes.
                </p>
              </div>

              <div className="p-3.5 bg-[#0b1228] rounded-2xl border border-[#121e3d] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#0088ff]/20 text-[#0088ff] text-[10px] font-bold rounded">
                    Lottery Update
                  </span>
                  <span className="text-[10px] text-gray-400">10 min ago</span>
                </div>
                <h4 className="text-xs font-bold text-white">BTC Options Multiplier Boosted</h4>
                <p className="text-xs text-gray-300">
                  Combination predictions (SmallDouble, BigSingle) now pay out <strong>3.8x USDT</strong> return on win!
                  Draws happen automatically every round.
                </p>
              </div>

              <div className="p-3.5 bg-[#0b1228] rounded-2xl border border-[#121e3d] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded">
                    Market News
                  </span>
                  <span className="text-[10px] text-gray-400">1 hour ago</span>
                </div>
                <h4 className="text-xs font-bold text-white">Bitcoin Surges Past $86,600 USDT</h4>
                <p className="text-xs text-gray-300">
                  Bullish momentum continues across all timeframe rounds (30s, 1min, 5min, 15min, 30min, 1hour).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. MY (PROFILE) TAB - SLEEK DARK CRYPTO THEME WITH REAL DYNAMIC DATA */}
        {activeTab === 'my' && (
          <div className="space-y-4 animate-fadeIn pb-16">
            {/* Top User Asset Card in Dark Luxury Theme */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0c1633] via-[#0b1228] to-[#121e3d] p-5 rounded-3xl border border-[#1a2b56] shadow-2xl">
              <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-[#0088ff]/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[#ffea00]/5 blur-2xl pointer-events-none" />

              {/* User Bar: Name, ID badge, VIP badge */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0088ff] to-[#0055b3] text-white flex items-center justify-center font-black shadow-md border border-[#0088ff]/40">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-white tracking-tight">{userName}</span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black rounded-full border border-amber-500/30">
                        {currentUser ? 'VIP 1' : 'Guest'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const cleanId = userId.replace('USR-', '');
                          copyToClipboard(cleanId, 'User ID');
                        }}
                        className="text-gray-400 hover:text-white text-[11px] font-mono flex items-center space-x-1 group transition"
                      >
                        <span>ID: {userId.replace('USR-', '')}</span>
                        <Copy className="w-3 h-3 text-[#0088ff] group-hover:scale-110 transition" />
                      </button>

                      {/* Live Server Balance Refresh Button */}
                      <button
                        type="button"
                        onClick={handleRefreshBalance}
                        disabled={isRefreshingBalance}
                        className="px-2 py-0.5 rounded-lg bg-[#060a17] hover:bg-[#1a2b56] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition flex items-center space-x-1 text-[10px] font-bold cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
                        title="Sync and refresh live balance from server"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin text-emerald-300' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {!currentUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('login');
                        setAuthModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow flex items-center space-x-1 cursor-pointer active:scale-95"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Log In</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTempUserNameInput(userName);
                      setSettingsModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-[#060a17] hover:bg-[#1a2b56] text-gray-400 hover:text-white border border-[#1a2b56] transition"
                    title="Edit Profile"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Available Assets USDT Label with Eye icon */}
              <div className="mt-4 pt-3 border-t border-[#121e3d] relative z-10 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-gray-400 font-medium">
                  <span>Available Assets (USDT)</span>
                  <button
                    type="button"
                    onClick={() => setShowAssetBalance(!showAssetBalance)}
                    className="text-gray-400 hover:text-white transition"
                    title={showAssetBalance ? "Hide Balance" : "Show Balance"}
                  >
                    {showAssetBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real Wallet</span>
                </span>
              </div>

              {/* Dynamic Balance display */}
              <div className="mt-1 relative z-10 flex items-baseline space-x-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[#ffea00]">
                  {showAssetBalance ? balance.toFixed(4) : '••••••••'}
                </span>
                <span className="text-xs font-bold text-gray-400 font-mono">USDT</span>
              </div>

              {/* Dynamic Statistics: Real user turnover and earnings */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs relative z-10 pt-3 border-t border-[#121e3d]/80">
                <div className="bg-[#060a17]/80 p-2.5 rounded-xl border border-[#121e3d]">
                  <span className="text-[10px] text-gray-400 block font-medium">Today's Transaction</span>
                  <span className="font-mono font-bold text-white text-xs sm:text-sm">
                    {todayTransaction.toFixed(4)} USDT
                  </span>
                </div>
                <div className="bg-[#060a17]/80 p-2.5 rounded-xl border border-[#121e3d]">
                  <span className="text-[10px] text-gray-400 block font-medium">Today's Earnings</span>
                  <span className={`font-mono font-bold text-xs sm:text-sm ${todayEarnings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {todayEarnings >= 0 ? `+${todayEarnings.toFixed(4)}` : todayEarnings.toFixed(4)} USDT
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Row (Top up | Withdraw | Transfer) in Dark Theme */}
            <div className="bg-[#0b1228] rounded-2xl border border-[#1a2b56] p-2 grid grid-cols-3 gap-2 text-center shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setDepositAmountInput('50');
                  setDepositModalOpen(true);
                }}
                className="py-2.5 px-2 bg-gradient-to-r from-emerald-600/30 to-emerald-700/20 hover:from-emerald-600/40 hover:to-emerald-700/30 text-emerald-400 border border-emerald-500/40 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1 active:scale-95 transition"
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Top up</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWithdrawAmountInput('50');
                  setWithdrawModalOpen(true);
                }}
                className="py-2.5 px-2 bg-gradient-to-r from-[#0088ff]/20 to-blue-700/20 hover:from-[#0088ff]/30 hover:to-blue-700/30 text-[#0088ff] border border-[#0088ff]/40 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1 active:scale-95 transition"
              >
                <ArrowUpRight className="w-4 h-4 text-[#0088ff]" />
                <span>Withdraw</span>
              </button>
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                className="py-2.5 px-2 bg-gradient-to-r from-purple-600/20 to-indigo-700/20 hover:from-purple-600/30 hover:to-indigo-700/30 text-purple-300 border border-purple-500/40 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1 active:scale-95 transition"
              >
                <ArrowLeftRight className="w-4 h-4 text-purple-400" />
                <span>Transfer</span>
              </button>
            </div>

            {/* Other Functions 8-Icon Grid (Official removed, balanced & adjusted) */}
            <div className="bg-[#0b1228] rounded-2xl border border-[#121e3d] p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Other Functions</h3>
                <span className="text-[10px] text-gray-500">Fast Services</span>
              </div>

              <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
                {/* 1. My Team */}
                <button
                  type="button"
                  onClick={() => setReferralModalOpen(true)}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-[#0088ff] group-hover:border-[#0088ff] group-hover:scale-105 transition shadow">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">My Team</span>
                </button>

                {/* 2. Financial */}
                <button
                  type="button"
                  onClick={() => setFinancialModalOpen(true)}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-[#06b6d4] group-hover:border-[#06b6d4] group-hover:scale-105 transition shadow">
                    <Coins className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Financial</span>
                </button>

                {/* 3. Commission */}
                <button
                  type="button"
                  onClick={() => setReferralModalOpen(true)}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-amber-400 group-hover:border-amber-400 group-hover:scale-105 transition shadow">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Commission</span>
                </button>

                {/* 4. Customer Support */}
                <button
                  type="button"
                  onClick={() => {
                    setSupportChatOpen(true);
                    fetchUserSupportMessages();
                  }}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition relative"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 group-hover:scale-105 transition shadow relative">
                    <Headphones className="w-5 h-5" />
                    {hasUnreadSupportReply && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#060a17] absolute -top-0.5 -right-0.5 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Service</span>
                </button>

                {/* 5. Lottery Rules */}
                <button
                  type="button"
                  onClick={() => setRulesModalOpen(true)}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-indigo-400 group-hover:border-indigo-400 group-hover:scale-105 transition shadow">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Rules</span>
                </button>

                {/* 6. Download App */}
                <button
                  type="button"
                  onClick={() => setDownloadModalOpen(true)}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-sky-400 group-hover:border-sky-400 group-hover:scale-105 transition shadow">
                    <Download className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Download</span>
                </button>

                {/* 7. Setting */}
                <button
                  type="button"
                  onClick={() => {
                    setTempUserNameInput(userName);
                    setSettingsModalOpen(true);
                  }}
                  className="flex flex-col items-center space-y-1.5 group active:scale-95 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-blue-400 group-hover:border-blue-400 group-hover:scale-105 transition shadow">
                    <Settings className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Setting</span>
                </button>

                {/* 8. Log Out / Log In */}
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => setLogoutModalOpen(true)}
                    className="flex flex-col items-center space-y-1.5 group active:scale-95 transition cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center text-red-400 group-hover:border-red-400 group-hover:scale-105 transition shadow">
                      <Power className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] text-gray-300 font-medium group-hover:text-white">Log Out</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthModalOpen(true);
                    }}
                    className="flex flex-col items-center space-y-1.5 group active:scale-95 transition cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#060a17] border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:border-purple-400 group-hover:scale-105 transition shadow">
                      <LogIn className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] text-purple-300 font-medium group-hover:text-white">Log In</span>
                  </button>
                )}
              </div>
            </div>

            {/* Referral Banner & $2 Bonus in Dark Theme */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-[#0b1228] to-[#121e3d] rounded-2xl p-4 border border-emerald-500/30 flex items-center justify-between shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>Referral Program</span>
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded border border-emerald-500/40">
                      +$2 USDT
                    </span>
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">Instant bonus for every friend who joins</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReferralModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Invite
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0b1228] border-t border-[#121e3d] py-2 px-3 flex justify-between items-center z-40 text-gray-400">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center space-y-1 transition ${
            activeTab === 'home' ? 'text-[#0088ff] font-bold' : 'hover:text-white'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>
        <button
          onClick={() => {
            setTradeMode('trade');
            setActiveTab('trade');
          }}
          className={`flex flex-col items-center space-y-1 transition ${
            activeTab === 'trade' && tradeMode === 'trade' ? 'text-[#0088ff] font-bold' : 'hover:text-white'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px]">Transaction</span>
        </button>
        <button
          onClick={() => {
            setTradeMode('draw');
            setActiveTab('trade');
          }}
          className={`flex flex-col items-center space-y-1 transition ${
            activeTab === 'trade' && tradeMode === 'draw' ? 'text-[#ffea00] font-bold' : 'hover:text-white'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px]">Draws</span>
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`flex flex-col items-center space-y-1 transition ${
            activeTab === 'news' ? 'text-[#0088ff] font-bold' : 'hover:text-white'
          }`}
        >
          <Bell className="w-5 h-5" />
          <span className="text-[10px]">News flash</span>
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex flex-col items-center space-y-1 transition ${
            activeTab === 'my' ? 'text-[#0088ff] font-bold' : 'hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">My</span>
        </button>
      </nav>

      {/* BETTING MODAL / BOTTOM DRAWER */}
      {betDrawerOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col justify-end animate-fadeIn">
          <div className="bg-[#0b1228] rounded-t-3xl p-5 border-t border-[#1a2b56] space-y-4 max-w-md mx-auto w-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Place Bet:</span>
                  <span className="text-[#0088ff] font-extrabold">{selectedBetType}</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Timeframe: <span className="text-white font-bold">{activeTimeframe}</span> | Payout Rate:{' '}
                  <span className="text-emerald-400 font-bold">{selectedBetMultiplier}x</span>
                </p>
              </div>
              <button
                onClick={() => setBetDrawerOpen(false)}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Countdown / Round Lock Alert */}
            {uiTimer.isLocked && (
              <div className="bg-red-500/15 border border-red-500/50 rounded-2xl p-3 flex items-center space-x-2.5 text-xs text-red-300 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <span className="font-bold block text-white">Betting Closed for #{uiTimer.issue}!</span>
                  <span className="text-[11px] text-gray-300">
                    Round time ended. Settlement in progress, next issue in {uiTimer.sec}s.
                  </span>
                </div>
              </div>
            )}

            {/* Preset Amount Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400 font-medium">Select Amount (USDT):</label>
                <span className="text-[11px] text-gray-400">
                  Balance: <strong className="text-[#ffea00] font-mono-num">{balance.toFixed(2)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 5, 10, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBetAmountInput(String(amt))}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      parseFloat(betAmountInput) === amt && !betAmountInput.includes('.')
                        ? 'bg-[#0088ff] border-[#0088ff] text-white shadow'
                        : 'bg-[#121e3d] hover:bg-[#1a2b56] border-[#121e3d] text-white'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input (Fixed zero issue: user can clear completely and type custom amount like 380 without 0380) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 font-medium">Or Enter Custom Amount:</label>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(betAmountInput) || 0;
                      setBetAmountInput(String(cur + 10));
                    }}
                    className="px-2 py-0.5 bg-[#121e3d] hover:bg-[#1a2b56] text-blue-300 rounded font-bold"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(betAmountInput) || 0;
                      setBetAmountInput(String(cur + 50));
                    }}
                    className="px-2 py-0.5 bg-[#121e3d] hover:bg-[#1a2b56] text-blue-300 rounded font-bold"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBetAmountInput(String(Math.floor(balance)));
                    }}
                    className="px-2 py-0.5 bg-[#121e3d] hover:bg-[#1a2b56] text-emerald-400 rounded font-bold"
                  >
                    Max
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={betAmountInput}
                  onChange={(e) => {
                    let val = e.target.value;
                    // Allow blank state so field can be fully cleared
                    if (val === '') {
                      setBetAmountInput('');
                      return;
                    }
                    // Only allow digits and single dot
                    val = val.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                      val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    // Strip leading zeroes so typing 380 does NOT become 0380
                    if (val.length > 1 && val.startsWith('0') && val[1] !== '.') {
                      val = val.replace(/^0+/, '');
                      if (val === '') val = '0';
                    }
                    setBetAmountInput(val);
                  }}
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-4 pr-16 py-2.5 text-sm text-white font-mono-num focus:outline-none focus:border-[#0088ff]"
                  placeholder="Enter amount (e.g. 380)"
                />
                {betAmountInput && (
                  <button
                    type="button"
                    onClick={() => setBetAmountInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded bg-[#121e3d]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Expected Return Box */}
            <div className="bg-[#060a17] p-3 rounded-xl border border-[#121e3d] flex justify-between items-center text-xs">
              <span className="text-gray-400">Estimated Profit Win:</span>
              <span className="text-sm font-extrabold text-[#ffea00]">
                {((parseFloat(betAmountInput) || 0) * selectedBetMultiplier).toFixed(2)} USDT
              </span>
            </div>

            <button
              onClick={handleConfirmBet}
              disabled={uiTimer.isLocked}
              className={`w-full py-3.5 text-white font-extrabold rounded-2xl text-sm transition flex items-center justify-center space-x-1.5 ${
                uiTimer.isLocked
                  ? 'bg-gray-700/80 opacity-60 cursor-not-allowed border border-gray-600'
                  : 'bg-[#0088ff] hover:bg-blue-600 active:scale-95 shadow-lg shadow-blue-900/40'
              }`}
            >
              {uiTimer.isLocked ? (
                <>
                  <Lock className="w-4 h-4 mr-1" />
                  <span>Betting Closed (Next round in {uiTimer.sec}s)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  <span>Confirm Bet Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* DEPOSIT USDT MODAL */}
      {depositModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-xs w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>Deposit USDT</span>
              </h3>
              <button onClick={() => setDepositModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Real-time explanation banner */}
            <div className="bg-[#0088ff]/10 border border-[#0088ff]/30 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-blue-200">
              <Info className="w-4 h-4 text-[#0088ff] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-white block">Deposit Instructions:</span>
                <p className="text-[11px] text-gray-300 leading-tight">
                  Please transfer USDT to the official wallet address below using your selected network ({depositNetwork}). After transfer, upload your receipt screenshot to get credited instantly.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Select Network:</label>
                <select
                  value={depositNetwork}
                  onChange={(e) => setDepositNetwork(e.target.value)}
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl p-2 text-xs text-white focus:outline-none"
                >
                  <option value="TRC20">USDT - TRC20 (Tron)</option>
                  <option value="BEP20">USDT - BEP20 (BNB Smart Chain)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-300 font-semibold block">
                    Official Deposit Address ({depositNetwork}):
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                    Official Receiving Wallet
                  </span>
                </div>
                <div className="flex items-center bg-[#060a17] border border-[#1a2b56] rounded-xl px-2.5 py-2 justify-between">
                  <span className="text-[10px] font-mono-num text-emerald-400 truncate mr-2 select-all font-bold">
                    {depositNetwork === 'BEP20' ? depositWallets.bep20 : depositWallets.trc20}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        depositNetwork === 'BEP20' ? depositWallets.bep20 : depositWallets.trc20,
                        `${depositNetwork} Deposit address`
                      )
                    }
                    className="text-xs bg-[#0088ff] hover:bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg shrink-0 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400 font-medium">Deposit Amount (USDT):</label>
                  <div className="flex space-x-1">
                    {['50', '100', '200', '500'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmountInput(amt)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          depositAmountInput === amt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#121e3d] text-gray-300 hover:text-white'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={depositAmountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Only allow positive numbers and decimals
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setDepositAmountInput(val);
                      }
                    }}
                    placeholder="Enter amount (Min 50 USDT)"
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-3 pr-14 py-2.5 text-sm text-white font-mono-num focus:outline-none focus:border-emerald-500"
                  />
                  {depositAmountInput && (
                    <button
                      type="button"
                      onClick={() => setDepositAmountInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-[10px] px-1.5 py-0.5 rounded bg-[#121e3d]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-gray-400 font-medium">
                    Minimum deposit: <strong className="text-white">50 USDT</strong>
                  </span>
                  <span className="text-emerald-400 font-medium">
                    ⚡ Instant Network Confirmation
                  </span>
                </div>
              </div>

              {/* Screenshot Proof of Payment (Required) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-gray-200 font-bold flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    <span>Upload Deposit Screenshot (Receipt):</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Required
                  </span>
                </div>

                {depositScreenshot ? (
                  <div className="relative bg-[#060a17] border border-purple-500/50 rounded-2xl p-2.5 space-y-2">
                    <div className="relative max-h-40 rounded-xl overflow-hidden bg-black/50 border border-[#1a2b56] flex items-center justify-center">
                      <img
                        src={depositScreenshot}
                        alt="Deposit receipt slip"
                        className="w-full h-auto max-h-40 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setDepositScreenshot('')}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600/90 text-white hover:bg-red-500 shadow transition"
                        title="Remove screenshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 px-1 font-semibold">
                      <span>✓ Screenshot attached ready for submission</span>
                      <label className="text-purple-400 hover:text-purple-300 cursor-pointer font-bold underline">
                        Change
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleScreenshotFileChange}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#1a2b56] hover:border-purple-500/60 bg-[#060a17] hover:bg-purple-950/20 rounded-2xl p-4 cursor-pointer transition group text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition border border-purple-500/30">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-purple-300">
                      Click to upload Payment Screenshot
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1">
                      Attach payment transfer receipt (PNG, JPG)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotFileChange}
                    />
                  </label>
                )}
              </div>

              <button
                disabled={depositSubmitting}
                onClick={handleDepositSubmit}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {depositSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Deposit Slip...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Deposit Proof</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW USDT MODAL */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-xs w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ArrowUpRight className="w-4 h-4 text-[#0088ff]" />
                <span>Withdraw USDT</span>
              </h3>
              <button onClick={() => setWithdrawModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Your TRC20 Wallet Address:</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="Paste your USDT TRC20 address"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-xs text-white font-mono-num focus:outline-none focus:border-[#0088ff]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400 font-medium">Withdrawal Amount (USDT):</label>
                  <div className="flex space-x-1">
                    {['50', '100', '200', 'All'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          if (amt === 'All') {
                            setWithdrawAmountInput(Math.floor(balance).toString());
                          } else {
                            setWithdrawAmountInput(amt);
                          }
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#121e3d] text-gray-300 hover:text-white"
                      >
                        {amt === 'All' ? 'Max' : `$${amt}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={withdrawAmountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setWithdrawAmountInput(val);
                      }
                    }}
                    placeholder="Min 50 USDT"
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-3 pr-14 py-2.5 text-sm text-white font-mono-num focus:outline-none focus:border-[#0088ff]"
                  />
                  {withdrawAmountInput && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAmountInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-[10px] px-1.5 py-0.5 rounded bg-[#121e3d]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-gray-400 font-medium">
                    Minimum withdrawal: <strong className="text-white">50 USDT</strong>
                  </span>
                  <span className="text-blue-400 font-medium">
                    ⚡ Fast Network Processing
                  </span>
                </div>
              </div>

              {/* Mandatory Turnover Policy Display */}
              <div className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 ${
                turnoverSatisfied ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Turnover Policy (2.0x Rule)</span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                    turnoverSatisfied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {turnoverSatisfied ? 'Satisfied ✓' : `${turnoverPercent}%`}
                  </span>
                </div>
                <div className="w-full bg-[#060a17] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      turnoverSatisfied ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                    }`}
                    style={{ width: `${turnoverPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Traded: ${userTurnover.toFixed(2)} USDT</span>
                  <span>Required: ${requiredTurnover.toFixed(2)} USDT</span>
                </div>
                {!turnoverSatisfied && (
                  <p className="text-[10px] text-amber-400/90 font-medium">
                    ⚠️ You need to trade ${turnoverRemaining.toFixed(2)} USDT more in Lottery before withdrawing.
                  </p>
                )}
              </div>

              <div className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] text-[10px] text-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Network Fee:</span>
                  <span className="text-white font-mono-num">1.00 USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Payout:</span>
                  <span className="text-emerald-400 font-mono-num">
                    {Math.max(0, (parseFloat(withdrawAmountInput) || 0) - 1.0).toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Available Balance:</span>
                  <span className="text-[#ffea00] font-mono-num">{balance.toFixed(2)} USDT</span>
                </div>
              </div>

              <button
                onClick={handleWithdrawSubmit}
                disabled={!turnoverSatisfied}
                className={`w-full py-3 font-bold rounded-xl text-xs shadow-lg transition ${
                  turnoverSatisfied
                    ? 'bg-[#0088ff] hover:bg-blue-600 active:scale-95 text-white cursor-pointer'
                    : 'bg-gray-700/60 text-gray-400 cursor-not-allowed border border-gray-600/30'
                }`}
              >
                {turnoverSatisfied ? 'Confirm Withdrawal' : `Turnover Incomplete ($${turnoverRemaining.toFixed(2)} Remaining)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RULES MODAL */}
      {rulesModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl p-6 border border-[#1a2b56] max-w-xs w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Info className="w-4 h-4 text-[#0088ff]" />
                <span>Lottery Draw Rules</span>
              </h3>
              <button onClick={() => setRulesModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
              <p>1. Every round settles using the last digits of the live BTC/USDT price.</p>
              <p>
                2. <strong className="text-[#0088ff]">Big / Small:</strong> If the sum of the last 3 digits &gt; 13,
                outcome is <strong>Big</strong>, else <strong>Small</strong>.
              </p>
              <p>
                3. <strong className="text-purple-400">Single / Double:</strong> If the sum is odd, outcome is{' '}
                <strong>Single</strong>, if even, outcome is <strong>Double</strong>.
              </p>
              <p>
                4. Combination bets like <strong>SmallDouble</strong> or <strong>BigSingle</strong> payout{' '}
                <strong className="text-[#ffea00]">3.8x</strong> if both conditions match!
              </p>
              <p className="text-gray-400 pt-1 border-t border-[#121e3d]">
                Available Round timeframes: <strong>30s, 1min, 5min, 15min, 30min, 1hour</strong>.
              </p>
            </div>
            <button
              onClick={() => setRulesModalOpen(false)}
              className="w-full py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] active:scale-95 text-white rounded-xl text-xs font-semibold"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* BET HISTORY MODAL */}
      {betHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-xs w-full space-y-3">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-[#0088ff]" />
                <span>Lottery Bet Records</span>
              </h3>
              <button onClick={() => setBetHistoryModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {betHistory.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 text-center">No bet records found.</p>
              ) : (
                betHistory.map((h) => (
                  <div
                    key={h.id}
                    className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-white">{h.type}</span>
                        <span className="px-1.5 py-0.5 bg-[#0088ff]/20 text-[#0088ff] text-[9px] rounded font-bold">
                          {h.timeframe}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono-num">#{h.issue}</span>
                      </div>
                      <span className="text-[9px] text-gray-500 block">{h.time}</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold font-mono-num block ${
                          h.result === 'WIN' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {h.result === 'WIN' ? '+' + h.payout.toFixed(2) : '-' + h.amount.toFixed(2)} USDT
                      </span>
                      <span className="text-[9px] text-gray-400 uppercase font-semibold">{h.result}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DEPOSIT HISTORY MODAL */}
      {depositHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-xs w-full space-y-3">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>USDT Deposit History</span>
              </h3>
              <button onClick={() => setDepositHistoryModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {depositHistory.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 text-center">No deposit history found.</p>
              ) : (
                depositHistory.map((d) => (
                    <div
                      key={d.id}
                      className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        {d.screenshot && (
                          <img
                            src={d.screenshot}
                            alt="Slip"
                            className="w-8 h-8 rounded object-cover border border-purple-500/30"
                          />
                        )}
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-white">{d.id}</span>
                            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold">
                              {d.network}
                            </span>
                          </div>
                          <span className="text-[9px] text-gray-500 block">{d.time}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400 block font-mono-num">
                          +{d.amount.toFixed(2)} USDT
                        </span>
                        <span className="text-[9px] text-emerald-400 font-semibold">{d.status}</span>
                      </div>
                    </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAWAL HISTORY MODAL */}
      {withdrawHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-xs w-full space-y-3">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ArrowUpRight className="w-4 h-4 text-purple-400" />
                <span>USDT Withdrawal History</span>
              </h3>
              <button onClick={() => setWithdrawHistoryModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {withdrawHistory.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 text-center">No withdrawal history found.</p>
              ) : (
                withdrawHistory.map((w) => (
                  <div
                    key={w.id}
                    className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-white">{w.id}</span>
                        <span className="text-[9px] text-gray-400 font-mono-num">{w.address}</span>
                      </div>
                      <span className="text-[9px] text-gray-500 block">{w.time}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-red-400 block font-mono-num">
                        -{w.amount.toFixed(2)} USDT
                      </span>
                      <span
                        className={`text-[9px] font-bold ${
                          w.status === 'Approved'
                            ? 'text-emerald-400'
                            : w.status === 'Rejected'
                            ? 'text-amber-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {w.status === 'Rejected' ? 'Rejected (Refunded)' : w.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* REFERRAL & PARTNER CENTER MODAL */}
      {referralModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-bold shadow-md">
                  <Gift className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Referral Partner Center</h3>
                  <span className="text-[10px] text-gray-400">Lifetime Rebate & Team Network</span>
                </div>
              </div>
              <button
                onClick={() => setReferralModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invite Banner & Rates */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-[#121e3d] to-emerald-950/20 border border-emerald-500/40 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Referral Bonus Program:</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg">
                  Instant Auto-Credit
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#060a17]/80 p-2.5 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] text-gray-400 block font-medium">Friend Joining Reward</span>
                  <span className="text-lg font-black text-emerald-400">+$2.00 USDT</span>
                  <span className="text-[9px] text-gray-500 block">For every friend who joins</span>
                </div>
                <div className="bg-[#060a17]/80 p-2.5 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] text-gray-400 block font-medium">New User Welcome Bonus</span>
                  <span className="text-lg font-black text-[#ffea00]">+$2.00 USDT</span>
                  <span className="text-[9px] text-gray-500 block">Instant on ref link join</span>
                </div>
              </div>
            </div>

            {/* Referral Code & Share Link */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">Your Exclusive Referral Code:</label>
                <div className="flex items-center bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 justify-between">
                  <span className="text-sm font-black font-mono-num text-[#ffea00] tracking-wider">
                    {referralCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(referralCode, 'Referral Code')}
                    className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-white text-xs font-bold rounded-lg border border-[#1a2b56] flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3 text-[#0088ff]" />
                    <span>Copy Code</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">Your Referral Link:</label>
                <div className="flex items-center bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 justify-between">
                  <span className="text-[10px] font-mono-num text-gray-300 truncate mr-2">
                    {`${window.location.origin}/?ref=${referralCode}`}
                  </span>
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/?ref=${referralCode}`, 'Referral Link')}
                    className="px-2.5 py-1 bg-[#0088ff] hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow shrink-0 flex items-center space-x-1"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Earnings & Claim Box */}
            <div className="bg-[#060a17] p-3.5 rounded-2xl border border-[#121e3d] space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">Total Referrals</span>
                  <span className="text-sm font-extrabold font-mono-num text-white">{referralFriends.length}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">Total Earned</span>
                  <span className="text-sm font-extrabold font-mono-num text-emerald-400">
                    +{totalReferralEarned.toFixed(2)} USDT
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">Claimable</span>
                  <span className="text-sm font-extrabold font-mono-num text-[#ffea00]">
                    {unclaimedCommission.toFixed(2)} USDT
                  </span>
                </div>
              </div>

              <button
                onClick={handleClaimCommission}
                disabled={unclaimedCommission <= 0}
                className={`w-full py-2.5 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 ${
                  unclaimedCommission > 0
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-950/40 active:scale-95'
                    : 'bg-[#121e3d] text-gray-500 cursor-not-allowed border border-[#1a2b56]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {unclaimedCommission > 0
                    ? `Claim +${unclaimedCommission.toFixed(2)} USDT to Wallet Balance`
                    : totalReferralEarned > 0
                    ? 'All Commission Claimed'
                    : 'No Commission Available'}
                </span>
              </button>
            </div>

            {/* Invited Team Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300">
                  Invited Team Members ({referralFriends.length}):
                </span>
                <button
                  type="button"
                  onClick={fetchUserReferrals}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <RotateCw className={`w-3 h-3 ${loadingReferrals ? 'animate-spin' : ''}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {loadingReferrals ? (
                  <div className="py-6 text-center text-xs text-gray-500">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-purple-400" />
                    <span>Loading referral activity...</span>
                  </div>
                ) : referralFriends.length === 0 ? (
                  <div className="bg-[#060a17] p-5 rounded-2xl border border-[#121e3d] text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/30">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-white">No Referrals Yet</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                      Share your unique invitation link above. When a user registers using your code, their details and your <strong className="text-emerald-400">+2.00 USDT</strong> referral commission will appear here instantly!
                    </p>
                  </div>
                ) : (
                  referralFriends.map((f) => (
                    <div
                      key={f.id}
                      className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex items-center justify-between text-xs hover:border-purple-500/40 transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 text-purple-300 flex items-center justify-center font-black text-xs border border-purple-500/30 shrink-0">
                          {f.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-white">{f.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{f.id}</span>
                            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold">
                              {f.status || 'Joined'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-0.5">
                            <span>Joined: {f.joinDateTime || f.joinDate}</span>
                            {f.email && <span className="text-gray-500">• {f.email}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono-num text-emerald-400 block">
                          +{f.commission.toFixed(2)} USDT
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">Earned Bonus</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* How it Works FAQ */}
            <div className="bg-[#060a17]/60 p-3 rounded-xl border border-[#121e3d] space-y-1 text-[11px] text-gray-400">
              <span className="font-bold text-gray-200 block text-xs">How Referral Program Works:</span>
              <p>1. Share your link or referral code with your friends or crypto community.</p>
              <p>2. Whenever a friend joins using your referral link, you receive <strong className="text-emerald-400">+$2.00 USDT</strong> referral commission, and your friend also receives a <strong className="text-yellow-400">+$2.00 USDT</strong> welcome bonus!</p>
              <p>3. Referral earnings can be claimed instantly directly into your live USDT balance for trading predictions or withdrawal!</p>
            </div>
          </div>
        </div>
      )}

      {/* 1. TRANSFER MODAL */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#0088ff] flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Transfer USDT</h3>
                  <p className="text-[10px] text-gray-400">Send USDT to any player account</p>
                </div>
              </div>
              <button onClick={() => setTransferModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Available Assets */}
              <div className="bg-[#060a17] p-3 rounded-2xl border border-[#121e3d] flex justify-between items-center">
                <span className="text-gray-400 font-medium">Available Assets:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ${balance.toFixed(2)} USDT
                </span>
              </div>

              {/* Recipient Input */}
              <div>
                <label className="text-[11px] text-gray-300 font-semibold block mb-1.5">
                  Recipient Player ID or Username:
                </label>
                <input
                  type="text"
                  placeholder="e.g. USR-384910 or Username"
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none focus:border-[#0088ff] focus:ring-1 focus:ring-[#0088ff]/40 transition"
                />
              </div>

              {/* Transfer Amount with perfectly aligned and visible MAX button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-gray-300 font-semibold block">
                    Amount to Transfer (USDT):
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Balance: <span className="text-emerald-400 font-bold">${balance.toFixed(2)}</span>
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="0.00"
                    value={transferAmountInput}
                    onChange={(e) => setTransferAmountInput(e.target.value)}
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-3.5 pr-20 py-2.5 text-white font-mono font-bold text-sm outline-none focus:border-[#0088ff] focus:ring-1 focus:ring-[#0088ff]/40 transition placeholder-gray-600"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                    <button
                      type="button"
                      onClick={() => setTransferAmountInput(balance.toFixed(2))}
                      className="px-2.5 py-1 rounded-lg bg-[#0088ff] hover:bg-blue-600 active:scale-95 text-white font-black text-[11px] tracking-wider transition shadow-md cursor-pointer border border-blue-400/40"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Fast Preset Chips */}
                <div className="grid grid-cols-5 gap-1.5 mt-2">
                  {[10, 50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTransferAmountInput(String(amt))}
                      className="py-1 px-1 bg-[#0e172e] hover:bg-[#162347] border border-[#1a2b56] rounded-lg text-gray-300 text-[10px] font-mono font-bold text-center transition cursor-pointer"
                    >
                      ${amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTransferAmountInput(balance.toFixed(2))}
                    className="py-1 px-1 bg-[#0088ff]/20 hover:bg-[#0088ff]/35 border border-[#0088ff]/50 rounded-lg text-[#38bdf8] text-[10px] font-mono font-bold text-center transition cursor-pointer"
                  >
                    ALL
                  </button>
                </div>
              </div>

              {/* Security Policy Info Box */}
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-[11px] text-blue-200/90 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#0088ff] shrink-0 mt-0.5" />
                <span>
                  <strong>Admin Verification Required:</strong> For financial security, transfer requests are submitted to Admin for approval before funds are delivered.
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                <span>Network Fee:</span>
                <span className="text-emerald-400 font-bold">0.00 USDT (Free)</span>
              </div>
            </div>

            <button
              type="button"
              disabled={transferSubmitting}
              onClick={handleTransferSubmit}
              className="w-full py-3 bg-gradient-to-r from-[#0088ff] to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-900/30 transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {transferSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Transfer...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Confirm & Submit Transfer</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. FINANCIAL RECORDS MODAL */}
      {financialModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-[#06b6d4] flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Financial Records</h3>
              </div>
              <button onClick={() => setFinancialModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs: Top up, Withdraw, Transfers, Predictions */}
            <div className="grid grid-cols-4 gap-1 bg-[#060a17] p-1 rounded-xl border border-[#121e3d] shrink-0">
              <button
                type="button"
                onClick={() => setFinancialSubTab('deposits')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition ${
                  financialSubTab === 'deposits' ? 'bg-[#1877f2] text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Top up
              </button>
              <button
                type="button"
                onClick={() => setFinancialSubTab('withdrawals')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition ${
                  financialSubTab === 'withdrawals' ? 'bg-[#1877f2] text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Withdraw
              </button>
              <button
                type="button"
                onClick={() => setFinancialSubTab('transfers')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition ${
                  financialSubTab === 'transfers' ? 'bg-[#1877f2] text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Transfers
              </button>
              <button
                type="button"
                onClick={() => setFinancialSubTab('bets')}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition ${
                  financialSubTab === 'bets' ? 'bg-[#1877f2] text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Bets
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {financialSubTab === 'deposits' && (
                depositHistory.length === 0 ? (
                  <p className="text-gray-500 italic py-8 text-center">No deposit records yet.</p>
                ) : (
                  depositHistory.map((d) => (
                    <div key={d.id} className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {d.screenshot && (
                          <img
                            src={d.screenshot}
                            alt="Slip"
                            className="w-8 h-8 rounded object-cover border border-purple-500/30"
                          />
                        )}
                        <div>
                          <span className="font-bold text-white block">{d.id} • {d.network}</span>
                          <span className="text-[10px] text-gray-500">{d.time}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-400 block">+{d.amount.toFixed(2)} USDT</span>
                        <span className="text-[9px] text-emerald-400 font-bold">{d.status}</span>
                      </div>
                    </div>
                  ))
                )
              )}

              {financialSubTab === 'withdrawals' && (
                withdrawHistory.length === 0 ? (
                  <p className="text-gray-500 italic py-8 text-center">No withdrawal records yet.</p>
                ) : (
                  withdrawHistory.map((w) => (
                    <div key={w.id} className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center">
                      <div>
                        <span className="font-bold text-white block">{w.id}</span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[140px] block">{w.address}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-red-400 block">-{w.amount.toFixed(2)} USDT</span>
                        <span
                          className={`text-[9px] font-bold ${
                            w.status === 'Approved'
                              ? 'text-emerald-400'
                              : w.status === 'Rejected'
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {w.status === 'Rejected' ? 'Rejected (Refunded)' : w.status}
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}

              {financialSubTab === 'transfers' && (
                transferHistory.length === 0 ? (
                  <p className="text-gray-500 italic py-8 text-center">No transfer records yet.</p>
                ) : (
                  transferHistory.map((t) => {
                    const isOutgoing = t.senderId === userId;
                    return (
                      <div key={t.id} className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-white">
                              {isOutgoing ? `To: ${t.recipientName || t.recipientId}` : `From: ${t.senderName || t.senderId}`}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${isOutgoing ? 'bg-indigo-500/20 text-indigo-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                              {isOutgoing ? 'Sent' : 'Received'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500">
                            {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t.id}
                          </span>
                          {t.rejectionReason && (
                            <span className="text-[10px] text-red-400/80 block mt-0.5">{t.rejectionReason}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-bold block ${isOutgoing ? 'text-gray-200' : 'text-emerald-400'}`}>
                            {isOutgoing ? `-${t.amount.toFixed(2)}` : `+${t.amount.toFixed(2)}`} USDT
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              t.status === 'Approved'
                                ? 'text-emerald-400'
                                : t.status === 'Rejected'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {t.status === 'Approved' ? 'Delivered' : t.status === 'Rejected' ? 'Rejected (Refunded)' : 'Pending Review'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {financialSubTab === 'bets' && (
                betHistory.length === 0 ? (
                  <p className="text-gray-500 italic py-8 text-center">No prediction records yet.</p>
                ) : (
                  betHistory.map((b) => (
                    <div key={b.id} className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] flex justify-between items-center">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white">{b.type}</span>
                          <span className="text-[10px] text-gray-500 font-mono">#{b.issue}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{b.time}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold block ${b.result === 'WIN' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {b.result === 'WIN' ? `+${b.payout.toFixed(2)}` : `-${b.amount.toFixed(2)}`} USDT
                        </span>
                        <span className={`text-[9px] font-bold ${b.result === 'WIN' ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {b.result}
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SETTING MODAL */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#3b82f6] flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Account Settings</h3>
              </div>
              <button onClick={() => setSettingsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">
                  Display Name:
                </label>
                <input
                  type="text"
                  value={tempUserNameInput}
                  onChange={(e) => setTempUserNameInput(e.target.value)}
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-[#1877f2]"
                />
              </div>

              <div className="bg-[#060a17] p-3 rounded-2xl border border-[#121e3d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">User ID:</span>
                  <span className="font-mono font-bold text-white">ID:{userId.replace('USR-', '')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">VIP Status:</span>
                  <span className="font-bold text-emerald-400">VIP 1 (Active)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Language:</span>
                  <span className="font-bold text-white">English / Urdu</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveUserName}
              className="w-full py-2.5 bg-[#1877f2] hover:bg-blue-600 active:scale-95 text-white font-bold rounded-xl text-xs transition"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* 4. DOWNLOAD APP MODAL */}
      {downloadModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3 text-left">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-[#0284c7] flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Download Mobile App</h3>
              </div>
              <button onClick={() => setDownloadModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="w-28 h-28 mx-auto bg-white p-2 rounded-2xl shadow-lg flex items-center justify-center">
                <QrCode className="w-24 h-24 text-slate-900" />
              </div>
              <p className="text-gray-300 font-medium">
                Scan QR or tap below to install Web App (PWA) directly to your home screen with zero storage used.
              </p>
              <button
                type="button"
                onClick={() => {
                  showToast('App ready! Click browser menu -> "Add to Home screen" to install.');
                  setDownloadModalOpen(false);
                }}
                className="w-full py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                Install to Home Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. LOG OUT CONFIRMATION MODAL */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-xs w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <Power className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Log Out Account</h3>
              <p className="text-xs text-gray-400 mt-1">
                Are you sure you want to log out of ID:{userId.replace('USR-', '')}?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-white font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleLogout();
                }}
                className="py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Confirm Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. OFFICIAL CHANNEL MODAL */}
      {officialModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-[#f43f5e] flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Official Channel & Club</h3>
              </div>
              <button onClick={() => setOfficialModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-300">
                Join our verified Telegram channel for daily signal predictions, lottery draw announcements, and exclusive bonuses!
              </p>
              <div className="bg-[#060a17] p-3 rounded-2xl border border-[#121e3d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Telegram Channel:</span>
                  <span className="font-bold text-[#1877f2]">@OfficialCryptoOptions</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Global Members:</span>
                  <span className="font-bold text-emerald-400">42,800+ Active</span>
                </div>
              </div>
              <a
                href="https://telegram.org"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-[#1877f2] hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5"
              >
                <span>Open Telegram Channel</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 7. 24/7 CUSTOMER SERVICE MODAL */}
      {serviceModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#3b82f6] flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">24/7 Online Customer Service</h3>
                  <span className="text-[10px] text-emerald-400 block font-semibold">● Agents Online (Avg reply 1 min)</span>
                </div>
              </div>
              <button onClick={() => setServiceModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-300">
                Facing issues with Deposit (TxID verification), Withdrawal, or Game predictions? Contact our dedicated 24/7 support team directly:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setServiceModalOpen(false);
                    setSupportChatOpen(true);
                    fetchUserSupportMessages();
                  }}
                  className="w-full p-3 bg-[#060a17] hover:bg-[#121e3d] rounded-2xl border border-purple-500/40 flex items-center justify-between transition group text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block group-hover:text-purple-400">In-App Live Chat Helpdesk</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">● Instant Admin Chat Support</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition" />
                </button>

                <a
                  href="https://t.me"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 bg-[#060a17] hover:bg-[#121e3d] rounded-2xl border border-[#1a2b56] flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#1877f2] flex items-center justify-center">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block group-hover:text-[#1877f2]">Telegram Live Support</span>
                      <span className="text-[10px] text-gray-500 font-mono">@CryptoSupport24_7</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. IN-APP LIVE CHAT HELPDESK MODAL (TWO-WAY BIDIRECTIONAL WITH ADMIN PORTAL) */}
      {supportChatOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl border border-[#1a2b56] max-w-md w-full h-[620px] flex flex-col shadow-2xl overflow-hidden">
            {/* CHAT MODAL HEADER */}
            <div className="p-4 border-b border-[#121e3d] flex items-center justify-between bg-[#060a17]">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#060a17] absolute -top-0.5 -right-0.5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center space-x-1.5">
                    <span>VIP Customer Support</span>
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded-full">
                      ONLINE
                    </span>
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono block">
                    User: {userId} • Direct Admin Channel
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    fetchUserSupportMessages();
                    showToast('Messages updated');
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-[#121e3d] rounded-xl transition"
                  title="Refresh chat"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSupportChatOpen(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-[#121e3d] rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CHAT MESSAGES SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#040711]">
              {/* WELCOME BANNER */}
              <div className="p-3 bg-[#0b1228] border border-[#1a2b56] rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-purple-300">👋 Welcome to VIP Live Helpdesk</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Ask any questions about deposits, TxID verification, withdrawals, or predictions. Our admin support team will reply directly to your screen.
                </p>
              </div>

              {userSupportMessages.length === 0 ? (
                <div className="py-8 text-center text-gray-500 space-y-2">
                  <MessageCircle className="w-8 h-8 mx-auto text-gray-600 stroke-[1.5]" />
                  <p className="text-xs">No messages yet. Send your query below!</p>
                </div>
              ) : (
                userSupportMessages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-1 text-[9px] text-gray-500 mb-1 font-mono">
                        <span className={isUser ? 'text-blue-400 font-bold' : 'text-purple-400 font-bold'}>
                          {isUser ? 'You' : '🛡️ Admin Support'}
                        </span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                            : 'bg-[#0b1228] text-gray-100 border border-purple-500/40 rounded-tl-none'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* QUICK PRESETS FOR USER */}
            <div className="p-2 bg-[#060a17] border-t border-[#121e3d] flex items-center space-x-1.5 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => handleSendUserSupport('I submitted a deposit request. Please verify my TxID.')}
                className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 hover:text-white rounded-lg border border-purple-500/30 shrink-0 transition"
              >
                Deposit TxID Check
              </button>
              <button
                type="button"
                onClick={() => handleSendUserSupport('When will my withdrawal request be processed?')}
                className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-blue-300 hover:text-white rounded-lg border border-blue-500/30 shrink-0 transition"
              >
                Withdrawal Status
              </button>
              <button
                type="button"
                onClick={() => handleSendUserSupport('Hello! Can you please assist me with my account?')}
                className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-amber-300 hover:text-white rounded-lg border border-amber-500/30 shrink-0 transition"
              >
                Account Inquiry
              </button>
            </div>

            {/* MESSAGE INPUT BOX */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendUserSupport();
              }}
              className="p-3 bg-[#0b1228] border-t border-[#121e3d] flex items-center space-x-2"
            >
              <input
                type="text"
                value={userSupportInput}
                onChange={(e) => setUserSupportInput(e.target.value)}
                placeholder="Type your message to Support Admin..."
                className="flex-1 bg-[#060a17] border border-[#1a2b56] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={userSendingSupport || !userSupportInput.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-purple-950/50 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{userSendingSupport ? '...' : 'Send'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. USER AUTH MODAL (LOGIN & REGISTER) */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-sm w-full space-y-4 shadow-2xl relative">
            {/* Header with Close */}
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  {authTab === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {authTab === 'login' ? 'Sign In to CryptoWin Pro' : 'Create CryptoWin Pro Account'}
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    {authTab === 'login'
                      ? 'Access your balance and trading history'
                      : 'Join now & deposit USDT to trade and withdraw'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR (LOGIN / REGISTER) */}
            <div className="grid grid-cols-2 gap-1 bg-[#060a17] p-1 rounded-xl border border-[#121e3d]">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setLoginError(null);
                  setRegError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authTab === 'login'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setLoginError(null);
                  setRegError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  authTab === 'register'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* LOGIN TAB FORM */}
            {authTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3">
                {loginError && (
                  <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">Username or Email</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={loginLoginInput}
                      onChange={(e) => setLoginLoginInput(e.target.value)}
                      placeholder="e.g. trader99 or user@email.com"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPasswordInput}
                      onChange={(e) => setLoginPasswordInput(e.target.value)}
                      placeholder="Enter account password"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-[#1a2b56] text-purple-600" />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalOpen(false);
                      setRecoveryModalOpen(true);
                      setRecoveryUsernameInput(loginLoginInput || '');
                    }}
                    className="text-purple-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-950/50 transition cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loginLoading ? 'Signing In...' : 'Sign In to Account'}</span>
                </button>

                <div className="text-center pt-1">
                  <p className="text-[11px] text-gray-400">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('register');
                        setLoginError(null);
                      }}
                      className="text-purple-400 font-bold hover:underline cursor-pointer"
                    >
                      Register Now
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* REGISTER TAB FORM */}
            {authTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                {regError && (
                  <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{regError}</span>
                  </div>
                )}

                {/* Referral Invitation Card if visited via referral link */}
                {invitedByCode && (
                  <div className="p-3 bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-blue-950/70 border border-purple-500/40 rounded-2xl flex items-center space-x-3 shadow-md">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-400/30">
                      <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Referral Invitation</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold">Active</span>
                      </div>
                      <p className="text-xs text-white truncate">
                        Invited by: <strong className="text-yellow-400 font-mono font-black">{invitedByCode}</strong>
                      </p>
                      <span className="text-[10px] text-gray-300 block">Register your account below to start trading!</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regUsernameInput}
                      onChange={(e) => setRegUsernameInput(e.target.value)}
                      placeholder="Choose a username (e.g. pro_trader)"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={regEmailInput}
                      onChange={(e) => setRegEmailInput(e.target.value)}
                      placeholder="e.g. player@example.com"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1 font-medium">Password</label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regPasswordInput}
                        onChange={(e) => setRegPasswordInput(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-8 pr-2 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1 font-medium">Confirm</label>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={regConfirmPasswordInput}
                        onChange={(e) => setRegConfirmPasswordInput(e.target.value)}
                        placeholder="Re-type"
                        className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-8 pr-2 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-400 font-medium">Referral / Invitation Code</label>
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                      <span>+$2 USDT Bonus</span>
                    </span>
                  </div>
                  <div className="relative">
                    <Share2 className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regReferralInput}
                      onChange={(e) => setRegReferralInput(e.target.value.toUpperCase())}
                      placeholder="e.g. CWP-88219"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-2 text-xs text-white uppercase placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  {invitedByCode && regReferralInput.toUpperCase() === invitedByCode.toUpperCase() && (
                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center space-x-1 font-medium">
                      <span>✓ Invitation code auto-applied from referral link</span>
                    </p>
                  )}
                </div>

                <div className="p-2.5 bg-[#060a17] rounded-xl border border-[#121e3d] flex items-center space-x-2 text-[11px] text-gray-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {invitedByCode
                      ? 'Welcome bonus of $2.00 USDT will be credited upon account creation!'
                      : 'Initial balance is $0.00. Deposit USDT anytime via TRC20/BEP20 to start trading.'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{regLoading ? 'Creating Account...' : 'Create Account & Start Trading'}</span>
                </button>

                <div className="text-center pt-1">
                  <p className="text-[11px] text-gray-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab('login');
                        setRegError(null);
                      }}
                      className="text-purple-400 font-bold hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 8. PASSWORD RECOVERY & ACCOUNT OWNERSHIP PROOF MODAL */}
      {recoveryModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] rounded-3xl p-5 border border-[#1a2b56] max-w-md w-full space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Header with Close */}
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Account Password Recovery</h3>
                  <p className="text-[10px] text-gray-400">Ownership verification & administrative password reset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#121e3d] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ACTIVE TICKET STATUS DISPLAY */}
            {activeRecoveryTicket ? (
              <div className="space-y-4">
                {activeRecoveryTicket.status === 'pending' && (
                  <div className="bg-amber-950/30 border border-amber-500/50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                        TICKET #{activeRecoveryTicket.id}
                      </span>
                      <span className="flex items-center space-x-1.5 text-xs text-amber-400 font-bold animate-pulse">
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Under Review</span>
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-gray-300">
                        Account: <strong className="text-white">@{activeRecoveryTicket.usernameOrEmail}</strong>
                      </div>
                      {activeRecoveryTicket.claimedBalance && (
                        <div className="text-gray-400">
                          Claimed Balance: <strong className="text-amber-400 font-mono">${activeRecoveryTicket.claimedBalance} USDT</strong>
                        </div>
                      )}
                      <p className="text-[11px] text-gray-400 pt-1 leading-relaxed">
                        Your proof details have been transmitted directly to the Admin Portal. The administrator is verifying your account records. This screen updates live once approved.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryModalOpen(false);
                          setSupportChatOpen(true);
                          fetchUserSupportMessages();
                        }}
                        className="flex-1 py-2 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Chat Live With Support</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRecoveryTicket(null);
                          localStorage.removeItem('pkw_active_recovery_ticket');
                        }}
                        className="py-2 px-3 bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Discard Ticket
                      </button>
                    </div>
                  </div>
                )}

                {activeRecoveryTicket.status === 'approved' && (
                  <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center space-x-2 text-emerald-400">
                      <CheckCircle2 className="w-6 h-6 shrink-0" />
                      <div>
                        <h4 className="text-sm font-black text-white">Verification Approved!</h4>
                        <p className="text-[10px] text-emerald-300">Admin verified account @{activeRecoveryTicket.usernameOrEmail}</p>
                      </div>
                    </div>

                    <div className="bg-[#060a17] border border-emerald-500/40 rounded-xl p-3 text-center space-y-1.5">
                      <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Your New Account Password</span>
                      <div className="text-xl font-black font-mono text-emerald-300 tracking-wider select-all">
                        {activeRecoveryTicket.newPassword || 'Pass786'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeRecoveryTicket.newPassword || 'Pass786');
                          showToast('Copied password to clipboard!');
                        }}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-bold inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Password</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLoginWithRecoveredPassword(activeRecoveryTicket.usernameOrEmail, activeRecoveryTicket.newPassword || 'Pass786')}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In Now With This Password</span>
                    </button>
                  </div>
                )}

                {activeRecoveryTicket.status === 'rejected' && (
                  <div className="bg-red-950/30 border border-red-500/50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center space-x-2 text-red-400">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <h4 className="text-xs font-bold text-white">Verification Not Approved</h4>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      The admin was unable to verify ownership of account with the submitted details. You can submit clearer proof or contact support via live chat.
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRecoveryTicket(null);
                          localStorage.removeItem('pkw_active_recovery_ticket');
                        }}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Submit New Proof
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryModalOpen(false);
                          setSupportChatOpen(true);
                          fetchUserSupportMessages();
                        }}
                        className="py-2 px-3 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Chat Support
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* NEW RECOVERY REQUEST FORM */
              <form onSubmit={handleSubmitRecoveryRequest} className="space-y-3">
                {recoveryError && (
                  <div className="p-2.5 bg-red-950/50 border border-red-500/50 rounded-xl text-[11px] text-red-300 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                <div className="p-3 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 rounded-2xl text-[11px] text-gray-300 leading-relaxed">
                  Provide your account details below. The administrator will verify ownership in the system database and issue a new password.
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">
                    Username or Registered Email <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recoveryUsernameInput}
                      onChange={(e) => setRecoveryUsernameInput(e.target.value)}
                      placeholder="e.g. pro_trader or trader@example.com"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">
                    Estimated Account Balance (USDT) <span className="text-gray-500 font-normal">(Optional, helps verification)</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recoveryBalanceInput}
                      onChange={(e) => setRecoveryBalanceInput(e.target.value)}
                      placeholder="e.g. 50 or 1416.50"
                      className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">
                    Deposit Slip / Screenshot <span className="text-gray-500 font-normal">(Optional, fastest verification)</span>
                  </label>
                  {recoveryProofSlip ? (
                    <div className="relative bg-[#060a17] border border-purple-500/40 rounded-xl p-2 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={recoveryProofSlip} alt="Deposit slip" className="w-10 h-10 object-cover rounded-lg border border-purple-500/30" />
                        <span className="text-[11px] text-emerald-400 font-medium">Screenshot attached</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecoveryProofSlip(null)}
                        className="text-gray-400 hover:text-red-400 p-1 text-xs cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="border border-dashed border-[#1a2b56] hover:border-purple-500 rounded-xl p-3 flex items-center justify-center space-x-2 cursor-pointer transition bg-[#060a17]/50 hover:bg-[#121e3d]/40">
                      <Upload className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400 font-medium">Upload slip / transaction screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleRecoveryProofSlipSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">
                    Additional Notes <span className="text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={recoveryNotesInput}
                    onChange={(e) => setRecoveryNotesInput(e.target.value)}
                    placeholder="e.g. Registered yesterday, sent deposit from Binance TRC20"
                    rows={2}
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={recoverySubmitting}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-950/50 transition cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
                >
                  <Key className="w-4 h-4" />
                  <span>{recoverySubmitting ? 'Submitting to Admin...' : 'Submit Ownership Proof to Admin'}</span>
                </button>

                <div className="pt-2 border-t border-[#121e3d] flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryModalOpen(false);
                      setAuthModalOpen(true);
                      setAuthTab('login');
                    }}
                    className="text-gray-400 hover:text-white cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryModalOpen(false);
                      setSupportChatOpen(true);
                      fetchUserSupportMessages();
                    }}
                    className="text-purple-400 hover:text-purple-300 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Headphones className="w-3 h-3" />
                    <span>Chat With Support</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#0b1228] border border-[#0088ff] text-white px-4 py-2.5 rounded-2xl text-xs shadow-2xl flex items-center space-x-2 animate-bounce">
          <Info className="w-4 h-4 text-[#0088ff] shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
