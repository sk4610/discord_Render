import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';

export const data = new SlashCommandBuilder()
  .setName('show')
  .setDescription('現在の戦況を表示します');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;
    const username = interaction.member.displayName;
    const player = await User.findOne({ where: { id: userId } });
    
    if (!player) {
      return interaction.editReply('まず /start で軍に参加してください。');
    }

    const army = player.army;
    const gameState = await GameState.findOne();
    
    if (!gameState) {
      return interaction.editReply('エラー: ゲームデータが見つかりません。');
    }

    let message = `**現在の戦況**\n`;

    // ゲームルール表示
    if (gameState.rule_type === 'ranked') {
      message += `-# >>> **ルール**: :military_helmet: 階級制\n`;
    } else if (gameState.rule_type === 'coin') {
      message += `-# >>> **ルール**: :coin: 属性コイン制\n`;
    } else {
      message += `-# >>> **ルール**: 未設定\n`;
    }

    // 終戦状態チェック
    if (gameState.isGameOver) {
      message += `-# >>> **状態**: :x:  終戦済み\n\n`;
    } else {
      message += `-# >>> **状態**: :o: 大戦中\n`;
    }

    // === 参加者情報 ===
    const playersA = await User.count({ where: { army: 'A' } });
    const playersB = await User.count({ where: { army: 'B' } });
    const totalPlayers = playersA + playersB;
    
    message += `-# >>> 👥 **参加者数**: ${totalPlayers}名\n`;
    message += `-# >>> ${armyNames.A}: ${playersA}名　${armyNames.B}: ${playersB}名\n\n`;
    
    // === 戦況表示 ===
    const aHP = gameState.initialArmyHP - gameState.b_team_kills;
    const bHP = gameState.initialArmyHP - gameState.a_team_kills;
    
    message += `:crossed_swords: **両軍戦況**\n`;
    message += `:yellow_circle: ${armyNames.A}残存兵力: ${aHP} \n`;
    message += `:green_circle: ${armyNames.B}残存兵力: ${bHP} \n\n`;

    // === ルール別詳細表示 ===
    if (gameState.rule_type === 'ranked') {
      // 階級制：撃破数表示
      const totalKillsA = await User.sum('total_kills', { where: { army: 'A' } }) || 0;
      const totalKillsB = await User.sum('total_kills', { where: { army: 'B' } }) || 0;
      const totalActionsA = await User.sum('gekiha_counts', { where: { army: 'A' } }) || 0;
      const totalActionsB = await User.sum('gekiha_counts', { where: { army: 'B' } }) || 0;
      
      message += `⚔️ **撃破・行動数**\n`;
      message += `${armyNames.A}: **${totalKillsA}** 撃破　(**${totalActionsA}** 行動)\n`;
      message += `${armyNames.B}: **${totalKillsB}** 撃破　(**${totalActionsB}** 行動)\n\n`;
      
    } else if (gameState.rule_type === 'coin') {
      // 属性コイン制：コイン状況表示
      message += `:coin: **各軍のコイン状況**\n`;
      message += `【${armyNames.A}】\n`;
      message += `🔥 火: ${gameState.a_fire_coin}枚　🌲 木: ${gameState.a_wood_coin}枚　:rock: 土: ${gameState.a_earth_coin}枚　⚡ 雷: ${gameState.a_thunder_coin}枚　💧 水: ${gameState.a_water_coin}枚\n`;
      
      message += `【${armyNames.B}】\n`;
      message += `🔥 火: ${gameState.b_fire_coin}枚　🌲 木: ${gameState.b_wood_coin}枚　:rock: 土: ${gameState.b_earth_coin}枚　⚡ 雷: ${gameState.b_thunder_coin}枚　💧 水: ${gameState.b_water_coin}枚\n\n`;
      
      // 各軍のスキル発動可能状況
      const aSkillReady = [];
      const bSkillReady = [];
      
      const elements = [
        { name: '火', key: 'fire', emoji: '🔥' },
        { name: '木', key: 'wood', emoji: '🌲' },
        { name: '土', key: 'earth', emoji: ':rock:' },
        { name: '雷', key: 'thunder', emoji: '⚡' },
        { name: '水', key: 'water', emoji: '💧' }
      ];
      
      elements.forEach(element => {
        const aCoins = gameState[`a_${element.key}_coin`];
        const bCoins = gameState[`b_${element.key}_coin`];
        
        if (aCoins >= 5) {
          const nextThreshold = Math.floor(aCoins / 5) * 5 + 5;
          const remaining = nextThreshold - aCoins;
          aSkillReady.push(`${element.emoji}${element.name}(あと${remaining}枚)`);
        }
        
        if (bCoins >= 5) {
          const nextThreshold = Math.floor(bCoins / 5) * 5 + 5;
          const remaining = nextThreshold - bCoins;
          bSkillReady.push(`${element.emoji}${element.name}(あと${remaining}枚)`);
        }
      });
      
      if (aSkillReady.length > 0 || bSkillReady.length > 0) {
        message += `⚡ **次回スキル発動まで**\n`;
        if (aSkillReady.length > 0) {
          message += `${armyNames.A}: ${aSkillReady.join('　')}\n`;
        }
        if (bSkillReady.length > 0) {
          message += `${armyNames.B}: ${bSkillReady.join('　')}\n`;
        }
        message += `\n`;
      }
    }

    // === あなたの戦績 ===
    message += `🏅 **あなたの戦績**\n`;
    message += `${armyNames[army]} ${username}\n`;
    if (gameState.rule_type === 'ranked') {
      message += `階級: ${player.rank}\n`;
    }
    message += `行動数: ${player.gekiha_counts}回　撃破数: ${player.total_kills}撃破\n`;
    
    if (gameState.rule_type === 'coin') {
      message += `個人コイン取得: 🔥${player.personal_fire_coin}枚　🌲${player.personal_wood_coin}枚　:rock:${player.personal_earth_coin}枚　⚡${player.personal_thunder_coin}枚　💧${player.personal_water_coin}枚\n`;
    }

    // === BOB情報 ===
    if (player.bobEnabled) {
      const bobId = `bob-${userId}`;
      const bobUser = await User.findOne({ where: { id: bobId } });
      
      if (bobUser) {
        message += `\n🤖 **BOB支援兵**\n`;
        message += `${armyNames[army]} ${bobUser.username}\n`;
        if (gameState.rule_type === 'ranked') {
          message += `階級: **${bobUser.rank}**\n`;
        }
        message += `行動数: **${bobUser.gekiha_counts}回**　撃破数: **${bobUser.total_kills}撃破**\n`;
        
        if (gameState.rule_type === 'coin') {
          message += `BOBコイン取得: 🔥${bobUser.personal_fire_coin}枚　🌲${bobUser.personal_wood_coin}枚　:rock:${bobUser.personal_earth_coin}枚　⚡${bobUser.personal_thunder_coin}枚　💧${bobUser.personal_water_coin}枚\n`;
        }
      }
    }

    await interaction.editReply(message);

  } catch (error) {
    console.error('状況表示エラー:', error);
    await interaction.editReply('エラー: 状況の取得に失敗しました。');
  }
}