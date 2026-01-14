const bcrypt = require("bcrypt");

async function gerar() {
    const senha = "00770077R";  // coloque a senha que você quer
    const hash = await bcrypt.hash(senha, 10);
    console.log("Nova senha:", senha);
    console.log("Hash bcrypt:", hash);
}

gerar();