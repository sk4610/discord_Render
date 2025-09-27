import { GameState } from '../taisen/game.js';

// デフォルト軍名（データベースに設定がない場合の fallback）
const defaultArmyNames = {
  A: 'あつあつピザ軍',
  B: 'はらぺこ空腹軍'
};

// 動的軍名取得関数
export async function getArmyNames() {
  try {
    const gameState = await GameState.findByPk(1);
    
    if (gameState && gameState.custom_army_a_name && gameState.custom_army_b_name) {
      // カスタム軍名が設定されている場合
      return {
        A: gameState.custom_army_a_name,
        B: gameState.custom_army_b_name
      };
    } else {
      // デフォルト軍名を使用
      return defaultArmyNames;
    }
  } catch (error) {
    console.error('軍名取得エラー:', error);
    // エラー時はデフォルト軍名を返す
    return defaultArmyNames;
  }
}

// 同期版（後方互換性のため）
export const armyNames = defaultArmyNames;

// 単一軍名取得関数
export async function getArmyName(army) {
  const names = await getArmyNames();
  return names[army] || '不明';
}