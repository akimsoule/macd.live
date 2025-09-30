import TelegramBot from "node-telegram-bot-api";

class CustomTelegramBot extends TelegramBot {
  private lastSent: Map<string, number> = new Map();
  private static readonly DEDUP_WINDOW_MS = 10_000;
  private chatId: string;

  constructor(
    token: string,
    chatId: string,
    options?: TelegramBot.ConstructorOptions
  ) {
    super(token, options);
    this.chatId = chatId;
  }

  send(text: string): Promise<TelegramBot.Message> {
    return this.sendMessage(this.chatId, text, { parse_mode: "Markdown" });
  }

  sendMessage(
    chatId: TelegramBot.ChatId,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    // Anti-spam: si le même message est envoyé au même chat < 5s, on ignore
    const key = `${String(chatId)}::${text}`;
    const now = Date.now();
    const last = this.lastSent.get(key) ?? 0;
    if (now - last < CustomTelegramBot.DEDUP_WINDOW_MS) {
      return Promise.resolve({} as TelegramBot.Message);
    }
    this.lastSent.set(key, now);

    if (process.env.APP_ENV === "production") {
      return super.sendMessage(chatId, text, options);
    } else {
      const message = {} as TelegramBot.Message;
      return Promise.resolve(message);
    }
  }
}

export const telegramClient = new CustomTelegramBot(
  process.env.TELEGRAM_KEY as string,
  process.env.TELEGRAM_GROUP_ID as string,
  {
    polling: false,
  }
);
