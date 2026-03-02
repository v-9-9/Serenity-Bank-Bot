const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// --- إعدادات البوت ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- قاعدة البيانات (في الذاكرة) ---
let db = {
    balances: {},
    jail: new Map(),
    cooldowns: new Map(),
    market: {}
};

// --- إعدادات المسارات ---
const ASSETS = path.join(process.cwd(), 'assets');

// --- الألعاب الـ 22 (نظام البيانات) ---
const gamesList = [
    { id: "g1", name: "منجم الذهب", cd: 15, prize: 5000 },
    { id: "g2", name: "بورصة السيرنيتي", cd: 20, prize: 8000 },
    { id: "g3", name: "سوق الأسهم", cd: 10, prize: 4000 },
    { id: "g4", name: "سباق الهجن", cd: 5, prize: 2000 },
    { id: "g5", name: "تحدي الصقور", cd: 5, prize: 2500 },
    { id: "g6", name: "صيد اللؤلؤ", cd: 3, prize: 1500 },
    { id: "g7", name: "ملك النرد", cd: 2, prize: 1000 },
    { id: "g8", name: "مزاد الصحراء", cd: 12, prize: 6000 },
    { id: "g9", name: "رهان الخيول", cd: 15, prize: 7000 },
    { id: "g10", name: "قنص الغزلان", cd: 8, prize: 3000 },
    { id: "g11", name: "استخراج النفط", cd: 25, prize: 12000 },
    { id: "g12", name: "عجلة الحظ", cd: 10, prize: 5000 },
    { id: "g13", name: "مبارزة السيوف", cd: 7, prize: 3500 },
    { id: "g14", name: "صيد السمك", cd: 4, prize: 1200 },
    { id: "g15", name: "تجارة التوابل", cd: 6, prize: 2800 },
    { id: "g16", name: "منقب الكريستال", cd: 18, prize: 9000 },
    { id: "g17", name: "لغز الكنز", cd: 10, prize: 4500 },
    { id: "g18", name: "بنك الاستثمار", cd: 30, prize: 15000 },
    { id: "g19", name: "تحدي الرمال", cd: 3, prize: 1100 },
    { id: "g20", name: "قراصنة البحار", cd: 20, prize: 10000 },
    { id: "g21", name: "سهم الصعود", cd: 15, prize: 5500 },
    { id: "g22", name: "طاولة الحظ", cd: 12, prize: 4800 }
];

let activeGames = gamesList.slice(0, 6);

// --- وظائف المساعدة ---

function getTimeRemaining(endTime) {
    const total = endTime - Date.now();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    return { total, minutes, seconds, label: `${minutes}د و ${seconds}ث` };
}

function checkCooldown(uid, key, durationMin) {
    const now = Date.now();
    const end = db.cooldowns.get(`${key}-${uid}`) || 0;
    if (now < end) return getTimeRemaining(end);
    return null;
}

// --- معالجة الأوامر ---

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const uid = message.author.id;

    if (!db.balances[uid]) db.balances[uid] = 10000;

    // --- أمر وقت (المطور والكامل) ---
    if (command === 'وقت') {
        let embed = new EmbedBuilder()
            .setTitle('⏳ السجل الزمني للاعب')
            .setColor('#f1c40f')
            .setThumbnail(message.author.displayAvatarURL());

        let timeStatus = "";
        
        // النهب
        const robCD = checkCooldown(uid, 'rob');
        timeStatus += `🕵️ **النهب:** ${robCD ? `⏳ ${robCD.label}` : '✅ متاح حالياً'}\n`;

        // السجن
        if (db.jail.has(uid)) {
            const jailTime = getTimeRemaining(db.jail.get(uid));
            timeStatus += `🔒 **السجن:** ${jailTime.total > 0 ? `⏳ ${jailTime.label}` : '✅ حر'}\n`;
        } else {
            timeStatus += `🔒 **السجن:** ✅ حر\n`;
        }

        timeStatus += `\n🎮 **الألعاب المتاحة:**\n`;
        activeGames.forEach((g, i) => {
            const gCD = checkCooldown(uid, `game-${g.id}`);
            timeStatus += `${i+1}. ${g.name}: ${gCD ? `⏳ ${gCD.label}` : '✅'}\n`;
        });

        embed.setDescription(timeStatus);
        return message.reply({ embeds: [embed] });
    }

    // --- أمر النهب ---
    if (command === 'نهب') {
        const robCD = checkCooldown(uid, 'rob');
        if (robCD) return message.reply(`⏳ اهدأ! تقدر تنهب بعد ${robCD.label}`);

        const target = message.mentions.users.first();
        if (!target) return message.reply("🕵️ منشن الضحية!");
        if (target.id === uid) return message.reply("تبي تسرق نفسك؟");

        const chance = Math.random();
        db.cooldowns.set(`rob-${uid}`, Date.now() + (10 * 60 * 1000));

        if (chance < 0.3) {
            const steal = Math.floor(Math.random() * 5000) + 1000;
            db.balances[uid] += steal;
            return message.reply(`✅ كفو! سرقت من ${target.username} مبلغ **${steal}$**`);
        } else if (chance > 0.8) {
            db.jail.set(uid, Date.now() + (15 * 60 * 1000));
            return message.reply(`🚓 الكبسة! الحكومة مسكتك وسجن 15 دقيقة.`);
        } else {
            return message.reply(`🚨 فشلت العملية وهربت بالوقت المناسب.`);
        }
    }

    // --- أمر الألعاب ---
    if (command === 'لعب') {
        const idx = parseInt(args[0]) - 1;
        const game = activeGames[idx];
        if (!game) return message.reply("🎮 اختر رقم اللعبة، مثال: `!لعب 1` ");

        const gCD = checkCooldown(uid, `game-${game.id}`);
        if (gCD) return message.reply(`⏳ اللعبة مجهدة، ارتح لـ ${gCD.label}`);

        const win = Math.random() > 0.5;
        db.cooldowns.set(`game-${game.id}-${uid}`, Date.now() + (game.cd * 60 * 1000));

        if (win) {
            db.balances[uid] += game.prize;
            return message.reply(`👑 فزت في **${game.name}** وجائزتك **${game.prize}$**`);
        } else {
            return message.reply(`💔 خسرت في **${game.name}**، حاول مرة أخرى.`);
        }
    }

    // --- أمر العاب ---
    if (command === 'العاب') {
        let list = "🎮 **الألعاب المتوفرة حالياً:**\n";
        activeGames.forEach((g, i) => {
            list += `**${i+1}.** ${g.name} | الجائزة: ${g.prize}$ | الانتظار: ${g.cd}د\n`;
        });
        message.reply(list);
    }
});

// --- حماية النظام من الكراش ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} جاهز للعمل على Railway`);
    // تحديث الألعاب كل ساعتين
    setInterval(() => {
        activeGames = gamesList.sort(() => 0.5 - Math.random()).slice(0, 6);
    }, 2 * 60 * 60 * 1000);
});

client.login('TOKEN_HERE');
