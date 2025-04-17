const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const EMAILS_FILE = "emails.json";
const ATTACHMENTS_DIR = "attachments";

if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR);
}

function readEmails() {
    if (!fs.existsSync(EMAILS_FILE)) return [];
    const data = fs.readFileSync(EMAILS_FILE, "utf8");
    return data ? JSON.parse(data) : [];
}

function writeEmails(emails) {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
}

const server = new SMTPServer({
    allowInsecureAuth: true,
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onConnect(session, cb) {
        console.log(`📥 Connected: Session ID - ${session.id}`);
        cb();
    },
    onMailFrom(address, session, cb) {
        console.log(`📤 From: ${address.address}`);
        cb();
    },
    onRcptTo(address, session, cb) {
        console.log(`📩 To: ${address.address}`);
        cb();
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

            const email = {
                id: Date.now().toString(),
                from: parsed.from?.text || "Unknown",
                to: parsed.to?.text || "Unknown",
                date: new Date().toISOString(),
                subject: parsed.subject || "No Subject",
                content: parsed.text || parsed.html || "",
                attachments
            };

            const emails = readEmails();
            emails.push(email);
            writeEmails(emails);

            console.log(`✅ Email stored: ${email.subject}`);

            // Trigger the Python script in background
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
