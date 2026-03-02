import { Client, GatewayIntentBits, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const ASSETS_PATH = './assets/';
const ITEMS_PATH = './assets/items/';

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

// --- قائمة الألعاب مع "مدة الانتظار" الخاصة بكل لعبة (بالدقائق) ---
const allGames = [
    { id: "g1", name: "منجم الذهب", type: "قمار", cooldown: 15 },
    { id: "g2", name: "بورصة السيرنيتي", type: "استثمار", cooldown: 15 },
    { id: "g3", name: "سوق الأسهم", type: "تداول", cooldown: 10 },
    { id: "g4", name: "سباق الهجن", type: "تنافسي", cooldown: 5 },
    { id: "g5", name: "تحدي الصقور", type: "تنافسي", cooldown: 5 },
    { id: "g6", name: "صيد اللؤلؤ", type: "نرد", cooldown: 2 },
    { id: "g7", name: "ملك النرد", type: "نرد", cooldown: 2 },
    { id: "g8", name: "عجلة الحظ", type: "قمار", cooldown: 12 },
    { id: "g9", name: "قراصنة البحار", type: "قمار", cooldown: 20 },
    { id: "g10", name: "استخراج النفط", type: "استثمار", cooldown: 15 }
];

let activeGames = allGames.sort(() => 0.5 - Math.random()).slice(0, 5);

// دالة فحص الوقت المتبقي
function getRemainingTime(key: string) {
    const time = cooldowns.get(key) || 0;
    const now = Date.now();
    if (now < time) return Math.ceil((time - now) / 1000); // بالثواني
    return 0;
}

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;
    if (!balances[uid]) balances[uid] = 10000;

    // فحص السجن
    if (jail.has(uid)) {
        const release = jail.get(uid)!;
        if (Date.now() < release) {
            const left = Math.ceil((release - Date.now()) / 60000);
            if (msg.content.startsWith('!')) return msg.reply(`🚨 وراء القضبان! متبقي ${left} دقيقة.`);
        } else { jail.delete(uid); }
    }

    // --- أمر النهب (كل 10 دقائق) ---
    if (msg.content.startsWith('!نهب')) {
        const target = msg.mentions.users.first();
        if (!target || target.id === uid) return msg.reply("منشن الضحية!");

        const wait = getRemainingTime(`rob-${uid}`);
        if (wait > 0) return msg.reply(`⏳ اهدأ! تقدر تنهب بعد ${Math.floor(wait/60)} دقيقة و ${wait%60} ثانية.`);

        const rand = Math.random();
        if (rand < 0.3) {
            const stolen = Math.floor(Math.random() * 8000) + 2000;
            balances[uid] += stolen;
            msg.reply({ content: `🕵️ تمت السرقة بنجاح! كسبت ${stolen} $`, files: [new AttachmentBuilder(path.join(ASSETS_PATH, UI.stolenCash))] });
        } else if (rand > 0.8) {
            jail.set(uid, Date.now() + 15 * 60 * 1000); // سجن 15 دقيقة للفشل الذريع
            msg.reply("🚓 الكبسة! انمسكت وسجن 15 دقيقة.");
        } else { msg.reply("🚨 فشلت العملية بس قدرت تهرب."); }

        cooldowns.set(`rob-${uid}`, Date.now() + 10 * 60 * 1000); // 10 دقائق
    }

    // --- أمر اللعب (مع توقيت لكل لعبة) ---
    if (msg.content.startsWith('!لعب')) {
        const gameIdx = parseInt(msg.content.split(' ')[1]) - 1;
        const game = activeGames[gameIdx];
        if (!game) return msg.reply("اكتب رقم اللعبة المتاحة حالياً، مثلاً: `!لعب 1` ");

        const wait = getRemainingTime(`game-${game.id}-${uid}`);
        if (wait > 0) return msg.reply(`⏳ هذه اللعبة مجهدة! انتظر ${Math.floor(wait/60)} دقيقة.`);

        // ميكانيكا فوز بسيطة للعبة
        const win = Math.random() > 0.5;
        if (win) {
            balances[uid] += 5000;
            msg.reply(`✅ فزت في **${game.name}** وكسبت 5,000 $!`);
        } else {
            msg.reply(`❌ خسرت في **${game.name}**، حاول لاحقاً.`);
        }

        // تحديد وقت الانتظار بناءً على نوع اللعبة من القائمة
        cooldowns.set(`game-${game.id}-${uid}`, Date.now() + game.cooldown * 60 * 1000);
    }

    // عرض الألعاب مع مدة انتظارها
    if (msg.content === '!العاب') {
        const list = activeGames.map((g, i) => {
            const wait = getRemainingTime(`game-${g.id}-${uid}`);
            const status = wait > 0 ? `⏳ انتظار (${Math.ceil(wait/60)} د)` : `✅ متاحة`;
            return `${i+1}- **${g.name}** [${g.type}] | ${status}`;
        }).join('\n');
        msg.reply(`🎮 **قائمة الألعاب (تتغير كل ساعتين):**\n${list}`);
    }
});

client.login('TOKEN_HERE');
