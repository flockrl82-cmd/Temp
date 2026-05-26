import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { PrismaClient } from "@prisma/client";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());
const PORT = 3000;
const SMTP_PORT = 2525;

const prisma = new PrismaClient();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/ws' });

// Track connected WebSocket clients by domain/address
interface ExtendedWebSocket extends WebSocket {
  subscriptions: string[];
}

wss.on("connection", (ws: ExtendedWebSocket) => {
  ws.subscriptions = [];
  
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "SUBSCRIBE" && data.address) {
        if (!ws.subscriptions.includes(data.address)) {
          ws.subscriptions.push(data.address);
        }
      }
    } catch (e) {
      console.error("Invalid WS message", e);
    }
  });
});

function notifyClients(address: string, eventType: string, payload: any) {
  wss.clients.forEach((client) => {
    const extClient = client as ExtendedWebSocket;
    if (extClient.subscriptions?.includes(address) && extClient.readyState === WebSocket.OPEN) {
      extClient.send(JSON.stringify({ type: eventType, address, payload }));
    }
  });
}

// SMTP Server Configuration
const smtpServer = new SMTPServer({
  authOptional: true, // For temp mail, we don't need auth to receive
  onData(stream, session, callback) {
    simpleParser(stream)
      .then(async (parsed) => {
        try {
          const recipients = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
          
          for (const recipient of recipients) {
            // Check ServerSettings for allowed domains (optional security)
            // For now, accept dynamically to allow users to use the generated address.
            
            const message = await prisma.message.create({
              data: {
                mailbox: {
                  connectOrCreate: {
                    where: { address: recipient },
                    create: { address: recipient }
                  }
                },
                fromText: parsed.from?.text || 'Unknown',
                fromEmail: parsed.from?.value[0]?.address || 'unknown@example.com',
                subject: parsed.subject || 'No Subject',
                textBody: parsed.text || '',
                htmlBody: parsed.html || parsed.textAsHtml || '',
                messageId: parsed.messageId || uuidv4(),
              }
            });

            console.log(`Received email for ${recipient} via SMTP`);
            notifyClients(recipient, "NEW_MAIL", message);
          }
          callback();
        } catch (dbErr) {
          console.error("Error saving email to DB:", dbErr);
          callback(dbErr as Error);
        }
      })
      .catch((err) => {
        console.error("Error parsing email:", err);
        callback(err);
      });
  }
});

smtpServer.listen(SMTP_PORT, () => {
  console.log(`Embedded SMTP server is listening on port ${SMTP_PORT}`);
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Create/Get a Mailbox
app.post("/api/mailbox", async (req, res) => {
  try {
    const { address } = req.body;
    let mailbox = await prisma.mailbox.findUnique({
      where: { address }
    });
    
    if (!mailbox) {
      mailbox = await prisma.mailbox.create({
        data: { address }
      });
    }
    res.json(mailbox);
  } catch (error) {
    res.status(500).json({ error: "Failed to create mailbox" });
  }
});

// Get Messages for a Mailbox
app.get("/api/mailbox/:address/messages", async (req, res) => {
  const { address } = req.params;
  try {
    const mailbox = await prisma.mailbox.findUnique({
      where: { address }
    });
    
    if (!mailbox) {
      return res.json([]); 
    }
    
    const messages = await prisma.message.findMany({
      where: { mailboxId: mailbox.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get Single Message Details
app.get("/api/messages/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const message = await prisma.message.findUnique({
      where: { id }
    });
    if (!message) return res.status(404).json({ error: "Message not found" });
    
    // Mark as read
    if (!message.read) {
      await prisma.message.update({
        where: { id },
        data: { read: true }
      });
    }
    
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch message" });
  }
});

// Delete Message
app.delete("/api/messages/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.message.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

app.get("/api/domains", async (req, res) => {
  try {
    const settings = await prisma.serverSettings.findFirst();
    let domains = ["temporalmail.local"];
    if (settings && settings.allowedDomains) {
      domains = settings.allowedDomains.split(",").map(d => d.trim());
    }
    res.json({ domains });
  } catch(error) {
    res.json({ domains: ["temporalmail.local"] });
  }
});


// Vite Middleware for Development / Static Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP/WS Server running on http://localhost:${PORT}`);
  });
}

startServer();
