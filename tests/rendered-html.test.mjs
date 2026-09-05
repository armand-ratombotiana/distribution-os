import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => {
  await vite.close();
});

test("renders development preview metadata", async () => {
  const { default: RootLayout } = await vite.ssrLoadModule("/app/layout.tsx");
  const html = renderToStaticMarkup(
    React.createElement(
      RootLayout,
      null,
      React.createElement("main", null, "Distribution OS"),
    ),
  );

  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i,
  );
});
