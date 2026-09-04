"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrgRole = "owner" | "admin" | "member" | "viewer";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
};

type OrgMembership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
};

type OrgWithMembership = OrganizationRow & {
  membership?: OrgMembership;
};

type OrganizationsResponse = {
  organizations?: OrgWithMembership[];
  error?: string;
};

type OrganizationMutationResponse = {
  organization?: OrgWithMembership;
  error?: string;
};

const roleLabel: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function OrganizationsPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<OrgWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/organizations?user_id=${encodeURIComponent(userId)}`,
        );
        const data = (await response.json()) as OrganizationsResponse;
        if (cancelled) return;
        if (response.ok && data.organizations) {
          setItems(data.organizations);
        } else {
          setError(data.error || "Failed to load organizations");
        }
      } catch {
        if (!cancelled) setError("Network error while loading organizations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(
        `/api/organizations?user_id=${encodeURIComponent(userId)}`,
      );
      const data = (await response.json()) as OrganizationsResponse;
      if (response.ok && data.organizations) setItems(data.organizations);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slugify(name),
          user_id: userId,
        }),
      });
      const data = (await response.json()) as OrganizationMutationResponse;
      if (!response.ok || !data.organization) {
        throw new Error(data.error || "Organization creation failed");
      }
      setName("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Organization creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="ws-panel workspace-organizations-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Building2 /> Organizations
          </p>
          <h2>Team-scoped workspaces</h2>
          <p className="ws-panel-lede">
            Organizations group workspaces and members. Role badges reflect the
            four-tier hierarchy used for access control.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <Input
          aria-label="Organization name"
          placeholder="New organization name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <div className="ws-form-row">
          <span className="ws-slug-hint">slug · {slugify(name) || "—"}</span>
          <Button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Create organization
          </Button>
        </div>
      </form>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading organizations…
        </div>
      ) : items.length === 0 ? (
        <div className="ws-empty">
          <Building2 /> No organizations yet. Create one to invite teammates.
        </div>
      ) : (
        <div className="ws-cards">
          {items.map((org) => (
            <article key={org.id} className="ws-card organization-card">
              <header>
                <span
                  className={`org-role-badge org-role-${org.membership?.role ?? "member"}`}
                >
                  {roleLabel[org.membership?.role ?? "member"]}
                </span>
                <span className="ws-meta">{org.slug}</span>
              </header>
              <h3>{org.name}</h3>
              <p>
                <Users /> {org.membership ? "You are a member" : "Pending membership"}
              </p>
              <footer className="ws-card-foot">
                <small>Created {new Date(org.created_at).toLocaleDateString()}</small>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
