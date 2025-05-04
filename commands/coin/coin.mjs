import { SlashCommandBuilder } from 'discord.js';
//import { CoinStatus, GameState } from '../utils/database.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from './kaikyu.mjs';
//import { getTeamByUserId } from '../utils/game.js';

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
  const element = interaction.options.getString('element');
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）
  
    // A軍とB軍の名前を取得
    const armyNameA = getArmyName('A');
    const armyNameB = getArmyName('B');
  
  //const team = await getTeamByUserId(userId); // 'kinoko' or 'takenoko'
      // ユーザの所属軍を取得
    const UserArmy = await User.findOne({ where: { id: userId }, raw: true});
    const UserArmyName = UserArmy.army === 'A' ? armyNameA : armyNameB;
  
  if (!UserArmyName) {
    return interaction.editReply('まず /kaikyu でチームに参加してください。');
  }

  const game = await GameState.findOne();
  if (game.rule !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }

  //ユーザのコイン状況を把握
  let coin = await User.findOne({ where: { id: userId } });
  
  if (!coin) {
    coin = await CoinStatus.create({ userId, team, fire: 0, wood: 0, earth: 0, thunder: 0, water: 0 });
  }

  // --- コイン獲得処理 ---
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

  // --- スキル発動チェック ---
  if (acquired > 0 && coin[element] % 5 === 0) {
    const enemyTeam = team === 'kinoko' ? 'takenoko' : 'kinoko';
    const enemyCoins = await CoinStatus.findAll({ where: { team: enemyTeam } });
    const friendlyCoins = await CoinStatus.findAll({ where: { team } });

    let gameState = await GameState.findOne();
    let teamHP = team === 'kinoko' ? gameState.kinokoHP : gameState.takenokoHP;
    let enemyHP = team === 'kinoko' ? gameState.takenokoHP : gameState.kinokoHP;

    let damage = 0;
    let heal = 0;
    let eraseTarget = '';
    const amount = coin[element];

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

    // ダメージ反映
    if (damage > 0) {
      if (team === 'kinoko') {
        gameState.takenokoHP = Math.max(0, gameState.takenokoHP - damage);
      } else {
        gameState.kinokoHP = Math.max(0, gameState.kinokoHP - damage);
      }
    }

    // 回復反映
    if (heal > 0) {
      if (team === 'kinoko') {
        gameState.kinokoHP += heal;
      } else {
        gameState.takenokoHP += heal;
      }
    }

    // 属性削除
    if (eraseTarget) {
      enemyCoins.forEach(c => {
        c[eraseTarget] = 0;
      });
      await Promise.all(enemyCoins.map(c => c.save()));
    }

    await gameState.save();

    const finalHP = team === 'kinoko' ? gameState.kinokoHP : gameState.takenokoHP;
    const finalEnemyHP = team === 'kinoko' ? gameState.takenokoHP : gameState.kinokoHP;

    message += `💥 ${enemyTeam}軍に ${damage} ダメージ！\n`;
    if (heal > 0) message += `💖 ${team}軍の兵力が ${heal} 回復！\n`;
    if (eraseTarget) message += `💨 敵軍の【${eraseTarget}】コインを全て吹き飛ばした！\n`;

    // 勝敗判定
    if (finalEnemyHP <= 0) {
      message += `\n🎉 **${team}軍が勝利しました！**`;
    }
  }

  // --- ステータス表示 ---
  const refreshed = await GameState.findOne();
  const curTeamHP = team === 'kinoko' ? refreshed.kinokoHP : refreshed.takenokoHP;

  message += `\n📊 ${team}軍の兵力：${curTeamHP}\n`;
  message += `🔥 火: ${coin.fire}枚 🌲 木: ${coin.wood}枚 🪨 土: ${coin.earth}枚 ⚡ 雷: ${coin.thunder}枚 💧 水: ${coin.water}枚`;

  return interaction.editReply(message);
}
