import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleImportLinkedin } from "./server/routes/importLinkedin";
import { handleResearchPerson } from "./server/routes/researchPerson";
import { handleConnectionIntelligence } from "./server/routes/connectionIntelligence";
import { handleMentorshipMatch } from "./server/routes/mentorshipMatch";
import { handleConversationStrategy } from "./server/routes/conversationStrategy";
import {
  handlePitchEvaluation,
  handlePitchTranscribe,
  handlePitchSessionsList,
} from "./server/routes/pitchCoach";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const isImportLinkedin = url.pathname === "/api/profile/import-linkedin";
      const isResearchPerson = url.pathname === "/api/research-person";
      const connResearchMatch = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/research/);
      const connIntelMatch = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/intelligence/);
      const connMentorshipMatch = url.pathname.match(
        /^\/api\/connections\/([^/?#]+)\/mentorship-match/,
      );
      const isMentorshipMatch = url.pathname === "/api/mentorship-match";
      const connStrategyMatch = url.pathname.match(
        /^\/api\/connections\/([^/?#]+)\/conversation-strategy/,
      );
      const isStrategyMatch = url.pathname === "/api/conversation-strategy";
      const connPitchMatch = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/pitch/);
      const isPitchEvaluate =
        url.pathname === "/api/pitch/evaluate" || url.pathname.endsWith("/pitch/evaluate");
      const isPitchTranscribe =
        url.pathname === "/api/pitch/transcribe" || url.pathname.endsWith("/pitch/transcribe");
      const isPitchSessions =
        url.pathname.endsWith("/pitch/sessions") || url.pathname.endsWith("/pitch-sessions");

      if (isPitchTranscribe) {
        return await handlePitchTranscribe(request);
      }
      if (isPitchEvaluate) {
        return await handlePitchEvaluation(request);
      }
      if (isPitchSessions && request.method === "GET") {
        return await handlePitchSessionsList(request);
      }
      if (connPitchMatch) {
        if (request.method === "GET") {
          return await handlePitchSessionsList(request);
        }
        return await handlePitchEvaluation(request);
      }
      if (connIntelMatch) {
        return await handleConnectionIntelligence(request);
      }
      if (connMentorshipMatch || isMentorshipMatch) {
        return await handleMentorshipMatch(request);
      }
      if (connStrategyMatch || isStrategyMatch) {
        return await handleConversationStrategy(request);
      }
      if (isImportLinkedin) {
        return await handleImportLinkedin(request);
      }
      if (isResearchPerson || connResearchMatch) {
        return await handleResearchPerson(request);
      }

      if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
        return new Response(
          JSON.stringify({ success: false, error: `API endpoint not found: ${url.pathname}` }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
