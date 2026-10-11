import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { resolveTrixieContext } from "@/lib/trixie/trixie-context.server";
import { buildTrixieTools, trixieInstructions } from "@/lib/trixie/trixie-tools.server";
import { createTrixieRunIdFetch, incomingTrixieRunId, withTrixieRunId } from "@/lib/trixie/trixie-run-id.server";
import { estimateTrixieCostUsd, maxOutputTokensForGuard } from "@/lib/trixie/trixie-cost";

type Payload = { messages?: UIMessage[]; pathname?: string };

function errorResponse(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const raw = error instanceof Error ? error.message : "";
  // Only known, user-safe messages are passed through; everything else is generic.
  const message = /TRIXIE_LIMIT_REACHED/.test(raw)
    ? "Your organisation has used this month’s Trixie questions."
    : /switched off/.test(raw)
      ? "Trixie is currently switched off."
      : /MFA_REQUIRED|SESSION_IDLE/.test(raw)
        ? "Please confirm your sign-in again to use Trixie."
        : status === 503 ? "Trixie is not available right now." : "Trixie could not answer that question.";
  const code = /TRIXIE_LIMIT_REACHED/.test(raw) ? 429 : /MFA_REQUIRED|SESSION_IDLE|Forbidden/.test(raw) ? 403 : status;
  return Response.json({ error: message }, { status: Number.isFinite(code) && code >= 400 ? code : 500 });
}

export const Route = createFileRoute("/api/trixie")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let ctx: Awaited<ReturnType<typeof resolveTrixieContext>> | null = null;
        try {
          const body = await request.json() as Payload;
          if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 60) return Response.json({ error: "The conversation is not valid." }, { status: 400 });
          ctx = await resolveTrixieContext(request, body.pathname);
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) throw Object.assign(new Error("Trixie’s AI connection is not configured."), { status: 503 });
          const runIdFetch = createTrixieRunIdFetch(incomingTrixieRunId(request));
          const provider = createOpenAI({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey,
            headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
            fetch: runIdFetch.fetch,
          });
          const finalise = async (status: "completed" | "failed" | "denied" | "cancelled", usage?: { inputTokens?: number; outputTokens?: number; reasoningTokens?: number }, code?: string) => {
            await (ctx?.supabase as any)?.rpc("finalise_trixie_usage", {
              _reservation_id: ctx?.reservationId,
              _status: status,
              _gateway_run_id: runIdFetch.getRunId() ?? null,
              _input_tokens: usage?.inputTokens ?? null,
              _output_tokens: usage?.outputTokens ?? null,
              _reasoning_tokens: usage?.reasoningTokens ?? null,
              _estimated_cost_usd: usage ? estimateTrixieCostUsd(ctx?.model ?? "openai/gpt-6-astra", usage) : null,
              _error_code: code ?? null,
            });
          };
          // Per-question cost guard, set in System Admin → Trixie.
          const { data: guard } = await (ctx.supabase as any).rpc("trixie_cost_guard");
          const result = streamText({
            model: provider.responses(ctx.model),
            instructions: trixieInstructions(ctx),
            messages: await convertToModelMessages(body.messages),
            tools: buildTrixieTools(ctx),
            stopWhen: stepCountIs(50),
            abortSignal: request.signal,
            maxRetries: 1,
            maxOutputTokens: maxOutputTokensForGuard(ctx.model, guard == null ? null : Number(guard)),
            providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
            onFinish: async ({ usage }) => finalise("completed", { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, reasoningTokens: usage.outputTokenDetails.reasoningTokens }),
            onAbort: async () => finalise("cancelled", undefined, "cancelled"),
            onError: async ({ error }) => {
              const text = error instanceof Error ? error.message : String(error);
              await finalise(/403|denied|refusal/i.test(text) ? "denied" : "failed", undefined, /402/.test(text) ? "credits" : "gateway_error");
            },
          });
          return await withTrixieRunId(result.toUIMessageStreamResponse({ sendReasoning: false, onError: (error) => error instanceof Error ? error.message : "Trixie could not answer that question." }), runIdFetch);
        } catch (error) {
          if (ctx) await (ctx.supabase as any).rpc("finalise_trixie_usage", { _reservation_id: ctx.reservationId, _status: "failed", _error_code: "request_error" });
          return errorResponse(error);
        }
      },
    },
  },
});