// Uso: npm run admin:hash -- "minha senha forte"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error("Informe uma senha com pelo menos 10 caracteres: npm run admin:hash -- \"sua senha\"");
  process.exit(1);
}
bcrypt.hash(password, 12).then((hash) => {
  console.log(hash);
  console.log("\nDefina ADMIN_PASSWORD_HASH com o valor acima (na Vercel: Settings → Environment Variables).");
  console.log("Em arquivos .env locais, escape os cifrões: \$2b\$12\$...");
});
