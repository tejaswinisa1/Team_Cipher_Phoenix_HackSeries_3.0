'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiClient } from '@/lib/api';
import {
  Shield, ArrowLeft, Brain, CheckCircle, XCircle,
  Loader2, AlertTriangle, Database, TrendingUp, ArrowRight
} from 'lucide-react';

export default function RequestApprovalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const requestId = params.id;

  const [request,        setRequest]        = useState<any>(null);
  const [decision,       setDecision]       = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [evaluating,     setEvaluating]     = useState(false);
  const [executing,      setExecuting]      = useState(false);
  const [error,          setError]          = useState('');
  const [reasoningSteps, setReasoningSteps] = useState<string[]>([]);
  const [autonomousMode, setAutonomousMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ApiClient.getRequest(requestId);
        if (res.success) {
          setRequest(res.request);
          await runEvaluation(requestId);
        } else {
          setError('Request not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load request');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [requestId]);

  const runEvaluation = async (reqId: string) => {
    setEvaluating(true);
    setReasoningSteps([]);
    const steps = [
      'Analyzing data sensitivity...',
      'Evaluating purpose legitimacy...',
      'Checking pricing thresholds...',
      'Assessing compliance requirements...',
      'AI Agent reasoning in progress...',
    ];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 600));
      setReasoningSteps(prev => [...prev, step]);
    }
    try {
      const res = await ApiClient.getAgentDecision(reqId);
      if (res.success) {
        setDecision({
          decision:             res.decision,
          originalPrice:        res.originalPrice,
          suggestedPrice:       res.suggestedPrice,
          finalPrice:           res.finalPrice,
          negotiationReasoning: res.negotiationReasoning ?? [],
          justification:        res.justification,
          evaluatedBy:          res.evaluatedBy,
          confidence:           res.confidence,
          riskLevel:            res.riskLevel,
          ruleTriggers:         res.ruleTriggers ?? [],
        });
      } else {
        setError(res.message || 'AI evaluation failed. Please try again.');
      }
    } catch (err: any) {
      setError('AI evaluation failed. Please try again.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleApprove = async () => {
    setExecuting(true);
    setError('');
    const stages = [
      'Preparing smart contract...',
      'Broadcasting to Algorand network...',
      'Awaiting consensus...',
      'Transaction confirmed',
      'Consent sealed on Algorand.',
    ];
    try {
      const userWallet      = localStorage.getItem('userWallet')      || '';
      const companyWallet   = localStorage.getItem('companyWallet')   || '';
      const companyMnemonic = localStorage.getItem('companyMnemonic') || '';

      if (!userWallet || !companyWallet || !companyMnemonic) {
        setError('Please configure wallet addresses in the dashboard first');
        setExecuting(false);
        return;
      }

      for (const stage of stages) {
        setReasoningSteps(prev => [...prev, stage]);
        await new Promise(r => setTimeout(r, 800));
      }

      const res = await ApiClient.executeContract(
        userWallet, companyWallet, companyMnemonic,
        decision.finalPrice, requestId
      );

      if (res.success) {
        const proofKey = res.txId ?? res.paymentTxId;
        if (proofKey) sessionStorage.setItem(`proof_${proofKey}`, JSON.stringify(res));
        router.push(`/transaction/${proofKey ?? requestId}`);
      } else {
        setError(res.message || 'Transaction failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during execution');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="max-w-md bg-gray-900 border-gray-700">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <Link href="/dashboard"><Button>Back to Dashboard</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const riskColor: Record<string, string> = {
    low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-red-400',
  };
  const offeredPrice = request?.offeredPrice ?? request?.price;

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
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">AI Evaluation</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <h1 className="text-4xl font-bold text-white mb-8">Data Request Evaluation</h1>

        {/* Request Details */}
        <div className="glass rounded-xl p-6 mb-6 gradient-border">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-blue-400" />Request Details
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
              <label className="text-xs font-medium text-gray-500 uppercase">Request ID</label>
              <p className="text-sm font-mono text-blue-400 mt-1 truncate">{requestId}</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
              <label className="text-xs font-medium text-gray-500 uppercase">Data Type</label>
              <p className="text-lg font-semibold text-white mt-1 capitalize">{request?.dataType}</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
              <label className="text-xs font-medium text-gray-500 uppercase">Purpose</label>
              <p className="text-white mt-1">{request?.purpose}</p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/50">
              <label className="text-xs font-medium text-gray-400 uppercase">Offered Price</label>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mt-1">
                {offeredPrice} ALGO
              </p>
            </div>
          </div>
        </div>

        {/* Autonomous Mode Toggle */}
        <div className="flex items-center justify-between mb-6 glass rounded-xl p-4 gradient-border">
          <div className="flex items-center space-x-3">
            <Brain className="h-5 w-5 text-purple-400" />
            <div>
              <h3 className="text-white font-semibold">Autonomous Mode</h3>
              <p className="text-xs text-gray-400">AI automatically evaluates and executes</p>
            </div>
          </div>
          <button
            onClick={() => setAutonomousMode(!autonomousMode)}
            aria-label="Toggle autonomous mode"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autonomousMode ? 'bg-emerald-500' : 'bg-gray-700'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autonomousMode ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* AI Agent Reasoning */}
        <div className="glass rounded-xl p-6 mb-6 gradient-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Brain className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">AI Agent Reasoning</h2>
                <p className="text-sm text-gray-400">
                  {evaluating ? 'Reasoning in progress...' : decision ? 'Final decision rendered' : 'Initializing AI agent...'}
                </p>
              </div>
            </div>
            {decision?.confidence != null && (
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Confidence</p>
                <p className="text-2xl font-bold text-emerald-400">{decision.confidence}%</p>
              </div>
            )}
          </div>

          {reasoningSteps.length > 0 && (
            <div className="space-y-3 py-4">
              {reasoningSteps.map((step, i) => {
                const isLast = i === reasoningSteps.length - 1;
                return (
                  <div key={i} className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-500 ${
                    isLast && evaluating
                      ? 'bg-purple-500/20 border border-purple-500/50'
                      : 'bg-gray-900/30 border border-gray-700/50'
                  }`}>
                    {isLast && evaluating
                      ? <Loader2 className="h-4 w-4 animate-spin text-purple-400 flex-shrink-0" />
                      : <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    }
                    <p className={`text-sm ${isLast && evaluating ? 'text-purple-300' : 'text-gray-400'}`}>{step}</p>
                  </div>
                );
              })}
            </div>
          )}

          {!evaluating && decision && (
            <div className="space-y-4 mt-2">

              {/* Decision badge */}
              <div className={`p-6 rounded-lg border ${
                decision.decision === 'approve'
                  ? 'bg-emerald-500/10 border-emerald-500/50'
                  : 'bg-red-500/10 border-red-500/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {decision.decision === 'approve'
                      ? <div className="relative"><CheckCircle className="h-12 w-12 text-emerald-400" /><div className="absolute inset-0 h-12 w-12 bg-emerald-400/20 rounded-full blur-md" /></div>
                      : <XCircle className="h-12 w-12 text-red-400" />
                    }
                    <div>
                      <Badge
                        variant={decision.decision === 'approve' ? 'success' : 'destructive'}
                        className="text-xl px-6 py-3 mb-2"
                      >
                        {decision.decision.toUpperCase()}
                      </Badge>
                      <p className="text-xs text-gray-400">
                        Evaluated by: <span className="text-white font-semibold">{decision.evaluatedBy}</span>
                      </p>
                    </div>
                  </div>
                  {decision.riskLevel && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Risk Level</p>
                      <p className={`text-lg font-bold uppercase ${riskColor[decision.riskLevel] ?? 'text-gray-300'}`}>
                        {decision.riskLevel}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Negotiation Panel ─────────────────────────────────── */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">AI Negotiation Panel</h3>
                </div>

                {/* Price comparison */}
                <div className="grid grid-cols-3 gap-3 mb-4 items-center">
                  <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-700 text-center">
                    <p className="text-xs text-gray-500 uppercase mb-1">Company Offer</p>
                    <p className="text-xl font-bold text-gray-300">{decision.originalPrice ?? offeredPrice} ALGO</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className={`p-3 rounded-lg border text-center ${
                    decision.suggestedPrice != null && decision.suggestedPrice !== (decision.originalPrice ?? offeredPrice)
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-emerald-500/20 border-emerald-500/50'
                  }`}>
                    <p className="text-xs text-gray-400 uppercase mb-1">AI Suggested</p>
                    <p className={`text-xl font-bold ${
                      decision.suggestedPrice != null && decision.suggestedPrice !== (decision.originalPrice ?? offeredPrice)
                        ? 'text-blue-300'
                        : 'text-emerald-300'
                    }`}>
                      {decision.suggestedPrice != null ? `${decision.suggestedPrice} ALGO` : '—'}
                    </p>
                  </div>
                </div>

                {/* Final price */}
                <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-gray-900/40 border border-gray-700">
                  <span className="text-xs text-gray-500 uppercase">Final Price (if approved)</span>
                  <span className="text-sm font-bold text-white">{decision.finalPrice} ALGO</span>
                </div>

                {/* Negotiation reasoning bullets */}
                {decision.negotiationReasoning?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-2">Negotiation Reasoning</p>
                    <ul className="space-y-1.5">
                      {decision.negotiationReasoning.map((point: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Justification */}
              <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                <p className="text-sm font-medium text-gray-400 mb-2">AI Reasoning:</p>
                <p className="text-gray-300 leading-relaxed">{decision.justification}</p>
              </div>

              {/* Rules triggered */}
              {decision.ruleTriggers?.length > 0 && (
                <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                  <p className="text-sm font-medium text-gray-400 mb-2">Rules Triggered:</p>
                  <div className="flex flex-wrap gap-2">
                    {decision.ruleTriggers.map((r: string) => (
                      <span key={r} className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 font-mono">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!evaluating && !decision && (
            <p className="text-gray-500 text-center py-12">Waiting for evaluation...</p>
          )}
        </div>

        {/* Action Buttons */}
        {decision && !evaluating && (
          <div className="glass rounded-xl p-6 gradient-border">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
            )}
            {decision.decision === 'approve' ? (
              <div className="space-y-3">
                {/* Accept AI suggestion — executes at finalPrice */}
                <Button
                  onClick={handleApprove}
                  disabled={executing}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 btn-shine text-lg py-6"
                  size="lg"
                >
                  {executing
                    ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Executing on Algorand Blockchain...</>
                    : <><CheckCircle className="mr-2 h-5 w-5" />Accept AI Suggestion &amp; Execute ({decision.finalPrice} ALGO)</>
                  }
                </Button>
                <Button
                  onClick={() => router.push('/dashboard')}
                  disabled={executing}
                  variant="outline"
                  className="w-full border-gray-600 hover:bg-gray-800 text-gray-300 py-4"
                  size="lg"
                >
                  <XCircle className="mr-2 h-4 w-4" />Reject &amp; Cancel
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Accepting creates an immutable consent proof on Algorand Testnet at the AI-suggested price
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {decision.suggestedPrice && (
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
                    AI suggests resubmitting at <span className="font-bold">{decision.suggestedPrice} ALGO</span> to get approval.
                  </div>
                )}
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="destructive"
                  className="w-full text-lg py-6"
                  size="lg"
                >
                  <XCircle className="mr-2 h-5 w-5" />Reject &amp; Return to Dashboard
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
