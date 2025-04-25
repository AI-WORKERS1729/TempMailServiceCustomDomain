#!/usr/bin/env python3
import telebot
import os

BOT_TOKEN = ''
ADMIN_CHAT_IDS = ['']  # Add your Telegram user ID(s) here as strings
WHITELIST_FILE = 'whitelist.txt'

bot = telebot.TeleBot(BOT_TOKEN)

def is_admin(msg):
    return str(msg.from_user.id) in ADMIN_CHAT_IDS

def load_whitelist():
    if not os.path.exists(WHITELIST_FILE):
        return []
    with open(WHITELIST_FILE, 'r') as f:
        return [line.strip().lower() for line in f if line.strip()]

def save_whitelist(emails):
    with open(WHITELIST_FILE, 'w') as f:
        f.write('\n'.join(sorted(set(emails))) + '\n')

@bot.message_handler(commands=['start'])
def start(msg):
    bot.reply_to(msg, ("👋 Welcome! Use /help to see available commands.\n"
                       "This bot manages a whitelist of emails.\n"
                       "Only admins can add or remove emails right now.\n"
                       "The email inbox bot is @AtrajitWorkBot"))

@bot.message_handler(commands=['help'])
def help_command(msg):
    bot.reply_to(msg, (
        "🛠️ Available Commands:\n"
        "/addemail - add an email to the whitelist\n"
        "/removeemail - remove an email from the whitelist\n"
        ))

    
    
@bot.message_handler(commands=['addemail'])
def add_email(msg):
    if not is_admin(msg):
        return bot.reply_to(msg, "🚫 You are not authorized to use this command.")
    try:
        email = msg.text.split(' ')[1].lower()
        emails = load_whitelist()
        if email not in emails:
            emails.append(email)
            save_whitelist(emails)
            bot.reply_to(msg, f"✅ Added: `{email}`", parse_mode="Markdown")
        else:
            bot.reply_to(msg, f"⚠️ `{email}` already exists.", parse_mode="Markdown")
    except:
        bot.reply_to(msg, "❌ Usage: `/addemail email@example.com`", parse_mode="Markdown")

@bot.message_handler(commands=['removeemail'])
def remove_email(msg):
    if not is_admin(msg):
        return bot.reply_to(msg, "🚫 You are not authorized to use this command.")
    try:
        email = msg.text.split(' ')[1].lower()
        emails = load_whitelist()
        if email in emails:
            emails.remove(email)
            save_whitelist(emails)
            bot.reply_to(msg, f"✅ Removed: `{email}`", parse_mode="Markdown")
        else:
            bot.reply_to(msg, f"⚠️ `{email}` not found.", parse_mode="Markdown")
    except:
        bot.reply_to(msg, "❌ Usage: `/removeemail email@example.com`", parse_mode="Markdown")

@bot.message_handler(commands=['listemails'])
def list_emails(msg):
    if not is_admin(msg):
        return bot.reply_to(msg, "🚫 You are not authorized to use this command.")
    emails = load_whitelist()
    response = "*📜 Whitelisted Emails:*\n" + '\n'.join(f"`{e}`" for e in emails)
    bot.reply_to(msg, response or "⚠️ No emails in whitelist.", parse_mode="Markdown")

bot.polling()
