const HEADER = "X-Lovable-AIG-Run-ID";

export function createTrixieRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let settled = false;
  const ready = new Promise<string | undefined>((resolve) => { resolveRunId = resolve; });
  const publish = (value?: string) => {
    runId ||= value?.trim() || undefined;
    if (!settled) { settled = true; resolveRunId(runId); }
  };
  if (runId) publish(runId);
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(HEADER)) headers.set(HEADER, runId);
      try {
        const response = await fetch(input, { ...init, headers });
        publish(response.headers.get(HEADER) ?? undefined);
        return response;
      } catch (error) { publish(); throw error; }
    },
    getRunId: () => runId,
    waitForRunId: () => runId ? Promise.resolve(runId) : ready,
  };
}

export function incomingTrixieRunId(request: Request) {
  return request.headers.get(HEADER)?.trim() || undefined;
}

export async function withTrixieRunId(response: Response, gateway: ReturnType<typeof createTrixieRunIdFetch>) {
  const runId = gateway.getRunId() ?? await gateway.waitForRunId();
  if (!runId) return response;
  const headers = new Headers(response.headers);
  headers.set(HEADER, runId);
  headers.set("Access-Control-Expose-Headers", HEADER);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}