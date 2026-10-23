import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

export function apiDevMiddlewarePlugin(): Plugin {
  const handleApiRequest = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || "";
    const pathname = rawUrl.split("?")[0];

    // Only process /api/* routes
    if (!pathname.startsWith("/api/")) {
      return next();
    }

    const connResearchMatch = pathname.match(/^\/api\/connections\/([^/?#]+)\/research/);
    const isResearchPerson = pathname === "/api/research-person";
    const isImportLinkedin = pathname === "/api/profile/import-linkedin";
    const connIntelMatch = pathname.match(/^\/api\/connections\/([^/?#]+)\/intelligence/);
    const connMentorshipMatch = pathname.match(/^\/api\/connections\/([^/?#]+)\/mentorship-match/);
    const isMentorshipMatch = pathname === "/api/mentorship-match";
    const connStrategyMatch = pathname.match(
      /^\/api\/connections\/([^/?#]+)\/conversation-strategy/,
    );
    const isStrategyMatch = pathname === "/api/conversation-strategy";

    const meetingDeleteMatch = pathname.match(/^\/api\/meetings\/([^/?#]+)$/);

    const connPitchMatch = pathname.match(/^\/api\/connections\/([^/?#]+)\/pitch/);
    const isPitchEvaluate =
      pathname === "/api/pitch/evaluate" || pathname.endsWith("/pitch/evaluate");
    const isPitchTranscribe =
      pathname === "/api/pitch/transcribe" || pathname.endsWith("/pitch/transcribe");
    const isPitchSessions =
      pathname.endsWith("/pitch/sessions") || pathname.endsWith("/pitch-sessions");

    const isHandledApi =
      isImportLinkedin ||
      isResearchPerson ||
      connResearchMatch ||
      connIntelMatch ||
      connMentorshipMatch ||
      isMentorshipMatch ||
      connStrategyMatch ||
      isStrategyMatch ||
      meetingDeleteMatch ||
      connPitchMatch ||
      isPitchEvaluate ||
      isPitchTranscribe ||
      isPitchSessions;

    if (!isHandledApi) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, error: `API endpoint not found: ${pathname}` }));
      return;
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      // Read raw body buffer if method has body
      let bodyBuffer = Buffer.alloc(0);
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
        }
        bodyBuffer = Buffer.concat(chunks);
      }

      // Check if JSON body
      const contentType = req.headers["content-type"] || "";
      let finalBody: BodyInit | undefined = undefined;

      if (req.method !== "GET" && req.method !== "HEAD") {
        if (contentType.includes("application/json") && bodyBuffer.length > 0) {
          try {
            const parsed = JSON.parse(bodyBuffer.toString("utf8"));
            if (connResearchMatch && !parsed.connectionId) {
              parsed.connectionId = decodeURIComponent(connResearchMatch[1]);
            }
            if (connIntelMatch && !parsed.connectionId) {
              parsed.connectionId = decodeURIComponent(connIntelMatch[1]);
            }
            if (connMentorshipMatch && !parsed.connectionId) {
              parsed.connectionId = decodeURIComponent(connMentorshipMatch[1]);
            }
            if (connStrategyMatch && !parsed.connectionId) {
              parsed.connectionId = decodeURIComponent(connStrategyMatch[1]);
            }
            if (connPitchMatch && !parsed.connectionId) {
              parsed.connectionId = decodeURIComponent(connPitchMatch[1]);
            }
            finalBody = JSON.stringify(parsed);
          } catch {
            finalBody = bodyBuffer;
          }
        } else if (bodyBuffer.length > 0) {
          finalBody = bodyBuffer;
        }
      }

      const protocol = req.headers["x-forwarded-proto"] || "http";
      const host = req.headers.host || "localhost:3000";
      const fullUrl = `${protocol}://${host}${req.url}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v) {
          if (Array.isArray(v)) {
            v.forEach((val) => headers.append(k, val));
          } else {
            headers.set(k, v);
          }
        }
      }

      const webRequest = new Request(fullUrl, {
        method: req.method,
        headers,
        body: finalBody,
        // @ts-expect-error duplex is required in node fetch for streaming/buffers
        duplex: "half",
      });

      let webResponse: Response;
      if (isPitchTranscribe) {
        const { handlePitchTranscribe } = await import("./routes/pitchCoach");
        webResponse = await handlePitchTranscribe(webRequest);
      } else if (isPitchEvaluate) {
        const { handlePitchEvaluation } = await import("./routes/pitchCoach");
        webResponse = await handlePitchEvaluation(webRequest);
      } else if (isPitchSessions || (connPitchMatch && req.method === "GET")) {
        const { handlePitchSessionsList } = await import("./routes/pitchCoach");
        webResponse = await handlePitchSessionsList(webRequest);
      } else if (connPitchMatch) {
        const { handlePitchEvaluation } = await import("./routes/pitchCoach");
        webResponse = await handlePitchEvaluation(webRequest);
      } else if (connIntelMatch) {
        const { handleConnectionIntelligence } = await import("./routes/connectionIntelligence");
        webResponse = await handleConnectionIntelligence(webRequest);
      } else if (connMentorshipMatch || isMentorshipMatch) {
        const { handleMentorshipMatch } = await import("./routes/mentorshipMatch");
        webResponse = await handleMentorshipMatch(webRequest);
      } else if (connStrategyMatch || isStrategyMatch) {
        const { handleConversationStrategy } = await import("./routes/conversationStrategy");
        webResponse = await handleConversationStrategy(webRequest);
      } else if (isImportLinkedin) {
        const { handleImportLinkedin } = await import("./routes/importLinkedin");
        webResponse = await handleImportLinkedin(webRequest);
      } else if (meetingDeleteMatch && req.method === "DELETE") {
        const { handleMeetingDelete } = await import("./routes/meetings");
        webResponse = await handleMeetingDelete(webRequest, meetingDeleteMatch[1]);
      } else {
        const { handleResearchPerson } = await import("./routes/researchPerson");
        webResponse = await handleResearchPerson(webRequest);
      }

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });
      const resBody = await webResponse.text();
      res.end(resBody);
      return;
    } catch (err) {
      console.error("[API Dev Middleware Error]:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : "API request failed.",
        }),
      );
      return;
    }
  };

  return {
    name: "coldconnect-api-dev-middleware",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || "";
        const pathname = rawUrl.split("?")[0];
        if (pathname.startsWith("/api/") || pathname === "/api") {
          return handleApiRequest(req, res, next);
        }
        next();
      });
    },
  };
}
