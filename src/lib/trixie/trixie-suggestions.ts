/** Page-specific starter questions for the Trixie panel. */
export function trixieSuggestions(pathname: string): string[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/system" || p.startsWith("/system/"))
    return ["How do I change Trixie's allowance?", "How do I add platform staff?", "What does Xero monitoring show?"];
  if (/^\/clients\/[^/]+\/settings/.test(p))
    return ["What does each settings tab do?", "How do I mark an account as a credit card?", "How do I reconnect Xero?"];
  if (/^\/clients\/[^/]+\/reports/.test(p))
    return ["How do I prepare and send a monthly report?", "Which logo goes on the report?"];
  if (/^\/clients\/[^/]+/.test(p))
    return ["Explain the cash position", "How is the P&L tracking this month?", "What tax is owed?", "Is this client's data current?"];
  if (p === "/overview" || /^\/firms\/[^/]+\/overview/.test(p))
    return ["What do the status labels mean?", "How does Re-sync work?", "What is protected money?"];
  if (/^\/firms\/[^/]+\/settings/.test(p))
    return ["What are card defaults?", "How do I change our report logo?", "How does support access work?"];
  if (/^\/firms\/[^/]+\/people/.test(p))
    return ["How do I invite a business owner?", "What can an external adviser see?"];
  if (/^\/firms\/[^/]+\/(consolidations|loans)/.test(p))
    return ["How do consolidation groups work?", "How do I set up loan accounts?"];
  if (/^\/firms\/[^/]+/.test(p)) return ["How do I add a client?", "How do I connect a Xero file?", "What does unlinked mean?"];
  return ["How do I add a client?", "How do I connect a Xero file?", "How do monthly reports work?"];
}
