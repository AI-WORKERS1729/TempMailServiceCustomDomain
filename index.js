const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const EMAILS_FILE = "emails.json";
const ATTACHMENTS_DIR = "attachments";
const HTML_DIR = "html_emails";
const WHITELIST_FILE = "whitelist.txt";
const BLACKLIST_FILE = "blacklist.txt"; // <-- Added Blacklist file

// --- IMPORTANT: Update these paths to your Let's Encrypt certificates ---
const LETS_ENCRYPT_DIR = "/etc/letsencrypt/live/yourdomain.com/"; // <--- CHANGE 'yourdomain.com'
let SSL_OPTIONS;
try {
    SSL_OPTIONS = {
        key: fs.readFileSync(path.join(LETS_ENCRYPT_DIR, "privkey.pem")),
        cert: fs.readFileSync(path.join(LETS_ENCRYPT_DIR, "fullchain.pem")),
    };
    console.log("✅ SSL Certificates loaded successfully.");
} catch (sslError) {
    console.error("❌ CRITICAL ERROR: Could not load SSL certificates!");
    console.error(`   Please ensure 'privkey.pem' and 'fullchain.pem' exist in ${LETS_ENCRYPT_DIR}`);
    console.error("   The server will NOT start without SSL certificates.");
    process.exit(1); // Exit if SSL certs can't be loaded
}
// ---------------------------------------------------------------------

if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR);
if (!fs.existsSync(HTML_DIR)) fs.mkdirSync(HTML_DIR);

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
    } catch (error) {
        console.error("❌ Error writing emails.json:", error);
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
    authOptional: true,
    allowInsecureAuth: false,

    // --- Authentication Handler (Optional but Recommended) ---
    onAuth(auth, session, cb) {
        console.log(`🔐 Auth attempt: ${auth.username}`);
        // Implement your actual authentication logic here
        if (auth.username === "user" && auth.password === "password") {
            console.log(`🔑 User ${auth.username} authenticated.`);
            cb(null, { user: auth.username });
        } else {
            console.log(`🚫 Auth failed for ${auth.username}.`);
            cb(new Error("Invalid username or password"));
        }
    },

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

            const htmlFilename = `${Date.now()}_email.html`;
            const htmlPath = path.join(HTML_DIR, htmlFilename);
            const htmlContent = parsed.html || parsed.textAsHtml || `<pre>${parsed.text || ""}</pre>`;
            try {
                fs.writeFileSync(htmlPath, htmlContent);
            } catch (writeErr) {
                console.error(`❌ Error saving HTML email ${htmlFilename}:`, writeErr);
            }


            const email = {
                id: Date.now().toString(),
                from: parsed.from?.text || "Unknown",
                to: parsed.to?.text || "Unknown",
                date: new Date().toISOString(),
                subject: parsed.subject || "No Subject",
                content: parsed.text || parsed.html || "",
                attachments,
                htmlFile: htmlFilename,
                remoteAddress: session.remoteAddress,
                tls: session.secure ? "Yes" : "No"
            };

            const emails = readEmails();
            emails.push(email);
            writeEmails(emails);

            console.log(`✅ Email stored: ${email.subject}`);

            // Ensure you trust this script and its environment.
            exec("/home/ubuntu/myvenv/bin/python3 email_to_telegram.py", (error, stdout, stderr) => {
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

server.listen(25, () => {
    console.log("🚀 Secure SMTP server running on port 25 (TLS/Whitelist/Blacklist enabled)");
});
