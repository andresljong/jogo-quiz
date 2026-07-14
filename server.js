const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Guardará a lista de perguntas enviada pelo professor para a rodada atual
let perguntasRodada = [];
// Guardará o progresso de cada aluno (id_do_aluno -> índice da pergunta atual)
const progressoAlunos = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    // Quando o professor envia a lista de perguntas para iniciar o jogo
    socket.on('iniciar_rodada_perguntas', (dados) => {
        perguntasRodada = dados.perguntas;
        console.log("Nova rodada iniciada com as perguntas:", perguntasRodada);
        
        // Reseta o progresso de todos para a primeira pergunta (índice 0)
        for (let id in progressoAlunos) {
            progressoAlunos[id] = 0;
        }

        // Dispara para todos os alunos que o jogo começou e envia a primeira pergunta
        io.emit('jogo_iniciado', { primeiraPergunta: perguntasRodada[0] });
    });

    // Quando o aluno entra ou atualiza a página, verifica se já tem jogo rodando
    socket.on('aluno_entrou', () => {
        if (perguntasRodada.length > 0) {
            // Se o aluno acabou de entrar, ele começa na pergunta 0
            progressoAlunos[socket.id] = 0;
            socket.emit('receber_pergunta_aluno', { 
                pergunta: perguntasRodada[0], 
                indice: 0,
                fim: false 
            });
        }
    });

    // Quando o aluno envia uma resposta
    socket.on('enviar_resposta', (dados) => {
        const indiceAtual = progressoAlunos[socket.id] || 0;
        
        // Envia a resposta do aluno para o professor saber qual pergunta está sendo respondida
        io.emit('nova_resposta_professor', {
            id_aluno: socket.id,
            nome: dados.nome,
            resposta: dados.resposta,
            pergunta: perguntasRodada[indiceAtual],
            indice_pergunta: indiceAtual
        });
    });

    // Quando o professor decide se aprova ou rejeita
    socket.on('decisao_professor', (dados) => {
        if (dados.aprovado) {
            // Avança o aluno para a próxima pergunta
            if (progressoAlunos[dados.id_aluno] !== undefined) {
                progressoAlunos[dados.id_aluno]++;
            } else {
                progressoAlunos[dados.id_aluno] = 1;
            }

            const proximoIndice = progressoAlunos[dados.id_aluno];

            // Verifica se o aluno já respondeu todas as perguntas enviadas
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
            // Se foi rejeitado, apenas avisa o aluno para tentar de novo a mesma
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
