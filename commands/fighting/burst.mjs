import { SlashCommandBuilder } from 'discord.js';
import { executeFightingAction } from './fighting_common.js';

export const data = new SlashCommandBuilder()
  .setName('burst')
  .setDescription('ファイト値に応じたダメージを与える')
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

export async function execute(interaction) {
  await executeFightingAction(interaction, 'burst');
}