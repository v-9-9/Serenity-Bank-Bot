import { Client, GatewayIntentBits, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// --- المسارات ---
const ASSETS_PATH = './assets/';
const ITEMS_PATH = './assets/items/';

// --- تسجيل الخط الخاص بك ---
// تأكد أن ملف الخط موجود داخل مجلد assets بنفس الاسم بالضبط
registerFont(path.join(ASSETS_PATH, 'Handjet-VariableFont_ELGR,ELSH,wght.ttf'), { family: 'Handjet' });

const UI = {
    background: "Picsart_26-03-02_17-09-36-037.png",
    visa: "Picsart_26-03-02_16-46-22-498.png",
    arrowUp: "Picsart_26-03-02_16-41-02-511.png",
    arrowDown: "Picsart_26-03-02_16-41-24-257.png",
    stolenCash: "Picsart_26-03-02_16-46-32-604.png"
};

let balances: { [key: string]: number } = {}; 
let jail = new Map<string, number>(); 
let cooldowns = new Map<string, number>();
let lastMarketPrices: { [key: string]: number } = {};

const itemsDB = [
    { id: "1000307463", name: "خام النحاس", min: 1000, max: 5000 },
    { id: "1000307465", name: "حجر الكوارتز", min: 2000, max: 8000 },
    { id: "1000307472", name: "سبيكة حديد", min: 15000, max: 40000 },
    { id: "1000307464", name: "كريستال خام", min: 20000, max: 55000 },
    { id: "1000307473", name: "سبيكة ذهب", min: 80000, max: 200000 },
    { id: "1000307466", name: "ياقوت أحمر", min: 100000, max: 350000 },
    { id: "1000307470", name: "الكتلة البنفسجية", min: 500000, max: 2500000 },
    { id: "1000307469", name: "المرجان الطاقي", min: 800000, max: 5000000 }
];

const allGames = [
    { id: "g1", name: "منجم الذهب", type: "قمار", cooldown: 15 },
    { id: "g2", name: "بورصة السيرنيتي", type: "استثمار", cooldown: 15 },
    { id: "g3", name: "سوق الأسهم", type: "تداول", cooldown: 10 },
    { id: "g4", name: "سباق الهجن", type: "تنافسي", cooldown: 5 },
    { id: "g6", name: "صيد اللؤلؤ", type: "نرد", cooldown: 2 }
];

let activeGames = allGames.slice(0, 5);

// دالة لفحص السجن والكول داون
const checkStatus = (uid: string, key: string, cdMin: number) => {
    if (jail.has(uid)) {
        const release = jail.get(uid)!;
        if (Date.now() < release) return { status: 'jail', time: Math.ceil((release - Date.now()) / 60000) };
        jail.delete(uid);
    }
    const time = cooldowns.get(`${key}-${uid}`) || 0;
    if (Date.now() < time) return { status: 'cd', time: Math.ceil((time - Date.now()) / 1000) };
    return { status: 'ok' };
};

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;
    if (!balances[uid]) balances[uid] = 10000;

    // --- أمر السوق ---
    if (msg.content === '!سوق') {
        const check = checkStatus(uid, 'market', 0);
        if (check.status === 'jail') return msg.reply(`🚨 مسجون! باقي ${check.time} دقيقة.`);

        const canvas = createCanvas(1000, 700);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.background)), 0, 0, 1000, 700);

        let y = 160;
        const selected = itemsDB.sort(() => 0.5 - Math.random()).slice(0, 4);

        for (const item of selected) {
            const price = parseFloat((Math.random() * (item.max - item.min) + item.min).toFixed(2));
            const old = lastMarketPrices[item.id] || price;
            const arrow = await loadImage(path.join(ASSETS_PATH, price >= old ? UI.arrowUp : UI.arrowDown));
            lastMarketPrices[item.id] = price;

            const icon = await loadImage(path.join(ITEMS_PATH, `${item.id}.png`));
            ctx.drawImage(icon, 100, y - 40, 90, 90);

            // استخدام الخط الجديد هنا
            ctx.fillStyle = "#FFFFFF"; 
            ctx.font = '45px "Handjet"'; 
            ctx.fillText(item.name, 220, y);

            ctx.fillStyle = price >= old ? "#00FF00" : "#FF0000";
            ctx.font = '40px "Handjet"';
            ctx.fillText(`${price.toLocaleString()} $`, 220, y + 50);

            ctx.drawImage(arrow, 750, y - 10, 50, 50);
            y += 135;
        }
        msg.reply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'market.png' })] });
    }

    // --- أمر النهب (كل 10 دقائق) ---
    if (msg.content.startsWith('!نهب')) {
        const check = checkStatus(uid, 'rob', 10);
        if (check.status === 'jail') return msg.reply(`🚨 أنت في السجن!`);
        if (check.status === 'cd') return msg.reply(`⏳ انتظر ${Math.floor(check.time/60)}د و ${check.time%60}ث.`);

        const target = msg.mentions.users.first();
        if (!target || target.id === uid) return msg.reply("منشن الضحية!");

        if (Math.random() < 0.3) {
            const stolen = Math.floor(Math.random() * 5000) + 1000;
            balances[uid] += stolen;
            const canvas = createCanvas(600, 400);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.stolenCash)), 0, 0, 600, 400);
            ctx.fillStyle = "white"; ctx.font = '60px "Handjet"';
            ctx.fillText(`+${stolen}$`, 220, 350);
            msg.reply({ content: `🕵️ كفو! نهبت ${target.username}`, files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'loot.png' })] });
        } else if (Math.random() > 0.8) {
            jail.set(uid, Date.now() + 15 * 60 * 1000);
            msg.reply("🚓 انمسكت! سجن 15 دقيقة.");
        } else { msg.reply("🚨 فشلت وهربت."); }

        cooldowns.set(`rob-${uid}`, Date.now() + 10 * 60 * 1000);
    }
    
    // --- أمر التحويل ---
    if (msg.content.startsWith('!تحويل')) {
        const target = msg.mentions.users.first();
        const amt = parseInt(msg.content.split(' ')[2]);
        if (!target || !amt || balances[uid] < amt) return msg.reply("بيانات خطأ!");

        balances[uid] -= amt;
        balances[target.id] = (balances[target.id] || 0) + amt;

        const canvas = createCanvas(800, 450);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.visa)), 0, 0, 800, 450);
        ctx.fillStyle = "white"; ctx.font = '50px "Handjet"';
        ctx.fillText(`AMOUNT: ${amt}$`, 120, 300);
        ctx.font = '30px "Handjet"';
        ctx.fillText(`TO: ${target.username}`, 120, 350);
        msg.reply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'visa.png' })] });
    }
});

client.login('TOKEN_HERE');
