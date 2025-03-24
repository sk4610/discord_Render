import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from './kaikyu.mjs';

const ranks = ['二等兵＝', '一等兵〓', '軍曹¶', '曹長†', '大尉‡', '大佐▽', '准将◇', '大将Θ', '元帥☆'];

export const data = new SlashCommandBuilder()
  .setName('gekiha')
  .setDescription('撃破数を決定します')
  .addStringOption(option =>
      option.setName("message")
      .setDescription("一言レスを表示")
      .setRequired(false) // trueにすると必須、falseにすると任意 
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）

  
  try {
    // プレイヤーが登録済みか確認
    const player = await User.findOne({ where: { id: userId } });
    if (!player) {
      return await interaction.reply('エラー: まず /kaikyu で軍と階級を決めてください。');
    }

    // 撃破数をランダム決定
    let kills = Math.random() < 0.01 ? 5 : Math.floor(Math.random() * 2); // 1%で5撃破, それ以外は0 or 1

    // 階級昇格判定
    let rankUp = false;
    if (kills === 5) {
      const currentRankIndex = ranks.indexOf(player.rank);
      if (currentRankIndex < ranks.length - 1) {
        player.rank = ranks[currentRankIndex + 1]; // 階級を1つ昇格
        rankUp = true;
      }
    }

    // 撃破数を更新
    player.total_kills += kills;
    await player.save();

    // A軍とB軍の総撃破数を計算
    const totalKillsA = await User.sum('total_kills', { where: { army: 'A' } }) || 0;
    const totalKillsB = await User.sum('total_kills', { where: { army: 'B' } }) || 0;

    // A軍とB軍の名前を取得
    const armyNameA = getArmyName('A');
    const armyNameB = getArmyName('B');

    // メッセージ作成（ユーザーのメッセージを最初に追加）
    let message = "";
   
    // メッセージ作成
    message += `-#  :military_helmet: ${username} の戦闘！\n## ${kills} 撃破！\n.\n`;
    if (rankUp) message += `## 🔥大量撃破だ！！🔥 \n **${player.rank}**へ昇格！ \n\n`;
    //自分の撃破数
    message += `-# >>> 🏅戦歴\n-# >>> ${username} 階級:${player.rank} \n-# >>> 撃破数: **${player.total_kills}** 撃破\n-# >>> -\n`
    //軍の総撃破数を表示
    message += `-# >>> 📊 現在の戦況:\n-# >>> ${armyNameA}: 　総${totalKillsA} 撃破\n-# >>> ${armyNameB}: 総${totalKillsB} 撃破\n`;
    
     // メッセージ（ユーザーが入力したもの）
    if (customMessage) {
      message += ` \`\`\`${customMessage}\`\`\`\n`;
    }   

    
    await interaction.reply(message);
  } catch (error) {
    console.error('撃破処理エラー:', error);
    await interaction.reply('エラー: 撃破処理に失敗しました');
  }
}
