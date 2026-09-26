import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  ShieldAlert,
  Sliders,
  TrendingUp,
  CheckCircle2,
  Lock,
  ExternalLink,
  AlertTriangle,
  Activity,
  DollarSign,
  Users,
  Radio,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  Server,
  Key,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  History,
  Layers,
  Sparkles,
  Inbox,
  XCircle,
  AlertCircle,
  Copy,
  MessageSquare,
  Send,
  Trash2,
  Headphones,
  MessageCircle,
  UserCheck,
  UserX,
  Edit2,
  Search,
  ArrowLeftRight,
  Flame,
  Image,
  FileText,
} from 'lucide-react';
import {
  getAllSynchronizedTimeframes,
  setServerTimeOffset,
} from '../utils/timeframeSync';

export interface RegisteredUser {
  id: string;
  username: string;
  email: string;
  password?: string;
  referralCode: string;
  referredBy?: string | null;
  balance: number;
  registeredAt: number;
  lastLoginAt: number;
  status: 'active' | 'suspended';
  ip?: string;
}

export interface PasswordRecoveryRequest {
  id: string;
  usernameOrEmail: string;
  claimedBalance?: string;
  depositProofSlip?: string;
  userNotes?: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
  matchedUserId?: string;
  matchedUsername?: string;
  currentPassword?: string;
  actualBalance?: number;
  newPassword?: string;
  resolvedAt?: number;
  adminNotes?: string;
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

export interface ChatThread {
  userId: string;
  lastMessage: string;
  lastSender: 'user' | 'admin';
  lastTimestamp: number;
  unreadCount: number;
  totalMessages: number;
}

export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  network: string;
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
  turnoverStatus?: 'Satisfied' | 'Incomplete' | string;
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

interface ServerBet {
  id: string;
  userId: string;
  timeframe: string;
  issue: number | string;
  type: string;
  amount: number;
  timestamp: number;
}

interface TimeframeSummaryItem {
  totalAmount: number;
  count: number;
  bets: ServerBet[];
}

interface TimeframeTimer {
  remaining: number;
  duration: number;
  minStr: string;
  secStr: string;
  display: string;
  issue: number;
  isLocked: boolean;
}

interface SettledLedgerEntry {
  id: string;
  timeframe: string;
  issue: number | string;
  userId: string;
  type: string;
  amount: number;
  result: 'WIN' | 'LOSS';
  payout: number;
  houseImpact: number;
  timestamp: number;
}

interface AdminWithdrawal {
  id: string;
  amount: number;
  address: string;
  network: string;
  timestamp: number;
  status: string;
}

export const AdminPortal: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pkw_admin_authenticated') === 'true';
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Real-time server data
  const [onlineUsers, setOnlineUsers] = useState<number>(1);
  const [totalActiveBetsAmount, setTotalActiveBetsAmount] = useState<number>(0);
  const [totalActiveBetsCount, setTotalActiveBetsCount] = useState<number>(0);
  const [timeframeSummary, setTimeframeSummary] = useState<{ [tf: string]: TimeframeSummaryItem }>({});
  const [timeframeTimers, setTimeframeTimers] = useState<{ [tf: string]: TimeframeTimer }>(() =>
    getAllSynchronizedTimeframes()
  );
  const [policies, setPolicies] = useState<{ [tf: string]: string }>({
    '30s': 'auto',
    '1min': 'auto',
    '5min': 'auto',
    '15min': 'auto',
    '30min': 'auto',
    '1hour': 'auto',
  });
  const [historicalTurnover, setHistoricalTurnover] = useState<number>(0);

  // House Treasury Vault & Balance Collected from Lost Bets
  const [houseVaultBalance, setHouseVaultBalance] = useState<number>(0);
  const [totalCollectedLosses, setTotalCollectedLosses] = useState<number>(0);
  const [totalPaidOutWins, setTotalPaidOutWins] = useState<number>(0);
  const [ledger, setLedger] = useState<SettledLedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);

  // Navigation tab in Admin Portal
  const [portalTab, setPortalTab] = useState<'controls' | 'requests' | 'support' | 'users' | 'recovery' | 'vault' | 'ledger'>('controls');

  // Registered Players State
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [usersStats, setUsersStats] = useState<{ total: number; active: number; suspended: number; totalBalance: number }>({
    total: 0,
    active: 0,
    suspended: 0,
    totalBalance: 0,
  });
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [balanceModalUser, setBalanceModalUser] = useState<RegisteredUser | null>(null);
  const [adjustBalanceAmount, setAdjustBalanceAmount] = useState<string>('50');
  const [adjustBalanceMode, setAdjustBalanceMode] = useState<'add' | 'subtract' | 'set'>('add');
  const [showUserPasswords, setShowUserPasswords] = useState<Record<string, boolean>>({});

  // Password Recovery Requests State & Admin Reset
  const [recoveryRequests, setRecoveryRequests] = useState<PasswordRecoveryRequest[]>([]);
  const [pendingRecoveryCount, setPendingRecoveryCount] = useState<number>(0);
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [recoverySearchTerm, setRecoverySearchTerm] = useState<string>('');
  const [resetPassModalUser, setResetPassModalUser] = useState<RegisteredUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [isResettingPass, setIsResettingPass] = useState<boolean>(false);
  const [recoveryApproveModal, setRecoveryApproveModal] = useState<PasswordRecoveryRequest | null>(null);
  const [approvePassInput, setApprovePassInput] = useState<string>('');

  // Customer Support Live Chat State
  const [totalSupportUnread, setTotalSupportUnread] = useState<number>(0);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<SupportMessage[]>([]);
  const [adminReplyInput, setAdminReplyInput] = useState<string>('');
  const [adminSendingReply, setAdminSendingReply] = useState<boolean>(false);
  const [supportSearchTerm, setSupportSearchTerm] = useState<string>('');

  // Player Deposit, Withdrawal & Transfer Requests State
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [pendingDepositsCount, setPendingDepositsCount] = useState<number>(0);
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState<number>(0);
  const [pendingTransfersCount, setPendingTransfersCount] = useState<number>(0);
  const [requestSubTab, setRequestSubTab] = useState<'deposits' | 'withdrawals' | 'transfers'>('deposits');
  const [requestFilter, setRequestFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [inspectDeposit, setInspectDeposit] = useState<DepositRequest | null>(null);
  const [customCreditAmount, setCustomCreditAmount] = useState<string>('');
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);

  // Online breakdown state
  const [onlinePlayers, setOnlinePlayers] = useState<number>(0);
  const [onlineAdmins, setOnlineAdmins] = useState<number>(1);

  // Change Passcode Modal State
  const [changePasscodeModalOpen, setChangePasscodeModalOpen] = useState<boolean>(false);
  const [currentPasscode, setCurrentPasscode] = useState<string>('');
  const [newPasscode, setNewPasscode] = useState<string>('');
  const [confirmPasscode, setConfirmPasscode] = useState<string>('');
  const [passcodeModalError, setPasscodeModalError] = useState<string | null>(null);
  const [passcodeSubmitting, setPasscodeSubmitting] = useState<boolean>(false);

  // Vault Withdrawal Modal State
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('50');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [withdrawNetwork, setWithdrawNetwork] = useState<string>('USDT-TRC20');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState<boolean>(false);

  // Vault Stats Calibration Modal State
  const [calibrateModalOpen, setCalibrateModalOpen] = useState<boolean>(false);
  const [calibVaultInput, setCalibVaultInput] = useState<string>('0');
  const [calibLossInput, setCalibLossInput] = useState<string>('0');
  const [calibWinInput, setCalibWinInput] = useState<string>('0');
  const [calibClearLedger, setCalibClearLedger] = useState<boolean>(false);
  const [calibSubmitting, setCalibSubmitting] = useState<boolean>(false);

  // Home Screen Running Announcement Ticker State
  const [announcementInput, setAnnouncementInput] = useState<string>(
    '🔥 This game has just launched! Join now, start trading, and earn up to 3.8x USDT payouts! 🚀'
  );
  const [announcementSaving, setAnnouncementSaving] = useState<boolean>(false);

  // Expanded bets details accordion for timeframes
  const [expandedTf, setExpandedTf] = useState<string | null>(null);

  // Official Deposit Wallets (Where players transfer USDT)
  const [depositWallets, setDepositWallets] = useState<{ trc20: string; bep20: string }>({
    trc20: 'TYu982aXzQkL90123mK912pLq10293',
    bep20: '0x71C8A51A35C0e26B2d29486c9A757B36f112B16B',
  });
  const [savingWallets, setSavingWallets] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const timeframes = ['30s', '1min', '5min', '15min', '30min', '1hour'];

  // Heartbeat from Admin
  useEffect(() => {
    const adminClientId = 'admin_' + Math.random().toString(36).substring(2, 8);
    const sendHeartbeat = () => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: adminClientId, isPlayer: false }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.onlineUsers === 'number') {
            setOnlineUsers(data.onlineUsers);
          }
        })
        .catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 6000);
    return () => clearInterval(interval);
  }, []);

  // Poll real-time status from backend
  const fetchStatus = useCallback(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (typeof data.serverTime === 'number') setServerTimeOffset(data.serverTime);
          if (typeof data.onlineUsers === 'number') setOnlineUsers(data.onlineUsers);
          if (typeof data.onlinePlayers === 'number') setOnlinePlayers(data.onlinePlayers);
          if (typeof data.onlineAdmins === 'number') setOnlineAdmins(data.onlineAdmins);
          if (typeof data.totalActiveBetsAmount === 'number') setTotalActiveBetsAmount(data.totalActiveBetsAmount);
          if (typeof data.totalActiveBetsCount === 'number') setTotalActiveBetsCount(data.totalActiveBetsCount);
          if (data.policies) setPolicies(data.policies);
          if (data.timeframeSummary) setTimeframeSummary(data.timeframeSummary);
          if (typeof data.historicalTurnover === 'number') setHistoricalTurnover(data.historicalTurnover);
          if (typeof data.houseVaultBalance === 'number') setHouseVaultBalance(data.houseVaultBalance);
          if (typeof data.totalCollectedLosses === 'number') setTotalCollectedLosses(data.totalCollectedLosses);
          if (typeof data.totalPaidOutWins === 'number') setTotalPaidOutWins(data.totalPaidOutWins);
          if (Array.isArray(data.ledger)) setLedger(data.ledger);
          if (Array.isArray(data.withdrawals)) setWithdrawals(data.withdrawals);
          if (Array.isArray(data.depositRequests)) setDepositRequests(data.depositRequests);
          if (Array.isArray(data.withdrawRequests)) setWithdrawRequests(data.withdrawRequests);
          if (Array.isArray(data.transferRequests)) setTransferRequests(data.transferRequests);
          if (typeof data.pendingDepositsCount === 'number') setPendingDepositsCount(data.pendingDepositsCount);
          if (typeof data.pendingWithdrawalsCount === 'number') setPendingWithdrawalsCount(data.pendingWithdrawalsCount);
          if (typeof data.pendingTransfersCount === 'number') setPendingTransfersCount(data.pendingTransfersCount);
          if (typeof data.totalSupportUnread === 'number') setTotalSupportUnread(data.totalSupportUnread);
          if (typeof data.totalUsersCount === 'number') setTotalUsersCount(data.totalUsersCount);
          if (Array.isArray(data.recoveryRequests)) setRecoveryRequests(data.recoveryRequests);
          if (typeof data.pendingRecoveryCount === 'number') setPendingRecoveryCount(data.pendingRecoveryCount);
          if (typeof data.announcementTicker === 'string') setAnnouncementInput(data.announcementTicker);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch official deposit receiving wallets ONCE on initial load (never inside periodic poll)
  useEffect(() => {
    fetch('/api/deposit-wallets')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.wallets) {
          setDepositWallets({
            trc20: data.wallets.trc20 || '',
            bep20: data.wallets.bep20 || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveDepositWallets = async () => {
    setSavingWallets(true);
    try {
      const res = await fetch('/api/admin/deposit-wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depositWallets),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.wallets) {
          setDepositWallets(data.wallets);
        }
        showToast('✅ Official deposit wallets saved! Players will now see these addresses.');
      } else {
        showToast(data.message || 'Failed to save wallets');
      }
    } catch {
      showToast('Network error saving wallets');
    } finally {
      setSavingWallets(false);
    }
  };

  const fetchRegisteredUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.users)) {
        setRegisteredUsers(data.users);
        if (data.stats) setUsersStats(data.stats);
      }
    } catch {} finally {
      if (!isSilent) setLoadingUsers(false);
    }
  }, []);

  const fetchRecoveryRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/recovery-requests');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.requests)) {
        setRecoveryRequests(data.requests);
        if (typeof data.pendingCount === 'number') {
          setPendingRecoveryCount(data.pendingCount);
        }
      }
    } catch {}
  }, []);

  // Fetch registered users when on users tab (stable, manual refresh or action-triggered)
  useEffect(() => {
    if (portalTab === 'users') {
      fetchRegisteredUsers();
    }
  }, [portalTab, fetchRegisteredUsers]);

  // Poll recovery requests when on recovery tab
  useEffect(() => {
    if (portalTab === 'recovery') {
      fetchRecoveryRequests();
      const interval = setInterval(fetchRecoveryRequests, 3000);
      return () => clearInterval(interval);
    }
  }, [portalTab, fetchRecoveryRequests]);

  const togglePasswordVisibility = (userId: string) => {
    setShowUserPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleAdminUpdatePassword = async () => {
    if (!resetPassModalUser || !newPasswordInput.trim()) return;
    setIsResettingPass(true);
    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: resetPassModalUser.id,
          newPassword: newPasswordInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Password for @${resetPassModalUser.username} updated to "${newPasswordInput.trim()}"`);
        setResetPassModalUser(null);
        setNewPasswordInput('');
        fetchRegisteredUsers();
      } else {
        showToast(data.message || 'Failed to update password');
      }
    } catch {
      showToast('Network error updating password');
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleResolveRecovery = async (requestId: string, action: 'approve' | 'reject', newPassword?: string) => {
    try {
      const res = await fetch('/api/admin/recovery-requests/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          newPassword: newPassword || 'Pass786',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(action === 'approve' ? `✅ Approved! Password set to "${newPassword || 'Pass786'}"` : '❌ Request Rejected');
        setRecoveryApproveModal(null);
        fetchRecoveryRequests();
        fetchRegisteredUsers();
      } else {
        showToast(data.message || 'Failed to resolve request');
      }
    } catch {
      showToast('Network error resolving request');
    }
  };

  const handleToggleUserStatus = async (user: RegisteredUser) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`User ${user.username} is now ${nextStatus}`);
        fetchRegisteredUsers();
      } else {
        showToast(data.message || 'Failed to update user status');
      }
    } catch {
      showToast('Error updating status');
    }
  };

  const handleAdjustBalance = async () => {
    if (!balanceModalUser) return;
    const amt = parseFloat(adjustBalanceAmount);
    if (isNaN(amt) || amt < 0) {
      showToast('Please enter a valid numeric amount');
      return;
    }
    try {
      const res = await fetch('/api/admin/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: balanceModalUser.id,
          amount: amt,
          mode: adjustBalanceMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        showToast(`✅ ${data.message || `Balance updated: $${data.user.balance.toFixed(2)} USDT`}`);
        setBalanceModalUser(null);
        setAdjustBalanceAmount('');
        // Sync local storage if this user is currently loaded in this browser session
        try {
          const authUser = localStorage.getItem('pkw_auth_user');
          if (authUser) {
            const parsed = JSON.parse(authUser);
            if (parsed.id === balanceModalUser.id) {
              parsed.balance = data.user.balance;
              localStorage.setItem('pkw_auth_user', JSON.stringify(parsed));
              localStorage.setItem('pkw_balance', data.user.balance.toString());
            }
          }
        } catch {}
        // Broadcast event so App.tsx immediately updates without reload
        window.dispatchEvent(new CustomEvent('pkw_balance_updated', {
          detail: { userId: balanceModalUser.id, balance: data.user.balance }
        }));
        fetchRegisteredUsers();
      } else {
        showToast(data.message || 'Failed to adjust balance');
      }
    } catch {
      showToast('Error adjusting balance');
    }
  };

  const handleDeleteUser = async (user: RegisteredUser) => {
    if (!confirm(`Are you sure you want to permanently delete player account ${user.username} (${user.id})? This will immediately terminate all active sessions.`)) return;
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Account ${user.username} permanently deleted`);
        fetchRegisteredUsers();

        // If this device / browser has this player logged in, purge immediately
        try {
          const stored = localStorage.getItem('pkw_auth_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.id === user.id || parsed.username === user.username)) {
              localStorage.removeItem('pkw_auth_user');
              localStorage.removeItem('pkw_balance');
            }
          }
          // Broadcast to any open game tabs
          window.dispatchEvent(new CustomEvent('pkw_force_logout', { detail: { userId: user.id } }));
        } catch {}
      } else {
        showToast(data.message || 'Failed to delete user');
      }
    } catch {
      showToast('Error deleting account');
    }
  };

  const fetchSupportThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/support/chats');
      const data = await res.json();
      if (data && data.success) {
        setChatThreads(data.threads || []);
        if (typeof data.totalUnread === 'number') setTotalSupportUnread(data.totalUnread);
        // Automatically select the first thread if none selected
        setActiveChatUserId((prev) => {
          if (!prev && data.threads && data.threads.length > 0) {
            return data.threads[0].userId;
          }
          return prev;
        });
      }
    } catch {}
  }, []);

  const fetchActiveChatMessages = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/support/messages?userId=${uid}`);
      const data = await res.json();
      if (data && data.success) {
        setActiveChatMessages(data.messages || []);
      }
      // Also mark as read on server
      fetch('/api/admin/support/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      }).catch(() => {});
    } catch {}
  }, []);

  // Poll support messages if on support tab
  useEffect(() => {
    if (portalTab === 'support') {
      fetchSupportThreads();
      const interval = setInterval(fetchSupportThreads, 2500);
      return () => clearInterval(interval);
    }
  }, [portalTab, fetchSupportThreads]);

  // Poll active chat thread messages
  useEffect(() => {
    if (portalTab === 'support' && activeChatUserId) {
      fetchActiveChatMessages(activeChatUserId);
      const interval = setInterval(() => fetchActiveChatMessages(activeChatUserId), 2000);
      return () => clearInterval(interval);
    }
  }, [portalTab, activeChatUserId, fetchActiveChatMessages]);

  const handleAdminSendReply = async (messageText?: string) => {
    const text = (messageText || adminReplyInput).trim();
    if (!activeChatUserId || !text || adminSendingReply) return;
    setAdminSendingReply(true);
    try {
      const res = await fetch('/api/admin/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeChatUserId, message: text }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminReplyInput('');
        fetchActiveChatMessages(activeChatUserId);
        fetchSupportThreads();
        showToast('Reply sent to player!');
      } else {
        showToast(data.message || 'Failed to send reply');
      }
    } catch {
      showToast('Error sending reply');
    } finally {
      setAdminSendingReply(false);
    }
  };

  const handleClearChatThread = async (uid: string) => {
    if (!confirm(`Are you sure you want to clear chat history for user ${uid}?`)) return;
    try {
      const res = await fetch('/api/admin/support/clear-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Chat history for ${uid} cleared`);
        setActiveChatMessages([]);
        fetchSupportThreads();
      }
    } catch {
      showToast('Failed to clear thread');
    }
  };

  const handleDepositAction = async (id: string, action: 'approve' | 'reject', creditedAmount?: number) => {
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/admin/requests/deposit-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, creditedAmount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Deposit ${id} ${action === 'approve' ? 'Approved & Credited' : 'Rejected'}!`);
        if (data.userBalance !== undefined && data.request?.userId) {
          window.dispatchEvent(
            new CustomEvent('pkw_balance_updated', {
              detail: { userId: data.request.userId, balance: data.userBalance },
            })
          );
        }
        setInspectDeposit(null);
        fetchStatus();
      } else {
        showToast(data.message || 'Action failed');
      }
    } catch {
      showToast('Failed to perform deposit action');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWithdrawAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/admin/requests/withdraw-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Withdrawal ${id} ${action === 'approve' ? 'Approved & Completed' : 'Rejected & Refunded'}!`);
        if (data.userBalance !== undefined && data.request?.userId) {
          window.dispatchEvent(
            new CustomEvent('pkw_balance_updated', {
              detail: { userId: data.request.userId, balance: data.userBalance },
            })
          );
        }
        fetchStatus();
      } else {
        showToast(data.message || 'Action failed');
      }
    } catch {
      showToast('Failed to perform withdrawal action');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTransferAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoadingId(id);
    try {
      const res = await fetch('/api/admin/requests/transfer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Transfer ${id} ${action === 'approve' ? 'Approved & Delivered' : 'Rejected & Refunded'}!`);
        if (data.senderBalance !== undefined && data.request?.senderId) {
          window.dispatchEvent(
            new CustomEvent('pkw_balance_updated', {
              detail: { userId: data.request.senderId, balance: data.senderBalance },
            })
          );
        }
        if (data.recipientBalance !== undefined && data.request?.recipientId) {
          window.dispatchEvent(
            new CustomEvent('pkw_balance_updated', {
              detail: { userId: data.request.recipientId, balance: data.recipientBalance },
            })
          );
        }
        fetchStatus();
      } else {
        showToast(data.message || 'Action failed');
      }
    } catch {
      showToast('Failed to perform transfer action');
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Synchronized countdown for live timeframe clocks (100% matched to Game Frontend & Server)
  useEffect(() => {
    const updateTimers = () => {
      setTimeframeTimers(getAllSynchronizedTimeframes());
    };
    updateTimers();
    const timerInterval = setInterval(updateTimers, 250);
    return () => clearInterval(timerInterval);
  }, []);

  // Login handler with backend verification (saves session in localStorage)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Please enter password or passcode');
      return;
    }

    setIsVerifying(true);
    setPinError(null);

    try {
      const res = await fetch('/api/admin/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: pinInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('pkw_admin_authenticated', 'true');
        localStorage.setItem('pkw_admin_session_time', Date.now().toString());
        showToast('🔓 Authorization Successful • Session Saved');
      } else {
        setPinError(data.message || 'Invalid Master Passcode. Default: 8888');
      }
    } catch {
      if (pinInput.trim() === '8888') {
        setIsAuthenticated(true);
        localStorage.setItem('pkw_admin_authenticated', 'true');
        localStorage.setItem('pkw_admin_session_time', Date.now().toString());
        showToast('🔓 Authorization Successful (Offline fallback)');
      } else {
        setPinError('Invalid Passcode');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pkw_admin_authenticated');
    localStorage.removeItem('pkw_admin_session_time');
    setIsAuthenticated(false);
    setPinInput('');
    showToast('🔒 Session terminated • Admin interface locked');
  };

  // Change Passcode Handler
  const handleChangePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeModalError(null);

    if (!currentPasscode.trim()) {
      setPasscodeModalError('Enter current passcode');
      return;
    }
    if (!newPasscode.trim() || newPasscode.trim().length < 4) {
      setPasscodeModalError('New passcode must be at least 4 characters');
      return;
    }
    if (newPasscode.trim() !== confirmPasscode.trim()) {
      setPasscodeModalError('New passcodes do not match');
      return;
    }

    setPasscodeSubmitting(true);
    try {
      const res = await fetch('/api/admin/change-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPasscode: currentPasscode.trim(),
          newPasscode: newPasscode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangePasscodeModalOpen(false);
        setCurrentPasscode('');
        setNewPasscode('');
        setConfirmPasscode('');
        showToast(`✅ Passcode changed to "${newPasscode.trim()}"!`);
      } else {
        setPasscodeModalError(data.message || 'Failed to change passcode');
      }
    } catch {
      setPasscodeModalError('Network error connecting to backend');
    } finally {
      setPasscodeSubmitting(false);
    }
  };

  // Admin Vault Withdrawal Handler (Withdrawing accumulated profit from losing bets)
  const handleVaultWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);

    const numAmount = parseFloat(withdrawAmount) || 0;
    if (numAmount <= 0) {
      setWithdrawError('Enter a valid withdrawal amount');
      return;
    }
    if (numAmount > houseVaultBalance) {
      setWithdrawError(`Insufficient vault balance ($${houseVaultBalance.toFixed(2)} USDT available)`);
      return;
    }
    if (!withdrawAddress.trim() || withdrawAddress.trim().length < 10) {
      setWithdrawError('Please enter a valid wallet address');
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const res = await fetch('/api/admin/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          address: withdrawAddress.trim(),
          network: withdrawNetwork,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHouseVaultBalance(data.remainingVaultBalance);
        if (data.withdrawal) {
          setWithdrawals((prev) => [data.withdrawal, ...prev]);
        }
        setWithdrawModalOpen(false);
        setWithdrawAddress('');
        showToast(`💰 Withdrawn ${numAmount.toFixed(2)} USDT to ${withdrawNetwork}!`);
      } else {
        setWithdrawError(data.message || 'Withdrawal failed');
      }
    } catch {
      setWithdrawError('Connection error to server');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Update Policy on Server
  const handleUpdatePolicy = async (tf: string, policy: string) => {
    setPolicies((prev) => ({ ...prev, [tf]: policy }));
    try {
      const res = await fetch('/api/admin/set-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeframe: tf, policy }),
      });
      if (res.ok) {
        const policyNames: { [k: string]: string } = {
          auto: 'Auto Market (Fair)',
          house_kill: 'House Edge / Anti-Loss (Guaranteed Loss)',
          player_win: 'Player Win Mode',
          force_big_double: 'Forced Big+Double',
          force_big_single: 'Forced Big+Single',
          force_small_double: 'Forced Small+Double',
          force_small_single: 'Forced Small+Single',
        };
        showToast(`🎯 [${tf}] ${policyNames[policy] || policy} enforced live!`);
      }
    } catch {
      showToast(`⚠️ Policy set locally (Server syncing)`);
    }
  };

  const handleResetAllToAuto = async () => {
    try {
      await fetch('/api/admin/reset-policies', { method: 'POST' });
      const resetMap: { [tf: string]: string } = {};
      timeframes.forEach((tf) => (resetMap[tf] = 'auto'));
      setPolicies(resetMap);
      showToast('✅ All timeframes reset to Auto Market (Fair RNG)');
    } catch {
      showToast('Reset failed');
    }
  };

  const openCalibrateModal = () => {
    setCalibVaultInput(houseVaultBalance.toString());
    setCalibLossInput(totalCollectedLosses.toString());
    setCalibWinInput(totalPaidOutWins.toString());
    setCalibClearLedger(false);
    setCalibrateModalOpen(true);
  };

  const handleCalibrateVaultStats = async (resetAllToZero = false) => {
    setCalibSubmitting(true);
    try {
      const payload = resetAllToZero
        ? { houseVaultBalance: 0, totalCollectedLosses: 0, totalPaidOutWins: 0, resetLedger: true }
        : {
            houseVaultBalance: parseFloat(calibVaultInput) || 0,
            totalCollectedLosses: Math.max(0, parseFloat(calibLossInput) || 0),
            totalPaidOutWins: Math.max(0, parseFloat(calibWinInput) || 0),
            resetLedger: calibClearLedger,
          };

      const res = await fetch('/api/admin/vault/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHouseVaultBalance(data.houseVaultBalance);
        setTotalCollectedLosses(data.totalCollectedLosses);
        setTotalPaidOutWins(data.totalPaidOutWins);
        if (data.ledger) setLedger(data.ledger);
        setCalibrateModalOpen(false);
        showToast(resetAllToZero ? '✅ Vault & bet metrics reset to 0.00 USDT' : '✅ Vault statistics updated successfully');
      } else {
        showToast(data.message || 'Failed to update vault metrics');
      }
    } catch {
      showToast('Network error updating metrics');
    } finally {
      setCalibSubmitting(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    setAnnouncementSaving(true);
    try {
      const res = await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: announcementInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Running announcement updated on Home screen!');
      } else {
        showToast('Failed to update announcement');
      }
    } catch {
      showToast('Network error updating announcement');
    } finally {
      setAnnouncementSaving(false);
    }
  };

  // If not authenticated, show standalone password-protected login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#040711] text-gray-100 flex items-center justify-center p-4 selection:bg-purple-600 selection:text-white">
        <div className="max-w-md w-full bg-[#0b1228] border border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/50 mx-auto flex items-center justify-center text-purple-400 shadow-xl">
                <Lock className="w-8 h-8 text-purple-400" />
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 bg-red-500 rounded-full border-2 border-[#0b1228]">
                <ShieldAlert className="w-3.5 h-3.5 text-white" />
              </span>
            </div>

            <div>
              <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black rounded-full uppercase tracking-wider inline-block mb-1.5">
                Restricted System • Authorized Access Only
              </span>
              <h1 className="text-2xl font-black text-white tracking-wide flex items-center justify-center space-x-1.5">
                <span>CryptoWin</span>
                <span className="text-amber-400">PRO</span>
                <span className="text-gray-400 text-base font-medium">| Admin Portal</span>
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Enter your administrative security passcode to verify identity.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 block font-semibold flex items-center justify-between">
                <span>Security Passcode:</span>
                <span className="text-[10px] text-gray-500 font-mono">Protected</span>
              </label>

              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  maxLength={32}
                  autoFocus
                  placeholder="Enter admin password..."
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  className="w-full bg-[#060a17] border border-[#1a2b56] focus:border-purple-500 text-center text-xl font-mono text-white tracking-widest py-3.5 pl-4 pr-11 rounded-2xl outline-none shadow-inner transition placeholder:tracking-normal placeholder:text-gray-600 placeholder:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-3.5 text-gray-400 hover:text-white transition p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {pinError && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-xl text-center">
                  <p className="text-xs text-red-300 font-semibold flex items-center justify-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>{pinError}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="bg-[#060a17]/80 border border-[#121e3d] rounded-xl p-2.5 flex items-center space-x-2 text-[11px] text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Authorized session will be saved to <strong className="text-gray-300 font-mono">localStorage</strong> for persistent access on this device.
              </span>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm shadow-xl shadow-purple-950/40 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>{isVerifying ? 'Authenticating...' : 'Authorize & Open Terminal'}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-[#121e3d] flex items-center justify-between text-xs text-gray-400">
            <span>Passcode can be changed anytime inside</span>
            <a
              href="/"
              className="text-[#0088ff] hover:text-blue-300 font-semibold hover:underline flex items-center space-x-1"
            >
              <span>← Player Game</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040711] text-gray-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* TOP HEADER */}
      <header className="bg-[#0b1228] border-b border-[#1a2b56] px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/50 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-black text-white flex items-center space-x-1.5">
                  <span>CryptoWin</span>
                  <span className="text-amber-400 font-black">PRO</span>
                  <span className="text-gray-400 text-xs font-semibold">• Admin Terminal</span>
                </h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>ENGINE LIVE</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Risk Engine • House Loss Vault • Live Timeframe Clocks
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setChangePasscodeModalOpen(true)}
              className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 hover:text-white text-xs font-bold rounded-xl border border-purple-500/30 flex items-center space-x-1.5 transition"
            >
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>Change Passcode</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition active:scale-95"
            >
              <span>Player Game</span>
              <ExternalLink className="w-3 h-3 text-blue-200" />
            </a>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold rounded-xl border border-red-500/30 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* HOUSE TREASURY VAULT (Admin Net Balance from Lost Bets) */}
      <div className="bg-gradient-to-r from-[#0b1228] via-[#121e3d] to-[#0b1228] border-b border-amber-500/30 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-xl shadow-amber-950/40">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase tracking-wider font-extrabold text-amber-400">
                  House Treasury Vault • Admin Collected Balance
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/30 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>LOST BETS INFLOW</span>
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <h2 className="text-2xl md:text-3xl font-black text-white font-mono tracking-tight">
                  ${houseVaultBalance.toFixed(2)}{' '}
                  <span className="text-sm font-bold text-amber-400">USDT</span>
                </h2>
                <span className="text-xs text-gray-400 font-medium">
                  (Available for Admin Withdrawal)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs flex-wrap gap-y-2">
            <div className="bg-[#060a17]/90 px-3.5 py-2 rounded-xl border border-[#1a2b56] text-center">
              <span className="text-[10px] text-gray-400 block font-medium">Player Losses Collected</span>
              <span className="text-emerald-400 font-mono font-black text-sm">
                +${totalCollectedLosses.toFixed(2)} USDT
              </span>
            </div>

            <div className="bg-[#060a17]/90 px-3.5 py-2 rounded-xl border border-[#1a2b56] text-center">
              <span className="text-[10px] text-gray-400 block font-medium">Player Wins Paid Out</span>
              <span className="text-red-400 font-mono font-black text-sm">
                -${totalPaidOutWins.toFixed(2)} USDT
              </span>
            </div>

            <button
              onClick={openCalibrateModal}
              className="px-3 py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 hover:text-white font-bold rounded-xl text-xs border border-purple-500/40 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-sm"
              title="Calibrate or reset vault & bet metrics"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Edit / Reset Stats</span>
            </button>

            <button
              onClick={() => setWithdrawModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-amber-950/50 flex items-center space-x-2 transition active:scale-95 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Withdraw Vault Funds</span>
            </button>
          </div>
        </div>
      </div>

      {/* REAL-TIME METRICS & LIVE TIMERS BAR */}
      <div className="bg-[#060a17] border-b border-[#121e3d] px-4 py-2.5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* REAL ONLINE USERS */}
          <div className="flex items-center space-x-2.5 bg-[#0b1228] p-2.5 rounded-xl border border-[#1a2b56]">
            <div className="relative">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping"></span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-gray-400 font-medium">Real-Time Online:</span>
                <span className="font-bold text-white font-mono text-xs">
                  {onlineUsers} Total
                </span>
              </div>
              <div className="text-[10px] flex items-center space-x-2 mt-0.5 font-mono">
                <span className="text-emerald-400 font-semibold">🎮 {onlinePlayers} Players</span>
                <span className="text-purple-400 font-semibold">🛡️ {onlineAdmins} Admins</span>
              </div>
            </div>
          </div>

          {/* REAL ACTIVE BETS AMOUNT IN PLAY */}
          <div className="flex items-center space-x-2.5 bg-[#0b1228] p-2.5 rounded-xl border border-[#1a2b56]">
            <Activity className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-gray-400 block font-medium">Active Bets In Current Round</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">
                ${totalActiveBetsAmount.toFixed(2)} USDT ({totalActiveBetsCount} bets)
              </span>
            </div>
          </div>

          {/* 30s LIVE TIMEFRAME COUNTDOWN */}
          <div className="flex items-center space-x-2.5 bg-[#0b1228] p-2.5 rounded-xl border border-[#1a2b56]">
            <Clock className={`w-4 h-4 ${timeframeTimers['30s']?.isLocked ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
            <div>
              <span className="text-[10px] text-gray-400 block font-medium">30s Timeframe Timer</span>
              <div className="flex items-center space-x-1.5">
                <span className={`font-mono font-black text-sm ${timeframeTimers['30s']?.isLocked ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                  {timeframeTimers['30s']?.display || '00:30'}
                </span>
                {timeframeTimers['30s']?.isLocked && (
                  <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded font-bold">LOCKED</span>
                )}
              </div>
            </div>
          </div>

          {/* 1min LIVE TIMEFRAME COUNTDOWN */}
          <div className="flex items-center space-x-2.5 bg-[#0b1228] p-2.5 rounded-xl border border-[#1a2b56]">
            <Clock className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-gray-400 block font-medium">1min Timeframe Timer</span>
              <div className="flex items-center space-x-1.5">
                <span className={`font-mono font-black text-sm ${timeframeTimers['1min']?.isLocked ? 'text-red-400 animate-pulse' : 'text-purple-300'}`}>
                  {timeframeTimers['1min']?.display || '01:00'}
                </span>
                {timeframeTimers['1min']?.isLocked && (
                  <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded font-bold">LOCKED</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PORTAL NAVIGATION TABS */}
      <div className="max-w-7xl mx-auto w-full px-4 pt-4">
        <div className="flex items-center space-x-2 border-b border-[#1a2b56] pb-2">
          <button
            onClick={() => setPortalTab('controls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              portalTab === 'controls'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Risk Controllers & Live Timers</span>
          </button>

          <button
            onClick={() => setPortalTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 relative ${
              portalTab === 'requests'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Deposit & Withdrawal Requests</span>
            {pendingDepositsCount + pendingWithdrawalsCount > 0 && (
              <span className="bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                {pendingDepositsCount + pendingWithdrawalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setPortalTab('support');
              fetchSupportThreads();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 relative ${
              portalTab === 'support'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Customer Support (Live Helpdesk)</span>
            {totalSupportUnread > 0 && (
              <span className="bg-emerald-400 text-black text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                {totalSupportUnread}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setPortalTab('users');
              fetchRegisteredUsers();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 relative ${
              portalTab === 'users'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Registered Players ({registeredUsers.length || totalUsersCount})</span>
          </button>

          <button
            onClick={() => {
              setPortalTab('recovery');
              fetchRecoveryRequests();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 relative ${
              portalTab === 'recovery'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Password Recovery</span>
            {pendingRecoveryCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow">
                {pendingRecoveryCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setPortalTab('ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              portalTab === 'ledger'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Loss / Win Settlement Ledger ({ledger.length})</span>
          </button>

          <button
            onClick={() => setPortalTab('vault')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              portalTab === 'vault'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                : 'text-gray-400 hover:text-white hover:bg-[#121e3d]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Admin Vault Withdrawals ({withdrawals.length})</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto w-full p-4 space-y-6 flex-1">
        {portalTab === 'controls' && (
          <>
            {/* Quick Actions Bar */}
            <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <Radio className="w-5 h-5 text-purple-400 animate-pulse shrink-0" />
                <div>
                  <h3 className="font-bold text-white text-sm">Server-Authoritative Result Control Portal</h3>
                  <p className="text-gray-400 text-xs">
                    Each timeframe card displays its <strong>exact live countdown timer</strong> and <strong>lost bet earnings</strong>. Setting policy to <strong>House Kill</strong> guarantees platform profit!
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchStatus}
                  className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 rounded-xl font-bold border border-[#1a2b56] transition flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleResetAllToAuto}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-bold border border-gray-600 transition shrink-0"
                >
                  Reset All to Auto
                </button>
              </div>
            </div>

            {/* Live Running Notice Ribbon Editor */}
            <div className="bg-[#0b1228] border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-lg shadow-amber-950/10">
              <div className="flex items-center space-x-3 flex-1 w-full">
                <Flame className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
                <div className="flex-1 w-full">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-bold text-white text-xs">Home Screen Running Notice Bar ("Chalti Hui Patti")</span>
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded font-bold">LIVE BROADCAST</span>
                  </div>
                  <input
                    type="text"
                    value={announcementInput}
                    onChange={(e) => setAnnouncementInput(e.target.value)}
                    placeholder="Enter broadcast announcement message..."
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-medium"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveAnnouncement}
                disabled={announcementSaving}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold rounded-xl text-xs shadow-lg transition active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {announcementSaving ? 'Saving...' : 'Update Notice'}
              </button>
            </div>

            {/* TIMEFRAME CONTROLS GRID */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-white flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Timeframe Risk Controllers & Live Clocks</span>
                </h2>
                <span className="text-xs text-gray-400">Timers and bet pools update synchronously in real-time</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {timeframes.map((tf) => {
                  const currentPolicy = policies[tf] || 'auto';
                  const tfData = timeframeSummary[tf] || { totalAmount: 0, count: 0, bets: [] };
                  const totalBetPool = tfData.totalAmount;
                  const isExpanded = expandedTf === tf;
                  const timer = timeframeTimers[tf] || {
                    remaining: 30,
                    duration: 30,
                    minStr: '00',
                    secStr: '30',
                    display: '00:30',
                    issue: 0,
                    isLocked: false,
                  };
                  const progressPct = ((timer.duration - timer.remaining) / timer.duration) * 100;

                  return (
                    <div
                      key={tf}
                      className={`bg-[#0b1228] border rounded-2xl p-4 space-y-3.5 transition shadow-lg ${
                        currentPolicy === 'house_kill'
                          ? 'border-red-500/60 shadow-red-950/30'
                          : currentPolicy === 'player_win'
                          ? 'border-amber-500/60 shadow-amber-950/30'
                          : currentPolicy.startsWith('force_')
                          ? 'border-purple-500/60 shadow-purple-950/30'
                          : 'border-[#1a2b56]'
                      }`}
                    >
                      {/* Card Header with LIVE TIMER */}
                      <div className="flex items-center justify-between border-b border-[#121e3d] pb-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 bg-[#121e3d] text-white font-mono font-black text-xs rounded-lg border border-[#1a2b56]">
                            {tf}
                          </span>

                          {/* LIVE TIMEFRAME COUNTDOWN BADGE */}
                          <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border text-xs font-mono font-bold ${
                            timer.isLocked
                              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{timer.display}</span>
                            {timer.isLocked && <span className="text-[9px] uppercase font-black">LOCKED</span>}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${
                            currentPolicy === 'auto'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : currentPolicy === 'house_kill'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                              : currentPolicy === 'player_win'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          }`}
                        >
                          {currentPolicy === 'auto'
                            ? 'AUTO MARKET'
                            : currentPolicy === 'house_kill'
                            ? 'HOUSE KILL'
                            : currentPolicy === 'player_win'
                            ? 'FORCE WIN'
                            : currentPolicy.replace('force_', 'FORCE ').toUpperCase()}
                        </span>
                      </div>

                      {/* ROUND TIME PROGRESS BAR */}
                      <div className="w-full bg-[#060a17] h-1.5 rounded-full overflow-hidden border border-[#121e3d]">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            timer.isLocked ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-blue-500 to-amber-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                        ></div>
                      </div>

                      {/* REAL-TIME ACTIVE BETS AMOUNT ON THIS TIMEFRAME */}
                      <div className="bg-[#060a17] p-2.5 rounded-xl border border-[#121e3d] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 font-medium">Bets Placed in Current Round:</span>
                          <span className={`font-mono font-black ${totalBetPool > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            ${totalBetPool.toFixed(2)} USDT
                          </span>
                        </div>

                        {tfData.count > 0 && (
                          <button
                            onClick={() => setExpandedTf(isExpanded ? null : tf)}
                            className="w-full text-left text-[11px] text-[#0088ff] hover:underline flex items-center justify-between pt-1 border-t border-[#121e3d]"
                          >
                            <span>{isExpanded ? 'Hide Bet Details' : `View ${tfData.count} Player Bets`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {/* Expanded list of bets */}
                        {isExpanded && tfData.bets.length > 0 && (
                          <div className="pt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                            {tfData.bets.map((b) => (
                              <div
                                key={b.id}
                                className="bg-[#0b1228] p-1.5 rounded-lg border border-[#1a2b56] flex items-center justify-between text-[10px]"
                              >
                                <div>
                                  <span className="text-gray-300 font-bold block">{b.userId}</span>
                                  <span className="text-gray-500 font-mono">Issue #{b.issue}</span>
                                </div>
                                <div className="text-right">
                                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 font-bold rounded">
                                    {b.type}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-400 ml-1.5">
                                    ${b.amount.toFixed(2)} USDT
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Policy Switch Buttons */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'auto')}
                            className={`py-2 px-2.5 rounded-xl text-left border text-xs font-bold transition flex items-center space-x-1.5 ${
                              currentPolicy === 'auto'
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                                : 'bg-[#060a17] text-gray-300 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>Auto (Market)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'house_kill')}
                            className={`py-2 px-2.5 rounded-xl text-left border text-xs font-bold transition flex items-center space-x-1.5 ${
                              currentPolicy === 'house_kill'
                                ? 'bg-red-600 text-white border-red-400 shadow-md'
                                : 'bg-[#060a17] text-red-300 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                            <span>House Kill</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'player_win')}
                            className={`py-1.5 px-2 rounded-xl text-left border text-[11px] font-semibold transition ${
                              currentPolicy === 'player_win'
                                ? 'bg-amber-600 text-white border-amber-400'
                                : 'bg-[#060a17] text-gray-300 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            Player Win
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'force_big_double')}
                            className={`py-1.5 px-2 rounded-xl text-left border text-[11px] font-semibold transition ${
                              currentPolicy === 'force_big_double'
                                ? 'bg-purple-600 text-white border-purple-400'
                                : 'bg-[#060a17] text-gray-300 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            Big + Double
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'force_big_single')}
                            className={`py-1 px-1 rounded-lg text-center border text-[10px] font-medium transition ${
                              currentPolicy === 'force_big_single'
                                ? 'bg-purple-600 text-white border-purple-400'
                                : 'bg-[#060a17] text-gray-400 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            Big+Single
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'force_small_double')}
                            className={`py-1 px-1 rounded-lg text-center border text-[10px] font-medium transition ${
                              currentPolicy === 'force_small_double'
                                ? 'bg-purple-600 text-white border-purple-400'
                                : 'bg-[#060a17] text-gray-400 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            Small+Double
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdatePolicy(tf, 'force_small_single')}
                            className={`py-1 px-1 rounded-lg text-center border text-[10px] font-medium transition ${
                              currentPolicy === 'force_small_single'
                                ? 'bg-purple-600 text-white border-purple-400'
                                : 'bg-[#060a17] text-gray-400 border-[#1a2b56] hover:bg-[#121e3d]'
                            }`}
                          >
                            Small+Single
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* PLAYER DEPOSIT & WITHDRAWAL REQUESTS TAB */}
        {portalTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white flex items-center space-x-2">
                  <Inbox className="w-5 h-5 text-purple-400" />
                  <span>Player Deposit & Withdrawal Management</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Strict Rule: Minimum deposit & withdrawal is <strong>50 USDT</strong>. Deposits credit to user wallet ONLY after Admin approval.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchStatus}
                  className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 rounded-xl font-bold border border-[#1a2b56] text-xs flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Requests</span>
                </button>
              </div>
            </div>

            {/* Sub-tabs: Deposits vs Withdrawals */}
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => setRequestSubTab('deposits')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    requestSubTab === 'deposits'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-[#0b1228] text-gray-400 hover:text-white border border-[#1a2b56]'
                  }`}
                >
                  <span>Deposit Requests</span>
                  {pendingDepositsCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-amber-400 text-black">
                      {pendingDepositsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setRequestSubTab('withdrawals')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    requestSubTab === 'withdrawals'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                      : 'bg-[#0b1228] text-gray-400 hover:text-white border border-[#1a2b56]'
                  }`}
                >
                  <span>Withdrawal Requests</span>
                  {pendingWithdrawalsCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-amber-400 text-black">
                      {pendingWithdrawalsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setRequestSubTab('transfers')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    requestSubTab === 'transfers'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                      : 'bg-[#0b1228] text-gray-400 hover:text-white border border-[#1a2b56]'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Transfer Requests</span>
                  {pendingTransfersCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-cyan-400 text-black">
                      {pendingTransfersCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1 bg-[#0b1228] p-1 rounded-xl border border-[#1a2b56] text-xs">
                {(['all', 'Pending', 'Approved', 'Rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setRequestFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                      requestFilter === st
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 1: DEPOSIT REQUESTS TABLE */}
            {requestSubTab === 'deposits' && (
              <div className="space-y-4">
                {/* OFFICIAL RECEIVING WALLET SETTINGS CARD */}
                <div className="bg-gradient-to-r from-[#0b1228] via-[#101b38] to-[#0b1228] border border-emerald-500/40 rounded-2xl p-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-[#1a2b56] pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                          <span>Official Receiving Wallets (Your Binance / Trust Wallet)</span>
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                            Live on Player Screen
                          </span>
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Players copy these addresses to transfer USDT from Binance/Bybit. Funds arrive directly in your wallet!
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveDepositWallets}
                      disabled={savingWallets}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {savingWallets ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Save Receiving Wallets</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* TRC20 WALLET */}
                    <div className="bg-[#060a17] border border-[#1a2b56] rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                          <span>USDT (TRC20 - Tron Network)</span>
                        </label>
                        {depositWallets.trc20 ? (
                          <button
                            type="button"
                            onClick={() => setDepositWallets((prev) => ({ ...prev, trc20: '' }))}
                            className="text-[10px] text-gray-400 hover:text-red-400 font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-mono">Recommended (Fast & Low Fee)</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={depositWallets.trc20}
                        onChange={(e) => setDepositWallets((prev) => ({ ...prev, trc20: e.target.value }))}
                        placeholder="Paste your TRC20 address (Starts with T...)"
                        className="w-full bg-[#0b1228] border border-[#1a2b56] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition"
                      />
                    </div>

                    {/* BEP20 WALLET */}
                    <div className="bg-[#060a17] border border-[#1a2b56] rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                          <span>USDT (BEP20 - BNB Smart Chain)</span>
                        </label>
                        {depositWallets.bep20 ? (
                          <button
                            type="button"
                            onClick={() => setDepositWallets((prev) => ({ ...prev, bep20: '' }))}
                            className="text-[10px] text-gray-400 hover:text-red-400 font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-mono">BSC Network</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={depositWallets.bep20}
                        onChange={(e) => setDepositWallets((prev) => ({ ...prev, bep20: e.target.value }))}
                        placeholder="Paste your BEP20 address (Starts with 0x...)"
                        className="w-full bg-[#0b1228] border border-[#1a2b56] rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition"
                      />
                    </div>
                  </div>
                </div>
                {depositRequests.filter((d) => requestFilter === 'all' || d.status === requestFilter).length === 0 ? (
                  <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                    <Inbox className="w-8 h-8 text-gray-500 mx-auto" />
                    <p className="font-bold">No Deposit Requests Found</p>
                    <p className="text-xs text-gray-500">
                      When players submit a deposit from the game frontend, it will appear here for verification and approval.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Request ID</th>
                            <th className="py-3 px-4">Player UID</th>
                            <th className="py-3 px-4">Network</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Deposit Proof / Screenshot</th>
                            <th className="py-3 px-4">Time</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#121e3d]">
                          {depositRequests
                            .filter((d) => requestFilter === 'all' || d.status === requestFilter)
                            .map((dep) => (
                              <tr key={dep.id} className="hover:bg-[#121e3d]/40 transition">
                                <td className="py-3 px-4 font-mono font-bold text-white">
                                  {dep.id}
                                </td>
                                <td className="py-3 px-4 font-mono text-purple-300 font-bold">
                                  {dep.userId}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 bg-[#121e3d] text-emerald-300 font-bold rounded text-[11px] border border-[#1a2b56]">
                                    {dep.network}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                                  +${dep.amount.toFixed(2)} USDT
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-2">
                                    {dep.screenshot ? (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewScreenshot(dep.screenshot || null)}
                                        className="relative group p-1 bg-[#121e3d] hover:bg-purple-900/40 rounded-lg border border-purple-500/40 transition flex items-center space-x-1.5 cursor-pointer"
                                        title="Click to view full screenshot"
                                      >
                                        <img
                                          src={dep.screenshot}
                                          alt="Deposit Slip"
                                          className="w-8 h-8 rounded object-cover border border-purple-500/30"
                                        />
                                        <span className="text-[11px] text-purple-300 group-hover:text-white font-bold pr-1">
                                          View Slip 🖼️
                                        </span>
                                      </button>
                                    ) : (
                                      <div className="flex items-center space-x-1.5">
                                        <span
                                          className="font-mono text-purple-300 text-[11px] bg-[#060a17] px-2 py-1 rounded border border-[#1a2b56] max-w-[110px] truncate"
                                          title={dep.txHash}
                                        >
                                          {dep.txHash}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(dep.txHash);
                                            showToast('TxID copied to clipboard!');
                                          }}
                                          title="Copy TxID"
                                          className="p-1 text-gray-400 hover:text-white bg-[#121e3d] hover:bg-[#1a2b56] rounded border border-[#1a2b56] transition"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInspectDeposit(dep);
                                        setCustomCreditAmount(dep.amount.toString());
                                      }}
                                      className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-300 hover:text-white font-bold rounded text-[10px] border border-indigo-500/40 transition cursor-pointer"
                                    >
                                      Inspect
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                                  {new Date(dep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      dep.status === 'Approved'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : dep.status === 'Rejected'
                                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                                    }`}
                                  >
                                    {dep.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {dep.status === 'Pending' ? (
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <button
                                        disabled={actionLoadingId === dep.id}
                                        onClick={() => handleDepositAction(dep.id, 'approve')}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Approve & Credit</span>
                                      </button>
                                      <button
                                        disabled={actionLoadingId === dep.id}
                                        onClick={() => handleDepositAction(dep.id, 'reject')}
                                        className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Reject</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 text-xs italic">
                                      Reviewed
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: WITHDRAWAL REQUESTS TABLE */}
            {requestSubTab === 'withdrawals' && (
              <div>
                {withdrawRequests.filter((w) => requestFilter === 'all' || w.status === requestFilter).length === 0 ? (
                  <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                    <Inbox className="w-8 h-8 text-gray-500 mx-auto" />
                    <p className="font-bold">No Withdrawal Requests Found</p>
                    <p className="text-xs text-gray-500">
                      When players submit a withdrawal, it will appear here for Admin verification, transfer approval, or rejection.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Request ID</th>
                            <th className="py-3 px-4">Player UID</th>
                            <th className="py-3 px-4">Destination Address</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Net Payout (-Fee)</th>
                            <th className="py-3 px-4">Turnover Policy</th>
                            <th className="py-3 px-4">Time</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#121e3d]">
                          {withdrawRequests
                            .filter((w) => requestFilter === 'all' || w.status === requestFilter)
                            .map((wd) => (
                              <tr key={wd.id} className="hover:bg-[#121e3d]/40 transition">
                                <td className="py-3 px-4 font-mono font-bold text-white">
                                  {wd.id}
                                </td>
                                <td className="py-3 px-4 font-mono text-purple-300 font-bold">
                                  {wd.userId}
                                </td>
                                <td className="py-3 px-4 font-mono text-gray-300 text-[11px]">
                                  {wd.address}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                                  ${wd.amount.toFixed(2)} USDT
                                </td>
                                <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                                  ${wd.netAmount.toFixed(2)} USDT
                                </td>
                                <td className="py-3 px-4">
                                  {typeof wd.turnoverCompleted === 'number' && typeof wd.turnoverRequired === 'number' && wd.turnoverRequired > 0 ? (
                                    <div className="space-y-0.5">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                                          wd.turnoverStatus === 'Satisfied' || wd.turnoverCompleted >= wd.turnoverRequired
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        }`}
                                      >
                                        {wd.turnoverStatus === 'Satisfied' || wd.turnoverCompleted >= wd.turnoverRequired
                                          ? '✅ Satisfied'
                                          : '⚠️ Incomplete'}
                                      </span>
                                      <div className="text-[10px] font-mono text-gray-400">
                                        ${wd.turnoverCompleted.toFixed(2)} / ${wd.turnoverRequired.toFixed(2)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-gray-500 font-mono">Verified</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                                  {new Date(wd.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      wd.status === 'Approved'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : wd.status === 'Rejected'
                                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                                    }`}
                                  >
                                    {wd.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {wd.status === 'Pending' ? (
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <button
                                        disabled={actionLoadingId === wd.id}
                                        onClick={() => handleWithdrawAction(wd.id, 'approve')}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Approve (Sent)</span>
                                      </button>
                                      <button
                                        disabled={actionLoadingId === wd.id}
                                        onClick={() => handleWithdrawAction(wd.id, 'reject')}
                                        className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
                                        title="Reject and refund money to player"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Reject & Refund</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 text-xs italic">
                                      {wd.status === 'Approved' ? 'Paid & Completed' : 'Refunded'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRANSFER REQUESTS TABLE */}
            {requestSubTab === 'transfers' && (
              <div>
                {transferRequests.filter((t) => requestFilter === 'all' || t.status === requestFilter).length === 0 ? (
                  <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                    <Inbox className="w-8 h-8 text-gray-500 mx-auto" />
                    <p className="font-bold">No Transfer Requests Found</p>
                    <p className="text-xs text-gray-500">
                      When players send USDT to another Player ID, it will appear here for Admin review, delivery approval, or rejection with refund.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-3 px-4">Transfer ID</th>
                            <th className="py-3 px-4">Date / Time</th>
                            <th className="py-3 px-4">Sender</th>
                            <th className="py-3 px-4">Recipient</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#121e3d]">
                          {transferRequests
                            .filter((t) => requestFilter === 'all' || t.status === requestFilter)
                            .map((trf) => (
                              <tr key={trf.id} className="hover:bg-[#0f1a3a]/40 transition">
                                <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                                  {trf.id}
                                </td>
                                <td className="py-3.5 px-4 text-gray-400 font-mono text-[11px]">
                                  {new Date(trf.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}{' '}
                                  <span className="text-[10px] text-gray-500 block">
                                    {new Date(trf.timestamp).toLocaleDateString()}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-mono">
                                  <div className="font-bold text-white">{trf.senderName || trf.senderId}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{trf.senderId}</div>
                                </td>
                                <td className="py-3.5 px-4 font-mono">
                                  <div className="font-bold text-cyan-300">{trf.recipientName || trf.recipientId}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{trf.recipientId}</div>
                                </td>
                                <td className="py-3.5 px-4 font-bold font-mono text-emerald-400 text-sm">
                                  ${trf.amount.toFixed(2)} USDT
                                </td>
                                <td className="py-3.5 px-4">
                                  {trf.status === 'Pending' && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center w-max space-x-1 animate-pulse">
                                      <Clock className="w-3 h-3" />
                                      <span>Awaiting Review</span>
                                    </span>
                                  )}
                                  {trf.status === 'Approved' && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center w-max space-x-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Delivered</span>
                                    </span>
                                  )}
                                  {trf.status === 'Rejected' && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center w-max space-x-1">
                                      <XCircle className="w-3 h-3" />
                                      <span>Rejected (Refunded)</span>
                                    </span>
                                  )}
                                  {trf.rejectionReason && (
                                    <span className="text-[10px] text-gray-400 block mt-1">
                                      {trf.rejectionReason}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {trf.status === 'Pending' ? (
                                    <div className="flex items-center justify-end space-x-1.5">
                                      <button
                                        disabled={actionLoadingId === trf.id}
                                        onClick={() => handleTransferAction(trf.id, 'approve')}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Approve & Deliver</span>
                                      </button>
                                      <button
                                        disabled={actionLoadingId === trf.id}
                                        onClick={() => handleTransferAction(trf.id, 'reject')}
                                        className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
                                        title="Reject and refund money to sender"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Reject & Refund</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 text-xs italic">
                                      {trf.status === 'Approved' ? 'Transferred to Recipient' : 'Refunded to Sender'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CUSTOMER SUPPORT (LIVE HELPDESK) TAB */}
        {portalTab === 'support' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0b1228] p-4 rounded-2xl border border-[#1a2b56]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center space-x-2">
                    <span>Live Player Support & Helpdesk Desk</span>
                    {totalSupportUnread > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold rounded-full">
                        {totalSupportUnread} UNREAD
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Real-time two-way messaging between players and Admin support. Replies appear instantly on the player's app.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    fetchSupportThreads();
                    if (activeChatUserId) fetchActiveChatMessages(activeChatUserId);
                    showToast('Support chats refreshed');
                  }}
                  className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 rounded-xl font-bold text-xs border border-[#1a2b56] transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Chats</span>
                </button>
              </div>
            </div>

            {/* TWO-COLUMN SUPPORT DESK */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[650px]">
              {/* LEFT COLUMN: CONVERSATIONS LIST (4 COLS) */}
              <div className="lg:col-span-4 bg-[#0b1228] rounded-2xl border border-[#1a2b56] flex flex-col overflow-hidden">
                <div className="p-3 border-b border-[#121e3d] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                    <span>Player Inquiries ({chatThreads.length})</span>
                    <span className="text-[10px] text-gray-500">Live Queue</span>
                  </div>
                  <input
                    type="text"
                    value={supportSearchTerm}
                    onChange={(e) => setSupportSearchTerm(e.target.value)}
                    placeholder="Search by User ID..."
                    className="w-full bg-[#060a17] border border-[#121e3d] rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#121e3d] p-2 space-y-1">
                  {chatThreads.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 space-y-2">
                      <MessageSquare className="w-8 h-8 mx-auto text-gray-600 stroke-[1.5]" />
                      <p className="text-xs">No customer support messages yet.</p>
                      <p className="text-[10px] text-gray-600">When a user asks a question in "Service", it will appear here instantly.</p>
                    </div>
                  ) : (
                    chatThreads
                      .filter((t) => t.userId.toLowerCase().includes(supportSearchTerm.toLowerCase()))
                      .map((thread) => {
                        const isSelected = activeChatUserId === thread.userId;
                        return (
                          <button
                            key={thread.userId}
                            type="button"
                            onClick={() => {
                              setActiveChatUserId(thread.userId);
                              fetchActiveChatMessages(thread.userId);
                            }}
                            className={`w-full text-left p-3 rounded-xl transition flex items-start space-x-3 cursor-pointer ${
                              isSelected
                                ? 'bg-purple-900/30 border border-purple-500/50'
                                : 'hover:bg-[#121e3d]/60 border border-transparent'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-[#060a17] border border-[#1a2b56] flex items-center justify-center font-mono font-bold text-xs text-purple-300">
                                {thread.userId.replace('USR-', '').substring(0, 3)}
                              </div>
                              {thread.unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[9px] font-black rounded-full flex items-center justify-center animate-bounce shadow">
                                  {thread.unreadCount}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white font-mono truncate">
                                  {thread.userId}
                                </span>
                                <span className="text-[9px] text-gray-500 shrink-0 font-mono">
                                  {new Date(thread.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                <span className="font-semibold text-gray-500 mr-1">
                                  {thread.lastSender === 'admin' ? 'You:' : 'Player:'}
                                </span>
                                {thread.lastMessage}
                              </p>
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ACTIVE CHAT THREAD (8 COLS) */}
              <div className="lg:col-span-8 bg-[#0b1228] rounded-2xl border border-[#1a2b56] flex flex-col overflow-hidden">
                {activeChatUserId ? (
                  <>
                    {/* CHAT HEADER */}
                    <div className="p-3.5 border-b border-[#121e3d] flex items-center justify-between bg-[#060a17]">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-white font-mono">{activeChatUserId}</span>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                              Live Session
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 block">
                            {activeChatMessages.length} total messages exchanged
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(activeChatUserId);
                            showToast('User ID copied to clipboard!');
                          }}
                          className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 text-xs rounded-lg border border-[#1a2b56] flex items-center space-x-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy ID</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearChatThread(activeChatUserId)}
                          className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/50 text-red-300 text-xs rounded-lg border border-red-500/30 flex items-center space-x-1 transition"
                          title="Clear conversation history"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>
                    </div>

                    {/* MESSAGES SCROLL CONTAINER */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#040711]">
                      {activeChatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs space-y-1">
                          <MessageCircle className="w-8 h-8 text-gray-600" />
                          <p>No messages in this conversation yet.</p>
                          <p className="text-[10px] text-gray-600">Send a greeting message below to reach out to the player.</p>
                        </div>
                      ) : (
                        activeChatMessages.map((msg) => {
                          const isAdmin = msg.sender === 'admin';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center space-x-1.5 text-[10px] text-gray-400 mb-1 font-mono">
                                <span className={isAdmin ? 'text-purple-300 font-bold' : 'text-blue-300 font-bold'}>
                                  {isAdmin ? '🛡️ Admin Support' : `👤 Player (${msg.userId})`}
                                </span>
                                <span>•</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              </div>

                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-md leading-relaxed whitespace-pre-wrap ${
                                  isAdmin
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none'
                                    : 'bg-[#0b1228] text-gray-100 border border-[#1a2b56] rounded-tl-none'
                                }`}
                              >
                                {msg.message}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* QUICK ACTION CHIPS */}
                    <div className="p-2.5 bg-[#060a17] border-t border-[#121e3d] flex items-center space-x-2 overflow-x-auto text-[11px]">
                      <span className="text-gray-500 font-bold shrink-0 text-[10px] uppercase tracking-wider">Quick:</span>
                      <button
                        type="button"
                        onClick={() => handleAdminSendReply('Please send your USDT Deposit TxID / Transaction Hash so our finance team can verify and credit your balance immediately.')}
                        className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-purple-300 hover:text-white rounded-lg border border-purple-500/30 shrink-0 transition"
                      >
                        Request TxID
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdminSendReply('Your deposit has been verified and credited directly to your balance. Thank you for trading with us!')}
                        className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-emerald-300 hover:text-white rounded-lg border border-emerald-500/30 shrink-0 transition"
                      >
                        Deposit Approved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdminSendReply('Your withdrawal request has been approved and processed onto the blockchain. Please check your external wallet.')}
                        className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-blue-300 hover:text-white rounded-lg border border-blue-500/30 shrink-0 transition"
                      >
                        Withdrawal Sent
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdminSendReply('Hello! Welcome to 24/7 VIP Support. How can we assist you today?')}
                        className="px-2.5 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-amber-300 hover:text-white rounded-lg border border-amber-500/30 shrink-0 transition"
                      >
                        Greeting
                      </button>
                    </div>

                    {/* MESSAGE INPUT FORM */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAdminSendReply();
                      }}
                      className="p-3 bg-[#0b1228] border-t border-[#121e3d] flex items-center space-x-2"
                    >
                      <input
                        type="text"
                        value={adminReplyInput}
                        onChange={(e) => setAdminReplyInput(e.target.value)}
                        placeholder={`Type a reply to ${activeChatUserId}...`}
                        className="flex-1 bg-[#060a17] border border-[#1a2b56] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 font-sans"
                      />
                      <button
                        type="submit"
                        disabled={adminSendingReply || !adminReplyInput.trim()}
                        className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-purple-950/50 transition cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{adminSendingReply ? 'Sending...' : 'Reply'}</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-3">
                    <Headphones className="w-12 h-12 text-gray-600 stroke-[1.5]" />
                    <h3 className="text-sm font-bold text-gray-300">Select a Conversation</h3>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Choose any player from the inquiry list on the left to read their messages and send live support replies.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REGISTERED PLAYERS (USER MANAGEMENT) TAB */}
        {portalTab === 'users' && (
          <div className="space-y-4">
            {/* TAB TOP HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0b1228] p-4 rounded-2xl border border-[#1a2b56]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center space-x-2">
                    <span>Registered Players & Accounts Database</span>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold rounded-full">
                      {registeredUsers.length} TOTAL
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    Live record of all player registrations, logins, balances, and account statuses saved on the backend.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {pendingRecoveryCount > 0 && (
                  <button
                    onClick={() => {
                      setPortalTab('recovery');
                      fetchRecoveryRequests();
                    }}
                    className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/50 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 animate-pulse cursor-pointer shadow-lg shadow-red-950/40"
                  >
                    <Key className="w-3.5 h-3.5 text-red-400" />
                    <span>{pendingRecoveryCount} Password Recovery Waiting</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    fetchRegisteredUsers();
                    showToast('Player database refreshed');
                  }}
                  className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 rounded-xl font-bold text-xs border border-[#1a2b56] transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Players</span>
                </button>
              </div>
            </div>

            {/* SUMMARY STATS TILES */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Total Registered Players</span>
                <span className="text-xl font-black text-white font-mono">{usersStats.total}</span>
              </div>
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Active Accounts</span>
                <span className="text-xl font-black text-emerald-400 font-mono">{usersStats.active}</span>
              </div>
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Suspended Accounts</span>
                <span className="text-xl font-black text-red-400 font-mono">{usersStats.suspended}</span>
              </div>
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Total Player Funds</span>
                <span className="text-xl font-black text-amber-400 font-mono">${usersStats.totalBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* SEARCH AND FILTER BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0b1228] p-3 rounded-2xl border border-[#1a2b56]">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Search by Username, Email, or ID..."
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
                {(['all', 'active', 'suspended'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setUserStatusFilter(filter)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition capitalize ${
                      userStatusFilter === filter
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#121e3d] text-gray-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* PLAYERS TABLE */}
            {registeredUsers.length === 0 ? (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                <Users className="w-8 h-8 text-gray-500 mx-auto" />
                <p className="font-bold">No Registered Players in Database Yet</p>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  When new players register via the user Register / Login page, their full account profile, password, balance, and referral data will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Player ID</th>
                        <th className="py-3 px-4">Username & Email</th>
                        <th className="py-3 px-4 text-purple-300 font-bold">Password</th>
                        <th className="py-3 px-4">Registered</th>
                        <th className="py-3 px-4">Last Login</th>
                        <th className="py-3 px-4">Wallet Balance</th>
                        <th className="py-3 px-4">Referral Info</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#121e3d]">
                      {registeredUsers
                        .filter((u) => {
                          const matchesSearch =
                            u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                            u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                            u.id.toLowerCase().includes(userSearchTerm.toLowerCase());
                          const matchesStatus =
                            userStatusFilter === 'all' ? true : u.status === userStatusFilter;
                          return matchesSearch && matchesStatus;
                        })
                        .map((u) => {
                          return (
                            <tr key={u.id} className="hover:bg-[#121e3d]/40 transition">
                              {/* USER ID */}
                              <td className="py-3.5 px-4 font-mono font-bold text-white">
                                <div className="flex items-center space-x-1.5">
                                  <span>{u.id}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(u.id);
                                      showToast('Copied ID!');
                                    }}
                                    className="text-gray-500 hover:text-purple-400"
                                    title="Copy ID"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* USERNAME & EMAIL */}
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-white text-xs">{u.username}</div>
                                <div className="text-[11px] text-gray-400 font-mono">{u.email}</div>
                              </td>

                              {/* PASSWORD */}
                              <td className="py-3.5 px-4 font-mono">
                                <div className="flex items-center space-x-1.5">
                                  <span className="bg-[#060a17] text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-xs font-bold tracking-wider select-all">
                                    {showUserPasswords[u.id] ? (u.password || 'N/A') : (u.password ? '••••••••' : 'None')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(u.id)}
                                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1a2b56] transition cursor-pointer"
                                    title={showUserPasswords[u.id] ? "Hide password" : "Show password"}
                                  >
                                    {showUserPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  {u.password && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(u.password!);
                                        showToast('Copied password!');
                                      }}
                                      className="p-1 text-gray-400 hover:text-purple-400 rounded hover:bg-[#1a2b56] transition cursor-pointer"
                                      title="Copy password"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* REGISTERED DATE */}
                              <td className="py-3.5 px-4 text-[11px] text-gray-400">
                                {new Date(u.registeredAt).toLocaleDateString()}{' '}
                                <span className="text-[10px] text-gray-500">
                                  {new Date(u.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>

                              {/* LAST LOGIN */}
                              <td className="py-3.5 px-4 text-[11px] text-gray-400">
                                {u.lastLoginAt ? (
                                  <>
                                    {new Date(u.lastLoginAt).toLocaleDateString()}{' '}
                                    <span className="text-[10px] text-gray-500">
                                      {new Date(u.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </>
                                ) : (
                                  'Never'
                                )}
                              </td>

                              {/* BALANCE */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono font-black text-amber-400 text-xs">
                                    ${(u.balance || 0).toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setBalanceModalUser(u);
                                      setAdjustBalanceAmount('50');
                                      setAdjustBalanceMode('add');
                                    }}
                                    className="p-1 hover:bg-[#1a2b56] text-gray-400 hover:text-white rounded-lg transition"
                                    title="Adjust player balance"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* REFERRAL */}
                              <td className="py-3.5 px-4 text-[11px]">
                                <div className="font-mono text-purple-300 font-bold">{u.referralCode}</div>
                                {u.referredBy && (
                                  <div className="text-[10px] text-gray-500">Referred by: {u.referredBy}</div>
                                )}
                              </td>

                              {/* STATUS */}
                              <td className="py-3.5 px-4">
                                <button
                                  onClick={() => handleToggleUserStatus(u)}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border transition cursor-pointer ${
                                    u.status === 'active'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                                      : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                                  }`}
                                  title="Click to toggle status"
                                >
                                  {u.status.toUpperCase()}
                                </button>
                              </td>

                              {/* ACTIONS */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  {/* RESET PASSWORD */}
                                  <button
                                    onClick={() => {
                                      setResetPassModalUser(u);
                                      setNewPasswordInput(u.password || '');
                                    }}
                                    className="px-2 py-1 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 rounded-lg text-xs border border-amber-500/30 transition flex items-center space-x-1 cursor-pointer font-bold shadow"
                                    title="Reset / Edit Player Password"
                                  >
                                    <Key className="w-3 h-3 text-amber-400" />
                                    <span>Reset Pass</span>
                                  </button>

                                  {/* SUPPORT CHAT */}
                                  <button
                                    onClick={() => {
                                      setActiveChatUserId(u.id);
                                      setPortalTab('support');
                                      fetchActiveChatMessages(u.id);
                                    }}
                                    className="px-2 py-1 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 rounded-lg text-xs border border-purple-500/30 transition flex items-center space-x-1 cursor-pointer"
                                    title="Open live chat with player"
                                  >
                                    <Headphones className="w-3 h-3" />
                                    <span>Chat</span>
                                  </button>

                                  {/* TOGGLE SUSPEND */}
                                  <button
                                    onClick={() => handleToggleUserStatus(u)}
                                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                      u.status === 'active'
                                        ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border-amber-500/30'
                                        : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-500/30'
                                    }`}
                                    title={u.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                                  >
                                    {u.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* DELETE */}
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-lg border border-red-500/30 transition cursor-pointer"
                                    title="Delete account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASSWORD RECOVERY & ACCOUNT PROOF REQUESTS TAB */}
        {portalTab === 'recovery' && (
          <div className="space-y-4">
            {/* TAB TOP HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0b1228] p-4 rounded-2xl border border-[#1a2b56]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center space-x-2">
                    <span>Password Recovery & Account Ownership Proofs</span>
                    {pendingRecoveryCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold rounded-full animate-pulse">
                        {pendingRecoveryCount} PENDING REVIEW
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Review submitted user verification tickets, compare claimed balances with backend database records, and reset/approve passwords.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    fetchRecoveryRequests();
                    showToast('Recovery requests refreshed');
                  }}
                  className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 rounded-xl font-bold text-xs border border-[#1a2b56] transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Requests</span>
                </button>
              </div>
            </div>

            {/* SUMMARY STATS TILES */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Total Tickets</span>
                <span className="text-xl font-black text-white font-mono">{recoveryRequests.length}</span>
              </div>
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Pending Review</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {recoveryRequests.filter((r) => r.status === 'pending').length}
                </span>
              </div>
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Approved & Reset</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {recoveryRequests.filter((r) => r.status === 'approved').length}
                </span>
              </div>
              <div className="bg-[#0b1228] border border-[#1a2b56] p-3.5 rounded-2xl">
                <span className="text-[11px] text-gray-400 block mb-1 font-medium">Rejected</span>
                <span className="text-xl font-black text-gray-400 font-mono">
                  {recoveryRequests.filter((r) => r.status === 'rejected').length}
                </span>
              </div>
            </div>

            {/* SEARCH AND FILTER BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0b1228] p-3 rounded-2xl border border-[#1a2b56]">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recoverySearchTerm}
                  onChange={(e) => setRecoverySearchTerm(e.target.value)}
                  placeholder="Search by Ticket ID or Username..."
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setRecoveryFilter(filter)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition capitalize ${
                      recoveryFilter === filter
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#121e3d] text-gray-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* RECOVERY REQUESTS TABLE */}
            {recoveryRequests.length === 0 ? (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                <Key className="w-8 h-8 text-gray-500 mx-auto" />
                <p className="font-bold">No Password Recovery Requests Yet</p>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  When a player clicks "Forgot Password?" on the login page and submits their account ownership verification details, their ticket will appear here for review and password approval.
                </p>
              </div>
            ) : (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Ticket ID</th>
                        <th className="py-3 px-4">Claimed Username/Email</th>
                        <th className="py-3 px-4">System Match Record</th>
                        <th className="py-3 px-4">Claimed Balance</th>
                        <th className="py-3 px-4">Proof Slip</th>
                        <th className="py-3 px-4">User Note</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#121e3d]">
                      {recoveryRequests
                        .filter((r) => {
                          const matchesSearch =
                            r.id.toLowerCase().includes(recoverySearchTerm.toLowerCase()) ||
                            r.usernameOrEmail.toLowerCase().includes(recoverySearchTerm.toLowerCase()) ||
                            (r.matchedUsername && r.matchedUsername.toLowerCase().includes(recoverySearchTerm.toLowerCase()));
                          const matchesFilter =
                            recoveryFilter === 'all' ? true : r.status === recoveryFilter;
                          return matchesSearch && matchesFilter;
                        })
                        .map((req) => {
                          return (
                            <tr key={req.id} className="hover:bg-[#121e3d]/40 transition">
                              {/* TICKET ID */}
                              <td className="py-3.5 px-4 font-mono font-bold text-white">
                                <div className="flex items-center space-x-1.5">
                                  <span>{req.id}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(req.id);
                                      showToast('Copied Ticket ID!');
                                    }}
                                    className="text-gray-500 hover:text-purple-400"
                                    title="Copy Ticket ID"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-[10px] text-gray-500 font-sans mt-0.5">
                                  {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>

                              {/* CLAIMED USERNAME / EMAIL */}
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-white text-xs">{req.usernameOrEmail}</div>
                              </td>

                              {/* SYSTEM MATCH RECORD */}
                              <td className="py-3.5 px-4">
                                {req.matchedUserId ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-bold text-emerald-400 text-xs">@{req.matchedUsername}</span>
                                      <span className="text-[10px] text-gray-500 font-mono">({req.matchedUserId})</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                      Real Balance: <span className="font-mono font-bold text-amber-400">${(req.actualBalance ?? 0).toFixed(2)}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 flex items-center space-x-1">
                                      <span>Current Pass:</span>
                                      <span className="font-mono bg-purple-950/60 text-purple-300 px-1 rounded border border-purple-500/30 font-bold">
                                        {req.currentPassword || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-red-400 text-[11px] bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                    No exact account match found
                                  </span>
                                )}
                              </td>

                              {/* CLAIMED BALANCE */}
                              <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                                {req.claimedBalance ? `${req.claimedBalance} USDT` : <span className="text-gray-500 font-sans font-normal text-[11px]">Not provided</span>}
                              </td>

                              {/* PROOF SLIP */}
                              <td className="py-3.5 px-4">
                                {req.depositProofSlip ? (
                                  <button
                                    onClick={() => setPreviewScreenshot(req.depositProofSlip!)}
                                    className="flex items-center space-x-1 text-purple-400 hover:text-purple-300 font-bold text-xs bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-500/30 transition cursor-pointer"
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                    <span>View Slip 🖼️</span>
                                  </button>
                                ) : (
                                  <span className="text-gray-500 text-[11px]">No image attached</span>
                                )}
                              </td>

                              {/* USER NOTE */}
                              <td className="py-3.5 px-4 max-w-xs text-gray-300 text-[11px] truncate">
                                {req.userNotes || <span className="text-gray-600">None</span>}
                              </td>

                              {/* STATUS */}
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${
                                    req.status === 'pending'
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                                      : req.status === 'approved'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                      : 'bg-red-500/20 text-red-400 border-red-500/40'
                                  }`}
                                >
                                  {req.status}
                                </span>
                                {req.status === 'approved' && req.newPassword && (
                                  <div className="mt-1 text-[10px] text-gray-400 font-mono">
                                    Set: <span className="text-emerald-300 font-bold bg-[#060a17] px-1 py-0.2 rounded border border-emerald-500/30">{req.newPassword}</span>
                                  </div>
                                )}
                              </td>

                              {/* ACTIONS */}
                              <td className="py-3.5 px-4 text-right">
                                {req.status === 'pending' ? (
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      onClick={() => {
                                        setRecoveryApproveModal(req);
                                        setApprovePassInput(req.currentPassword || 'Pass786');
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow flex items-center space-x-1 cursor-pointer"
                                      title="Approve verification and set password"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Verify & Reset</span>
                                    </button>
                                    {req.matchedUserId && (
                                      <button
                                        onClick={() => {
                                          setActiveChatUserId(req.matchedUserId!);
                                          setPortalTab('support');
                                          fetchActiveChatMessages(req.matchedUserId!);
                                        }}
                                        className="px-2 py-1 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 rounded-lg text-xs border border-purple-500/30 transition flex items-center space-x-1 cursor-pointer"
                                        title="Chat with user"
                                      >
                                        <Headphones className="w-3 h-3" />
                                        <span>Chat</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (confirm(`Reject recovery request for ${req.usernameOrEmail}?`)) {
                                          handleResolveRecovery(req.id, 'reject');
                                        }
                                      }}
                                      className="p-1 bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-lg border border-red-500/30 transition cursor-pointer"
                                      title="Reject request"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-gray-500">
                                    {req.resolvedAt ? `Resolved on ${new Date(req.resolvedAt).toLocaleDateString()}` : 'Resolved'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOSS / WIN SETTLEMENT LEDGER TAB */}
        {portalTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white flex items-center space-x-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <span>Real-Time Settlement & House Income Ledger</span>
                </h2>
                <p className="text-xs text-gray-400">
                  Every player loss is automatically credited directly to the Admin House Treasury Vault.
                </p>
              </div>
              <button
                onClick={fetchStatus}
                className="px-3 py-1.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 rounded-xl font-bold border border-[#1a2b56] text-xs flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Ledger</span>
              </button>
            </div>

            {ledger.length === 0 ? (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                <History className="w-8 h-8 text-gray-500 mx-auto" />
                <p className="font-bold">No Settled Bets Yet in This Session</p>
                <p className="text-xs text-gray-500">
                  When players place bets and rounds complete, every win and loss will appear here with the exact USDT impact on your Vault.
                </p>
              </div>
            ) : (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Timeframe & Issue</th>
                        <th className="py-3 px-4">Player</th>
                        <th className="py-3 px-4">Choice</th>
                        <th className="py-3 px-4">Bet Amount</th>
                        <th className="py-3 px-4">Result</th>
                        <th className="py-3 px-4 text-right">House Vault Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#121e3d]">
                      {ledger.map((entry) => {
                        const isLoss = entry.result === 'LOSS';
                        return (
                          <tr key={entry.id} className="hover:bg-[#121e3d]/40 transition">
                            <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-white">{entry.timeframe}</span>
                              <span className="text-[10px] text-gray-500 block font-mono">#{entry.issue}</span>
                            </td>
                            <td className="py-3 px-4 font-mono text-gray-300">
                              {entry.userId}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 bg-[#121e3d] text-purple-300 font-bold rounded-md border border-[#1a2b56] text-[11px]">
                                {entry.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              ${entry.amount.toFixed(2)} USDT
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                isLoss
                                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              }`}>
                                {entry.result}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-sm">
                              {isLoss ? (
                                <span className="text-emerald-400 flex items-center justify-end space-x-1">
                                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                                  <span>+${entry.amount.toFixed(2)} USDT (Vault)</span>
                                </span>
                              ) : (
                                <span className="text-red-400 flex items-center justify-end space-x-1">
                                  <ArrowUpRight className="w-4 h-4 text-red-400" />
                                  <span>-${(entry.payout - entry.amount).toFixed(2)} USDT (Payout)</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VAULT WITHDRAWALS TAB */}
        {portalTab === 'vault' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  <span>Admin Vault Cashout Records</span>
                </h2>
                <p className="text-xs text-gray-400">
                  History of funds withdrawn from the House Vault directly to your personal crypto wallet.
                </p>
              </div>

              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold rounded-xl text-xs shadow-lg flex items-center space-x-1.5 transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>New Withdrawal</span>
              </button>
            </div>

            {withdrawals.length === 0 ? (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl p-12 text-center text-gray-400 space-y-2">
                <Wallet className="w-8 h-8 text-gray-500 mx-auto" />
                <p className="font-bold">No Vault Withdrawals Yet</p>
                <p className="text-xs text-gray-500">
                  Click "Withdraw Vault Funds" above to withdraw your accumulated balance.
                </p>
              </div>
            ) : (
              <div className="bg-[#0b1228] border border-[#1a2b56] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#060a17] border-b border-[#121e3d] text-gray-400 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Transaction ID</th>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Destination Address</th>
                        <th className="py-3 px-4">Network</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#121e3d]">
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-[#121e3d]/40 transition">
                          <td className="py-3 px-4 font-mono font-bold text-amber-300 text-xs">
                            {w.id}
                          </td>
                          <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                            {new Date(w.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-300">
                            {w.address}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-[#121e3d] text-blue-300 font-bold rounded text-[11px]">
                              {w.network}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                            ${w.amount.toFixed(2)} USDT
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full">
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* WITHDRAW VAULT FUNDS MODAL */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] border border-amber-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Withdraw House Vault Funds</h3>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#060a17] p-3 rounded-2xl border border-[#1a2b56] flex items-center justify-between">
              <span className="text-xs text-gray-400">Available Vault Balance:</span>
              <span className="text-lg font-black text-amber-400 font-mono">
                ${houseVaultBalance.toFixed(2)} USDT
              </span>
            </div>

            <form onSubmit={handleVaultWithdrawSubmit} className="space-y-3.5">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Withdrawal Amount (USDT):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2.5 text-base text-white font-mono outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(houseVaultBalance.toFixed(2))}
                    className="absolute right-2 top-2 px-2 py-1 bg-[#121e3d] hover:bg-[#1a2b56] text-amber-300 font-bold rounded-lg text-[10px]"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Crypto Network:</label>
                <select
                  value={withdrawNetwork}
                  onChange={(e) => setWithdrawNetwork(e.target.value)}
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="USDT-TRC20">USDT (TRC20 - Tron Network)</option>
                  <option value="USDT-BEP20">USDT (BEP20 - BNB Smart Chain)</option>
                  <option value="USDT-ERC20">USDT (ERC20 - Ethereum)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Destination Wallet Address:</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="e.g. T9yD14Nj9j7xAB4dbGeiX9h8unk..."
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              {withdrawError && (
                <p className="text-xs text-red-400 font-semibold">{withdrawError}</p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawSubmitting}
                  className="py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold rounded-xl text-xs shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {withdrawSubmitting ? 'Transferring...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALIBRATE & RESET VAULT STATS MODAL */}
      {calibrateModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] border border-purple-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">Calibrate Vault & Bet Metrics</h3>
              </div>
              <button
                onClick={() => setCalibrateModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#060a17] rounded-xl border border-[#121e3d] text-[11px] text-gray-300 space-y-1">
              <p>
                <strong className="text-emerald-400">Player Losses Collected:</strong> Automatically increases whenever players lose bets in any round.
              </p>
              <p>
                <strong className="text-red-400">Player Wins Paid Out:</strong> Automatically increases whenever players win payouts from bets.
              </p>
              <p className="text-gray-400 text-[10px] pt-1">
                You can manually calibrate these numbers or wipe them clean to zero below:
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCalibrateVaultStats(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] text-gray-400 block mb-1 font-medium">House Vault Balance (USDT)</label>
                <input
                  type="number"
                  step="any"
                  value={calibVaultInput}
                  onChange={(e) => setCalibVaultInput(e.target.value)}
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">Player Losses Collected (USDT)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={calibLossInput}
                    onChange={(e) => setCalibLossInput(e.target.value)}
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono outline-none focus:border-emerald-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1 font-medium">Player Wins Paid Out (USDT)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={calibWinInput}
                    onChange={(e) => setCalibWinInput(e.target.value)}
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-xs text-red-400 font-mono outline-none focus:border-red-500 font-bold"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center space-x-2 text-[11px] text-gray-400 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={calibClearLedger}
                  onChange={(e) => setCalibClearLedger(e.target.checked)}
                  className="rounded border-[#1a2b56] text-purple-600 focus:ring-0"
                />
                <span>Also wipe settlement ledger history</span>
              </label>

              <div className="pt-2 flex flex-col space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCalibrateModalOpen(false)}
                    className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={calibSubmitting}
                    className="py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {calibSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={calibSubmitting}
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all Vault stats and bet totals back to $0.00?')) {
                      handleCalibrateVaultStats(true);
                    }
                  }}
                  className="w-full py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-bold rounded-xl text-xs transition cursor-pointer active:scale-95"
                >
                  Reset All Stats to $0.00
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSCODE MODAL */}
      {changePasscodeModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] border border-purple-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-sm">Change Master Passcode</h3>
              </div>
              <button
                onClick={() => setChangePasscodeModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePasscodeSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Current Passcode:</label>
                <input
                  type="password"
                  value={currentPasscode}
                  onChange={(e) => setCurrentPasscode(e.target.value)}
                  placeholder="Enter current passcode"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">New Passcode:</label>
                <input
                  type="password"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Confirm New Passcode:</label>
                <input
                  type="password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Re-enter new passcode"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-purple-500"
                />
              </div>

              {passcodeModalError && (
                <p className="text-xs text-red-400 font-semibold">{passcodeModalError}</p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePasscodeModalOpen(false)}
                  className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-gray-300 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passcodeSubmitting}
                  className="py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {passcodeSubmitting ? 'Saving...' : 'Save Passcode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT & VERIFY TXID MODAL */}
      {inspectDeposit && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1228] border border-indigo-500/40 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Verify Blockchain Deposit (TxID)</h3>
              </div>
              <button
                onClick={() => setInspectDeposit(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#060a17] p-3 rounded-xl border border-[#121e3d]">
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Player UID</span>
                  <span className="font-mono font-bold text-purple-300 text-sm">{inspectDeposit.userId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Network</span>
                  <span className="font-bold text-emerald-400">{inspectDeposit.network}</span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-gray-500 block uppercase">Requested Amount</span>
                  <span className="font-mono font-bold text-yellow-300 text-sm">+${inspectDeposit.amount.toFixed(2)} USDT</span>
                </div>
                <div className="mt-1">
                  <span className="text-[10px] text-gray-500 block uppercase">Current Status</span>
                  <span className="font-bold text-amber-400">{inspectDeposit.status}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1 font-semibold">
                  Official Receiver Address:
                </label>
                <div className="flex items-center space-x-2 bg-[#060a17] p-2.5 rounded-xl border border-[#1a2b56]">
                  <span className="font-mono text-gray-300 text-xs truncate flex-1">
                    {inspectDeposit.depositAddress || 'TYu982aXzQkL90123mK912pLq10293'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inspectDeposit.depositAddress || 'TYu982aXzQkL90123mK912pLq10293');
                      showToast('Receiver address copied!');
                    }}
                    className="p-1 text-gray-400 hover:text-white bg-[#121e3d] rounded"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1 font-semibold">
                  Transaction Hash / TxID:
                </label>
                <div className="flex items-center space-x-2 bg-[#060a17] p-2.5 rounded-xl border border-[#1a2b56]">
                  <span className="font-mono text-purple-300 text-xs break-all flex-1">
                    {inspectDeposit.txHash}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inspectDeposit.txHash);
                      showToast('TxID copied!');
                    }}
                    className="p-1 text-gray-400 hover:text-white bg-[#121e3d] rounded shrink-0"
                    title="Copy TxID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* DEPOSIT SLIP SCREENSHOT PROOF */}
              {inspectDeposit.screenshot && (
                <div className="bg-[#060a17] border border-purple-500/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center space-x-1.5">
                      <Image className="w-4 h-4 text-purple-400" />
                      <span>Uploaded Deposit Screenshot</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewScreenshot(inspectDeposit.screenshot || null)}
                      className="text-[10px] text-purple-300 hover:text-white font-bold bg-purple-900/40 px-2 py-1 rounded border border-purple-500/40"
                    >
                      Enlarge Image 🔍
                    </button>
                  </div>
                  <div
                    onClick={() => setPreviewScreenshot(inspectDeposit.screenshot || null)}
                    className="relative cursor-pointer group overflow-hidden rounded-lg border border-[#1a2b56] bg-black/40 flex items-center justify-center max-h-56"
                  >
                    <img
                      src={inspectDeposit.screenshot}
                      alt="Deposit Slip"
                      className="w-full h-auto max-h-56 object-contain group-hover:scale-105 transition duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white font-bold">
                      Click to Open Full Size
                    </div>
                  </div>
                </div>
              )}

              {/* 1-CLICK BLOCKCHAIN VERIFICATION (IF TXHASH EXISTS) */}
              {inspectDeposit.txHash && !inspectDeposit.txHash.startsWith('PROOF-IMG') && (
                <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-200 text-xs flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Live Blockchain Verification</span>
                    </span>
                    <a
                      href={
                        inspectDeposit.network === 'BEP20'
                          ? `https://bscscan.com/tx/${inspectDeposit.txHash}`
                          : `https://tronscan.org/#/transaction/${inspectDeposit.txHash}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow transition"
                    >
                      <span>Check on {inspectDeposit.network === 'BEP20' ? 'BscScan' : 'TronScan'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-[10px] text-purple-300/80">
                    Click the button above to view public blockchain proof: check if status is <strong>SUCCESS</strong> and exact USDT was sent to your wallet.
                  </p>
                </div>
              )}

              {/* OPTIONAL AMOUNT ADJUSTMENT */}
              {inspectDeposit.status === 'Pending' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-gray-400 font-semibold">Amount to Credit (USDT):</label>
                    <span className="text-[10px] text-gray-500">Edit if received amount is different</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={customCreditAmount}
                    onChange={(e) => setCustomCreditAmount(e.target.value)}
                    className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
              )}
            </div>

            {inspectDeposit.status === 'Pending' ? (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={actionLoadingId === inspectDeposit.id}
                  onClick={() => handleDepositAction(inspectDeposit.id, 'reject')}
                  className="py-2.5 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition disabled:opacity-50"
                >
                  Reject Deposit
                </button>
                <button
                  type="button"
                  disabled={actionLoadingId === inspectDeposit.id}
                  onClick={() => {
                    const finalAmt = parseFloat(customCreditAmount) || inspectDeposit.amount;
                    handleDepositAction(inspectDeposit.id, 'approve', finalAmt);
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Credit Balance</span>
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setInspectDeposit(null)}
                  className="w-full py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-white font-bold rounded-xl text-xs transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PLAYER BALANCE ADJUSTMENT MODAL */}
      {balanceModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] rounded-3xl border border-[#1a2b56] max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#121e3d]">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Adjust Player Balance</h3>
              </div>
              <button
                onClick={() => setBalanceModalUser(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#060a17] p-3 rounded-xl border border-[#1a2b56] space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Player:</span>
                <span className="text-white font-bold">{balanceModalUser.username}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>User ID:</span>
                <span className="font-mono text-purple-300">{balanceModalUser.id}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Current Balance:</span>
                <span className="font-mono font-bold text-amber-400">${(balanceModalUser.balance || 0).toFixed(2)} USDT</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Adjustment Action:</label>
                <div className="grid grid-cols-3 gap-1.5 bg-[#060a17] p-1 rounded-xl border border-[#1a2b56]">
                  <button
                    type="button"
                    onClick={() => setAdjustBalanceMode('add')}
                    className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      adjustBalanceMode === 'add' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustBalanceMode('subtract')}
                    className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      adjustBalanceMode === 'subtract' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    - Deduct
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustBalanceMode('set')}
                    className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      adjustBalanceMode === 'set' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    = Set Exact
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Amount (USDT):</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustBalanceAmount}
                  onChange={(e) => setAdjustBalanceAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-purple-500 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBalanceModalUser(null)}
                className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustBalance}
                className="py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-950/50 cursor-pointer"
              >
                Apply Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SIZE SCREENSHOT VIEWER MODAL */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#0b1228] border border-purple-500/50 rounded-3xl p-4 shadow-2xl flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Image className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Deposit Proof Screenshot</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#121e3d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/50 rounded-2xl p-2">
              <img
                src={previewScreenshot}
                alt="Deposit Screenshot Full Size"
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>
            <div className="mt-3 flex justify-between items-center text-xs text-gray-400">
              <span>Verify transaction details: Amount, Timestamp, and Recipient Wallet Address</span>
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DIRECT USER PASSWORD RESET MODAL */}
      {resetPassModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Reset User Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetPassModalUser(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#121e3d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#060a17] p-3 rounded-xl border border-[#1a2b56] text-xs space-y-1">
                <div className="text-gray-400">Target Player:</div>
                <div className="font-bold text-white text-sm">@{resetPassModalUser.username}</div>
                <div className="text-gray-500 font-mono text-[11px]">{resetPassModalUser.email} (ID: {resetPassModalUser.id})</div>
                <div className="text-gray-400 pt-1">
                  Current Saved Password: <span className="font-mono text-purple-300 font-bold bg-[#0b1228] px-1.5 py-0.5 rounded border border-purple-500/30">{resetPassModalUser.password || 'None'}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Enter New Password for Player:</label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="e.g. Winner786 or User@2026"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-amber-500 font-bold"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  This directly updates the account's password in the system. The user will be able to log in immediately with this password.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setResetPassModalUser(null)}
                className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResettingPass || !newPasswordInput.trim()}
                onClick={handleAdminUpdatePassword}
                className="py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-amber-950/50 cursor-pointer flex items-center justify-center space-x-1"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{isResettingPass ? 'Saving...' : 'Update Password'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECOVERY APPROVAL & PASSWORD ASSIGNMENT MODAL */}
      {recoveryApproveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1228] border border-emerald-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#121e3d] pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Approve Recovery & Set Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryApproveModal(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#121e3d]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#060a17] p-3 rounded-xl border border-[#1a2b56] text-xs space-y-1.5">
                <div className="text-gray-400">Ticket: <span className="font-mono text-purple-300 font-bold">{recoveryApproveModal.id}</span></div>
                <div className="text-gray-300">Claimant: <span className="font-bold text-white">{recoveryApproveModal.usernameOrEmail}</span></div>
                {recoveryApproveModal.matchedUsername && (
                  <div className="text-emerald-400 font-bold">
                    System Account Match: @{recoveryApproveModal.matchedUsername} (Balance: ${(recoveryApproveModal.actualBalance ?? 0).toFixed(2)})
                  </div>
                )}
                {recoveryApproveModal.claimedBalance && (
                  <div className="text-amber-400">
                    Claimed Balance: {recoveryApproveModal.claimedBalance} USDT
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Set New Password to Deliver to User:</label>
                <input
                  type="text"
                  value={approvePassInput}
                  onChange={(e) => setApprovePassInput(e.target.value)}
                  placeholder="e.g. Pass786"
                  className="w-full bg-[#060a17] border border-[#1a2b56] rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500 font-bold"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Once approved, the user's account password will update to this value immediately, and their recovery screen will show this new password.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRecoveryApproveModal(null)}
                className="py-2.5 bg-[#121e3d] hover:bg-[#1a2b56] text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!approvePassInput.trim()}
                onClick={() => handleResolveRecovery(recoveryApproveModal.id, 'approve', approvePassInput.trim())}
                className="py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-950/50 cursor-pointer flex items-center justify-center space-x-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Set Password</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b1228] border border-purple-500 text-white px-4 py-2.5 rounded-2xl text-xs shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="font-bold">{notification}</span>
        </div>
      )}
    </div>
  );
};
