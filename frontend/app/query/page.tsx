'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ApiClient } from '@/lib/api';
import {
  Shield, ArrowLeft, Search, Loader2, Database,
  CheckCircle, XCircle, Clock, Brain, Lock, DollarSign
} from 'lucide-react';

// ── Example chips ─────────────────────────────────────────────────────────────

const EXAMPLES = [
  'latest consent transaction',
  'latest 5 consent transactions',
  'approved requests',
  'rejected requests',
  'payments for location',
  'agent_to_agent transactions',
  'high risk decisions',
  'decisions by ai',
  'decisions by rules',
  'all transactions',
  'all requests',
];

// ── Field helpers ─────────────────────────────────────────────────────────────

function truncate(s: string | null | undefined, n = 20) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmt(val: any): string {
  if (val == null) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── Card components ───────────────────────────────────────────────────────────

function ConsentCard({ r }: { r: any }) {
  const approved = r.consent_status === 'approved' || r.consentStatus === 'approved';
  return (
    <div className="glass rounded-xl p-5 gradient-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Consent Record</span>
        </div>
        <Badge className={approved
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
          : 'bg-red-500/20 text-red-300 border-red-500/50'}>
          {approved ? <><CheckCircle className="h-3 w-3 mr-1 inline" />APPROVED</> : <><XCircle className="h-3 w-3 mr-1 inline" />REJECTED</>}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-500">Request ID</span>
        <span className="font-mono text-blue-400 truncate" title={r.request_id ?? r.requestId}>{truncate(r.request_id ?? r.requestId, 24)}</span>
        <span className="text-gray-500">Data Type</span>
        <span className="text-gray-300 capitalize">{r.data_type ?? r.dataType ?? '—'}</span>
        <span className="text-gray-500">Price</span>
        <span className="text-gray-300">{r.price != null ? `${r.price} ALGO` : '—'}</span>
        <span className="text-gray-500">Mode</span>
        <span className="text-gray-300">{(r.mode ?? '—').replace('_', ' ')}</span>
        <span className="text-gray-500">Payment Tx</span>
        <span className="font-mono text-blue-400 truncate" title={r.payment_tx_id ?? r.paymentTxId}>{truncate(r.payment_tx_id ?? r.paymentTxId, 20)}</span>
        <span className="text-gray-500">Timestamp</span>
        <span className="text-gray-400">{r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}</span>
      </div>
    </div>
  );
}

function RequestCard({ r }: { r: any }) {
  const statusColor: Record<string, string> = {
    approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/50',
    pending:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    approve:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    reject:   'bg-red-500/20 text-red-300 border-red-500/50',
  };
  const status = (r.status ?? 'pending').toLowerCase();
  return (
    <div className="glass rounded-xl p-5 gradient-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Data Request</span>
        </div>
        <Badge className={statusColor[status] ?? 'bg-gray-700 text-gray-300'}>
          {status.toUpperCase()}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-500">ID</span>
        <span className="font-mono text-blue-400 truncate" title={r.id}>{truncate(r.id, 24)}</span>
        <span className="text-gray-500">Data Type</span>
        <span className="text-gray-300 capitalize">{r.data_type ?? r.dataType ?? '—'}</span>
        <span className="text-gray-500">Purpose</span>
        <span className="text-gray-300 truncate">{truncate(r.purpose, 28)}</span>
        <span className="text-gray-500">Price</span>
        <span className="text-gray-300">{r.offered_price ?? r.offeredPrice != null ? `${r.offered_price ?? r.offeredPrice} ALGO` : '—'}</span>
        <span className="text-gray-500">Mode</span>
        <span className="text-gray-300">{(r.mode ?? '—').replace('_', ' ')}</span>
        <span className="text-gray-500">Created</span>
        <span className="text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</span>
      </div>
    </div>
  );
}

function DecisionCard({ r }: { r: any }) {
  const approved = r.decision === 'approve';
  const riskColor: Record<string, string> = {
    low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-red-400',
  };
  return (
    <div className="glass rounded-xl p-5 gradient-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Agent Decision</span>
        </div>
        <Badge className={approved
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
          : 'bg-red-500/20 text-red-300 border-red-500/50'}>
          {approved ? 'APPROVE' : 'REJECT'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-gray-500">Request ID</span>
        <span className="font-mono text-blue-400 truncate" title={r.request_id}>{truncate(r.request_id, 24)}</span>
        <span className="text-gray-500">Final Price</span>
        <span className="text-gray-300">{r.final_price != null ? `${r.final_price} ALGO` : '—'}</span>
        <span className="text-gray-500">Confidence</span>
        <span className="text-gray-300">{r.confidence != null ? `${r.confidence}%` : '—'}</span>
        <span className="text-gray-500">Risk Level</span>
        <span className={`font-semibold uppercase ${riskColor[r.risk_level] ?? 'text-gray-300'}`}>{r.risk_level ?? '—'}</span>
        <span className="text-gray-500">Evaluated By</span>
        <span className="text-gray-300">{r.evaluated_by ?? '—'}</span>
        <span className="text-gray-500">Evaluated At</span>
        <span className="text-gray-400">{r.evaluated_at ? new Date(r.evaluated_at).toLocaleString() : '—'}</span>
      </div>
      {r.justification && (
        <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-800 pt-2">
          {truncate(r.justification, 120)}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QueryPage() {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState('');

  const run = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await ApiClient.query(q.trim());
      if (res.success) setResult(res);
      else setError(res.message || 'Query failed');
    } catch (err: any) {
      setError(err.message || 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); run(input); };
  const handleExample = (ex: string) => { setInput(ex); run(ex); };

  const renderCard = (row: any, i: number) => {
    if (!result) return null;
    if (result.resultType === 'consent_records') return <ConsentCard key={i} r={row} />;
    if (result.resultType === 'data_requests')   return <RequestCard key={i} r={row} />;
    if (result.resultType === 'agent_decisions') return <DecisionCard key={i} r={row} />;
    return null;
  };

  return (
    <div className="min-h-screen relative">
      <div className="bg-animated-gradient" />
      <div className="bg-grid" />

      <header className="border-b border-blue-500/20 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                DataDAO India
              </span>
            </div>
          </div>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50">
            <Database className="h-3 w-3 mr-1" />Query
          </Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl relative z-10">
        <h1 className="text-4xl font-bold text-white mb-2">Query Records</h1>
        <p className="text-gray-400 mb-8">
          Ask plain-English questions about consent records, requests, and AI decisions.
          Pattern-matched — no LLM.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-3 mb-5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder='e.g. "latest consent transaction" or "approved requests"'
            className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-600 flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {/* Example chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => handleExample(ex)}
              className="px-3 py-1 text-xs rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Interpreted intent banner */}
        {result && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 uppercase">Intent</span>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 font-mono text-xs">
                {result.interpretedIntent}
              </Badge>
              {Object.keys(result.filters ?? {}).length > 0 && (
                <span className="text-xs text-gray-500">
                  filters: {Object.entries(result.filters).map(([k, v]) => `${k}=${v}`).join(', ')}
                </span>
              )}
            </div>
            <Badge className="bg-gray-800 text-gray-300 border-gray-700">
              {result.count} {result.count === 1 ? 'result' : 'results'}
            </Badge>
          </div>
        )}

        {/* Result cards */}
        {result && result.results.length === 0 && (
          <div className="glass rounded-xl p-12 text-center gradient-border">
            <p className="text-gray-500">No results found for this query.</p>
          </div>
        )}

        {result && result.results.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {result.results.map((row: any, i: number) => renderCard(row, i))}
          </div>
        )}
      </div>
    </div>
  );
}
