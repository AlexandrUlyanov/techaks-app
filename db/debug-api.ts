import axios from "axios";
import fs from "fs";

async function checkApi() {
  const login = "admin@moysklad.ru"; // Wait, I need the actual login the user uses.
  // Actually, I can just query the DB for product stocks to see if I need to do anything... wait, no.
  // Since I don't have the login/password here, I can't easily check the API unless I read the local storage or .env. But they type it in the frontend!
}