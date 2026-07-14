const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Lista de perguntas do quiz
const perguntas = [
    "1. Qual é a capital do Brasil?",
    "2. Quanto é 8 x 7?",
    "3. Qual o gás mais abundante na atmosfera terrestre?"
];

// Servir os arquivos da pasta 'public'
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    // Quando o aluno entra, ele pede a pergunta atual dele
    socket.on('pedir_pergunta', (indice) => {
        if (indice < perguntas.length) {
            socket.emit('receber_pergunta', { pergunta: perguntas[indice], fim: false });
        } else {
            socket.emit('receber_pergunta', { pergunta: "Parabéns! Você concluiu o quiz!", fim: true });
        }
    });

    // Quando o aluno envia uma resposta
    socket.on('enviar_resposta', (dados) => {
        // Envia a resposta do aluno diretamente para o painel do professor
        io.emit('nova_resposta_professor', {
            id_aluno: socket.id,
            nome: dados.nome,
            resposta: dados.resposta,
            pergunta: perguntas[dados.indice_pergunta],
            indice_pergunta: dados.indice_pergunta
        });
    });

    // Quando o professor aprova ou rejeita
    socket.on('decisao_professor', (dados) => {
        // Envia o veredito especificamente para o aluno que respondeu
        io.to(dados.id_aluno).emit('resultado_avaliacao', {
            aprovado: dados.aprovado
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuário se desconectou:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Jogo rodando na porta ${PORT}`);
});
