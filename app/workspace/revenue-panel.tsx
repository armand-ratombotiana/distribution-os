"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleDollarSign,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PaymentRow = {
  id: string;
  mission_id: string | null;
  action_id: string | null;
  experiment_id: string | null;
  provider: string;
  provider_payment_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "succeeded" | "refunded" | "disputed" | "failed";
  attribution_confidence: number;
  attributed_at: number | null;
  received_at: number;
  created_at: number;
};

type TouchpointRow = {
  id: string;
  mission_id: string;
  action_id: string | null;
  experiment_id: string | null;
  channel: string;
  event_type: string;
  occurred_at: number;
  received_at: number;
};

type RevenueResponse = {
  payments?: PaymentRow[];
  touchpoints?: TouchpointRow[];
  error?: string;
};

const attributionSteps = [
  "Distribution touchpoint",
  "Qualified conversation",
  "Founder offer",
  "Stripe payment",
] as const;

function formatCurrency(amountCents: number, currency: string): string {
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function RevenuePanel({ missionId }: { missionId: string }) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [touchpoints, setTouchpoints] = useState<TouchpointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [paymentsRes, touchpointsRes] = await Promise.all([
          fetch(`/api/missions/${missionId}/payments`),
          fetch(`/api/missions/${missionId}/touchpoints`),
        ]);
        const paymentsData = (await paymentsRes.json()) as RevenueResponse;
        const touchpointsData = (await touchpointsRes.json()) as RevenueResponse;
        if (cancelled) return;
        if (paymentsRes.ok && paymentsData.payments) {
          setPayments(paymentsData.payments);
        }
        if (touchpointsRes.ok && touchpointsData.touchpoints) {
          setTouchpoints(touchpointsData.touchpoints);
        }
        if (!paymentsRes.ok && !touchpointsRes.ok) {
          setError(paymentsData.error || "Failed to load revenue");
        }
      } catch {
        if (!cancelled) setError("Network error while loading revenue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(`/api/missions/${missionId}/payments`);
      const data = (await response.json()) as RevenueResponse;
      if (response.ok && data.payments) setPayments(data.payments);
    } catch {
      // background reloads are non-fatal
    }
  }

  const succeeded = payments.filter((payment) => payment.status === "succeeded");
  const totalCents = succeeded.reduce((sum, p) => sum + p.amount_cents, 0);
  const avgConfidence =
    succeeded.length > 0
      ? Math.round(
          succeeded.reduce((sum, p) => sum + p.attribution_confidence, 0) /
            succeeded.length,
        )
      : 0;
  const filteredPayments = providerFilter
    ? payments.filter((p) =>
        p.provider.toLowerCase().includes(providerFilter.toLowerCase()),
      )
    : payments;

  return (
    <section className="ws-panel workspace-revenue-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <CircleDollarSign /> Revenue truth
          </p>
          <h2>Attribution ends at verified payment</h2>
          <p className="ws-panel-lede">
            Channel touchpoints feed a deterministic attribution path that closes
            only when a payment succeeds.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <div className="revenue-hero">
        <CreditCard />
        <small>Verified payments</small>
        <strong>{succeeded.length}</strong>
        <span className="revenue-amount">{formatCurrency(totalCents, "usd")}</span>
        <p>
          <TrendingUp /> Average attribution confidence {avgConfidence}% ·{" "}
          {touchpoints.length} touchpoints tracked
        </p>
      </div>

      <section className="ws-attribution-path">
        <h3>Attribution path</h3>
        {attributionSteps.map((step, index) => {
          const reached =
            (index === 0 && touchpoints.length > 0) ||
            (index === 3 && succeeded.length > 0);
          return (
            <div key={step} className={reached ? "reached" : ""}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
              <em>
                {reached
                  ? "signal captured"
                  : index === 3
                    ? "connector required"
                    : "waiting for signal"}
              </em>
              {index < attributionSteps.length - 1 && <ArrowRight />}
            </div>
          );
        })}
      </section>

      <div className="ws-form-row">
        <Input
          aria-label="Filter by provider"
          placeholder="Filter payments by provider (stripe, paddle…)"
          value={providerFilter}
          onChange={(event) => setProviderFilter(event.target.value)}
        />
      </div>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading revenue…
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="ws-empty">
          <CircleDollarSign /> No payments yet. Attribution activates when a
          Stripe payment is verified.
        </div>
      ) : (
        <div className="ws-cards">
          {filteredPayments.map((payment) => (
            <article key={payment.id} className="ws-card revenue-card">
              <header>
                <span className={`payment-status-pill payment-status-${payment.status}`}>
                  {payment.status}
                </span>
                <span className="ws-meta">{payment.provider}</span>
              </header>
              <h3>{formatCurrency(payment.amount_cents, payment.currency)}</h3>
              <p>
                <CreditCard /> {payment.provider_payment_id}
              </p>
              <footer className="ws-card-foot">
                <small>
                  Received {new Date(payment.received_at).toLocaleString()}
                </small>
                <small>
                  Attribution {payment.attribution_confidence}%
                </small>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
