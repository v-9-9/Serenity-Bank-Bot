import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fs from 'fs';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// نظام السوق الوهمي (تحديث كل 5 دقائق)
let marketPrices = { wood: 15000, gold: 65000, iron: 45000 };

setInterval(() => {
    marketPrices.wood += Math.floor(Math.random() * 2000) - 1000;
    marketPrices.gold += Math.floor(Math.random() * 5000) - 2500;
    console.log("🔄 تم تحديث أسعار السوق!");
}, 5 * 60 * 1000);

client.on('ready', () => {
    console.log(`✅ ${client.user?.tag} متصل وجاهز!`);
});

client.login("TOKEN_HERE"); // سيتم نقله للـ Variables في ريلوي لاحقاً
