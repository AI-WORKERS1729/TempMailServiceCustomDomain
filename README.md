# TempMailServiceCustomDomain

Absolutely! Here's a clean, beginner-friendly `README.md` for your project that guides anyone to set up your personal **Email to Telegram** notification system:

---

# 📬 Email to Telegram Notifier

This project sets up a local SMTP server that receives emails, saves them (with attachments and HTML content), and instantly sends the email content and attachments to a private Telegram chat.

---

## 🚀 Features

- Receive emails directly via SMTP.
- Parse and store email content and attachments.
- Send:
  - Markdown summary of email body.
  - Attachments as files.
  - Raw HTML email view as `.html` file (opens like browser mail view).
- Automatically clean up processed files.

---

## 📁 Folder Structure


📁 project/
├── email_to_telegram.py        # Python script to send emails to Telegram
├── server.js                   # Node.js SMTP server
├── emails.json                 # Stores pending emails
├── attachments/                # Email attachments
└── html_emails/                # HTML versions of email bodies

---

## 🧰 Prerequisites

- Node.js + npm
- Python 3.x
- pip
- A Telegram Bot Token + your Telegram Chat ID

### Install all prerequisites
```bash
sudo apt install -y git nodejs npm python3 python3-pip
```
---

## 🛠️ Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/email-to-telegram.git
cd email-to-telegram
```

### 2. Install Node.js Dependencies

```bash
npm install smtp-server mailparser
```

### 3. Install Python Dependencies

```bash
pip install pyTelegramBotAPI
```

### 4. Edit Configuration

- **`server.js`** and **`email_to_telegram.py`** contain configuration variables you need to update:

#### Replace the following:

```js
// In server.js
exec("/full/path/to/python3 email_to_telegram.py");
```

```py
# In email_to_telegram.py
BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
CHAT_ID = "YOUR_TELEGRAM_USER_ID"
```

- You can get your Chat ID by sending a message to your bot and visiting:
  ```
  https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
  ```

---

## 🚦 Running the Project

### 1. Start the SMTP Server (Node.js)

```bash
node server.js
```

### 2. The SMTP server listens on port `25`. You can now send test emails using tools like:

```bash
swaks --to your@domain.com --from test@example.com --server localhost --data "Subject: Hello\n\nThis is a test email."
```

### 3. Python Script is Triggered Automatically

Whenever a mail is received:
- Telegram will get:
  - A Markdown summary
  - Attachments
  - A `.html` file for full email rendering

---

### Run `index.js` in Background

```bash
sudo nano /etc/systemd/system/email-to-telegram.service
```
Add the following content to the service file:
```bash
[Unit]
Description=Email to Telegram
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/ubuntu/TempMail/email_to_telegram.py
WorkingDirectory=/home/ubuntu/TempMail
StandardOutput=inherit
StandardError=inherit
Restart=always
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target

```

## 🧹 Cleanup & Logs

- Attachments are auto-deleted after sending.
- HTML files are also removed.
- Processed emails are removed from `emails.json`.

---

## 🔒 Security

- Run your script on a private machine or cloud instance (e.g., AWS EC2).
- If you expose your SMTP server publicly, secure it with credentials and SSL/TLS.

---

## 💡 Ideas for Extension

- Upload HTML to temporary web hosting and send public link.
- Email filtering by sender or subject.
- Daily email summary in Telegram.

---

## 🙌 Acknowledgements

Created by atrajit-sarkar — with Python, Node.js, and a pinch of creativity.  
Inspired by the idea of bringing elegant email experience directly to Telegram.

---

## 📜 License

MIT License — free to use, modify, and share.
```

---

Let me know if you'd like this README turned into a stylized webpage or if you'd like GitHub Actions integration to automate updates.
