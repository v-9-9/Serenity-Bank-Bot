import { Client, GatewayIntentBits, AttachmentBuilder, PermissionFlagsBits, Message } from 'discord.js';
import { Canvas, loadImage, FontLibrary } from 'skia-canvas';
import path from 'path';

// --- إعدادات البوت الأساسية ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// --- إعدادات المسارات ---
const ASSETS_PATH = path.join(process.cwd(), 'assets');
const ITEMS_PATH = path.join(ASSETS_PATH, 'items');

// --- تسجيل الخط (تأكد من وجود الملف في assets) ---
try {
    FontLibrary.use("Handjet", path.join(ASSETS_PATH, 'Handjet-VariableFont_ELGR,ELSH,wght.ttf'));
    console.log("✅ تم تحميل الخط بنجاح");
} catch (err) {
    console.error("❌ فشل تحميل الخط، سيتم استخدام خط النظام الافتراضي");
}

// --- واجهة المستخدم ---
const UI = {
    background: "Picsart_26-03-02_17-09-36-037.png",
    visa: "Picsart_26-03-02_16-46-22-498.png",
    arrowUp: "Picsart_26-03-02_16-41-02-511.png",
    arrowDown: "Picsart_26-03-02_16-41-24-257.png",
    stolenCash: "Picsart_26-03-02_16-46-32-604.png"
};

// --- قاعدة البيانات المؤقتة ---
let balances: { [key: string]: number } = {}; 
let jail = new Map<string, number>(); 
let cooldowns = new Map<string, number>();
let lastMarketPrices: { [key: string]: number } = {};

// --- قائمة الموارد (Items) ---
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

// --- قائمة الـ 22 لعبة كاملة مع الـ Cooldown الخاص بها (بالدقائق) ---
const allGames = [
    { id: "g1", name: "منجم الذهب", type: "قمار", cd: 15 },
    { id: "g2", name: "بورصة السيرنيتي", type: "استثمار", cd: 20 },
    { id: "g3", name: "سوق الأسهم", type: "تداول", cd: 10 },
    { id: "g4", name: "سباق الهجن", type: "تنافسي", cd: 5 },
    { id: "g5", name: "تحدي الصقور", type: "تنافسي", cd: 5 },
    { id: "g6", name: "صيد اللؤلؤ", type: "صيد", cd: 3 },
    { id: "g7", name: "ملك النرد", type: "نرد", cd: 2 },
    { id: "g8", name: "مزاد الصحراء", type: "تداول", cd: 12 },
    { id: "g9", name: "رهان الخيول", type: "قمار", cd: 15 },
    { id: "g10", name: "قنص الغزلان", type: "تنافسي", cd: 8 },
    { id: "g11", name: "استخراج النفط", type: "استثمار", cd: 25 },
    { id: "g12", name: "عجلة الحظ", type: "قمار", cd: 10 },
    { id: "g13", name: "مبارزة السيوف", type: "تنافسي", cd: 7 },
    { id: "g14", name: "صيد السمك", type: "صيد", cd: 4 },
    { id: "g15", name: "تجارة التوابل", type: "تداول", cd: 6 },
    { id: "g16", name: "منقب الكريستال", type: "قمار", cd: 18 },
    { id: "g17", name: "لغز الكنز", type: "ذكاء", cd: 10 },
    { id: "g18", name: "بنك الاستثمار", type: "استثمار", cd: 30 },
    { id: "g19", name: "تحدي الرمال", type: "نرد", cd: 3 },
    { id: "g20", name: "قراصنة البحار", type: "قمار", cd: 20 },
    { id: "g21", name: "سهم الصعود", type: "تداول", cd: 15 },
    { id: "g22", name: "طاولة الحظ", type: "قمار", cd: 12 }
];

let activeGames = allGames.sort(() => 0.5 - Math.random()).slice(0, 6);

// --- دوال المساعدة ---

// دالة لجلب الوقت المتبقي بصيغة نصية
function formatTimeLeft(ms: number): string {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins} دقيقة و ${secs} ثانية`;
}

// دالة التحقق من حالة اللاعب (سجن أو انتظار)
function checkPlayerStatus(uid: string, key: string) {
    // أولاً: السجن
    if (jail.has(uid)) {
        const releaseTime = jail.get(uid)!;
        if (Date.now() < releaseTime) {
            return { canAct: false, reason: "سجن", timeLeft: releaseTime - Date.now() };
        }
        jail.delete(uid);
    }
    // ثانياً: وقت الانتظار
    const cdTime = cooldowns.get(`${key}-${uid}`) || 0;
    if (Date.now() < cdTime) {
        return { canAct: false, reason: "انتظار", timeLeft: cdTime - Date.now() };
    }
    return { canAct: true };
}

// --- معالجة الأوامر ---

client.on('messageCreate', async (msg: Message) => {
    if (msg.author.bot) return;
    const uid = msg.author.id;
    const username = msg.author.username;

    // تهيئة الرصيد إذا كان جديداً
    if (!balances[uid]) balances[uid] = 10000;

    // 1. أمر الوقت (!وقت) - يظهر حالة كل شيء
    if (msg.content === '!وقت') {
        let response = `⏳ **الحالة الزمنية للاعب: ${username}**\n\n`;
        
        // حالة السجن
        if (jail.has(uid)) {
            response += `🔒 **السجن:** متبقي ${formatTimeLeft(jail.get(uid)! - Date.now())}\n`;
        } else {
            response += `🔓 **السجن:** طليق\n`;
        }

        // حالة النهب
        const robCD = cooldowns.get(`rob-${uid}`) || 0;
        response += `🕵️ **النهب:** ${Date.now() < robCD ? formatTimeLeft(robCD - Date.now()) : "✅ جاهز"}\n`;

        // حالة الألعاب النشطة
        response += `\n🎮 **حالة الألعاب النشطة:**\n`;
        activeGames.forEach((game, index) => {
            const gameCD = cooldowns.get(`game-${game.id}-${uid}`) || 0;
            const status = Date.now() < gameCD ? `⏳ ${formatTimeLeft(gameCD - Date.now())}` : "✅ جاهز";
            response += `${index + 1}. ${game.name}: ${status}\n`;
        });

        return msg.reply(response);
    }

    // 2. أمر السوق (!سوق) - مع حماية من الكراش
    if (msg.content === '!سوق') {
        const status = checkPlayerStatus(uid, 'market');
        if (!status.canAct && status.reason === "سجن") return msg.reply(`🚨 أنت مسجون!`);

        try {
            const canvas = new Canvas(1000, 700);
            const ctx = canvas.getContext('2d');
            
            const bgImg = await loadImage(path.join(ASSETS_PATH, UI.background));
            ctx.drawImage(bgImg, 0, 0, 1000, 700);

            let y = 160;
            const selectedItems = itemsDB.sort(() => 0.5 - Math.random()).slice(0, 4);

            for (const item of selectedItems) {
                const price = parseFloat((Math.random() * (item.max - item.min) + item.min).toFixed(2));
                const oldPrice = lastMarketPrices[item.id] || price;
                lastMarketPrices[item.id] = price;

                const itemIcon = await loadImage(path.join(ITEMS_PATH, `${item.id}.png`));
                ctx.drawImage(itemIcon, 110, y - 45, 90, 90);

                ctx.fillStyle = "#FFFFFF";
                ctx.font = '42px "Handjet"';
                ctx.fillText(item.name, 230, y);

                ctx.fillStyle = price >= oldPrice ? "#00FF00" : "#FF0000";
                ctx.font = '38px "Handjet"';
                ctx.fillText(`${price.toLocaleString()} $`, 230, y + 45);

                const arrowImg = await loadImage(path.join(ASSETS_PATH, price >= oldPrice ? UI.arrowUp : UI.arrowDown));
                ctx.drawImage(arrowImg, 780, y - 15, 45, 45);
                
                y += 135;
            }

            const buffer = await canvas.toBuffer("png");
            msg.reply({ files: [new AttachmentBuilder(buffer, { name: 'market.png' })] });
        } catch (error) {
            console.error("Market Error:", error);
            msg.reply("❌ حدث خطأ أثناء تحميل السوق، تأكد من وجود ملفات الصور.");
        }
    }

    // 3. أمر النهب (!نهب) - كل 10 دقائق
    if (msg.content.startsWith('!نهب')) {
        const target = msg.mentions.users.first();
        if (!target || target.id === uid) return msg.reply("🕵️ منشن الشخص اللي تبي تنهبه!");

        const status = checkPlayerStatus(uid, 'rob');
        if (!status.canAct) {
            return msg.reply(`⏳ اهدأ يا لص! تقدر تنهب بعد: ${formatTimeLeft(status.timeLeft!)}`);
        }

        const chance = Math.random();
        if (chance < 0.35) { // نجاح
            const amount = Math.floor(Math.random() * 6000) + 1500;
            balances[uid] += amount;
            try {
                const canvas = new Canvas(600, 350);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.stolenCash)), 0, 0, 600, 350);
                ctx.fillStyle = "white";
                ctx.font = '60px "Handjet"';
                ctx.fillText(`+${amount}$`, 220, 310);
                msg.reply({ content: `✅ نجحت النهبة! سرقت من ${target.username} مبلغ ${amount}$`, files: [new AttachmentBuilder(await canvas.toBuffer("png"), { name: 'loot.png' })] });
            } catch (e) {
                msg.reply(`✅ نجحت النهبة! سرقت ${amount}$ (فشل تحميل الصورة)`);
            }
        } else if (chance > 0.85) { // سجن
            jail.set(uid, Date.now() + 15 * 60 * 1000);
            msg.reply("🚓 الكبسة! الحكومة صادوك، سجن 15 دقيقة.");
        } else {
            msg.reply("🚨 فشلت في النهبة لكنك نحشت قبل يمسكونك.");
        }

        cooldowns.set(`rob-${uid}`, Date.now() + 10 * 60 * 1000);
    }

    // 4. أمر التحويل (!تحويل) - مع صورة الفيزا
    if (msg.content.startsWith('!تحويل')) {
        const args = msg.content.split(' ');
        const target = msg.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!target || isNaN(amount) || amount <= 0) return msg.reply("❓ الاستخدام: `!تحويل @منشن 5000` ");
        if (balances[uid] < amount) return msg.reply("❌ رصيدك لا يكفي!");

        balances[uid] -= amount;
        balances[target.id] = (balances[target.id] || 0) + amount;

        try {
            const canvas = new Canvas(800, 450);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(await loadImage(path.join(ASSETS_PATH, UI.visa)), 0, 0, 800, 450);
            
            ctx.fillStyle = "white";
            ctx.font = '45px "Handjet"';
            ctx.fillText(`FROM: ${username.toUpperCase()}`, 100, 260);
            ctx.fillText(`TO: ${target.username.toUpperCase()}`, 100, 310);
            ctx.font = '55px "Handjet"';
            ctx.fillText(`AMT: ${amount.toLocaleString()}$`, 100, 380);

            msg.reply({ content: `✅ تم التحويل بنجاح!`, files: [new AttachmentBuilder(await canvas.toBuffer("png"), { name: 'visa.png' })] });
        } catch (e) {
            msg.reply(`✅ تم تحويل ${amount}$ إلى ${target.username}`);
        }
    }

    // 5. أمر الألعاب (!لعب) - نظام ألعاب متطور
    if (msg.content.startsWith('!لعب')) {
        const gameIdx = parseInt(msg.content.split(' ')[1]) - 1;
        const game = activeGames[gameIdx];

        if (!game) return msg.reply("🎮 اختر رقم اللعبة من القائمة، مثلاً: `!لعب 1` ");

        const status = checkPlayerStatus(uid, `game-${game.id}`);
        if (!status.canAct) {
            if (status.reason === "سجن") return msg.reply("🚨 أنت مسجون!");
            return msg.reply(`⏳ هذه اللعبة مجهدة! ارتح قليلاً: ${formatTimeLeft(status.timeLeft!)}`);
        }

        const winChance = Math.random();
        if (winChance > 0.5) {
            const reward = Math.floor(Math.random() * 4000) + 1000;
            balances[uid] += reward;
            msg.reply(`👑 كفو! فزت في **${game.name}** وكسبت **${reward}$**`);
        } else {
            msg.reply(`💔 للأسف، خسرت في **${game.name}**.. حاول مرة ثانية.`);
        }

        cooldowns.set(`game-${game.id}-${uid}`, Date.now() + game.cd * 60 * 1000);
    }

    // 6. أمر قائمة الألعاب (!العاب)
    if (msg.content === '!العاب') {
        let list = "🎮 **الألعاب المتاحة الآن (تتغير تلقائياً):**\n\n";
        activeGames.forEach((g, i) => {
            const isOff = (cooldowns.get(`game-${g.id}-${uid}`) || 0) > Date.now();
            list += `${i + 1}. **${g.name}** [${g.type}] - الانتظار: ${g.cd}د ${isOff ? "⏳" : "✅"}\n`;
        });
        list += "\n💡 للعب اكتب: `!لعب [رقم اللعبة]` ";
        msg.reply(list);
    }
});

// --- تشغيل البوت ---
client.on('ready', () => {
    console.log(`🚀 ${client.user?.tag} شغال وبأفضل حال!`);
    
    // تحديث الألعاب كل ساعتين
    setInterval(() => {
        activeGames = allGames.sort(() => 0.5 - Math.random()).slice(0, 6);
        console.log("🔄 تم تحديث قائمة الألعاب النشطة");
    }, 2 * 60 * 60 * 1000);
});

// منع الكراش الناتج عن أخطاء غير متوقعة
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.login('TOKEN_HERE');
