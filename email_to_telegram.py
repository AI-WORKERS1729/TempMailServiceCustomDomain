#!/usr/bin/env python3
import os
import json
import requests
import telebot

# === LOAD .env ===
_DOTENV_VALUES = {}


def _clean_env_value(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1].strip()
    return value.split("#", 1)[0].strip()


def _load_dotenv(path=".env"):
    """Simple .env loader — no extra dependencies needed."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = _clean_env_value(value)
            _DOTENV_VALUES.setdefault(key, []).append(value)
            os.environ.setdefault(key, value)

_load_dotenv()


def _required_token(env_name):
    token = _clean_env_value(os.environ.get(env_name, ""))
    compact_token = "".join(token.split())
    if compact_token != token:
        print(f"WARNING: Removed whitespace from {env_name}. Fix .env so the token has no spaces.")
    if not compact_token:
        raise SystemExit(f"Missing {env_name} in .env")
    if ":" not in compact_token:
        raise SystemExit(f"Invalid {env_name}: expected a Telegram bot token like 123456:ABC...")
    return compact_token

# === CONFIGURATION ===
BOT_TOKEN  = _required_token("BOT_TOKEN")
CHAT_ID    = _clean_env_value(os.environ.get("CHAT_ID", ""))

# Ollama Cloud — API key + base URL from .env
def _split_env_values(value):
    return [
        _clean_env_value(item)
        for item in value.replace(";", ",").split(",")
        if _clean_env_value(item)
    ]


def _add_unique(values, value):
    if value and value not in values:
        values.append(value)


def _env_values(env_name):
    values = []
    for value in _DOTENV_VALUES.get(env_name, []):
        for item in _split_env_values(value):
            _add_unique(values, item)

    for item in _split_env_values(os.environ.get(env_name, "")):
        _add_unique(values, item)

    return values


def _load_ollama_api_keys():
    keys = []

    # Preferred explicit list: OLLAMA_API_KEYS=key1,key2,key3
    for env_name in ("OLLAMA_API_KEYS", "Ollama_Api_keys"):
        for key in _env_values(env_name):
            _add_unique(keys, key)

    # Backward-compatible primary key.
    for env_name in ("Ollama_Api_key", "OLLAMA_API_KEY"):
        for key in _env_values(env_name):
            _add_unique(keys, key)

    # Direct .env additions: Ollama_Api_key_2=... / OLLAMA_API_KEY_2=...
    for index in range(1, 51):
        for env_name in (f"Ollama_Api_key_{index}", f"OLLAMA_API_KEY_{index}"):
            for key in _env_values(env_name):
                _add_unique(keys, key)

    return keys


def _should_try_next_ollama_key(status_code, response_text):
    text = response_text.lower()
    limit_markers = ("limit", "quota", "credit", "billing", "usage", "rate")
    if status_code in (401, 429):
        return True
    if status_code in (402, 403) and any(marker in text for marker in limit_markers):
        return True
    return False


OLLAMA_API_KEYS = _load_ollama_api_keys()
# env stores e.g. "http://ollama.com/api"  →  endpoint = base + "/chat"
_OLLAMA_BASE    = _clean_env_value(os.environ.get("Ollama_Api_url", "https://api.ollama.com/api")).rstrip("/")
OLLAMA_ENDPOINT = f"{_OLLAMA_BASE}/chat"
OLLAMA_MODEL    = "gemini-3-flash-preview:cloud"

EMAILS_FILE     = "emails.json"
ATTACHMENTS_DIR = "attachments"
HTML_DIR        = "html_emails"
THREADS_FILE    = "threads.json"   # {"Thread Name": <message_thread_id>, ...}

bot = telebot.TeleBot(BOT_TOKEN)


# ── persistence helpers ──────────────────────────────────────────────────────

def load_emails():
    if not os.path.exists(EMAILS_FILE):
        return []
    with open(EMAILS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_emails(emails):
    with open(EMAILS_FILE, "w", encoding="utf-8") as f:
        json.dump(emails, f, indent=2)


def load_threads() -> dict:
    """Return {thread_name: message_thread_id} from threads.json."""
    if not os.path.exists(THREADS_FILE):
        return {}
    with open(THREADS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_threads(threads: dict):
    with open(THREADS_FILE, "w", encoding="utf-8") as f:
        json.dump(threads, f, indent=2)


# ── Telegram forum-topic helpers ─────────────────────────────────────────────

def create_forum_topic(name: str) -> int | None:
    """Create a private-chat forum topic (Bot API ≥ 9.4) and return its thread id."""
    try:
        topic = bot.create_forum_topic(CHAT_ID, name)
        return topic.message_thread_id
    except Exception as e:
        print(f"❌ Could not create forum topic '{name}': {e}")
        return None


def get_or_create_thread(thread_name: str) -> int | None:
    """Return existing thread id or create a new topic and persist it."""
    threads = load_threads()
    if thread_name in threads:
        return threads[thread_name]

    thread_id = create_forum_topic(thread_name)
    if thread_id is not None:
        threads[thread_name] = thread_id
        save_threads(threads)
        print(f"✅ Created new thread: '{thread_name}' (id={thread_id})")
    return thread_id


# ── Ollama kimi-k2.6:cloud classifier ────────────────────────────────────────

def classify_email_thread(email: dict, existing_threads: list[str]) -> str | None:
    """
    Ask kimi-k2.6:cloud which thread this email belongs to.
    Returns an existing thread name, a new short label, or None on failure.
    Strongly prefers existing threads over creating new ones.
    """
    thread_list = "\n".join(f"  • {n}" for n in existing_threads) if existing_threads else "  (none yet)"

    prompt = (
        "You are an email-organisation assistant.\n"
        "Given an incoming email, decide which thread / label it should go into.\n\n"
        f"Existing threads:\n{thread_list}\n\n"
        f"Incoming email:\n"
        f"  From   : {email.get('from', '')}\n"
        f"  To     : {email.get('to', '')}\n"
        f"  Subject: {email.get('subject', '')}\n"
        f"  Body   : {email.get('content', '')[:600]}\n\n"
        "Rules:\n"
        "  1. If the email clearly fits an existing thread, return ONLY that exact thread name.\n"
        "  2. Only suggest a NEW thread name if no existing thread is remotely relevant.\n"
        "  3. New names must be short (≤ 30 chars), descriptive, title-cased "
        "(e.g. 'GitHub Alerts', 'Bank Statements', 'Work').\n"
        "  4. Return ONLY the thread name — no quotes, no explanation.\n\n"
        "Thread name:"
    )

    key_attempts = OLLAMA_API_KEYS or [None]
    last_error = None

    for index, api_key in enumerate(key_attempts, start=1):
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            resp = requests.post(
                OLLAMA_ENDPOINT,
                headers=headers,
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
                timeout=90,
            )
        except requests.RequestException as e:
            print(f"Ollama request failed: {e}")
            return None

        if resp.status_code == 200:
            data = resp.json()
            # Ollama /api/chat returns {"message": {"content": "..."}}
            name = data.get("message", {}).get("content", "").strip().strip('"').strip("'")
            return name[:128] if name else None
        last_error = f"{resp.status_code}: {resp.text[:200]}"
        has_next_key = index < len(key_attempts)
        if has_next_key and _should_try_next_ollama_key(resp.status_code, resp.text):
            print(f"Ollama key {index}/{len(key_attempts)} returned {resp.status_code}; trying next key.")
            continue

        if len(key_attempts) > 1 and index == len(key_attempts):
            print(f"Ollama API failed for all configured keys. Last response: {last_error}")
        elif len(key_attempts) > 1:
            print(f"Ollama API returned {last_error}; not retrying because this does not look like a key limit.")
        else:
            print(f"Ollama API returned {last_error}")
        return None


# ── main send function ────────────────────────────────────────────────────────

def send_email_to_telegram(email: dict):
    # 1. Classify email into a thread
    threads = load_threads()
    thread_name = classify_email_thread(email, list(threads.keys()))

    thread_id = None
    if thread_name:
        thread_id = get_or_create_thread(thread_name)
        print(f"📂 Routing to thread: '{thread_name}' (id={thread_id})")
    else:
        print("⚠️ Classification failed — sending without thread.")

    # 2. Build message
    msg  = "📧 *New Email Received!*\n"
    msg += f"🟢 *From*    : `{email.get('from')}`\n"
    msg += f"🔵 *To*      : `{email.get('to')}`\n"
    msg += f"📅 *Date*    : `{email.get('date')}`\n"
    msg += f"✉️ *Subject* : *{email.get('subject')}*\n"
    msg += f"\n📄 *Body preview:*\n```\n{email.get('content', '').strip()[:2000]}\n```"

    # 3. Send text
    extra = {"message_thread_id": thread_id} if thread_id else {}
    try:
        bot.send_message(CHAT_ID, msg, parse_mode="Markdown", **extra)
    except Exception:
        # Fallback: send as plain text if Markdown parsing fails
        plain = msg.replace("*", "").replace("`", "").replace("_", "")
        bot.send_message(CHAT_ID, plain, **extra)

    # 4. Send attachments
    for att in email.get("attachments", []):
        filepath = os.path.join(ATTACHMENTS_DIR, att["filename"])
        if os.path.exists(filepath):
            try:
                with open(filepath, "rb") as fh:
                    bot.send_document(CHAT_ID, fh, caption=f"📎 {att['filename']}", **extra)
                os.remove(filepath)
                print(f"✅ Sent and deleted attachment: {att['filename']}")
            except Exception as e:
                print(f"❌ Failed to send attachment: {e}")

    # 5. Send HTML file
    print(f"🔍 DEBUG cwd={os.getcwd()}")
    print(f"🔍 DEBUG htmlFile key present: {'htmlFile' in email}, value: {email.get('htmlFile')}")
    if "htmlFile" in email:
        html_path = os.path.join(HTML_DIR, email["htmlFile"])
        print(f"🔍 DEBUG html_path={html_path}, exists={os.path.exists(html_path)}")
        if os.path.exists(html_path):
            try:
                with open(html_path, "rb") as fh:
                    bot.send_document(CHAT_ID, fh, caption="🌐 Raw HTML view of the email", **extra)
                os.remove(html_path)
                print(f"✅ Sent and deleted HTML file: {email['htmlFile']}")
            except Exception as e:
                print(f"❌ Failed to send HTML file: {e}")
        else:
            print(f"❌ HTML file not found at path: {html_path}")


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
