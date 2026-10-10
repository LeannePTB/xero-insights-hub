import { useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { supabase } from "@/integrations/supabase/client";
import trixieIcon from "@/assets/trixie-icon.svg";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAvatar, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { X } from "lucide-react";

const suggestions = ["How do I use this page?", "What figures are available here?", "Is this client’s data current?"];

export function TrixieWidget() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/trixie",
    headers: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
    body: () => ({ pathname: location.pathname }),
  }), [location.pathname]);
  const { messages, sendMessage, status, stop, error } = useChat({ transport, onError: () => {} });
  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => { if (!busy && text.trim()) void sendMessage({ text: text.trim() }); };

  return (
    <>
      <Button aria-label="Ask Trixie" title="Ask Trixie" size="icon" className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg" onClick={() => setOpen(true)}>
        <img src={trixieIcon} alt="" className="h-9 w-9" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full max-w-[440px] flex-col gap-0 p-0 sm:max-w-[440px]">
          <SheetHeader className="flex-row items-center gap-3 border-b border-border px-4 py-3 pr-12 text-left">
            <img src={trixieIcon} alt="" className="h-9 w-9 shrink-0" />
            <div><SheetTitle>Trixie</SheetTitle><p className="text-xs text-muted-foreground">Dashboard assistant</p></div>
          </SheetHeader>
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-5 p-4">
              {messages.length === 0 ? (
                <ConversationEmptyState icon={<img src={trixieIcon} alt="" className="h-12 w-12" />} title="Ask Trixie" description="Get help with this page or ask about the client figures shown here." />
              ) : messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  {message.role === "assistant" && <MessageAvatar src={trixieIcon} name="Trixie" />}
                  <MessageContent className={message.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent px-0"}>
                    {message.parts.map((part, index) => part.type === "text" ? <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse> : null)}
                  </MessageContent>
                </Message>
              ))}
              {status === "submitted" && <div className="flex items-center gap-2 text-sm text-muted-foreground"><img src={trixieIcon} alt="" className="h-7 w-7" /><Shimmer>Trixie is checking…</Shimmer></div>}
              {error && <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><X className="mt-0.5 h-4 w-4" />{error.message}</div>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="border-t border-border bg-background p-3">
            {messages.length === 0 && <Suggestions className="mb-3 flex-wrap">{suggestions.map((item) => <Suggestion key={item} suggestion={item} onClick={ask} />)}</Suggestions>}
            <PromptInput onSubmit={(message) => ask(message.text)}>
              <PromptInputTextarea placeholder="Ask Trixie…" disabled={busy} />
              <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} onStop={stop} /></PromptInputFooter>
            </PromptInput>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Trixie can make mistakes. Check important figures against the dashboard.</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}