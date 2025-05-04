import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from '../kaikyu/kaikyu.mjs';

export const data = new SlashCommandBuilder()
  .setName('coin')
  .setDescription('属性コインを集めます')
  .addStringOption(option =>
    option.setName('element')
      .setDescription('属性を選択')
      .setRequired(true)
      .addChoices(
        { name: '火', value: 'fire' },
        { name: '木', value: 'wood' },
        { name: '土', value: 'earth' },
        { name: '雷', value: 'thunder' },
        { name: '水', value: 'water' },
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const player = await User.findOne({ where: { id: userId } });

  if (!player || !player.army) {
    return interaction.editReply('まず /kaikyu でチームに参加してください。');
  }

  const element = interaction.options.getString('element');

  const army = player.army; // 'A' または 'B'
  const team = army === 'A' ? 'kinoko' : 'takenoko';
  const enemyTeam = team === 'kinoko' ? 'takenoko' : 'kinoko';

  const armyName = getArmyName(army);
  const enemyArmyName = getArmyName(army === 'A' ? 'B' : 'A');

  const game = await GameState.findOne();
  if (game.rule !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }

  // --- コイン獲得処理 ---
  let acquired = 0;
  const roll = Math.random();
  if (roll < 0.01) acquired = 5;
  else if (roll < 0.10) acquired = 1;

  player[element] += acquired;
  await player.save();

  let message = `🎲 【${element}】コイン取得判定！\n`;
  message += acquired > 0
    ? `👉 ${element}属性コインを${acquired}枚獲得！\n`
    : '👉 残念！今回は獲得できませんでした。\n';

  // --- スキル発動チェック ---
  if (acquired > 0 && player[element] % 5 === 0) {
    let damage = 0;
    let heal = 0;
    let eraseTarget = '';
    const amount = player[element];

    const teamHP = team === 'kinoko' ? game.kinokoHP : game.takenokoHP;
    const enemyHP = team === 'kinoko' ? game.takenokoHP : game.kinokoHP;

    switch (element) {
      case 'fire':
        damage = amount * 2;
        eraseTarget = 'wood';
        break;
      case 'wood':
        damage = teamHP < enemyHP ? amount * 3 : teamHP > enemyHP ? amount * 1 : amount * 2;
        eraseTarget = 'earth';
        break;
      case 'earth':
        damage = teamHP > enemyHP ? amount * 3 : teamHP < enemyHP ? amount * 1 : amount * 2;
        eraseTarget = 'thunder';
        break;
      case 'thunder': {
        const rand = Math.floor(Math.random() * 100) + 1;
        message += `🔢 雷スキル判定: ${rand} → `;
        if (rand % 2 === 0) {
          damage = amount * 4;
          message += `偶数 → 成功！${damage}ダメージ！\n`;
        } else {
          message += '奇数 → 発動失敗（0ダメージ）\n';
        }
        eraseTarget = 'water';
        break;
      }
      case 'water':
        damage = amount;
        heal = amount;
        eraseTarget = 'fire';
        break;
    }

    // ダメージ適用
    if (damage > 0) {
      if (team === 'kinoko') game.takenokoHP = Math.max(0, game.takenokoHP - damage);
      else game.kinokoHP = Math.max(0, game.kinokoHP - damage);
    }

    // 回復適用
    if (heal > 0) {
      if (team === 'kinoko') game.kinokoHP += heal;
      else game.takenokoHP += heal;
    }

    // 敵軍の属性削除
    if (eraseTarget) {
      const enemies = await User.findAll({ where: { army: army === 'A' ? 'B' : 'A' } });
      for (const enemy of enemies) {
        enemy[eraseTarget] = 0;
        await enemy.save();
      }
      message += `💨 敵軍の【${eraseTarget}】コインを全て吹き飛ばした！\n`;
    }

    await game.save();

    message += `💥 ${enemyArmyName}に ${damage} ダメージ！\n`;
    if (heal > 0) message += `💖 ${armyName}の兵力が ${heal} 回復！\n`;

    // 勝敗判定
    const enemyFinalHP = team === 'kinoko' ? game.takenokoHP : game.kinokoHP;
    if (enemyFinalHP <= 0) {
      message += `\n🎉 **${armyName}が勝利しました！**`;
    }
  }

  // --- ステータス表示 ---
  const curTeamHP = team === 'kinoko' ? game.kinokoHP : game.takenokoHP;

  message += `\n📊 ${armyName}の兵力：${curTeamHP}\n`;
  message += `🔥 火: ${player.fire}枚 🌲 木: ${player.wood}枚 🪨 土: ${player.earth}枚 ⚡ 雷: ${player.thunder}枚 💧 水: ${player.water}枚`;

  return interaction.editReply(message);
}
