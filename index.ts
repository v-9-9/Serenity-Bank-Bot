import { Client, GatewayIntentBits, AttachmentBuilder, Message } from 'discord.js';
import * as PImage from 'pure-image';
import * as fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const ASSETS_PATH = path.join(process.cwd(), 'assets');
const ITEMS_PATH = path.join(ASSETS_PATH, 'items');

// --- نظام تحميل الخط لـ Pure-Image ---
let myFont: any;
async function loadFonts() {
    try {
        const fontPath = path.join(ASSETS_PATH, 'Handjet-VariableFont_ELGR,ELSH,wght.ttf');
        myFont = PImage.registerFont(fontPath, 'Handjet');
        await new Promise((resolve) => myFont.load(resolve));
        console.log("✅ تم تسجيل الخط بنجاح");
    } catch (e) {
        console.log("⚠️ فشل تحميل الخط، سيتم استخدام الخط الافتراضي");
    }
}

// --- قاعدة البيانات المؤقتة ---
let balances: { [key: string]: number } = {};
let jail = new Map<string, number>();
let cooldowns = new Map<string, number>();

// --- الموارد ---
const itemsDB = [
    { id: "1000307463", name: "خام النحاس", min: 1000, max: 5000 },
    { id: "1000307465", name: "حجر الكوارتز", min: 2000, max: 8000 },
    { id: "1000307472", name: "سبيكة حديد", min: 15000, max: 40000 },
    { id: "1000307473", name: "سبيكة ذهب", min: 80000, max: 200000 },
    { id: "1000307470", name: "الكتلة البنفسجية", min: 500000, max: 2500000 }
];

// --- قائمة الألعاب الـ 22 ---
const allGames = [
    { id: "g1", name: "منجم الذهب", cd: 15 }, { id: "g2", name: "بورصة السيرنيتي", cd: 20 },
    { id: "g3", name: "سوق الأسهم", cd: 10 }, { id: "g4", name: "سباق الهجن", cd: 5 },
    { id: "g5", name: "تحدي الصقور", cd: 5 }, { id: "g6", name: "صيد اللؤلؤ", cd: 3 },
    { id: "g7", name: "ملك النرد", cd: 2 }, { id: "g8", name: "مزاد الصحراء", cd: 12 },
    { id: "g9", name: "رهان الخيول", cd: 15 }, { id: "g10", name: "قنص الغزلان", cd: 8 },
    { id: "g11", name: "استخراج النفط", cd: 25 }, { id: "g12", name: "عجلة الحظ", cd: 10 },
    { id: "g13", name: "مبارزة السيوف", cd: 7 }, { id: "g14", name: "صيد السمك", cd: 4 },
    { id: "g15", name: "تجارة التوابل", cd: 6 }, { id: "g16", name: "منقب الكريستال", cd: 18 },
    { id: "g17", name: "لغز الكنز", cd: 10 }, { id: "g18", name: "بنك الاستثمار", cd: 30 },
    { id: "g19", name: "تحدي الرمال", cd: 3 }, { id: "g20", name: "قراصنة البحار", cd: 20 },
    { id: "g21", name: "سهم الصعود", cd: 15 }, { id: "g22", name: "طاولة الحظ", cd: 12 }
];
let activeGames = allGames.slice(0, 6);

// --- وظائف مساعدة ---
function formatTimeLeft(ms: number) {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}د و ${s % 60}ث`;
}

// دالة تحويل الصورة لبفر (لأن pure-image تختلف قليلاً)
async function getBuffer(img: any): Promise<Buffer> {
    const stream = new Readable();
    stream._read = () => {};
    await PImage.encodePNGToStream(img, stream);
    return new Promise((resolve) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        // دفع البيانات يدوياً لأن pure-image لا تدعم stream الـ node بشكل كامل أحياناً
        PImage.encodePNGToStream(img, stream);
    });
}

client.on('messageCreate', async (msg: Message) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;
    if (!balances[uid]) balances[uid] = 10000;

    // 1. أمر الوقت
    if (msg.content === '!وقت') {
        let txt = `⏳ **أوقات اللاعب:**\n`;
        const robCD = cooldowns.get(`rob-${uid}`) || 0;
        txt += `🕵️ نهب: ${Date.now() < robCD ? formatTimeLeft(robCD - Date.now()) : "✅"}\n`;
        if (jail.has(uid)) txt += `🔒 سجن: ${formatTimeLeft(jail.get(uid)! - Date.now())}\n`;
        
        activeGames.forEach((g, i) => {
            const cd = cooldowns.get(`game-${g.id}-${uid}`) || 0;
            txt += `${i+1}. ${g.name}: ${Date.now() < cd ? formatTimeLeft(cd - Date.now()) : "✅"}\n`;
        });
        return msg.reply(txt);
    }

    // 2. أمر السوق (استخدام Pure-Image يمنع الكراش)
    if (msg.content === '!سوق') {
        try {
            const canvas = PImage.make(1000, 700);
            const ctx = canvas.getContext('2d');
            
            // تحميل الخلفية
            const bgStream = fs.createReadStream(path.join(ASSETS_PATH, "Picsart_26-03-02_17-09-36-037.png"));
            const bg = await PImage.decodePNGFromStream(bgStream);
            ctx.drawImage(bg, 0, 0, 1000, 700);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = "40pt 'Handjet'";
            ctx.fillText("سوق التداول", 400, 80);

            let y = 180;
            for (const item of itemsDB.slice(0, 4)) {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillText(item.name, 200, y);
                const price = (Math.random() * (item.max - item.min) + item.min).toFixed(2);
                ctx.fillStyle = "#00FF00";
                ctx.fillText(`${price} $`, 200, y + 50);
                y += 130;
            }

            // إرسال الصورة
            const stream = new Readable({ read() {} });
            PImage.encodePNGToStream(canvas, stream).then(() => {
                const chunks: any = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => {
                    msg.reply({ files: [new AttachmentBuilder(Buffer.concat(chunks), { name: 'market.png' })] });
                });
                stream.push(null);
            });
        } catch (e) {
            msg.reply("❌ حدث خطأ في النظام، لكن البوت لم يكرش!");
            console.error(e);
        }
    }

    // 3. أمر النهب
    if (msg.content.startsWith('!نهب')) {
        const robCD = cooldowns.get(`rob-${uid}`) || 0;
        if (Date.now() < robCD) return msg.reply(`⏳ انتظر ${formatTimeLeft(robCD - Date.now())}`);

        const target = msg.mentions.users.first();
        if (!target) return msg.reply("منشن الضحية!");

        if (Math.random() > 0.6) {
            const win = 3000; balances[uid] += win;
            msg.reply(`✅ نهبت ${target.username} وأخذت ${win}$`);
        } else {
            msg.reply("🚨 فشلت النهبة!");
        }
        cooldowns.set(`rob-${uid}`, Date.now() + 10 * 60 * 1000);
    }

    // 4. أمر الألعاب
    if (msg.content.startsWith('!لعب')) {
        const idx = parseInt(msg.content.split(' ')[1]) - 1;
        const game = activeGames[idx];
        if (!game) return msg.reply("رقم اللعبة خطأ!");

        const cd = cooldowns.get(`game-${game.id}-${uid}`) || 0;
        if (Date.now() < cd) return msg.reply(`⏳ انتظر ${formatTimeLeft(cd - Date.now())}`);

        if (Math.random() > 0.5) {
            balances[uid] += 2000;
            msg.reply(`👑 فزت في ${game.name}!`);
        } else {
            msg.reply(`❌ خسرت في ${game.name}`);
        }
        cooldowns.set(`game-${game.id}-${uid}`, Date.now() + game.cd * 60 * 1000);
    }
    
    // 5. أمر قائمة الألعاب
    if (msg.content === '!العاب') {
        let l = "🎮 **الألعاب:**\n";
        activeGames.forEach((g, i) => l += `${i+1}. ${g.name} (${g.cd}د)\n`);
        msg.reply(l);
    }
});

client.once('ready', async () => {
    await loadFonts();
    console.log("🚀 البوت يعمل بنظام حماية من الكراش على Railway");
});

client.login('TOKEN_HERE');
