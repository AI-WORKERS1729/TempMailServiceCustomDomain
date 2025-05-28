#!/usr/bin/env python3
import telebot
import os

# --- SECURITY WARNING ---
# Your BOT_TOKEN is like a password. Do NOT share it or commit it to public
# repositories. Consider using environment variables or a secure vault to store it.
BOT_TOKEN = ''
# --- END WARNING ---

ADMIN_CHAT_IDS = ['']  # Only users with these IDs can interact.
WHITELIST_FILE = 'whitelist.txt'
BLACKLIST_FILE = 'blacklist.txt'

bot = telebot.TeleBot(BOT_TOKEN)

# --- Admin check ---
def is_admin(msg):
    """Checks if the message sender is in the ADMIN_CHAT_IDS list."""
    return str(msg.from_user.id) in ADMIN_CHAT_IDS

def send_unauthorized(msg):
    """Sends a standard 'not authorized' message."""
    bot.reply_to(msg, "🚫 Access Denied. You are not authorized to interact with this bot.")

# --- File Handling Functions ---
def load_list(filename):
    """Loads a list from a file."""
    if not os.path.exists(filename):
        return []
    try:
        with open(filename, 'r') as f:
            return [line.strip().lower() for line in f if line.strip()]
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []

def save_list(filename, emails):
    """Saves a list to a file."""
    try:
        with open(filename, 'w') as f:
            f.write('\n'.join(sorted(set(emails))) + '\n')
    except Exception as e:
        print(f"Error saving {filename}: {e}")

# --- Utility Commands ---

@bot.message_handler(commands=['cancel'])
def cancel_command(msg):
    """Cancels any ongoing 'next step' operation."""
    if not is_admin(msg): return send_unauthorized(msg)
    bot.clear_step_handler_by_chat_id(msg.chat.id)
    bot.reply_to(msg, "✅ Any active command has been cancelled.")

# --- Admin-Only Commands ---

@bot.message_handler(commands=['start'])
def start(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    bot.reply_to(msg, (
        "👋 Welcome, Admin! This bot manages email whitelists and blacklists.\n"
        "Use /help to see available commands.\n"
        "Use /cancel to stop any ongoing operation.\n"
        "The email inbox bot is @AtrajitWorkBot"
    ))

@bot.message_handler(commands=['help'])
def help_command(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    bot.reply_to(msg, (
        "🛠️ *Available Admin Commands:*\n\n"
        "*General:*\n"
        "/cancel - Cancel the current operation\n\n" # <-- Added /cancel
        "*Whitelist (Allow Recipient):*\n"
        "/addemail - Add to whitelist\n"
        "/removeemail - Remove from whitelist\n"
        "/listemails - View whitelist\n"
        "/clearwhitelist - Clear whitelist\n\n"
        "*Blacklist (Block Sender):*\n"
        "/addblacklist - Add to blacklist\n"
        "/removeblacklist - Remove from blacklist\n"
        "/listblacklist - View blacklist\n"
        "/clearblacklist - Clear blacklist"
    ), parse_mode="Markdown")

# --- Whitelist Admin Commands ---
@bot.message_handler(commands=['addemail'])
def ask_for_add_email(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    sent = bot.reply_to(msg, "✉️ Please enter the email to *add* to the *whitelist* (or /cancel):", parse_mode="Markdown")
    bot.register_next_step_handler(sent, process_add_email)

def process_add_email(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    # Check if the user wants to cancel during this step
    if msg.text and msg.text.strip().lower() == '/cancel':
        return cancel_command(msg)
    email = msg.text.strip().lower()
    emails = load_list(WHITELIST_FILE)
    if email not in emails:
        emails.append(email)
        save_list(WHITELIST_FILE, emails)
        bot.reply_to(msg, f"✅ Whitelisted: `{email}`", parse_mode="Markdown")
    else:
        bot.reply_to(msg, f"⚠️ `{email}` already whitelisted.", parse_mode="Markdown")

@bot.message_handler(commands=['removeemail'])
def ask_for_remove_email(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    sent = bot.reply_to(msg, "✉️ Please enter the email to *remove* from the *whitelist* (or /cancel):", parse_mode="Markdown")
    bot.register_next_step_handler(sent, process_remove_email)

def process_remove_email(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    if msg.text and msg.text.strip().lower() == '/cancel':
        return cancel_command(msg)
    email = msg.text.strip().lower()
    emails = load_list(WHITELIST_FILE)
    if email in emails:
        emails.remove(email)
        save_list(WHITELIST_FILE, emails)
        bot.reply_to(msg, f"✅ Removed from whitelist: `{email}`", parse_mode="Markdown")
    else:
        bot.reply_to(msg, f"⚠️ `{email}` not found in whitelist.", parse_mode="Markdown")

@bot.message_handler(commands=['listemails'])
def list_emails(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    emails = load_list(WHITELIST_FILE)
    if not emails: return bot.reply_to(msg, "⚠️ Whitelist is empty.")
    response = "*📜 Whitelisted Emails:*\n" + '\n'.join(f"`{e}`" for e in emails)
    bot.reply_to(msg, response, parse_mode="Markdown")

@bot.message_handler(commands=['clearwhitelist'])
def clear_whitelist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    confirm = bot.reply_to(msg, "⚠️ Are you *sure* you want to clear the **whitelist**? Reply `YES` to confirm (or /cancel).", parse_mode="Markdown")
    bot.register_next_step_handler(confirm, process_clear_whitelist)

def process_clear_whitelist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    if msg.text and msg.text.strip().lower() == '/cancel':
        return cancel_command(msg)
    if msg.text.strip().upper() == "YES":
        save_list(WHITELIST_FILE, [])
        bot.reply_to(msg, "✅ Whitelist cleared.")
    else:
        bot.reply_to(msg, "❌ Cancelled. Whitelist not modified.")

# --- Blacklist Admin Commands ---
@bot.message_handler(commands=['addblacklist'])
def ask_for_add_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    sent = bot.reply_to(msg, "✉️ Please enter the email to *add* to the *blacklist* (or /cancel):", parse_mode="Markdown")
    bot.register_next_step_handler(sent, process_add_blacklist)

def process_add_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    if msg.text and msg.text.strip().lower() == '/cancel':
        return cancel_command(msg)
    email = msg.text.strip().lower()
    emails = load_list(BLACKLIST_FILE)
    if email not in emails:
        emails.append(email)
        save_list(BLACKLIST_FILE, emails)
        bot.reply_to(msg, f"✅ Blacklisted: `{email}`", parse_mode="Markdown")
    else:
        bot.reply_to(msg, f"⚠️ `{email}` already blacklisted.", parse_mode="Markdown")

@bot.message_handler(commands=['removeblacklist'])
def ask_for_remove_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    sent = bot.reply_to(msg, "✉️ Please enter the email to *remove* from the *blacklist* (or /cancel):", parse_mode="Markdown")
    bot.register_next_step_handler(sent, process_remove_blacklist)

def process_remove_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    if msg.text and msg.text.strip().lower() == '/cancel':
        return cancel_command(msg)
    email = msg.text.strip().lower()
    emails = load_list(BLACKLIST_FILE)
    if email in emails:
        emails.remove(email)
        save_list(BLACKLIST_FILE, emails)
        bot.reply_to(msg, f"✅ Removed from blacklist: `{email}`", parse_mode="Markdown")
    else:
        bot.reply_to(msg, f"⚠️ `{email}` not found in blacklist.", parse_mode="Markdown")

@bot.message_handler(commands=['listblacklist'])
def list_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    emails = load_list(BLACKLIST_FILE)
    if not emails: return bot.reply_to(msg, "⚠️ Blacklist is empty.")
    response = "*📜 Blacklisted Emails:*\n" + '\n'.join(f"`{e}`" for e in emails)
    bot.reply_to(msg, response, parse_mode="Markdown")

@bot.message_handler(commands=['clearblacklist'])
def clear_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    confirm = bot.reply_to(msg, "⚠️ Are you *sure* you want to clear the **blacklist**? Reply `YES` to confirm (or /cancel).", parse_mode="Markdown")
    bot.register_next_step_handler(confirm, process_clear_blacklist)

def process_clear_blacklist(msg):
    if not is_admin(msg): return send_unauthorized(msg)
    if msg.text and msg.text.strip().lower() == '/cancel':
        return cancel_command(msg)
    if msg.text.strip().upper() == "YES":
        save_list(BLACKLIST_FILE, [])
        bot.reply_to(msg, "✅ Blacklist cleared.")
    else:
        bot.reply_to(msg, "❌ Cancelled. Blacklist not modified.")

# --- Catch-all for unknown commands or text ---
@bot.message_handler(func=lambda message: True)
def handle_other_messages(msg):
    """Handles any message that isn't a known command."""
    if not is_admin(msg):
        send_unauthorized(msg)
    else:
        bot.reply_to(msg, "🤔 Unknown command or text. Use /help to see available admin commands.")

# --- Start polling ---
print("🤖 Bot starting with MAXIMUM admin controls & cancel feature...")
bot.polling()
print("🤖 Bot stopped.")
