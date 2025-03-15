import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("omikuji")
  .setDescription("おみくじを引きます");

export async function execute(interaction) {
  const arr = ["魔王", "SR 銀のじゃがいも", "R 銅のじゃがいも", "N ただのじゃがいも"];
  const weight = [2, 4, 8, 16];
  let result = "";

  let totalWeight = 0;
  for (let i = 0; i < weight.length; i++) {
    totalWeight += weight[i];
  }
  let random = Math.floor(Math.random() * totalWeight);
  
  for (let i = 0; i < weight.length; i++) {
    if (random < weight[i]) {
      result = arr[i];
      break;
    } else {
      random -= weight[i];
    }
  }

  // 絵文字を追加する（カスタム絵文字IDは Discord中で\:emoji:と打ち込めば返る
  // 1322580002491072653 = mao791
  const emoji = "<:custom_emoji:1322580002491072653>";
  await interaction.reply(`${result} が当選しました！`);
}
