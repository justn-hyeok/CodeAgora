import type {
  DiscordEmbed,
  DiscordSendOptions,
  DiscordSendResult,
  DiscordWebhookPayload,
} from './types.js';

/**
 * Discord webhook client for sending review results
 */
export class DiscordClient {
  private readonly webhookUrl: string;
  private readonly timeout: number;

  constructor(webhookUrl: string, timeout = 5000) {
    this.webhookUrl = webhookUrl;
    this.timeout = timeout;
  }

  /**
   * Send a simple text message to Discord
   */
  async sendMessage(
    content: string,
    options?: DiscordSendOptions
  ): Promise<DiscordSendResult> {
    // Discord has a 2000 character limit for content
    if (content.length <= 2000) {
      return this.sendWebhook({ content, ...this.formatOptions(options) });
    }

    // Split into chunks if over 2000 chars
    const chunks = this.chunkMessage(content, 2000);
    for (const chunk of chunks) {
      const result = await this.sendWebhook({
        content: chunk,
        ...this.formatOptions(options),
      });
      if (!result.success) {
        return result; // Return first error
      }
    }

    return { success: true };
  }

  /**
   * Send an embed (rich message) to Discord
   */
  async sendEmbed(
    embed: DiscordEmbed,
    options?: DiscordSendOptions
  ): Promise<DiscordSendResult> {
    return this.sendWebhook({
      embeds: [embed],
      ...this.formatOptions(options),
    });
  }

  /**
   * Send multiple embeds at once
   */
  async sendEmbeds(
    embeds: DiscordEmbed[],
    options?: DiscordSendOptions
  ): Promise<DiscordSendResult> {
    // Discord allows up to 10 embeds per message
    if (embeds.length <= 10) {
      return this.sendWebhook({
        embeds,
        ...this.formatOptions(options),
      });
    }

    // Split into batches of 10
    for (let i = 0; i < embeds.length; i += 10) {
      const batch = embeds.slice(i, i + 10);
      const result = await this.sendWebhook({
        embeds: batch,
        ...this.formatOptions(options),
      });
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  }

  /**
   * Low-level webhook send
   */
  private async sendWebhook(
    payload: DiscordWebhookPayload
  ): Promise<DiscordSendResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          error: `Discord webhook failed: ${response.status} ${errorText}`,
        };
      }

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: `Discord webhook timeout after ${this.timeout}ms`,
        };
      }
      return {
        success: false,
        error: `Discord webhook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Split message into chunks that fit Discord's 2000 char limit
   */
  private chunkMessage(content: string, maxLength: number): string[] {
    if (content.length <= maxLength) {
      return [content];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const lines = content.split('\n');

    for (const line of lines) {
      // If adding this line would exceed limit, save current chunk and start new one
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // If single line is too long, split it forcefully
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength - 20) {
            chunks.push(line.slice(i, i + maxLength - 20) + '...');
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Format send options into webhook payload fields
   */
  private formatOptions(
    options?: DiscordSendOptions
  ): Pick<DiscordWebhookPayload, 'username' | 'avatar_url'> {
    return {
      username: options?.username,
      avatar_url: options?.avatarUrl,
    };
  }
}
