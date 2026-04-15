'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiClient } from '@/lib/api';
import {
  Shield, ArrowLeft, CheckCircle, XCircle, ExternalLink,
  Copy, Loader2, Brain, Lock, DollarSign, FileText, AlertTriangle
} from 'lucide-react';

const EXPLORER = 'https://testnet.explorer.perawallet.app';

// ── Reusable field row ────────────────────────────────────────────────────────

function Field({ label, value, mono = false }: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 uppercase shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-right break-all ${mono ? 'font-mono text-blue-400' : 'text-gray-200'}`}>
        {String(value)}
      </span>
    </div>
  );
}

// ── Tx row with copy + explorer ───────────────────────────────────────────────

function TxRow({ label, txId, path = 'tx' }: { label: string; txId?: string | null; path?: string }) {
  const [copied, setCopied] = useState(false);
  if (!txId) return null;
  const copy = () => { navigator.clipboard.writeText(txId); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 uppercase shrink-0 pt-0.5">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-mono text-blue-400 truncate max-w-xs" title={txId}>{txId}</span>
        <button onClick={copy} className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors shrink-0" title="Copy">
          {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-blue-400" />}
        </button>
        <a href={`${EXPLORER}/${path}/${txId}`} target="_blank" rel="noreferrer"
          className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors shrink-0">
          <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
        </a>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, color, status, children }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: 'purple' | 'emerald' | 'blue' | 'gray';
  status?: 'ok' | 'warn' | 'missing';
  children: React.ReactNode;
}) {
  const bg = { purple: 'bg-purple-500/20', emerald: 'bg-emerald-500/20', blue: 'bg-blue-500/20', gray: 'bg-gray-700/50' };
  const ic = { purple: 'text-purple-400', emerald: 'text-emerald-400', blue: 'text-blue-400', gray: 'text-gray-400' };
  return (
    <div className="glass rounded-xl p-6 gradient-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${bg[color]}`}>
            <Icon className={`h-5 w-5 ${ic[color]}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {status === 'ok'      && <CheckCircle className="h-4 w-4 text-emerald-400" />}
        {status === 'warn'    && <AlertTriangle className="h-4 w-4 text-yellow-400" />}
        {status === 'missing' && <XCircle className="h-4 w-4 text-red-400" />}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionResultPage({ params }: { params: { id: string } }) {
  const txId = params.id;
  const [proof, setProof] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Try sessionStorage (set by request page on redirect)
    const cached = sessionStorage.getItem(`proof_${txId}`);
    if (cached) {
      try { setProof(JSON.parse(cached)); setLoading(false); return; } catch { /* fall through */ }
    }

    // 2. Fallback: fetch from backend
    const load = async () => {
      try {
        const res = await ApiClient.getTransactionDetails(txId);
        if (res.success) {
          const r = res.consentRecord ?? {};
          const t = res.transaction ?? {};
          setProof({
            requestId:           r.requestId,
            mode:                r.mode,
            decision:            r.consentStatus,
            finalPrice:          r.price ?? t.amount,
            consentRecorded:     !!r.appCallTxId,
            paymentExecuted:     !!r.paymentTxId,
            algorandAppId:       r.algorandAppId,
            appCallTxId:         r.appCallTxId,
            paymentTxId:         r.paymentTxId ?? txId,
            usageConditionsHash: r.usageConditionsHash,
            userWallet:          r.userWallet ?? t.receiver,
            companyWallet:       r.companyWallet ?? t.sender,
            dataType:            r.dataType,
            purpose:             r.purpose,
            timestamp:           r.timestamp ?? t.timestamp,
            explorerUrls: {
              appCall: r.appCallTxId ? `${EXPLORER}/tx/${r.appCallTxId}` : null,
              payment: `${EXPLORER}/tx/${txId}`,
            },
          });
        }
      } catch { /* show partial UI */ }
      finally { setLoading(false); }
    };
    load();
  }, [txId]);

  const isApproved = proof?.decision === 'approve' || proof?.decision === 'approved';
  const riskColor: Record<string, string> = { low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-red-400' };

  return (
    <div className="min-h-screen relative">
      <div className="bg-animated-gradient" />
      <div className="bg-grid" />

      {/* Header */}
      <header className="border-b border-blue-500/20 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />Dashboard
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-emerald-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                DataDAO India
              </span>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50 pulse-glow">
            Compliance Proof
          </Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <CheckCircle className="h-20 w-20 text-emerald-400 mx-auto" />
            <div className="absolute inset-0 h-20 w-20 bg-emerald-400/30 rounded-full blur-2xl animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 glow-text">Consent Confirmed</h1>
          <p className="text-gray-400">Two transactions recorded on Algorand Testnet — consent proof + payment settlement</p>
          {proof?.requestId && (
            <p className="text-xs font-mono text-gray-600 mt-1">{proof.requestId}</p>
          )}
        </div>

        {loading && !proof ? (
          <div className="glass rounded-xl p-12 flex items-center justify-center gradient-border">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto mb-3" />
              <p className="text-gray-400">Loading proof data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── 1. Agent Decision ─────────────────────────────────────── */}
            <Section
              icon={Brain}
              title="Agent Decision"
              subtitle="Deterministic rules + Groq LLM evaluated this request in real time"
              color="purple"
              status={proof?.decision ? 'ok' : 'missing'}
            >
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-xs text-gray-500 uppercase">Decision</span>
                <Badge className={isApproved
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-red-500/20 text-red-300 border-red-500/50'}>
                  {isApproved
                    ? <><CheckCircle className="h-3 w-3 mr-1 inline" />APPROVED</>
                    : <><XCircle className="h-3 w-3 mr-1 inline" />REJECTED</>}
                </Badge>
              </div>
              <Field label="Final Price" value={proof?.finalPrice != null ? `${proof.finalPrice} ALGO` : undefined} />
              {proof?.justification && (
                <div className="py-2 border-b border-gray-800">
                  <p className="text-xs text-gray-500 uppercase mb-1">Justification</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{proof.justification}</p>
                </div>
              )}
              <div className="flex gap-6 py-2">
                {proof?.confidence != null && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Confidence</p>
                    <p className="text-sm font-bold text-emerald-400">{proof.confidence}%</p>
                  </div>
                )}
                {proof?.riskLevel && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Risk Level</p>
                    <p className={`text-sm font-bold uppercase ${riskColor[proof.riskLevel] ?? 'text-gray-300'}`}>{proof.riskLevel}</p>
                  </div>
                )}
                {proof?.mode && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Mode</p>
                    <p className="text-sm text-gray-300">{proof.mode?.replace('_', ' ')}</p>
                  </div>
                )}
              </div>
              {Array.isArray(proof?.ruleTriggers) && proof.ruleTriggers.length > 0 && (
                <div className="py-2">
                  <p className="text-xs text-gray-500 uppercase mb-2">Rules Triggered</p>
                  <div className="flex flex-wrap gap-2">
                    {proof.ruleTriggers.map((r: string) => (
                      <span key={r} className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 font-mono">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* ── 2. On-Chain Consent Proof ─────────────────────────────── */}
            <Section
              icon={Lock}
              title="On-Chain Consent Proof"
              subtitle="ApplicationCall to ConsentContract — immutable, verifiable on Algorand TestNet"
              color="emerald"
              status={proof?.consentRecorded ? 'ok' : proof?.consentRecorded === false ? 'missing' : 'warn'}
            >
              {proof?.consentRecorded === false && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
                  App call did not complete. Payment may still have executed.
                </div>
              )}
              {proof?.algorandAppId && (
                <div className="flex justify-between items-center py-2 border-b border-gray-800">
                  <span className="text-xs text-gray-500 uppercase">App ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-blue-400">{proof.algorandAppId}</span>
                    <a href={`${EXPLORER}/application/${proof.algorandAppId}`} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                    </a>
                  </div>
                </div>
              )}
              <TxRow label="App Call Tx" txId={proof?.appCallTxId} />
              {!proof?.appCallTxId && (
                <p className="text-xs text-gray-600 py-2">App call transaction not available</p>
              )}
            </Section>

            {/* ── 3. Payment Settlement ─────────────────────────────────── */}
            <Section
              icon={DollarSign}
              title="Payment Settlement"
              subtitle="Separate PaymentTxn — company pays user after consent proof is confirmed"
              color="blue"
              status={proof?.paymentExecuted ? 'ok' : proof?.paymentExecuted === false ? 'missing' : 'warn'}
            >
              {proof?.paymentExecuted === false && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  Payment did not execute. Consent proof is still valid on-chain.
                </div>
              )}
              <TxRow label="Payment Tx" txId={proof?.paymentTxId ?? txId} />
              <Field label="Amount" value={proof?.finalPrice != null ? `${proof.finalPrice} ALGO` : undefined} />
              <Field label="From (Company)" value={proof?.companyWallet} mono />
              <Field label="To (User)"      value={proof?.userWallet}    mono />
            </Section>

            {/* ── 4. Persisted Audit Record ─────────────────────────────── */}
            <Section
              icon={FileText}
              title="Supabase Audit Record"
              subtitle="Full consent event persisted off-chain — queryable, linked to on-chain proof by usage hash"
              color="gray"
            >
              <Field label="Request ID"   value={proof?.requestId}            mono />
              <Field label="Data Type"    value={proof?.dataType} />
              <Field label="Purpose"      value={proof?.purpose} />
              <Field label="Usage Hash (SHA-256)" value={proof?.usageConditionsHash}  mono />
              <Field label="Timestamp"    value={proof?.timestamp} />
              {!proof?.usageConditionsHash && (
                <p className="text-xs text-gray-600 py-2">
                  Persistence may not have completed — on-chain proof is still valid.
                </p>
              )}
            </Section>

            {/* Actions */}
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <Button
                onClick={() => window.open(`${EXPLORER}/tx/${proof?.paymentTxId ?? txId}`, '_blank')}
                size="lg"
                className="btn-shine bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-lg py-6"
              >
                <ExternalLink className="mr-2 h-5 w-5" />Verify on Explorer
              </Button>
              <Link href="/dashboard" className="w-full">
                <Button variant="outline" size="lg" className="w-full border-blue-500/50 hover:bg-blue-500/10 text-lg py-6">
                  Back to Dashboard
                </Button>
              </Link>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
