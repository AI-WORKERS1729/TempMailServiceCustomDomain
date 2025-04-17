#!/usr/bin/env python3
import os
import json
import telebot

# === CONFIGURATION ===
BOT_TOKEN = ""
CHAT_ID = ""
EMAILS_FILE = "emails.json"
ATTACHMENTS_DIR = "attachments"

bot = telebot.TeleBot(BOT_TOKEN)


def load_emails():
    if not os.path.exists(EMAILS_FILE):
        return []
    with open(EMAILS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_emails(emails):
    with open(EMAILS_FILE, "w", encoding="utf-8") as f:
        json.dump(emails, f, indent=2)


def send_email_to_telegram(email):
    msg = f"📧 *New Email Received!*\n"
    msg += f"🟢 *From*    : `{email.get('from')}`\n"
    msg += f"🔵 *To*      : `{email.get('to')}`\n"
    msg += f"📅 *Date*    : `{email.get('date')}`\n"
    msg += f"✉️ *Subject* : *{email.get('subject')}*\n"
    msg += f"\n📄 *Body:*\n```\n{email.get('content', '').strip()[:2000]}\n```"

    bot.send_message(CHAT_ID, msg, parse_mode="Markdown")

    for att in email.get("attachments", []):
        filepath = os.path.join(ATTACHMENTS_DIR, att["filename"])
        if os.path.exists(filepath):
            try:
                with open(filepath, "rb") as file:
                    bot.send_document(CHAT_ID, file, caption=f"📎 {att['filename']}")
                os.remove(filepath)
                print(f"✅ Sent and deleted attachment: {att['filename']}")
            except Exception as e:
                print(f"❌ Failed to send attachment: {e}")


def process_emails():
    emails = load_emails()
    if not emails:
        print("📭 No emails to send.")
        return

    remaining = []
    for email in emails:
        try:
            send_email_to_telegram(email)
        except Exception as e:
            print(f"❌ Error sending email: {e}")
            remaining.append(email)

    save_emails(remaining)


if __name__ == "__main__":
    process_emails()
