import { SlashCommandBuilder } from "discord.js";
import { addMoney, getBalance } from "../cent.js";

export const data = new SlashCommandBuilder()
  .setName("cent")
  .setDescription("100Gを追加し、現在の所持金を確認します");

export async function execute(interaction) {
  const userId = interaction.user.id;

  // 100Gを追加
  addMoney(userId);

  // 更新後の所持金を取得
  const balance = getBalance(userId);

  // 結果を返信
  await interaction.reply(`${interaction.user.username} さんの所持金は **${balance}￠** になりました！`);
}
