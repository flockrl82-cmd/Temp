# Temporal Mail - Production Deployment Guide

This guide describes how to deploy the Temporary Email platform on an Ubuntu VPS, including setting up the mail infrastructure to receive real emails.

## 1. Prerequisites
- An Ubuntu 22.04 or 24.04 VPS
- A domain name (e.g., `tempmail.com`) pointing to your VPS IP
- Docker and Docker Compose installed

## 2. DNS Configuration
Set up the following DNS records for your domain:
- **A Record**: `mail.tempmail.com` -> `[VPS_IP]`
- **A Record**: `@` -> `[VPS_IP]`
- **MX Record**: `@` -> `mail.tempmail.com` (Priority 10)
- **TXT Record (SPF)**: `@` -> `v=spf1 mx a -all`

## 3. Clone and Start
1. Clone the repository to your VPS.
2. Edit `prisma/schema.prisma` and switch the provider from `"sqlite"` to `"postgresql"`.
3. Fill your `.env` based on `.env.example`.
4. Run `docker-compose up -d`.

By default, the built-in embedded SMTP server in `server.ts` will listen on port `2525`. 
To receive real internet emails, you must run it on port `25`, OR run Postfix/Nginx and route traffic.

## 4. Port 25 Redirection (Preferred for simple setups)
If you do not want to install Postfix, you can simply redirect port 25 to your Node.js container's 2525 port using `iptables` so internet mail reaches the embedded server directly.
```bash
sudo iptables -t nat -A PREROUTING -p tcp --dport 25 -j REDIRECT --to-port 2525
```

## 5. Nginx Reverse Proxy for Web UI
Set up an Nginx reverse proxy to add Let's Encrypt SSL to your web UI.

```nginx
server {
    server_name tempmail.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tempmail.com
```

## 6. (Alternative) Postfix Integration
If you wish to run a full Postfix setup instead of iptables proxying, configure Postfix to relay emails to the Node SMTP server running on port `2525`.

Edit `/etc/postfix/main.cf`:
```
myhostname = mail.tempmail.com
mydomain = tempmail.com
myorigin = $mydomain
inet_interfaces = all
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
relayhost = [127.0.0.1]:2525
```
Restart postfix: `sudo systemctl restart postfix`

## 7. DKIM, SPF, & DMARC
To ensure maximum deliverability if you ever send mail (currently the platform only receives), install OpenDKIM to sign outgoing messages and add the following TXT DMARC record:
`_dmarc.tempmail.com TXT "v=DMARC1; p=none;"`
