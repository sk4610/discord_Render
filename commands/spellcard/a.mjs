import { SlashCommandBuilder } from 'discord.js';
import { executeSpellCard } from './spellcard_main.js';

// スペルカード制：手札の1枚目（A）のカードを使う
export const data = new SlashCommandBuilder()
  .setName('a')
  .setDescription('スペルカード制：手札の1枚目（A）のカードを使う')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('一言添える')
      .setRequired(false)
  );

export async function execute(interaction) {
  await executeSpellCard(interaction, 0);
}
