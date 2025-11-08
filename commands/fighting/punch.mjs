import { SlashCommandBuilder } from 'discord.js';
import { executeFightingAction } from './fighting_common.js';

export const data = new SlashCommandBuilder()
  .setName('punch')
  .setDescription('敵軍兵士のファイト値を下げる')
  .addStringOption(option =>
    option.setName('target')
      .setDescription('敵軍兵士の名前')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

export async function execute(interaction) {
  const targetUsername = interaction.options.getString('target');
  await executeFightingAction(interaction, 'punch', targetUsername);
}