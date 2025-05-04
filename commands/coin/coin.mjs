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
        { name: '水', value: 'water' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const element = interaction.options.getString('element');

  const player = await User.findOne({ where: { id: userId } });
  if (!player || !player.army) {
    return interaction.editReply('まず /kaikyu でチームに参加してください。');
  }

  const army = player.army; // 'A' または 'B'
  const enemyArmy = army === 'A' ? 'B' : 'A';

  const game = await GameState.findOne();
  if (game.rule !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }

  // コイン情報の取得
  const coin = player;

  // コイン取得処理
  let acquired = 0;
  const roll = Math.random();
  if (roll < 0.01) {
    acquired = 5;
  } else if (roll < 0.10) {
    acquired = 1;
  }

  coin[element] += acquired;
  await coin.save();

  let message = `🎲 【${element}】コイン取得判定！\n`;
  message += acquired > 0
    ? `👉 ${element}属性コインを${acquired}枚獲得！\n`
    : '👉 残念！今回は獲得できませんでした。\n';

  // スキル発動条件
  if (acquired > 0 && coin[element] % 5 === 0) {
    let damage = 0;
    let heal = 0;
    let eraseTarget = '';
    const amount = coin[element];

    const currentState = await GameState.findOne();

    let teamHP = army === 'A' ? currentState.armyAHP : currentState.armyBHP;
    let enemyHP = army === 'A' ? currentState.armyBHP : currentState.armyAHP;

    switch (element) {
      case 'fire':
        damage = amount * 2;
        eraseTarget = 'wood';
        break;
      case 'wood':
        if (teamHP < enemyHP) damage = amount * 3;
        else if (teamHP > enemyHP) damage = amount * 1;
        else damage = amount * 2;
        eraseTarget = 'earth';
        break;
      case 'earth':
        if (teamHP > enemyHP) damage = amount * 3;
        else if (teamHP < enemyHP) damage = amount * 1;
        else damage = amount * 2;
        eraseTarget = 'thunder';
        break;
      case 'thunder':
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
      case 'water':
        damage = amount;
        heal = amount;
        eraseTarget = 'fire';
        break;
    }

    // ダメージ適用
    if (damage > 0) {
      if (army === 'A') {
        currentState.armyBHP = Math.max(0, currentState.armyBHP - damage);
      } else {
        currentState.armyAHP = Math.max(0, currentState.armyAHP - damage);
      }
    }

    // 回復適用
    if (heal > 0) {
      if (army === 'A') {
        currentState.armyAHP += heal;
      } else {
        currentState.armyBHP += heal;
      }
    }

    // 敵軍の該当属性コインを0に
    const enemyUsers = await User.findAll({ where: { army: enemyArmy } });
    for (const enemy of enemyUsers) {
      enemy[eraseTarget] = 0;
      await enemy.save();
    }

    await currentState.save();

    const finalEnemyHP = army === 'A' ? currentState.armyBHP : currentState.armyAHP;

    message += `💥 ${enemyArmy}軍に ${damage} ダメージ！\n`;
    if (heal > 0) message += `💖 ${army}軍の兵力が ${heal} 回復！\n`;
    if (eraseTarget) message += `💨 敵軍の【${eraseTarget}】コインを全て吹き飛ばした！\n`;

    if (finalEnemyHP <= 0) {
      message += `\n🎉 **${army}軍が勝利しました！**`;
    }
  }

  // 現在の兵力とコイン表示
  const refreshed = await GameState.findOne();
  const curTeamHP = army === 'A' ? refreshed.armyAHP : refreshed.armyBHP;

  message += `\n📊 ${army}軍の兵力：${curTeamHP}\n`;
  message += `🔥 火: ${coin.fire}枚 🌲 木: ${coin.wood}枚 🪨 土: ${coin.earth}枚 ⚡ 雷: ${coin.thunder}枚 💧 水: ${coin.water}枚`;

  return interaction.editReply(message);
}
