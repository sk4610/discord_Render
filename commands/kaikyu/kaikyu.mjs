import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

const ranks = ['二等兵＝', '一等兵〓', '軍曹¶', '曹長†', '大尉‡', '大佐▽', '准将◇', '大将Θ', '元帥☆'];
const weight = [28, 24, 20, 13, 8, 4, 1.5, 1, 0.5 ]; // VIP 大文字の数の確率順を基に100％になるように微調整

// 軍名設定　変更はここから
const nameA = 'きのこ軍';
const nameB = 'たけのこ軍';

export const data = new SlashCommandBuilder()
  .setName('kaikyu')
  .setDescription('軍を選択し、ランダムな階級を割り当てます')
  .addStringOption(option =>
    option.setName('army')
      .setDescription('所属する軍を選択')
      .setRequired(true)
      .addChoices(
        { name: `${nameA}`, value: 'A' },
        { name: `${nameB}`, value: 'B' }
      ));

  // gekiha.mjsで表示するためのグローバル関数の設定　軍命の変更をkaikyu.mjsだけで留める
export const armyName_global = {A:`${nameA}`,B:`${nameB}`};
export function getArmyName(army) {
  return armyName_global[army] || '不明';
}

export async function execute(interaction) {
  const army = interaction.options.getString('army');
  const userId = interaction.user.id;
  const username = interaction.member.displayName;

    // army の値に対応する軍名を取得
  const armyName = army === 'A' ? `${nameA}` : `${nameB}`;
  
  try {
    // ルールが設定されているか確認
    const gameState = await GameState.findByPk(1);
    if (!gameState || !gameState.rule_set) {
      return await interaction.reply('エラー: まず /rule コマンドでルールを設定してください。');
    }

    // すでに登録済みか確認
    const existingPlayer = await User.findOne({ where: { id: userId }, raw: true});
    if (existingPlayer) {
      const existingArmyName = existingPlayer.army === 'A' ? `${nameA}` : `${nameB}`;
      return await interaction.reply(`エラー: あなたはすでに **${existingArmyName}** の **${existingPlayer.rank}** です！`);
    }

    // ランダムな階級を決定
//    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
//    const randomRank = result;

    // ここでランダムな階級を決定
    let totalWeight = weight.reduce((sum, w) => sum + w, 0);
    let random = Math.floor(Math.random() * totalWeight);
    let randomRank = '';
    for (let i = 0; i < weight.length; i++) {
      if (random < weight[i]) {
        randomRank = ranks[i]; // ランダムに選ばれた階級
        break;
      } else {
        random -= weight[i];
      }
    }
    
    // データベースにプレイヤーを追加
    await User.create({ id: userId, username, army, rank: randomRank, total_kills: 0 });

    await interaction.reply(`${username} さんが **${armyName}** に配属され、**${randomRank}** になりました！`);
  } catch (error) {
    console.error('軍配属エラー:', error);
    await interaction.reply('エラー: 軍の選択に失敗しました');
  }
}
