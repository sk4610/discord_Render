import { SlashCommandBuilder } from 'discord.js';
import { GameState } from '../taisen/game.mjs';

export const data = new SlashCommandBuilder()
  .setName('rule')
  .setDescription('ゲームのルールを設定します')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('ルールの種類')
      .setRequired(true)
      .addChoices(
        { name: '階級制', value: 'ranked' }
      ));

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');

  try {
    // ルールを設定 or 更新
    await GameState.upsert({ 
      id: 1,
      rule_set: true,  // ルールが設定されたフラグ
      rule_type: mode  // 選ばれたmodeをrule_typeに保存
    });


    await interaction.reply(`ルールを「${mode}」に設定しました！ 参加者は /kaikyu コマンドで軍に参加してください。`);
  } catch (error) {
    console.error('ルール設定エラー:', error);
    await interaction.reply('エラー: ルールの設定に失敗しました');
  }
}
