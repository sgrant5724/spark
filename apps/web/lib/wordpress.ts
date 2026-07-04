import "server-only";

/**
 * WordPress REST adapter (FR-11), behind an interface so providers can be
 * swapped/stubbed. Auth: WordPress Application Passwords (Basic auth) — created
 * by the site owner, never by Spark.
 */

export type WpCredentials = { siteUrl: string; username: string; appPassword: string };

export type WpPublishPayload = {
  title: string;
  slug: string; // path segment only
  contentHtml: string;
  excerpt: string; // meta description
  status: "draft" | "publish";
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  /** Plugin-specific post meta (Squirrly/Rank Math/Yoast keys). WP ignores
   *  unregistered keys, so this is safe on sites without the plugin. */
  meta?: Record<string, string>;
};

export type WpPublishResult = { postId: number; link: string };

export interface WordPressAdapter {
  verify(): Promise<{ ok: boolean; detail: string }>;
  publish(payload: WpPublishPayload): Promise<WpPublishResult>;
}

function authHeader(c: WpCredentials): string {
  return "Basic " + Buffer.from(`${c.username}:${c.appPassword}`).toString("base64");
}

function apiBase(c: WpCredentials): string {
  return c.siteUrl.replace(/\/+$/, "") + "/wp-json/wp/v2";
}

export class WpRestAdapter implements WordPressAdapter {
  constructor(private readonly creds: WpCredentials) {}

  async verify(): Promise<{ ok: boolean; detail: string }> {
    try {
      const res = await fetch(`${apiBase(this.creds)}/users/me`, {
        headers: { authorization: authHeader(this.creds) },
      });
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status} from users/me` };
      const me = (await res.json()) as { name?: string };
      return { ok: true, detail: `Connected as ${me.name ?? "unknown user"}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  /** Upload a remote image into the WP media library; returns the media id. */
  private async uploadMedia(url: string, alt: string): Promise<number> {
    const img = await fetch(url);
    if (!img.ok) throw new Error(`Could not fetch featured image (${img.status}).`);
    const bytes = Buffer.from(await img.arrayBuffer());
    const type = img.headers.get("content-type") ?? "image/jpeg";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("svg") ? "svg" : "jpg";

    const res = await fetch(`${apiBase(this.creds)}/media`, {
      method: "POST",
      headers: {
        authorization: authHeader(this.creds),
        "content-type": type,
        "content-disposition": `attachment; filename="spark-featured.${ext}"`,
      },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Media upload failed (HTTP ${res.status}).`);
    const media = (await res.json()) as { id: number };

    // Set alt text on the attachment.
    await fetch(`${apiBase(this.creds)}/media/${media.id}`, {
      method: "POST",
      headers: {
        authorization: authHeader(this.creds),
        "content-type": "application/json",
      },
      body: JSON.stringify({ alt_text: alt }),
    });
    return media.id;
  }

  async publish(payload: WpPublishPayload): Promise<WpPublishResult> {
    let featuredMedia: number | undefined;
    if (payload.featuredImageUrl) {
      featuredMedia = await this.uploadMedia(
        payload.featuredImageUrl,
        payload.featuredImageAlt ?? payload.title,
      );
    }

    const res = await fetch(`${apiBase(this.creds)}/posts`, {
      method: "POST",
      headers: {
        authorization: authHeader(this.creds),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: payload.title,
        slug: payload.slug,
        content: payload.contentHtml,
        excerpt: payload.excerpt,
        status: payload.status,
        ...(featuredMedia ? { featured_media: featuredMedia } : {}),
        ...(payload.meta && Object.keys(payload.meta).length ? { meta: payload.meta } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WordPress publish failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    const post = (await res.json()) as { id: number; link: string };
    return { postId: post.id, link: post.link };
  }
}
