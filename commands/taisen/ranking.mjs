import { SlashCommandBuilder } from 'discord.js';
import { User } from '../taisen/game.js';
import { getArmyName } from './kaikyu.mjs';


export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('各軍の戦歴上位を公表します');

export async function execute(interaction) {
  try {
    const { guild } = interaction; // サーバー情報を取得
    
    // A軍の上位3名を取得
    const topA = await User.findAll({
      where: { army: 'A' },
      order: [['total_kills', 'DESC']],
      limit: 3
    });

    // B軍の上位3名を取得
    const topB = await User.findAll({
      where: { army: 'B' },
      order: [['total_kills', 'DESC']],
      limit: 3
    });

     // ユーザーIDからサーバーニックネームを取得
    async function getUsername(guild, userId) {
      try {
        const member = await guild.members.fetch(userId);
        return member.displayName; // サーバーニックネームを取得
      } catch (error) {
        console.error(`ユーザー取得エラー: ${userId}`, error);
        return '不明なユーザー'; // 取得に失敗した場合のデフォルト
      }
    }

    // A軍とB軍の名前を取得
    const armyNameA = getArmyName('A');
    const armyNameB = getArmyName('B');
    
    // ランキング表示用のメッセージを作成
    let message = '🏆 **ランキング - 上位3名** 🏆\n\n';
    // A軍（きのこ）表示
    message += ':yellow_circle:  **${armyNameA}:**\n';
    for (const player of topA) {
      const username = await getUsername(guild, player.id);
      message += `**${username}**（${player.rank}） - ${player.total_kills} 撃破\n`;
    }
    // B軍（たけのこ）表示
    message += '\n:green_circle:  **${armyNameB}軍:**\n';
    for (const player of topB) {
      const username = await getUsername(guild, player.id);
      message += `**${username}**（${player.rank}） - ${player.total_kills} 撃破\n`;
    }
    
    // **追加情報**
    message += `\n📊 **戦況データ:**\n`;
    message += `総ID数: **${totalUniquePlayers}**　:yellow_circle:  **${armyNameA} : 🔵B軍 = **${uniquePlayersA}** : **${uniquePlayersB}**\n`;
    message += `合計 **${totalActions}** レス（行動回数）　🔴A軍 : 🔵B軍 = **${totalActionsA}** : **${totalActionsB}**`;

    
    // ランキングを送信
    await interaction.reply(message);
  } catch (error) {
    console.error('ランキング処理エラー:', error);
    await interaction.reply('エラー: ランキングの取得に失敗しました');
  }
}