import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// إعدادات سوق Serenity (الأسعار تتغير كل 5 دقائق)
let serenityMarket = [
    { id: 'wood', name: 'خشب', buy: 15000, sell: 9000, trend: 'up' },
    { id: 'iron', name: 'حديد', buy: 42000, sell: 25000, trend: 'down' },
    { id: 'gold', name: 'ذهب', buy: 68000, sell: 40000, trend: 'up' }
];

// وظيفة لتحديث الأسعار تلقائياً
function updateMarket() {
    serenityMarket.forEach(item => {
        const change = Math.floor(Math.random() * 6000) - 3000;
        item.buy = Math.max(5000, item.buy + change); // لا ينزل السعر عن 5000
        item.sell = Math.floor(item.buy * 0.65);
        item.trend = change >= 0 ? 'up' : 'down';
    });
    console.log("📈 Serenity Market Updated!");
}

setInterval(updateMarket, 5 * 60 * 1000);

client.on('ready', () => {
    console.log(`✅ Serenity Bank is Online | Logged in as ${client.user?.tag}`);
});

// أمر لعرض السوق بشكل مؤقت (قبل البدء بالرسم بالـ Canvas)
client.on('messageCreate', async (message) => {
    if (message.content === 'سوق') {
        const embed = new EmbedBuilder()
            .setTitle("🏪 Serenity Market | سوق سيرينتي")
            .setColor("#2b2d31")
            .setThumbnail(client.user?.displayAvatarURL() || '')
            .setDescription("تتحدث الأسعار تلقائياً كل 5 دقائق")
            .setTimestamp();

        serenityMarket.forEach(item => {
            const emoji = item.trend === 'up' ? '📈' : '📉';
            embed.addFields({ 
                name: `${item.name} ${emoji}`, 
                value: `شراء: \`$${item.buy.toLocaleString()}\`\nبيع: \`$${item.sell.toLocaleString()}\``, 
                inline: true 
            });
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('refresh_market').setLabel('تحديث').setStyle(ButtonStyle.Secondary)
        );

        await message.reply({ embeds: [embed], components: [row] });
    }
});

client.login(process.env.TOKEN);
