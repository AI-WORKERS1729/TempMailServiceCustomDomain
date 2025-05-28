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

```
📁 project/
├── email_to_telegram.py        # Python script to send emails to Telegram
├── server.js                   # Node.js SMTP server
├── emails.json                 # Stores pending emails
├── attachments/                # Email attachments
└── html_emails/                # HTML versions of email bodies
```
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
mkdir TempMail
cd TempMail
git clone https://github.com/MyTestLab1729/TempMailServiceCustomDomain.git .
sudo apt install python3.12-venv -y
python3 -m venv myvenv
```

### 2. Install Node.js Dependencies

```bash
npm install smtp-server mailparser
```

### 3. Install Python Dependencies

```bash
pip3 install pyTelegramBotAPI
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
sudo nano /etc/systemd/system/smtp-server.service
```
Add the following content to the service file:
```ini
[Unit]
Description=SMTP Server
After=network.target

[Service]
ExecStart=sudo /usr/bin/node /home/ubuntu/TempMail/index.js
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

## Optimally Run bot whitelist manager python script in background like the following:

To run a Python script as a **background service** in Ubuntu, you can create a **systemd service**. This is a clean, reliable way to run your script on startup or keep it always running.

---

### ✅ Step-by-Step Guide


#### 1. **Create a systemd service file**

Create a service file in `/etc/systemd/system/`:

```bash
sudo nano /etc/systemd/system/tempmail-configt.service
```

Paste the following content:

```ini
[Unit]
Description=My Python Script Service
After=network.target

[Service]
ExecStart=/home/ubuntu/myvenv/bin/python3 /home/ubuntu/TempMail/bot_whitelist_manager.py
WorkingDirectory=/home/ubuntu/TempMail
Restart=always
User=ubuntu
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

---

#### 2. **Reload systemd and enable the service**

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable tempmail-configt.service
sudo systemctl start tempmail-configt.service
```

---

#### 3. **Check the status and logs**

```bash
sudo systemctl status tempmail-configt.service
```

To see the logs:

```bash
journalctl -u tempmail-configt.service -f
```

---

To secure your Node.js SMTP server against hijacking and set up free, auto-renewing SSL/TLS certificates on an AWS EC2 instance, you need to implement TLS (Transport Layer Security) in your server configuration and use Certbot with Let's Encrypt for certificate management.

## Guide: Setting Up Free Let's Encrypt Certificates on EC2 with Auto-Renewal

This guide assumes you are using an **Ubuntu** or **Amazon Linux 2** EC2 instance and have a **domain name** pointing to your EC2 instance's **Elastic IP address**.

### 1. Prerequisites

* **EC2 Instance:** A running EC2 instance.
* **Domain Name:** A registered domain name (e.g., `yourdomain.com`).
* **DNS A Record:** An 'A' record in your DNS settings pointing `yourdomain.com` (and potentially `mail.yourdomain.com` or similar) to your EC2 instance's **Elastic IP address**.
* **Security Group:** Ensure your EC2 instance's security group allows inbound traffic on:
    * **Port 25 (SMTP):** For receiving emails.
    * **Port 80 (HTTP):** Required by Certbot for the `http-01` validation challenge.
    * **Port 443 (HTTPS):** Required by Certbot for the `tls-alpn-01` or `http-01` challenge.
    * **Port 22 (SSH):** For accessing your instance.

### 2. Install Certbot

Certbot is the tool used to obtain and renew Let's Encrypt certificates. The recommended way to install it is using `snap`.

**For Ubuntu:**

```bash
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

**For Amazon Linux 2 (If snap isn't preferred):**

```bash
sudo yum install -y python3 augeas-libs
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot
sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot
```

### 3. Obtain the Certificate 📜

We'll use the **standalone** method. This method temporarily spins up a small web server on port 80 or 443 to prove you control the domain. **If you have another web server (like Nginx or Apache) running, you should use its specific Certbot plugin (e.g., `--nginx` or `--apache`) or the `webroot` method instead.**

If you *don't* have a web server running, or can temporarily stop it:

```bash
# Make sure no other service is using port 80 before running this
# sudo systemctl stop nginx # (Example: if nginx is running)

sudo certbot certonly --standalone -d yourdomain.com --email your-email@yourdomain.com --agree-tos --non-interactive

# If you stopped a service, restart it now
# sudo systemctl start nginx # (Example)
```

* Replace `yourdomain.com` with your actual domain name.
* Replace `your-email@yourdomain.com` with your email for renewal notices.
* You can add multiple `-d` flags for multiple domains/subdomains (e.g., `-d yourdomain.com -d www.yourdomain.com -d mail.yourdomain.com`).

If successful, Certbot will save your certificate and private key in `/etc/letsencrypt/live/yourdomain.com/`.

* `fullchain.pem`: Your certificate + intermediate certificates. (Use this for `cert` in Node.js)
* `privkey.pem`: Your private key. (Use this for `key` in Node.js)

**Important:** These files are owned by `root` and have restricted permissions. Your Node.js process will need permission to read them. You can either run your Node.js server as root ( **not recommended for production** ) or, a better approach:

* Create a dedicated user/group for your Node.js app.
* Copy the certificates to a location accessible by your app (and update paths in the code).
* Set up a `cron` job or systemd timer that runs *after* Certbot renewal to copy the new certs and set permissions, then restart your Node.js server.
* Alternatively, grant read access to a specific group that your Node.js user belongs to (be careful with private key permissions).

### 4. Set Up Auto-Renewal 🔄

Let's Encrypt certificates are valid for 90 days. Certbot usually sets up automatic renewal for you.

* **If you installed with `snap`:** Snap handles this automatically via a systemd timer.
* **If you installed with `pip`/OS packages:** A cron job or systemd timer is often added.

You can verify and test the renewal process:

```bash
# Check if the timer/cron job exists
sudo systemctl list-timers | grep certbot # (For systemd)
sudo ls /etc/cron.d/certbot # (For cron)

# Perform a dry run to test renewal (doesn't actually renew but checks if it *would*)
sudo certbot renew --dry-run
```

If the dry run succeeds, auto-renewal should work. The renewal process usually checks twice a day and only renews if your certificate is within 30 days of expiring.

**Important for Standalone:** The auto-renewal process *also* needs port 80. If you have a persistent web server, you'll need to add `--pre-hook` and `--post-hook` commands to your `certbot renew` command (or configure them in `/etc/letsencrypt/renewal/yourdomain.com.conf`) to stop and restart your web server during renewal. If you *only* have your Node.js SMTP server (which doesn't use port 80), the standalone renewal should work without hooks.

### 5. Start Your Secure Node.js Server

1.  **Update the Node.js code** with the correct paths to your `privkey.pem` and `fullchain.pem` in the `SSL_OPTIONS` section.
2.  **Ensure you have `npm install smtp-server mailparser`**.
3.  **Run your Node.js server.** You might need `sudo` if you are listening on port 25 (a privileged port) and haven't set up port forwarding or granted capabilities:

    ```bash
    sudo node your_server_script.js
    ```

    (Consider using a process manager like `pm2` to run your Node.js app as a service and manage permissions more effectively in a production environment).

Your SMTP server is now running, requires `STARTTLS` for secure connections, and will reject unencrypted authentication attempts. You have free, automatically renewing SSL certificates securing your server.


