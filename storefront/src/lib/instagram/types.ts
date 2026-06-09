export const INSTAGRAM_HANDLE = "pimetiket";
export const INSTAGRAM_PROFILE_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: InstagramMediaType;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp?: string;
}

export interface InstagramFeedPost {
  id: string;
  imageUrl: string;
  permalink: string;
  altText: string | null;
  caption: string | null;
}

export type InstagramFeedSource = "api" | "slots" | "gallery" | "empty";

export interface InstagramFeedResponse {
  posts: InstagramFeedPost[];
  source: InstagramFeedSource;
  handle: string;
}
