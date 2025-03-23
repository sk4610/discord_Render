import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

const ranks = ['二等兵', '一等兵', '軍曹', '曹長', '大尉', '大佐', '准将', '大将', '元帥'];

export const data = new SlashCommandBuilder()
  .setName('kaikyu')
  .setDescription('軍を選択し、ランダムな階級を割り当てます')
  .addStringOption(option =>
    option.setName('army')
      .setDescription('所属する軍を選択')
      .setRequired(true)
      .addChoices(
        { name: 'きのこ軍', value: 'A' },
        { name: 'たけのこ軍', value: 'B' }
      ));

export async function execute(interaction) {
  const army = interaction.options.getString('army');
  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    // ルールが設定されているか確認
    const gameState = await GameState.findByPk(1);
    if (!gameState || !gameState.rule_set) {
      return await interaction.reply('エラー: まず /rule コマンドでルールを設定してください。');
    }

    // すでに登録済みか確認
    const existingPlayer = await User.findOne({ where: { id: userId } });
    if (existingPlayer) {
      return await interaction.reply(`エラー: あなたはすでに **${existingPlayer.army}軍** の **${existingPlayer.rank}** です！`);
    }

    // ランダムな階級を決定
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];

    // データベースにプレイヤーを追加
    await User.create({ id: userId, username, army, rank: randomRank, total_kills: 0 });

    await interaction.reply(`${username} さんが **${army}軍** に配属され、**${randomRank}** になりました！`);
  } catch (error) {
    console.error('軍配属エラー:', error);
    await interaction.reply('エラー: 軍の選択に失敗しました');
  }
}
