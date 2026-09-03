export type Connector = {
  name: string;
  category: string;
  description: string;
  featured?: boolean;
};

const groups: Record<string, string[]> = {
  "Social & Community": ["YouTube", "TikTok", "Instagram", "X", "LinkedIn", "Facebook", "Reddit", "Quora", "Threads", "Pinterest", "Snapchat", "Discord", "Telegram", "Mastodon", "Bluesky"],
  "Email & Outreach": ["Gmail", "Outlook", "Mailchimp", "Brevo", "ConvertKit", "Klaviyo", "Customer.io", "Loops", "Instantly", "Lemlist", "Resend", "SendGrid", "Postmark", "Apollo", "Hunter"],
  "Analytics & Attribution": ["Google Analytics", "Search Console", "Metricool", "Mixpanel", "Amplitude", "PostHog", "Plausible", "Fathom Analytics", "Segment", "Heap", "Hotjar", "Microsoft Clarity", "Looker Studio", "Metabase"],
  "CRM & Sales": ["HubSpot", "Salesforce", "Pipedrive", "Close", "Zoho CRM", "Attio", "Copper", "Freshsales", "Intercom", "Crisp", "Zendesk", "Gong", "Calendly", "Cal.com"],
  "Commerce & Revenue": ["Stripe", "PayPal", "Lemon Squeezy", "Paddle", "Shopify", "WooCommerce", "Gumroad", "Chargebee", "Recurly", "RevenueCat", "Square", "Razorpay", "Xero", "QuickBooks"],
  "Content & Creative": ["Canva", "Figma", "Adobe Express", "CapCut", "Descript", "Runway", "HeyGen", "ElevenLabs", "Buffer", "Hootsuite", "WordPress", "Webflow", "Ghost", "Medium", "Substack"],
  "Data & Research": ["Airtable", "Notion", "Google Sheets", "Google Drive", "Dropbox", "Box", "Perplexity", "Semrush", "Ahrefs", "Similarweb", "SerpAPI", "Typeform", "Tally", "SurveyMonkey"],
  "Automation & Dev": ["Zapier", "Make", "n8n", "Slack", "Microsoft Teams", "GitHub", "GitLab", "Linear", "Jira", "Asana", "Trello", "ClickUp", "Monday.com", "Webhook", "REST API"],
};

const descriptions: Record<string, string> = {
  "Social & Community": "Publish, listen and learn from audience response.",
  "Email & Outreach": "Run permissioned lifecycle and founder-led outreach.",
  "Analytics & Attribution": "Measure attention, intent and conversion evidence.",
  "CRM & Sales": "Turn qualified signals into owned customer conversations.",
  "Commerce & Revenue": "Verify revenue and attribute payments to distribution.",
  "Content & Creative": "Create, adapt and manage channel-native assets.",
  "Data & Research": "Ground strategy in product, market and customer evidence.",
  "Automation & Dev": "Trigger workflows and connect the operating stack.",
};

const featured = new Set(["YouTube", "TikTok", "Instagram", "X", "Gmail", "Reddit", "Quora", "Stripe", "Metricool", "Google Analytics", "HubSpot", "LinkedIn"]);

export const connectorCatalog: Connector[] = Object.entries(groups).flatMap(([category, names]) =>
  names.map(name => ({ name, category, description: descriptions[category], featured: featured.has(name) }))
);

export const connectorCategories = ["All", ...Object.keys(groups)];
