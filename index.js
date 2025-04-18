// === SMTP Server Code (Node.js) ===

const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const EMAILS_FILE = "emails.json";
const ATTACHMENTS_DIR = "attachments";
const HTML_DIR = "html_emails";

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

const server = new SMTPServer({
    allowInsecureAuth: true,
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onConnect(session, cb) {
        console.log(`\uD83D\uDCE5 Connected: Session ID - ${session.id}`);
        cb();
    },
    onMailFrom(address, session, cb) {
        console.log(`\uD83D\uDCE4 From: ${address.address}`);
        cb();
    },
    onRcptTo(address, session, cb) {
        console.log(`\uD83D\uDCE9 To: ${address.address}`);
        cb();
    },
    onData(stream, session, cb) {
        console.log("\uD83D\uDCE1 Receiving message...");

        simpleParser(stream, {}, (err, parsed) => {
            if (err) {
                console.error("\u274C Parse Error:", err);
                return cb(err);
            }

            const attachments = [];
            parsed.attachments.forEach(att => {
                const filename = `${Date.now()}_${att.filename}`;
                const filepath = path.join(ATTACHMENTS_DIR, filename);
                fs.writeFileSync(filepath, att.content);
                attachments.push({ filename });
                console.log(`\uD83D\uDCCE Saved attachment: ${filename}`);
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

            console.log(`\u2705 Email stored: ${email.subject}`);

            // Trigger the Python script
            exec("/home/ubuntu/myvenv/bin/python3 email_to_telegram.py", (error, stdout, stderr) => {
                if (error) console.error(`\u274C Python error: ${error.message}`);
                if (stderr) console.error(`\u26A0\uFE0F Python stderr: ${stderr}`);
                if (stdout) console.log(`\uD83D\uDCE4 Python output:\n${stdout}`);
            });

            cb();
        });
    }
});

server.listen(25, () => {
    console.log("\uD83D\uDE80 SMTP server running on port 25");
});
