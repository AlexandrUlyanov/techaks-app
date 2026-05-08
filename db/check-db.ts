import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";

async function checkStocks() {
  const db = getDb();
  
  const stocks = await db.execute(sql`SELECT * FROM product_stocks LIMIT 10`);
  console.log("Stocks in DB:", stocks[0]);
  
  const stores = await db.execute(sql`SELECT * FROM stores`);
  console.log("Stores in DB:", stores[0]);
  
  const products = await db.execute(sql`SELECT id, name FROM products LIMIT 5`);
  console.log("Products in DB:", products[0]);
  
  process.exit(0);
}

checkStocks();