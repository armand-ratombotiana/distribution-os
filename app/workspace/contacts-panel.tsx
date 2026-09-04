"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ContactStatus =
  | "new"
  | "qualified"
  | "contacted"
  | "replied"
  | "meeting"
  | "converted"
  | "rejected"
  | "unsubscribed";

type ContactRow = {
  id: string;
  workspace_id: string;
  mission_id: string | null;
  email: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  source: string;
  status: ContactStatus;
  consent_given: number;
  last_contacted_at: number | null;
  converted_at: number | null;
  created_at: number;
  updated_at: number;
};

type ContactsResponse = { contacts?: ContactRow[]; error?: string };
type ContactMutationResponse = { contact?: ContactRow; error?: string };

const statusLabel: Record<ContactStatus, string> = {
  new: "New",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  converted: "Converted",
  rejected: "Rejected",
  unsubscribed: "Unsubscribed",
};

export function ContactsPanel({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactRole, setContactRole] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/contacts?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as ContactsResponse;
        if (cancelled) return;
        if (response.ok && data.contacts) {
          setItems(data.contacts);
        } else {
          setError(data.error || "Failed to load contacts");
        }
      } catch {
        if (!cancelled) setError("Network error while loading contacts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(
        `/api/contacts?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as ContactsResponse;
      if (response.ok && data.contacts) setItems(data.contacts);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() && !name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/contacts?workspace_id=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            email: email.trim() || null,
            name: name.trim() || null,
            company: company.trim() || null,
            role: contactRole.trim() || null,
            source: "manual",
            consent_given: true,
          }),
        },
      );
      const data = (await response.json()) as ContactMutationResponse;
      if (!response.ok || !data.contact) {
        throw new Error(data.error || "Contact creation failed");
      }
      setEmail("");
      setName("");
      setCompany("");
      setContactRole("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contact creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="ws-panel workspace-contacts-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Users /> Contacts
          </p>
          <h2>Permissioned outreach lifecycle</h2>
          <p className="ws-panel-lede">
            Each contact tracks consent, qualification signals and the eight-state
            lifecycle from <em>new</em> to <em>converted</em>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <div className="ws-form-row">
          <Input
            aria-label="Contact email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            aria-label="Contact name"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="ws-form-row">
          <Input
            aria-label="Company"
            placeholder="Company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
          <Input
            aria-label="Role"
            placeholder="Role"
            value={contactRole}
            onChange={(event) => setContactRole(event.target.value)}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Add contact
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
          <LoaderCircle className="animate-spin" /> Loading contacts…
        </div>
      ) : items.length === 0 ? (
        <div className="ws-empty">
          <Users /> No contacts yet. Add the first one above.
        </div>
      ) : (
        <div className="ws-cards">
          {items.map((contact) => (
            <article key={contact.id} className="ws-card contact-card">
              <header>
                <span className={`contact-status-pill contact-status-${contact.status}`}>
                  {statusLabel[contact.status]}
                </span>
                <span className="ws-meta">{contact.source}</span>
              </header>
              <h3>{contact.name || contact.email || "Unnamed contact"}</h3>
              <p>
                <Mail /> {contact.email || "no email"}
              </p>
              {(contact.company || contact.role) && (
                <p className="ws-meta">
                  {[contact.role, contact.company].filter(Boolean).join(" · ")}
                </p>
              )}
              <footer className="ws-card-foot">
                <small>
                  {contact.last_contacted_at
                    ? `Last contacted ${new Date(contact.last_contacted_at).toLocaleDateString()}`
                    : "Never contacted"}
                </small>
                <small>
                  {contact.consent_given === 1 ? "Consent ✓" : "No consent"}
                </small>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
