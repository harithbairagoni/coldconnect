import { deleteFirestoreDoc } from "../utils/firestoreRest.ts";

export async function handleMeetingDelete(req: Request, meetingId: string): Promise<Response> {
  if (req.method !== "DELETE") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  if (!meetingId) {
    return new Response(JSON.stringify({ success: false, error: "Meeting ID is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Note: To delete a meeting, we need the userId to construct the path: users/{userId}/meetings/{meetingId}
    // But how do we get userId? We can decode the token or ask the frontend to send the userId.
    // Let's decode the JWT token (idToken) to get user_id.
    const base64Url = idToken.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    const payload = JSON.parse(jsonPayload);
    const userId = payload.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await deleteFirestoreDoc(`users/${userId}/meetings`, meetingId, idToken);

    return new Response(
      JSON.stringify({
        success: true,
        meetingId,
        message: "Meeting removed successfully.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Meeting delete error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to remove meeting.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
