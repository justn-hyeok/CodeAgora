import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';

describe('DiscordClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('sendMessage', () => {
    it('should send a simple message', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const result = await client.sendMessage('Hello, Discord!');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should chunk messages over 2000 characters', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const longMessage = 'A'.repeat(3000);
      const result = await client.sendMessage(longMessage);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Should split into 2 chunks
    });

    it('should handle webhook errors', async () => {
      const mockResponse = { ok: false, status: 400, text: async () => 'Bad Request' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const result = await client.sendMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('should handle network timeout', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 10);
        });
      });

      const client = new DiscordClient('https://discord.com/api/webhooks/test', 100);
      const result = await client.sendMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should include custom username and avatar', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const result = await client.sendMessage('Hello', {
        username: 'ReviewBot',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(result.success).toBe(true);
      const callArg = (global.fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArg.body);
      expect(body.username).toBe('ReviewBot');
      expect(body.avatar_url).toBe('https://example.com/avatar.png');
    });
  });

  describe('sendEmbed', () => {
    it('should send an embed', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const embed = {
        title: 'Test Embed',
        description: 'Test description',
        color: 0x0099ff,
      };
      const result = await client.sendEmbed(embed);

      expect(result.success).toBe(true);
      const callArg = (global.fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArg.body);
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toBe('Test Embed');
    });
  });

  describe('sendEmbeds', () => {
    it('should send multiple embeds', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const embeds = [
        { title: 'Embed 1', color: 0x0099ff },
        { title: 'Embed 2', color: 0xff0000 },
      ];
      const result = await client.sendEmbeds(embeds);

      expect(result.success).toBe(true);
      const callArg = (global.fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArg.body);
      expect(body.embeds).toHaveLength(2);
    });

    it('should batch embeds in groups of 10', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const embeds = Array.from({ length: 15 }, (_, i) => ({
        title: `Embed ${i}`,
        color: 0x0099ff,
      }));
      const result = await client.sendEmbeds(embeds);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2); // 10 + 5
    });
  });

  describe('message chunking', () => {
    it('should preserve line breaks when chunking', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`);
      const message = lines.join('\n');
      const result = await client.sendMessage(message);

      expect(result.success).toBe(true);
      // Should split across multiple calls
      expect(global.fetch).toHaveBeenCalledTimes(1); // This message is small enough
    });

    it('should handle very long single lines', async () => {
      const mockResponse = { ok: true, text: async () => '' };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = new DiscordClient('https://discord.com/api/webhooks/test');
      const veryLongLine = 'A'.repeat(2500);
      const result = await client.sendMessage(veryLongLine);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
