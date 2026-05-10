import { SlashCommandBuilder } from 'discord.js';
import { GameState } from '../taisen/game.js';
import { kaikyu_main } from '../kaikyu/kaikyu_main.js';
import { executePassive } from '../PassiveSkill/PassiveSkill.mjs';
import { executeSkillgein } from '../Skillgein/action.mjs';

export const data = new SlashCommandBuilder()
  .setName('action')
  .setDescription('行動します（設定されているルールに応じて自動で処理されます）')
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

export async function execute(interaction) {
  const gameState = await GameState.findOne({ where: { id: 1 } });

  if (!gameState || !gameState.rule_type || gameState.rule_type === 'none') {
    return await interaction.reply('エラー: ルールが設定されていません。まず /rule でルールを決めてください。');
  }

  if (gameState.isGameOver) {
    return await interaction.reply('大戦はすでに終戦した！次回の号砲を待て！');
  }

  switch (gameState.rule_type) {
    case 'ranked':
      await kaikyu_main(interaction);
      break;
    case 'passive':
      await executePassive(interaction);
      break;
    case 'skillgein':
      await executeSkillgein(interaction);
      break;
    case 'coin':
      await interaction.reply('属性コイン制では `/coin-fire` などのコインコマンドを使ってください。');
      break;
    case 'beast':
      await interaction.reply('ビースト制では `/beast` を使ってください。');
      break;
    case 'fighting':
      await interaction.reply('ファイティング制では `/punch` `/charge` `/burst` を使ってください。');
      break;
    default:
      await interaction.reply(`エラー: 未対応のルール「${gameState.rule_type}」です。`);
  }
}
