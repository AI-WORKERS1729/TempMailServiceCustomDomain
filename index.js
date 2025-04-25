const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const EMAILS_FILE = "emails.json";
const ATTACHMENTS_DIR = "attachments";
const HTML_DIR = "html_emails";
const WHITELIST_FILE = "whitelist.txt";

if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR);
if (!fs.existsSync(HTML_DIR)) fs.mkdirSync(HTML_DIR);

function readEmails() {
    if (!fs.existsSync(EMAILS_FILE)) return [];
    const data = fs.readFileSync(EMAILS_FILE, "utf8");
    return data ? JSON.parse(data) : [];
}

function writeEmails(emails) {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
}

function readWhitelist() {
    if (!fs.existsSync(WHITELIST_FILE)) return [];
    return fs.readFileSync(WHITELIST_FILE, "utf8")
        .split("\n")
        .map(line => line.trim().toLowerCase())
        .filter(line => line);
}

const server = new SMTPServer({
    allowInsecureAuth: true,
    authOptional: true,
    disabledCommands: ["STARTTLS"],

    onConnect(session, cb) {
        console.log(`📥 Connected: ${session.remoteAddress}`);
        cb(); // Accept connection
    },

    onMailFrom(address, session, cb) {
        console.log(`📤 From: ${address.address}`);
        cb(); // We’re not filtering by sender
    },

    onRcptTo(address, session, cb) {
        const whitelist = readWhitelist();
        const recipient = address.address.toLowerCase();

        if (!whitelist.includes(recipient)) {
            console.log(`❌ Rejected: recipient ${recipient} not in whitelist.`);
            return cb(new Error("Recipient not in whitelist."));
        }

        console.log(`✅ Accepted: recipient ${recipient}`);
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
                const filename = `${Date.now()}_${att.filename}`;
                const filepath = path.join(ATTACHMENTS_DIR, filename);
                fs.writeFileSync(filepath, att.content);
                attachments.push({ filename });
                console.log(`📎 Saved attachment: ${filename}`);
            });

            const htmlFilename = `${Date.now()}_email.html`;
            const htmlPath = path.join(HTML_DIR, htmlFilename);
            const htmlContent = parsed.html || parsed.textAsHtml || "<pre>" + parsed.text + "</pre>";
            fs.writeFileSync(htmlPath, htmlContent);

            const email = {
                id: Date.now().toString(),
                from: parsed.from?.text || "Unknown",
                to: parsed.to?.text || "Unknown",
                date: new Date().toISOString(),
                subject: parsed.subject || "No Subject",
                content: parsed.text || parsed.html || "",
                attachments,
                htmlFile: htmlFilename
            };

            const emails = readEmails();
            emails.push(email);
            writeEmails(emails);

            console.log(`✅ Email stored: ${email.subject}`);

            exec("/home/ubuntu/myvenv/bin/python3 email_to_telegram.py", (error, stdout, stderr) => {
                if (error) console.error(`❌ Python error: ${error.message}`);
                if (stderr) console.error(`⚠️ Python stderr: ${stderr}`);
                if (stdout) console.log(`📤 Python output:\n${stdout}`);
            });

            cb();
        });
    }
});

server.listen(25, () => {
    console.log("🚀 SMTP server running on port 25");
});
