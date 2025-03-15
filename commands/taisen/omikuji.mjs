import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("omikuji")
  .setDescription("おみくじを引きます");

export async function execute(interaction) {
  const arr = ["魔王", "軍神", "百合神", "乙牌", "撃破王", "大吉", "吉", "中吉", "小吉", "もみ吉", "抹吉", "凶", "大凶", "大戦犯"];
  const weight = [7.91, 2.09, 2, 3, 3, 4, 5, 10, 10, 10, 15, ];
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
