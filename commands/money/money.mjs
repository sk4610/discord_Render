import { SlashCommandBuilder } from "discord.js";
import money from "../utils/money.js";  // default import を使う

export const data = new SlashCommandBuilder()
  .setName("cent")
  .setDescription("所持金を確認/追加します")
  .addBooleanOption(option =>
    option.setName("add")
      .setDescription("100G追加します")
      .setRequired(false)
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const add = interaction.options.getBoolean("add") || false;

  if (add) {
    await money.addMoney(userId, 100);  // money からメソッドを呼び出す
  }

  const balance = await money.getBalance(userId);  // 同じく
  await interaction.reply(`${interaction.user.username} さんの所持金は ${balance}G です！`);
}
