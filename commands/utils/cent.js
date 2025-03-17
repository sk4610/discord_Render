import db from "./utils/database.js";

const ADD_AMOUNT = 100; // 追加する金額

// **所持金を追加**
export function addMoney(userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (user) {
    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(ADD_AMOUNT, userId);
  } else {
    db.prepare("INSERT INTO users (id, balance) VALUES (?, ?)").run(userId, ADD_AMOUNT);
  }
}

// **所持金を取得**
export function getBalance(userId) {
  const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId);
  return user ? user.balance : 0;
}