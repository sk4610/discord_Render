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
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const player = await User.findOne({ where: { id: userId } });
  if (!player) return interaction.editReply('まず /kaikyu でチームに参加してください。');

  const army = player.army;
  const column = interaction.options.getString('element');
  const elementToColumn = {
    fire: 'fire_coin',
    wood: 'wood_coin',
    earth: 'earth_coin',
    thunder: 'thunder_coin',
    water: 'water_coin',
  };
  const element = elementToColumn[column];

  const gameState = await GameState.findOne();
  if (gameState.rule_type !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }

  // --- コイン獲得処理 ---
  let acquired = 0;
  const roll = Math.random();
  if (roll < 0.01) acquired = 5;
  else if (roll < 0.9) acquired = 1;

  const before = player[element];
  player[element] += acquired;
  const after = player[element];
  await player.save();

  const beforeSet = Math.floor(before / 5);
  const afterSet = Math.floor(after / 5);
  const triggerCount = afterSet - beforeSet;

  const enemyArmy = army === 'A' ? 'B' : 'A';
  const enemyUsers = await User.findAll({ where: { army: enemyArmy } });

  let totalDamage = 0;
  let totalHeal = 0;
  let eraseTarget = '';
  let skillMessages = '';

  for (let i = 0; i < triggerCount; i++) {
    const amount = 5;
    let damage = 0;
    let heal = 0;

    switch (element) {
      case 'fire':
        damage = amount * 2;
        eraseTarget = 'wood_coin';
        break;
      case 'wood': {
        const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
        const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
        damage = myHP < enemyHP ? amount * 3 : myHP > enemyHP ? amount * 1 : amount * 2;
        eraseTarget = 'earth_coin';
        break;
      }
      case 'earth': {
        const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
        const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
        damage = myHP > enemyHP ? amount * 3 : myHP < enemyHP ? amount * 1 : amount * 2;
        eraseTarget = 'thunder_coin';
        break;
      }
      case 'thunder': {
        const rand = Math.floor(Math.random() * 100) + 1;
        skillMessages += `🔢 雷スキル判定: ${rand} → `;
        if (rand % 2 === 0) {
          damage = amount * 4;
          skillMessages += `偶数 → 成功！${damage}ダメージ！\n`;
        } else {
          skillMessages += `奇数 → 発動失敗（0ダメージ）\n`;
        }
        eraseTarget = 'water_coin';
        break;
      }
      case 'water':
        damage = amount;
        heal = amount;
        eraseTarget = 'fire_coin';
        break;
    }

    if (damage > 0) {
      if (army === 'A') gameState.b_team_kills += damage;
      else gameState.a_team_kills += damage;
      player.total_kills += damage;
      totalDamage += damage;
    }

    if (heal > 0) {
      if (army === 'A') gameState.a_team_kills = Math.max(0, gameState.a_team_kills - heal);
      else gameState.b_team_kills = Math.max(0, gameState.b_team_kills - heal);
      totalHeal += heal;
    }

    if (eraseTarget) {
      for (const enemy of enemyUsers) {
        enemy[eraseTarget] = 0;
        await enemy.save();
      }
    }
  }

  await player.save();
  await gameState.save();

  const enemyKills = army === 'A' ? gameState.b_team_kills : gameState.a_team_kills;
  const enemyHP = gameState.initialArmyHP - enemyKills;
  const myKills = army === 'A' ? gameState.a_team_kills : gameState.b_team_kills;
  const myHP = gameState.initialArmyHP - myKills;

  let message = `🎲 【${element}】コイン取得判定！\n`;
  message += acquired > 0
    ? `👉 ${element}属性コインを${acquired}枚獲得！\n`
    : '👉 残念！今回は獲得できませんでした。\n';

  if (totalDamage > 0) message += `💥 ${enemyArmy}軍に ${totalDamage} ダメージ！\n`;
  if (totalHeal > 0) message += `💖 ${army}軍の兵力が ${totalHeal} 回復！\n`;
  if (eraseTarget && triggerCount > 0) {
    const readable = {
      fire_coin: '火',
      wood_coin: '木',
      earth_coin: '土',
      thunder_coin: '雷',
      water_coin: '水',
    };
    message += `💨 敵軍の【${readable[eraseTarget]}】コインを全て吹き飛ばした！\n`;
  }

  message += skillMessages;

  if (enemyHP <= 0) {
    message += `\n🎉 **${army}軍が勝利しました！**\n`;
  }

  message += `📊 ${army}軍の兵力：${myHP}\n`;
  message += `🔥 火: ${player.fire_coin}枚 🌲 木: ${player.wood_coin}枚 🪨 土: ${player.earth_coin}枚 ⚡ 雷: ${player.thunder_coin}枚 💧 水: ${player.water_coin}枚`;

  return interaction.editReply(message);
}
