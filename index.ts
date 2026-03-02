import { Client, GatewayIntentBits, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { Canvas, loadImage, FontLibrary } from 'skia-canvas'; // التغيير هنا
import path from 'path';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const ASSETS_PATH = './assets/';
const ITEMS_PATH = './assets/items/';

// تسجيل الخط في skia-canvas
FontLibrary.use("Handjet", path.join(ASSETS_PATH, 'Handjet-VariableFont_ELGR,ELSH,wght.ttf'));

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

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;
    if (!balances[uid]) balances[uid] = 10000;

    if (msg.content === '!سوق') {
        const canvas = new Canvas(1000, 700); // التغيير هنا
        const ctx = canvas.getContext('2d');
        ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.background)), 0, 0, 1000, 700);

        let y = 160;
        const selected = itemsDB.sort(() => 0.5 - Math.random()).slice(0, 4);

        for (const item of selected) {
            const price = parseFloat((Math.random() * (item.max - item.min) + item.min).toFixed(2));
            const old = lastMarketPrices[item.id] || price;
            const arrow = await loadImage(path.join(ASSETS_PATH, price >= old ? UI.arrowUp : UI.arrowDown));
            lastMarketPrices[item.id] = price;

            ctx.drawImage(await loadImage(path.join(ITEMS_PATH, `${item.id}.png`)), 100, y - 40, 90, 90);

            ctx.fillStyle = "#FFFFFF"; 
            ctx.font = '45px "Handjet"'; 
            ctx.fillText(item.name, 220, y);

            ctx.fillStyle = price >= old ? "#00FF00" : "#FF0000";
            ctx.font = '40px "Handjet"';
            ctx.fillText(`${price.toLocaleString()} $`, 220, y + 50);

            ctx.drawImage(arrow, 750, y - 10, 50, 50);
            y += 135;
        }
        
        // في skia-canvas نستخدم toBuffer مباشرة من الكانفاس
        const buffer = await canvas.toBuffer("png");
        msg.reply({ files: [new AttachmentBuilder(buffer, { name: 'market.png' })] });
    }

    // أمر التحويل
    if (msg.content.startsWith('!تحويل')) {
        const target = msg.mentions.users.first();
        const amt = parseInt(msg.content.split(' ')[2]);
        if (!target || !amt || balances[uid] < amt) return msg.reply("بيانات خطأ!");

        balances[uid] -= amt;
        balances[target.id] = (balances[target.id] || 0) + amt;

        const canvas = new Canvas(800, 450);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.visa)), 0, 0, 800, 450);
        
        ctx.fillStyle = "white"; 
        ctx.font = '50px "Handjet"';
        ctx.fillText(`AMOUNT: ${amt}$`, 120, 300);
        
        const buffer = await canvas.toBuffer("png");
        msg.reply({ files: [new AttachmentBuilder(buffer, { name: 'visa.png' })] });
    }
});

client.login('TOKEN_HERE');
