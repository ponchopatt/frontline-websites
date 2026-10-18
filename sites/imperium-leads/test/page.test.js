import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// The page's own script must at least compile: one stray quote and nothing on the page works.
test("the page's script compiles", () => {
  const html = readFileSync(new URL("../imperium-leads.html", import.meta.url), "utf8");
  const js = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.ok(js.length > 1000);
  assert.doesNotThrow(() => new vm.Script(js, { filename: "imperium-leads.html" }));
});
