const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const app = express();

// Configurações do Bingo
const CONFIG = {
    minNum: 1,
    maxNum: 75,
    commands: {
        bingo: '!bingo',
        sortear: '!sortear',
        sorteados: '!sorteados',
        novobingo: '!novobingo',
        ajuda: '!ajuda'
    }
};

// Carregar/Salvar dados
let bingoData = {
    numerosSorteados: [],
    jogoAtivo: true,
    ultimoSorteio: null
};

// Carregar dados do arquivo
function loadData() {
    try {
        if (fs.existsSync('./database.json')) {
            const data = fs.readFileSync('./database.json', 'utf8');
            bingoData = JSON.parse(data);
            console.log('✅ Dados carregados:', bingoData);
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Salvar dados
function saveData() {
    try {
        fs.writeFileSync('./database.json', JSON.stringify(bingoData, null, 2));
        console.log('💾 Dados salvos');
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
}

// Função para sortear número
function sortearNumero() {
    if (!bingoData.jogoAtivo) {
        return { error: "❌ Bingo está pausado! Use !novobingo para começar um novo jogo." };
    }
    
    const numerosDisponiveis = [];
    for (let i = CONFIG.minNum; i <= CONFIG.maxNum; i++) {
        if (!bingoData.numerosSorteados.includes(i)) {
            numerosDisponiveis.push(i);
        }
    }
    
    if (numerosDisponiveis.length === 0) {
        return { error: "🎉 BINGO COMPLETO! Todos os números foram sorteados! Use !novobingo para reiniciar." };
    }
    
    const randomIndex = Math.floor(Math.random() * numerosDisponiveis.length);
    const numeroSorteado = numerosDisponiveis[randomIndex];
    
    bingoData.numerosSorteados.push(numeroSorteado);
    bingoData.ultimoSorteio = {
        numero: numeroSorteado,
        data: new Date().toISOString(),
        restantes: numerosDisponiveis.length - 1
    };
    
    saveData();
    
    return {
        numero: numeroSorteado,
        totalSorteados: bingoData.numerosSorteados.length,
        restantes: numerosDisponiveis.length - 1
    };
}

// Formatar lista de números sorteados
function formatarSorteados() {
    if (bingoData.numerosSorteados.length === 0) {
        return "📋 Nenhum número foi sorteado ainda! Use !sortear para começar.";
    }
    
    const numeros = bingoData.numerosSorteados.sort((a, b) => a - b);
    let mensagem = "🎯 *NÚMEROS SORTEADOS:* 🎯\n\n";
    mensagem += `📊 Total: ${numeros.length}/${CONFIG.maxNum}\n`;
    mensagem += `📈 Restam: ${CONFIG.maxNum - numeros.length}\n\n`;
    mensagem += "🔢 *Lista completa:*\n";
    
    // Formatar em grupos de 10 para ficar mais legível
    for (let i = 0; i < numeros.length; i += 10) {
        const grupo = numeros.slice(i, i + 10);
        mensagem += grupo.join(" • ") + "\n";
    }
    
    return mensagem;
}

// Resetar o jogo
function resetarBingo() {
    bingoData = {
        numerosSorteados: [],
        jogoAtivo: true,
        ultimoSorteio: null
    };
    saveData();
    return "🎲 *NOVO BINGO CRIADO!* 🎲\n\nOs números foram resetados. Use !sortear para começar os sorteios!";
}

// Processar comandos
async function processCommand(message, command, sender) {
    const lowerCmd = command.toLowerCase().trim();
    
    switch(lowerCmd) {
        case '!ajuda':
            return `🤖 *COMANDOS DO BINGO BOT* 🤖
            
🎯 *!bingo* - Ver status do jogo atual
🎲 *!sortear* - Sorteia um novo número
📋 *!sorteados* - Mostra todos números já sorteados
🔄 *!novobingo* - Começa um novo jogo (zera tudo)
❓ *!ajuda* - Mostra esta mensagem

📊 *Estatísticas atuais:*
• Números sorteados: ${bingoData.numerosSorteados.length}/${CONFIG.maxNum}
• Jogo ativo: ${bingoData.jogoAtivo ? "✅ Sim" : "❌ Não"}`;
            
        case '!bingo':
            const ultimo = bingoData.ultimoSorteio;
            let status = `🎯 *STATUS DO BINGO* 🎯\n\n`;
            status += `📊 Sorteados: ${bingoData.numerosSorteados.length}/${CONFIG.maxNum}\n`;
            status += `📈 Restantes: ${CONFIG.maxNum - bingoData.numerosSorteados.length}\n`;
            if (ultimo) {
                status += `🎲 Último sorteio: *${ultimo.numero}*\n`;
            }
            status += `🟢 Jogo ativo: ${bingoData.jogoAtivo ? "Sim" : "Não"}`;
            return status;
            
        case '!sortear':
            const resultado = sortearNumero();
            if (resultado.error) return resultado.error;
            return `🎲 *NÚMERO SORTEADO!* 🎲\n\n🔢 *${resultado.numero}*\n\n📊 Já sorteados: ${resultado.totalSorteados}\n🎯 Restam: ${resultado.restantes}`;
            
        case '!sorteados':
            return formatarSorteados();
            
        case '!novobingo':
            return resetarBingo();
            
        default:
            return null;
    }
}

// Inicializar cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('✅ Bot está online e funcionando!');
    console.log(`🎮 Comandos disponíveis: ${Object.values(CONFIG.commands).join(', ')}`);
    loadData(); // Carregar dados salvos
});

client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return;
    if (message.isStatus) return;
    
    const msgBody = message.body.trim();
    const isCommand = Object.values(CONFIG.commands).some(cmd => msgBody.startsWith(cmd));
    
    if (isCommand) {
        console.log(`📨 Comando recebido de ${message.from}: ${msgBody}`);
        const response = await processCommand(message, msgBody, message.from);
        if (response) {
            await message.reply(response);
            console.log(`✅ Resposta enviada para ${message.from}`);
        }
    }
});

// Servidor HTTP para manter o bot ativo no Render
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        bingoStats: {
            sorteados: bingoData.numerosSorteados.length,
            total: CONFIG.maxNum,
            jogoAtivo: bingoData.jogoAtivo
        }
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

// Iniciar o bot
client.initialize();