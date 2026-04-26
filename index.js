const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const APP_DIR = __dirname;

function loadEnvFile(filePath = path.join(__dirname, ".env")) {
    if (!fs.existsSync(filePath)) return;

    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex === -1) continue;

        const key = trimmed.slice(0, equalsIndex).trim();
        let value = trimmed.slice(equalsIndex + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadEnvFile();

const EMAILS_FILE = path.join(APP_DIR, "emails.json");
const ATTACHMENTS_DIR = path.join(APP_DIR, "attachments");
const HTML_DIR = path.join(APP_DIR, "html_emails");
const WHITELIST_FILE = path.join(APP_DIR, "whitelist.txt");
const BLACKLIST_FILE = path.join(APP_DIR, "blacklist.txt"); // <-- Added Blacklist file
const PYTHON_BIN = process.env.PYTHON_BIN || "/home/ubuntu/myvenv/bin/python3";
const EMAIL_TO_TELEGRAM_SCRIPT = path.join(APP_DIR, "email_to_telegram.py");

// TLS_KEY_PATH/TLS_CERT_PATH can be set in .env or PM2 env config.
const LETS_ENCRYPT_DIR = process.env.LETS_ENCRYPT_DIR || "/etc/letsencrypt/live/mail.atraj.it";
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || path.join(LETS_ENCRYPT_DIR, "privkey.pem");
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || path.join(LETS_ENCRYPT_DIR, "fullchain.pem");
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "25", 10);
if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) {
    console.error(`Invalid SMTP_PORT: ${process.env.SMTP_PORT}`);
    process.exit(1);
}

let SSL_OPTIONS;
try {
    SSL_OPTIONS = {
        key: fs.readFileSync(TLS_KEY_PATH),
        cert: fs.readFileSync(TLS_CERT_PATH),
    };
    console.log("SSL certificates loaded successfully.");
} catch (sslError) {
    console.error("CRITICAL ERROR: Could not load SSL certificates.");
    console.error(`   Key path: ${TLS_KEY_PATH}`);
    console.error(`   Cert path: ${TLS_CERT_PATH}`);
    console.error(`   Details: ${sslError.code || "ERROR"} ${sslError.message}`);
    console.error("   The server will NOT start without SSL certificates.");
    process.exit(1); // Exit if SSL certs can't be loaded
}
// ---------------------------------------------------------------------

function ensureWritableDirectory(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        fs.accessSync(dirPath, fs.constants.W_OK);
    } catch (error) {
        console.error(`CRITICAL ERROR: Directory is not writable: ${dirPath}`);
        console.error(`   Details: ${error.code || "ERROR"} ${error.message}`);
        process.exit(1);
    }
}

function ensureWritableFile(filePath, defaultContent) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, defaultContent);
        }
        fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
        console.error(`CRITICAL ERROR: File is not readable/writable: ${filePath}`);
        console.error(`   Details: ${error.code || "ERROR"} ${error.message}`);
        process.exit(1);
    }
}

ensureWritableDirectory(ATTACHMENTS_DIR);
ensureWritableDirectory(HTML_DIR);
ensureWritableFile(EMAILS_FILE, "[]\n");

function readEmails() {
    if (!fs.existsSync(EMAILS_FILE)) return [];
    try {
        const data = fs.readFileSync(EMAILS_FILE, "utf8");
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("❌ Error reading emails.json:", error);
        return [];
    }
}

function writeEmails(emails) {
    try {
        fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
        return true;
    } catch (error) {
        console.error("❌ Error writing emails.json:", error);
        return false;
    }
}

function readWhitelist() {
    if (!fs.existsSync(WHITELIST_FILE)) return [];
    try {
        return fs.readFileSync(WHITELIST_FILE, "utf8")
            .split("\n")
            .map(line => line.trim().toLowerCase())
            .filter(line => line);
    } catch (error) {
        console.error("❌ Error reading whitelist.txt:", error);
        return [];
    }
}

// --- Added readBlacklist function ---
function readBlacklist() {
    if (!fs.existsSync(BLACKLIST_FILE)) return []; // If file doesn't exist, blacklist is empty
    try {
        return fs.readFileSync(BLACKLIST_FILE, "utf8")
            .split("\n")
            .map(line => line.trim().toLowerCase()) // Read, trim, lowercase
            .filter(line => line); // Filter out empty lines
    } catch (error) {
        console.error("❌ Error reading blacklist.txt:", error);
        return []; // Return empty list on error
    }
}
// ------------------------------------

const server = new SMTPServer({
    // --- Security Enhancements ---
    secure: false,
    key: SSL_OPTIONS.key,
    cert: SSL_OPTIONS.cert,
    disabledCommands: ["AUTH"],
    authOptional: true,
    allowInsecureAuth: false,

    onConnect(session, cb) {
        console.log(`📥 Connected: ${session.remoteAddress}`);
        cb(); // Accept connection
    },

    // --- Modified onMailFrom to include Blacklist check ---
    onMailFrom(address, session, cb) {
        const sender = address.address.toLowerCase();
        console.log(`📤 From: ${sender}`);

        const blacklist = readBlacklist();

        if (blacklist.includes(sender)) {
            console.log(`❌ Rejected: Sender ${sender} is blacklisted.`);
            // Return a specific SMTP error code (554 Transaction failed / Access denied)
            const err = new Error("Sender is blacklisted and not allowed.");
            err.responseCode = 554;
            return cb(err);
        }

        // If not blacklisted, proceed.
        cb();
    },
    // ----------------------------------------------------

    onRcptTo(address, session, cb) {
        const recipient = address.address.toLowerCase();
        const whitelist = readWhitelist();

        if (!whitelist.includes(recipient)) {
            console.log(`❌ Rejected: Recipient ${recipient} not in whitelist.`);
            const err = new Error("Recipient not in whitelist.");
            err.responseCode = 550; // Mailbox unavailable is a common code
            return cb(err);
        }

        console.log(`✅ Accepted: Recipient ${recipient}`);
        cb(); // Accept recipient
    },

    onData(stream, session, cb) {
        console.log("📡 Receiving message...");

        simpleParser(stream, {}, (err, parsed) => {
            if (err) {
                console.error("❌ Parse Error:", err);
                return cb(err);
            }

            const attachments = [];
            parsed.attachments.forEach(att => {
                // Sanitize filename (basic example: remove path separators)
                const safeFilename = path.basename(att.filename || 'unknown_attachment');
                const filename = `${Date.now()}_${safeFilename}`;
                const filepath = path.join(ATTACHMENTS_DIR, filename);
                try {
                    fs.writeFileSync(filepath, att.content);
                    attachments.push({ filename });
                    console.log(`📎 Saved attachment: ${filename}`);
                } catch (writeErr) {
                    console.error(`❌ Error saving attachment ${filename}:`, writeErr);
                }
            });

            let htmlFilename = null;
            const candidateHtmlFilename = `${Date.now()}_email.html`;
            const htmlPath = path.join(HTML_DIR, candidateHtmlFilename);
            const htmlContent = parsed.html || parsed.textAsHtml || `<pre>${parsed.text || ""}</pre>`;
            try {
                fs.writeFileSync(htmlPath, htmlContent);
                htmlFilename = candidateHtmlFilename;
            } catch (writeErr) {
                console.error(`❌ Error saving HTML email ${candidateHtmlFilename}:`, writeErr);
            }


            const email = {
                id: Date.now().toString(),
                from: parsed.from?.text || "Unknown",
                to: parsed.to?.text || "Unknown",
                date: new Date().toISOString(),
                subject: parsed.subject || "No Subject",
                content: parsed.text || parsed.html || "",
                attachments,
                remoteAddress: session.remoteAddress,
                tls: session.secure ? "Yes" : "No"
            };
            if (htmlFilename) {
                email.htmlFile = htmlFilename;
            }

            const emails = readEmails();
            emails.push(email);
            if (!writeEmails(emails)) {
                const storageErr = new Error("Could not store email on server.");
                storageErr.responseCode = 451;
                return cb(storageErr);
            }

            console.log(`✅ Email stored: ${email.subject}`);

            // Ensure you trust this script and its environment.
            execFile(PYTHON_BIN, [EMAIL_TO_TELEGRAM_SCRIPT], { cwd: APP_DIR }, (error, stdout, stderr) => {
                if (error) console.error(`❌ Python error: ${error.message}`);
                if (stderr) console.error(`⚠️ Python stderr: ${stderr}`);
                if (stdout) console.log(`📤 Python output:\n${stdout}`);
            });

            cb();
        });
    },

    onError(err) {
        console.error('❌ Server Error:', err.message);
    }
});

server.listen(SMTP_PORT, () => {
    console.log(`🚀 Secure SMTP server running on port ${SMTP_PORT} (TLS/Whitelist/Blacklist enabled)`);
});
