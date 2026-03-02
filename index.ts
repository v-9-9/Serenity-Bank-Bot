import { Client, GatewayIntentBits, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- إعدادات المسارات وأسماء الصور التي زودتني بها ---
const ASSETS_PATH = './assets/';
const ITEMS_PATH = './assets/items/';

const UI = {
    background: "Picsart_26-03-02_17-09-36-037.png",
    visa: "Picsart_26-03-02_16-46-22-498.png",
    arrowUp: "Picsart_26-03-02_16-41-02-511.png",
    arrowDown: "Picsart_26-03-02_16-41-24-257.png",
    stolenCash: "Picsart_26-03-02_16-46-32-604.png",
    earnedCash: "Picsart_26-03-02_16-45-58-007.png"
};

// --- قاعدة البيانات (رصيد، سجن، ألعاب) ---
let balances: { [key: string]: number } = {}; 
let jail = new Map<string, number>(); 
let cooldowns = new Map<string, number>();
let lastMarketPrices: { [key: string]: number } = {};

// --- قائمة الموارد (Items) ---
const itemsDB = [
    { id: "1000307463", name: "خام النحاس", rarity: "common", min: 1000, max: 5000 },
    { id: "1000307465", name: "حجر الكوارتز", rarity: "common", min: 2000, max: 8000 },
    { id: "1000307472", name: "سبيكة حديد", rarity: "rare", min: 15000, max: 40000 },
    { id: "1000307464", name: "كريستال خام", rarity: "rare", min: 20000, max: 55000 },
    { id: "1000307473", name: "سبيكة ذهب", rarity: "epic", min: 80000, max: 200000 },
    { id: "1000307466", name: "ياقوت أحمر", rarity: "epic", min: 100000, max: 350000 },
    { id: "1000307470", name: "الكتلة البنفسجية", rarity: "legendary", min: 500000, max: 2500000 },
    { id: "1000307469", name: "المرجان الطاقي", rarity: "legendary", min: 800000, max: 5000000 }
];

// --- قائمة الألعاب (22 لعبة) ---
const allGames = [
    { name: "سباق الهجن", type: "تنافسي" }, { name: "صيد اللؤلؤ", type: "نرد" },
    { name: "تحدي الصقور", type: "تنافسي" }, { name: "مزاد الصحراء", type: "تداول" },
    { name: "منجم الذهب", type: "قمار" }, { name: "بورصة السيرنيتي", type: "استثمار" },
    { name: "طاولة الحظ", type: "قمار" }, { name: "رهان الخيول", type: "قمار" },
    { name: "ملك النرد", type: "نرد" }, { name: "قنص الغزلان", type: "تنافسي" },
    { name: "استخراج النفط", type: "استثمار" }, { name: "سوق الأسهم", type: "تداول" },
    { name: "عجلة الحظ", type: "قمار" }, { name: "مبارزة السيوف", type: "تنافسي" },
    { name: "صيد السمك", type: "نرد" }, { name: "تجارة التوابل", type: "تداول" },
    { name: "منقب الكريستال", type: "قمار" }, { name: "لغز الكنز", type: "تنافسي" },
    { name: "بنك الاستثمار", type: "استثمار" }, { name: "تحدي الرمال", type: "نرد" },
    { name: "قراصنة البحار", type: "قمار" }, { name: "سهم الصعود", type: "تداول" }
];

let activeGames = allGames.sort(() => 0.5 - Math.random()).slice(0, 5);

// --- الوظائف المساعدة ---
const checkJail = (userId: string) => {
    if (jail.has(userId)) {
        const time = jail.get(userId)!;
        if (Date.now() < time) return Math.round((time - Date.now()) / 60000);
        jail.delete(userId);
    }
    return 0;
};

// --- الأوامر ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;
    if (!balances[uid]) balances[uid] = 10000; // رصيد البداية

    const inJail = checkJail(uid);

    // 1. أمر السوق (رسم بالخلفية والأسهم والكسور)
    if (msg.content === '!سوق') {
        if (inJail) return msg.reply(`🚨 أنت مسجون! باقي ${inJail} دقيقة.`);
        
        const canvas = createCanvas(1000, 700);
        const ctx = canvas.getContext('2d');
        const bg = await loadImage(path.join(ASSETS_PATH, UI.background));
        ctx.drawImage(bg, 0, 0, 1000, 700);

        const selected = itemsDB.sort(() => 0.5 - Math.random()).slice(0, 4);
        let y = 150;

        for (const item of selected) {
            const price = parseFloat((Math.random() * (item.max - item.min) + item.min).toFixed(2));
            const old = lastMarketPrices[item.id] || price;
            const arrow = price >= old ? UI.arrowUp : UI.arrowDown;
            lastMarketPrices[item.id] = price;

            const icon = await loadImage(path.join(ITEMS_PATH, `${item.id}.png`));
            ctx.drawImage(icon, 100, y, 80, 80);

            ctx.fillStyle = "#FFFFFF"; ctx.font = "35px Arial";
            ctx.fillText(item.name, 220, y + 30);
            ctx.fillStyle = price >= old ? "#00FF00" : "#FF0000";
            ctx.fillText(`${price.toLocaleString()} $`, 220, y + 75);

            const arwImg = await loadImage(path.join(ASSETS_PATH, arrow));
            ctx.drawImage(arwImg, 700, y + 20, 50, 50);
            y += 130;
        }
        msg.reply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'market.png' })] });
    }

    // 2. أمر الألعاب (تتغير كل ساعتين)
    if (msg.content === '!العاب') {
        if (inJail) return msg.reply(`🚨 أنت مسجون!`);
        const list = activeGames.map((g, i) => `${i+1}- **${g.name}** (${g.type})`).join('\n');
        msg.reply(`🎮 **الألعاب النشطة حالياً:**\n${list}`);
    }

    // 3. أمر التحويل (مع صورة الفيزا والوقت)
    if (msg.content.startsWith('!تحويل')) {
        if (inJail) return;
        const target = msg.mentions.users.first();
        const amt = parseInt(msg.content.split(' ')[2]);

        if (!target || !amt || balances[uid] < amt) return msg.reply("خطأ في البيانات أو الرصيد!");

        balances[uid] -= amt;
        balances[target.id] = (balances[target.id] || 0) + amt;

        const canvas = createCanvas(800, 450);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.visa)), 0, 0, 800, 450);
        ctx.fillStyle = "white"; ctx.font = "40px Arial";
        ctx.fillText(`SENT: ${amt.toLocaleString()} $`, 100, 350);
        msg.reply({ content: `✅ تم التحويل لـ ${target.username}`, files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'visa.png' })] });
    }

    // 4. أمر النهب (سجن + صورة فلوس النهب + وقت)
    if (msg.content.startsWith('!نهب')) {
        if (inJail) return;
        const target = msg.mentions.users.first();
        if (!target || target.id === uid) return msg.reply("منشن ضحية!");

        const cd = cooldowns.get(`rob-${uid}`) || 0;
        if (Date.now() < cd) return msg.reply("انتظر ساعة بين كل نهبة!");

        const rand = Math.random();
        if (rand < 0.3) { // نجاح
            const stolen = Math.floor(Math.random() * 5000) + 1000;
            balances[uid] += stolen;
            const canvas = createCanvas(500, 300);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.stolenCash)), 0, 0, 500, 300);
            ctx.fillStyle = "white"; ctx.font = "30px Arial";
            ctx.fillText(`+${stolen}`, 200, 250);
            msg.reply({ content: "🕵️ نجحت النهبة!", files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'stolen.png' })] });
        } else if (rand > 0.7) { // سجن
            jail.set(uid, Date.now() + 30 * 60 * 1000);
            msg.reply("🚓 انمسكت! سجن 30 دقيقة.");
        } else {
            msg.reply("🚨 فشلت وهربت!");
        }
        cooldowns.set(`rob-${uid}`, Date.now() + 60 * 60 * 1000);
    }

    // 5. أمر ريست الألعاب (أدمن فقط)
    if (msg.content === '/reset games' && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        activeGames = allGames.sort(() => 0.5 - Math.random()).slice(0, 5);
        msg.reply("🔄 تم تحديث قائمة الألعاب!");
    }
});

client.login('TOKEN_HERE');
