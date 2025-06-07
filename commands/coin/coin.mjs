import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';

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
  const selectedElement = interaction.options.getString('element');

  const elementNames = {
    fire: '火',
    wood: '木',
    earth: '土', 
    thunder: '雷',
    water: '水'
  };

  const elementName = elementNames[selectedElement];

  const gameState = await GameState.findOne();
  if (gameState.rule_type !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }

  // 軍全体のコインカラム名を決定
  const coinColumn = `${army.toLowerCase()}_${selectedElement}_coin`;
  
  // --- コイン獲得処理 ---
  let acquired = 0;
  const roll = Math.random();
  
  if (roll < 0.01) {
    acquired = 5; // 1%で5枚
  } else if (roll < 0.91) {
    acquired = 1; // 10%で1枚 (0.01～0.11の範囲)
  }
  // それ以外は0枚

  const before = gameState[coinColumn];
  gameState[coinColumn] = before + acquired;
  
  const after = gameState[coinColumn];
  
  let message = `🎲 【${elementName}】コイン取得判定！\n`;
  message += acquired > 0
    ? `👉 ${army}軍が${elementName}属性コインを${acquired}枚獲得！(${before} → ${after}枚)\n`
    : '👉 残念！今回は獲得できませんでした。\n';

  // --- スキル発動チェック ---
  const beforeMultiple = Math.floor(before / 5);
  const afterMultiple = Math.floor(after / 5);
  
  if (acquired > 0 && afterMultiple > beforeMultiple) {
    const enemyArmy = army === 'A' ? 'B' : 'A';

    let damage = 0;
    let heal = 0;
    let eraseTarget = '';
    const amount = after; // 軍全体の総コイン数

    message += `\n🔥 **${army}軍の${elementName}属性スキル発動！** (${amount}枚)\n`;

    switch (selectedElement) {
      case 'fire':
        damage = amount * 2;
        eraseTarget = 'wood';
        message += `🔥 火炎攻撃: ${amount} × 2 = ${damage}ダメージ！\n`;
        break;
        
      case 'wood': {
        // A軍の兵力 = 初期HP - B軍が与えたダメージ
        // B軍の兵力 = 初期HP - A軍が与えたダメージ  
        const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
        const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
        
        let multiplier;
        if (myHP < enemyHP) {
          multiplier = 3;
          message += `🌱 劣勢時木攻撃: ${amount} × 3 = `;
        } else if (myHP > enemyHP) {
          multiplier = 1;
          message += `🌱 優勢時木攻撃: ${amount} × 1 = `;
        } else {
          multiplier = 2;
          message += `🌱 均衡時木攻撃: ${amount} × 2 = `;
        }
        damage = amount * multiplier;
        message += `${damage}ダメージ！\n`;
        eraseTarget = 'earth';
        break;
      }
      
      case 'earth': {
        const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
        const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
        
        let multiplier;
        if (myHP > enemyHP) {
          multiplier = 3;
          message += `🌍 優勢時土攻撃: ${amount} × 3 = `;
        } else if (myHP < enemyHP) {
          multiplier = 1;
          message += `🌍 劣勢時土攻撃: ${amount} × 1 = `;
        } else {
          multiplier = 2;
          message += `🌍 均衡時土攻撃: ${amount} × 2 = `;
        }
        damage = amount * multiplier;
        message += `${damage}ダメージ！\n`;
        eraseTarget = 'thunder';
        break;
      }
      
      case 'thunder': {
        const rand = Math.floor(Math.random() * 100) + 1;
        message += `⚡ 雷スキル判定: ${rand} → `;
        if (rand % 2 === 0) {
          damage = amount * 4;
          message += `偶数 → 成功！${damage}ダメージ！\n`;
        } else {
          damage = 0;
          message += `奇数 → 発動失敗（0ダメージ）\n`;
        }
        eraseTarget = 'water';
        break;
      }
      
      case 'water':
        damage = amount;
        heal = amount;
        message += `💧 水治癒: ${damage}ダメージ + ${heal}回復！\n`;
        eraseTarget = 'fire';
        break;
    }

    // ダメージ処理
    if (damage > 0) {
      if (army === 'A') {
        gameState.a_team_kills += damage; // A軍が与えたダメージを加算
      } else {
        gameState.b_team_kills += damage; // B軍が与えたダメージを加算
      }
      
      // 個人の撃破数にも加算（ランキング用）
      player.total_kills += damage;
      await player.save();
    }

    // 回復処理（自軍が受けたダメージを減らす）
    if (heal > 0) {
      if (army === 'A') {
        gameState.b_team_kills = Math.max(0, gameState.b_team_kills - heal);
      } else {
        gameState.a_team_kills = Math.max(0, gameState.a_team_kills - heal);
      }
    }

    // 敵軍のコイン消去
    if (eraseTarget) {
      const eraseNames = {
        fire: '火', wood: '木', earth: '土', thunder: '雷', water: '水'
      };
      
      const enemyEraseColumn = `${enemyArmy.toLowerCase()}_${eraseTarget}_coin`;
      gameState[enemyEraseColumn] = 0;
      
      message += `💨 ${enemyArmy}軍の【${eraseNames[eraseTarget]}】コインを全て吹き飛ばした！\n`;
    }

    await gameState.save();

    // 戦況表示
    const aHP = gameState.initialArmyHP - gameState.b_team_kills;
    const bHP = gameState.initialArmyHP - gameState.a_team_kills;
    
    if (damage > 0) message += `💥 ${enemyArmy}軍に ${damage} ダメージ！\n`;
    if (heal > 0) message += `💖 ${army}軍の兵力が ${heal} 回復！\n`;

    // 勝敗判定
    if (aHP <= 0 || bHP <= 0) {
      const winner = aHP <= 0 ? 'B' : 'A';
      message += `\n🎉 **${winner}軍が勝利しました！**\n`;
    }

    message += `\n📊 戦況: A軍 ${aHP} vs B軍 ${bHP}\n`;
    
    console.log(`[DEBUG] ${army}軍 ${selectedElement}スキル: before=${before}, after=${after}, damage=${damage}, heal=${heal}`);

  } else {
    // スキル発動なしの場合の戦況表示
    const myDamageReceived = army === 'A' ? gameState.b_team_kills : gameState.a_team_kills;
    const myHP = gameState.initialArmyHP - myDamageReceived;
    message += `\n📊 ${army}軍の兵力：${myHP}\n`;
    
    await gameState.save(); // コイン獲得だけでも保存
  }

  // 軍全体のコイン状況表示
  message += `\n💰 ${army}軍の現在のコイン:\n`;
  message += `🔥 火: ${gameState[`${army.toLowerCase()}_fire_coin`]}枚 `;
  message += `🌲 木: ${gameState[`${army.toLowerCase()}_wood_coin`]}枚 `;
  message += `🪨 土: ${gameState[`${army.toLowerCase()}_earth_coin`]}枚 `;
  message += `⚡ 雷: ${gameState[`${army.toLowerCase()}_thunder_coin`]}枚 `;
  message += `💧 水: ${gameState[`${army.toLowerCase()}_water_coin`]}枚`;

  return interaction.editReply(message);
}