'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ApiClient } from '@/lib/api';
import { Shield, Wallet, Send, ArrowLeft, Activity, Zap, Database, Bot, Lock, Eye, EyeOff, TrendingUp, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  
  // Wallet state
  const [userWallet, setUserWallet] = useState('');
  const [companyWallet, setCompanyWallet] = useState('');
  const [companyMnemonic, setCompanyMnemonic] = useState('');
  
  // Request form state
  const [dataType, setDataType] = useState('location');
  const [purpose, setPurpose] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<'human_reviewed' | 'agent_to_agent'>('human_reviewed');
  
  // Loading state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Data assets state
  type PrefValue = 'allowed' | 'restricted' | 'blocked';
  const DATA_TYPES: { key: string; label: string; icon: string }[] = [
    { key: 'location',    label: 'Location Data',       icon: '📍' },
    { key: 'browsing',    label: 'Browsing History',     icon: '🌐' },
    { key: 'purchase',    label: 'Purchase History',     icon: '🛒' },
    { key: 'behavior',    label: 'Behavioral Data',      icon: '📊' },
    { key: 'demographic', label: 'Demographic Data',     icon: '👤' },
    { key: 'health',      label: 'Health Data',          icon: '🏥' },
    { key: 'financial',   label: 'Financial Data',       icon: '💰' },
  ];
  const DEFAULT_PREFS: Record<string, PrefValue> = {
    location: 'allowed', browsing: 'allowed', purchase: 'allowed',
    behavior: 'allowed', demographic: 'allowed', health: 'blocked', financial: 'blocked',
  };
  const [preferences, setPreferences]   = useState<Record<string, PrefValue>>(DEFAULT_PREFS);
  const [earnings, setEarnings]         = useState<{ total: number; byDataType: Record<string, number> }>({ total: 0, byDataType: {} });
  const [prefSaving, setPrefSaving]     = useState(false);
  const [prefSaved, setPrefSaved]       = useState(false);

  // Analytics state
  type AnalyticsRow = { dataType: string; totalEarnings: number; count: number; avgPrice: number; maxPrice: number; minPrice: number };
  const [analytics, setAnalytics] = useState<{
    grandTotal: number; totalRecords: number; mostValuable: string | null;
    highestAvg: string | null; table: AnalyticsRow[];
  }>({ grandTotal: 0, totalRecords: 0, mostValuable: null, highestAvg: null, table: [] });

  // Recent activity state
  type ActivityRecord = {
    requestId: string; companyWallet: string; dataType: string; purpose: string;
    consentStatus: string; price: number; timestamp: string;
    paymentTxId: string | null; appCallTxId: string | null; mode: string | null;
  };
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);

  // Load saved wallets from localStorage
  useEffect(() => {
    const savedUserWallet = localStorage.getItem('userWallet');
    const savedCompanyWallet = localStorage.getItem('companyWallet');
    const savedCompanyMnemonic = localStorage.getItem('companyMnemonic');
    
    if (savedUserWallet) setUserWallet(savedUserWallet);
    if (savedCompanyWallet) setCompanyWallet(savedCompanyWallet);
    if (savedCompanyMnemonic) setCompanyMnemonic(savedCompanyMnemonic);

    // Load data preferences (localStorage first, then backend)
    const localPrefs = localStorage.getItem('dataPreferences');
    if (localPrefs) {
      try { setPreferences(JSON.parse(localPrefs)); } catch { /* ignore */ }
    }

    // Load earnings if wallet is set
    if (savedUserWallet) {
      ApiClient.getEarnings(savedUserWallet).then(res => {
        if (res.success) setEarnings({ total: res.total, byDataType: res.byDataType ?? {} });
      }).catch(() => {});
      // Also try to load preferences from backend
      ApiClient.getDataPreferences(savedUserWallet).then(res => {
        if (res.success && res.source !== 'default') {
          setPreferences(res.preferences);
          localStorage.setItem('dataPreferences', JSON.stringify(res.preferences));
        }
      }).catch(() => {});
    }

    // Load global analytics (not wallet-specific)
    ApiClient.getAnalytics().then(res => {
      if (res.success) {
        setAnalytics({
          grandTotal:   res.grandTotal   ?? 0,
          totalRecords: res.totalRecords ?? 0,
          mostValuable: res.mostValuable ?? null,
          highestAvg:   res.highestAvg   ?? null,
          table:        res.table        ?? [],
        });
      }
    }).catch(() => {});

    // Load recent activity for the user wallet (if set)
    if (savedUserWallet) {
      ApiClient.getRecentActivity(savedUserWallet, 10).then(res => {
        if (res.success) setRecentActivity(res.records ?? []);
      }).catch(() => {});
    }
  }, []);

  // Save wallets to localStorage
  const saveWallets = () => {
    localStorage.setItem('userWallet', userWallet);
    localStorage.setItem('companyWallet', companyWallet);
    localStorage.setItem('companyMnemonic', companyMnemonic);
    alert('Wallet configuration saved!');
  };

  // Toggle a data type preference cycling: allowed → restricted → blocked → allowed
  const cyclePreference = (key: string) => {
    const cycle: PrefValue[] = ['allowed', 'restricted', 'blocked'];
    const current = preferences[key] ?? 'allowed';
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    setPreferences(prev => ({ ...prev, [key]: next }));
  };

  // Save preferences to localStorage + backend
  const savePreferences = async () => {
    setPrefSaving(true);
    localStorage.setItem('dataPreferences', JSON.stringify(preferences));
    if (userWallet) {
      await ApiClient.saveDataPreferences(userWallet, preferences).catch(() => {});
    }
    setPrefSaving(false);
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2000);
  };

  // Handle request submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!purpose || !price) {
      setError('Please fill in all fields');
      return;
    }

    if (parseFloat(price) <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'agent_to_agent') {
        const userWallet      = localStorage.getItem('userWallet')      || '';
        const companyWallet   = localStorage.getItem('companyWallet')   || '';
        const companyMnemonic = localStorage.getItem('companyMnemonic') || '';

        if (!userWallet || !companyWallet || !companyMnemonic) {
          setError('Agent-to-agent mode requires wallet configuration');
          setSubmitting(false);
          return;
        }

        const response = await ApiClient.createRequestAuto(
          dataType, parseFloat(price), purpose,
          userWallet, companyWallet, companyMnemonic
        );

        if (response.success && response.paymentExecuted && response.txId) {
          // Store proof data for the result page before navigating
          sessionStorage.setItem(`proof_${response.txId}`, JSON.stringify(response));
          router.push(`/transaction/${response.txId}`);
        } else if (response.success) {
          // Rejected by policy engine — show result
          setError(`Agent decision: ${response.decision} — ${response.justification}`);
        } else {
          setError(response.message || 'Auto-execution failed');
        }
        return;
      }

      const response = await ApiClient.createRequest(dataType, parseFloat(price), purpose);

      if (response.success) {
        // Navigate to request approval page
        router.push(`/request/${response.requestId}`);
      } else {
        setError(response.message || 'Failed to create request');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="bg-animated-gradient" />
      <div className="bg-grid" />

      {/* Header */}
      <header className="border-b border-blue-500/20 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Shield className="h-6 w-6 text-blue-400" />
                <div className="absolute inset-0 h-6 w-6 bg-blue-400/20 rounded-full blur-md" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                DataDAO India
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/50">
            <Activity className="h-3 w-3 mr-2" />
            Control Center
          </Badge>
          <Link href="/query">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Database className="h-4 w-4 mr-2" />Query
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Data Request Control Center</h1>
          <p className="text-gray-400">Configure wallets, create requests, and monitor AI decisions</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Wallet Configuration */}
          <div className="glass rounded-xl p-6 gradient-border hover-card">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Wallet className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Wallet Configuration</h2>
                <p className="text-sm text-gray-400">Algorand testnet setup</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">User Wallet Address</label>
                <Input
                  value={userWallet}
                  onChange={(e) => setUserWallet(e.target.value)}
                  placeholder="Enter your Algorand wallet address"
                  className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-600"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Company Wallet Address</label>
                <Input
                  value={companyWallet}
                  onChange={(e) => setCompanyWallet(e.target.value)}
                  placeholder="Enter company wallet address"
                  className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Company Wallet Mnemonic</label>
                <Input
                  value={companyMnemonic}
                  onChange={(e) => setCompanyMnemonic(e.target.value)}
                  placeholder="Enter company wallet mnemonic (for signing)"
                  type="password"
                  className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for transaction signing. Keep this secure.
                </p>
              </div>

              <Button onClick={saveWallets} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400">
                <Wallet className="mr-2 h-4 w-4" />
                Save Wallet Configuration
              </Button>
            </div>
          </div>

          {/* Create Data Request */}
          <div className="glass rounded-xl p-6 gradient-border hover-card">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <Send className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create Data Request</h2>
                <p className="text-sm text-gray-400">Submit for AI evaluation</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Data Type</label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-white ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="location">Location Data</option>
                  <option value="browsing">Browsing History</option>
                  <option value="purchase">Purchase History</option>
                  <option value="behavior">Behavioral Data</option>
                  <option value="demographic">Demographic Data</option>
                  <option value="health">Health Data (Sensitive)</option>
                  <option value="financial">Financial Data (Sensitive)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Purpose</label>
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Market research, Analytics"
                  className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Price (ALGO)</label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter offered price in ALGO"
                  step="0.01"
                  min="0"
                  className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-600"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Mode toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 text-purple-400" />
                  <div>
                    <p className="text-sm text-white font-medium">Agent-to-Agent</p>
                    <p className="text-xs text-gray-500">Auto evaluate &amp; execute</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMode(m => m === 'human_reviewed' ? 'agent_to_agent' : 'human_reviewed')}
                  aria-label="Toggle agent-to-agent mode"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    mode === 'agent_to_agent' ? 'bg-purple-500' : 'bg-gray-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mode === 'agent_to_agent' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 btn-shine">
                {submitting ? (
                  <>
                    <Activity className="mr-2 h-4 w-4 animate-spin" />
                    Creating Request...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Submit Request
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* ── My Data Assets ──────────────────────────────────────────── */}
        <div className="mt-8 glass rounded-xl p-6 gradient-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Lock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">My Data Assets</h2>
                <p className="text-xs text-gray-500">Control which data types you allow companies to request</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">allowed</span>
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">restricted</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300">blocked</span>
              </div>
              <Button
                onClick={savePreferences}
                disabled={prefSaving}
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1.5"
              >
                {prefSaved ? '✓ Saved' : prefSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DATA_TYPES.map(({ key, label, icon }) => {
              const pref = preferences[key] ?? 'allowed';
              const earned = earnings.byDataType[key] ?? 0;
              const statusStyle: Record<string, string> = {
                allowed:    'border-emerald-500/40 bg-emerald-500/10',
                restricted: 'border-yellow-500/40 bg-yellow-500/10',
                blocked:    'border-red-500/40 bg-red-500/10',
              };
              const badgeStyle: Record<string, string> = {
                allowed:    'bg-emerald-500/20 text-emerald-300',
                restricted: 'bg-yellow-500/20 text-yellow-300',
                blocked:    'bg-red-500/20 text-red-300',
              };
              return (
                <div key={key} className={`p-4 rounded-xl border ${statusStyle[pref]} transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm font-medium text-white">{label}</span>
                    </div>
                    <button
                      onClick={() => cyclePreference(key)}
                      aria-label={`Toggle ${label} preference`}
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeStyle[pref]} hover:opacity-80 transition-opacity`}
                    >
                      {pref}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Earned</span>
                    <span className="text-sm font-bold text-white">{earned > 0 ? `${earned} ALGO` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Click a badge to cycle: allowed → restricted → blocked. Blocked types are auto-rejected by the AI. Restricted types raise the risk level.
          </p>
        </div>

        {/* ── Total Earnings ───────────────────────────────────────────── */}
        <div className="mt-4 glass rounded-xl p-6 gradient-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Total Earnings</h2>
                <p className="text-xs text-gray-500">
                  {userWallet ? `Aggregated from approved consent records for your wallet` : 'Save your wallet address to see earnings'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                {earnings.total > 0 ? `${earnings.total} ALGO` : '0 ALGO'}
              </p>
              {earnings.total > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  across {Object.keys(earnings.byDataType).length} data type{Object.keys(earnings.byDataType).length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {earnings.total === 0 && (
            <p className="text-xs text-gray-600 mt-3">
              Earnings appear here after approved consent records are executed on-chain.
            </p>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 glass rounded-xl p-6 gradient-border">
          <div className="flex items-center space-x-3 mb-6">
            <Database className="h-6 w-6 text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">System Workflow</h2>
              <p className="text-sm text-gray-400">Understanding the DataDAO India execution flow</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-blue-500/30 flex items-center justify-center text-white font-bold">1</div>
                <h3 className="font-semibold text-white">Submit Request</h3>
              </div>
              <p className="text-sm text-gray-400">
                Company creates a data request specifying type, purpose, and offered price
              </p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-purple-500/30 flex items-center justify-center text-white font-bold">2</div>
                <h3 className="font-semibold text-white">AI Evaluation</h3>
              </div>
              <p className="text-sm text-gray-400">
                AI agent evaluates the request using rules and LLM reasoning (2-3 seconds)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-white font-bold">3</div>
                <h3 className="font-semibold text-white">Blockchain Execution</h3>
              </div>
              <p className="text-sm text-gray-400">
                Approved requests trigger Algorand smart contract with on-chain compliance proof
              </p>
            </div>
          </div>
        </div>

        {/* ── Recent Data Access Activity ──────────────────────────────── */}
        <div className="mt-6 glass rounded-xl p-6 gradient-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Activity className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Recent Data Access Activity</h2>
                <p className="text-xs text-gray-500">
                  {userWallet ? 'Latest companies that accessed your data' : 'Save your wallet address to see activity'}
                </p>
              </div>
            </div>
            {recentActivity.length > 0 && (
              <span className="text-xs text-gray-500">{recentActivity.length} record{recentActivity.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              {userWallet
                ? 'No activity yet. Records appear after the first consent execution.'
                : 'Configure your wallet address above to see activity.'}
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((rec, i) => {
                const approved = rec.consentStatus === 'approved';
                const shortWallet = rec.companyWallet
                  ? `${rec.companyWallet.slice(0, 8)}…${rec.companyWallet.slice(-6)}`
                  : 'Unknown';
                const timeAgo = (() => {
                  if (!rec.timestamp) return '—';
                  const diff = Date.now() - new Date(rec.timestamp).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })();

                return (
                  <div key={rec.requestId ?? i}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    {/* Left: company + data type */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${approved ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-mono text-blue-400 truncate" title={rec.companyWallet}>
                          {shortWallet}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{rec.dataType} · {rec.purpose ? rec.purpose.slice(0, 30) : '—'}</p>
                      </div>
                    </div>

                    {/* Middle: status badge */}
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${
                      approved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {rec.consentStatus}
                    </span>

                    {/* Right: price + time */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">{approved ? `${rec.price} ALGO` : '—'}</p>
                      <p className="text-xs text-gray-600">{timeAgo}</p>
                    </div>

                    {/* Explorer link if tx exists */}
                    {rec.paymentTxId && (
                      <a
                        href={`https://testnet.explorer.perawallet.app/tx/${rec.paymentTxId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                        title="View on explorer"
                      >
                        <Database className="h-3.5 w-3.5 text-blue-400" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Data Value Analytics ─────────────────────────────────────── */}
        <div className="mt-6 glass rounded-xl p-6 gradient-border">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Data Value Analytics</h2>
                <p className="text-xs text-gray-500">Aggregated from all approved consent records</p>
              </div>
            </div>
            {analytics.totalRecords > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">{analytics.totalRecords} approved record{analytics.totalRecords !== 1 ? 's' : ''}</p>
                <p className="text-lg font-bold text-emerald-400">{analytics.grandTotal} ALGO total</p>
              </div>
            )}
          </div>

          {analytics.totalRecords === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              No approved consent records yet. Analytics will appear after the first on-chain execution.
            </div>
          ) : (
            <>
              {/* Summary highlight cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Grand Total</p>
                  <p className="text-xl font-bold text-emerald-400">{analytics.grandTotal} ALGO</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Records</p>
                  <p className="text-xl font-bold text-blue-400">{analytics.totalRecords}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Most Valuable</p>
                  <p className="text-sm font-bold text-purple-300 capitalize">{analytics.mostValuable ?? '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                  <p className="text-xs text-gray-500 uppercase mb-1">Highest Avg</p>
                  <p className="text-sm font-bold text-yellow-300 capitalize">{analytics.highestAvg ?? '—'}</p>
                </div>
              </div>

              {/* Per-type table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-xs text-gray-500 uppercase pb-2 pr-4">Data Type</th>
                      <th className="text-right text-xs text-gray-500 uppercase pb-2 px-3">Records</th>
                      <th className="text-right text-xs text-gray-500 uppercase pb-2 px-3">Total (ALGO)</th>
                      <th className="text-right text-xs text-gray-500 uppercase pb-2 px-3">Avg (ALGO)</th>
                      <th className="text-right text-xs text-gray-500 uppercase pb-2 pl-3">Max (ALGO)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.table.map((row, i) => {
                      const isTop = i === 0;
                      // Bar width relative to the top earner
                      const maxTotal = analytics.table[0]?.totalEarnings || 1;
                      const barPct   = Math.round((row.totalEarnings / maxTotal) * 100);
                      return (
                        <tr key={row.dataType} className="border-b border-gray-800/50 last:border-0">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium capitalize ${isTop ? 'text-emerald-300' : 'text-gray-300'}`}>
                                {row.dataType}
                              </span>
                              {isTop && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">top</span>
                              )}
                            </div>
                            {/* Inline bar */}
                            <div className="mt-1 h-1 rounded-full bg-gray-800 w-full max-w-[120px]">
                              <div
                                className={`h-1 rounded-full ${isTop ? 'bg-emerald-500' : 'bg-blue-500/60'}`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-400">{row.count}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-white">{row.totalEarnings}</td>
                          <td className="py-2.5 px-3 text-right text-gray-300">{row.avgPrice}</td>
                          <td className="py-2.5 pl-3 text-right text-gray-400">{row.maxPrice}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Live Contract Status */}
        <div className="mt-6 glass rounded-xl p-6 gradient-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">ConsentContract — Live on Algorand TestNet</h2>
                <p className="text-xs text-gray-500">PyTeal smart contract storing immutable consent proofs on-chain</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-emerald-400 rounded-full pulse-glow" />
              <span className="text-xs text-emerald-400 font-semibold">DEPLOYED</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-700">
              <p className="text-xs text-gray-500 uppercase mb-1">App ID</p>
              <p className="text-sm font-mono text-blue-400 font-bold">758667150</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-700">
              <p className="text-xs text-gray-500 uppercase mb-1">Network</p>
              <p className="text-sm text-white">Algorand TestNet</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-700">
              <p className="text-xs text-gray-500 uppercase mb-1">On-chain fields</p>
              <p className="text-sm text-white">request_id · status · price · hash · timestamp</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://testnet.explorer.perawallet.app/application/758667150"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm font-medium transition-colors"
            >
              <Shield className="h-4 w-4" />
              View Contract on Explorer
            </a>
            <Link href="/query">
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-sm font-medium transition-colors">
                <Database className="h-4 w-4" />
                Query Consent Records
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
