import { SlashCommandBuilder } from "discord.js";
import { getBalance, addMoney } from "../command/utils/money.js";

export const data = new SlashCommandBuilder()
  .setName("money")
  .setDescription("所持金を確認または追加します")
  .addBooleanOption(option =>
    option.setName("add")
      .setDescription("100G追加します")
      .setRequired(false)
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const add = interaction.options.getBoolean("add") || false;

  if (add) {
    await addMoney(userId, 100);
  }

  const balance = await getBalance(userId);
  await interaction.reply(`${interaction.user.username} さんの所持金は ${balance}G です！`);
}
