/**
 * Discord webhook types
 */

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export interface DiscordSendOptions {
  username?: string;
  avatarUrl?: string;
}

export type DiscordSendResult =
  | { success: true }
  | { success: false; error: string };
