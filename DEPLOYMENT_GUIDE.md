# CryptoWin Pro - 100% FREE Deployment Guide (Bina Kisi Paise Ke)

Agar Render $7 mang raha hai, toh ghabrane ki zaroorat nahi! Render par ghalti se Paid "Starter" plan select ho gaya hoga, ya Render ne card verification maangi hogi.

Aapke paas **100% FREE** tareeqe hain jahan **ek rupiya bhi nahi lagta aur na hi credit card chahiye hota hai**:

---

## Option 1: Hugging Face Spaces (100% FREE Forever - Sub se Best & Recommended)
Hugging Face har user ko **16GB RAM + 2 CPU bilkul muft** deta hai jahan Node.js / Docker 24/7 bina kisi rukawat ke chalta hai. Koi credit card nahi chahiye!

1. [huggingface.co](https://huggingface.co) par ja kar **Free Account** banayein.
2. Top right par apni profile icon par click karein aur **"New Space"** select karein.
3. Space details dein:
   - **Space name**: `cryptowin`
   - **License**: `mit` ya `apache-2.0`
   - **Select the Space SDK**: **"Docker"** -> **"Blank"** choose karein.
   - **Space Hardware**: **Free (CPU basic · 2 vCPU · 16 GB)**
4. Ab **"Files"** tab par ja kar project ki files upload kar dein (ya GitHub se sync karein).
   - Humne aapke project mein `Dockerfile` pehle se bana kar rakh di hai!
5. 2 minute mein automatically build ho kar aapko aapka public direct URL mil jayega:
   `https://[username]-cryptowin.hf.space`
   - **Result**: Na koi AI Studio ka banner hoga, na kisi ko pata chalega ke kahan bana hai. Direct clean game open hogi!

---

## Option 2: Render ka Asal FREE Tier ($0/month)
Render par $7 is liye aaya kyunke wahan by default "$7 Starter" select ho jata hai:
1. Jab aap Render par "New Web Service" banate hain, toh page ke neechay scroll karein.
2. Wahan plans ki list hoti hai:
   - ⚪ Starter ($7/mo)
   - 🔘 **Free ($0/mo)**  <-- Is radio button ko select karein!
3. Free select karne se **$0** ho jayega.

---

## Option 3: Koyeb (100% Free Cloud)
1. [koyeb.com](https://www.koyeb.com) par free sign up karein (GitHub se login).
2. "Create App" -> "GitHub" choose karein.
3. Free Eco instance select karein ($0).
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Deploy karein!


---

## Tareeqa 2: Personal VPS (DigitalOcean / AWS / Hostinger / Contabo)

Production level betting / game app ke liye VPS best hai:

```bash
# 1. Server par Node.js 20+ aur PM2 install karein:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 2. Code clone karein aur dependencies install karein:
git clone <AAPKI_REPO_URL>
cd applet
npm install

# 3. Production build banayein:
npm run build

# 4. App ko background mein 24/7 run karein:
pm2 start "npm start" --name "cryptowin"
pm2 save
pm2 startup
```

---

## Admin Panel URL
- Production mein Admin Panel: `https://your-domain.com/cwp-master-786`
