import { useMemo, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import trixieIcon from "@/assets/trixie-icon.svg";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { isKnownAppPath } from "@/lib/trixie/trixie-pagemap";
import { trixieSuggestions } from "@/lib/trixie/trixie-suggestions";
import { RotateCcw, X } from "lucide-react";

const GREETING =
  "G'day, I'm Trixie, your Traction Advisory dashboard helper. Ask me how to use any part of the dashboards — clients, Xero connections, consolidations, monthly reports, card defaults — or ask me to explain the figures on the page you're on.";

const TOOL_LABELS: Record<string, string> = {
  searchHelp: "Searched the help library",
  readCurrentClientFigures: "Read saved key figures",
  readCashPosition: "Read cash position",
  readProfitAndLoss: "Read Profit & Loss",
  readTaxObligations: "Read tax obligations",
  readReceivables: "Read receivables",
  readPayables: "Read payables",
  readBreakeven: "Read break-even",
  readHealthVerdict: "Read business health",
};

type Src = { label: string; asAt: string | null; href?: string };

function friendlyError(error: Error | undefined): string {
  if (!error) return "";
  try {
    const parsed = JSON.parse(error.message);
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not JSON */
  }
  return "Trixie couldn't answer just now. Please try again in a moment.";
}

function sourcesOf(message: UIMessage): Src[] {
  const seen = new Map<string, Src>();
  for (const part of message.parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue;
    const list = (part.output as { sources?: Src[] } | undefined)?.sources ?? [];
    for (const s of list) if (s?.label && !seen.has(s.label)) seen.set(s.label, s);
  }
  return [...seen.values()];
}

export function TrixieWidget() {
  const [open, setOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const location = useLocation();
  return (
    <>
      {!open && (
        <Button aria-label="Ask Trixie" title="Ask Trixie" size="icon" className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg" onClick={() => setOpen(true)}>
          <img src={trixieIcon} alt="" className="h-10 w-10" />
        </Button>
      )}
      {open && (
        <div role="dialog" aria-label="Trixie" className="fixed inset-0 z-50 flex flex-col overflow-hidden border border-border bg-background shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[640px] sm:max-h-[calc(100vh-2.5rem)] sm:w-[400px] sm:rounded-2xl">
          <TrixieChat key={chatKey} pathname={location.pathname} onNewChat={() => setChatKey((k) => k + 1)} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

function TrixieChat({ pathname, onNewChat, onClose }: { pathname: string; onNewChat: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/trixie",
    fetch: async (input, init) => {
      const { data } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
      return fetch(input, { ...init, headers });
    },
    body: () => ({ pathname: window.location.pathname }),
  }), []);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport,
    onError: (err) => toast.error(friendlyError(err)),
  });
  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => {
    if (busy || !text.trim()) return;
    if (error) clearError();
    void sendMessage({ text: text.trim() });
  };
  const last = messages[messages.length - 1];
  const toolRunning = status === "streaming" && last?.role === "assistant" && last.parts.some((p) => isToolUIPart(p) && p.state !== "output-available" && p.state !== "output-error");
  const thinking = status === "submitted" || toolRunning || (status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text));
  const suggestions = trixieSuggestions(pathname);

  // Links Trixie gives open inside the app, and only when the page exists.
  const onLinkClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href || !href.startsWith("/")) return;
    event.preventDefault();
    event.stopPropagation();
    if (isKnownAppPath(href)) void navigate({ to: href });
  };

  return (
    <>
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <img src={trixieIcon} alt="" className="h-9 w-9 shrink-0 rounded-full bg-background p-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Trixie</p>
          <p className="text-xs opacity-80">Dashboard help agent</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={onNewChat} disabled={busy} title="New chat">
          <RotateCcw className="h-3.5 w-3.5" /> New chat
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close Trixie" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 p-4" onClickCapture={onLinkClick}>
          <Message from="assistant">
            <div className="flex gap-2">
              <img src={trixieIcon} alt="" className="h-7 w-7 shrink-0" />
              <MessageContent className="bg-transparent px-0 text-sm"><MessageResponse>{GREETING}</MessageResponse></MessageContent>
            </div>
          </Message>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 pl-9">
              {suggestions.map((item) => <Suggestion key={item} suggestion={item} onClick={ask} className="h-auto whitespace-normal py-1.5 text-left text-xs" />)}
            </div>
          )}
          {messages.map((message) => {
            const sources = message.role === "assistant" ? sourcesOf(message) : [];
            return (
              <Message key={message.id} from={message.role}>
                <div className={message.role === "assistant" ? "flex min-w-0 gap-2" : "contents"}>
                  {message.role === "assistant" && <img src={trixieIcon} alt="" className="h-7 w-7 shrink-0" />}
                  <MessageContent className={message.role === "user" ? "bg-primary text-sm text-primary-foreground" : "min-w-0 bg-transparent px-0 text-sm"}>
                    {message.parts.map((part, index) => {
                      if (part.type === "text") return <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse>;
                      if (isToolUIPart(part)) {
                        const name = part.type.replace(/^tool-/, "");
                        return (
                          <Tool key={`${message.id}-${index}`} defaultOpen={false} className="mb-1 border-border/60">
                            <ToolHeader type={part.type as any} state={part.state as any} title={TOOL_LABELS[name] ?? "Checked the dashboard"} />
                            <ToolContent className="px-3 pb-2 text-xs text-muted-foreground">
                              {part.state === "output-error" ? "This check couldn't be completed." : "Read through your own access; nothing was changed."}
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                    {sources.length > 0 && (
                      <Sources className="mb-0 mt-2">
                        <SourcesTrigger count={sources.length} />
                        <SourcesContent>
                          {sources.map((s) => (
                            <Source key={s.label} href={s.href && isKnownAppPath(s.href) ? s.href : undefined} title={s.asAt ? `${s.label} (as at ${s.asAt})` : s.label} />
                          ))}
                        </SourcesContent>
                      </Sources>
                    )}
                  </MessageContent>
                </div>
              </Message>
            );
          })}
          {thinking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <img src={trixieIcon} alt="" className="h-7 w-7" />
              <Shimmer>{toolRunning ? "Trixie is checking the dashboard…" : "Trixie is thinking…"}</Shimmer>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <X className="mt-0.5 h-4 w-4 shrink-0" />{friendlyError(error)}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border bg-background p-3">
        <PromptInput onSubmit={(message) => ask(message.text)}>
          <PromptInputTextarea placeholder="Ask Trixie…" disabled={busy} autoFocus />
          <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} onStop={stop} /></PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Trixie can make mistakes. Check important figures against the dashboard.</p>
      </div>
    </>
  );
}
