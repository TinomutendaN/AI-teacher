// Redirects to the APK attached to the latest GitHub release.
// We go through the GitHub API (instead of the public
// github.com/.../releases/download link) because the API hands back a
// fresh, signed file URL, which keeps working when the public link fails.

const REPO = "TinomutendaN/AI-teacher";
const APK_NAME = "lingua.apk";

function githubHeaders(accept: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "lingua-download",
  };
  // Optional: raises GitHub's API rate limit from 60 to 5000 requests/hour.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function GET(): Promise<Response> {
  try {
    const releaseRes = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: githubHeaders("application/vnd.github+json") },
    );
    if (!releaseRes.ok) {
      return Response.json(
        { error: `Could not load release (${releaseRes.status})` },
        { status: 502 },
      );
    }

    const release: { assets: { name: string; url: string }[] } =
      await releaseRes.json();
    const apk = release.assets.find((asset) => asset.name === APK_NAME);
    if (!apk) {
      return Response.json({ error: "APK not found" }, { status: 404 });
    }

    // Asking for the raw file makes GitHub reply with a redirect to a signed URL.
    const assetRes = await fetch(apk.url, {
      headers: githubHeaders("application/octet-stream"),
      redirect: "manual",
    });
    const fileUrl = assetRes.headers.get("location");
    if (!fileUrl) {
      return Response.json(
        { error: `Could not get download link (${assetRes.status})` },
        { status: 502 },
      );
    }

    return Response.redirect(fileUrl, 302);
  } catch (error) {
    console.error("[download] Failed:", error);
    return Response.json({ error: "Download failed" }, { status: 500 });
  }
}
