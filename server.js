const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let perguntasRodada = [];
const progressoAlunos = {};
let contadorRespostas = 0; // Gerador de IDs únicos para as respostas recebidas

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    socket.on('iniciar_rodada_perguntas', (dados) => {
        perguntasRodada = dados.perguntas;
        console.log("Nova rodada iniciada:", perguntasRodada);
        
        for (let id in progressoAlunos) {
            progressoAlunos[id] = 0;
        }

        io.emit('jogo_iniciado', { primeiraPergunta: perguntasRodada[0] });
    });

    socket.on('aluno_entrou', () => {
        if (perguntasRodada.length > 0) {
            progressoAlunos[socket.id] = 0;
            socket.emit('receber_pergunta_aluno', { 
                pergunta: perguntasRodada[0], 
                indice: 0,
                fim: false 
            });
        }
    });

    socket.on('enviar_resposta', (dados) => {
        const indiceAtual = progressoAlunos[socket.id] || 0;
        contadorRespostas++; // Incrementa para gerar um ID de resposta único
        
        io.emit('nova_resposta_professor', {
            id_resposta: `resp-${contadorRespostas}`, // ID único do "card" da resposta
            id_aluno: socket.id,
            nome: dados.nome,
            resposta: dados.resposta,
            pergunta: perguntasRodada[indiceAtual],
            indice_pergunta: indiceAtual
        });
    });

    socket.on('decisao_professor', (dados) => {
        if (dados.aprovado) {
            if (progressoAlunos[dados.id_aluno] !== undefined) {
                progressoAlunos[dados.id_aluno]++;
            } else {
                progressoAlunos[dados.id_aluno] = 1;
            }

            const proximoIndice = progressoAlunos[dados.id_aluno];

            if (proximoIndice < perguntasRodada.length) {
                io.to(dados.id_aluno).emit('resultado_avaliacao', {
                    aprovado: true,
                    fim: false,
                    proximaPergunta: perguntasRodada[proximoIndice],
                    indice: proximoIndice
                });
            } else {
                io.to(dados.id_aluno).emit('resultado_avaliacao', {
                    aprovado: true,
                    fim: true
                });
            }
        } else {
            io.to(dados.id_aluno).emit('resultado_avaliacao', {
                aprovado: false
            });
        }
    });

    socket.on('disconnect', () => {
        delete progressoAlunos[socket.id];
        console.log('Usuário se desconectou:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Jogo rodando na porta ${PORT}`);
});
